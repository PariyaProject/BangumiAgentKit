import { inflateSync } from 'node:zlib';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_ARTIFACT_BYTES = 5_000_000;
const MAX_IMAGE_PIXELS = 10_000_000;
const CRC_TABLE = Uint32Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function paethPredictor(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const leftDistance = Math.abs(estimate - left);
  const aboveDistance = Math.abs(estimate - above);
  const upperLeftDistance = Math.abs(estimate - upperLeft);
  if (leftDistance <= aboveDistance && leftDistance <= upperLeftDistance) return left;
  return aboveDistance <= upperLeftDistance ? above : upperLeft;
}

function inspectChunks(buffer) {
  let offset = PNG_SIGNATURE.length;
  let header = null;
  let sawData = false;
  let dataEnded = false;
  let sawEnd = false;
  let idatBytes = 0;
  const imageData = [];

  while (offset < buffer.length) {
    if (offset + 12 > buffer.length) throw new Error('truncated_chunk');
    const length = buffer.readUInt32BE(offset);
    const typeStart = offset + 4;
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    const chunkEnd = dataEnd + 4;
    if (length > MAX_ARTIFACT_BYTES || chunkEnd > buffer.length)
      throw new Error('invalid_chunk_length');
    const type = buffer.toString('ascii', typeStart, typeStart + 4);
    if (!/^[A-Za-z]{4}$/u.test(type)) throw new Error('invalid_chunk_type');
    const expectedCrc = buffer.readUInt32BE(dataEnd);
    if (crc32(buffer.subarray(typeStart, dataEnd)) !== expectedCrc)
      throw new Error('invalid_chunk_crc');

    if (header === null && type !== 'IHDR') throw new Error('missing_ihdr_first');
    if (type === 'IHDR') {
      if (header !== null || length !== 13 || sawData) throw new Error('invalid_ihdr');
      header = {
        width: buffer.readUInt32BE(dataStart),
        height: buffer.readUInt32BE(dataStart + 4),
        bitDepth: buffer[dataStart + 8],
        colorType: buffer[dataStart + 9],
        compression: buffer[dataStart + 10],
        filter: buffer[dataStart + 11],
        interlace: buffer[dataStart + 12],
      };
    } else if (type === 'IDAT') {
      if (!header || dataEnded || sawEnd) throw new Error('invalid_idat_order');
      sawData = true;
      idatBytes += length;
      if (idatBytes > MAX_ARTIFACT_BYTES) throw new Error('oversized_idat');
      imageData.push(buffer.subarray(dataStart, dataEnd));
    } else if (type === 'IEND') {
      if (!sawData || length !== 0 || sawEnd) throw new Error('invalid_iend');
      sawEnd = true;
    } else if (type === 'PLTE') {
      if (!header || sawData || length < 3 || length > 768 || length % 3 !== 0)
        throw new Error('invalid_palette_chunk');
    } else {
      if (sawData) dataEnded = true;
      if (/^[A-Z]/u.test(type)) throw new Error('unsupported_critical_chunk');
    }

    offset = chunkEnd;
    if (sawEnd) break;
  }

  if (!sawEnd || offset !== buffer.length || !header || imageData.length === 0) {
    throw new Error('incomplete_png');
  }
  return { header, compressedImage: Buffer.concat(imageData, idatBytes) };
}

function decodeTrueColorRows(header, compressedImage, expectedWidth, expectedHeight) {
  const { width, height, bitDepth, colorType, compression, filter, interlace } = header;
  if (
    !Number.isInteger(width) ||
    width <= 0 ||
    width > 3000 ||
    !Number.isInteger(height) ||
    height <= 0 ||
    height > 5000 ||
    width * height > MAX_IMAGE_PIXELS ||
    width !== expectedWidth ||
    height !== expectedHeight ||
    bitDepth !== 8 ||
    ![2, 6].includes(colorType) ||
    compression !== 0 ||
    filter !== 0 ||
    interlace !== 0
  ) {
    throw new Error('unsupported_or_mismatched_dimensions');
  }

  const channels = colorType === 6 ? 4 : 3;
  const rowBytes = width * channels;
  const expectedInflatedLength = (rowBytes + 1) * height;
  const inflated = inflateSync(compressedImage, { maxOutputLength: expectedInflatedLength });
  if (inflated.length !== expectedInflatedLength) throw new Error('invalid_scanline_length');

  const sampleStride = Math.max(1, Math.ceil((width * height) / 65_536));
  const sampledColors = new Set();
  let sampledPixels = 0;
  let visiblePixels = 0;
  let previous = Buffer.alloc(rowBytes);
  let sourceOffset = 0;
  let pixelIndex = 0;

  for (let y = 0; y < height; y += 1) {
    const filterType = inflated[sourceOffset];
    sourceOffset += 1;
    if (filterType > 4) throw new Error('invalid_scanline_filter');
    const encoded = inflated.subarray(sourceOffset, sourceOffset + rowBytes);
    sourceOffset += rowBytes;
    const row = Buffer.alloc(rowBytes);

    for (let index = 0; index < rowBytes; index += 1) {
      const left = index >= channels ? row[index - channels] : 0;
      const above = previous[index];
      const upperLeft = index >= channels ? previous[index - channels] : 0;
      const predictor =
        filterType === 0
          ? 0
          : filterType === 1
            ? left
            : filterType === 2
              ? above
              : filterType === 3
                ? Math.floor((left + above) / 2)
                : paethPredictor(left, above, upperLeft);
      row[index] = (encoded[index] + predictor) & 0xff;
    }

    for (let x = 0; x < width; x += 1) {
      if (pixelIndex % sampleStride === 0) {
        const pixelOffset = x * channels;
        const red = row[pixelOffset];
        const green = row[pixelOffset + 1];
        const blue = row[pixelOffset + 2];
        const alpha = channels === 4 ? row[pixelOffset + 3] : 0xff;
        sampledColors.add(`${red},${green},${blue},${alpha}`);
        sampledPixels += 1;
        if (alpha > 0) visiblePixels += 1;
      }
      pixelIndex += 1;
    }
    previous = row;
  }

  return {
    width,
    height,
    // This bounded sample detects blank/transparent output only; it does not
    // establish that text or chart labels are human-readable.
    nonblankPixelSignalVerified:
      sampledColors.size >= 8 && sampledPixels > 0 && visiblePixels / sampledPixels >= 0.8,
  };
}

export function inspectC07PngArtifact(buffer, expectedWidth, expectedHeight) {
  const failed = {
    decoded: false,
    dimensionsMatch: false,
    nonblankPixelSignalVerified: false,
  };
  if (
    !Buffer.isBuffer(buffer) ||
    buffer.length < PNG_SIGNATURE.length + 12 ||
    buffer.length > MAX_ARTIFACT_BYTES ||
    !buffer.subarray(0, 8).equals(PNG_SIGNATURE) ||
    !Number.isInteger(expectedWidth) ||
    !Number.isInteger(expectedHeight)
  )
    return failed;

  try {
    const { header, compressedImage } = inspectChunks(buffer);
    const decoded = decodeTrueColorRows(header, compressedImage, expectedWidth, expectedHeight);
    return {
      decoded: true,
      dimensionsMatch: decoded.width === expectedWidth && decoded.height === expectedHeight,
      nonblankPixelSignalVerified: decoded.nonblankPixelSignalVerified,
    };
  } catch {
    return failed;
  }
}
