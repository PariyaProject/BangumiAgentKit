import { BangumiAccountRecord } from '@bangumi-agent-kit/db';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { TokenBroker } from './token-broker.js';

export interface BangumiClientProvider {
  getPublicClient(): Promise<GeneratedBangumiOpenApiClient>;
  getOptionalAuthenticatedClient(principalId?: string): Promise<GeneratedBangumiOpenApiClient>;
  requireAuthenticatedClient(
    principalId: string,
    requiredCapabilities?: string[]
  ): Promise<{ account: BangumiAccountRecord; client: GeneratedBangumiOpenApiClient }>;
}

export class DefaultBangumiClientProvider implements BangumiClientProvider {
  constructor(private tokenBroker: TokenBroker) {}

  async getPublicClient(): Promise<GeneratedBangumiOpenApiClient> {
    return await this.tokenBroker.getPublicClient();
  }

  async getOptionalAuthenticatedClient(principalId?: string): Promise<GeneratedBangumiOpenApiClient> {
    return await this.tokenBroker.getOptionalAuthenticatedClient(principalId);
  }

  async requireAuthenticatedClient(
    principalId: string,
    requiredCapabilities?: string[]
  ): Promise<{ account: BangumiAccountRecord; client: GeneratedBangumiOpenApiClient }> {
    return await this.tokenBroker.requireAuthenticatedClient(principalId, requiredCapabilities);
  }
}
