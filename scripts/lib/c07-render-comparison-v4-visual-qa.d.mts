export const C07_V4_VISUAL_QA_MANIFEST_PATH: string;
export const C07_V4_VISUAL_QA_ARTIFACT_DIRECTORY: string;

export function computeC07V4VisualQaGenerationSourceSha256(root: string): string;

export function validateC07V4VisualQaEvidence(options: {
  root: string;
  expectedManifestSha256: string;
  expectedBundleSha256: string;
  manifestPath?: string;
}): boolean;
