import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
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
});
