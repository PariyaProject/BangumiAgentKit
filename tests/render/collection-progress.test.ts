import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  buildCollectionProgressMessage,
  buildCollectionProgressViewModel,
  renderHtmlTemplate,
  RenderService,
} from '@bangumi-agent-kit/renderer';
import { DEFAULT_PLACEHOLDER_DATA_URL } from '../../packages/renderer/src/asset-resolver.js';

describe('collection-progress renderer', () => {
  let renderService: RenderService;

  beforeAll(() => {
    renderService = new RenderService();
  });

  afterAll(async () => {
    await renderService.close();
  });

  it('renders a missing-cover collection state at the five acceptance widths', async () => {
    const viewModel = buildCollectionProgressViewModel(
      { id: 1, name: 'Synthetic title without a cover' },
      { status: 'wish', statusLabel: '想看', watchedEpisodes: 0 },
    );

    for (const width of [320, 360, 520, 640, 960]) {
      const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, width);
      expect(html).toContain('暂无封面');
      expect(html).not.toContain('No Image');
      const rendered = await renderService.renderCard(viewModel, {
        width,
        deviceScaleFactor: 1,
        cache: false,
      });
      expect(rendered.width).toBe(width);
      expect(rendered.buffer.length).toBeGreaterThan(1000);
    }
  });

  it('replaces the asset-proxy sentinel with an explicit cover-failure placeholder', () => {
    const coverUrl = 'https://fixture.invalid/failed-cover.png';
    const viewModel = buildCollectionProgressViewModel(
      { id: 2, name: 'Synthetic title with a failed cover', image: coverUrl },
      {
        status: 'doing',
        statusLabel: '在看',
        watchedEpisodes: 3,
        totalEpisodes: 12,
      },
    );

    const html = renderHtmlTemplate(
      viewModel,
      'bangumi-dark',
      { [coverUrl]: DEFAULT_PLACEHOLDER_DATA_URL },
      320,
    );
    expect(html).toContain('封面暂不可用');
    expect(html).not.toContain(DEFAULT_PLACEHOLDER_DATA_URL);
  });

  it('builds a concise companion message from the same collection progress view model', () => {
    const viewModel = buildCollectionProgressViewModel(
      { id: 3, name: 'Synthetic title', nameCn: '合成条目' },
      {
        status: 'doing',
        statusLabel: '在看',
        watchedEpisodes: 6,
        totalEpisodes: 12,
        rating: 9,
        comment: 'must not be copied into the companion message',
      },
    );
    const message = buildCollectionProgressMessage(viewModel);

    expect(message).toContain('《合成条目》：在看');
    expect(message).toContain('已看 6 / 12 集');
    expect(message).toContain('评分 9 / 10');
    expect(message).toContain('查看图片中的收藏状态、进度与评分');
    expect(message).not.toContain('must not be copied');
  });
});
