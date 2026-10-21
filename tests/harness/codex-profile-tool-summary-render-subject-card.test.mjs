import assert from 'node:assert/strict';
import test from 'node:test';
import { summarizeProfileToolResult } from '../../scripts/lib/codex-profile-tool-summary.mjs';
import { RENDER_SUBJECT_CARD_OFFLINE_PROFILE_ID } from '../../scripts/lib/render-subject-card-offline-profile.mjs';

test('render_subject_card matrix profile summarizes only bounded artifact facts', () => {
  const summary = summarizeProfileToolResult(
    {
      artifact: { id: 'art_private-transient-id', width: 720, height: 804 },
      message: 'Synthetic subject card is ready.',
    },
    { subjectId: 991902, includeCollection: false },
    RENDER_SUBJECT_CARD_OFFLINE_PROFILE_ID,
    {
      returned: true,
      persisted: false,
      mimeType: 'image/png',
      width: 720,
      height: 804,
      byteLength: 121_000,
      sha256: 'a'.repeat(64),
      pngSignatureValid: true,
      decoded: true,
      dimensionsMatch: true,
    },
    'bangumi.render_subject_card',
  );

  assert.deepEqual(summary, {
    resultState: 'artifact_returned',
    artifact: {
      returned: true,
      persisted: false,
      mimeType: 'image/png',
      width: 720,
      height: 804,
      byteLength: 121_000,
      sha256: 'a'.repeat(64),
      pngSignatureValid: true,
      decoded: true,
      dimensionsMatch: true,
    },
  });
  assert.equal(JSON.stringify(summary).includes('art_private-transient-id'), false);
  assert.equal(JSON.stringify(summary).includes('Synthetic subject card is ready.'), false);
});
