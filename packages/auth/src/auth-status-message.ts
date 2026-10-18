import type { AuthStatusResult } from './token-broker.js';

export function formatAuthStatusMessage(status: AuthStatusResult): string {
  const accountCount = status.accountCount ?? 0;
  if (!status.bound) {
    if (accountCount > 0) {
      return `检测到 ${accountCount} 条 Bangumi 账号绑定记录，但当前无法确认可用的活动账号资料。请检查绑定状态，必要时重新授权；个人收藏查询暂不可用。`;
    }
    return '尚未绑定 Bangumi 账号。需要个人收藏功能时，再发起授权；公开查询无需绑定。';
  }

  const username = status.account?.username?.trim();
  const nickname = status.account?.nickname?.trim();
  const displayName = nickname || username || 'Bangumi 账号';
  const identity = username ? `${displayName} (@${username})` : displayName;

  if (!status.account) {
    return '检测到当前 Bangumi 账号绑定记录，但账号资料缺失。请重新查询状态，必要时重新授权。';
  }

  if (!status.credential) {
    return `已绑定 ${identity}，但本地缺少授权凭证记录。请重新授权后再使用个人收藏功能。`;
  }

  const expiry = new Date(status.credential.expiresAt);
  const expiresAt = Number.isNaN(expiry.getTime()) ? '未知' : expiry.toISOString();
  const refresh = status.credential.refreshable ? '可刷新' : '未提供刷新令牌';
  return `已绑定 ${identity}。本地凭证记录显示到期时间 ${expiresAt}，刷新状态：${refresh}。这只反映本地记录，不代表个人数据请求已成功；需要个人收藏时可继续查询，若请求提示授权失效再重新授权。`;
}
