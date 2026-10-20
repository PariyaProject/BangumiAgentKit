import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { renderProvenance } from './render-provenance.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const runId = process.argv[2];
assert.match(runId ?? '', /^[a-zA-Z0-9._-]+$/u, 'run id must be a safe filename');

const root = path.join(repoRoot, '.artifacts/render', runId);
const manifestPath = path.join(root, 'manifest.json');
const outputRoot = path.join(root, 'contact-sheets');
const requireRendererDependency = createRequire(
  path.join(repoRoot, 'packages/renderer/package.json'),
);
const sharp = requireRendererDependency('sharp');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
const { candidate, source, rendererBuild } = manifest;
const provenance = { candidate, source, rendererBuild };
assert.deepEqual(renderProvenance('auth'), provenance, 'auth matrix provenance is stale');

const widths = manifest.widthsCssPx;
const designPacks = manifest.designPacks;
const themes = manifest.themes;
const callbackRecords = manifest.records.filter((record) => record.id.startsWith('callback-'));
const rendererRecords = manifest.records.filter((record) => record.rendererCaseId);
assert.equal(
  manifest.imageCount,
  manifest.callbackPageCount * widths.length +
    manifest.collectionRendererCaseCount * designPacks.length * themes.length * widths.length,
  'unexpected synthetic auth matrix size',
);
assert.equal(manifest.records.length, manifest.imageCount);
assert.equal(callbackRecords.length, manifest.callbackPageCount * widths.length);
assert.equal(
  rendererRecords.length,
  manifest.collectionRendererCaseCount * designPacks.length * themes.length * widths.length,
);

function sha256(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

function safeId(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/gu, '-')
    .replace(/^-|-$/gu, '');
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

const recordsByFile = new Map();
for (const record of manifest.records) {
  const imagePath = path.resolve(repoRoot, record.file);
  const bytes = await readFile(imagePath);
  assert.equal(sha256(bytes), record.sha256, `PNG hash mismatch: ${record.file}`);
  assert.equal(bytes.readUInt32BE(16), record.widthPx, `PNG width mismatch: ${record.file}`);
  assert.equal(bytes.readUInt32BE(20), record.heightPx, `PNG height mismatch: ${record.file}`);
  assert.equal(record.horizontalOverflow, false, `horizontal overflow: ${record.file}`);
  assert.ok(record.expectedTextPresent.every(Boolean), `missing expected text: ${record.file}`);
  recordsByFile.set(record.file, { ...record, imagePath });
}

await mkdir(outputRoot, { recursive: true });
const cellWidth = 320;
const cellHeight = 378;
const titleHeight = 52;

async function createContactSheet({ key, title, columns, getRecord }) {
  const sheetWidth = columns.length * cellWidth;
  const sheetHeight = titleHeight + widths.length * cellHeight;
  const composites = [];

  for (let row = 0; row < widths.length; row += 1) {
    const width = widths[row];
    for (let column = 0; column < columns.length; column += 1) {
      const record = getRecord(columns[column], width);
      assert.ok(record, `missing auth matrix image: ${key}/${columns[column]}/${width}`);
      const x = column * cellWidth;
      const y = titleHeight + row * cellHeight;
      const header = Buffer.from(
        `<svg width="${cellWidth}" height="38" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#ffffff"/><text x="8" y="24" font-family="Arial,sans-serif" font-size="13" fill="#17212b">${escapeXml(`${columns[column]} / ${width}px`)}</text></svg>`,
      );
      const thumb = await sharp(record.imagePath)
        .resize({
          width: cellWidth - 20,
          height: cellHeight - 54,
          fit: 'inside',
          background: '#ffffff',
        })
        .png()
        .toBuffer();
      const metadata = await sharp(thumb).metadata();
      composites.push({ input: header, left: x, top: y });
      composites.push({
        input: thumb,
        left: x + Math.floor((cellWidth - (metadata.width ?? 0)) / 2),
        top: y + 40,
      });
    }
  }

  const heading = Buffer.from(
    `<svg width="${sheetWidth}" height="${titleHeight}" xmlns="http://www.w3.org/2000/svg"><rect width="100%" height="100%" fill="#e9edf2"/><text x="18" y="34" font-family="Arial,sans-serif" font-size="21" font-weight="700" fill="#17212b">${escapeXml(title)}</text></svg>`,
  );
  const image = await sharp({
    create: {
      width: sheetWidth,
      height: sheetHeight,
      channels: 4,
      background: '#dfe4ea',
    },
  })
    .composite([{ input: heading, left: 0, top: 0 }, ...composites])
    .png()
    .toBuffer();
  const filename = `${safeId(key)}.png`;
  const absolutePath = path.join(outputRoot, filename);
  await writeFile(absolutePath, image);
  return {
    key,
    title,
    imageCount: widths.length * columns.length,
    width: sheetWidth,
    height: sheetHeight,
    path: path.relative(repoRoot, absolutePath),
    bytes: image.length,
    sha256: sha256(image),
    visualReview: { decision: 'PENDING', finding: null },
  };
}

const contactSheets = [];
const callbackIds = [...new Set(callbackRecords.map((record) => record.id))].sort();
contactSheets.push(
  await createContactSheet({
    key: 'synthetic-auth-callbacks',
    title: 'Synthetic OAuth callback states',
    columns: callbackIds,
    getRecord: (callbackId, width) =>
      recordsByFile.get(
        callbackRecords.find((record) => record.id === callbackId && record.widthCssPx === width)
          ?.file,
      ),
  }),
);

const rendererCaseIds = [...new Set(rendererRecords.map((record) => record.rendererCaseId))].sort();
for (const rendererCaseId of rendererCaseIds) {
  const columns = designPacks.flatMap((designPack) =>
    themes.map((theme) => `${designPack}/${theme}`),
  );
  contactSheets.push(
    await createContactSheet({
      key: rendererCaseId,
      title: `Synthetic collection state · ${rendererCaseId}`,
      columns,
      getRecord: (column, width) => {
        const [designPack, theme] = column.split('/');
        return recordsByFile.get(
          rendererRecords.find(
            (record) =>
              record.rendererCaseId === rendererCaseId &&
              record.designPack === designPack &&
              record.theme === theme &&
              record.widthCssPx === width,
          )?.file,
        );
      },
    }),
  );
}

const report = {
  schemaVersion: 2,
  runId,
  ...provenance,
  imageCount: manifest.imageCount,
  sheetCount: contactSheets.length,
  contactSheets,
  receiptVerification: 'PASS',
  layoutAudit: {
    horizontalOverflowCount: manifest.records.filter((record) => record.horizontalOverflow).length,
    missingExpectedTextCount: manifest.records.filter((record) =>
      record.expectedTextPresent.some((present) => !present),
    ).length,
  },
  manualVisualReview: 'PENDING',
};
const reportPath = path.join(outputRoot, 'contact-sheets.json');
await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(
  `${JSON.stringify({ state: 'AUTH_CONTACT_SHEETS_CREATED', imageCount: report.imageCount, sheetCount: report.sheetCount, reportPath: path.relative(repoRoot, reportPath) }, null, 2)}\n`,
);
