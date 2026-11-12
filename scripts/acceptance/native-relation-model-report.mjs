import { createHash, createPublicKey, sign, verify } from 'node:crypto';
import { readFileSync, writeFileSync, openSync, closeSync, fstatSync, constants } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { execFileSync } from 'node:child_process';
import {
  RELATION_MODEL_PROFILE as P,
  RELATION_MODEL_SERVER_ID,
} from '../lib/native-relation-model-profile.mjs';
import {
  relationModelWireResult,
  projectRelationModelAnswer,
  relationModelAnswerMatches,
} from '../lib/native-relation-model-answer.mjs';
import { RELATION_SAFETY_IDS } from '../lib/native-relation-safety-contract.mjs';
import {
  canonicalAgentMcpProfileJson as canonical,
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
} from '../lib/agent-mcp-profile-claims.mjs';
import { isValidP06CiRunEvidence } from '../lib/p06-ci-run-evidence.mjs';
import { readToolCatalogAtSourceRevision } from '../lib/source-revision-tool-catalog.mjs';
import { sanitizeGitRepositoryEnvironment } from '../lib/g26-mcp-bundle.mjs';

export const RELATION_MODEL_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
export const relationModelSha = (value) => createHash('sha256').update(value).digest('hex');
/** Hash JSON wire semantics; transport metadata and absent/false isError are equivalent. */
export function relationModelResultSha(result) {
  return relationModelSha(canonical(relationModelWireResult(result)));
}

const hash = (value) => relationModelSha(canonical(value));
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
const { root, prequel, conflict, book, unknown } = RELATION_SAFETY_IDS;
export const RELATION_MODEL_EXPECTED_SNAPSHOT = {
  contract: 'native-relation-safety-v1',
  phase: 'COMPLETE',
  completedCalls: 2,
  fixtureReads: 5,
  maxFixtureReads: 5,
  denied: 0,
  failure: null,
  deadlineMs: 20000,
  observations: [
    {
      rowsObserved: 5,
      rowsReturned: 5,
      conflictingLabelsRetained: true,
      sourceCompletenessUnknown: true,
    },
    {
      stepIds: [prequel, root],
      exclusions: [
        { id: conflict, reason: 'conflicting_direct_relations' },
        { id: unknown, reason: 'relation_not_watch_step' },
        { id: book, reason: 'media_type_not_anime' },
      ],
      semanticConflict: true,
      canonicalOrder: false,
    },
  ],
  closed: true,
  syntheticSource: true,
  liveRequests: 0,
  modelEvidence: false,
  acceptanceCredit: false,
  retryAllowed: false,
};
const EXPECTED_ANSWER = {
  sourceSubjectId: root,
  directRows: [
    [prequel, 'anime', '前传'],
    [conflict, 'anime', '前传'],
    [conflict, 'anime', '续集'],
    [book, 'book', '原作'],
    [unknown, 'anime', '相关作品'],
  ].map(([subjectId, type, relation]) => ({ subjectId, type, relation })),
  steps: [
    { subjectId: prequel, position: 1, placement: 'before_root' },
    { subjectId: root, position: 2, placement: 'root' },
  ],
  exclusions: RELATION_MODEL_EXPECTED_SNAPSHOT.observations[1].exclusions.map(({ id, reason }) => ({
    subjectId: id,
    reason,
  })),
  coverage: {
    directRowsReturned: 5,
    relationRequests: 2,
    relationRowsObserved: 6,
    detailsFetched: 1,
    excludedCount: 3,
    truncated: true,
  },
  scope: {
    sourceCompleteness: 'not_provided_by_source',
    watchOrderState: 'partial',
    orderAuthority: 'bounded_recommendation',
    canonicalOrderEstablished: false,
    omissionsProveAbsence: false,
  },
};
const freeze = (value) => {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
};
freeze(RELATION_MODEL_EXPECTED_SNAPSHOT);
freeze(EXPECTED_ANSWER);
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
  'diagnosticPublished',
  'diagnosticSha256',
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
export const RELATION_MODEL_SOURCE_PATHS = Object.freeze([
  'docs/product/native-relation-model-mcp-bundle-attestation.json',
  'docs/research/run95-native-relation-safety-prior-contracts-2026-11-12.json',
  'scripts/lib/native-relation-safety-contract.mjs',
  'scripts/acceptance/native-relation-safety-mcp.mjs',
  'scripts/lib/native-relation-model-profile.mjs',
  'scripts/lib/native-relation-model-answer.mjs',
  'scripts/lib/native-relation-model-cli.mjs',
  'scripts/lib/native-relation-model-gates.mjs',
  'scripts/lib/agent-mcp-failure-observation.mjs',
  'scripts/lib/agent-mcp-failure-publication.mjs',
  'scripts/acceptance/native-relation-model-report.mjs',
  'scripts/acceptance/native-relation-model-server.mjs',
  'scripts/acceptance/run-native-relation-model.mjs',
  'scripts/acceptance/run-native-entity-page-model.mjs',
  'scripts/acceptance/run-g26-codex-agent-mcp.mjs',
  'scripts/lib/codex-mcp-approval-config.mjs',
  'packages/bangumi-transport/src/http-client.ts',
  'packages/bangumi-core/src/services/subject-service.ts',
  'packages/bangumi-core/src/services/series-service.ts',
  'packages/tools/src/definitions/read-tools.ts',
  'packages/tools/src/registry.ts',
  'packages/tools/src/policy.ts',
  'apps/mcp/src/catalog.ts',
  'apps/mcp/src/result-presenter.ts',
]);

export function readRelationModelSourceContext(root, revision) {
  if (!commit(revision)) throw new Error('RELATION_MODEL_SOURCE_INVALID');
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
      throw new Error('RELATION_MODEL_CATALOG_CHANGED');
    return source[0];
  });
  const programFiles = Object.fromEntries(
    RELATION_MODEL_SOURCE_PATHS.map((relative) => {
      const bytes = gitBlob(relative);
      if (!bytes.equals(readFileSync(path.join(root, relative))))
        throw new Error('RELATION_MODEL_SOURCE_CHANGED');
      return [relative, relationModelSha(bytes)];
    }),
  );
  const selection = gitBlob(P.selectionEvidencePath);
  if (!selection.equals(readFileSync(path.join(root, P.selectionEvidencePath))))
    throw new Error('RELATION_MODEL_SELECTION_CHANGED');
  const attestation = JSON.parse(
    gitBlob('docs/product/native-relation-model-mcp-bundle-attestation.json'),
  );
  if (
    !exact(attestation, ['schemaVersion', 'kind', 'bundleSha256']) ||
    attestation.schemaVersion !== 1 ||
    attestation.kind !== 'native-relation-model-mcp-runtime-bundle-attestation-v1' ||
    !digest(attestation.bundleSha256)
  )
    throw new Error('RELATION_MODEL_ATTESTATION_INVALID');
  return {
    catalogSha256: relationModelSha(sourceCatalog.bytes),
    descriptors,
    selectionSha256: relationModelSha(selection),
    programFiles,
    bundleSha256: attestation.bundleSha256,
  };
}

export function relationModelClaimGate(claim) {
  return Object.fromEntries(GATE_FIELDS.map((key) => [key, claim?.[key]]));
}

export function validRelationModelClaim(claim) {
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
      claim.runnerReceiptPublicKeySha256 === relationModelSha(key) &&
      publicKey.export({ format: 'der', type: 'spki' }).equals(key)
    );
  } catch {
    return false;
  }
}

export function validRelationModelSnapshot(value) {
  return isDeepStrictEqual(value, RELATION_MODEL_EXPECTED_SNAPSHOT);
}
export function validRelationModelAnswer(answer, results = null) {
  try {
    const expected = results ? projectRelationModelAnswer(results) : EXPECTED_ANSWER;
    return (
      isDeepStrictEqual(expected, EXPECTED_ANSWER) && relationModelAnswerMatches(answer, expected)
    );
  } catch {
    return false;
  }
}

function validExecution(value) {
  return (
    exact(value, EXECUTION_FIELDS) &&
    value.sourceMode === 'native-synthetic-relation-safety' &&
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
    isDeepStrictEqual(value.mcpServerNames, [RELATION_MODEL_SERVER_ID, RELATION_MODEL_SERVER_ID]) &&
    ['eventStreamSha256', 'serverSummarySha256', 'answerSha256'].every((key) =>
      digest(value[key]),
    ) &&
    count(value.answerBytes) &&
    value.answerBytes > 0 &&
    value.answerBytes <= P.maxAnswerBytes &&
    value.exactStructuredResults === true &&
    value.exactAnswer === true &&
    value.fixtureResponses === 5 &&
    value.liveHttpRequests === 0 &&
    value.diagnosticPublished === true &&
    digest(value.diagnosticSha256) &&
    value.cleanupComplete === true &&
    value.protocolDeniedCalls === 0 &&
    value.providerInternalHttpCount === null &&
    value.invoiceHardCap === null
  );
}

export function validateRelationModelReport(report, claim, { root = RELATION_MODEL_ROOT } = {}) {
  try {
    if (
      !exact(report, REPORT_FIELDS) ||
      report.schemaVersion !== 1 ||
      report.evidenceKind !== P.evidenceKind ||
      report.profileId !== P.id ||
      !validRelationModelClaim(claim) ||
      !exact(report.gate, GATE_FIELDS) ||
      !isDeepStrictEqual(report.gate, relationModelClaimGate(claim)) ||
      !validRelationModelSnapshot(report.observation) ||
      !validExecution(report.execution) ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(report.observedAt ?? '') ||
      !Number.isFinite(Date.parse(report.observedAt)) ||
      report.source?.bundleSha256 !== claim.bundleSha256 ||
      !isDeepStrictEqual(
        report.source,
        readRelationModelSourceContext(root, claim.sourceCandidateSha),
      )
    )
      return { passed: false, reason: 'RELATION_MODEL_REPORT_INVALID' };
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
      return { passed: false, reason: 'RELATION_MODEL_SIGNATURE_INVALID' };
    return { passed: true };
  } catch {
    return { passed: false, reason: 'RELATION_MODEL_REPORT_INVALID' };
  }
}

export function buildRelationModelReport(
  { claim, observation, execution, answer, results },
  privateKey,
  { root = RELATION_MODEL_ROOT } = {},
) {
  if (
    !Array.isArray(results) ||
    results.length !== 2 ||
    !validRelationModelSnapshot(observation) ||
    !validRelationModelAnswer(answer, results)
  )
    throw new Error('RELATION_MODEL_ANSWER_OR_OBSERVATION_INVALID');
  const payload = {
    schemaVersion: 1,
    evidenceKind: P.evidenceKind,
    profileId: P.id,
    gate: relationModelClaimGate(claim),
    source: readRelationModelSourceContext(root, claim.sourceCandidateSha),
    observation,
    execution: {
      ...execution,
      answerSha256: relationModelSha(answer),
      answerBytes: Buffer.byteLength(answer),
      exactAnswer: true,
    },
    observedAt: new Date().toISOString(),
  };
  const report = {
    ...payload,
    signature: sign(null, Buffer.from(canonical(payload)), privateKey).toString('base64'),
  };
  if (!validateRelationModelReport(report, claim, { root }).passed)
    throw new Error('RELATION_MODEL_REPORT_BUILD_FAILED');
  return report;
}

export function validateRelationModelReportFile(
  claim,
  root = RELATION_MODEL_ROOT,
  reportPath = null,
) {
  try {
    const target = path.join(root, P.reportPath);
    if (reportPath !== null && path.resolve(reportPath) !== path.resolve(target)) throw new Error();
    const descriptor = openSync(target, constants.O_RDONLY | constants.O_NOFOLLOW);
    let bytes;
    try {
      const stat = fstatSync(descriptor);
      if (!stat.isFile() || stat.uid !== process.getuid() || stat.nlink !== 1 || stat.size > 65536)
        throw new Error();
      bytes = readFileSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    const report = JSON.parse(bytes.toString('utf8'));
    const result = validateRelationModelReport(report, claim, { root });
    return result.passed
      ? {
          passed: true,
          reportPath: P.reportPath,
          reportSha256: relationModelSha(bytes),
          report,
          runnerReceiptSha256: hash({
            signature: report.signature,
            publicKey: claim.runnerReceiptPublicKey,
          }),
        }
      : result;
  } catch {
    return { passed: false, reason: 'RELATION_MODEL_REPORT_FILE_INVALID' };
  }
}

export function writeRelationModelReport(report, root = RELATION_MODEL_ROOT) {
  writeFileSync(path.join(root, P.reportPath), JSON.stringify(report, null, 2) + '\n', {
    flag: 'wx',
    mode: 0o600,
  });
}
