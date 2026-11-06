import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { execFileSync } from 'node:child_process';
import { NATIVE_PAGE_PROFILE as P, NATIVE_PAGE_SERVER_ID } from '../lib/native-entity-page-profile.mjs';
import { canonicalAgentMcpProfileJson as canonical, agentMcpProfileArgumentsSha256, agentMcpProfileRegistrySha256 } from '../lib/agent-mcp-profile-claims.mjs';
import { isValidP06CiRunEvidence } from '../lib/p06-ci-run-evidence.mjs';
import { readToolCatalogAtSourceRevision } from '../lib/source-revision-tool-catalog.mjs';
import { sanitizeGitRepositoryEnvironment } from '../lib/g26-mcp-bundle.mjs';

export const NATIVE_PAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const nativePageSha = (value) => createHash('sha256').update(value).digest('hex');
const hash = (value) => nativePageSha(canonical(value));
const digest = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
const commit = (value) => typeof value === 'string' && /^[0-9a-f]{40}$/u.test(value);
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value) &&
  Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
const count = (n) => Number.isSafeInteger(n) && n >= 0;
const GATE_FIELDS = ['claimId', 'runNumber', 'prNumber', 'frontierId', 'epochId', 'profileId', 'toolName',
  'argumentProfile', 'expectedArgumentsSha256', 'registrySha256', 'sourceCandidateSha', 'baseSha',
  'ciSha', 'ciStatus', 'ciRunId', 'ciChecks', 'reviewerId', 'bundleSha256', 'runnerReceiptPublicKey'];
const PROJECTION_FIELDS = ['kind', 'total', 'observed', 'returned', 'invalidRows', 'limit', 'offset',
  'hasMore', 'nextOffset', 'totalInconsistent', 'empty', 'truncated', 'stableSnapshot', 'order', 'publicOnly'];
const SNAPSHOT_FIELDS = ['contract', 'phase', 'requestCount', 'deniedCount', 'results', 'maxRequests',
  'maxResponseBytes', 'nativeCallDeadlineMs', 'minimumRequestStartIntervalMs', 'redirectPolicy',
  'liveEvidence', 'forbiddenServiceAttempts'];
const EXECUTION_FIELDS = ['sourceMode', 'model', 'reasoningEffort', 'codexCliVersion', 'modelJobs',
  'processExitCode', 'eventStreamParsed', 'turnCompleted', 'codexMcpToolEventCount', 'codexErrorItemCount',
  'mcpToolErrorResultCount', 'nonMcpToolEventCount', 'shellToolCallCount', 'mcpServerNames',
  'eventStreamSha256', 'serverSummarySha256', 'answerSha256', 'answerBytes', 'exactStructuredResults',
  'exactAnswer', 'providerInternalHttpCount', 'invoiceHardCap'];
const REPORT_FIELDS = ['schemaVersion', 'evidenceKind', 'profileId', 'gate', 'source', 'observation',
  'execution', 'observedAt', 'signature'];

// Freeze execution programs and the native contract they exercise. An unrelated
// catalog entry may change; these tool descriptors and these source bytes may not.
export const NATIVE_PAGE_SOURCE_PATHS = Object.freeze([
  'scripts/lib/native-entity-page-verification.mjs',
  'scripts/lib/native-entity-page-profile.mjs',
  'scripts/lib/native-entity-page-gates.mjs',
  'scripts/acceptance/native-entity-page-mcp.mjs',
  'scripts/acceptance/native-entity-page-server.mjs',
  'scripts/acceptance/run-native-entity-page-model.mjs',
  'scripts/acceptance/native-entity-page-report.mjs',
  'packages/bangumi-openapi/src/native-collection-page-client.ts',
  'packages/bangumi-core/src/services/user-service.ts',
  'packages/bangumi-transport/src/http-client.ts',
  'packages/tools/src/definitions/read-tools.ts',
  'packages/tools/src/registry.ts',
  'packages/tools/src/policy.ts',
]);

export function readNativePageSourceContext(root, revision) {
  if (!commit(revision)) throw new Error('NATIVE_PAGE_SOURCE_INVALID');
  const gitBlob = (relative) => execFileSync('git', ['show', `${revision}:${relative}`], {
    cwd: root, env: sanitizeGitRepositoryEnvironment(), maxBuffer: 4 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'],
  });
  const sourceCatalog = readToolCatalogAtSourceRevision(root, revision);
  const currentCatalog = JSON.parse(readFileSync(path.join(root, 'docs/tool-catalog.json'), 'utf8'));
  const descriptors = P.toolNames.map((name) => {
    const source = sourceCatalog.catalog.filter((tool) => tool.name === name);
    const current = currentCatalog.filter((tool) => tool.name === name);
    if (source.length !== 1 || current.length !== 1 || source[0].auth !== 'optional' ||
      source[0].risk !== 'read' || !isDeepStrictEqual(source, current)) throw new Error('NATIVE_PAGE_CATALOG_CHANGED');
    return source[0];
  });
  const programFiles = Object.fromEntries(NATIVE_PAGE_SOURCE_PATHS.map((relative) => {
    const bytes = gitBlob(relative);
    if (!bytes.equals(readFileSync(path.join(root, relative)))) throw new Error('NATIVE_PAGE_SOURCE_CHANGED');
    return [relative, nativePageSha(bytes)];
  }));
  const selection = gitBlob(P.selectionEvidencePath);
  if (!selection.equals(readFileSync(path.join(root, P.selectionEvidencePath))))
    throw new Error('NATIVE_PAGE_SELECTION_CHANGED');
  return { catalogSha256: nativePageSha(sourceCatalog.bytes), descriptors,
    selectionSha256: nativePageSha(selection), programFiles };
}

export function nativePageClaimGate(claim) {
  return Object.fromEntries(GATE_FIELDS.map((key) => [key, claim?.[key]]));
}

export function validNativePageClaim(claim) {
  try {
    const key = Buffer.from(claim?.runnerReceiptPublicKey ?? '', 'base64');
    const publicKey = createPublicKey({ key, type: 'spki', format: 'der' });
    return claim?.runNumber === 95 && Number.isSafeInteger(claim.prNumber) && claim.prNumber > 0 &&
      ['CLAIMED', 'REPORT_WRITTEN'].includes(claim.state) && claim.retryAllowed === false &&
      isDeepStrictEqual(claim.expectedArguments, P.calls.map((call) => call.arguments)) &&
      claim.profileId === P.id && claim.frontierId === P.frontierId && claim.epochId === P.epochId &&
      claim.toolName === P.toolName && claim.argumentProfile === P.argumentProfile &&
      claim.registrySha256 === agentMcpProfileRegistrySha256(P.id) &&
      claim.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(P) &&
      commit(claim.sourceCandidateSha) && commit(claim.baseSha) && claim.ciSha === claim.sourceCandidateSha &&
      claim.ciStatus === 'SUCCESS' && isValidP06CiRunEvidence(claim) && digest(claim.bundleSha256) &&
      typeof claim.reviewerId === 'string' && claim.reviewerId.trim().length > 0 &&
      new RegExp(`^profile-run-95-pr-${claim.prNumber}-${claim.sourceCandidateSha.slice(0, 12)}-\\d+$`, 'u').test(claim.claimId ?? '') &&
      publicKey.asymmetricKeyType === 'ed25519' && key.toString('base64') === claim.runnerReceiptPublicKey &&
      claim.runnerReceiptPublicKeySha256 === nativePageSha(key) &&
      publicKey.export({ format: 'der', type: 'spki' }).equals(key);
  } catch { return false; }
}

export function validNativePageProjection(value, index) {
  if (!exact(value, PROJECTION_FIELDS) || ![0, 1].includes(index)) return false;
  const p = value;
  if (p.kind !== (index === 0 ? 'person' : 'character') || p.limit !== 1 || p.offset !== 0 ||
    !count(p.observed) || p.observed > 1 || !count(p.returned) || !count(p.invalidRows) ||
    p.returned + p.invalidRows !== p.observed || p.stableSnapshot !== false ||
    p.order !== 'created_time_desc' || p.publicOnly !== true || typeof p.totalInconsistent !== 'boolean') return false;
  const conflict = p.totalInconsistent;
  if (conflict ? p.total !== null || p.observed !== 1 : !count(p.total) || p.total < p.observed) return false;
  const more = conflict ? null : p.total > 1;
  return p.hasMore === more && p.nextOffset === (more === true ? 1 : null) &&
    p.empty === (p.observed === 0 ? p.total === 0 ? 'collection_empty' : 'page_empty' : null) &&
    p.truncated === (conflict || p.invalidRows > 0 || p.observed < p.total);
}

export function validNativePageSnapshot(value) {
  return Boolean(exact(value, SNAPSHOT_FIELDS) && value.contract === 'native-entity-page-observation-v1' &&
    value.phase === 'COMPLETE' && value.requestCount === 2 && value.deniedCount === 0 &&
    value.maxRequests === 2 && value.maxResponseBytes === 262144 && value.nativeCallDeadlineMs === 10000 &&
    value.minimumRequestStartIntervalMs === 1000 && value.redirectPolicy === 'error' &&
    value.liveEvidence === false && value.forbiddenServiceAttempts === 0 &&
    Array.isArray(value.results) && value.results.length === 2 && value.results.every(validNativePageProjection));
}

export function nativePageAnswerMatches(answer, results) {
  try {
    if (typeof answer !== 'string' || Buffer.byteLength(answer) > P.maxAnswerBytes) return false;
    const value = JSON.parse(answer);
    return Boolean(exact(value, ['pages', 'notExhaustive', 'stableSnapshot']) &&
      value.notExhaustive === true && value.stableSnapshot === false && isDeepStrictEqual(value.pages, results));
  } catch { return false; }
}

function validExecution(value) {
  return exact(value, EXECUTION_FIELDS) && value.sourceMode === 'native-public-fetch' &&
    value.model === P.model && value.reasoningEffort === P.reasoningEffort && value.modelJobs === 1 &&
    /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/u.test(value.codexCliVersion ?? '') &&
    value.processExitCode === 0 && value.eventStreamParsed === true && value.turnCompleted === true &&
    value.codexMcpToolEventCount === 2 && value.codexErrorItemCount === 0 && value.mcpToolErrorResultCount === 0 &&
    value.nonMcpToolEventCount === 0 && value.shellToolCallCount === 0 &&
    isDeepStrictEqual(value.mcpServerNames, [NATIVE_PAGE_SERVER_ID, NATIVE_PAGE_SERVER_ID]) &&
    ['eventStreamSha256', 'serverSummarySha256', 'answerSha256'].every((key) => digest(value[key])) &&
    count(value.answerBytes) && value.answerBytes > 0 && value.answerBytes <= P.maxAnswerBytes &&
    value.exactStructuredResults === true && value.exactAnswer === true &&
    value.providerInternalHttpCount === null && value.invoiceHardCap === null;
}

export function validateNativePageReport(report, claim, { root = NATIVE_PAGE_ROOT } = {}) {
  try {
    if (!exact(report, REPORT_FIELDS) || report.schemaVersion !== 1 || report.evidenceKind !== P.evidenceKind ||
      report.profileId !== P.id || !validNativePageClaim(claim) || !exact(report.gate, GATE_FIELDS) ||
      !isDeepStrictEqual(report.gate, nativePageClaimGate(claim)) || !validNativePageSnapshot(report.observation) ||
      !validExecution(report.execution) || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(report.observedAt ?? '') ||
      !Number.isFinite(Date.parse(report.observedAt)) ||
      !isDeepStrictEqual(report.source, readNativePageSourceContext(root, claim.sourceCandidateSha)))
      return { passed: false, reason: 'NATIVE_PAGE_REPORT_INVALID' };
    const bytes = Buffer.from(report.signature ?? '', 'base64');
    const publicKey = createPublicKey({ key: Buffer.from(claim.runnerReceiptPublicKey, 'base64'), type: 'spki', format: 'der' });
    const payload = { ...report };
    delete payload.signature;
    if (bytes.length !== 64 || bytes.toString('base64') !== report.signature ||
      !verify(null, Buffer.from(canonical(payload)), publicKey, bytes))
      return { passed: false, reason: 'NATIVE_PAGE_SIGNATURE_INVALID' };
    return { passed: true };
  } catch { return { passed: false, reason: 'NATIVE_PAGE_REPORT_INVALID' }; }
}

export function buildNativePageReport({ claim, observation, execution, answer }, privateKey, { root = NATIVE_PAGE_ROOT } = {}) {
  if (!validNativePageSnapshot(observation) || !nativePageAnswerMatches(answer, observation.results))
    throw new Error('NATIVE_PAGE_ANSWER_OR_OBSERVATION_INVALID');
  const payload = {
    schemaVersion: 1, evidenceKind: P.evidenceKind, profileId: P.id,
    gate: nativePageClaimGate(claim), source: readNativePageSourceContext(root, claim.sourceCandidateSha),
    observation, execution: { ...execution, answerSha256: nativePageSha(answer),
      answerBytes: Buffer.byteLength(answer), exactAnswer: true }, observedAt: new Date().toISOString(),
  };
  const report = { ...payload, signature: sign(null, Buffer.from(canonical(payload)), privateKey).toString('base64') };
  if (!validateNativePageReport(report, claim, { root }).passed) throw new Error('NATIVE_PAGE_REPORT_BUILD_FAILED');
  return report;
}

export function validateNativePageReportFile(claim, root = NATIVE_PAGE_ROOT, reportPath = null) {
  try {
    const target = path.join(root, P.reportPath);
    if (reportPath !== null && path.resolve(reportPath) !== path.resolve(target)) throw new Error();
    const bytes = readFileSync(target);
    if (bytes.length > 65536) throw new Error();
    const report = JSON.parse(bytes.toString('utf8'));
    const result = validateNativePageReport(report, claim, { root });
    return result.passed ? { passed: true, reportPath: P.reportPath, reportSha256: nativePageSha(bytes), report,
      runnerReceiptSha256: hash({ signature: report.signature, publicKey: claim.runnerReceiptPublicKey }) } : result;
  } catch { return { passed: false, reason: 'NATIVE_PAGE_REPORT_FILE_INVALID' }; }
}

export function writeNativePageReport(report, root = NATIVE_PAGE_ROOT) {
  writeFileSync(path.join(root, P.reportPath), JSON.stringify(report, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
}
