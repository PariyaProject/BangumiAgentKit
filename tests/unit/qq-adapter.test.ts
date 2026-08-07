import { describe, it, expect } from 'vitest';
import { QqOfficialAdapter, QqPrivacyPolicyManager } from '../../packages/platform-qq-official/src/index.js';
import { InboundMessage } from '../../packages/platform-core/src/index.js';

describe('Phase 8: QQ Official Adapter & Group Privacy Policy Tests', () => {
  it('receives raw events, converts to InboundMessage, and deduplicates messageId', async () => {
    const adapter = new QqOfficialAdapter({ appId: '10203040' });

    const received: InboundMessage[] = [];
    await adapter.start(async (msg) => {
      received.push(msg);
    });

    const isNew1 = await adapter.receiveRawEvent({
      id: 'msg_001',
      senderId: 'qq_user_1',
      senderName: 'Alice',
      conversationId: 'conv_group_100',
      conversationType: 'group',
      content: '搜索 少女终末旅行',
    });

    expect(isNew1).toBe(true);
    expect(received.length).toBe(1);
    expect(received[0]?.sender.displayName).toBe('Alice');

    // Duplicate message -> dropped
    const isNew2 = await adapter.receiveRawEvent({
      id: 'msg_001',
      senderId: 'qq_user_1',
      senderName: 'Alice',
      conversationId: 'conv_group_100',
      conversationType: 'group',
      content: '搜索 少女终末旅行',
    });

    expect(isNew2).toBe(false);
    expect(received.length).toBe(1);
  });

  it('redacts sensitive OAuth URLs in group chat messages', () => {
    const groupMessage = {
      text: '请点击授权链接进行绑定: https://bgm.tv/oauth/authorize?client_id=123',
    };

    const sanitized = QqPrivacyPolicyManager.sanitizeOutboundMessage(
      { id: 'group_100', type: 'group' },
      groupMessage
    );

    expect(sanitized.text).not.toContain('/oauth/authorize');
    expect(sanitized.text).toContain('私聊发送给你');
  });

  it('strips Bearer tokens from group outbound text', () => {
    const groupMessage = {
      text: 'Header: Bearer abc123def456xyz',
    };

    const sanitized = QqPrivacyPolicyManager.sanitizeOutboundMessage(
      { id: 'group_100', type: 'group' },
      groupMessage
    );

    expect(sanitized.text).toContain('Bearer ***');
    expect(sanitized.text).not.toContain('abc123def456xyz');
  });
});
