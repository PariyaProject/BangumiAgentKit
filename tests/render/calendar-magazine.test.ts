import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CalendarViewModel, RenderService } from '@bangumi-agent-kit/renderer';
import { renderHtmlTemplate } from '../../packages/renderer/src/template-engine.js';
import type { BrowserPool } from '../../packages/renderer/src/browser-pool.js';

const fixtures = JSON.parse(
  readFileSync(new URL('../fixtures/render/calendar-compact.json', import.meta.url), 'utf8'),
).cases as Array<{ id: string; viewModel: CalendarViewModel }>;
const fixture = (id: string) => structuredClone(fixtures.find((item) => item.id === id)!.viewModel);
const html = (vm: CalendarViewModel) =>
  renderHtmlTemplate(vm, 'bangumi-light', {}, 375, 'anime-magazine');

describe('compact magazine calendar semantic contract', () => {
  it('shows the supplied seven-day rail without six empty content panels or a false today marker', () => {
    const output = html(fixture('partial-three'));
    expect(output.match(/data-calendar-day-state="displayed"/g)).toHaveLength(1);
    expect(output.match(/data-calendar-day-state="omitted"/g)).toHaveLength(6);
    expect(output.match(/data-calendar-day-group/g)).toHaveLength(1);
    expect(output.match(/data-calendar-item="true"/g)).toHaveLength(3);
    for (const title of ['星港随笔', '海岸线日志', '风与晴空']) expect(output).toContain(title);
    expect(output).toContain('本次未展示，不代表停播');
    expect(output).not.toContain('今天');
  });

  it('keeps known empty, omitted and unknown day data distinct', () => {
    expect(html(fixture('known-empty')).match(/data-calendar-day-state="empty"/g)).toHaveLength(7);
    const unknown = fixture('partial-empty');
    delete unknown.days[0]!.observed;
    const output = html(unknown);
    expect(output.match(/data-calendar-day-state="unknown"/g)).toHaveLength(1);
    expect(output.match(/data-calendar-day-state="omitted"/g)).toHaveLength(6);
    expect(output).toContain('资料未知');
    expect(output).toContain('不能据此判断本周是否有放送');
  });

  it('does not turn an unavailable source into a known zero observation', () => {
    const output = html(fixture('unavailable'));
    expect(output).toContain('官方日历暂时不可用');
    expect(output).not.toContain('观察 0 部');
    expect(output).not.toContain('data-calendar-week-rail');
    expect(output).toContain('缺少星期：1、2、3、4、5、6、7');
  });

  it('retains both titles, first-air semantics, known zero values, missing fields and weekday conflicts', () => {
    const vm = fixture('long-missing-covers');
    const output = html(vm);
    expect(output).toContain(vm.days[3]!.items[0]!.name);
    expect(output).toContain(vm.days[3]!.items[0]!.nameCn);
    expect(output).toContain('首播 2026-07-01');
    for (const value of ['评分 0.0', '排名 0', '在看 0', '暂无封面', '字段未知：'])
      expect(output).toContain(value);
    const conflict = html(fixture('weekday-conflict'));
    for (const value of [
      '缺少星期：2、5',
      '重复星期：3',
      '条目星期冲突 2 条',
      '条目星期未知 2 条',
      '额外星期资料 1 组',
    ])
      expect(conflict).toContain(value);
  });

  it('preserves supplied names safely and the full-week choice through existing pack selection', () => {
    const vm = fixture('partial-three');
    vm.days[3]!.items[0]!.nameCn = '<script>untrusted</script> & 名称';
    expect(html(vm)).toContain('&lt;script&gt;untrusted&lt;/script&gt; &amp; 名称');
    for (const pack of ['warm-editorial', 'clean-gallery', 'graphic-zine'] as const) {
      const old = renderHtmlTemplate(vm, 'bangumi-light', {}, 375, pack);
      expect(old).not.toContain('compact-magazine-v1');
      expect(old).toContain('Bangumi 每日放送表');
      expect(old.match(/data-render-mask="panel-alt"/g)).toHaveLength(7);
    }
  });

  it('bounds actual browser-input artwork at chat display resolution while retaining all56 entries', async () => {
    const cover = readFileSync(
      new URL('../fixtures/render/anime-magazine-cover-f.png', import.meta.url),
    );
    const dataUrl = 'data:image/png;base64,' + cover.toString('base64');
    let htmlBytes = 0;
    let itemCount = 0;
    const pool = {
      async renderHtmlToBuffer(input: string) {
        htmlBytes = Buffer.byteLength(input);
        itemCount = (input.match(/data-calendar-item="true"/g) ?? []).length;
        return cover; // Rasterization is covered by native QA; inspect the real call-site payload here.
      },
      async close() {},
    } as unknown as BrowserPool;
    const resolver = { resolveAsset: async () => ({ dataUrl }) };
    const service = new RenderService(pool, undefined, resolver as never);
    try {
      await service.renderCard(fixture('bounded-large'), {
        designPack: 'anime-magazine',
        width: 320,
        deviceScaleFactor: 2,
        cache: false,
      });
      expect(itemCount).toBe(56);
      expect(htmlBytes).toBeLessThan(24 * 1024 * 1024);
    } finally {
      await service.close();
    }
  });
});
