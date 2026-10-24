import { createHash } from 'node:crypto';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

export const RENDERER_BASELINE_PATH = 'docs/design/renderer-baselines.json';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const key = (entry) => `${entry.design_pack}/${entry.template}`;
const digestPattern = /^[a-f0-9]{64}$/u;

function validArtifact(artifact) {
  return (
    artifact &&
    typeof artifact.path === 'string' &&
    artifact.path.length <= 240 &&
    !path.isAbsolute(artifact.path) &&
    !artifact.path.split(/[\\/]/u).some((part) => part === '..' || part === '.git') &&
    digestPattern.test(artifact.sha256 ?? '')
  );
}

function artifactMatches(root, artifact) {
  if (!validArtifact(artifact)) return false;
  try {
    const absolute = realpathSync(path.resolve(root, artifact.path));
    if (!absolute.startsWith(`${realpathSync(root)}${path.sep}`)) return false;
    if (path.relative(realpathSync(root), absolute).split(path.sep).includes('.git')) return false;
    if (statSync(absolute).size > 24 * 1024 * 1024) return false;
    const bytes = readFileSync(absolute);
    return bytes.length <= 24 * 1024 * 1024 && sha256(bytes) === artifact.sha256;
  } catch {
    return false;
  }
}

export function inspectRendererDesignBaselines(
  root,
  { registry, priorRegistry, readSourceAtCommit } = {},
) {
  const issues = [];
  const fail = (code, message) => issues.push({ code, message });
  try {
    if (registry === undefined) {
      const file = path.resolve(root, RENDERER_BASELINE_PATH);
      if (!existsSync(file)) {
        if (priorRegistry?.baselines?.length) {
          fail(
            'DESIGN_BASELINE_HISTORY_CHANGED',
            'A completed baseline registry cannot be removed.',
          );
        }
        return { ok: issues.length === 0, locks: [], issues, registry_present: false };
      }
      if (statSync(file).size > 2 * 1024 * 1024)
        throw new Error('Baseline registry exceeds 2 MiB.');
      registry = JSON.parse(readFileSync(file, 'utf8'));
    }
    if (
      registry?.schema !== 'bangumi-renderer-design-baselines/v1' ||
      !Array.isArray(registry.baselines) ||
      registry.baselines.length > 100
    ) {
      throw new Error('Expected a bounded renderer design baseline registry.');
    }
    const seen = new Map();
    const latest = new Map();
    for (const entry of registry.baselines) {
      if (
        typeof entry?.id !== 'string' ||
        seen.has(entry.id) ||
        typeof entry.template !== 'string' ||
        typeof entry.design_pack !== 'string' ||
        !/^[a-f0-9]{40}$/u.test(entry.source_commit ?? '') ||
        !Array.isArray(entry.source_inputs) ||
        entry.source_inputs.length < 1 ||
        entry.source_inputs.length > 32 ||
        !entry.source_inputs.every(validArtifact) ||
        !validArtifact(entry.reference) ||
        !validArtifact(entry.native_receipt) ||
        !Array.isArray(entry.native_previews) ||
        entry.native_previews.length < 1 ||
        entry.native_previews.length > 40 ||
        !entry.native_previews.every(validArtifact)
      ) {
        throw new Error(
          'Every baseline needs a unique id, exact source, reference, receipt and native previews.',
        );
      }
      const previous = latest.get(key(entry));
      if (
        previous &&
        (entry.supersedes !== previous.id ||
          !['explicit_user_request', 'verified_regression'].includes(entry.reopen?.kind) ||
          typeof entry.reopen.evidence_ref !== 'string' ||
          !entry.reopen.evidence_ref.trim() ||
          typeof entry.reopen.reason !== 'string' ||
          entry.reopen.reason.trim().length < 20)
      ) {
        fail(
          'DESIGN_REOPEN_EVIDENCE_REQUIRED',
          `A new version of ${key(entry)} needs an explicit request or verified regression, not another Goal wake.`,
        );
      }
      if (!previous && entry.supersedes) fail('DESIGN_BASELINE_PREDECESSOR_MISSING', entry.id);
      if (
        entry.release_decision !== 'ACCEPTED_FOR_SCOPE' ||
        !Array.isArray(entry.quality_scores) ||
        entry.quality_scores.length !== 6 ||
        entry.quality_scores.some((score) => !Number.isFinite(score) || score < 4 || score > 5) ||
        !['unobserved', 'explicitly_accepted'].includes(entry.user_aesthetic_acceptance)
      ) {
        fail(
          'DESIGN_QUALITY_EVIDENCE_REQUIRED',
          `${entry.id} is not an accepted scoped baseline; don't confuse a concept with a delivered design.`,
        );
      }
      seen.set(entry.id, entry);
      latest.set(key(entry), entry);
    }
    if (priorRegistry) {
      for (const prior of priorRegistry.baselines ?? []) {
        if (!isDeepStrictEqual(seen.get(prior.id), prior)) {
          fail(
            'DESIGN_BASELINE_HISTORY_CHANGED',
            `Preserve ${prior.id}; append an audited successor instead of overwriting the last good design.`,
          );
        }
      }
    }
    const locks = [];
    for (const entry of latest.values()) {
      const issuesBefore = issues.length;
      for (const artifact of [
        ...entry.source_inputs,
        entry.reference,
        entry.native_receipt,
        ...entry.native_previews,
      ]) {
        if (!artifactMatches(root, artifact))
          fail('DESIGN_BASELINE_SOURCE_DRIFT', `${entry.id}: ${artifact.path}`);
      }
      if (readSourceAtCommit) {
        for (const artifact of entry.source_inputs) {
          try {
            const bytes = readSourceAtCommit(entry.source_commit, artifact.path);
            if (sha256(bytes) !== artifact.sha256) throw new Error('Source differs from baseline.');
          } catch {
            fail('DESIGN_BASELINE_SOURCE_COMMIT_INVALID', `${entry.id}: ${artifact.path}`);
          }
        }
      }
      locks.push({
        id: entry.id,
        template: entry.template,
        design_pack: entry.design_pack,
        action:
          issues.length === issuesBefore && issuesBefore === 0
            ? 'PRESERVE_BASELINE_CONTINUE_OTHER_WORK'
            : 'REASSESS_BASELINE_DRIFT',
        user_aesthetic_acceptance: entry.user_aesthetic_acceptance,
        reopen_only_for: ['explicit_user_request', 'verified_regression'],
      });
    }
    return { ok: issues.length === 0, registry_present: true, locks, issues };
  } catch (error) {
    fail('DESIGN_BASELINE_REGISTRY_INVALID', error.message);
    return { ok: false, registry_present: true, locks: [], issues };
  }
}
