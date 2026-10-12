import type { Buffer } from 'node:buffer';

export function inspectC07PngArtifact(
  buffer: Buffer,
  expectedWidth: number,
  expectedHeight: number,
): {
  decoded: boolean;
  dimensionsMatch: boolean;
  nonblankPixelSignalVerified: boolean;
};
