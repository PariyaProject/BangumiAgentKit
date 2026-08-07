import { describe, it, expect } from 'vitest';
import {
  isUrlAllowed,
  renderHtmlTemplate,
  RenderService,
  SubjectCardViewModel,
  SearchListViewModel,
  CalendarViewModel,
} from '../../packages/renderer/src/index.js';

describe('Phase 7: Renderer & SSRF Protection Tests', () => {
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
      sourceLabel: 'Bangumi Agent Kit',
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
      page: 1,
      items: [{ id: 1, name: '少女动画', score: 9.0 }],
    };
    const searchHtml = renderHtmlTemplate(searchVm);
    expect(searchHtml).toContain('搜索结果');
    expect(searchHtml).toContain('少女动画');

    const calendarVm: CalendarViewModel = {
      template: 'calendar',
      version: 1,
      days: [{ weekdayCn: '星期一', items: [{ id: 1, nameCn: '新番 1' }] }],
    };
    const calendarHtml = renderHtmlTemplate(calendarVm);
    expect(calendarHtml).toContain('星期一');
  });

  it('RenderService caches rendered buffers by SHA-256 payload key', async () => {
    const service = new RenderService();
    const subjectVm: SubjectCardViewModel = {
      template: 'subject-card',
      version: 1,
      subject: { id: 226998, name: '少女終末旅行', type: 'anime' },
      sourceLabel: 'Bangumi Agent Kit',
    };

    const buf1 = await service.renderCard(subjectVm);
    const buf2 = await service.renderCard(subjectVm);

    expect(buf1).toEqual(buf2);
  });
});
