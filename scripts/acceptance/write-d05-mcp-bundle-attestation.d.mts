export function writeD05McpBundleAttestation(root?: string): {
  sourceRevision: string;
  bundleSha256: string;
  state: 'WRITTEN' | 'UPDATED' | 'ALREADY_CURRENT';
};
