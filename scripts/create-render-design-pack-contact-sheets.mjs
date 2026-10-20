import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { renderProvenance } from './acceptance/render-provenance.mjs';

const requireRendererDependency = createRequire(
  new URL('../packages/renderer/package.json', import.meta.url),
);
const sharp = requireRendererDependency('sharp');

const runId = process.argv[2];
if (!runId || !/^[a-z0-9][a-z0-9-]{4,90}$/u.test(runId)) {
  throw new Error(
    'Usage: node scripts/create-render-design-pack-contact-sheets.mjs <matrix-run-id>',
  );
}

const matrixRoot = path.resolve(process.cwd(), '.artifacts', `render-theme-matrix-${runId}`);
const outputRoot = path.join(matrixRoot, 'contact-sheets');
const designPacks = ['warm-editorial', 'clean-gallery', 'graphic-zine'];
const themes = ['bangumi-light', 'bangumi-dark'];
const widths = [320, 360, 520, 640, 960];
const cellWidth = 320;
const cellHeight = 378;
const columns = designPacks.length * themes.length;
const rows = widths.length;
const sheetWidth = columns * cellWidth;
const sheetHeight = 52 + rows * cellHeight;

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function stableId(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/gu, '-')
    .replace(/^-|-$/gu, '');
}

async function findManifests(directory) {
  const found = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...(await findManifests(absolute)));
    else if (entry.name === 'manifest.json') found.push(absolute);
  }
  return found.sort();
}

const manifestPaths = await findManifests(matrixRoot);
if (manifestPaths.length === 0) throw new Error(`No render manifests found under ${matrixRoot}`);
const fixedReferenceOnly =
  manifestPaths.length === 1 &&
  path.basename(path.dirname(manifestPaths[0])) === 'fixed-reference-fixture';

const groups = new Map();
let totalReceipts = 0;
const receiptErrors = [];
let captureProvenance;
const maskAudit = {
  imagesWithMaskReceipts: 0,
  imagesWithPrimaryPanelMask: 0,
  imagesWithAlternatePanelMask: 0,
  imagesWithProgressMask: 0,
  primaryPanelMaskCount: 0,
  alternatePanelMaskCount: 0,
  progressMaskCount: 0,
  unsupportedShapeMaskCount: 0,
  invalidMarkedPanelCount: 0,
};

for (const manifestPath of manifestPaths) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const manifestProvenance = {
    candidate: manifest.candidate,
    source: manifest.source,
    rendererBuild: manifest.rendererBuild,
  };
  if (
    !manifestProvenance.candidate?.headSha ||
    !manifestProvenance.candidate?.baseSha ||
    !manifestProvenance.source?.workingTreeSha256 ||
    !manifestProvenance.source?.includedPathCount ||
    !manifestProvenance.rendererBuild?.kind ||
    !manifestProvenance.rendererBuild?.sha256
  ) {
    receiptErrors.push(`missing Candidate/source/build provenance: ${manifestPath}`);
  } else if (!captureProvenance) {
    captureProvenance = manifestProvenance;
  } else if (JSON.stringify(manifestProvenance) !== JSON.stringify(captureProvenance)) {
    receiptErrors.push(`mixed Candidate/source/build provenance: ${manifestPath}`);
  }
  for (const receipt of manifest.images ?? []) {
    totalReceipts += 1;
    const imagePath = path.join(path.dirname(manifestPath), receipt.filename);
    let bytes;
    try {
      bytes = await readFile(imagePath);
    } catch {
      receiptErrors.push(`missing image: ${imagePath}`);
      continue;
    }

    if (
      bytes.length !== receipt.bytes ||
      sha256(bytes) !== receipt.sha256 ||
      bytes.readUInt32BE(16) !== receipt.pngWidth ||
      bytes.readUInt32BE(20) !== receipt.pngHeight
    ) {
      receiptErrors.push(`receipt mismatch: ${imagePath}`);
      continue;
    }

    const maskReceipts = receipt.layout?.maskReceipts;
    if (maskReceipts) {
      maskAudit.imagesWithMaskReceipts += 1;
      const panels = maskReceipts.panels ?? [];
      const primaryPanelCount =
        maskReceipts.panelPrimaryCount ??
        panels.filter((mask) => mask.kind === 'panel' && mask.clipPath && mask.clipPath !== 'none')
          .length;
      const alternatePanelCount =
        maskReceipts.panelAltCount ??
        panels.filter(
          (mask) => mask.kind === 'panel-alt' && mask.clipPath && mask.clipPath !== 'none',
        ).length;
      if (primaryPanelCount > 0) {
        maskAudit.primaryPanelMaskCount += primaryPanelCount;
        maskAudit.imagesWithPrimaryPanelMask += 1;
      } else if (
        panels.some((mask) => mask.kind === 'panel' && mask.clipPath && mask.clipPath !== 'none')
      ) {
        maskAudit.imagesWithPrimaryPanelMask += 1;
      }
      if (alternatePanelCount > 0) {
        maskAudit.alternatePanelMaskCount += alternatePanelCount;
        maskAudit.imagesWithAlternatePanelMask += 1;
      } else if (
        panels.some(
          (mask) => mask.kind === 'panel-alt' && mask.clipPath && mask.clipPath !== 'none',
        )
      ) {
        maskAudit.imagesWithAlternatePanelMask += 1;
      }
      if (panels.some((mask) => !mask.clipPath || mask.clipPath === 'none')) {
        maskAudit.invalidMarkedPanelCount += 1;
        receiptErrors.push(`invalid rendered panel mask: ${imagePath}`);
      }
      const progressMasks = maskReceipts.progressTracks ?? [maskReceipts.progress].filter(Boolean);
      const validProgressMaskCount = progressMasks.filter(
        (clipPath) => clipPath && clipPath !== 'none',
      ).length;
      if (validProgressMaskCount > 0) {
        maskAudit.imagesWithProgressMask += 1;
        maskAudit.progressMaskCount += validProgressMaskCount;
      }
      if (maskReceipts.progressTracks?.some((clipPath) => !clipPath || clipPath === 'none')) {
        receiptErrors.push(`invalid rendered progress mask: ${imagePath}`);
      }
      if (maskReceipts.unsupportedShapeMasks?.length) {
        maskAudit.unsupportedShapeMaskCount += maskReceipts.unsupportedShapeMasks.length;
        receiptErrors.push(`unsupported CSS shape mask: ${imagePath}`);
      }
    }

    const key = `${receipt.template}/${receipt.state}/${receipt.fixtureId}`;
    const group = groups.get(key) ?? {
      template: receipt.template,
      state: receipt.state,
      fixtureId: receipt.fixtureId,
      images: new Map(),
    };
    const matrixKey = `${receipt.designPack}/${receipt.theme}/${receipt.cssWidth}`;
    if (group.images.has(matrixKey))
      receiptErrors.push(`duplicate matrix key: ${key}/${matrixKey}`);
    group.images.set(matrixKey, { ...receipt, imagePath });
    groups.set(key, group);
  }
}

if (captureProvenance) {
  const currentProvenance = renderProvenance(
    fixedReferenceOnly ? 'fixed-reference' : 'full-render',
  );
  if (JSON.stringify(currentProvenance) !== JSON.stringify(captureProvenance)) {
    receiptErrors.push('capture provenance does not match the current Candidate/source/build');
  }
}

const expectedKeys = designPacks.flatMap((pack) =>
  themes.flatMap((theme) => widths.map((width) => `${pack}/${theme}/${width}`)),
);
for (const [key, group] of groups) {
  const actual = new Set(group.images.keys());
  for (const expected of expectedKeys) {
    if (!actual.has(expected)) receiptErrors.push(`missing matrix key: ${key}/${expected}`);
  }
  if (actual.size !== expectedKeys.length) {
    receiptErrors.push(`unexpected image count for ${key}: ${actual.size}`);
  }
}
if (
  !fixedReferenceOnly &&
  maskAudit.imagesWithMaskReceipts > 0 &&
  maskAudit.imagesWithAlternatePanelMask === 0
) {
  receiptErrors.push('full render matrix did not exercise any alternate panel masks');
}

if (receiptErrors.length > 0) {
  console.error(
    JSON.stringify(
      { receiptErrors: receiptErrors.slice(0, 100), count: receiptErrors.length },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} else {
  await mkdir(outputRoot, { recursive: true });
  const contactSheets = [];

  for (const [key, group] of [...groups.entries()].sort(([left], [right]) =>
    left.localeCompare(right),
  )) {
    const composites = [];
    for (let row = 0; row < widths.length; row += 1) {
      const width = widths[row];
      for (let column = 0; column < columns; column += 1) {
        const pack = designPacks[Math.floor(column / themes.length)];
        const theme = themes[column % themes.length];
        const matrixKey = `${pack}/${theme}/${width}`;
        const receipt = group.images.get(matrixKey);
        const x = column * cellWidth;
        const y = 52 + row * cellHeight;
        const label = `${pack} / ${theme === 'bangumi-light' ? 'light' : 'dark'} / ${width}px`;
        const header = Buffer.from(
          `<svg width="${cellWidth}" height="38" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#ffffff"/><text x="8" y="24" font-family="Arial,sans-serif" font-size="14" fill="#17212b">${escapeXml(label)}</text></svg>`,
        );
        const thumb = await sharp(receipt.imagePath)
          .resize({
            width: cellWidth - 20,
            height: cellHeight - 54,
            fit: 'inside',
            background: '#ffffff',
          })
          .png()
          .toBuffer();
        const thumbMetadata = await sharp(thumb).metadata();
        composites.push({ input: header, left: x, top: y });
        composites.push({
          input: thumb,
          left: x + Math.floor((cellWidth - (thumbMetadata.width ?? 0)) / 2),
          top: y + 40,
        });
      }
    }

    const title = Buffer.from(
      `<svg width="${sheetWidth}" height="52" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#e9edf2"/><text x="18" y="34" font-family="Arial,sans-serif" font-size="21" font-weight="700" fill="#17212b">${escapeXml(key)} · all design packs, palettes, widths</text></svg>`,
    );
    const filename = `${stableId(group.template)}-${stableId(group.state)}-${group.fixtureId}.png`;
    const absolutePath = path.join(outputRoot, filename);
    const sheet = await sharp({
      create: {
        width: sheetWidth,
        height: sheetHeight,
        channels: 4,
        background: '#dfe4ea',
      },
    })
      .composite([{ input: title, left: 0, top: 0 }, ...composites])
      .png()
      .toBuffer();
    await writeFile(absolutePath, sheet);
    contactSheets.push({
      key,
      template: group.template,
      state: group.state,
      fixtureId: group.fixtureId,
      imageCount: group.images.size,
      width: sheetWidth,
      height: sheetHeight,
      path: path.relative(process.cwd(), absolutePath),
      bytes: sheet.length,
      sha256: sha256(sheet),
      visualReview: { decision: 'PENDING', finding: null },
    });
  }

  const reportPath = path.join(outputRoot, 'contact-sheets.json');
  const report = {
    runId,
    matrixKind: fixedReferenceOnly ? 'fixed-reference' : 'full-render',
    matrixRoot: path.relative(process.cwd(), matrixRoot),
    ...captureProvenance,
    manifestCount: manifestPaths.length,
    imageCount: totalReceipts,
    fixtureGroupCount: groups.size,
    designPacks,
    themes,
    widths,
    receiptVerification: 'PASS',
    maskAudit,
    contactSheets,
  };
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(
    JSON.stringify(
      {
        state: 'CONTACT_SHEETS_CREATED',
        manifestCount: manifestPaths.length,
        imageCount: totalReceipts,
        fixtureGroupCount: groups.size,
        contactSheetCount: contactSheets.length,
        reportPath: path.relative(process.cwd(), reportPath),
      },
      null,
      2,
    ),
  );
}
