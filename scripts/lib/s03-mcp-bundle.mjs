import { readFileSync } from 'node:fs';
import path from 'node:path';
import { computeMcpBundleSha256 } from './g26-mcp-bundle.mjs';

export const S03_MCP_BUNDLE_ATTESTATION_PATH = 'docs/product/s03-mcp-bundle-attestation.json';
export const S03_MCP_BUNDLE_ATTESTATION_KIND = 's03-mcp-runtime-bundle-attestation-v1';

export function readS03McpBundleAttestation(root) {
  let attestation;
  try {
    attestation = JSON.parse(
      readFileSync(path.join(path.resolve(root), S03_MCP_BUNDLE_ATTESTATION_PATH), 'utf8'),
    );
  } catch {
    throw new Error('S03 Candidate MCP bundle attestation is missing or invalid.');
  }
  if (
    !attestation ||
    typeof attestation !== 'object' ||
    Array.isArray(attestation) ||
    Object.keys(attestation).sort().join(',') !== 'bundleSha256,kind,schemaVersion' ||
    attestation.schemaVersion !== 1 ||
    attestation.kind !== S03_MCP_BUNDLE_ATTESTATION_KIND ||
    typeof attestation.bundleSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(attestation.bundleSha256)
  ) {
    throw new Error('S03 Candidate MCP bundle attestation is missing or invalid.');
  }
  return attestation.bundleSha256;
}

export { computeMcpBundleSha256 };
