export interface MessageSender {
  externalUserId: string;
  displayName?: string;
}

export interface ConversationContext {
  id: string;
  type: 'private' | 'group' | 'channel';
}

export interface MessageAttachment {
  type: 'image' | 'file';
  url: string;
}

export interface InboundMessage {
  provider: 'qq-official' | 'onebot' | 'local-mcp';
  botInstanceId: string;
  messageId: string;
  sender: MessageSender;
  conversation: ConversationContext;
  text: string;
  attachments?: MessageAttachment[];
  receivedAt: Date;
}

export interface OutboundMessage {
  text?: string;
  imageUrl?: string;
  attachments?: MessageAttachment[];
}

export interface ReplyTarget {
  conversationId: string;
  externalUserId?: string;
  messageId?: string;
}

export interface PlatformCapabilities {
  supportsImages: boolean;
  supportsPrivateMsg: boolean;
  maxTextLength: number;
}
