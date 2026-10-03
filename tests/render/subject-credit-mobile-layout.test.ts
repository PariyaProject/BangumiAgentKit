import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type {
  CastCardViewModel,
  RenderResult,
  SubjectCardViewModel,
} from '@bangumi-agent-kit/renderer';
import { RenderService, renderHtmlTemplate } from '@bangumi-agent-kit/renderer';
import { closeMobileLayoutBrowser, measureRenderRootLayout } from './helpers/mobile-layout.js';

describe('subject card mobile title hierarchy', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = new RenderService();
  });

  afterAll(async () => {
    await renderService.close();
    await closeMobileLayoutBrowser();
  });

  async function saveVisual(name: string, rendered: RenderResult): Promise<void> {
    const outputDirectory = process.env.SUBJECT_CREDIT_VISUAL_QA_DIR;
    if (!outputDirectory) return;
    await mkdir(outputDirectory, { recursive: true });
    await writeFile(join(outputDirectory, name), rendered.buffer);
  }

  it('gives Chinese and Japanese subject titles the full phone-card width', async () => {
    const viewModel: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: {
        id: 328609,
        name: 'ぼっち・ざ・ろっく！',
        nameCn: '孤独摇滚！',
        type: 'anime',
        date: '2022-10-08',
        score: 8.4,
        rank: 73,
        summary: '少女乐队题材动画。',
        tags: ['音乐', '社团'],
      },
      source: { label: 'Bangumi Agent Kit' },
    };

    for (const width of [320, 360, 520]) {
      const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, width);
      const layout = await measureRenderRootLayout(html, width);
      const title = layout.titleBlocks.find((block) => block.title === '孤独摇滚！');

      expect(html, `localized media label at ${width}px`).toContain('类型: 动画');
      expect(layout.clientWidth, `root client width at ${width}px`).toBe(width);
      expect(layout.scrollWidth, `root scroll width at ${width}px`).toBe(width);
      expect(layout.overflowing, `overflow at ${width}px`).toEqual([]);
      expect(layout.contentOverflowing, `clipped text at ${width}px`).toEqual([]);
      expect(title, `subject title at ${width}px`).toBeDefined();
      expect(title!.blockWidth, `title block width at ${width}px`).toBeGreaterThanOrEqual(
        width * 0.65,
      );
      expect(title!.subtitle, `original Japanese title at ${width}px`).toBe('ぼっち・ざ・ろっく！');
      expect(title!.subtitleWidth, `subtitle width at ${width}px`).toBeGreaterThanOrEqual(
        width * 0.65,
      );
    }

    const rendered = await renderService.renderCard(viewModel, {
      width: 360,
      deviceScaleFactor: 2,
    });
    expect(rendered.width).toBe(720);
    expect(rendered.height).toBeLessThanOrEqual(8192);
    expect(rendered.buffer.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    await saveVisual('subject-card-360.png', rendered);
  });

  it('does not repeat the subject title as its own subtitle', async () => {
    const viewModel: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: {
        id: 218707,
        name: '少女終末旅行',
        nameCn: '少女終末旅行',
        type: 'anime',
      },
      source: { label: 'Bangumi Agent Kit' },
    };

    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 360);
    const layout = await measureRenderRootLayout(html, 360);

    expect(layout.titleBlocks[0]?.title).toBe('少女終末旅行');
    expect(layout.titleBlocks[0]?.subtitle).toBe('');
  });

  it('keeps cast and multiple actor names inside narrow chat cards', async () => {
    const viewModel: CastCardViewModel = {
      template: 'cast-card',
      version: 1,
      subject: {
        id: 16456,
        name: 'Shoujo Shuumatsu Ryokou',
        nameCn: '少女终末旅行',
      },
      items: [
        {
          character: { id: 1, name: `非常长的中文角色名称${'資料'.repeat(12)}` },
          relation: '主角 · 角色声优',
          actors: [
            { id: 11, name: '水瀬いのり' },
            { id: 12, name: 'AReallyLongUnbrokenRomanizedActorNameForMobileLayout' },
          ],
        },
        {
          character: { id: 2, name: '短标题角色' },
          relation: '配角',
          actors: [],
        },
      ],
      hiddenCount: 4,
    };

    for (const width of [320, 360, 520]) {
      const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, width);
      const layout = await measureRenderRootLayout(html, width);
      const title = layout.titleBlocks[0];

      expect(title?.title, `cast-card heading at ${width}px`).toBe('角色与声优');
      expect(title?.subtitle, `subject name at ${width}px`).toBe('少女终末旅行');
      expect(layout.clientWidth, `root client width at ${width}px`).toBe(width);
      expect(layout.scrollWidth, `root scroll width at ${width}px`).toBe(width);
      expect(layout.overflowing, `cast-card overflow at ${width}px`).toEqual([]);
      expect(layout.contentOverflowing, `cast-card clipped text at ${width}px`).toEqual([]);
      expect(html).toContain('暂无 CV/演员');
      expect(html).toContain('另有 4 位关联角色未全部展示');
    }

    const rendered = await renderService.renderCard(viewModel, {
      width: 360,
      deviceScaleFactor: 2,
    });
    expect(rendered.width).toBe(720);
    expect(rendered.height).toBeLessThanOrEqual(8192);
    expect(rendered.buffer.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    await saveVisual('cast-card-360.png', rendered);
  });
});
