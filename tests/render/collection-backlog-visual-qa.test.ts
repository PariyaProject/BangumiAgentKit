import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { BangumiError, HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { CollectionBacklogService } from '@bangumi-agent-kit/bangumi-core';
import {
  buildCollectionBacklogViewModel,
  RenderService,
} from '@bangumi-agent-kit/renderer';

const outputDirectory = process.env.BANGUMI_BACKLOG_VISUAL_QA_DIR;
const widths = [320, 360, 520, 640, 960] as const;
const cases = [
  'complete',
  'complete-empty',
  'partial',
  'partial-empty',
  'dense',
  'auth-required',
  'permission-denied',
  'rate-limited',
  'upstream-error',
] as const;
type VisualCase = (typeof cases)[number];

const renderService = new RenderService();
afterAll(async () => renderService.close());

function buildClient(fetchFn: typeof fetch): GeneratedBangumiOpenApiClient {
  return new GeneratedBangumiOpenApiClient(new HttpClient({ fetchFn }));
}

function subjectRow(subjectId: number) {
  return {
    subject_id: subjectId,
    subject_type: 2,
    type: 3,
    rate: 8,
    comment: 'synthetic private comment; must never render',
    tags: [],
    ep_status: 1,
    vol_status: 0,
    updated_at: '2026-08-14T00:00:00.000Z',
    private: true,
    subject: {
      id: subjectId,
      type: 2,
      name: `Long Original Title ${subjectId}`,
      name_cn: `一个需要在窄卡片中安全换行的合成收藏标题：少女终末旅行特别篇 ${subjectId}`,
      short_summary: '',
      eps: 3,
      volumes: 0,
      collection_total: 10,
      score: 8,
      rank: subjectId,
      tags: [],
      images: { large: 'https://img.example.invalid/synthetic-only.png' },
    },
  };
}

function calendarDays(subjectIds: number[]) {
  const cnWeekdays = ['星期一', '星期二', '星期三', '星期四', '星期五', '星期六', '星期日'];
  const jaWeekdays = ['月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日', '日曜日'];
  const enWeekdays = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  return Array.from({ length: 7 }, (_, index) => ({
    weekday: {
      id: index + 1,
      en: enWeekdays[index],
      cn: cnWeekdays[index],
      ja: jaWeekdays[index],
    },
    items: index === 0
      ? subjectIds.map((id) => ({
          id,
          type: 2,
          name: `Synthetic Title ${id}`,
          name_cn: `合成标题 ${id}`,
          air_date: '2026-08-24',
          air_weekday: 1,
        }))
      : [],
  }));
}

function episodeRows(subjectId: number) {
  return Array.from({ length: 3 }, (_, index) => ({
    type: index === 0 ? 2 : 1,
    updated_at: 1_723_600_000,
    episode: {
      id: subjectId * 10 + index + 1,
      subject_id: subjectId,
      type: 0,
      name: `Episode ${index + 1}`,
      name_cn: `第 ${index + 1} 集`,
      sort: index + 1,
      ep: index + 1,
      airdate: '2026-01-01',
      duration_seconds: 1500,
    },
  }));
}

async function buildViewModel(visualCase: VisualCase) {
  const subjectCount = visualCase === 'dense' ? 10 : visualCase === 'complete' || visualCase === 'partial' ? 1 : 0;
  const subjectIds = Array.from({ length: subjectCount }, (_, index) => 1000 + index);
  const errorByCase: Partial<Record<VisualCase, BangumiError>> = {
    'auth-required': new BangumiError('AUTH_REQUIRED', 'synthetic auth required', false, 401, '请绑定当前账号后重试'),
    'permission-denied': new BangumiError('PERMISSION_DENIED', 'synthetic permission denied', false, 403, '请确认收藏读取权限后重试'),
    'rate-limited': new BangumiError('RATE_LIMITED', 'synthetic rate limit', false, 429, '请稍后重试'),
    'upstream-error': new BangumiError('UPSTREAM_UNAVAILABLE', 'synthetic upstream failure', false, 503, '请稍后重试'),
  };
  const fetchFn: typeof fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/calendar') {
      if (visualCase === 'partial' || visualCase === 'partial-empty') {
        throw new BangumiError('UPSTREAM_UNAVAILABLE', 'synthetic calendar partial', false, 503);
      }
      return new Response(JSON.stringify(calendarDays(subjectIds)), { status: 200 });
    }
    if (url.pathname.endsWith('/collections') && !url.pathname.includes('/episodes')) {
      const error = errorByCase[visualCase];
      if (error) throw error;
      return new Response(JSON.stringify({
        total: subjectIds.length,
        limit: 50,
        offset: 0,
        data: subjectIds.map(subjectRow),
      }), { status: 200 });
    }
    const episodePath = url.pathname.match(/\/collections\/(\d+)\/episodes$/u);
    if (episodePath) {
      return new Response(JSON.stringify({
        total: 3,
        limit: 100,
        offset: 0,
        data: episodeRows(Number(episodePath[1])),
      }), { status: 200 });
    }
    throw new Error(`Unexpected synthetic request: ${url.pathname}`);
  };
  const publicClient = new HttpClient({ fetchFn });
  const result = await new CollectionBacklogService(buildClient(fetchFn), publicClient).getCollectionBacklog(
    'synthetic-bound-user',
    { includeSchedule: true },
  );
  return buildCollectionBacklogViewModel(result);
}

describe.skipIf(!outputDirectory)('collection backlog final image matrix', () => {
  it('renders nine synthetic states at each required width and records PNG hashes', async () => {
    const destination = resolve(outputDirectory!);
    await mkdir(destination, { recursive: true });
    const manifest: Array<{
      case: VisualCase;
      filename: string;
      width: number;
      height: number;
      byteLength: number;
      sha256: string;
    }> = [];

    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-19T00:00:00.000Z'));
    try {
      for (const visualCase of cases) {
        const viewModel = await buildViewModel(visualCase);
        if (visualCase === 'partial') {
          expect(viewModel.presentation?.warningMessages).toEqual([
            '七日计划未能完整读取，相关安排保持未知；未观察到不等于没有计划。可稍后重试。',
          ]);
        }
        if (visualCase === 'partial-empty') {
          expect(viewModel.presentation?.warningMessages).toEqual([]);
        }
        for (const width of widths) {
          const rendered = await renderService.renderCard(viewModel, {
            width,
            deviceScaleFactor: 1,
            cache: false,
          });
          const filename = `${visualCase}-${width}.png`;
          await writeFile(join(destination, filename), rendered.buffer);
          manifest.push({
            case: visualCase,
            filename,
            width: rendered.width,
            height: rendered.height,
            byteLength: rendered.buffer.byteLength,
            sha256: createHash('sha256').update(rendered.buffer).digest('hex'),
          });
        }
      }
    } finally {
      vi.useRealTimers();
    }

    await writeFile(join(destination, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
    expect(manifest).toHaveLength(45);
    expect(new Set(manifest.map((item) => item.filename)).size).toBe(45);
    expect(manifest.every((item) => item.width > 0 && item.height > 0 && item.sha256.length === 64)).toBe(true);
  });
});
