import { ConversationContext, OutboundMessage } from '@bangumi-agent-kit/platform-core';

export class QqPrivacyPolicyManager {
  static sanitizeOutboundMessage(conversation: ConversationContext, message: OutboundMessage): OutboundMessage {
    if (conversation.type !== 'group') {
      return message;
    }

    let sanitizedText = message.text || '';

    // Remove any accidental token strings or sensitive headers
    sanitizedText = sanitizedText.replace(/Bearer\s+[a-zA-Z0-9_-]+/gi, 'Bearer ***');
    sanitizedText = sanitizedText.replace(/code=[a-zA-Z0-9_-]+/gi, 'code=***');

    // If text contains OAuth authorization URL, replace with private DM redirect prompt
    if (sanitizedText.includes('/oauth/authorize') || sanitizedText.includes('bangumi.auth_start')) {
      sanitizedText = '为了账号安全，Bangumi 授权链接已通过私聊发送给你，请在私信中完成登录绑定。';
    }

    return {
      ...message,
      text: sanitizedText,
    };
  }
}
