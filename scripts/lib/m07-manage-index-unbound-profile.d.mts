export const M07_MANAGE_INDEX_PROFILE_ID: string;
export const M07_MANAGE_INDEX_EPOCH_ID: string;
export const M07_MANAGE_INDEX_NETWORK_MODE: string;
export const M07_MANAGE_INDEX_ARGUMENT_PROFILE: string;
export const M07_MANAGE_INDEX_TOOL: string;
export const M07_MANAGE_INDEX_CLAIM_LABEL: string;
export const M07_MANAGE_INDEX_REPORT_PATH: string;
export const M07_MANAGE_INDEX_EXPECTED_ARGUMENTS: Readonly<{
  action: 'create';
  title: 'Run95 no-account gate check';
}>;

export function assertM07ManageIndexUnboundProfile(profile: unknown): true;
export function sameArguments(actual: unknown, expected?: unknown): boolean;
