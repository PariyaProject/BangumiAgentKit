import {
  ChatPlatformAdapter,
  InboundMessage,
  OutboundMessage,
  ReplyTarget,
  PlatformCapabilities,
  ConversationContext,
} from '@bangumi-agent-kit/platform-core';
import { QqPrivacyPolicyManager } from './privacy-policy.js';

export interface QqOfficialAdapterConfig {
  appId: string;
  appSecret?: string;
  botInstanceId?: string;
}

export class QqOfficialAdapter implements ChatPlatformAdapter {
  readonly provider = 'qq-official';
  private botInstanceId: string;
  private messageHistory = new Set<string>();
  private messageHandler?: (message: InboundMessage) => Promise<void>;
  public sentMessages: Array<{ target: ReplyTarget; message: OutboundMessage }> = [];

  constructor(config: QqOfficialAdapterConfig) {
    this.botInstanceId = config.botInstanceId || `qq_bot_${config.appId}`;
  }

  async start(handler: (message: InboundMessage) => Promise<void>): Promise<void> {
    this.messageHandler = handler;
  }

  async receiveRawEvent(event: {
    id: string;
    senderId: string;
    senderName?: string;
    conversationId: string;
    conversationType: 'private' | 'group' | 'channel';
    content: string;
  }): Promise<boolean> {
    // Deduplication check
    if (this.messageHistory.has(event.id)) {
      return false;
    }
    this.messageHistory.add(event.id);

    const inbound: InboundMessage = {
      provider: 'qq-official',
      botInstanceId: this.botInstanceId,
      messageId: event.id,
      sender: {
        externalUserId: event.senderId,
        displayName: event.senderName,
      },
      conversation: {
        id: event.conversationId,
        type: event.conversationType,
      },
      text: event.content,
      receivedAt: new Date(),
    };

    if (this.messageHandler) {
      await this.messageHandler(inbound);
    }
    return true;
  }

  async send(target: ReplyTarget, message: OutboundMessage): Promise<void> {
    const convContext: ConversationContext = {
      id: target.conversationId,
      type: target.conversationId.startsWith('group_') ? 'group' : 'private',
    };

    const sanitizedMessage = QqPrivacyPolicyManager.sanitizeOutboundMessage(convContext, message);

    this.sentMessages.push({
      target,
      message: sanitizedMessage,
    });
  }

  async getCapabilities(_target: ReplyTarget): Promise<PlatformCapabilities> {
    return {
      supportsImages: true,
      supportsPrivateMsg: true,
      maxTextLength: 1000,
    };
  }
}
