import { describe, expect, it } from 'vitest';
import { formatAuthStatusMessage } from '@bangumi-agent-kit/auth';

describe('auth status message', () => {
  it('explains that public queries work when no account is bound', () => {
    expect(formatAuthStatusMessage({ bound: false, accountCount: 0 })).toBe(
      '尚未绑定 Bangumi 账号。需要个人收藏功能时，再发起授权；公开查询无需绑定。',
    );
  });

  it('uses neutral wording when account rows exist but the active account cannot be confirmed', () => {
    const message = formatAuthStatusMessage({ bound: false, accountCount: 2 });

    expect(message).toContain('检测到 2 条 Bangumi 账号绑定记录');
    expect(message).toContain('无法确认可用的活动账号资料');
    expect(message).not.toContain('当前没有激活账号');
  });

  it('does not imply personal API access when a bound account has no credential record', () => {
    const message = formatAuthStatusMessage({
      bound: true,
      accountCount: 1,
      account: { username: 'fixture-user', nickname: 'Fixture' },
    });

    expect(message).toContain('已绑定 Fixture (@fixture-user)');
    expect(message).toContain('本地缺少授权凭证记录');
    expect(message).not.toContain('已授权访问个人数据');
  });

  it('describes local credential metadata without claiming an upstream request succeeded', () => {
    const message = formatAuthStatusMessage({
      bound: true,
      account: { username: 'fixture-user', nickname: 'Fixture' },
      credential: { expiresAt: '2026-10-20T10:00:00.000Z', refreshable: true },
    });

    expect(message).toContain('2026-10-20T10:00:00.000Z');
    expect(message).toContain('刷新状态：可刷新');
    expect(message).toContain('不代表个人数据请求已成功');
  });
});
