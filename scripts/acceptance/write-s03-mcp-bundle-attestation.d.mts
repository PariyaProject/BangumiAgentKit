export function writeS03McpBundleAttestation(root?: string): {
  sourceRevision: string;
  bundleSha256: string;
  state: 'ALREADY_CURRENT' | 'UPDATED' | 'WRITTEN';
};
