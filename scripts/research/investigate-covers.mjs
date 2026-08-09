import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { AssetResolver } from '../../packages/renderer/dist/internal/index.js';
import { RenderService, buildSubjectCardViewModel } from '../../packages/renderer/dist/index.js';

const requireFromRenderer = createRequire(
  new URL('../../packages/renderer/package.json', import.meta.url),
);
const sharp = requireFromRenderer('sharp');

const USER_AGENT =
  'BangumiAgentKit-PR7A-Research/1.0 (+https://github.com/PariyaProject/BangumiAgentKit)';
const API_BASE = 'https://api.bgm.tv/v0';
const defaultOutput = '/tmp/bangumi-pr7a-cover-evidence';
const outputDir = process.argv[2] || defaultOutput;

fs.mkdirSync(outputDir, { recursive: true });

async function apiGet(pathname) {
  const response = await fetch(`${API_BASE}${pathname}`, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`Bangumi API ${response.status} ${response.statusText} for ${pathname}`);
  }
  return await response.json();
}

async function inspectSourceImage(url) {
  if (!url) {
    return { error: 'subject has no image URL' };
  }

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'image/avif,image/webp,image/jpeg,image/png,*/*',
        'User-Agent': USER_AGENT,
      },
      redirect: 'follow',
    });
    const body = Buffer.from(await response.arrayBuffer());
    const metadata = await sharp(body).metadata();
    return {
      status: response.status,
      finalUrl: response.url,
      contentType: response.headers.get('content-type'),
      bytes: body.length,
      decodedFormat: metadata.format,
      width: metadata.width,
      height: metadata.height,
    };
  } catch (error) {
    return { error: String(error) };
  }
}

function toDomainSubject(subject) {
  return {
    id: subject.id,
    type: 'anime',
    name: subject.name,
    nameCn: subject.name_cn || subject.name,
    summary: subject.short_summary || '',
    nsfw: Boolean(subject.nsfw),
    locked: Boolean(subject.locked),
    date: subject.date,
    images: subject.images,
    score: subject.score,
    rank: subject.rank,
    eps: subject.eps,
    totalEpisodes: subject.total_episodes,
  };
}

const [ranked, newest] = await Promise.all([
  apiGet('/subjects?type=2&sort=rank&limit=10&offset=0'),
  apiGet('/subjects?type=2&sort=date&limit=15&offset=0'),
]);

const candidates = [...(ranked.data || []), ...(newest.data || [])];
const subjects = [];
const seen = new Set();
for (const subject of candidates) {
  if (!seen.has(subject.id) && subjects.length < 20) {
    seen.add(subject.id);
    subjects.push(subject);
  }
}

const assetResolver = new AssetResolver();
const renderService = new RenderService();
const rows = [];

try {
  for (const subject of subjects) {
    const imageUrl =
      subject.images?.large ||
      subject.images?.common ||
      subject.images?.medium ||
      subject.images?.small;
    const source = await inspectSourceImage(imageUrl);
    const resolved = await assetResolver.resolveAsset(imageUrl);
    const resolvedBuffer = resolved.dataUrl.startsWith('data:image/png;base64,')
      ? Buffer.from(resolved.dataUrl.slice('data:image/png;base64,'.length), 'base64')
      : Buffer.alloc(0);
    const resolvedMetadata = resolvedBuffer.length
      ? await sharp(resolvedBuffer).metadata()
      : undefined;
    const viewModel = buildSubjectCardViewModel(toDomainSubject(subject), {
      sourceLabel: 'PR-7A cover investigation',
      summaryMaxPoints: 80,
    });
    const rendered = await renderService.renderCard(viewModel, {
      width: 960,
      deviceScaleFactor: 1,
    });
    const screenshotPath = path.join(outputDir, `subject-${subject.id}.png`);
    fs.writeFileSync(screenshotPath, rendered.buffer);

    rows.push({
      subjectId: subject.id,
      title: subject.name_cn || subject.name,
      sourceImageUrl: imageUrl,
      source,
      assetResolver: {
        dataUrlPrefix: resolved.dataUrl.slice(0, 22),
        dataUrlBytes: resolvedBuffer.length,
        decodedFormat: resolvedMetadata?.format,
        width: resolvedMetadata?.width,
        height: resolvedMetadata?.height,
        warning: resolved.warning,
      },
      render: {
        screenshotPath,
        bytes: rendered.buffer.length,
        width: rendered.width,
        height: rendered.height,
        warnings: rendered.warnings,
      },
    });
  }
} finally {
  await renderService.close();
}

const reportPath = path.join(outputDir, 'cover-investigation.json');
fs.writeFileSync(
  reportPath,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      outputDir,
      sourceSelection:
        '10 rank-sorted + 10 date-sorted anime subjects from official v0 API, de-duplicated',
      rows,
    },
    null,
    2,
  ),
);
console.log(reportPath);
