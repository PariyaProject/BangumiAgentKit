export const VISUAL_MATRIX_RETRIEVED_AT = '2026-10-19T00:00:00.000Z';
export const VISUAL_MATRIX_RETRIEVED_AT_LABEL = '2026-10-19 00:00:00 UTC';

const VISUAL_MATRIX_CLOCK_SKEW_MS = 5 * 60 * 1000;

interface VisualMatrixNormalizationWindow {
  startedAtMs: number;
  nowMs: number;
}

export function normalizeVisualMatrixViewModel(
  value: unknown,
  window: VisualMatrixNormalizationWindow,
): unknown {
  const earliest = window.startedAtMs - VISUAL_MATRIX_CLOCK_SKEW_MS;
  const latest = window.nowMs + VISUAL_MATRIX_CLOCK_SKEW_MS;

  const visit = (current: unknown, key = ''): unknown => {
    if ((key === 'retrievedAt' || key === 'retrievedAtLabel') && typeof current === 'string') {
      const timestamp = Date.parse(current);
      if (Number.isFinite(timestamp) && timestamp >= earliest && timestamp <= latest) {
        return key === 'retrievedAtLabel'
          ? VISUAL_MATRIX_RETRIEVED_AT_LABEL
          : VISUAL_MATRIX_RETRIEVED_AT;
      }
      return current;
    }

    if (Array.isArray(current)) return current.map((item) => visit(item));
    if (current && typeof current === 'object') {
      return Object.fromEntries(
        Object.entries(current).map(([childKey, childValue]) => [
          childKey,
          visit(childValue, childKey),
        ]),
      );
    }
    return current;
  };

  return visit(value);
}
