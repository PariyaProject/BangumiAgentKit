import { describe, it, expect, afterAll } from 'vitest';
import {
  RenderService,
  SubjectCardViewModel,
  SearchListViewModel,
  CalendarViewModel,
} from '../../packages/renderer/src/index.js';
import { isUrlAllowed, renderHtmlTemplate } from '../../packages/renderer/src/internal/index.js';

describe('Phase 7: Renderer & SSRF Protection Tests', () => {
  const renderService = new RenderService();

  afterAll(async () => {
    await renderService.close();
  });

  it('Asset Proxy blocks local, private, and metadata URLs (SSRF Protection)', () => {
    expect(isUrlAllowed('http://localhost/avatar.jpg')).toBe(false);
    expect(isUrlAllowed('http://127.0.0.1/test.png')).toBe(false);
    expect(isUrlAllowed('http://10.0.0.1/internal.png')).toBe(false);
    expect(isUrlAllowed('http://192.168.1.1/router.png')).toBe(false);
    expect(isUrlAllowed('http://169.254.169.254/latest/user-data')).toBe(false);
    expect(isUrlAllowed('file:///etc/passwd')).toBe(false);

    expect(isUrlAllowed('https://lain.bgm.tv/pic/cover/l/00/01/1.jpg')).toBe(true);
    expect(isUrlAllowed('https://bgm.tv/img/no_icon_subject.png')).toBe(true);
  });

  it('renderHtmlTemplate produces valid HTML for subject-card, search-list, and calendar', () => {
    const subjectVm: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: {
        id: 226998,
        name: '少女終末旅行',
        nameCn: '少女终末旅行',
        type: 'anime',
        score: 8.6,
        tags: ['治愈', '末日', '神作'],
      },
      source: { label: 'Bangumi Agent Kit' },
    };

    const html = renderHtmlTemplate(subjectVm);
    expect(html).toContain('少女终末旅行');
    expect(html).toContain('8.6');
    expect(html).toContain('Bangumi Agent Kit');

    const searchVm: SearchListViewModel = {
      template: 'search-list',
      version: 1,
      query: '少女',
      total: 10,
      items: [{ id: 1, name: '少女动画', nameCn: '少女动画', score: 9.0, type: 'anime' }],
    };
    const searchHtml = renderHtmlTemplate(searchVm);
    expect(searchHtml).toContain('搜索结果');
    expect(searchHtml).toContain('少女动画');

    const calendarVm: CalendarViewModel = {
      template: 'calendar',
      version: 1,
      days: [{ weekdayCn: '星期一', items: [{ id: 1, name: '新番 1', nameCn: '新番 1' }] }],
    };
    const calendarHtml = renderHtmlTemplate(calendarVm);
    expect(calendarHtml).toContain('星期一');
  });

  it('RenderService caches rendered buffers by SHA-256 payload key', async () => {
    const subjectVm: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: { id: 226998, name: '少女終末旅行', type: 'anime' },
      source: { label: 'Bangumi Agent Kit' },
    };

    const res1 = await renderService.renderCard(subjectVm);
    const res2 = await renderService.renderCard(subjectVm);

    expect(res1.cacheKey).toBe(res2.cacheKey);
    expect(res1.buffer.equals(res2.buffer)).toBe(true);
  });
});
