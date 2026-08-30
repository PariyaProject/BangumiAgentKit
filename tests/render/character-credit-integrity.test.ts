import { describe, expect, it } from 'vitest';
import { CharacterCreditIntegrityService } from '@bangumi-agent-kit/bangumi-core';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import {
  buildCharacterCreditIntegrityViewModel,
  extractImageUrls,
  renderHtmlTemplate,
} from '@bangumi-agent-kit/renderer';
import { getTemplate } from '../../packages/renderer/src/templates/TemplateRegistry.js';

function json(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

describe('character-credit-integrity renderer', () => {
  it('renders stable-ID evidence and risks without image hydration', async () => {
    const fetchFn: typeof fetch = async (input) => {
      const path = new URL(String(input)).pathname;
      if (path.endsWith('/characters/100')) {
        return json({
          id: 100,
          name: '角色卡片',
          type: 1,
          summary: '不应触发图片下载的角色简介',
          locked: false,
          stat: {},
          images: { large: 'https://example.invalid/character.png' },
        });
      }
      if (path.endsWith('/subjects')) {
        return json([
          { id: 10, type: 2, name: '同名作品', name_cn: '同名作品', staff: '主角', eps: '1' },
          { id: 11, type: 2, name: '同名作品', name_cn: '同名作品', staff: '配角', eps: '2' },
        ]);
      }
      return json([
        {
          id: 20,
          name: '同名 CV',
          type: 1,
          subject_id: 10,
          subject_type: 2,
          subject_name: '同名作品',
          subject_name_cn: '同名作品',
          staff: '声优',
        },
      ]);
    };
    const result = await new CharacterCreditIntegrityService(
      new HttpClient({ fetchFn }),
    ).getCharacterCreditIntegrity(100);
    const viewModel = buildCharacterCreditIntegrityViewModel(result);

    expect(viewModel.template).toBe('character-credit-integrity');
    expect(getTemplate('character-credit-integrity').version).toBe(1);
    expect(extractImageUrls(viewModel)).toEqual([]);
    const html = renderHtmlTemplate(viewModel, 'bangumi-dark', {}, 640);
    expect(html).toContain('角色出演作品与 CV 完整性');
    expect(html).toContain('同名不同 ID');
    expect(html).toContain('不做名称合并');
    expect(html).not.toContain('character.png');
  });
});
