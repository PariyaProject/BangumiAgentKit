import type { FindOrCreatePrincipalInput, Storage } from '@bangumi-agent-kit/db';

export const STANDALONE_PROVIDER = 'local';
export const STANDALONE_BOT_INSTANCE_ID = 'standalone';

export interface StandaloneIdentity {
  provider: typeof STANDALONE_PROVIDER;
  botInstanceId: typeof STANDALONE_BOT_INSTANCE_ID;
  externalUserId: string;
  conversationId: string;
  displayName: string;
}

const PROFILE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

export function validateStandaloneProfile(profile: string): string {
  const normalized = profile.trim();
  if (!PROFILE_PATTERN.test(normalized)) {
    throw new Error(
      'USAGE_ERROR: profile must start with a letter or number and contain only letters, numbers, ., _, or - (up to 64 characters).',
    );
  }
  return normalized;
}

export function createStandaloneIdentity(profile = 'default'): StandaloneIdentity {
  const normalized = validateStandaloneProfile(profile);
  return {
    provider: STANDALONE_PROVIDER,
    botInstanceId: STANDALONE_BOT_INSTANCE_ID,
    externalUserId: normalized,
    conversationId: `standalone:${normalized}`,
    displayName: normalized,
  };
}

export async function findStandalonePrincipal(
  storage: Storage,
  profile = 'default',
): Promise<{ identity: StandaloneIdentity; principalId: string }> {
  const identity = createStandaloneIdentity(profile);
  const input: FindOrCreatePrincipalInput = {
    provider: identity.provider,
    botInstanceId: identity.botInstanceId,
    externalUserId: identity.externalUserId,
    displayName: identity.displayName,
  };
  const principal = await storage.findOrCreatePrincipal(input);
  return { identity, principalId: principal.id };
}
