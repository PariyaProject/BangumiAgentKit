import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { execFileSync } from 'node:child_process';
import {
  G03_MODEL_PROFILE as P,
  G03_MODEL_SERVER_ID,
} from '../lib/native-g03-date-png-profile.mjs';
import { G03_NATIVE_QUERY, G03_NATIVE_ROWS } from '../lib/g03-native-discovery-verification.mjs';
import {
  canonicalAgentMcpProfileJson as canonical,
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
} from '../lib/agent-mcp-profile-claims.mjs';
import { isValidP06CiRunEvidence } from '../lib/p06-ci-run-evidence.mjs';
import { readToolCatalogAtSourceRevision } from '../lib/source-revision-tool-catalog.mjs';
import { sanitizeGitRepositoryEnvironment } from '../lib/g26-mcp-bundle.mjs';

export const G03_MODEL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const g03ModelSha = (value) => createHash('sha256').update(value).digest('hex');
/** Hash JSON wire semantics; transport metadata and absent/false isError are equivalent. */
export function g03ModelResultSha(result) {
  const wire = JSON.parse(JSON.stringify(result));
  return g03ModelSha(
    canonical({
      content: wire.content,
      structuredContent: wire.structuredContent ?? null,
      isError: wire.isError === true,
    }),
  );
}
const hash = (value) => g03ModelSha(canonical(value));
const digest = (value) => typeof value === 'string' && /^[0-9a-f]{64}$/u.test(value);
const commit = (value) => typeof value === 'string' && /^[0-9a-f]{40}$/u.test(value);
const exact = (value, keys) =>
  value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  Object.keys(value).sort().join('\0') === [...keys].sort().join('\0');
const count = (n) => Number.isSafeInteger(n) && n >= 0;
const GATE_FIELDS = [
  'claimId',
  'runNumber',
  'prNumber',
  'frontierId',
  'epochId',
  'profileId',
  'toolName',
  'argumentProfile',
  'expectedArgumentsSha256',
  'registrySha256',
  'sourceCandidateSha',
  'baseSha',
  'ciSha',
  'ciStatus',
  'ciRunId',
  'ciChecks',
  'reviewerId',
  'bundleSha256',
  'runnerReceiptPublicKey',
];
const SNAPSHOT_FIELDS = [
  'contract',
  'phase',
  'searchRequests',
  'detailRequests',
  'denied',
  'observation',
  'image',
  'maxSearchRequests',
  'maxDetailRequests',
  'deadlineMs',
  'syntheticSource',
  'modelEvidence',
  'liveEvidence',
  'forbiddenServices',
  'renderStarted',
];
const COVERAGE = {
  scanned: 6,
  matched: 4,
  returned: 4,
  pagesScanned: 1,
  totalKind: 'estimated',
  upstreamExhausted: true,
  budgetExceeded: false,
  hydrationsAttempted: 6,
  hydrationsSucceeded: 6,
  hydrationsFailed: 0,
  unresolvedCandidates: 0,
};
const EXECUTION_FIELDS = [
  'sourceMode',
  'model',
  'reasoningEffort',
  'codexCliVersion',
  'modelJobs',
  'processExitCode',
  'eventStreamParsed',
  'turnCompleted',
  'codexMcpToolEventCount',
  'codexErrorItemCount',
  'mcpToolErrorResultCount',
  'nonMcpToolEventCount',
  'shellToolCallCount',
  'mcpServerNames',
  'eventStreamSha256',
  'serverSummarySha256',
  'answerSha256',
  'answerBytes',
  'exactStructuredResults',
  'exactAnswer',
  'fixtureResponses',
  'liveHttpRequests',
  'artifactMatched',
  'cleanupComplete',
  'protocolDeniedCalls',
  'providerInternalHttpCount',
  'invoiceHardCap',
];
const REPORT_FIELDS = [
  'schemaVersion',
  'evidenceKind',
  'profileId',
  'gate',
  'source',
  'observation',
  'execution',
  'observedAt',
  'signature',
];

// Freeze execution programs and the native contract they exercise. An unrelated
// catalog entry may change; these tool descriptors and these source bytes may not.
export const G03_MODEL_SOURCE_PATHS = Object.freeze([
  'docs/product/native-g03-date-png-mcp-bundle-attestation.json',
  'docs/research/run95-native-g03-date-png-prior-contracts-2026-11-12.json',
  'scripts/lib/g03-native-discovery-verification.mjs',
  'scripts/lib/native-g03-date-png-profile.mjs',
  'scripts/lib/native-g03-date-png-gates.mjs',
  'scripts/lib/native-g03-date-png-wire.mjs',
  'scripts/lib/c07-png-artifact-validation.mjs',
  'scripts/acceptance/g03-native-discovery-mcp.mjs',
  'scripts/acceptance/native-g03-date-png-server.mjs',
  'scripts/acceptance/run-native-g03-date-png-model.mjs',
  'scripts/acceptance/native-g03-date-png-report.mjs',
  'scripts/acceptance/run-native-entity-page-model.mjs',
  'scripts/acceptance/run-g26-codex-agent-mcp.mjs',
  'packages/discovery/src/compiler.ts',
  'packages/discovery/src/engine.ts',
  'packages/bangumi-transport/src/http-client.ts',
  'packages/provider-core/src/providers.ts',
  'packages/tools/src/definitions/discovery-tools.ts',
  'packages/tools/src/definitions/render-presentation-tools.ts',
  'packages/tools/src/registry.ts',
  'packages/tools/src/policy.ts',
  'packages/renderer/src/view-model-builders/index.ts',
  'packages/renderer/src/templates/DiscoveryResultsCard.tsx',
  'apps/mcp/src/catalog.ts',
  'apps/mcp/src/result-presenter.ts',
]);

export function readG03ModelSourceContext(root, revision) {
  if (!commit(revision)) throw new Error('G03_MODEL_SOURCE_INVALID');
  const gitBlob = (relative) =>
    execFileSync('git', ['show', `${revision}:${relative}`], {
      cwd: root,
      env: sanitizeGitRepositoryEnvironment(),
      maxBuffer: 4 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
  const sourceCatalog = readToolCatalogAtSourceRevision(root, revision);
  const currentCatalog = JSON.parse(
    readFileSync(path.join(root, 'docs/tool-catalog.json'), 'utf8'),
  );
  const descriptors = P.toolNames.map((name) => {
    const source = sourceCatalog.catalog.filter((tool) => tool.name === name);
    const current = currentCatalog.filter((tool) => tool.name === name);
    if (
      source.length !== 1 ||
      current.length !== 1 ||
      source[0].auth !== 'none' ||
      source[0].risk !== 'read' ||
      !isDeepStrictEqual(source, current)
    )
      throw new Error('G03_MODEL_CATALOG_CHANGED');
    return source[0];
  });
  const programFiles = Object.fromEntries(
    G03_MODEL_SOURCE_PATHS.map((relative) => {
      const bytes = gitBlob(relative);
      if (!bytes.equals(readFileSync(path.join(root, relative))))
        throw new Error('G03_MODEL_SOURCE_CHANGED');
      return [relative, g03ModelSha(bytes)];
    }),
  );
  const selection = gitBlob(P.selectionEvidencePath);
  if (!selection.equals(readFileSync(path.join(root, P.selectionEvidencePath))))
    throw new Error('G03_MODEL_SELECTION_CHANGED');
  const attestation = JSON.parse(
    gitBlob('docs/product/native-g03-date-png-mcp-bundle-attestation.json'),
  );
  if (
    !exact(attestation, ['schemaVersion', 'kind', 'bundleSha256']) ||
    attestation.schemaVersion !== 1 ||
    attestation.kind !== 'native-g03-date-png-mcp-runtime-bundle-attestation-v1' ||
    !digest(attestation.bundleSha256)
  )
    throw new Error('G03_MODEL_ATTESTATION_INVALID');
  return {
    catalogSha256: g03ModelSha(sourceCatalog.bytes),
    descriptors,
    selectionSha256: g03ModelSha(selection),
    programFiles,
    bundleSha256: attestation.bundleSha256,
  };
}

export function g03ModelClaimGate(claim) {
  return Object.fromEntries(GATE_FIELDS.map((key) => [key, claim?.[key]]));
}

export function validG03ModelClaim(claim) {
  try {
    const key = Buffer.from(claim?.runnerReceiptPublicKey ?? '', 'base64');
    const publicKey = createPublicKey({ key, type: 'spki', format: 'der' });
    return (
      claim?.runNumber === 95 &&
      Number.isSafeInteger(claim.prNumber) &&
      claim.prNumber > 0 &&
      ['CLAIMED', 'REPORT_WRITTEN'].includes(claim.state) &&
      claim.retryAllowed === false &&
      isDeepStrictEqual(
        claim.expectedArguments,
        P.calls.map((call) => call.arguments),
      ) &&
      claim.profileId === P.id &&
      claim.frontierId === P.frontierId &&
      claim.epochId === P.epochId &&
      claim.toolName === P.toolName &&
      claim.argumentProfile === P.argumentProfile &&
      claim.registrySha256 === agentMcpProfileRegistrySha256(P.id) &&
      claim.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(P) &&
      commit(claim.sourceCandidateSha) &&
      commit(claim.baseSha) &&
      claim.ciSha === claim.sourceCandidateSha &&
      claim.ciStatus === 'SUCCESS' &&
      isValidP06CiRunEvidence(claim) &&
      digest(claim.bundleSha256) &&
      typeof claim.reviewerId === 'string' &&
      claim.reviewerId.trim().length > 0 &&
      new RegExp(
        `^profile-run-95-pr-${claim.prNumber}-${claim.sourceCandidateSha.slice(0, 12)}-\\d+$`,
        'u',
      ).test(claim.claimId ?? '') &&
      publicKey.asymmetricKeyType === 'ed25519' &&
      key.toString('base64') === claim.runnerReceiptPublicKey &&
      claim.runnerReceiptPublicKeySha256 === g03ModelSha(key) &&
      publicKey.export({ format: 'der', type: 'spki' }).equals(key)
    );
  } catch {
    return false;
  }
}

export function validG03ModelSnapshot(value) {
  if (
    !exact(value, SNAPSHOT_FIELDS) ||
    value.contract !== 'g03-native-date-and-png-v1' ||
    value.phase !== 'COMPLETE' ||
    value.searchRequests !== 2 ||
    value.detailRequests !== 12 ||
    value.denied !== 0 ||
    value.maxSearchRequests !== 2 ||
    value.maxDetailRequests !== 12 ||
    value.deadlineMs !== 20000 ||
    value.syntheticSource !== true ||
    value.modelEvidence !== false ||
    value.liveEvidence !== false ||
    value.forbiddenServices !== 0 ||
    value.renderStarted !== true
  )
    return false;
  const q = value.observation,
    image = value.image;
  return Boolean(
    exact(q, ['rows', 'coverage', 'synthetic', 'unknownDatesDependOnUpstream']) &&
    isDeepStrictEqual(q.rows, G03_NATIVE_ROWS) &&
    isDeepStrictEqual(q.coverage, COVERAGE) &&
    q.synthetic === true &&
    q.unknownDatesDependOnUpstream === true &&
    exact(image, ['width', 'height', 'bytes', 'sha256', 'rows', 'decoded']) &&
    image.width === 720 &&
    Number.isSafeInteger(image.height) &&
    image.height >= 720 &&
    image.height <= 4096 &&
    count(image.bytes) &&
    image.bytes > 0 &&
    image.bytes <= 5000000 &&
    digest(image.sha256) &&
    isDeepStrictEqual(image.rows, G03_NATIVE_ROWS) &&
    image.decoded === true,
  );
}

export function validG03ModelArtifact(value, image) {
  return Boolean(
    exact(value, ['id', 'mimeType', 'width', 'height']) &&
    /^art_[0-9a-f]{32}$/u.test(value.id) &&
    value.mimeType === 'image/png' &&
    value.width === image?.width &&
    value.height === image?.height,
  );
}

export function g03ModelAnswerMatches(answer, observation, artifact) {
  try {
    if (
      typeof answer !== 'string' ||
      Buffer.byteLength(answer) > P.maxAnswerBytes ||
      !validG03ModelSnapshot(observation) ||
      !validG03ModelArtifact(artifact, observation.image)
    )
      return false;
    const value = JSON.parse(answer);
    return Boolean(
      exact(value, [
        'rows',
        'bounds',
        'estimated',
        'experimental',
        'unknownDatesDependOnUpstream',
        'artifact',
      ]) &&
      isDeepStrictEqual(value.rows, observation.observation.rows) &&
      isDeepStrictEqual(value.bounds, {
        from: G03_NATIVE_QUERY.from,
        to: G03_NATIVE_QUERY.to,
        fromInclusive: true,
        toExclusive: true,
      }) &&
      value.estimated === true &&
      value.experimental === true &&
      value.unknownDatesDependOnUpstream === true &&
      isDeepStrictEqual(value.artifact, artifact),
    );
  } catch {
    return false;
  }
}

function validExecution(value) {
  return (
    exact(value, EXECUTION_FIELDS) &&
    value.sourceMode === 'native-synthetic-discovery-date-png' &&
    value.model === P.model &&
    value.reasoningEffort === P.reasoningEffort &&
    value.modelJobs === 1 &&
    /^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/u.test(value.codexCliVersion ?? '') &&
    value.processExitCode === 0 &&
    value.eventStreamParsed === true &&
    value.turnCompleted === true &&
    value.codexMcpToolEventCount === 2 &&
    value.codexErrorItemCount === 0 &&
    value.mcpToolErrorResultCount === 0 &&
    value.nonMcpToolEventCount === 0 &&
    value.shellToolCallCount === 0 &&
    isDeepStrictEqual(value.mcpServerNames, [G03_MODEL_SERVER_ID, G03_MODEL_SERVER_ID]) &&
    ['eventStreamSha256', 'serverSummarySha256', 'answerSha256'].every((key) =>
      digest(value[key]),
    ) &&
    count(value.answerBytes) &&
    value.answerBytes > 0 &&
    value.answerBytes <= P.maxAnswerBytes &&
    value.exactStructuredResults === true &&
    value.exactAnswer === true &&
    value.fixtureResponses === 14 &&
    value.liveHttpRequests === 0 &&
    value.artifactMatched === true &&
    value.cleanupComplete === true &&
    value.protocolDeniedCalls === 0 &&
    value.providerInternalHttpCount === null &&
    value.invoiceHardCap === null
  );
}

export function validateG03ModelReport(report, claim, { root = G03_MODEL_ROOT } = {}) {
  try {
    if (
      !exact(report, REPORT_FIELDS) ||
      report.schemaVersion !== 1 ||
      report.evidenceKind !== P.evidenceKind ||
      report.profileId !== P.id ||
      !validG03ModelClaim(claim) ||
      !exact(report.gate, GATE_FIELDS) ||
      !isDeepStrictEqual(report.gate, g03ModelClaimGate(claim)) ||
      !validG03ModelSnapshot(report.observation) ||
      !validExecution(report.execution) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(report.observedAt ?? '') ||
      !Number.isFinite(Date.parse(report.observedAt)) ||
      report.source?.bundleSha256 !== claim.bundleSha256 ||
      !isDeepStrictEqual(report.source, readG03ModelSourceContext(root, claim.sourceCandidateSha))
    )
      return { passed: false, reason: 'G03_MODEL_REPORT_INVALID' };
    const bytes = Buffer.from(report.signature ?? '', 'base64');
    const publicKey = createPublicKey({
      key: Buffer.from(claim.runnerReceiptPublicKey, 'base64'),
      type: 'spki',
      format: 'der',
    });
    const payload = { ...report };
    delete payload.signature;
    if (
      bytes.length !== 64 ||
      bytes.toString('base64') !== report.signature ||
      !verify(null, Buffer.from(canonical(payload)), publicKey, bytes)
    )
      return { passed: false, reason: 'G03_MODEL_SIGNATURE_INVALID' };
    return { passed: true };
  } catch {
    return { passed: false, reason: 'G03_MODEL_REPORT_INVALID' };
  }
}

export function buildG03ModelReport(
  { claim, observation, execution, answer, artifact },
  privateKey,
  { root = G03_MODEL_ROOT } = {},
) {
  if (!validG03ModelSnapshot(observation) || !g03ModelAnswerMatches(answer, observation, artifact))
    throw new Error('G03_MODEL_ANSWER_OR_OBSERVATION_INVALID');
  const payload = {
    schemaVersion: 1,
    evidenceKind: P.evidenceKind,
    profileId: P.id,
    gate: g03ModelClaimGate(claim),
    source: readG03ModelSourceContext(root, claim.sourceCandidateSha),
    observation,
    execution: {
      ...execution,
      answerSha256: g03ModelSha(answer),
      answerBytes: Buffer.byteLength(answer),
      exactAnswer: true,
    },
    observedAt: new Date().toISOString(),
  };
  const report = {
    ...payload,
    signature: sign(null, Buffer.from(canonical(payload)), privateKey).toString('base64'),
  };
  if (!validateG03ModelReport(report, claim, { root }).passed)
    throw new Error('G03_MODEL_REPORT_BUILD_FAILED');
  return report;
}

export function validateG03ModelReportFile(claim, root = G03_MODEL_ROOT, reportPath = null) {
  try {
    const target = path.join(root, P.reportPath);
    if (reportPath !== null && path.resolve(reportPath) !== path.resolve(target)) throw new Error();
    const bytes = readFileSync(target);
    if (bytes.length > 65536) throw new Error();
    const report = JSON.parse(bytes.toString('utf8'));
    const result = validateG03ModelReport(report, claim, { root });
    return result.passed
      ? {
          passed: true,
          reportPath: P.reportPath,
          reportSha256: g03ModelSha(bytes),
          report,
          runnerReceiptSha256: hash({
            signature: report.signature,
            publicKey: claim.runnerReceiptPublicKey,
          }),
        }
      : result;
  } catch {
    return { passed: false, reason: 'G03_MODEL_REPORT_FILE_INVALID' };
  }
}

export function writeG03ModelReport(report, root = G03_MODEL_ROOT) {
  writeFileSync(path.join(root, P.reportPath), JSON.stringify(report, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
}
