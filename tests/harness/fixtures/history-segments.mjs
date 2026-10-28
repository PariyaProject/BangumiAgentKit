import { createHash } from 'node:crypto';
import { createRunState } from '../../../scripts/lib/agent-harness-core.mjs';
import { appendContinuationEvent } from '../../../scripts/lib/harness-continuation.mjs';

export function historyFixture(count = 87) {
  let run = createRunState({ runId: 'history-segment-synthetic' });
  run.outer_sol.product = { max: 475, consumed: 470, reserved: 0 };
  run.immutableClaims = { spent: 'FAILED_OR_UNCERTAIN', unknown: { kept: true } };
  for (let i = 0; i < count; i++) {
    const type = i < 83 ? 'directive' : 'checkpoint';
    const input = type === 'directive'
      ? { type, action: i === 82 ? 'continue' : 'pause', source_ref: 'user-message:fixture-' + i,
          reason: 'Preserve 中文/日本語 and every event; no replay.' }
      : { type, kind: 'progress', epoch_pr: null, problem: 'fixture-progress',
          input_sha256: createHash('sha256').update(String(i)).digest('hex'),
          outcome: 'Completed bounded synthetic work.', next_action: 'Continue the next scoped package.',
          evidence_refs: ['docs/agent/HARNESS.md'] };
    run = appendContinuationEvent(run, null, input, i, '2026-10-28T10:00:00.000Z');
  }
  run.continuation.unknownJournalField = { exact: true };
  return run;
}
