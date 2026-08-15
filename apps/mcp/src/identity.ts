import crypto from 'node:crypto';
import type { Storage } from '@bangumi-agent-kit/db';

export interface TrustedExternalIdentity {
  provider: string;
  botInstanceId: string;
  externalUserId: string;
  conversationId: string;
  displayName?: string;
}

export interface ResolvedExecutionIdentity {
  principalId: string;
  botInstanceId: string;
  conversationId: string;
  /** Stable capability-store scope derived from the trusted external principal tuple. */
  artifactPrincipalKey?: string;
}

export interface McpExecutionIdentityProvider {
  resolveContext(request: unknown): Promise<ResolvedExecutionIdentity>;
}

const LEGACY_PRINCIPAL_FLAG = 'BANGUMI_MCP_ALLOW_INTERNAL_PRINCIPAL_ID';

function validateBoundedString(
  field: string,
  value: string | undefined,
  maxCodePoints: number,
): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`CONFIG_ERROR: ${field} is required for trusted MCP identity.`);
  }
  if (Array.from(value).length > maxCodePoints) {
    throw new Error(
      `CONFIG_ERROR: ${field} exceeds the maximum length of ${maxCodePoints} characters.`,
    );
  }
  return value;
}

export function validateTrustedExternalIdentity(
  identity: TrustedExternalIdentity,
): TrustedExternalIdentity {
  const validated: TrustedExternalIdentity = {
    provider: validateBoundedString('provider', identity.provider, 32),
    botInstanceId: validateBoundedString('botInstanceId', identity.botInstanceId, 128),
    externalUserId: validateBoundedString('externalUserId', identity.externalUserId, 128),
    conversationId: validateBoundedString('conversationId', identity.conversationId, 256),
  };

  if (identity.displayName !== undefined) {
    validated.displayName = validateBoundedString('displayName', identity.displayName, 128);
  }

  return validated;
}

export function artifactPrincipalKey(
  identity: Pick<TrustedExternalIdentity, 'provider' | 'botInstanceId' | 'externalUserId'>,
): string {
  return [identity.provider, identity.botInstanceId, identity.externalUserId].join('\u0000');
}

function readTrustedExternalIdentity(fallbackConversationId: string): TrustedExternalIdentity {
  const provider = process.env.BANGUMI_MCP_IDENTITY_PROVIDER;
  const externalUserId = process.env.BANGUMI_MCP_EXTERNAL_USER_ID;
  const botInstanceId = process.env.BANGUMI_MCP_BOT_INSTANCE_ID;
  const conversationId = process.env.BANGUMI_MCP_CONVERSATION_ID;
  const displayName = process.env.BANGUMI_MCP_DISPLAY_NAME;
  const legacyPrincipalId = process.env.BANGUMI_MCP_PRINCIPAL_ID;

  if (legacyPrincipalId && process.env.NODE_ENV === 'production') {
    throw new Error(
      'CONFIG_ERROR: BANGUMI_MCP_PRINCIPAL_ID is forbidden in production; provide trusted external identity variables.',
    );
  }

  const hasExternalIdentity = Boolean(
    provider || externalUserId || botInstanceId || conversationId || displayName,
  );

  if (hasExternalIdentity) {
    return validateTrustedExternalIdentity({
      provider: provider || '',
      externalUserId: externalUserId || '',
      botInstanceId: botInstanceId || '',
      conversationId: conversationId || '',
      displayName,
    });
  }

  if (legacyPrincipalId) {
    if (process.env[LEGACY_PRINCIPAL_FLAG] !== 'true') {
      throw new Error(
        `CONFIG_ERROR: direct internal principal injection requires ${LEGACY_PRINCIPAL_FLAG}=true in development/test mode.`,
      );
    }
    return validateTrustedExternalIdentity({
      provider: process.env.BANGUMI_MCP_IDENTITY_PROVIDER || 'local-mcp',
      botInstanceId: process.env.BANGUMI_MCP_BOT_INSTANCE_ID || 'local-mcp',
      externalUserId: legacyPrincipalId,
      conversationId: process.env.BANGUMI_MCP_CONVERSATION_ID || fallbackConversationId,
      displayName,
    });
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('CONFIG_ERROR: trusted MCP external identity is required in production.');
  }

  return validateTrustedExternalIdentity({
    provider: 'local-mcp',
    botInstanceId: 'local-mcp',
    externalUserId: 'local-mcp-user',
    conversationId: fallbackConversationId,
  });
}

export class StdioMcpExecutionIdentityProvider implements McpExecutionIdentityProvider {
  private readonly fallbackConversationId = `session_${crypto.randomUUID()}`;

  constructor(private readonly storage: Storage) {}

  async resolveContext(_request: unknown): Promise<ResolvedExecutionIdentity> {
    const legacyPrincipalId = process.env.BANGUMI_MCP_PRINCIPAL_ID;
    const identity = readTrustedExternalIdentity(this.fallbackConversationId);

    if (
      legacyPrincipalId &&
      process.env.NODE_ENV !== 'production' &&
      process.env[LEGACY_PRINCIPAL_FLAG] === 'true' &&
      !process.env.BANGUMI_MCP_IDENTITY_PROVIDER &&
      !process.env.BANGUMI_MCP_EXTERNAL_USER_ID
    ) {
      return {
        principalId: validateBoundedString('BANGUMI_MCP_PRINCIPAL_ID', legacyPrincipalId, 128),
        botInstanceId: identity.botInstanceId,
        conversationId: identity.conversationId,
      };
    }

    const principal = await this.storage.findOrCreatePrincipal({
      provider: identity.provider,
      botInstanceId: identity.botInstanceId,
      externalUserId: identity.externalUserId,
      displayName: identity.displayName,
    });

    return {
      principalId: principal.id,
      botInstanceId: identity.botInstanceId,
      conversationId: identity.conversationId,
      artifactPrincipalKey: artifactPrincipalKey(identity),
    };
  }
}
