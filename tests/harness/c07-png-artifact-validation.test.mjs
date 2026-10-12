import assert from 'node:assert/strict';
import { deflateSync } from 'node:zlib';
import test from 'node:test';
import { inspectC07PngArtifact } from '../../scripts/lib/c07-png-artifact-validation.mjs';

const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
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

function paeth(left, above, upperLeft) {
  const estimate = left + above - upperLeft;
  const distances = [
    Math.abs(estimate - left),
    Math.abs(estimate - above),
    Math.abs(estimate - upperLeft),
  ];
  if (distances[0] <= distances[1] && distances[0] <= distances[2]) return left;
  return distances[1] <= distances[2] ? above : upperLeft;
}

function chunk(type, data) {
  const typeBytes = Buffer.from(type, 'ascii');
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])));
  return Buffer.concat([length, typeBytes, data, crc]);
}

function createPng({ width = 16, height = 10, blank = false, includePalette = false } = {}) {
  const rawRows = [];
  let previous = Buffer.alloc(width * 4);
  for (let y = 0; y < height; y += 1) {
    const raw = Buffer.alloc(width * 4);
    for (let x = 0; x < width; x += 1) {
      const index = x * 4;
      raw[index] = blank ? 240 : (x * 17 + y * 5) & 0xff;
      raw[index + 1] = blank ? 240 : (x * 7 + y * 19) & 0xff;
      raw[index + 2] = blank ? 240 : (x * 3 + y * 11) & 0xff;
      raw[index + 3] = 0xff;
    }
    const filterType = y % 5;
    const encoded = Buffer.alloc(raw.length + 1);
    encoded[0] = filterType;
    for (let index = 0; index < raw.length; index += 1) {
      const left = index >= 4 ? raw[index - 4] : 0;
      const above = previous[index];
      const upperLeft = index >= 4 ? previous[index - 4] : 0;
      const predictor =
        filterType === 0
          ? 0
          : filterType === 1
            ? left
            : filterType === 2
              ? above
              : filterType === 3
                ? Math.floor((left + above) / 2)
                : paeth(left, above, upperLeft);
      encoded[index + 1] = (raw[index] - predictor) & 0xff;
    }
    rawRows.push(encoded);
    previous = raw;
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const imageData = Buffer.concat(rawRows);
  return Buffer.concat([
    SIGNATURE,
    chunk('IHDR', header),
    ...(includePalette ? [chunk('PLTE', Buffer.from([255, 255, 255]))] : []),
    chunk('IDAT', deflateSync(imageData)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

test('C07 PNG validation decodes filtered rows and matches metadata dimensions', () => {
  const png = createPng();
  assert.deepEqual(inspectC07PngArtifact(png, 16, 10), {
    decoded: true,
    dimensionsMatch: true,
    nonblankPixelSignalVerified: true,
  });
  assert.equal(inspectC07PngArtifact(createPng({ includePalette: true }), 16, 10).decoded, true);
  assert.equal(inspectC07PngArtifact(png, 15, 10).dimensionsMatch, false);
});

test('C07 PNG validation rejects blank, corrupted, and oversized artifacts', () => {
  const blank = inspectC07PngArtifact(createPng({ blank: true }), 16, 10);
  assert.equal(blank.decoded, true);
  assert.equal(blank.nonblankPixelSignalVerified, false);

  const corrupted = createPng();
  corrupted[corrupted.length - 5] ^= 0xff;
  assert.equal(inspectC07PngArtifact(corrupted, 16, 10).decoded, false);
  assert.equal(inspectC07PngArtifact(Buffer.alloc(5_000_001), 16, 10).decoded, false);
});
