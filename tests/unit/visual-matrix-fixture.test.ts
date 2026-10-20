import { describe, expect, it } from 'vitest';
import {
  normalizeVisualMatrixViewModel,
  VISUAL_MATRIX_RETRIEVED_AT,
  VISUAL_MATRIX_RETRIEVED_AT_LABEL,
} from '../render/helpers/visual-matrix-fixture.js';

describe('visual matrix fixture timestamp normalization', () => {
  const startedAtMs = Date.parse('2026-10-20T10:00:00.000Z');
  const nowMs = Date.parse('2026-10-20T10:03:00.000Z');

  it('pins run-local retrieval metadata while preserving historical retrieval and event dates', () => {
    const viewModel = {
      source: {
        retrievedAt: '2026-10-20T10:01:30.000Z',
        retrievedAtLabel: '2026-10-20 10:01:30 UTC',
        events: [
          { retrievedAt: '2026-08-15T00:00:00.000Z', occurredAt: '2026-08-12' },
        ],
      },
    };

    expect(
      normalizeVisualMatrixViewModel(viewModel, { startedAtMs, nowMs }),
    ).toEqual({
      source: {
        retrievedAt: VISUAL_MATRIX_RETRIEVED_AT,
        retrievedAtLabel: VISUAL_MATRIX_RETRIEVED_AT_LABEL,
        events: [
          { retrievedAt: '2026-08-15T00:00:00.000Z', occurredAt: '2026-08-12' },
        ],
      },
    });
  });

  it('leaves invalid retrieval and non-retrieval timestamps untouched', () => {
    const viewModel = {
      retrievedAt: 'not-a-date',
      updatedAt: '2026-10-20T10:01:30.000Z',
      older: { retrievedAt: 'not-a-date' },
    };

    expect(
      normalizeVisualMatrixViewModel(viewModel, { startedAtMs, nowMs }),
    ).toEqual(viewModel);
  });
});
