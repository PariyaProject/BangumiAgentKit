import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  authorizeToolCall,
  canonicalJson,
  claimSingleToolCall,
  filterAllowedTools,
  publicReadOnlyToolAnnotations,
  summarizeSubjectStatsFacts,
  summarizeToolResult,
} from '../../scripts/lib/codex-one-tool-evidence.mjs';

const target = 'bangumi.get_subject_stats_intelligence';
const expectedArguments = { subjectId: 218707 };

test('canonicalJson sorts object keys recursively and preserves array order', () => {
  assert.equal(canonicalJson({ b: 2, a: { y: 1, x: 0 } }), '{"a":{"x":0,"y":1},"b":2}');
  assert.equal(canonicalJson([2, 1]), '[2,1]');
});

test('one-tool profile only exposes the exact anonymous read tool', () => {
  const tools = [
    { name: target, auth: 'none', risk: 'read' },
    { name: 'bangumi.auth_status', auth: 'none', risk: 'read' },
    { name: 'bangumi.update_collection', auth: 'required', risk: 'write' },
  ];
  assert.deepEqual(filterAllowedTools(tools, target), [tools[0]]);
  assert.throws(() => filterAllowedTools(tools, 'bangumi.update_collection'), /auth=none, risk=read/);
  assert.throws(() => filterAllowedTools([...tools, { ...tools[0] }], target), /exactly one/);
});

test('only an anonymous read tool receives non-destructive idempotent MCP annotations', () => {
  assert.deepEqual(publicReadOnlyToolAnnotations({ auth: 'none', risk: 'read' }), {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
  });
  assert.throws(
    () => publicReadOnlyToolAnnotations({ auth: 'required', risk: 'read' }),
    /anonymous read-only/u,
  );
  assert.throws(
    () => publicReadOnlyToolAnnotations({ auth: 'none', risk: 'write' }),
    /anonymous read-only/u,
  );
});

test('fixed query gate allows one exact read and rejects wrong tool, arguments, and repeats', () => {
  const base = { expectedTool: target, expectedArguments, completedCalls: 0 };
  assert.deepEqual(authorizeToolCall({ ...base, name: target, args: { subjectId: 218609 } }), {
    allowed: false, code: 'ARGUMENTS_DO_NOT_MATCH_FIXED_QUERY',
  });
  assert.deepEqual(authorizeToolCall({ ...base, name: 'bangumi.auth_status', args: {} }), {
    allowed: false, code: 'TOOL_NOT_ALLOWLISTED',
  });
  assert.deepEqual(authorizeToolCall({ ...base, name: target, args: expectedArguments }), {
    allowed: true, code: 'ALLOWLISTED_FIXED_PUBLIC_QUERY',
  });
  assert.deepEqual(authorizeToolCall({ ...base, completedCalls: 1, name: target, args: expectedArguments }), {
    allowed: false, code: 'CALL_LIMIT_REACHED',
  });
});

test('shared call claim permits one process-wide call and denies later claims', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-one-tool-lock-test-'));
  const lockPath = path.join(root, 'call-claimed');
  try {
    assert.equal(claimSingleToolCall(lockPath), true);
    assert.equal(claimSingleToolCall(lockPath), false);
    assert.equal(fs.statSync(lockPath).mode & 0o777, 0o600);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test('sanitized result metadata never retains title, stats values, or raw artifact bytes', () => {
  const raw = {
    subjectNameCn: 'public title that must not persist',
    score: 8.8,
    state: 'partial',
    sourceOperations: [{ operation: 'GET /v0/subjects/218707', attempted: 1, succeeded: 1, failed: 0 }],
    artifact: { id: 'art_sensitive_reference', mimeType: 'image/png', width: 720, height: 1200 },
  };
  const summary = summarizeToolResult(target, raw, {
    returned: true, persisted: false, mimeType: 'image/png', width: 720, height: 1200,
    byteLength: 123456, sha256: 'a'.repeat(64), pngSignatureValid: true,
  });
  const encoded = JSON.stringify(summary);
  assert.equal(summary.resultState, 'partial');
  assert.equal(summary.artifact.persisted, false);
  assert.equal(summary.sourceOperations[0].succeeded, 1);
  assert.doesNotMatch(encoded, /public title|8\.8|art_sensitive_reference/);
  assert.doesNotMatch(encoded, /raw|result body/i);
});

test('source operation summaries discard query strings and arbitrary payload text', () => {
  const summary = summarizeToolResult(target, {
    sourceOperations: [
      { operation: 'GET /v0/subjects/{subject_id}', attempted: 1, succeeded: 1, failed: 0 },
      { operation: 'GET /v0/subjects/218707?access_token=must-not-survive', attempted: 1, succeeded: 1, failed: 0 },
    ],
  });
  assert.deepEqual(summary.sourceOperations.map((item) => item.operation), [
    'GET /v0/subjects/{subject_id}',
    'unclassified',
  ]);
  assert.doesNotMatch(JSON.stringify(summary), /access_token|must-not-survive/u);
});


test('stats fact projection verifies the 8-9 band against all ten histogram bins without titles', () => {
  const histogram = { 1: 0, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5, 7: 6, 8: 7, 9: 8, 10: 9 };
  const facts = summarizeSubjectStatsFacts({
    subjectId: 218707,
    state: 'complete',
    raw: { ratingHistogram: histogram },
    rating: {
      state: 'complete', population: 45, mean: 7.2, standardDeviation: 1.1,
      distribution: Array.from({ length: 10 }, (_, index) => ({
        score: index + 1, count: histogram[index + 1], percentage: (histogram[index + 1] / 45) * 100,
      })),
      scoreBand8To9Share: {
        state: 'complete', count: 15, population: 45, percentage: (15/45) * 100,
        formula: { id: 'bangumi.rating.score_band_8_9_share.v1', version: 1, evidenceStatus: 'official_contract' },
      },
    },
    collection: {
      state: 'complete', total: 100, completionState: 'empirically_verified', completionRate: 0.3,
      distribution: [{ status: 'wish', count: 10, percentage: 10 }],
      formulas: { completion: { id: 'subject-stats-collection-completion-v1', version: 1, evidenceStatus: 'empirically_verified' } },
    },
    coverage: { ratingBucketsExpected: 10, ratingBucketsObserved: 10, collectionBucketsExpected: 5,
                collectionBucketsObserved: 5, sourceRequestsAttempted: 1, sourceRequestsSucceeded: 1 },
    source: { official: { class: 'official-v0' } },
    evidence: [{ source: 'official-v0' }, { source: 'derived-s7' }],
    warnings: [],
    limitations: ['no historical data'],
  });
  assert.deepEqual(facts.rating.histogram, {
    allTenBinsValid: true,
    population: 45,
    scoreBand8To9CountFromBins: 15,
    scoreBand8To9PercentageFromBins: (15/45) * 100,
  });
  assert.equal(facts.rating.scoreBand8To9Share.formulaId, 'bangumi.rating.score_band_8_9_share.v1');
  assert.deepEqual(facts.evidenceSources, ['derived-s7', 'official-v0']);
  assert.equal(facts.rating.mean, 7.2);
  assert.equal(facts.rating.standardDeviation, 1.1);
  assert.equal(facts.collection.completionRate, 0.3);
  assert.deepEqual(facts.rating.distribution[7], { score: 8, count: 7, percentage: (7/45) * 100 });
  assert.deepEqual(facts.collection.distribution, [{ status: 'wish', count: 10, percentage: 10 }]);
  assert.doesNotMatch(JSON.stringify(facts), /subjectName|title/);
});
