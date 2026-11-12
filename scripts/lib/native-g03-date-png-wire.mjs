import { isDeepStrictEqual } from 'node:util';
import { projectG03NativeQuery } from './g03-native-discovery-verification.mjs';
import {
  g03ModelSha,
  g03ModelResultSha,
  validG03ModelArtifact,
} from '../acceptance/native-g03-date-png-report.mjs';

/** Observe normal transport responses after the independent kernel/store validation. */
export function createG03ModelWireObservation(host) {
  const resultSha256 = [];
  let artifact = null,
    captureFailed = false;
  return {
    capture(message) {
      if (!message.result?.content || message.result.isError) return;
      try {
        const snapshot = host.snapshot(),
          result = message.result;
        if (resultSha256.length === 0) {
          if (
            snapshot.phase !== 'QUERY_VERIFIED' ||
            !isDeepStrictEqual(
              projectG03NativeQuery(result.structuredContent),
              snapshot.observation,
            )
          )
            throw new Error();
        } else if (resultSha256.length === 1) {
          const ref = JSON.parse(result.content[0].text).artifact;
          artifact = Object.fromEntries(
            ['id', 'mimeType', 'width', 'height'].map((key) => [key, ref?.[key]]),
          );
          if (
            snapshot.phase !== 'COMPLETE' ||
            !validG03ModelArtifact(artifact, snapshot.image) ||
            g03ModelSha(host.verifiedPng()) !== snapshot.image.sha256
          )
            throw new Error();
        } else throw new Error();
        resultSha256.push(g03ModelResultSha(result));
      } catch {
        captureFailed = true;
      }
    },
    snapshot: () => structuredClone({ resultSha256, artifact, captureFailed }),
  };
}
