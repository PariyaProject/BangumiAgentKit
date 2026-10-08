import { readFileSync } from 'node:fs';
import path from 'node:path';
import { computeMcpBundleSha256 } from './g26-mcp-bundle.mjs';

export const D05_MCP_BUNDLE_ATTESTATION_PATH = 'docs/product/d05-mcp-bundle-attestation.json';
export const D05_MCP_BUNDLE_ATTESTATION_KIND = 'd05-mcp-runtime-bundle-attestation-v1';

export function readD05McpBundleAttestation(root) {
  const attestation = JSON.parse(
    readFileSync(path.join(path.resolve(root), D05_MCP_BUNDLE_ATTESTATION_PATH), 'utf8'),
  );
  if (
    !attestation ||
    typeof attestation !== 'object' ||
    Array.isArray(attestation) ||
    Object.keys(attestation).sort().join(',') !== 'bundleSha256,kind,schemaVersion' ||
    attestation.schemaVersion !== 1 ||
    attestation.kind !== D05_MCP_BUNDLE_ATTESTATION_KIND ||
    typeof attestation.bundleSha256 !== 'string' ||
    !/^[0-9a-f]{64}$/u.test(attestation.bundleSha256)
  ) {
    throw new Error('D05 Candidate MCP bundle attestation is missing or invalid.');
  }
  return attestation.bundleSha256;
}

export { computeMcpBundleSha256 };
