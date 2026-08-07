import { InboundMessage, OutboundMessage, ReplyTarget, PlatformCapabilities } from './types.js';

export interface ChatPlatformAdapter {
  readonly provider: string;

  start(handler: (message: InboundMessage) => Promise<void>): Promise<void>;
  send(target: ReplyTarget, message: OutboundMessage): Promise<void>;
  getCapabilities(target: ReplyTarget): Promise<PlatformCapabilities>;
}
