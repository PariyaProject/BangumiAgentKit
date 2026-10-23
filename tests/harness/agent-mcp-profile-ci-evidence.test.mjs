import assert from 'node:assert/strict';
import test from 'node:test';
import { profileRequiresExactCiRunEvidence } from '../../scripts/lib/agent-mcp-profile-ci-evidence.mjs';
import { G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_ID } from '../../scripts/lib/g01-query-subjects-offline-matrix-profile.mjs';
import { G01_RENDER_QUERY_OFFLINE_V2_PROFILE_ID } from '../../scripts/lib/g01-render-query-subjects-offline-profile.mjs';
import { G06_CAST_OFFLINE_V2_PROFILE_ID } from '../../scripts/lib/g06-subject-cast-offline-profile.mjs';

test('subject-card compact typography v4 claims require exact CI evidence', () => {
  assert.equal(
    profileRequiresExactCiRunEvidence('render-subject-card-compact-typography-agent-mcp-v4'),
    true,
  );
});

test('subject-card v1-v3 keep their exact CI evidence contract', () => {
  for (const profileId of [
    'render-subject-card-offline-agent-mcp-v1',
    'render-subject-card-compact-typography-agent-mcp-v2',
    'render-subject-card-compact-typography-agent-mcp-v3',
  ]) {
    assert.equal(profileRequiresExactCiRunEvidence(profileId), true, profileId);
  }
});

test('profiles outside the exact-CI contract remain excluded', () => {
  assert.equal(profileRequiresExactCiRunEvidence('unknown-profile'), false);
});

test('P06 v1-v3 profile claims preserve exact CI evidence', () => {
  for (const profileId of [
    'p06-render-person-profile-offline-agent-mcp-v1',
    'p06-render-person-profile-offline-agent-mcp-v2',
    'p06-render-person-profile-offline-agent-mcp-v3',
  ]) {
    assert.equal(profileRequiresExactCiRunEvidence(profileId), true, profileId);
  }
});

test('existing v2 profile constants retain their exact CI evidence contract', () => {
  for (const profileId of [
    G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_ID,
    G01_RENDER_QUERY_OFFLINE_V2_PROFILE_ID,
    G06_CAST_OFFLINE_V2_PROFILE_ID,
  ]) {
    assert.equal(profileRequiresExactCiRunEvidence(profileId), true, profileId);
  }
});
