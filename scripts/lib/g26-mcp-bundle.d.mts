export declare function computeMcpBundleSha256(root: string): string;
export declare function readG26McpBundleAttestation(root: string): string;
export declare function sanitizeGitRepositoryEnvironment(
  source?: Record<string, string | undefined>,
): Record<string, string | undefined>;
export declare function gitRepositoryText(root: string, args: string[]): string;
