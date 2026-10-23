#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { gzipSync, gunzipSync } from 'node:zlib';
import {
  DISCOVERY_POLICY_VERSION,
  DEFAULT_EPOCH_REVIEW_SLOTS,
  DEFAULT_OUTER_PRODUCT_REVIEW_SLOTS,
  DEFAULT_OUTER_REVIEW_SLOTS,
  EPOCH_MARKER,
  RUN_MARKER,
  HarnessInvariantError,
  NO_OPPORTUNITY_STOP,
  afterPassBaseAction,
  applyFrontierReviewResult,
  applyReviewResult,
  assertGoalStopAllowed,
  assertCandidateInvariant,
  assertDiscoveryExhaustionEvidence,
  assertMergeReadiness,
  assertNoLegacyRuntimeChanges,
  assertProductCommitHygiene,
  assertReviewReadiness,
  assertRunCanStartEpoch,
  assertTrustedFrontierStop,
  classifyDiscoveryCheck,
  completeMerge,
  createEpochState,
  createRunState,
  extendEpochReviewBudget,
  extendRunProductReviewBudget,
  assertG04OneShotResultArtifactState,
  isReconciledPostPassCandidateRefresh,
  g04DispositionAcknowledges,
  isTerminalRunState,
  markReviewStarted,
  markFrontierReviewStarted,
  parseControlBlock,
  recordIntegrationBlocked,
  reconcileFrontierReviewReservation,
  reconcileReviewReservation,
  refreshPassedCandidate,
  recordReconciledPostPassCandidateReassessment,
  resumeCorrectiveAfterReviewBudgetExtension,
  restoreIntegrationAuthority,
  resumeDiscoveryAfterFrontierRejection,
  resumeReviewLimitForFinalCorrective,
  renderEpochBody,
  renderRunBody,
  reserveReview,
  reserveFrontierReview,
  waitForFrontierReviewer,
  waitForSameReviewer,
} from './lib/agent-harness-core.mjs';
import { canonicalHash, inspectFrontierLedger } from './lib/frontier-ledger.mjs';
import {
  acquireG06OneShotGitHubLatch,
  acquireG06OneShotTerminalGitHubLatch,
  claimG06OneShotAtomically,
  G06OneShotClaimError,
  g06MergeWorkingTreeIsSafe,
  readG06OneShotTerminalGitHubLatch,
  verifyG06OneShotGitHubLatch,
} from './lib/g06-one-shot-claim.mjs';
import {
  acquireG16OneShotGitHubLatch,
  claimG16OneShotAtomically,
  G16OneShotClaimError,
} from './lib/g16-one-shot-claim.mjs';
import {
  acquireAgentMcpProfileGitHubLatch,
  agentMcpProfileArgumentsSha256,
  agentMcpProfileClaimLabelDescription,
  agentMcpProfileRegistrySha256,
  acquireAgentMcpProfileTerminalGitHubLatch,
  agentMcpProfileTerminalLabelDescription,
  agentMcpProfileTerminalLabelName,
  AgentMcpProfileClaimError,
  claimAgentMcpProfileAtomically,
  classifyAgentMcpProfileInconclusiveReport,
  getAgentMcpProfileById,
  listAgentMcpProfiles,
  normalizeAgentMcpProfileDiagnostics,
} from './lib/agent-mcp-profile-claims.mjs';
import { deriveP06CiRunEvidence, isValidP06CiRunEvidence } from './lib/p06-ci-run-evidence.mjs';
import { profileRequiresExactCiRunEvidence } from './lib/agent-mcp-profile-ci-evidence.mjs';
import {
  acquireG04OneShotGitHubLatch,
  claimG04OneShotAtomically,
  G04OneShotClaimError,
  g04OneShotLatchLabelDescription,
  g04OneShotLatchLabelName,
} from './lib/g04-one-shot-claim.mjs';
import {
  acquireR01OneShotGitHubLatch,
  acquireR01OneShotTerminalGitHubLatch,
  claimR01OneShotAtomically,
  readR01OneShotTerminalGitHubLatch,
  R01OneShotClaimError,
  verifyR01OneShotGitHubLatch,
} from './lib/r01-one-shot-claim.mjs';
import {
  acquireD07OneShotGitHubLatch,
  acquireD07OneShotTerminalGitHubLatch,
  claimD07OneShotAtomically,
  D07OneShotClaimError,
  d07OneShotClaimIdFromLabel,
  readD07OneShotGitHubLatch,
  readD07OneShotTerminalGitHubLatch,
  verifyD07OneShotGitHubLatch,
} from './lib/d07-one-shot-claim.mjs';
import {
  d07RunnerTempDirectory,
  isD07RunnerProcessActive,
  setD07RunnerProcessTitle,
} from './lib/d07-runner-liveness.mjs';
import { isG16LunaMaxReviewerId } from './lib/g16-reviewer-id.mjs';
import { parseCodexJsonl, summarizeCodexEvents } from './acceptance/run-g26-codex-agent-mcp.mjs';
import {
  buildExactCandidateBundle as buildExactG04CandidateBundle,
  currentBundleMatches as g04CurrentBundleMatches,
  runG04CodexAgentMcp,
} from './acceptance/run-g04-codex-agent-mcp.mjs';
import { G04_EXPECTED_QUERY_ARGUMENTS } from './acceptance/g04-person-activity-answer-check.mjs';
import { g04RunnerPublicKeySha256 } from './acceptance/g04-runner-receipt.mjs';
import { validateG04SanitizedReportFile } from './acceptance/write-g04-agent-mcp-report.mjs';
import { runG16CodexAgentMcp } from './acceptance/run-g16-codex-agent-mcp.mjs';
import {
  G06_ARGUMENT_PROFILE,
  G06_EPOCH_ID,
  G06_EXPECTED_QUERY_ARGUMENTS,
  G06_REPORT_RELATIVE_PATH,
  G06_TOOL_NAME,
} from './acceptance/g06-subject-cast-answer-check.mjs';
import {
  canonicalG06ClaimPath,
  localG06ClaimMatchesHarnessClaim,
  runG06CodexAgentMcp,
} from './acceptance/run-g06-codex-agent-mcp.mjs';
import {
  G16_ARGUMENT_PROFILE,
  G16_EXPECTED_QUERY_ARGUMENTS,
} from './acceptance/g16-person-activity-answer-check.mjs';
import { g16RunnerPublicKeySha256 } from './acceptance/g16-agent-mcp-runner-receipt.mjs';
import { validateG16SanitizedReportFile } from './acceptance/write-g16-agent-mcp-report.mjs';
import { validateC01SanitizedReportFile } from './acceptance/write-c01-rating-count-report.mjs';
import { validateC03SanitizedReportFile } from './acceptance/write-c03-profile-report.mjs';
import { validateC03PersonActivityOfflineV2SanitizedReportFile } from './acceptance/write-c03-person-activity-offline-v2-report.mjs';
import { validateP03SanitizedReportFile } from './acceptance/write-p03-person-name-cn-report.mjs';
import { validateP03V2SanitizedReportFile } from './acceptance/write-p03-person-name-cn-v2-report.mjs';
import { validateP07SanitizedReportFile } from './acceptance/write-p07-person-season-report.mjs';
import { validateS05SanitizedReportFile } from './acceptance/write-s05-person-activity-report.mjs';
import { validateS01SanitizedReportFile } from './acceptance/write-s01-annual-tv-voice-report.mjs';
import { validateR05SanitizedReportFile } from './acceptance/write-r05-shared-person-overlap-report.mjs';
import { validateP06SanitizedReportFile } from './acceptance/write-p06-render-person-profile-agent-mcp-report.mjs';
import { validateRenderSubjectCardOfflineSanitizedReportFile } from './acceptance/write-render-subject-card-offline-agent-mcp-report.mjs';
import { validateC07RenderComparisonOfflineSanitizedReportFile } from './acceptance/write-c07-render-comparison-offline-agent-mcp-report.mjs';
import { validateG01RenderQueryOfflineSanitizedReportFile } from './acceptance/write-g01-render-query-subjects-offline-agent-mcp-report.mjs';
import { validateG01QuerySubjectsOfflineSanitizedReportFile } from './acceptance/write-g01-query-subjects-offline-agent-mcp-report.mjs';
import {
  G01_QUERY_SUBJECTS_OFFLINE_PROFILE_ID,
  G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_ID,
  getG01QuerySubjectsOfflineProfileSpec,
} from './lib/g01-query-subjects-offline-matrix-profile.mjs';
import { validateP02SanitizedReportFile } from './acceptance/write-p02-person-profile-agent-mcp-report.mjs';
import { validateG06SubjectCastOfflineSanitizedReportFile } from './acceptance/write-g06-subject-cast-offline-agent-mcp-report.mjs';
import { validateR04SanitizedReportFile } from './acceptance/write-r04-series-watch-order-offline-agent-mcp-report.mjs';
import { validateR04SeriesWatchOrderOfflineV2SanitizedReportFile } from './acceptance/write-r04-series-watch-order-offline-agent-mcp-v2-report.mjs';
import { validateR04RenderSanitizedReportFile } from './acceptance/write-r04-render-series-watch-order-offline-agent-mcp-report.mjs';
import { validateR04RenderV2SanitizedReportFile } from './acceptance/write-r04-render-series-watch-order-offline-agent-mcp-v2-report.mjs';
import { validateR01RelationsOfflineSanitizedReportFile } from './acceptance/write-r01-relations-offline-agent-mcp-report.mjs';
import { validateR03RelationsOfflineSanitizedReportFile } from './acceptance/write-r03-relations-offline-agent-mcp-report.mjs';
import { validateC04SanitizedReportFile } from './acceptance/write-c04-cohort-comparison-agent-mcp-report.mjs';
import { validateTitleQueryRenderSanitizedReportFile } from './acceptance/write-title-query-render-agent-mcp-report.mjs';
import { validateR02SanitizedReportFile } from './acceptance/write-r02-positive-direct-relations-agent-mcp-report.mjs';
import { validateQuerySubjectsFreshPublicSanitizedReportFile } from './acceptance/write-query-subjects-fresh-public-agent-mcp-report.mjs';
import { validateQuerySubjectsFreshPublicSanitizedReportFile as validateQuerySubjectsFreshPublicV2SanitizedReportFile } from './acceptance/write-query-subjects-fresh-public-agent-mcp-v2-report.mjs';
import { validateC02SanitizedReportFile } from './acceptance/write-c02-tv-movie-comparison-report.mjs';
import { validateM07SanitizedReportFile } from './acceptance/write-m07-manage-index-agent-mcp-report.mjs';
import { validateAuthStartSanitizedReportFile } from './acceptance/write-auth-start-offline-agent-mcp-report.mjs';
import { validateA01RenderCohortAggregationSanitizedReportFile } from './acceptance/write-a01-render-cohort-aggregation-agent-mcp-report.mjs';
import { validateA01AggregateCohortProfileReportFile } from './acceptance/write-a01-aggregate-cohort-offline-agent-mcp-report.mjs';
import { A01_AGGREGATE_COHORT_OFFLINE_PROFILE_IDS } from './lib/a01-aggregate-cohort-offline-matrix-profile.mjs';
import { validateA01RatingDispersionSanitizedReportFile } from './acceptance/write-a01-rating-dispersion-agent-mcp-report.mjs';
import {
  G06_CAST_OFFLINE_EPOCH_ID,
  G06_CAST_OFFLINE_PROFILE_ID,
  G06_CAST_OFFLINE_V2_EPOCH_ID,
  G06_CAST_OFFLINE_V2_PROFILE_ID,
  getG06CastOfflineProfileSpec,
} from './lib/g06-subject-cast-offline-profile.mjs';
import {
  C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID,
  C07_RENDER_COMPARISON_OFFLINE_V2_PROFILE_ID,
  C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID,
  getC07RenderComparisonOfflineConfig,
} from './lib/c07-render-comparison-offline-profile.mjs';
import {
  G01_RENDER_QUERY_OFFLINE_PROFILE_ID,
  G01_RENDER_QUERY_OFFLINE_V2_PROFILE_ID,
  getG01RenderQueryOfflineProfileSpec,
} from './lib/g01-render-query-subjects-offline-profile.mjs';
import {
  G06_MODEL,
  G06_REASONING_EFFORT,
  validateG06SanitizedReportFile,
} from './acceptance/write-g06-agent-mcp-report.mjs';
import { isG06RunnerReceiptPublicKey } from './acceptance/g06-runner-receipt.mjs';
import {
  R01_ARGUMENT_PROFILE,
  R01_EPOCH_ID,
  R01_EXPECTED_QUERY_ARGUMENTS,
  runR01CodexAgentMcp,
} from './acceptance/run-r01-codex-agent-mcp.mjs';
import { validateR01SanitizedReportFile } from './acceptance/write-r01-agent-mcp-report.mjs';
import {
  P01_ARGUMENT_PROFILE,
  P01_EXPECTED_QUERY_ARGUMENTS,
  verifyP01PersonPositionAnswer,
} from './acceptance/p01-person-position-answer-check.mjs';
import { validateP01PersonActivityDirectorOfflineSanitizedReportFile } from './acceptance/write-p01-person-activity-director-offline-report.mjs';
import {
  P05_ARGUMENTS_SHA256,
  P05_ARGUMENT_PROFILE,
  P05_EPOCH_ID,
  P05_TOOL_NAME,
  p05CandidateGateIsReady,
  p05PersonMediaSummaryIsValid,
} from './acceptance/p05-person-media-public-probe.mjs';
import {
  acquireP05OneShotGitHubLatch,
  claimP05OneShotAtomically,
  P05_ONE_SHOT_LATCH_LABEL_DESCRIPTION,
  P05_ONE_SHOT_LATCH_LABEL_NAME,
  P05_ONE_SHOT_REPORT_PATH,
  P05OneShotClaimError,
  verifyP05OneShotGitHubLatch,
} from './lib/p05-one-shot-claim.mjs';
import { validateP01SanitizedReportFile } from './acceptance/write-p01-agent-mcp-report.mjs';
import { validateD07SanitizedReport } from './acceptance/write-d07-agent-mcp-report.mjs';
import { runD07CodexAgentMcp } from './acceptance/run-d07-codex-agent-mcp.mjs';
import {
  buildP01RunnerReceiptPayload,
  createP01RunnerReceipt,
  generateP01RunnerReceiptKeyPair,
  p01RunnerPublicKeySha256,
} from './acceptance/p01-runner-receipt.mjs';
import {
  assertCurrentReviewGate,
  buildCodexExecArgs,
  buildExactCandidateBundle,
  canonicalP01ClaimPath,
  canonicalP01SafeEventSummary,
  cleanCandidate,
  codexCliVersion,
  createP01OneShotClaim,
  currentBundleMatches,
  hasUnexpectedP01CodexToolActivity,
  persistHarnessP01OneShotResult,
  readServerSummary,
  serverSummaryMatchesCandidate,
  textResultBytes,
  validateP01HarnessClaim,
} from './acceptance/run-p01-codex-agent-mcp.mjs';
import {
  computeMcpBundleSha256,
  readG26McpBundleAttestation,
  sanitizeGitRepositoryEnvironment as sanitizeP01GitEnvironment,
} from './lib/g26-mcp-bundle.mjs';
import {
  D07_EXPECTED_YEARS,
  D07_QUERY_ARGUMENTS_BY_YEAR,
} from './acceptance/d07-current-rank-answer-check.mjs';

const root = path.resolve(import.meta.dirname, '..');
const G06_CAST_OFFLINE_V2_ACCEPTANCE_REFRESH_PATHS = new Set([
  '.github/workflows/ci.yml',
  'docs/agent/HARNESS.md',
  'docs/research/run95-g14-query-subjects-v2-terminal-disposition-2026-10-19.md',
  'scripts/check-tool-acceptance-table.py',
  'scripts/test_acceptance_evidence.py',
  'scripts/generate-tool-acceptance-tasks.py',
  'scripts/agent-harness.mjs',
  'scripts/lib/source-revision-tool-catalog.mjs',
  'scripts/acceptance/write-g06-subject-cast-offline-agent-mcp-report.mjs',
  'tests/harness/write-g06-subject-cast-offline-agent-mcp-report.test.mjs',
  'scripts/acceptance/write-r04-render-series-watch-order-offline-agent-mcp-v2-report.mjs',
  'tests/harness/write-r04-render-series-watch-order-offline-agent-mcp-v2-report.test.mjs',
  'tests/harness/agent-harness-cli.test.mjs',
  'tests/harness/g01-public-query-render-evidence.test.mjs',
  'tests/harness/g09-public-watch-order-evidence.test.mjs',
  'tests/harness/g09-public-watch-order-render-evidence.test.mjs',
  'tests/harness/public-probe-coverage.test.mjs',
  'tests/harness/query-subjects-fresh-public-matrix-v2-profile.test.mjs',
  'tests/integration/tool-e2e-acceptance.test.ts',
]);
const R04_RENDER_V2_PROFILE_ID = 'r04-render-series-watch-order-offline-agent-mcp-matrix-v2';
const R04_RENDER_V2_ACCEPTANCE_REFRESH_PATHS = new Set([
  'docs/agent/HARNESS.md',
  'docs/research/run95-g14-query-subjects-v2-terminal-disposition-2026-10-19.md',
  'scripts/check-tool-acceptance-table.py',
  'scripts/generate-tool-acceptance-tasks.py',
  'scripts/test_acceptance_evidence.py',
  'scripts/agent-harness.mjs',
  'apps/mcp/codex-one-tool-mcp-server.mjs',
  'scripts/lib/source-revision-tool-catalog.mjs',
  'scripts/acceptance/write-r04-render-series-watch-order-offline-agent-mcp-v2-report.mjs',
  'tests/harness/write-r04-render-series-watch-order-offline-agent-mcp-v2-report.test.mjs',
  'scripts/acceptance/write-g06-subject-cast-offline-agent-mcp-report.mjs',
  'tests/harness/write-g06-subject-cast-offline-agent-mcp-report.test.mjs',
  'tests/harness/agent-harness-cli.test.mjs',
  'tests/harness/g01-public-query-render-evidence.test.mjs',
  'tests/harness/g09-public-watch-order-evidence.test.mjs',
  'tests/harness/g09-public-watch-order-render-evidence.test.mjs',
  'tests/harness/public-probe-coverage.test.mjs',
  'tests/harness/query-subjects-fresh-public-matrix-v2-profile.test.mjs',
  'tests/integration/tool-e2e-acceptance.test.ts',
]);
const P01_MODEL = 'gpt-6-luna';
const P01_REASONING_EFFORT = 'max';
const P01_TOOL_NAME = 'bangumi.get_person_activity';
const P01_SERVER_ID = 'bgk_p01_one_tool';
const P01_REPORT_WRITER = path.join(root, 'scripts/acceptance/write-p01-agent-mcp-report.mjs');
const P01_REPORT_PATH = path.join(
  root,
  'docs/live-probes/p01-person-position-agent-mcp-run95.json',
);
const G04_MODEL = 'gpt-6-luna';
const G04_REASONING_EFFORT = 'max';
const G04_ARGUMENT_PROFILE = 'fixed-g04-person-13684-voice-tv-12m-48r-16d-8rows-v1';
const G04_REPORT_PATH = path.join(root, 'docs/live-probes/g04-person-activity-run95.json');
const G04_REPORT_RELATIVE_PATH = path.relative(root, G04_REPORT_PATH);
const HARNESS_MOCK_G04_BUNDLE_ENV = 'HARNESS_G04_BUNDLE_SHA256';
const G16_MODEL = 'gpt-6-luna';
const G16_REASONING_EFFORT = 'max';
const G16_EPOCH_ID = 'run95-g16-director-person-activity-agent-mcp';
const D07_EPOCH_ID = 'run95-d07-current-rank-by-release-year';
const D07_ARGUMENT_PROFILE = 'fixed-d07-current-rank-by-source-year-2016-2025-v1';
const D07_MODEL = 'gpt-6-luna';
const D07_REASONING_EFFORT = 'max';
const D07_TOOL_NAME = 'bangumi.query_subjects';
const D07_REPORT_RELATIVE_PATH =
  'docs/live-probes/d07-current-rank-by-release-year-agent-mcp-run95.json';
const D07_REPORT_PATH = path.join(root, D07_REPORT_RELATIVE_PATH);
const D07_LOCAL_CLAIM_FILENAME = 'd07-run95-one-shot-claim.json';
const G16_REPORT_PATH = path.join(root, 'docs/live-probes/g16-director-person-activity-run95.json');
const G16_REPORT_RELATIVE_PATH = path.relative(root, G16_REPORT_PATH);

function d07LocalClaimJournalPath() {
  if (process.env.HARNESS_D07_LOCAL_CLAIM_PATH) {
    return path.resolve(process.env.HARNESS_D07_LOCAL_CLAIM_PATH);
  }
  if (process.env.HARNESS_MOCK_STATE) {
    return path.join(
      path.dirname(path.resolve(process.env.HARNESS_MOCK_STATE)),
      D07_LOCAL_CLAIM_FILENAME,
    );
  }
  const commonDirectory = path.resolve(root, git('rev-parse', '--git-common-dir'));
  return path.join(commonDirectory, 'pariya-agent-state', D07_LOCAL_CLAIM_FILENAME);
}

function writeD07LocalClaimJournal(claim) {
  const filePath = d07LocalClaimJournalPath();
  fs.mkdirSync(path.dirname(filePath), { recursive: true, mode: 0o700 });
  let descriptor;
  try {
    descriptor = fs.openSync(filePath, 'wx', 0o600);
    fs.writeFileSync(descriptor, `${JSON.stringify(claim, null, 2)}\n`, 'utf8');
    fs.fsyncSync(descriptor);
  } catch {
    if (descriptor !== undefined) {
      try {
        fs.closeSync(descriptor);
      } catch {
        // Preserve the original local create-once failure.
      }
    }
    throw new HarnessInvariantError(
      'D07_ONESHOT_LOCAL_JOURNAL_EXISTS',
      'A local D07 one-shot recovery journal already exists; inspect it before proceeding.',
    );
  }
  fs.closeSync(descriptor);
  return filePath;
}

function readD07LocalClaimJournal() {
  const filePath = d07LocalClaimJournalPath();
  let info;
  try {
    info = fs.lstatSync(filePath);
  } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
  if (!info.isFile() || info.isSymbolicLink() || info.size <= 0 || info.size > 32 * 1024) {
    throw new HarnessInvariantError(
      'D07_ONESHOT_LOCAL_JOURNAL_INVALID',
      'The local D07 recovery journal is not a bounded regular file.',
    );
  }
  let claim;
  try {
    claim = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    throw new HarnessInvariantError(
      'D07_ONESHOT_LOCAL_JOURNAL_INVALID',
      'The local D07 recovery journal is not valid JSON.',
    );
  }
  if (
    !claim ||
    typeof claim !== 'object' ||
    claim.runNumber !== 95 ||
    claim.frontierId !== 'D07' ||
    claim.epochId !== D07_EPOCH_ID ||
    claim.toolName !== D07_TOOL_NAME ||
    claim.retryAllowed !== false ||
    claim.state !== 'CLAIMED' ||
    typeof claim.claimId !== 'string' ||
    !/^d07-run-95-pr-\d+-[0-9a-f]{12}-[0-9a-f]{12}$/u.test(claim.claimId) ||
    typeof claim.prNumber !== 'number' ||
    !Number.isSafeInteger(claim.prNumber) ||
    !Number.isSafeInteger(claim.runnerPid) ||
    claim.runnerPid <= 0 ||
    !/^[0-9a-f]{40}$/u.test(claim.sourceCandidateSha ?? '') ||
    !/^[0-9a-f]{40}$/u.test(claim.baseSha ?? '') ||
    !/^[0-9a-f]{64}$/u.test(claim.bundleSha256 ?? '')
  ) {
    throw new HarnessInvariantError(
      'D07_ONESHOT_LOCAL_JOURNAL_INVALID',
      'The local D07 recovery journal does not contain an exact no-retry claim.',
    );
  }
  return claim;
}

function clearD07LocalClaimJournal(claimId) {
  const claim = readD07LocalClaimJournal();
  if (claim?.claimId === claimId) fs.rmSync(d07LocalClaimJournalPath());
}
const G06_REPORT_ROOT =
  process.env.HARNESS_MOCK_STATE && process.env.HARNESS_G06_REPORT_ROOT
    ? path.resolve(process.env.HARNESS_G06_REPORT_ROOT)
    : root;
const G06_EPOCH_REPORT_PATH = path.join(G06_REPORT_ROOT, G06_REPORT_RELATIVE_PATH);
const R01_MODEL = 'gpt-6-luna';
const R01_REASONING_EFFORT = 'max';
const R01_TOOL_NAME = 'bangumi.get_subject_relations';
const R01_REPORT_PATH =
  process.env.HARNESS_MOCK_STATE && process.env.HARNESS_R01_REPORT_PATH
    ? path.resolve(process.env.HARNESS_R01_REPORT_PATH)
    : path.join(root, 'docs/live-probes/pariya-agent-codex-luna-e2e-R01-relations.json');
const R01_REPORT_RELATIVE_PATH = 'docs/live-probes/pariya-agent-codex-luna-e2e-R01-relations.json';
const R01_TERMINAL_RECONCILIATION_METHOD = 'harness-r01-read-only-reconcile-v1';
const P01_MAX_STDOUT_BYTES = 8 * 1024 * 1024;
const P01_CODEX_TIMEOUT_MS = 10 * 60 * 1000;
const frontierLedgerPath =
  process.env.HARNESS_MOCK_STATE && process.env.HARNESS_FRONTIER_LEDGER_PATH
    ? path.resolve(process.env.HARNESS_FRONTIER_LEDGER_PATH)
    : path.join(root, 'docs/product/frontier-ledger.json');
const scenarioCatalogPath = path.join(root, 'docs/research/user-scenario-catalog.md');
const opportunityLogPath = path.join(root, 'docs/product/opportunity-log.md');
const toolCatalogPath = path.join(root, 'docs/tool-catalog.json');
const expectedOpportunityIds = Array.from(
  fs.readFileSync(opportunityLogPath, 'utf8').matchAll(/^##\s+(OP-\d{3})\b/gmu),
  (match) => match[1],
);
const mandatoryCiChecks = [
  'harness-control',
  'sqlite-default',
  'host-integration',
  'standalone-release-smoke',
  'postgres-compat',
  'provider-foundation',
  'discovery-foundation',
];
const MAX_CONTROL_BODY_BYTES = 65_536;

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: options.capture === false ? 'inherit' : ['pipe', 'pipe', 'pipe'],
    input: options.input,
    env: { ...process.env, ...options.env },
  }).trim();
}

function git(...args) {
  return run('git', args);
}

function gh(...args) {
  const last = args.at(-1);
  const options = last && typeof last === 'object' ? args.pop() : {};
  return run('gh', args, options);
}

function parseArgs(argv) {
  const [command = 'help', ...rest] = argv;
  const options = { _: [] };
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (!token.startsWith('--')) {
      options._.push(token);
      continue;
    }
    const [rawKey, inlineValue] = token.slice(2).split('=', 2);
    if (inlineValue !== undefined) {
      options[rawKey] = inlineValue;
    } else if (rest[index + 1] && !rest[index + 1].startsWith('--')) {
      options[rawKey] = rest[index + 1];
      index += 1;
    } else {
      options[rawKey] = true;
    }
  }
  return { command, options };
}

function required(options, name) {
  const value = options[name];
  if (value === undefined || value === true || value === '') {
    throw new HarnessInvariantError('ARGUMENT_REQUIRED', `--${name} is required`);
  }
  return String(value);
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(path.resolve(root, filePath), 'utf8'));
}

function archiveEvidence(evidence) {
  const json = JSON.stringify(evidence);
  return {
    encoding: 'gzip+base64',
    uncompressed_bytes: Buffer.byteLength(json, 'utf8'),
    data: gzipSync(json).toString('base64'),
  };
}

function restoreEvidence(archive) {
  if (!archive) return null;
  if (archive.encoding !== 'gzip+base64' || typeof archive.data !== 'string') return archive;
  let json;
  try {
    json = gunzipSync(Buffer.from(archive.data, 'base64')).toString('utf8');
  } catch (error) {
    throw new HarnessInvariantError(
      'FRONTIER_REVIEW_EVIDENCE_CORRUPT',
      'The durable frontier closure evidence cannot be reconstructed',
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
  if (Buffer.byteLength(json, 'utf8') !== archive.uncompressed_bytes) {
    throw new HarnessInvariantError(
      'FRONTIER_REVIEW_EVIDENCE_CORRUPT',
      'The durable frontier closure evidence length does not match its archive metadata',
    );
  }
  return JSON.parse(json);
}

function ensureCleanWorkingTree() {
  const status = git('status', '--porcelain');
  if (status) {
    throw new HarnessInvariantError(
      'UNSAFE_DIRTY_WORKTREE',
      'The Harness will not relocate or mutate unrelated dirty work',
      { status: status.split('\n') },
    );
  }
}

function ensureG06MergeWorkingTree(reportValidated) {
  const status = git('status', '--porcelain', '--untracked-files=all');
  if (!g06MergeWorkingTreeIsSafe(status, reportValidated)) {
    throw new HarnessInvariantError(
      'UNSAFE_DIRTY_WORKTREE',
      'G06 merge permits only its exact validated sanitized report as an untracked file',
      { status: status.split('\n') },
    );
  }
}

function buildG04BundleForReconciliation(candidateSha) {
  if (process.env.HARNESS_MOCK_STATE) {
    const mocked = process.env[HARNESS_MOCK_G04_BUNDLE_ENV];
    if (!/^[0-9a-f]{64}$/u.test(mocked ?? '')) {
      throw new HarnessInvariantError(
        'G04_LEGACY_RECONCILIATION_BUNDLE_MISMATCH',
        'Harness mock mode requires a valid exact-candidate G04 bundle digest.',
      );
    }
    return mocked;
  }
  return buildExactG04CandidateBundle(candidateSha);
}

function g04BundleMatchesForReconciliation(candidateSha, bundleSha256) {
  if (process.env.HARNESS_MOCK_STATE) {
    return (
      bundleSha256 === process.env[HARNESS_MOCK_G04_BUNDLE_ENV] &&
      currentHead() === candidateSha &&
      git('status', '--porcelain') === ''
    );
  }
  return g04CurrentBundleMatches(candidateSha, bundleSha256);
}

function ensureControlPlane() {
  try {
    run('gh', ['--version']);
    gh('auth', 'status');
    gh('repo', 'view', '--json', 'nameWithOwner');
  } catch (error) {
    throw new HarnessInvariantError(
      'CONTROL_PLANE_UNAVAILABLE',
      'GitHub CLI authentication/API access is required; no Git fallback is allowed',
      { cause: error instanceof Error ? error.message : String(error) },
    );
  }
}

function issueView(number) {
  return JSON.parse(gh('issue', 'view', String(number), '--json', 'number,title,body,state,url'));
}

function prView(number) {
  return JSON.parse(
    gh(
      'pr',
      'view',
      String(number),
      '--json',
      'number,title,body,state,url,isDraft,headRefName,headRefOid,baseRefName,baseRefOid,mergeStateStatus,statusCheckRollup,mergeCommit',
    ),
  );
}

function issueState(number) {
  const view = issueView(number);
  return { view, state: parseControlBlock(view.body, RUN_MARKER) };
}

function epochState(number) {
  const view = prView(number);
  return { view, state: parseControlBlock(view.body, EPOCH_MARKER) };
}

function updateIssue(number, state) {
  const body = renderRunBody(state);
  assertControlBodyFits(body, 'Run Issue');
  gh('api', `repos/{owner}/{repo}/issues/${number}`, '--method', 'PATCH', '--input', '-', {
    input: JSON.stringify({ body }),
  });
  return body;
}

function updatePr(number, state) {
  const body = renderEpochBody(state);
  assertControlBodyFits(body, 'Epoch PR');
  gh('api', `repos/{owner}/{repo}/pulls/${number}`, '--method', 'PATCH', '--input', '-', {
    input: JSON.stringify({ body }),
  });
  return body;
}

function assertControlBodyFits(body, label) {
  const bytes = Buffer.byteLength(body, 'utf8');
  if (bytes > MAX_CONTROL_BODY_BYTES) {
    throw new HarnessInvariantError(
      'CONTROL_BODY_TOO_LARGE',
      `${label} control state cannot be serialized without truncation`,
      { bytes, max_bytes: MAX_CONTROL_BODY_BYTES },
    );
  }
}

function currentBranch() {
  return git('branch', '--show-current');
}

function currentHead() {
  return git('rev-parse', 'HEAD');
}

function remoteBaseSha(branch) {
  git('fetch', 'origin', branch);
  return git('rev-parse', `origin/${branch}`);
}

function isAncestor(ancestor, descendant) {
  try {
    git('merge-base', '--is-ancestor', ancestor, descendant);
    return true;
  } catch {
    return false;
  }
}

function remoteBranchExists(branch) {
  return git('ls-remote', '--heads', 'origin', `refs/heads/${branch}`) !== '';
}

function changedPaths(base, head = 'HEAD') {
  const committed = git('diff', '--name-only', `${base}...${head}`);
  const working = git('status', '--porcelain=v1')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3));
  return [...new Set([...committed.split('\n').filter(Boolean), ...working])];
}

function commitSubjects(base, head = 'HEAD') {
  const output = git('log', '--format=%s', `${base}..${head}`);
  return output.split('\n').filter(Boolean);
}

function eventPrBody() {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath || !fs.existsSync(eventPath)) return '';
  try {
    return JSON.parse(fs.readFileSync(eventPath, 'utf8')).pull_request?.body ?? '';
  } catch {
    return '';
  }
}

function isProductEpoch(options) {
  if (options['product-epoch'] === true || process.env.HARNESS_PR_KIND === 'product') return true;
  if (eventPrBody().includes(`<!-- ${EPOCH_MARKER}:start -->`)) return true;
  return /^codex\/epoch[-/]/u.test(currentBranch());
}

function mandatoryChecksSuccessful(checks) {
  if (!Array.isArray(checks)) return false;
  const states = new Map(
    checks.map((check) => [check.name ?? check.context, check.conclusion ?? check.state]),
  );
  return mandatoryCiChecks.every((name) => states.get(name) === 'SUCCESS');
}

function print(value) {
  process.stdout.write(`${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`);
}

function expectedCatalogQuestions() {
  const questions = {};
  for (const line of fs.readFileSync(scenarioCatalogPath, 'utf8').split('\n')) {
    const cells = line
      .split('|')
      .slice(1, -1)
      .map((cell) => cell.trim());
    const id = cells[0];
    if (!/^(?:G\d{2}|[DCPSTMALUR]\d{2})$/u.test(id ?? '')) continue;
    questions[id] = id.startsWith('G') ? cells[2] : cells[1];
  }
  for (const match of fs
    .readFileSync(opportunityLogPath, 'utf8')
    .matchAll(/^## (OP-\d{3}) (.+)$/gmu)) {
    questions[match[1]] =
      `Can BangumiAgentKit deliver the bounded user value described by ${match[2]}?`;
  }
  return questions;
}

function frontierContext() {
  if (!fs.existsSync(frontierLedgerPath)) {
    return {
      ok: false,
      issues: [{ code: 'FRONTIER_LEDGER_REQUIRED', message: 'Canonical ledger is missing' }],
      actionable_ids: [],
    };
  }
  const ledger = readJsonFile(frontierLedgerPath);
  const expectedQuestions = expectedCatalogQuestions();
  const scenarioIds = Object.keys(expectedQuestions).filter((id) => !id.startsWith('OP-'));
  const pathExists = (relativePath) => fs.existsSync(path.join(root, relativePath));
  const knownCapabilities = readJsonFile(toolCatalogPath).map((tool) => tool.name);
  return {
    ...inspectFrontierLedger(ledger, {
      pathExists,
      expectedScenarioIds: scenarioIds,
      expectedOpportunityIds,
      expectedQuestions,
      knownCapabilities,
      expectedPolicyVersion: DISCOVERY_POLICY_VERSION,
    }),
    ledger,
    pathExists,
    expectedScenarioIds: scenarioIds,
    expectedOpportunityIds,
    expectedQuestions,
    knownCapabilities,
  };
}

function requireValidFrontier() {
  const frontier = frontierContext();
  if (!frontier.ok) {
    const [first] = frontier.issues;
    throw new HarnessInvariantError(first.code, first.message, first.details);
  }
  return frontier;
}

function commandHelp() {
  print(`BangumiAgentKit Harness V3.5

Usage: pnpm harness <command> [options]

  status --run <issue> [--pr <number>]
  frontier:check
  frontier:status
  discovery:check [--now <ISO timestamp>]
  run:start --title <title> [--profile AUTONOMOUS_EVOLUTION] [--outer-review-max 97]
  run:budget-extend --run <issue> --product-add <count> --reason <text>
  review:budget-extend --run <issue> --pr <number> --add <count> --reason <text>
  epoch:start --run <issue> --spec <json>
  epoch:open-pr --run <issue> --title <title>
  guard:legacy-paths [--base origin/master] [--product-epoch]
  candidate:check --pr <number> [--run <issue>] --evidence <json>
  review:reserve --run <issue> --pr <number> [--runtime-recovery]
  review:started --run <issue> --pr <number> --reviewer-id <id> [--runtime-recovery]
  review:reconcile --run <issue> --pr <number> [--definitely-not-started] [--runtime-recovery]
  review:runtime --run <issue> --pr <number> --reviewer-id <id> --runtime-state <ACTIVE|INTERRUPTED|UNAVAILABLE> [--reason <text>]
  review:wait --run <issue> --pr <number> --reviewer-id <id> --runtime-state ACTIVE
  review:result --run <issue> --pr <number> --verdict <verdict> [--findings <json>]
  epoch:g19-one-shot-claim --run <issue> --pr <number> --candidate <sha> --base <sha> --reviewer-id <id>
  epoch:g19-one-shot-result --run <issue> --pr <number> --claim-id <id> --state <INCONCLUSIVE|REPORT_WRITTEN>
  epoch:p05-one-shot-claim --run <issue> --pr <number> --candidate <sha> --base <sha> --reviewer-id <id>
  epoch:p05-one-shot-result --run <issue> --pr <number> --claim-id <id> --state <INCONCLUSIVE|REPORT_WRITTEN> [--artifact-sha256 <sha>]
  epoch:g04-one-shot-run --run <issue>
  epoch:g04-legacy-claim-reconcile --run <issue> --pr <number> --source-pr <number>
  epoch:g16-one-shot-run --run <issue>
  epoch:agent-mcp-profile-status --run <issue> --pr <number> --profile-id <id>
  epoch:agent-mcp-profile-reconcile-ambiguous --run <issue> --pr <number> --profile-id <id>
  epoch:agent-mcp-profile-claim --run <issue> --pr <number> --profile-id <id> --bundle-sha256 <sha> --reviewer-id <id> --runner-public-key <base64>
  epoch:agent-mcp-profile-result --run <issue> --pr <number> --profile-id <id> --claim-id <id> --state <INCONCLUSIVE|REPORT_WRITTEN> [--report-sha256 <sha>] [--diagnostics-json <allowlisted-json>]
  epoch:r01-one-shot-run --run <issue>
  epoch:r01-one-shot-reconcile --run <issue> --pr <number>
  epoch:g06-one-shot-run --run <issue>
  epoch:g06-one-shot-reconcile --run <issue> --pr <number>
  epoch:d07-one-shot-claim --run <issue> --pr <number> --candidate <sha> --base <sha> --claim-id <id> --reviewer-id <id> --bundle-sha256 <sha> --model gpt-6-luna --reasoning-effort max
  epoch:d07-one-shot-result --run <issue> --pr <number> --claim-id <id> --state <INCONCLUSIVE|REPORT_WRITTEN> [--report-sha256 <sha>]
  epoch:d07-one-shot-run --run <issue>
  epoch:d07-one-shot-reconcile --run <issue> --pr <number>
  epoch:p01-one-shot-run --run <issue>
  epoch:p01-one-shot-result --run <issue> --pr <number> --claim-id <id> --state <INCONCLUSIVE|REPORT_WRITTEN>
  frontier:review-reserve --run <issue> [--evidence <json>] [--runtime-recovery]
  frontier:review-started --run <issue> --reviewer-id <id> [--runtime-recovery]
  frontier:review-reconcile --run <issue> [--definitely-not-started] [--runtime-recovery]
  frontier:review-runtime --run <issue> --reviewer-id <id> --runtime-state <ACTIVE|INTERRUPTED|UNAVAILABLE> [--reason <text>]
  frontier:review-wait --run <issue> --reviewer-id <id> --runtime-state ACTIVE
  frontier:review-context --run <issue>
  frontier:review-result --run <issue> --verdict <PASS|DISCOVERY_REQUIRED> [--findings <json>]
  frontier:resume-discovery --run <issue>
  epoch:park --run <issue> --pr <number> --state <state> --reason <text>
  epoch:resume-final-corrective --run <issue> --pr <number>
  epoch:resume-integration --run <issue> --pr <number>
  epoch:merge --run <issue> --pr <number>
  run:stop --run <issue> --state <state> --next-action <text> [--evidence <json>]
  goal:check [--run <issue>] [--pr <number>] [--discovery-state UNCHANGED_EXHAUSTION]

Complex Epoch selection and Candidate evidence are supplied as local JSON input;
the durable source becomes the edited GitHub Issue/PR body.`);
}

function commandFrontierCheck() {
  const frontier = requireValidFrontier();
  print({
    state: 'FRONTIER_LEDGER_VALID',
    schema: frontier.ledger.schema,
    version: frontier.ledger.version,
    policy_version: frontier.ledger.policy_version,
    ledger_hash: frontier.hash,
    counts: frontier.counts,
    actionable_count: frontier.actionable_ids.length,
  });
}

function commandFrontierStatus() {
  const frontier = requireValidFrontier();
  print({
    state: frontier.actionable_ids.length
      ? 'FRONTIER_RESEARCH_REQUIRED'
      : 'FRONTIER_REVIEW_REQUIRED',
    ledger_hash: frontier.hash,
    counts: frontier.counts,
    next_candidates: frontier.records
      .filter((record) => frontier.actionable_ids.includes(record.id))
      .slice(0, 20)
      .map(({ id, status, lane, user_question, next_action }) => ({
        id,
        status,
        lane,
        user_question,
        next_action,
      })),
  });
}

function commandStatus(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const runResult = issueState(runNumber);
  const result = {
    git: { branch: currentBranch(), head: currentHead(), status: git('status', '--porcelain') },
    run: { number: runResult.view.number, url: runResult.view.url, state: runResult.state },
  };
  const prNumber = options.pr ?? runResult.state.active_epoch_pr;
  if (prNumber) {
    const epochResult = epochState(prNumber);
    result.epoch = {
      number: epochResult.view.number,
      url: epochResult.view.url,
      github_state: epochResult.view.state,
      pr_head_ref_name: epochResult.view.headRefName,
      state: epochResult.state,
      pr_head_sha: epochResult.view.headRefOid,
      pr_base_ref_name: epochResult.view.baseRefName,
      pr_base_sha: epochResult.view.baseRefOid,
      pr_is_draft: epochResult.view.isDraft,
    };
  }
  print(result);
}

function inspectDiscoveryCheck(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  if (currentBranch() !== 'master') {
    throw new HarnessInvariantError(
      'DISCOVERY_CHECK_MUST_RUN_ON_MASTER',
      'Discovery check runs only from master',
    );
  }
  const currentBaseSha = remoteBaseSha('master');
  if (currentHead() !== currentBaseSha) {
    throw new HarnessInvariantError(
      'MASTER_NOT_SYNCHRONIZED',
      'Discovery check requires master to equal origin/master',
    );
  }
  const openRuns = JSON.parse(
    gh(
      'issue',
      'list',
      '--state',
      'open',
      '--limit',
      '100',
      '--json',
      'number,title,body,state,url,createdAt,updatedAt,closedAt',
    ),
  ).filter((issue) => issue.body?.includes(`<!-- ${RUN_MARKER}:start -->`));
  const openEpochPrs = JSON.parse(
    gh(
      'pr',
      'list',
      '--state',
      'open',
      '--limit',
      '100',
      '--json',
      'number,title,body,state,url,createdAt,updatedAt',
    ),
  ).filter((pr) => pr.body?.includes(`<!-- ${EPOCH_MARKER}:start -->`));
  let latestClosedRun;
  if (openRuns.length === 0 && openEpochPrs.length === 0) {
    const closedRuns = JSON.parse(
      gh(
        'issue',
        'list',
        '--state',
        'closed',
        '--limit',
        '100',
        '--json',
        'number,title,body,state,url,createdAt,updatedAt,closedAt',
      ),
    )
      .filter((issue) => issue.body?.includes(`<!-- ${RUN_MARKER}:start -->`))
      .sort((left, right) =>
        String(right.closedAt ?? right.updatedAt).localeCompare(
          String(left.closedAt ?? left.updatedAt),
        ),
      );
    latestClosedRun = closedRuns[0];
  }
  const rawNow = options.now ?? process.env.HARNESS_NOW;
  const now = rawNow ? Date.parse(String(rawNow)) : Date.now();
  if (!Number.isFinite(now)) {
    throw new HarnessInvariantError('INVALID_TIMESTAMP', '--now must be a valid ISO timestamp');
  }
  const frontier = frontierContext();
  let latestRunState = latestClosedRun
    ? parseControlBlock(latestClosedRun.body, RUN_MARKER)
    : undefined;
  if (latestRunState?.discovery_exhaustion?.evidence_archive) {
    latestRunState = structuredClone(latestRunState);
    latestRunState.discovery_exhaustion = restoreEvidence(
      latestRunState.discovery_exhaustion.evidence_archive,
    );
  }
  const result = classifyDiscoveryCheck({
    openRunNumbers: openRuns.map((issue) => issue.number),
    openEpochPrNumbers: openEpochPrs.map((pr) => pr.number),
    latestRunState,
    currentBaseSha,
    frontier,
    now,
  });
  return {
    ...result,
    latest_closed_run_issue: latestClosedRun?.number ?? null,
    current_sha: currentBaseSha,
    ledger_hash: frontier.hash ?? null,
  };
}

function commandDiscoveryCheck(options) {
  print(inspectDiscoveryCheck(options));
}

function commandRunStart(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const branch = currentBranch();
  if (branch !== 'master') {
    throw new HarnessInvariantError('RUN_MUST_START_ON_MASTER', 'Outer runs start on master');
  }
  const local = currentHead();
  const remote = remoteBaseSha('master');
  if (local !== remote) {
    throw new HarnessInvariantError('MASTER_NOT_SYNCHRONIZED', 'master must equal origin/master', {
      local,
      remote,
    });
  }
  const openRuns = JSON.parse(
    gh(
      'issue',
      'list',
      '--state',
      'open',
      '--limit',
      '100',
      '--json',
      'number,title,body,state,url',
    ),
  )
    .filter((issue) => issue.body?.includes(`<!-- ${RUN_MARKER}:start -->`))
    .map((issue) => ({ ...issue, run: parseControlBlock(issue.body, RUN_MARKER) }));
  const terminalRuns = openRuns.filter((issue) => isTerminalRunState(issue.run.state));
  const resumableRuns = openRuns.filter((issue) => !isTerminalRunState(issue.run.state));
  if (resumableRuns.length > 1) {
    throw new HarnessInvariantError(
      'MULTIPLE_OPEN_OUTER_RUNS',
      'More than one resumable Outer Run exists; do not guess which control plane is authoritative',
      { issues: resumableRuns.map((issue) => issue.number) },
    );
  }
  if (resumableRuns.length === 1) {
    for (const issue of terminalRuns) {
      gh('issue', 'close', String(issue.number), '--reason', 'completed');
    }
    const existing = resumableRuns[0];
    const productIncrease = Math.max(
      0,
      DEFAULT_OUTER_PRODUCT_REVIEW_SLOTS - existing.run.outer_sol.product.max,
    );
    const resumedRun = productIncrease
      ? extendRunProductReviewBudget(existing.run, {
          additional: productIncrease,
          reason: 'GPT-6 Luna Max policy upgrade while resuming this active Run',
        })
      : existing.run;
    if (productIncrease) updateIssue(existing.number, resumedRun);
    print({
      state: 'RUN_RESUMED',
      url: existing.url,
      issue: existing.number,
      budget_upgraded: productIncrease > 0,
      run: resumedRun,
    });
    return;
  }
  const title = required(options, 'title').replace(/^(?:\[Harness V3 Run\]\s*)+/u, '');
  for (const issue of terminalRuns) {
    gh('issue', 'close', String(issue.number), '--reason', 'completed');
  }
  const runId = options['run-id'] ?? `run-${new Date().toISOString().replaceAll(/[:.]/gu, '-')}`;
  const state = createRunState({
    runId,
    profile: options.profile ?? 'AUTONOMOUS_EVOLUTION',
    outerSolMax: Number(
      options['outer-review-max'] ?? options['outer-sol-max'] ?? DEFAULT_OUTER_REVIEW_SLOTS,
    ),
  });
  const url = gh('issue', 'create', '--title', `[Harness V3 Run] ${title}`, '--body-file', '-', {
    input: renderRunBody(state),
  });
  print({ state: 'RUN_STARTED', url, run: state });
}

function commandRunBudgetExtend(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const additional = Number(required(options, 'product-add'));
  const reason = required(options, 'reason');
  const runResult = issueState(runNumber);
  if (
    runResult.view.state === 'CLOSED' &&
    runResult.state.state !== 'STOPPED_RUN_BUDGET_EXHAUSTED_RESUMABLE'
  ) {
    throw new HarnessInvariantError(
      'RUN_NOT_RESUMABLE',
      'Only a budget-stopped resumable Run may be reopened by this command',
    );
  }
  const updated = extendRunProductReviewBudget(runResult.state, {
    additional,
    reason,
    at: new Date().toISOString(),
  });
  const needsReopen =
    runResult.view.state === 'CLOSED' &&
    runResult.state.state === 'STOPPED_RUN_BUDGET_EXHAUSTED_RESUMABLE';
  if (needsReopen) gh('issue', 'reopen', String(runNumber));
  updateIssue(runNumber, updated);
  print({
    state: 'RUN_BUDGET_EXTENDED',
    issue: runResult.view.number,
    url: runResult.view.url,
    product_review_budget: updated.outer_sol.product,
    total_review_budget: updated.outer_sol,
  });
}

function commandEpochReviewBudgetExtend(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const additional = Number(required(options, 'add'));
  const reason = required(options, 'reason');
  const runResult = issueState(runNumber);
  if (String(runResult.state.active_epoch_pr) !== prNumber) {
    throw new HarnessInvariantError(
      'ACTIVE_EPOCH_MISMATCH',
      'Epoch review budget can be extended only for the active Epoch in this Run',
      { active_epoch_pr: runResult.state.active_epoch_pr, requested_pr: prNumber },
    );
  }
  const epochResult = epochState(prNumber);
  if (epochResult.view.state !== 'OPEN') {
    throw new HarnessInvariantError(
      'EPOCH_NOT_OPEN',
      'Only an open Epoch PR can receive more review slots',
    );
  }
  let updated = extendEpochReviewBudget(epochResult.state, {
    additional,
    reason,
    at: new Date().toISOString(),
  });
  let updatedRun = runResult.state;
  let resumedCorrective = false;
  if (
    updated.state === 'FINAL_CORRECTIVE_REQUIRED' &&
    updated.final_corrective_reason === 'REVIEW_LIMIT_FINDINGS'
  ) {
    const resumed = resumeCorrectiveAfterReviewBudgetExtension(runResult.state, updated);
    updated = resumed.epoch;
    updatedRun = resumed.run;
    resumedCorrective = true;
  }
  updatePr(prNumber, updated);
  if (resumedCorrective) updateIssue(runNumber, updatedRun);
  print({
    state: 'EPOCH_REVIEW_BUDGET_EXTENDED',
    issue: runResult.view.number,
    pr: epochResult.view.number,
    url: epochResult.view.url,
    review_budget: updated.review,
    epoch_state: updated.state,
    resumed_corrective: resumedCorrective,
  });
}

function commandEpochStart(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  const spec = readJsonFile(required(options, 'spec'));
  const runResult = issueState(runNumber);
  assertRunCanStartEpoch(runResult.state);
  const frontier = requireValidFrontier();
  const frontierIds = spec.advances_frontier_ids;
  if (!Array.isArray(frontierIds) || frontierIds.length === 0) {
    throw new HarnessInvariantError(
      'EPOCH_FRONTIER_REQUIRED',
      'A Product Epoch must advance at least one canonical frontier id',
    );
  }
  if (new Set(frontierIds).size !== frontierIds.length) {
    throw new HarnessInvariantError(
      'EPOCH_FRONTIER_INVALID',
      'advances_frontier_ids must not contain duplicates',
    );
  }
  const frontierById = new Map(frontier.records.map((record) => [record.id, record]));
  for (const id of frontierIds) {
    if (!frontier.actionable_ids.includes(id)) {
      throw new HarnessInvariantError(
        'EPOCH_FRONTIER_INVALID',
        `Epoch frontier ${id} is missing or already closed`,
      );
    }
  }
  if (!Array.isArray(spec.non_scope) || spec.non_scope.length === 0) {
    throw new HarnessInvariantError(
      'EPOCH_NON_SCOPE_UNMAPPED',
      'A Product Epoch must record at least one explicit mapped non-scope item',
    );
  }
  for (const [index, item] of spec.non_scope.entries()) {
    const mapping = item?.mapping;
    const valid =
      typeof item?.description === 'string' &&
      ((mapping?.kind === 'frontier' && frontierById.has(mapping.id)) ||
        (mapping?.kind === 'boundary' &&
          frontier.ledger.protected_boundaries.some((boundary) => boundary.id === mapping.id)) ||
        (mapping?.kind === 'non_product' && typeof mapping.reason === 'string'));
    if (!valid) {
      throw new HarnessInvariantError(
        'EPOCH_NON_SCOPE_UNMAPPED',
        `non_scope[${index}] must map to a frontier, Charter boundary, or non-product reason`,
      );
    }
  }
  const baseBranch = spec.base_branch ?? 'master';
  const baseSha = remoteBaseSha(baseBranch);
  if (currentBranch() !== baseBranch || currentHead() !== baseSha) {
    throw new HarnessInvariantError(
      'BASE_NOT_SYNCHRONIZED',
      `Epoch selection must start from synchronized ${baseBranch}`,
      { branch: currentBranch(), head: currentHead(), remote: baseSha },
    );
  }
  const selectedEpoch = createEpochState({
    epochId: spec.epoch_id,
    baseSha,
    baseBranch,
    objective: spec.objective,
    questions: spec.questions,
    workPackages: spec.work_packages,
    nonScope: spec.non_scope,
    advancesFrontierIds: frontierIds,
    acceptanceCriteria: spec.acceptance_criteria,
  });
  const epoch = extendEpochReviewBudget(selectedEpoch, {
    additional: DEFAULT_EPOCH_REVIEW_SLOTS - selectedEpoch.review.max,
    reason: 'GPT-6 Luna Max long-goal default policy',
    at: new Date().toISOString(),
  });
  const nextRun = structuredClone(runResult.state);
  nextRun.pending_epoch = epoch;
  nextRun.state = 'EPOCH_SELECTED_AWAITING_FIRST_COMMIT';
  nextRun.next_action = `CREATE_BRANCH_codex/epoch-${epoch.epoch_id}`;
  updateIssue(runNumber, nextRun);
  print({ state: nextRun.state, epoch });
}

function commandEpochOpenPr(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  const title = required(options, 'title');
  const runResult = issueState(runNumber);
  const epoch = runResult.state.pending_epoch;
  if (!epoch) throw new HarnessInvariantError('NO_PENDING_EPOCH', 'Select the Epoch first');
  const branch = currentBranch();
  if (!/^codex\/epoch[-/]/u.test(branch)) {
    throw new HarnessInvariantError(
      'INVALID_EPOCH_BRANCH',
      'V3 Product branches must use codex/epoch-... or codex/epoch/...',
    );
  }
  const commitCount = Number(git('rev-list', '--count', `${epoch.base_sha}..HEAD`));
  if (commitCount < 1) {
    throw new HarnessInvariantError(
      'MEANINGFUL_COMMIT_REQUIRED',
      'Open the Draft PR only after the first meaningful engineering commit',
    );
  }
  assertNoLegacyRuntimeChanges(changedPaths(epoch.base_sha));
  assertProductCommitHygiene(commitSubjects(epoch.base_sha));
  epoch.branch = branch;
  epoch.state = 'IMPLEMENTING';
  epoch.next_action = 'CONTINUE_WORK_PACKAGES';
  git('push', '--set-upstream', 'origin', branch);
  const url = gh(
    'pr',
    'create',
    '--draft',
    '--base',
    epoch.base_branch,
    '--head',
    branch,
    '--title',
    title,
    '--body-file',
    '-',
    { input: renderEpochBody(epoch) },
  );
  const pr = JSON.parse(gh('pr', 'view', url, '--json', 'number,body,url'));
  epoch.pr_number = pr.number;
  updatePr(pr.number, epoch);
  const nextRun = structuredClone(runResult.state);
  nextRun.pending_epoch = null;
  nextRun.active_epoch_pr = pr.number;
  nextRun.state = 'EPOCH_ACTIVE';
  nextRun.next_action = `RESUME_PR_${pr.number}`;
  updateIssue(runNumber, nextRun);
  print({ state: 'EPOCH_PR_OPEN', pr: pr.number, url });
}

function commandGuard(options) {
  if (!isProductEpoch(options)) {
    print({ state: 'NOT_A_V3_PRODUCT_EPOCH', checked: false });
    return;
  }
  const base = options.base ?? process.env.HARNESS_BASE_REF ?? 'origin/master';
  const head = process.env.HARNESS_HEAD_REF ?? 'HEAD';
  assertNoLegacyRuntimeChanges(changedPaths(base, head));
  assertProductCommitHygiene(commitSubjects(base, head));
  print({ state: 'LEGACY_RUNTIME_PATH_GUARD_PASS', base, head });
}

function commandCandidateCheck(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const prNumber = required(options, 'pr');
  const evidence = readJsonFile(required(options, 'evidence'));
  const epochResult = epochState(prNumber);
  let epoch = structuredClone(epochResult.state);
  const refreshingPassedCandidate = epoch.state === 'REVIEW_PASSED';
  const needsReconciledPostPassReassessment =
    epoch.state === 'REVIEW_RESERVATION_RECONCILED' && (epoch.review?.consumed ?? 0) > 0;
  let reconciledPostPassRefresh = false;
  let reassessmentRunState = null;
  if (needsReconciledPostPassReassessment) {
    if (!options.run) {
      throw new HarnessInvariantError(
        'REVIEW_REASSESSMENT_RUN_REQUIRED',
        'A post-PASS reconciled Candidate reassessment requires --run for paired-ledger validation',
      );
    }
    const reassessmentRun = issueState(required(options, 'run'));
    if (
      reassessmentRun.view.state !== 'OPEN' ||
      !isReconciledPostPassCandidateRefresh(reassessmentRun.state, epoch)
    ) {
      throw new HarnessInvariantError(
        'INVALID_CANDIDATE_STATE',
        'A consumed reconciled state can resume only when it is an exact post-PASS Candidate refresh with no unmatched review launch or reservation',
      );
    }
    reassessmentRunState = reassessmentRun.state;
    const reassessmentReason = evidence.review_reassessment_reason;
    if (
      typeof reassessmentReason !== 'string' ||
      reassessmentReason.trim().length < 12 ||
      reassessmentReason.trim().length > 500
    ) {
      throw new HarnessInvariantError(
        'REVIEW_REASSESSMENT_REASON_REQUIRED',
        'review_reassessment_reason must contain 12 to 500 non-whitespace characters',
      );
    }
    reconciledPostPassRefresh = true;
  }
  const reconciledWithoutLaunch =
    epoch.state === 'REVIEW_RESERVATION_RECONCILED' &&
    epoch.review?.consumed === 0 &&
    epoch.review?.reserved === 0;
  if (
    ![
      'IMPLEMENTING',
      'REVIEW_READY',
      'CORRECTIVE_REQUIRED',
      'PASS_INVALIDATED_BASE_DRIFT',
      'FINAL_CORRECTIVE_REQUIRED',
      'FINAL_CORRECTIVE_READY',
      ...(refreshingPassedCandidate ? ['REVIEW_PASSED'] : []),
      ...(reconciledPostPassRefresh ? ['REVIEW_RESERVATION_RECONCILED'] : []),
    ].includes(epoch.state) &&
    !reconciledWithoutLaunch
  ) {
    throw new HarnessInvariantError(
      'INVALID_CANDIDATE_STATE',
      `Epoch state ${epoch.state} cannot establish a Candidate`,
    );
  }
  const finalCorrective =
    epoch.state === 'FINAL_CORRECTIVE_REQUIRED' || epoch.state === 'FINAL_CORRECTIVE_READY';
  git('fetch', 'origin', epoch.base_branch, epoch.branch);
  const head = currentHead();
  if (currentBranch() !== epoch.branch) {
    throw new HarnessInvariantError('WRONG_EPOCH_BRANCH', `Checkout ${epoch.branch} first`);
  }
  const baseSha = git('rev-parse', `origin/${epoch.base_branch}`);
  if (evidence.base_sha !== baseSha || evidence.candidate_sha !== head) {
    throw new HarnessInvariantError(
      'FRESH_CANDIDATE_EVIDENCE_REQUIRED',
      'Evidence must name the current target base and exact branch HEAD Candidate',
      {
        evidenceBaseSha: evidence.base_sha,
        currentBaseSha: baseSha,
        evidenceCandidateSha: evidence.candidate_sha,
        currentHeadSha: head,
      },
    );
  }
  if (reconciledPostPassRefresh) {
    const lastReviewCandidateSha = epochResult.state.review_history.at(-1)?.candidate_sha;
    if (
      !isAncestor(lastReviewCandidateSha, head) ||
      !isAncestor(epochResult.state.candidate_sha, head)
    ) {
      throw new HarnessInvariantError(
        'REVIEW_REASSESSMENT_NOT_DESCENDANT',
        'A reassessed Candidate must preserve both the passed Candidate and the currently recorded post-PASS refresh in its history',
      );
    }
  }
  assertAgentMcpProfileReportCandidateRefresh(epoch, head);
  if (refreshingPassedCandidate) {
    if (epoch.review_pass_sha !== epoch.candidate_sha) {
      throw new HarnessInvariantError(
        'PASSED_CANDIDATE_AUTHORITY_INVALID',
        'The stored PASS does not authorize the currently recorded Candidate',
      );
    }
    if (head === epoch.review_pass_sha) {
      throw new HarnessInvariantError(
        'PASSED_CANDIDATE_UNCHANGED',
        'The passed Candidate is unchanged; no refresh is needed or allowed',
      );
    }
    if (!isAncestor(epoch.review_pass_sha, head)) {
      throw new HarnessInvariantError(
        'PASSED_CANDIDATE_NOT_ANCESTOR',
        'A refreshed Candidate must preserve the exact passed Candidate in its history',
      );
    }
    epoch = refreshPassedCandidate(epoch, {
      candidateSha: head,
      baseSha,
      reason: evidence.candidate_refresh_reason,
    });
  } else {
    epoch.candidate_sha = head;
  }
  const priorG19Disposition = epoch.adversarial_preflight?.g19_one_shot_disposition;
  const nextG19Disposition = evidence.adversarial_preflight?.g19_one_shot_disposition;
  if (
    priorG19Disposition !== undefined &&
    (nextG19Disposition === undefined ||
      canonicalHash(priorG19Disposition) !== canonicalHash(nextG19Disposition))
  ) {
    throw new HarnessInvariantError(
      'G19_ONESHOT_DISPOSITION_IMMUTABLE',
      'A durable G19 one-shot disposition must be preserved across Candidate refreshes',
    );
  }
  const priorP05Disposition = epoch.adversarial_preflight?.p05_one_shot_disposition;
  const nextP05Disposition = evidence.adversarial_preflight?.p05_one_shot_disposition;
  if (
    (priorP05Disposition === undefined) !== (nextP05Disposition === undefined) ||
    (priorP05Disposition !== undefined &&
      canonicalHash(priorP05Disposition) !== canonicalHash(nextP05Disposition))
  ) {
    throw new HarnessInvariantError(
      'P05_ONESHOT_DISPOSITION_IMMUTABLE',
      'A durable P05 one-shot claim and terminal result must be preserved exactly across Candidate refreshes',
    );
  }
  const priorP01Disposition = epoch.adversarial_preflight?.p01_one_shot_disposition;
  const nextP01Disposition = evidence.adversarial_preflight?.p01_one_shot_disposition;
  if (
    (priorP01Disposition === undefined) !== (nextP01Disposition === undefined) ||
    (priorP01Disposition !== undefined &&
      canonicalHash(priorP01Disposition) !== canonicalHash(nextP01Disposition))
  ) {
    throw new HarnessInvariantError(
      'P01_ONESHOT_DISPOSITION_IMMUTABLE',
      'A durable P01 one-shot disposition must be preserved exactly across Candidate refreshes',
    );
  }
  const priorG04Disposition = epoch.adversarial_preflight?.g04_one_shot_disposition;
  const nextG04Disposition = evidence.adversarial_preflight?.g04_one_shot_disposition;
  if (
    (priorG04Disposition === undefined) !== (nextG04Disposition === undefined) ||
    (priorG04Disposition !== undefined &&
      canonicalHash(priorG04Disposition) !== canonicalHash(nextG04Disposition))
  ) {
    throw new HarnessInvariantError(
      'G04_ONESHOT_DISPOSITION_IMMUTABLE',
      'A durable G04 one-shot disposition must be preserved exactly across Candidate refreshes',
    );
  }
  const priorG04LegacyReconciliation = epoch.adversarial_preflight?.g04_legacy_claim_reconciliation;
  const nextG04LegacyReconciliation =
    evidence.adversarial_preflight?.g04_legacy_claim_reconciliation;
  if (
    (priorG04LegacyReconciliation === undefined) !== (nextG04LegacyReconciliation === undefined) ||
    (priorG04LegacyReconciliation !== undefined &&
      canonicalHash(priorG04LegacyReconciliation) !== canonicalHash(nextG04LegacyReconciliation))
  ) {
    throw new HarnessInvariantError(
      'G04_LEGACY_RECONCILIATION_IMMUTABLE',
      'A verified G04 legacy terminal reconciliation must be preserved exactly across Candidate refreshes',
    );
  }
  const priorG16Disposition = epoch.adversarial_preflight?.g16_one_shot_disposition;
  const nextG16Disposition = evidence.adversarial_preflight?.g16_one_shot_disposition;
  if (
    (priorG16Disposition === undefined) !== (nextG16Disposition === undefined) ||
    (priorG16Disposition !== undefined &&
      canonicalHash(priorG16Disposition) !== canonicalHash(nextG16Disposition))
  ) {
    throw new HarnessInvariantError(
      'G16_ONESHOT_DISPOSITION_IMMUTABLE',
      'A durable G16 one-shot disposition must be preserved exactly across Candidate refreshes',
    );
  }
  const priorR01Disposition = epoch.adversarial_preflight?.r01_one_shot_disposition;
  const nextR01Disposition = evidence.adversarial_preflight?.r01_one_shot_disposition;
  if (
    (priorR01Disposition === undefined) !== (nextR01Disposition === undefined) ||
    (priorR01Disposition !== undefined &&
      canonicalHash(priorR01Disposition) !== canonicalHash(nextR01Disposition))
  ) {
    throw new HarnessInvariantError(
      'R01_ONESHOT_DISPOSITION_IMMUTABLE',
      'A durable R01 one-shot disposition must be preserved exactly across Candidate refreshes',
    );
  }
  const priorG06Disposition = epoch.adversarial_preflight?.g06_one_shot_disposition;
  const nextG06Disposition = evidence.adversarial_preflight?.g06_one_shot_disposition;
  if (
    (priorG06Disposition === undefined) !== (nextG06Disposition === undefined) ||
    (priorG06Disposition !== undefined &&
      canonicalHash(priorG06Disposition) !== canonicalHash(nextG06Disposition))
  ) {
    throw new HarnessInvariantError(
      'G06_ONESHOT_DISPOSITION_IMMUTABLE',
      'A durable G06 one-shot disposition must be preserved exactly across Candidate refreshes',
    );
  }
  const priorD07Disposition = epoch.adversarial_preflight?.d07_one_shot_disposition;
  const nextD07Disposition = evidence.adversarial_preflight?.d07_one_shot_disposition;
  if (
    (priorD07Disposition === undefined) !== (nextD07Disposition === undefined) ||
    (priorD07Disposition !== undefined &&
      canonicalHash(priorD07Disposition) !== canonicalHash(nextD07Disposition))
  ) {
    throw new HarnessInvariantError(
      'D07_ONESHOT_DISPOSITION_IMMUTABLE',
      'A durable D07 one-shot disposition must be preserved exactly across Candidate refreshes',
    );
  }
  const priorProfileDispositions = epoch.adversarial_preflight?.agent_mcp_profile_dispositions;
  const nextProfileDispositions = evidence.adversarial_preflight?.agent_mcp_profile_dispositions;
  if (
    (priorProfileDispositions === undefined) !== (nextProfileDispositions === undefined) ||
    (priorProfileDispositions !== undefined &&
      canonicalHash(priorProfileDispositions) !== canonicalHash(nextProfileDispositions))
  ) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_DISPOSITION_IMMUTABLE',
      'Durable Agent/MCP profile claims and terminal results must be preserved exactly across Candidate refreshes',
    );
  }
  epoch.validation = evidence.validation ?? epoch.validation;
  epoch.scope_closure = evidence.scope_closure;
  epoch.adversarial_preflight = evidence.adversarial_preflight;
  epoch.corrective_closure = evidence.corrective_closure ?? [];
  const checksOk = mandatoryChecksSuccessful(epochResult.view.statusCheckRollup);
  const ciUrl = evidence.ci?.url ?? epochResult.view.url;
  const exactCiProfiles = listAgentMcpProfiles().filter(
    (profile) =>
      profile.epochId === epoch.epoch_id && profileRequiresExactCiRunEvidence(profile.id),
  );
  if (
    checksOk &&
    exactCiProfiles.length > 0 &&
    !deriveP06CiRunEvidence(ciUrl, epochResult.view.statusCheckRollup)
  ) {
    throw new HarnessInvariantError(
      'CANDIDATE_EXACT_CI_RUN_EVIDENCE_REQUIRED',
      'This one-shot profile Candidate must name the exact GitHub Actions run URL shared by all seven successful checks.',
      { epochId: epoch.epoch_id, profileIds: exactCiProfiles.map((profile) => profile.id) },
    );
  }
  epoch.ci = {
    sha: epochResult.view.headRefOid,
    status: checksOk ? 'SUCCESS' : 'FAILED_OR_PENDING',
    url: ciUrl,
  };
  if (epoch.base_sha !== baseSha) {
    if (!isAncestor(baseSha, head)) {
      throw new HarnessInvariantError(
        'BASE_DRIFT_BEFORE_REVIEW',
        'Synchronize the current target base, validate, and establish a new Candidate',
        { recordedBaseSha: epoch.base_sha, currentBaseSha: baseSha },
      );
    }
    epoch.base_sha = baseSha;
  }
  const candidatePaths = changedPaths(epoch.base_sha);
  if (
    (epoch.advances_frontier_ids?.length ?? 0) > 0 &&
    !candidatePaths.includes('docs/product/frontier-ledger.json')
  ) {
    throw new HarnessInvariantError(
      'FRONTIER_LEDGER_UPDATE_REQUIRED',
      'A Product Epoch must update the canonical records it advances',
    );
  }
  if ((epoch.advances_frontier_ids?.length ?? 0) > 0) {
    const baseLedger = JSON.parse(
      git('show', `${epoch.base_sha}:docs/product/frontier-ledger.json`),
    );
    const currentLedger = requireValidFrontier().ledger;
    const baseById = new Map(baseLedger.records.map((record) => [record.id, record]));
    const currentById = new Map(currentLedger.records.map((record) => [record.id, record]));
    const unchanged = epoch.advances_frontier_ids.filter(
      (id) => canonicalHash(baseById.get(id)) === canonicalHash(currentById.get(id)),
    );
    if (unchanged.length > 0) {
      throw new HarnessInvariantError(
        'FRONTIER_RECORD_NOT_ADVANCED',
        'Every declared frontier id must receive a material ledger update',
        { unchanged },
      );
    }
  }
  if (
    candidatePaths.includes('docs/product/frontier-ledger.json') &&
    !candidatePaths.some((file) => /^(?:apps|packages|tests)\//u.test(file))
  ) {
    throw new HarnessInvariantError(
      'FRONTIER_STATUS_ONLY_CHANGE',
      'Frontier ledger transitions require durable implementation or test evidence',
    );
  }
  assertProductCommitHygiene(commitSubjects(epoch.base_sha));
  assertReviewReadiness({
    epoch,
    changedPaths: candidatePaths,
    branchHeadSha: head,
    prHeadSha: epochResult.view.headRefOid,
    currentBaseSha: baseSha,
  });
  if (reconciledPostPassRefresh) {
    epoch = recordReconciledPostPassCandidateReassessment(
      reassessmentRunState,
      epochResult.state,
      epoch,
      {
        candidateSha: head,
        baseSha,
        reason: evidence.review_reassessment_reason,
      },
    );
  } else if (finalCorrective) {
    epoch.state = 'FINAL_CORRECTIVE_READY';
    epoch.final_corrective_sha = head;
    epoch.final_corrective_base_sha = baseSha;
    epoch.next_action = 'AUTO_MERGE_AFTER_FINAL_CORRECTIVE';
  } else {
    epoch.state = 'REVIEW_READY';
    epoch.next_action = `RESERVE_REVIEWER_${epoch.review.consumed + 1}`;
  }
  if (epochResult.view.isDraft) gh('pr', 'ready', String(prNumber));
  updatePr(prNumber, epoch);
  print({
    state: epoch.state,
    candidate_sha: head,
    base_sha: baseSha,
    review_reassessment: reconciledPostPassRefresh,
  });
}

function commandReviewReserve(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  if (currentBranch() !== epochResult.state.branch) {
    throw new HarnessInvariantError(
      'WRONG_EPOCH_BRANCH',
      `Checkout ${epochResult.state.branch} before review reservation`,
    );
  }
  assertProductCommitHygiene(commitSubjects(epochResult.state.base_sha));
  assertReviewReadiness({
    epoch: epochResult.state,
    changedPaths: changedPaths(epochResult.state.base_sha),
    branchHeadSha: currentHead(),
    prHeadSha: epochResult.view.headRefOid,
    currentBaseSha: remoteBaseSha(epochResult.state.base_branch),
  });
  const runtimeRecovery = options['runtime-recovery'] === true;
  const reserved = reserveReview(runResult.state, epochResult.state, { runtimeRecovery });
  const reservationId = `review-${Date.now()}`;
  const reservationKey = runtimeRecovery ? 'runtime_recovery_reservation_id' : 'reservation_id';
  reserved.run.outer_sol[reservationKey] = reservationId;
  reserved.epoch.review[reservationKey] = reservationId;
  updatePr(prNumber, reserved.epoch);
  updateIssue(runNumber, reserved.run);
  print({
    state: runtimeRecovery ? 'REVIEW_RUNTIME_RECOVERY_RESERVED' : 'REVIEW_RESERVED',
    reservation_id: reservationId,
  });
}

function commandReviewStarted(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const reviewerId = required(options, 'reviewer-id');
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const runtimeRecovery = options['runtime-recovery'] === true;
  const reservationKey = runtimeRecovery ? 'runtime_recovery_reservation_id' : 'reservation_id';
  const runReservationId = runResult.state.outer_sol[reservationKey];
  const epochReservationId = epochResult.state.review[reservationKey];
  if (
    typeof runReservationId !== 'string' ||
    runReservationId.length === 0 ||
    runReservationId !== epochReservationId
  ) {
    throw new HarnessInvariantError(
      'REVIEW_RESERVATION_MISMATCH',
      'Run and Epoch review reservations must name the same launch',
    );
  }
  const started = markReviewStarted(runResult.state, epochResult.state, reviewerId, {
    runtimeRecovery,
  });
  delete started.run.outer_sol[reservationKey];
  delete started.epoch.review[reservationKey];
  updatePr(prNumber, started.epoch);
  updateIssue(runNumber, started.run);
  print({ state: 'REVIEW_RUNNING', reviewer_id: reviewerId });
}

function commandReviewReconcile(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const reconciled = reconcileReviewReservation(
    runResult.state,
    epochResult.state,
    options['definitely-not-started'] === true,
    { runtimeRecovery: options['runtime-recovery'] === true },
  );
  const reservationKey =
    options['runtime-recovery'] === true ? 'runtime_recovery_reservation_id' : 'reservation_id';
  delete reconciled.run.outer_sol[reservationKey];
  delete reconciled.epoch.review[reservationKey];
  updatePr(prNumber, reconciled.epoch);
  updateIssue(runNumber, reconciled.run);
  print({
    state: 'REVIEW_RESERVATION_RECONCILED',
    counted_as_consumed: options['definitely-not-started'] !== true,
  });
}

function commandReviewWait(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const reviewerId = required(options, 'reviewer-id');
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const runtimeState = options['runtime-state'];
  if (runtimeState && runtimeState !== 'ACTIVE') {
    throw new HarnessInvariantError(
      'REVIEW_RUNTIME_STATE_INVALID',
      'review:wait is a compatibility entry point for an observed ACTIVE runtime only',
    );
  }
  const result = waitForSameReviewer(runResult.state, epochResult.state, reviewerId, runtimeState);
  print({
    state: 'WAIT_TIMEOUT_REVIEWER_STILL_RUNNING',
    reviewer_id: reviewerId,
    durable_write: result.durableWrite,
    git_mutations: result.gitMutations,
    launches: result.launches,
  });
}

function commandReviewRuntime(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const reviewerId = required(options, 'reviewer-id');
  const runtimeState = required(options, 'runtime-state');
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const result = waitForSameReviewer(
    runResult.state,
    epochResult.state,
    reviewerId,
    runtimeState,
    options.reason,
  );
  if (result.durableWrite) {
    updatePr(prNumber, result.epoch);
    updateIssue(runNumber, result.run);
  }
  print({
    state: result.epoch.state,
    runtime_state: runtimeState,
    reviewer_id: reviewerId,
    durable_write: result.durableWrite,
    git_mutations: result.gitMutations,
    launches: result.launches,
  });
}

function commandReviewResult(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const verdict = required(options, 'verdict');
  const findings = options.findings ? readJsonFile(options.findings) : [];
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  if (verdict === 'PASS') {
    const branch = epochResult.state.branch;
    git('fetch', '--no-tags', 'origin', `refs/heads/${branch}:refs/remotes/origin/${branch}`);
    assertCandidateInvariant({
      candidateSha: epochResult.state.candidate_sha,
      branchHeadSha: git('rev-parse', `origin/${branch}`),
      prHeadSha: epochResult.view.headRefOid,
    });
  }
  const result = applyReviewResult(runResult.state, epochResult.state, { verdict, findings });
  if (
    verdict === 'PASS' &&
    result.epoch.epoch_id === G06_EPOCH_ID &&
    !Object.hasOwn(result.epoch.adversarial_preflight ?? {}, 'g06_one_shot_disposition')
  ) {
    result.epoch.next_action = 'RUN_G06_ONE_SHOT_AND_RECONCILE_BEFORE_MERGE';
    result.run.next_action = 'RUN_G06_ONE_SHOT_BEFORE_MERGE';
  }
  if (
    verdict === 'PASS' &&
    result.epoch.epoch_id === D07_EPOCH_ID &&
    !Object.hasOwn(result.epoch.adversarial_preflight ?? {}, 'd07_one_shot_disposition')
  ) {
    result.epoch.next_action = 'RUN_D07_ONE_SHOT_AND_RECONCILE_BEFORE_MERGE';
    result.run.next_action = 'RUN_D07_ONE_SHOT_BEFORE_MERGE';
  }
  updatePr(prNumber, result.epoch);
  updateIssue(runNumber, result.run);
  print({ state: result.epoch.state, outer_state: result.run.state });
}

function assertG19OneShotClaimReadiness({
  run,
  epoch,
  pr,
  runNumber,
  prNumber,
  candidateSha,
  baseSha,
  reviewerId,
}) {
  const currentBaseSha = remoteBaseSha(epoch.base_branch);
  const latestReview = epoch.review_history?.at(-1);
  const reviewerPattern = new RegExp(`^gpt-6-luna-max-run95-pr${prNumber}-round\\d+$`, 'u');
  const preflight = epoch.adversarial_preflight ?? {};
  if (
    run.state !== 'EPOCH_ACTIVE' ||
    run.active_epoch_pr !== Number(prNumber) ||
    run.pending_epoch != null ||
    run.profile !== 'AUTONOMOUS_EVOLUTION' ||
    epoch.state !== 'REVIEW_PASSED' ||
    epoch.epoch_id !== 'run95-g19-person-origin-agent-mcp-evidence' ||
    epoch.pr_number !== Number(prNumber) ||
    !epoch.advances_frontier_ids?.includes('G19') ||
    Object.hasOwn(preflight, 'g19_one_shot_disposition') ||
    epoch.branch !== currentBranch() ||
    currentHead() !== candidateSha ||
    pr.state !== 'OPEN' ||
    pr.isDraft ||
    pr.baseRefName !== 'master' ||
    pr.headRefName !== epoch.branch ||
    pr.headRefOid !== candidateSha ||
    epoch.base_branch !== 'master' ||
    epoch.base_sha !== baseSha ||
    epoch.reviewed_base_sha !== baseSha ||
    currentBaseSha !== baseSha ||
    epoch.candidate_sha !== candidateSha ||
    epoch.review_pass_sha !== candidateSha ||
    epoch.ci?.sha !== candidateSha ||
    epoch.ci?.status !== 'SUCCESS' ||
    !mandatoryChecksSuccessful(pr.statusCheckRollup) ||
    latestReview?.candidate_sha !== candidateSha ||
    latestReview.reviewed_base_sha !== baseSha ||
    latestReview.verdict !== 'PASS' ||
    latestReview.reviewer_id !== reviewerId ||
    !reviewerPattern.test(reviewerId)
  ) {
    throw new HarnessInvariantError(
      'G19_ONESHOT_CLAIM_GATE_FAILED',
      'G19 one-shot claim requires the clean active exact Candidate, current Base, seven-check CI, and latest exact-identity Luna Max PASS.',
      { runNumber, prNumber, candidateSha, baseSha },
    );
  }
}

function commandEpochG19OneShotClaim(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const candidateSha = required(options, 'candidate');
  const baseSha = required(options, 'base');
  const reviewerId = required(options, 'reviewer-id');
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  if (Object.hasOwn(epochResult.state.adversarial_preflight ?? {}, 'g19_one_shot_disposition')) {
    throw new HarnessInvariantError(
      'G19_ONESHOT_ALREADY_CLAIMED',
      'A durable G19 one-shot claim or result already exists; refusing a duplicate claim.',
    );
  }
  assertG19OneShotClaimReadiness({
    run: runResult.state,
    epoch: epochResult.state,
    pr: epochResult.view,
    runNumber,
    prNumber,
    candidateSha,
    baseSha,
    reviewerId,
  });
  const claimedAt = new Date().toISOString();
  const claimId = `g19-run-${runNumber}-pr-${prNumber}-${candidateSha.slice(0, 12)}-${Date.now()}`;
  const nextEpoch = structuredClone(epochResult.state);
  nextEpoch.adversarial_preflight = {
    ...nextEpoch.adversarial_preflight,
    g19_one_shot_disposition: {
      claimId,
      frontierId: 'G19',
      state: 'CLAIMED',
      sourceCandidateSha: candidateSha,
      baseSha,
      prNumber: Number(prNumber),
      reviewerId,
      reportWritten: false,
      retryAllowed: false,
      claimedAt,
    },
  };
  updatePr(prNumber, nextEpoch);
  print({
    state: 'G19_ONE_SHOT_CLAIMED',
    claimId,
    candidateSha,
    baseSha,
    prNumber: Number(prNumber),
  });
}

function commandEpochG19OneShotResult(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const claimId = required(options, 'claim-id');
  const resultState = required(options, 'state');
  if (!['INCONCLUSIVE', 'REPORT_WRITTEN'].includes(resultState)) {
    throw new HarnessInvariantError(
      'G19_ONESHOT_RESULT_INVALID',
      'Only terminal one-shot states are supported.',
    );
  }
  const epochResult = epochState(prNumber);
  const current = epochResult.state.adversarial_preflight?.g19_one_shot_disposition;
  if (
    !current ||
    current.claimId !== claimId ||
    current.prNumber !== Number(prNumber) ||
    current.frontierId !== 'G19'
  ) {
    throw new HarnessInvariantError(
      'G19_ONESHOT_CLAIM_MISMATCH',
      'The durable Harness control plane has no matching G19 one-shot claim.',
      { runNumber, prNumber },
    );
  }
  if (current.state === resultState) {
    print({ state: 'G19_ONE_SHOT_RESULT_ALREADY_RECORDED', claimId, resultState });
    return;
  }
  if (current.state !== 'CLAIMED') {
    throw new HarnessInvariantError(
      'G19_ONESHOT_ALREADY_TERMINAL',
      'A terminal G19 one-shot result cannot be replaced.',
      { existingState: current.state, requestedState: resultState },
    );
  }
  const nextEpoch = structuredClone(epochResult.state);
  nextEpoch.adversarial_preflight.g19_one_shot_disposition = {
    ...current,
    state: resultState,
    reportWritten: resultState === 'REPORT_WRITTEN',
    retryAllowed: false,
    finishedAt: new Date().toISOString(),
  };
  updatePr(prNumber, nextEpoch);
  print({
    state: 'G19_ONE_SHOT_RESULT_RECORDED',
    claimId,
    resultState,
    reportWritten: resultState === 'REPORT_WRITTEN',
  });
}

function assertP05OneShotClaimReadiness({
  runNumber,
  prNumber,
  candidateSha,
  baseSha,
  reviewerId,
}) {
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const currentHeadSha = currentHead();
  const currentBranchName = currentBranch();
  const currentBaseSha = remoteBaseSha('master');
  const status = {
    run: { state: runResult.state },
    epoch: { number: Number(prNumber), state: epochResult.state },
  };
  if (
    Number(runNumber) !== 95 ||
    Number(prNumber) !== 166 ||
    runResult.view.state !== 'OPEN' ||
    epochResult.state.base_branch !== 'master' ||
    git('status', '--porcelain') !== '' ||
    candidateSha !== currentHeadSha ||
    baseSha !== currentBaseSha ||
    epochResult.state.epoch_id !== P05_EPOCH_ID ||
    !epochResult.state.advances_frontier_ids?.includes('P05') ||
    !p05CandidateGateIsReady({
      status,
      pr: epochResult.view,
      currentHead: currentHeadSha,
      currentBaseSha,
      currentBranch: currentBranchName,
    }) ||
    epochResult.state.review_history?.at(-1)?.reviewer_id !== reviewerId
  ) {
    throw new HarnessInvariantError(
      'P05_ONESHOT_CLAIM_GATE_FAILED',
      'P05 one-shot claim requires the clean exact reviewed Candidate/Base, seven-check CI, and same-identity Luna Max PASS.',
      { runNumber, prNumber, candidateSha, baseSha },
    );
  }
  return { runResult, epochResult, candidateSha, baseSha, reviewerId };
}

function commandEpochP05OneShotClaim(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const candidateSha = required(options, 'candidate');
  const baseSha = required(options, 'base');
  const reviewerId = required(options, 'reviewer-id');
  assertP05OneShotClaimReadiness({ runNumber, prNumber, candidateSha, baseSha, reviewerId });

  const claim = {
    schemaVersion: 1,
    claimId: `p05-run-${runNumber}-pr-${prNumber}-${candidateSha.slice(0, 12)}-${Date.now()}`,
    frontierId: 'P05',
    epochId: P05_EPOCH_ID,
    runNumber: Number(runNumber),
    toolName: P05_TOOL_NAME,
    argumentProfile: P05_ARGUMENT_PROFILE,
    expectedArgumentsSha256: P05_ARGUMENTS_SHA256,
    state: 'CLAIMED',
    sourceCandidateSha: candidateSha,
    baseSha,
    ciSha: candidateSha,
    ciStatus: 'SUCCESS',
    prNumber: Number(prNumber),
    reviewerId,
    globalLatch: {
      name: P05_ONE_SHOT_LATCH_LABEL_NAME,
      description: P05_ONE_SHOT_LATCH_LABEL_DESCRIPTION,
    },
    reportWritten: false,
    retryAllowed: false,
    claimedAt: new Date().toISOString(),
  };

  try {
    claimP05OneShotAtomically({
      claim,
      assertReady: () =>
        assertP05OneShotClaimReadiness({ runNumber, prNumber, candidateSha, baseSha, reviewerId }),
      acquireGlobalLatch: () => acquireP05OneShotGitHubLatch(gh),
      persistClaim: (value) => {
        const latest = epochState(prNumber);
        if (Object.hasOwn(latest.state.adversarial_preflight ?? {}, 'p05_one_shot_disposition')) {
          throw new HarnessInvariantError(
            'P05_ONESHOT_ALREADY_CLAIMED',
            'A durable P05 one-shot claim or result already exists; refusing a duplicate claim.',
          );
        }
        const nextEpoch = structuredClone(latest.state);
        nextEpoch.adversarial_preflight = {
          ...nextEpoch.adversarial_preflight,
          p05_one_shot_disposition: value,
        };
        updatePr(prNumber, nextEpoch);
      },
      readClaim: () =>
        epochState(prNumber).state.adversarial_preflight?.p05_one_shot_disposition ?? null,
      verifyClaim: (observed, expected) => canonicalHash(observed) === canonicalHash(expected),
    });
  } catch (error) {
    if (error instanceof P05OneShotClaimError) {
      throw new HarnessInvariantError(error.code, error.message);
    }
    throw error;
  }

  print({
    state: 'P05_ONE_SHOT_CLAIMED',
    claimId: claim.claimId,
    runNumber: claim.runNumber,
    prNumber: claim.prNumber,
    candidateSha: claim.sourceCandidateSha,
    baseSha: claim.baseSha,
    reviewerId: claim.reviewerId,
    globalLatch: claim.globalLatch.name,
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    retryAllowed: false,
  });
}

function commandEpochP05OneShotResult(options) {
  ensureControlPlane();
  const runNumber = Number(required(options, 'run'));
  const prNumber = Number(required(options, 'pr'));
  const claimId = required(options, 'claim-id');
  const resultState = required(options, 'state');
  const artifactSha256 = options['artifact-sha256'] ? required(options, 'artifact-sha256') : null;
  if (
    runNumber !== 95 ||
    prNumber !== 166 ||
    !['INCONCLUSIVE', 'REPORT_WRITTEN'].includes(resultState) ||
    (artifactSha256 !== null && !/^[0-9a-f]{64}$/u.test(artifactSha256)) ||
    (resultState === 'REPORT_WRITTEN' && artifactSha256 === null)
  ) {
    throw new HarnessInvariantError(
      'P05_ONESHOT_RESULT_INVALID',
      'P05 result must be a terminal state with an optional valid artifact digest.',
    );
  }
  const epochResult = epochState(prNumber);
  const current = epochResult.state.adversarial_preflight?.p05_one_shot_disposition;
  if (
    !current ||
    current.claimId !== claimId ||
    current.runNumber !== runNumber ||
    current.prNumber !== prNumber ||
    current.frontierId !== 'P05' ||
    current.epochId !== P05_EPOCH_ID ||
    current.globalLatch?.name !== P05_ONE_SHOT_LATCH_LABEL_NAME ||
    current.globalLatch?.description !== P05_ONE_SHOT_LATCH_LABEL_DESCRIPTION
  ) {
    throw new HarnessInvariantError(
      'P05_ONESHOT_CLAIM_MISMATCH',
      'The active Epoch PR has no matching durable P05 one-shot claim.',
      { runNumber, prNumber },
    );
  }
  if (current.state === resultState) {
    if ((current.artifactSha256 ?? null) !== artifactSha256) {
      throw new HarnessInvariantError(
        'P05_ONESHOT_ALREADY_TERMINAL',
        'A terminal P05 result cannot be replaced with a different artifact.',
      );
    }
    print({ state: 'P05_ONE_SHOT_RESULT_ALREADY_RECORDED', claimId, resultState });
    return;
  }
  if (current.state !== 'CLAIMED') {
    throw new HarnessInvariantError(
      'P05_ONESHOT_ALREADY_TERMINAL',
      'A terminal P05 one-shot result cannot be replaced.',
      { existingState: current.state, requestedState: resultState },
    );
  }

  const nextEpoch = structuredClone(epochResult.state);
  nextEpoch.adversarial_preflight.p05_one_shot_disposition = {
    ...current,
    state: resultState,
    resultState,
    reportWritten: resultState === 'REPORT_WRITTEN',
    retryAllowed: false,
    ...(artifactSha256
      ? {
          artifactPath: 'docs/live-probes/p05-person-media-public-probe-run95.json',
          artifactSha256,
        }
      : {}),
    finishedAt: new Date().toISOString(),
  };
  updatePr(prNumber, nextEpoch);
  const readback = epochState(prNumber).state.adversarial_preflight?.p05_one_shot_disposition;
  if (
    canonicalHash(readback) !==
    canonicalHash(nextEpoch.adversarial_preflight.p05_one_shot_disposition)
  ) {
    throw new HarnessInvariantError(
      'P05_ONESHOT_RESULT_READBACK_MISMATCH',
      'The terminal P05 one-shot result did not read back exactly from the active Epoch PR.',
    );
  }
  print({
    state: 'P05_ONE_SHOT_RESULT_RECORDED',
    claimId,
    resultState,
    reportWritten: resultState === 'REPORT_WRITTEN',
    artifactSha256,
    retryAllowed: false,
  });
}

function verifiedG04LegacyTerminalClaim(sourcePrNumber) {
  const source = epochState(sourcePrNumber);
  const epoch = source.state;
  const disposition = epoch.adversarial_preflight?.g04_one_shot_disposition;
  const latestReview = epoch.review_history?.at(-1);
  const reviewerPattern = new RegExp(
    `^gpt-6-luna-max-run95-pr${sourcePrNumber}-round[1-9][0-9]*$`,
    'u',
  );
  let receiptKeyValid = false;
  try {
    receiptKeyValid =
      typeof disposition?.runnerReceiptPublicKey === 'string' &&
      g04RunnerPublicKeySha256(disposition.runnerReceiptPublicKey) ===
        disposition.runnerReceiptPublicKeySha256;
  } catch {
    receiptKeyValid = false;
  }
  const candidate = disposition?.sourceCandidateSha;
  const claimPattern =
    typeof candidate === 'string'
      ? new RegExp(`^g04-run-95-pr-${sourcePrNumber}-${candidate.slice(0, 12)}-\\d+$`, 'u')
      : /^$/u;
  const valid =
    Number.isSafeInteger(sourcePrNumber) &&
    sourcePrNumber > 0 &&
    sourcePrNumber !== 139 &&
    source.view.state === 'MERGED' &&
    epoch.state === 'MERGED' &&
    epoch.pr_number === sourcePrNumber &&
    epoch.base_branch === 'master' &&
    epoch.candidate_sha === candidate &&
    epoch.review_pass_sha === candidate &&
    epoch.reviewed_base_sha === disposition?.baseSha &&
    epoch.base_sha === disposition?.baseSha &&
    epoch.ci?.sha === candidate &&
    epoch.ci?.status === 'SUCCESS' &&
    source.view.headRefOid === candidate &&
    source.view.headRefName === epoch.branch &&
    source.view.baseRefName === 'master' &&
    mandatoryChecksSuccessful(source.view.statusCheckRollup) &&
    latestReview?.candidate_sha === candidate &&
    latestReview?.reviewed_base_sha === disposition?.baseSha &&
    latestReview?.verdict === 'PASS' &&
    latestReview?.reviewer_id === disposition?.reviewerId &&
    reviewerPattern.test(disposition?.reviewerId ?? '') &&
    claimPattern.test(disposition?.claimId ?? '') &&
    disposition?.runNumber === 95 &&
    disposition?.prNumber === sourcePrNumber &&
    disposition?.frontierId === 'G04' &&
    disposition?.epochId === epoch.epoch_id &&
    disposition?.ciSha === candidate &&
    disposition?.ciStatus === 'SUCCESS' &&
    disposition?.expectedArgumentsSha256 === canonicalHash(G04_EXPECTED_QUERY_ARGUMENTS) &&
    disposition?.toolName === 'bangumi.get_person_activity' &&
    disposition?.argumentProfile === G04_ARGUMENT_PROFILE &&
    disposition?.model === G04_MODEL &&
    disposition?.reasoningEffort === G04_REASONING_EFFORT &&
    disposition?.state === 'INCONCLUSIVE' &&
    disposition?.reportWritten === false &&
    disposition?.retryAllowed === false &&
    disposition?.reportPath === undefined &&
    disposition?.reportSha256 === undefined &&
    typeof disposition?.bundleSha256 === 'string' &&
    /^[0-9a-f]{64}$/u.test(disposition.bundleSha256) &&
    receiptKeyValid &&
    typeof disposition?.claimedAt === 'string' &&
    typeof disposition?.finishedAt === 'string' &&
    !fs.existsSync(G04_REPORT_PATH);
  if (!valid) {
    throw new HarnessInvariantError(
      'G04_LEGACY_CLAIM_INVALID',
      'The source PR does not prove an exact merged Run 95 G04 INCONCLUSIVE/no-report/no-retry claim.',
      { sourcePrNumber },
    );
  }
  return {
    claimId: disposition.claimId,
    prNumber: sourcePrNumber,
    epochId: epoch.epoch_id,
    candidateSha: candidate,
    baseSha: disposition.baseSha,
    ciSha: disposition.ciSha,
    ciStatus: disposition.ciStatus,
    reviewerId: disposition.reviewerId,
    bundleSha256: disposition.bundleSha256,
    model: disposition.model,
    reasoningEffort: disposition.reasoningEffort,
    argumentProfile: disposition.argumentProfile,
    expectedArgumentsSha256: disposition.expectedArgumentsSha256,
    state: disposition.state,
    reportWritten: disposition.reportWritten,
    retryAllowed: disposition.retryAllowed,
    claimedAt: disposition.claimedAt,
    finishedAt: disposition.finishedAt,
  };
}

function assertG04LegacyReconciliationReadiness({ runNumber, prNumber, sourcePrNumber }) {
  const sourceClaim = verifiedG04LegacyTerminalClaim(sourcePrNumber);
  const run = issueState(runNumber).state;
  const epochResult = epochState(prNumber);
  const epoch = epochResult.state;
  const pr = epochResult.view;
  const candidateSha = currentHead();
  const currentBaseSha = remoteBaseSha('master');
  const latestReview = epoch.review_history?.at(-1);
  const reviewerId = latestReview?.reviewer_id;
  const reviewerPattern = new RegExp(`^gpt-6-luna-max-run95-pr${prNumber}-round[1-9][0-9]*$`, 'u');
  if (
    Number(runNumber) !== 95 ||
    Number(prNumber) !== 139 ||
    run.state !== 'EPOCH_ACTIVE' ||
    run.profile !== 'AUTONOMOUS_EVOLUTION' ||
    run.active_epoch_pr !== Number(prNumber) ||
    run.pending_epoch != null ||
    run.g04_one_shot_legacy_reconciliation != null ||
    epoch.state !== 'REVIEW_PASSED' ||
    epoch.epoch_id !== 'run95-g04-person-activity-global-one-shot-latch' ||
    epoch.pr_number !== Number(prNumber) ||
    !epoch.advances_frontier_ids?.includes('G04') ||
    epoch.branch !== currentBranch() ||
    candidateSha !== epoch.candidate_sha ||
    git('status', '--porcelain') !== '' ||
    pr.state !== 'OPEN' ||
    pr.isDraft ||
    pr.baseRefName !== 'master' ||
    pr.headRefName !== epoch.branch ||
    pr.headRefOid !== candidateSha ||
    epoch.base_branch !== 'master' ||
    epoch.base_sha !== currentBaseSha ||
    epoch.reviewed_base_sha !== currentBaseSha ||
    epoch.review_pass_sha !== candidateSha ||
    epoch.ci?.sha !== candidateSha ||
    epoch.ci?.status !== 'SUCCESS' ||
    !mandatoryChecksSuccessful(pr.statusCheckRollup) ||
    latestReview?.candidate_sha !== candidateSha ||
    latestReview?.reviewed_base_sha !== currentBaseSha ||
    latestReview?.verdict !== 'PASS' ||
    !reviewerPattern.test(reviewerId ?? '') ||
    epoch.scope_closure?.related_work_remaining !== false ||
    epoch.adversarial_preflight?.completed !== true ||
    Object.hasOwn(epoch.adversarial_preflight ?? {}, 'g04_one_shot_disposition') ||
    Object.hasOwn(epoch.adversarial_preflight ?? {}, 'g04_legacy_claim_reconciliation') ||
    fs.existsSync(G04_REPORT_PATH)
  ) {
    throw new HarnessInvariantError(
      'G04_LEGACY_RECONCILIATION_GATE_FAILED',
      'Legacy G04 reconciliation requires the clean active PR #139 exact Candidate/Base/seven-check CI/Luna Max PASS and no existing disposition.',
      { runNumber, prNumber, sourcePrNumber, candidateSha, currentBaseSha },
    );
  }
  return { run, epoch, sourceClaim, candidateSha, baseSha: currentBaseSha, reviewerId };
}

function g04LegacyReconciliationMatches(record, sourceClaim, prNumber) {
  return (
    record?.schemaVersion === 1 &&
    record?.state === 'LEGACY_TERMINAL_RECONCILED' &&
    record?.runNumber === 95 &&
    record?.frontierId === 'G04' &&
    record?.toolName === 'bangumi.get_person_activity' &&
    record?.argumentProfile === G04_ARGUMENT_PROFILE &&
    record?.expectedArgumentsSha256 === canonicalHash(G04_EXPECTED_QUERY_ARGUMENTS) &&
    canonicalHash(record?.sourceClaim) === canonicalHash(sourceClaim) &&
    record?.reconciledAgainst?.prNumber === Number(prNumber) &&
    record?.globalLatch?.name === g04OneShotLatchLabelName() &&
    record?.globalLatch?.description === g04OneShotLatchLabelDescription() &&
    record?.queryInvoked === false &&
    record?.reportWritten === false &&
    record?.retryAllowed === false &&
    typeof record?.reconciledAt === 'string'
  );
}

function commandEpochG04LegacyClaimReconcile(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = Number(required(options, 'run'));
  const prNumber = Number(required(options, 'pr'));
  const sourcePrNumber = Number(required(options, 'source-pr'));
  const sourceClaim = verifiedG04LegacyTerminalClaim(sourcePrNumber);
  const initialRun = issueState(runNumber).state;
  const initialEpoch = epochState(prNumber).state;
  const existingPrRecord = initialEpoch.adversarial_preflight?.g04_legacy_claim_reconciliation;
  const existingRunRecord = initialRun.g04_one_shot_legacy_reconciliation;
  if (existingRunRecord != null && existingPrRecord == null) {
    throw new HarnessInvariantError(
      'G04_LEGACY_RECONCILIATION_MISMATCH',
      'The Run issue has a G04 legacy tombstone but the Epoch PR does not; refusing to infer missing PR state.',
    );
  }
  if (existingPrRecord != null) {
    if (!g04LegacyReconciliationMatches(existingPrRecord, sourceClaim, prNumber)) {
      throw new HarnessInvariantError(
        'G04_LEGACY_RECONCILIATION_MISMATCH',
        'The Epoch PR reconciliation does not match the verified legacy claim.',
      );
    }
    if (
      existingRunRecord != null &&
      canonicalHash(existingRunRecord) !== canonicalHash(existingPrRecord)
    ) {
      throw new HarnessInvariantError(
        'G04_LEGACY_RECONCILIATION_MISMATCH',
        'The Run issue and Epoch PR disagree about the terminal G04 claim.',
      );
    }
    if (existingRunRecord == null) {
      const nextRun = structuredClone(initialRun);
      nextRun.g04_one_shot_legacy_reconciliation = existingPrRecord;
      nextRun.next_action = `RESUME_PR_${prNumber}_G04_LEGACY_RECONCILIATION_RECOVERY`;
      updateIssue(runNumber, nextRun);
      const readback = issueState(runNumber).state.g04_one_shot_legacy_reconciliation;
      if (canonicalHash(readback) !== canonicalHash(existingPrRecord)) {
        throw new HarnessInvariantError(
          'G04_LEGACY_RECONCILIATION_READBACK_MISMATCH',
          'The recovered Run issue tombstone did not read back exactly.',
        );
      }
      print({
        state: 'G04_LEGACY_RECONCILIATION_RECOVERED',
        source_pr: sourcePrNumber,
        active_pr: prNumber,
        query_invoked: false,
        retry_allowed: false,
      });
      return;
    }
    print({
      state: 'G04_LEGACY_RECONCILIATION_ALREADY_RECORDED',
      source_pr: sourcePrNumber,
      active_pr: prNumber,
      query_invoked: false,
      retry_allowed: false,
    });
    return;
  }
  if (existingRunRecord != null) {
    throw new HarnessInvariantError(
      'G04_LEGACY_RECONCILIATION_MISMATCH',
      'A Run-level G04 tombstone exists without its matching Epoch PR record.',
    );
  }

  const first = assertG04LegacyReconciliationReadiness({
    runNumber,
    prNumber,
    sourcePrNumber,
  });
  const bundleSha256 = buildG04BundleForReconciliation(first.candidateSha);
  if (!g04BundleMatchesForReconciliation(first.candidateSha, bundleSha256)) {
    throw new HarnessInvariantError(
      'G04_LEGACY_RECONCILIATION_BUNDLE_MISMATCH',
      'The exact PR #139 Candidate bundle did not match its build attestation.',
    );
  }
  const claim = {
    schemaVersion: 1,
    state: 'LEGACY_TERMINAL_RECONCILED',
    runNumber: 95,
    frontierId: 'G04',
    toolName: 'bangumi.get_person_activity',
    argumentProfile: G04_ARGUMENT_PROFILE,
    expectedArgumentsSha256: canonicalHash(G04_EXPECTED_QUERY_ARGUMENTS),
    sourceClaim,
    reconciledAgainst: {
      prNumber,
      epochId: first.epoch.epoch_id,
      candidateSha: first.candidateSha,
      baseSha: first.baseSha,
      ciSha: first.candidateSha,
      ciStatus: 'SUCCESS',
      reviewerId: first.reviewerId,
      bundleSha256,
      model: G04_MODEL,
      reasoningEffort: G04_REASONING_EFFORT,
    },
    globalLatch: {
      name: g04OneShotLatchLabelName(),
      description: g04OneShotLatchLabelDescription(),
    },
    queryInvoked: false,
    reportWritten: false,
    retryAllowed: false,
    reconciledAt: new Date().toISOString(),
  };
  const assertReady = () => {
    const current = assertG04LegacyReconciliationReadiness({
      runNumber,
      prNumber,
      sourcePrNumber,
    });
    if (
      current.candidateSha !== claim.reconciledAgainst.candidateSha ||
      current.baseSha !== claim.reconciledAgainst.baseSha ||
      current.reviewerId !== claim.reconciledAgainst.reviewerId ||
      !g04BundleMatchesForReconciliation(current.candidateSha, bundleSha256)
    ) {
      throw new HarnessInvariantError(
        'G04_LEGACY_RECONCILIATION_GATE_CHANGED',
        'The exact Candidate/Base/reviewer/bundle changed during legacy reconciliation.',
      );
    }
  };
  try {
    claimG04OneShotAtomically({
      claim,
      assertReady,
      acquireGlobalLatch: () => acquireG04OneShotGitHubLatch(gh),
      persistClaim: (value) => {
        const latestEpoch = epochState(prNumber).state;
        const latestRun = issueState(runNumber).state;
        if (
          Object.hasOwn(latestEpoch.adversarial_preflight ?? {}, 'g04_one_shot_disposition') ||
          Object.hasOwn(
            latestEpoch.adversarial_preflight ?? {},
            'g04_legacy_claim_reconciliation',
          ) ||
          latestRun.g04_one_shot_legacy_reconciliation != null
        ) {
          throw new HarnessInvariantError(
            'G04_LEGACY_RECONCILIATION_ALREADY_RECORDED',
            'A concurrent G04 claim or reconciliation changed the control plane.',
          );
        }
        const nextEpoch = structuredClone(latestEpoch);
        nextEpoch.adversarial_preflight = {
          ...nextEpoch.adversarial_preflight,
          summary:
            'Run #95 G04 was already terminal INCONCLUSIVE without a report on merged PR #136. The exact legacy claim is reconciled to the repository-global latch after PR #139 Candidate/Base/CI/Luna Max PASS; no query ran on PR #139, and retries remain prohibited.',
          g04_legacy_claim_reconciliation: value,
        };
        nextEpoch.next_action = 'AUTO_MERGE_AFTER_G04_LEGACY_TERMINAL_RECONCILIATION';
        updatePr(prNumber, nextEpoch);
        const nextRun = structuredClone(latestRun);
        nextRun.g04_one_shot_legacy_reconciliation = value;
        nextRun.next_action = `RESUME_PR_${prNumber}_G04_LEGACY_TERMINAL_RECONCILIATION`;
        updateIssue(runNumber, nextRun);
      },
      readClaim: () => ({
        epoch:
          epochState(prNumber).state.adversarial_preflight?.g04_legacy_claim_reconciliation ?? null,
        run: issueState(runNumber).state.g04_one_shot_legacy_reconciliation ?? null,
      }),
      verifyClaim: (observed, expected) =>
        canonicalHash(observed?.epoch) === canonicalHash(expected) &&
        canonicalHash(observed?.run) === canonicalHash(expected),
    });
  } catch (error) {
    if (error instanceof G04OneShotClaimError) {
      throw new HarnessInvariantError(error.code, error.message);
    }
    throw error;
  }
  print({
    state: 'G04_LEGACY_CLAIM_RECONCILED',
    source_pr: sourcePrNumber,
    source_claim_id: sourceClaim.claimId,
    active_pr: prNumber,
    candidate_sha: claim.reconciledAgainst.candidateSha,
    base_sha: claim.reconciledAgainst.baseSha,
    reviewer_id: claim.reconciledAgainst.reviewerId,
    global_latch: claim.globalLatch.name,
    query_invoked: false,
    report_written: false,
    retry_allowed: false,
  });
}

function assertG04OneShotClaimReadiness(gate) {
  const {
    runNumber,
    prNumber,
    candidateSha,
    baseSha,
    bundleSha256,
    model,
    reasoningEffort,
    reviewerId,
    runnerReceiptPublicKey,
  } = gate;
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const run = runResult.state;
  const epoch = epochResult.state;
  const pr = epochResult.view;
  const currentBaseSha = remoteBaseSha(epoch.base_branch);
  const latestReview = epoch.review_history?.at(-1);
  const reviewerPattern = new RegExp(`^gpt-6-luna-max-run95-pr${prNumber}-round[1-9][0-9]*$`, 'u');
  let runnerReceiptPublicKeySha256;
  try {
    runnerReceiptPublicKeySha256 = g04RunnerPublicKeySha256(runnerReceiptPublicKey);
  } catch {
    runnerReceiptPublicKeySha256 = null;
  }
  const disposition = epoch.adversarial_preflight?.g04_one_shot_disposition;
  if (
    Number(runNumber) !== 95 ||
    run.state !== 'EPOCH_ACTIVE' ||
    run.profile !== 'AUTONOMOUS_EVOLUTION' ||
    run.active_epoch_pr !== Number(prNumber) ||
    run.pending_epoch != null ||
    run.g04_one_shot_legacy_reconciliation != null ||
    epoch.state !== 'REVIEW_PASSED' ||
    epoch.epoch_id !== 'run95-g04-person-activity-global-one-shot-latch' ||
    epoch.pr_number !== Number(prNumber) ||
    !epoch.advances_frontier_ids?.includes('G04') ||
    Object.hasOwn(epoch.adversarial_preflight ?? {}, 'g04_one_shot_disposition') ||
    Object.hasOwn(epoch.adversarial_preflight ?? {}, 'g04_legacy_claim_reconciliation') ||
    epoch.branch !== currentBranch() ||
    currentHead() !== candidateSha ||
    git('status', '--porcelain') !== '' ||
    pr.state !== 'OPEN' ||
    pr.isDraft ||
    pr.baseRefName !== 'master' ||
    pr.headRefName !== epoch.branch ||
    pr.headRefOid !== candidateSha ||
    epoch.base_branch !== 'master' ||
    epoch.base_sha !== baseSha ||
    epoch.reviewed_base_sha !== baseSha ||
    currentBaseSha !== baseSha ||
    epoch.candidate_sha !== candidateSha ||
    epoch.review_pass_sha !== candidateSha ||
    epoch.ci?.sha !== candidateSha ||
    epoch.ci?.status !== 'SUCCESS' ||
    model !== G04_MODEL ||
    reasoningEffort !== G04_REASONING_EFFORT ||
    !mandatoryChecksSuccessful(pr.statusCheckRollup) ||
    !/^[0-9a-f]{64}$/u.test(bundleSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(runnerReceiptPublicKeySha256 ?? '') ||
    latestReview?.candidate_sha !== candidateSha ||
    latestReview.reviewed_base_sha !== baseSha ||
    latestReview.verdict !== 'PASS' ||
    latestReview.reviewer_id !== reviewerId ||
    !reviewerPattern.test(reviewerId) ||
    disposition !== undefined
  ) {
    throw new HarnessInvariantError(
      'G04_ONESHOT_CLAIM_GATE_FAILED',
      'G04 one-shot claim requires the clean active exact Candidate, current Base, seven-check CI, and latest exact-identity Luna Max PASS.',
      { runNumber, prNumber, candidateSha, baseSha },
    );
  }
}

function commandEpochG04OneShotClaim(gate, { printOutput = true } = {}) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const {
    runNumber,
    prNumber,
    candidateSha,
    baseSha,
    bundleSha256,
    model,
    reasoningEffort,
    reviewerId,
    runnerReceiptPublicKey,
  } = gate;
  assertG04OneShotClaimReadiness(gate);
  const claimId = `g04-run-${runNumber}-pr-${prNumber}-${candidateSha.slice(0, 12)}-${Date.now()}`;
  const runnerReceiptPublicKeySha256 = g04RunnerPublicKeySha256(runnerReceiptPublicKey);
  const claimDisposition = {
    claimId,
    frontierId: 'G04',
    epochId: 'run95-g04-person-activity-global-one-shot-latch',
    runNumber: Number(runNumber),
    toolName: 'bangumi.get_person_activity',
    argumentProfile: G04_ARGUMENT_PROFILE,
    expectedArgumentsSha256: canonicalHash(G04_EXPECTED_QUERY_ARGUMENTS),
    state: 'CLAIMED',
    sourceCandidateSha: candidateSha,
    baseSha,
    ciSha: candidateSha,
    ciStatus: 'SUCCESS',
    bundleSha256,
    prNumber: Number(prNumber),
    reviewerId,
    model,
    reasoningEffort,
    runnerReceiptPublicKey,
    runnerReceiptPublicKeySha256,
    reportWritten: false,
    retryAllowed: false,
    claimedAt: new Date().toISOString(),
  };
  try {
    claimG04OneShotAtomically({
      claim: claimDisposition,
      assertReady: () => assertG04OneShotClaimReadiness(gate),
      acquireGlobalLatch: () => acquireG04OneShotGitHubLatch(gh),
      persistClaim: (claim) => {
        const latest = epochState(prNumber);
        if (Object.hasOwn(latest.state.adversarial_preflight ?? {}, 'g04_one_shot_disposition')) {
          throw new HarnessInvariantError(
            'G04_ONESHOT_ALREADY_CLAIMED',
            'A durable G04 one-shot disposition already exists; refusing to overwrite it.',
          );
        }
        const nextEpoch = structuredClone(latest.state);
        nextEpoch.adversarial_preflight = {
          ...nextEpoch.adversarial_preflight,
          g04_one_shot_disposition: claim,
        };
        updatePr(prNumber, nextEpoch);
      },
      readClaim: () =>
        epochState(prNumber).state.adversarial_preflight?.g04_one_shot_disposition ?? null,
      verifyClaim: (observed, expected) => canonicalHash(observed) === canonicalHash(expected),
    });
  } catch (error) {
    if (error instanceof G04OneShotClaimError) {
      throw new HarnessInvariantError(error.code, error.message);
    }
    throw error;
  }
  const result = {
    state: 'G04_ONE_SHOT_CLAIMED',
    claimId,
    runNumber: Number(runNumber),
    candidateSha,
    baseSha,
    ciSha: candidateSha,
    ciStatus: 'SUCCESS',
    prNumber: Number(prNumber),
    reviewerId,
    bundleSha256,
    expectedArgumentsSha256: canonicalHash(G04_EXPECTED_QUERY_ARGUMENTS),
    model,
    reasoningEffort,
    runnerReceiptPublicKey,
    runnerReceiptPublicKeySha256,
  };
  if (printOutput) print(result);
  return result;
}

function commandEpochG04OneShotResult(
  claim,
  resultState,
  reportSha256,
  { printOutput = true } = {},
) {
  ensureControlPlane();
  if (!['INCONCLUSIVE', 'REPORT_WRITTEN'].includes(resultState)) {
    throw new HarnessInvariantError(
      'G04_ONESHOT_RESULT_INVALID',
      'Only terminal G04 one-shot states are supported.',
    );
  }
  assertG04OneShotResultArtifactState(resultState, fs.existsSync(G04_REPORT_PATH));
  const runResult = issueState(claim.runNumber);
  const epochResult = epochState(claim.prNumber);
  const current = epochResult.state.adversarial_preflight?.g04_one_shot_disposition;
  let publicKeyValid = false;
  try {
    publicKeyValid =
      g04RunnerPublicKeySha256(current?.runnerReceiptPublicKey) ===
      current?.runnerReceiptPublicKeySha256;
  } catch {
    publicKeyValid = false;
  }
  if (
    !current ||
    current.claimId !== claim.claimId ||
    current.runNumber !== 95 ||
    current.prNumber !== Number(claim.prNumber) ||
    current.frontierId !== 'G04' ||
    current.epochId !== 'run95-g04-person-activity-global-one-shot-latch' ||
    current.sourceCandidateSha !== claim.candidateSha ||
    current.baseSha !== claim.baseSha ||
    current.ciSha !== claim.candidateSha ||
    current.ciStatus !== 'SUCCESS' ||
    current.reviewerId !== claim.reviewerId ||
    current.bundleSha256 !== claim.bundleSha256 ||
    current.expectedArgumentsSha256 !== canonicalHash(G04_EXPECTED_QUERY_ARGUMENTS) ||
    current.model !== G04_MODEL ||
    current.reasoningEffort !== G04_REASONING_EFFORT ||
    current.retryAllowed !== false ||
    !publicKeyValid ||
    runResult.state.active_epoch_pr !== Number(claim.prNumber) ||
    runResult.state.pending_epoch != null
  ) {
    throw new HarnessInvariantError(
      'G04_ONESHOT_CLAIM_MISMATCH',
      'The durable Harness control plane has no matching G04 one-shot claim.',
    );
  }
  if (current.state === resultState) {
    if (resultState === 'REPORT_WRITTEN') {
      const report = validateG04SanitizedReportFile(current, root, G04_REPORT_PATH);
      if (!report.passed || report.reportSha256 !== current.reportSha256) {
        throw new HarnessInvariantError(
          'G04_ONESHOT_REPORT_INVALID',
          report.reason ?? 'The recorded G04 report hash no longer matches its Harness claim.',
        );
      }
    }
    const response = {
      state: 'G04_ONE_SHOT_RESULT_ALREADY_RECORDED',
      claimId: current.claimId,
      resultState,
      ...(resultState === 'REPORT_WRITTEN' ? { reportSha256: current.reportSha256 } : {}),
    };
    if (printOutput) print(response);
    return response;
  }
  if (current.state !== 'CLAIMED') {
    throw new HarnessInvariantError(
      'G04_ONESHOT_ALREADY_TERMINAL',
      'A terminal G04 one-shot result cannot be replaced.',
    );
  }

  let acceptedReport;
  if (resultState === 'REPORT_WRITTEN') {
    const run = runResult.state;
    const epoch = epochResult.state;
    const pr = epochResult.view;
    const latestReview = epoch.review_history?.at(-1);
    const candidateCurrent =
      run.state === 'EPOCH_ACTIVE' &&
      run.active_epoch_pr === Number(claim.prNumber) &&
      epoch.state === 'REVIEW_PASSED' &&
      epoch.epoch_id === current.epochId &&
      epoch.pr_number === Number(claim.prNumber) &&
      epoch.base_branch === 'master' &&
      epoch.base_sha === current.baseSha &&
      epoch.reviewed_base_sha === current.baseSha &&
      remoteBaseSha('master') === current.baseSha &&
      epoch.candidate_sha === current.sourceCandidateSha &&
      epoch.review_pass_sha === current.sourceCandidateSha &&
      epoch.ci?.sha === current.ciSha &&
      epoch.ci?.status === 'SUCCESS' &&
      latestReview?.candidate_sha === current.sourceCandidateSha &&
      latestReview.reviewed_base_sha === current.baseSha &&
      latestReview.reviewer_id === current.reviewerId &&
      latestReview.verdict === 'PASS' &&
      pr.state === 'OPEN' &&
      !pr.isDraft &&
      pr.baseRefName === 'master' &&
      pr.headRefName === epoch.branch &&
      pr.headRefOid === current.sourceCandidateSha &&
      mandatoryChecksSuccessful(pr.statusCheckRollup);
    if (!candidateCurrent) {
      throw new HarnessInvariantError(
        'G04_ONESHOT_REPORT_STALE',
        'G04 REPORT_WRITTEN requires the claimed Candidate, Base, CI, reviewer PASS, and ready PR to remain current.',
      );
    }
    acceptedReport = validateG04SanitizedReportFile(current, root, G04_REPORT_PATH);
    if (!acceptedReport.passed || acceptedReport.reportSha256 !== reportSha256) {
      throw new HarnessInvariantError(
        'G04_ONESHOT_REPORT_INVALID',
        acceptedReport.reason ?? 'The G04 report does not match the durable one-shot claim.',
      );
    }
  }

  const nextEpoch = structuredClone(epochResult.state);
  nextEpoch.adversarial_preflight.g04_one_shot_disposition = {
    ...current,
    state: resultState,
    reportWritten: resultState === 'REPORT_WRITTEN',
    ...(acceptedReport
      ? { reportPath: acceptedReport.reportPath, reportSha256: acceptedReport.reportSha256 }
      : {}),
    retryAllowed: false,
    finishedAt: new Date().toISOString(),
  };
  updatePr(claim.prNumber, nextEpoch);
  const response = {
    state: 'G04_ONE_SHOT_RESULT_RECORDED',
    claimId: claim.claimId,
    resultState,
    reportWritten: resultState === 'REPORT_WRITTEN',
    ...(acceptedReport ? { reportSha256: acceptedReport.reportSha256 } : {}),
  };
  if (printOutput) print(response);
  return response;
}

function persistHarnessG04OneShotResult(claim, state, reportSha256) {
  let response;
  try {
    response = commandEpochG04OneShotResult(claim, state, reportSha256, { printOutput: false });
  } catch {
    /* The GitHub PR update may have applied before its response was lost. */
  }
  if (
    ['G04_ONE_SHOT_RESULT_RECORDED', 'G04_ONE_SHOT_RESULT_ALREADY_RECORDED'].includes(
      response?.state,
    ) &&
    response?.claimId === claim.claimId &&
    response.resultState === state &&
    (state !== 'REPORT_WRITTEN' || response.reportSha256 === reportSha256)
  ) {
    return true;
  }
  try {
    const status = epochState(claim.prNumber).state;
    const disposition = status.adversarial_preflight?.g04_one_shot_disposition;
    return g04DispositionAcknowledges(disposition, claim, {
      resultState: state,
      epochId: 'run95-g04-person-activity-global-one-shot-latch',
      toolName: 'bangumi.get_person_activity',
      argumentProfile: G04_ARGUMENT_PROFILE,
      expectedArgumentsSha256: canonicalHash(G04_EXPECTED_QUERY_ARGUMENTS),
      reportPath: G04_REPORT_RELATIVE_PATH,
      reportSha256,
    });
  } catch {
    return false;
  }
}

function commandEpochG04OneShotRun(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  if (Number(runNumber) !== 95) {
    throw new HarnessInvariantError(
      'G04_ONESHOT_RUN_INVALID',
      'G04 one-shot runs are limited to Run 95.',
    );
  }
  process.exitCode = runG04CodexAgentMcp({
    claimHarness: (gate) => commandEpochG04OneShotClaim(gate, { printOutput: false }),
    persistResult: (claim, state, reportSha256) =>
      persistHarnessG04OneShotResult(claim, state, reportSha256),
  });
}

function assertG16OneShotClaimReadiness(gate) {
  const {
    runNumber,
    prNumber,
    candidateSha,
    baseSha,
    bundleSha256,
    model,
    reasoningEffort,
    reviewerId,
    runnerReceiptPublicKey,
  } = gate;
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const run = runResult.state;
  const epoch = epochResult.state;
  const pr = epochResult.view;
  const currentBaseSha = remoteBaseSha('master');
  const latestReview = epoch.review_history?.at(-1);
  let runnerReceiptPublicKeySha256;
  try {
    runnerReceiptPublicKeySha256 = g16RunnerPublicKeySha256(runnerReceiptPublicKey);
  } catch {
    runnerReceiptPublicKeySha256 = null;
  }
  const preflight = epoch.adversarial_preflight ?? {};
  if (
    Number(runNumber) !== 95 ||
    !Number.isSafeInteger(Number(prNumber)) ||
    Number(prNumber) < 1 ||
    !/^[0-9a-f]{40}$/u.test(candidateSha ?? '') ||
    !/^[0-9a-f]{40}$/u.test(baseSha ?? '') ||
    run.state !== 'EPOCH_ACTIVE' ||
    run.profile !== 'AUTONOMOUS_EVOLUTION' ||
    run.active_epoch_pr !== Number(prNumber) ||
    run.pending_epoch != null ||
    epoch.state !== 'REVIEW_PASSED' ||
    epoch.epoch_id !== G16_EPOCH_ID ||
    epoch.pr_number !== Number(prNumber) ||
    !epoch.advances_frontier_ids?.includes('G16') ||
    epoch.scope_closure?.related_work_remaining !== false ||
    Object.hasOwn(preflight, 'g16_one_shot_disposition') ||
    epoch.branch !== currentBranch() ||
    currentHead() !== candidateSha ||
    git('status', '--porcelain') !== '' ||
    pr.state !== 'OPEN' ||
    pr.isDraft ||
    pr.baseRefName !== 'master' ||
    pr.headRefName !== epoch.branch ||
    pr.headRefOid !== candidateSha ||
    epoch.base_branch !== 'master' ||
    epoch.base_sha !== baseSha ||
    epoch.reviewed_base_sha !== baseSha ||
    currentBaseSha !== baseSha ||
    epoch.candidate_sha !== candidateSha ||
    epoch.review_pass_sha !== candidateSha ||
    epoch.ci?.sha !== candidateSha ||
    epoch.ci?.status !== 'SUCCESS' ||
    !mandatoryChecksSuccessful(pr.statusCheckRollup) ||
    model !== G16_MODEL ||
    reasoningEffort !== G16_REASONING_EFFORT ||
    !/^[0-9a-f]{64}$/u.test(bundleSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(runnerReceiptPublicKeySha256 ?? '') ||
    latestReview?.candidate_sha !== candidateSha ||
    latestReview.reviewed_base_sha !== baseSha ||
    latestReview.verdict !== 'PASS' ||
    latestReview.reviewer_id !== reviewerId ||
    !isG16LunaMaxReviewerId(reviewerId, Number(prNumber)) ||
    preflight.completed !== true
  ) {
    throw new HarnessInvariantError(
      'G16_ONESHOT_CLAIM_GATE_FAILED',
      'G16 one-shot claim requires the clean active exact Candidate, current Base, seven-check CI, and latest exact-identity Luna Max PASS.',
      { runNumber, prNumber, candidateSha, baseSha },
    );
  }
}

function commandEpochG16OneShotClaim(gate, { printOutput = true } = {}) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const {
    runNumber,
    prNumber,
    candidateSha,
    baseSha,
    bundleSha256,
    model,
    reasoningEffort,
    reviewerId,
    runnerReceiptPublicKey,
  } = gate;
  const claimId = `g16-run-${runNumber}-pr-${prNumber}-${candidateSha.slice(0, 12)}-${Date.now()}`;
  const runnerReceiptPublicKeySha256 = g16RunnerPublicKeySha256(runnerReceiptPublicKey);
  const claimDisposition = {
    claimId,
    frontierId: 'G16',
    epochId: G16_EPOCH_ID,
    runNumber: Number(runNumber),
    toolName: 'bangumi.get_person_activity',
    argumentProfile: G16_ARGUMENT_PROFILE,
    expectedArgumentsSha256: canonicalHash(G16_EXPECTED_QUERY_ARGUMENTS),
    state: 'CLAIMED',
    sourceCandidateSha: candidateSha,
    baseSha,
    ciSha: candidateSha,
    ciStatus: 'SUCCESS',
    bundleSha256,
    prNumber: Number(prNumber),
    reviewerId,
    model,
    reasoningEffort,
    runnerReceiptPublicKey,
    runnerReceiptPublicKeySha256,
    reportWritten: false,
    retryAllowed: false,
    claimedAt: new Date().toISOString(),
  };
  try {
    claimG16OneShotAtomically({
      claim: claimDisposition,
      assertReady: () => assertG16OneShotClaimReadiness(gate),
      acquireGlobalLatch: () => acquireG16OneShotGitHubLatch(gh),
      persistClaim: (claim) => {
        const latest = epochState(prNumber);
        if (Object.hasOwn(latest.state.adversarial_preflight ?? {}, 'g16_one_shot_disposition')) {
          throw new HarnessInvariantError(
            'G16_ONESHOT_ALREADY_CLAIMED',
            'A durable G16 one-shot disposition already exists; refusing to overwrite it.',
          );
        }
        const nextEpoch = structuredClone(latest.state);
        nextEpoch.adversarial_preflight = {
          ...nextEpoch.adversarial_preflight,
          g16_one_shot_disposition: claim,
        };
        updatePr(prNumber, nextEpoch);
      },
      readClaim: () =>
        epochState(prNumber).state.adversarial_preflight?.g16_one_shot_disposition ?? null,
      verifyClaim: (observed, expected) => canonicalHash(observed) === canonicalHash(expected),
    });
  } catch (error) {
    if (error instanceof G16OneShotClaimError) {
      throw new HarnessInvariantError(error.code, error.message);
    }
    throw error;
  }
  const result = {
    state: 'G16_ONE_SHOT_CLAIMED',
    claimId,
    runNumber: Number(runNumber),
    frontierId: 'G16',
    epochId: G16_EPOCH_ID,
    prNumber: Number(prNumber),
    candidateSha,
    baseSha,
    ciSha: candidateSha,
    ciStatus: 'SUCCESS',
    reviewerId,
    bundleSha256,
    expectedArgumentsSha256: canonicalHash(G16_EXPECTED_QUERY_ARGUMENTS),
    model,
    reasoningEffort,
    runnerReceiptPublicKey,
    runnerReceiptPublicKeySha256,
    retryAllowed: false,
  };
  if (printOutput) print(result);
  return result;
}

function commandEpochG16OneShotResult(
  claim,
  resultState,
  reportSha256,
  runnerReceipt,
  { printOutput = true } = {},
) {
  ensureControlPlane();
  if (!['INCONCLUSIVE', 'REPORT_WRITTEN'].includes(resultState)) {
    throw new HarnessInvariantError(
      'G16_ONESHOT_RESULT_INVALID',
      'Only terminal G16 one-shot states are supported.',
    );
  }
  if (resultState === 'INCONCLUSIVE' && fs.existsSync(G16_REPORT_PATH)) {
    throw new HarnessInvariantError(
      'G16_ONESHOT_REPORT_EXISTS',
      'Cannot record INCONCLUSIVE while the canonical G16 report exists.',
    );
  }
  const runResult = issueState(claim.runNumber);
  const epochResult = epochState(claim.prNumber);
  const current = epochResult.state.adversarial_preflight?.g16_one_shot_disposition;
  let publicKeyValid = false;
  try {
    publicKeyValid =
      g16RunnerPublicKeySha256(current?.runnerReceiptPublicKey) ===
      current?.runnerReceiptPublicKeySha256;
  } catch {
    publicKeyValid = false;
  }
  if (
    !current ||
    current.claimId !== claim.claimId ||
    current.runNumber !== 95 ||
    current.prNumber !== Number(claim.prNumber) ||
    current.frontierId !== 'G16' ||
    current.epochId !== G16_EPOCH_ID ||
    current.sourceCandidateSha !== claim.candidateSha ||
    current.baseSha !== claim.baseSha ||
    current.ciSha !== claim.candidateSha ||
    current.ciStatus !== 'SUCCESS' ||
    current.reviewerId !== claim.reviewerId ||
    current.bundleSha256 !== claim.bundleSha256 ||
    current.expectedArgumentsSha256 !== canonicalHash(G16_EXPECTED_QUERY_ARGUMENTS) ||
    current.model !== G16_MODEL ||
    current.reasoningEffort !== G16_REASONING_EFFORT ||
    current.retryAllowed !== false ||
    !publicKeyValid ||
    current.runnerReceiptPublicKey !== claim.runnerReceiptPublicKey ||
    current.runnerReceiptPublicKeySha256 !== claim.runnerReceiptPublicKeySha256
  ) {
    throw new HarnessInvariantError(
      'G16_ONESHOT_CLAIM_MISMATCH',
      'The durable Harness control plane has no matching G16 one-shot claim.',
    );
  }
  if (current.state === resultState) {
    if (resultState === 'REPORT_WRITTEN') {
      const report = validateG16SanitizedReportFile(current, root, G16_REPORT_PATH);
      if (
        !report.passed ||
        report.reportPath !== G16_REPORT_RELATIVE_PATH ||
        report.reportSha256 !== current.reportSha256 ||
        reportSha256 !== current.reportSha256 ||
        canonicalHash(report.report.runnerReceipt) !== canonicalHash(runnerReceipt)
      ) {
        throw new HarnessInvariantError(
          'G16_ONESHOT_REPORT_INVALID',
          report.reason ?? 'The recorded G16 report no longer matches its claim.',
        );
      }
    }
    const response = {
      state: 'G16_ONE_SHOT_RESULT_ALREADY_RECORDED',
      claimId: current.claimId,
      resultState,
      ...(resultState === 'REPORT_WRITTEN' ? { reportSha256: current.reportSha256 } : {}),
    };
    if (printOutput) print(response);
    return response;
  }
  if (current.state !== 'CLAIMED') {
    throw new HarnessInvariantError(
      'G16_ONESHOT_ALREADY_TERMINAL',
      'A terminal G16 one-shot result cannot be replaced.',
    );
  }
  if (
    runResult.state.active_epoch_pr !== Number(claim.prNumber) ||
    runResult.state.pending_epoch != null
  ) {
    throw new HarnessInvariantError(
      'G16_ONESHOT_CLAIM_MISMATCH',
      'The G16 claim no longer belongs to the active Run Epoch.',
    );
  }

  let acceptedReport;
  if (resultState === 'REPORT_WRITTEN') {
    const run = runResult.state;
    const epoch = epochResult.state;
    const pr = epochResult.view;
    const latestReview = epoch.review_history?.at(-1);
    const candidateCurrent =
      run.state === 'EPOCH_ACTIVE' &&
      run.profile === 'AUTONOMOUS_EVOLUTION' &&
      run.active_epoch_pr === Number(claim.prNumber) &&
      epoch.state === 'REVIEW_PASSED' &&
      epoch.epoch_id === G16_EPOCH_ID &&
      epoch.pr_number === Number(claim.prNumber) &&
      epoch.advances_frontier_ids?.includes('G16') === true &&
      epoch.scope_closure?.related_work_remaining === false &&
      epoch.adversarial_preflight?.completed === true &&
      epoch.base_branch === 'master' &&
      epoch.base_sha === current.baseSha &&
      epoch.reviewed_base_sha === current.baseSha &&
      remoteBaseSha('master') === current.baseSha &&
      epoch.candidate_sha === current.sourceCandidateSha &&
      epoch.review_pass_sha === current.sourceCandidateSha &&
      epoch.ci?.sha === current.ciSha &&
      epoch.ci?.status === 'SUCCESS' &&
      latestReview?.candidate_sha === current.sourceCandidateSha &&
      latestReview.reviewed_base_sha === current.baseSha &&
      latestReview.reviewer_id === current.reviewerId &&
      latestReview.verdict === 'PASS' &&
      pr.state === 'OPEN' &&
      !pr.isDraft &&
      pr.baseRefName === 'master' &&
      pr.headRefName === epoch.branch &&
      pr.headRefOid === current.sourceCandidateSha &&
      mandatoryChecksSuccessful(pr.statusCheckRollup);
    if (!candidateCurrent) {
      throw new HarnessInvariantError(
        'G16_ONESHOT_REPORT_STALE',
        'G16 REPORT_WRITTEN requires the claimed Candidate, Base, CI, reviewer PASS, and ready PR to remain current.',
      );
    }
    acceptedReport = validateG16SanitizedReportFile(current, root, G16_REPORT_PATH);
    if (
      !acceptedReport.passed ||
      acceptedReport.reportPath !== G16_REPORT_RELATIVE_PATH ||
      acceptedReport.reportSha256 !== reportSha256 ||
      canonicalHash(acceptedReport.report.runnerReceipt) !== canonicalHash(runnerReceipt)
    ) {
      throw new HarnessInvariantError(
        'G16_ONESHOT_REPORT_INVALID',
        acceptedReport.reason ?? 'The G16 report does not match the durable one-shot claim.',
      );
    }
  }

  const nextEpoch = structuredClone(epochResult.state);
  nextEpoch.adversarial_preflight.g16_one_shot_disposition = {
    ...current,
    state: resultState,
    reportWritten: resultState === 'REPORT_WRITTEN',
    ...(acceptedReport
      ? {
          reportPath: acceptedReport.reportPath,
          reportSha256: acceptedReport.reportSha256,
          runnerReceiptSha256: canonicalHash(acceptedReport.report.runnerReceipt),
        }
      : {}),
    retryAllowed: false,
    finishedAt: new Date().toISOString(),
  };
  updatePr(claim.prNumber, nextEpoch);
  const response = {
    state: 'G16_ONE_SHOT_RESULT_RECORDED',
    claimId: claim.claimId,
    resultState,
    reportWritten: resultState === 'REPORT_WRITTEN',
    ...(acceptedReport ? { reportSha256: acceptedReport.reportSha256 } : {}),
  };
  if (printOutput) print(response);
  return response;
}

function persistHarnessG16OneShotResult(claim, state, reportSha256, runnerReceipt) {
  let response;
  try {
    response = commandEpochG16OneShotResult(claim, state, reportSha256, runnerReceipt, {
      printOutput: false,
    });
  } catch {
    /* The GitHub PR update may have applied before its response was lost. */
  }
  if (
    ['G16_ONE_SHOT_RESULT_RECORDED', 'G16_ONE_SHOT_RESULT_ALREADY_RECORDED'].includes(
      response?.state,
    ) &&
    response?.claimId === claim.claimId &&
    response.resultState === state &&
    (state !== 'REPORT_WRITTEN' || response.reportSha256 === reportSha256)
  )
    return true;
  try {
    const disposition = epochState(claim.prNumber).state.adversarial_preflight
      ?.g16_one_shot_disposition;
    if (
      !disposition ||
      disposition.claimId !== claim.claimId ||
      disposition.state !== state ||
      disposition.retryAllowed !== false
    )
      return false;
    if (state === 'INCONCLUSIVE') return !fs.existsSync(G16_REPORT_PATH);
    const report = validateG16SanitizedReportFile(disposition, root, G16_REPORT_PATH);
    return (
      report.passed &&
      report.reportPath === G16_REPORT_RELATIVE_PATH &&
      report.reportSha256 === reportSha256 &&
      canonicalHash(report.report.runnerReceipt) === canonicalHash(runnerReceipt)
    );
  } catch {
    return false;
  }
}

function commandEpochG16OneShotRun(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  if (Number(runNumber) !== 95) {
    throw new HarnessInvariantError(
      'G16_ONESHOT_RUN_INVALID',
      'G16 one-shot runs are limited to Run 95.',
    );
  }
  process.exitCode = runG16CodexAgentMcp({
    claimHarness: (gate) => commandEpochG16OneShotClaim(gate, { printOutput: false }),
    persistResult: (claim, state, reportSha256, receipt) =>
      persistHarnessG16OneShotResult(claim, state, reportSha256, receipt),
  });
}

function agentMcpProfileClaims(epoch) {
  return epoch?.adversarial_preflight?.agent_mcp_profile_dispositions ?? {};
}

function agentMcpProfileClaimMatchesRegisteredProfile(profile, claim, runNumber, prNumber) {
  if (!claim || typeof claim !== 'object' || Array.isArray(claim)) return false;
  return (
    claim.profileId === profile.id &&
    claim.frontierId === profile.frontierId &&
    claim.epochId === profile.epochId &&
    claim.runNumber === Number(runNumber) &&
    claim.prNumber === Number(prNumber) &&
    claim.toolName === profile.toolName &&
    claim.argumentProfile === profile.argumentProfile &&
    canonicalHash(claim.expectedArguments) ===
      canonicalHash(profile.calls.map((call) => call.arguments)) &&
    claim.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(profile) &&
    claim.registrySha256 === agentMcpProfileRegistrySha256(profile.id)
  );
}

function isTerminalizableAgentMcpProfileBindingMismatch(profile, claim, prNumber) {
  if (
    !claim ||
    typeof claim !== 'object' ||
    Array.isArray(claim) ||
    claim.state !== 'CLAIMED' ||
    claim.reportWritten !== false ||
    claim.retryAllowed !== false ||
    claim.reportPath !== undefined ||
    claim.reportSha256 !== undefined ||
    claim.unacceptedReportSha256 !== undefined ||
    claim.runnerReceiptSha256 !== undefined
  ) {
    return false;
  }
  const candidateSha = claim.sourceCandidateSha;
  const claimIdMatch =
    typeof claim.claimId === 'string'
      ? new RegExp(`^profile-run-95-pr-${prNumber}-([0-9a-f]{12})-\\d+$`, 'u').exec(claim.claimId)
      : null;
  return (
    /^[0-9a-f]{40}$/u.test(candidateSha ?? '') &&
    claimIdMatch?.[1] === candidateSha.slice(0, 12) &&
    typeof claim.claimedAt === 'string' &&
    Number.isFinite(Date.parse(claim.claimedAt))
  );
}

function isMatchingA01AggregateProfileClaim(profile, claim, prNumber) {
  if (!claim || typeof claim !== 'object' || Array.isArray(claim)) return false;
  const claimFields = new Set([
    'schemaVersion',
    'claimId',
    'state',
    'profileId',
    'frontierId',
    'epochId',
    'runNumber',
    'prNumber',
    'toolName',
    'argumentProfile',
    'expectedArguments',
    'expectedArgumentsSha256',
    'registrySha256',
    'sourceCandidateSha',
    'baseSha',
    'ciSha',
    'ciStatus',
    'reviewerId',
    'bundleSha256',
    'runnerReceiptPublicKey',
    'runnerReceiptPublicKeySha256',
    'reportWritten',
    'retryAllowed',
    'claimedAt',
    'claimIdentityRecovered',
    'ambiguousLatchReconciled',
    'failureDiagnostics',
    'terminalLabel',
    'terminalLabelDescription',
    'finishedAt',
  ]);
  if (Object.keys(claim).some((key) => !claimFields.has(key))) return false;
  if (
    claim.state === 'CLAIMED' &&
    [
      'claimIdentityRecovered',
      'ambiguousLatchReconciled',
      'failureDiagnostics',
      'terminalLabel',
      'terminalLabelDescription',
      'finishedAt',
    ].some((key) => Object.hasOwn(claim, key))
  ) {
    return false;
  }
  const candidateSha = claim.sourceCandidateSha;
  const claimIdMatch =
    typeof claim.claimId === 'string'
      ? new RegExp(`^profile-run-95-pr-${prNumber}-([0-9a-f]{12})-\\d+$`, 'u').exec(claim.claimId)
      : null;
  let publicKeySha256 = null;
  try {
    publicKeySha256 = g16RunnerPublicKeySha256(claim.runnerReceiptPublicKey);
  } catch {
    return false;
  }
  try {
    return (
      A01_AGGREGATE_COHORT_OFFLINE_PROFILE_IDS.includes(profile.id) &&
      claim.schemaVersion === 1 &&
      ['CLAIMED', 'INCONCLUSIVE'].includes(claim.state) &&
      claimIdMatch?.[1] === candidateSha?.slice(0, 12) &&
      /^[0-9a-f]{40}$/u.test(candidateSha ?? '') &&
      /^[0-9a-f]{40}$/u.test(claim.baseSha ?? '') &&
      claim.profileId === profile.id &&
      claim.frontierId === profile.frontierId &&
      claim.epochId === profile.epochId &&
      claim.runNumber === 95 &&
      claim.prNumber === Number(prNumber) &&
      claim.toolName === profile.toolName &&
      claim.argumentProfile === profile.argumentProfile &&
      canonicalHash(claim.expectedArguments) ===
        canonicalHash(profile.calls.map((call) => call.arguments)) &&
      claim.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(profile) &&
      claim.registrySha256 === agentMcpProfileRegistrySha256(profile.id) &&
      claim.ciSha === candidateSha &&
      claim.ciStatus === 'SUCCESS' &&
      typeof claim.reviewerId === 'string' &&
      isG16LunaMaxReviewerId(claim.reviewerId, Number(prNumber)) &&
      /^[0-9a-f]{64}$/u.test(claim.bundleSha256 ?? '') &&
      claim.runnerReceiptPublicKeySha256 === publicKeySha256 &&
      claim.reportWritten === false &&
      claim.retryAllowed === false &&
      typeof claim.claimedAt === 'string' &&
      Number.isFinite(Date.parse(claim.claimedAt)) &&
      claim.reportPath === undefined &&
      claim.reportSha256 === undefined &&
      claim.unacceptedReportSha256 === undefined &&
      claim.runnerReceiptSha256 === undefined
    );
  } catch {
    return false;
  }
}

function isA01AggregateClaimTerminalizedDuringReconciliation(
  profile,
  disposition,
  prNumber,
  terminalDescription,
) {
  return (
    isMatchingA01AggregateProfileClaim(profile, disposition, prNumber) &&
    disposition.state === 'INCONCLUSIVE' &&
    disposition.claimIdentityRecovered === true &&
    disposition.ambiguousLatchReconciled === true &&
    disposition.reportWritten === false &&
    disposition.retryAllowed === false &&
    disposition.terminalLabel === agentMcpProfileTerminalLabelName(profile) &&
    disposition.terminalLabelDescription === terminalDescription &&
    canonicalHash(disposition.failureDiagnostics ?? null) ===
      canonicalHash({
        schemaVersion: 1,
        reasonCode: 'A01_AGGREGATE_MATRIX_AMBIGUOUS_CLAIM_TERMINALIZED',
        checks: { invocationStateUnknown: true },
        counters: {},
      }) &&
    typeof disposition.finishedAt === 'string' &&
    Number.isFinite(Date.parse(disposition.finishedAt))
  );
}

function agentMcpProfileBundleMatches(
  candidateSha,
  bundleSha256,
  allowReportWorktree = false,
  profile = null,
) {
  if (process.env.HARNESS_MOCK_STATE) {
    const status = git('status', '--porcelain', '--untracked-files=all');
    const statusLines = status.split('\n').filter(Boolean);
    const reportOnly = listAgentMcpProfiles().some(
      (registered) => statusLines.length === 1 && statusLines[0] === `?? ${registered.reportPath}`,
    );
    const p01ReportWithValidatorFix =
      profile?.id === 'p01-person-director-offline-matrix-v1-20261023' &&
      statusLines.length === 2 &&
      statusLines.includes(`?? ${profile.reportPath}`) &&
      statusLines.includes('M scripts/agent-harness.mjs');
    return (
      bundleSha256 === process.env.HARNESS_G04_BUNDLE_SHA256 &&
      currentHead() === candidateSha &&
      (status === '' || (allowReportWorktree && (reportOnly || p01ReportWithValidatorFix)))
    );
  }
  try {
    const status = git('status', '--porcelain', '--untracked-files=all');
    const statusLines = status.split('\n').filter(Boolean);
    const clean = status === '';
    const reportOnly = listAgentMcpProfiles().some(
      (registered) => statusLines.length === 1 && statusLines[0] === `?? ${registered.reportPath}`,
    );
    // P01 v1's terminal report gate must execute the newly registered validator before this
    // Harness dispatch can be committed. Permit only that single tracked Harness edit plus the
    // exact claim-bound report; Candidate, Base, CI, reviewer, and MCP bundle remain exact.
    const p01ReportWithValidatorFix =
      profile?.id === 'p01-person-director-offline-matrix-v1-20261023' &&
      statusLines.length === 2 &&
      statusLines.includes(`?? ${profile.reportPath}`) &&
      statusLines.includes('M scripts/agent-harness.mjs');
    return (
      (clean || (allowReportWorktree && (reportOnly || p01ReportWithValidatorFix))) &&
      git('rev-parse', 'HEAD') === candidateSha &&
      computeMcpBundleSha256(root) === bundleSha256 &&
      readG26McpBundleAttestation(root) === bundleSha256
    );
  } catch {
    return false;
  }
}

function assertAgentMcpProfileReportCandidateRefresh(epoch, candidateSha) {
  for (const profile of listAgentMcpProfiles()) {
    const disposition = agentMcpProfileClaims(epoch)[profile.id];
    if (disposition?.state !== 'REPORT_WRITTEN') continue;
    const sourceCandidateSha = disposition.sourceCandidateSha;
    if (
      !isAncestor(sourceCandidateSha, candidateSha) ||
      (epoch.candidate_sha && !isAncestor(epoch.candidate_sha, candidateSha))
    ) {
      throw new HarnessInvariantError(
        'AGENT_MCP_PROFILE_REFRESH_SOURCE_INVALID',
        'A report refresh must descend from the exact Candidate that authorized its query.',
        { profileId: profile.id },
      );
    }
    const changedSinceReport = git('diff', '--name-only', `${sourceCandidateSha}...${candidateSha}`)
      .split('\n')
      .filter(Boolean);
    const allowedPaths = new Set([
      profile.reportPath,
      'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
      'docs/product/frontier-ledger.json',
      ...(profile.id === G06_CAST_OFFLINE_V2_PROFILE_ID
        ? G06_CAST_OFFLINE_V2_ACCEPTANCE_REFRESH_PATHS
        : []),
      ...(profile.id === R04_RENDER_V2_PROFILE_ID ? R04_RENDER_V2_ACCEPTANCE_REFRESH_PATHS : []),
      ...(profile.id === 'p06-render-person-profile-offline-agent-mcp-v3'
        ? [
            'scripts/agent-harness.mjs',
            'scripts/check-tool-acceptance-table.py',
            'scripts/generate-tool-acceptance-tasks.py',
            'scripts/test_acceptance_evidence.py',
            'tests/harness/agent-harness-cli.test.mjs',
          ]
        : []),
      ...(profile.id === 'p03-person-name-cn-agent-mcp-v4'
        ? [
            'scripts/agent-harness.mjs',
            'scripts/check-tool-acceptance-table.py',
            'scripts/generate-tool-acceptance-tasks.py',
            'scripts/test_acceptance_evidence.py',
            'tests/harness/frontier-ledger-data.test.mjs',
            'tests/harness/agent-harness-cli.test.mjs',
            'tests/integration/tool-e2e-acceptance.test.ts',
          ]
        : []),
      ...(profile.id === 'p01-person-director-offline-matrix-v1-20261023'
        ? [
            'scripts/agent-harness.mjs',
            'tests/harness/public-probe-coverage.test.mjs',
            'tests/integration/tool-e2e-acceptance.test.ts',
          ]
        : []),
    ]);
    if (
      !changedSinceReport.includes(profile.reportPath) ||
      changedSinceReport.some((changedPath) => !allowedPaths.has(changedPath)) ||
      !agentMcpProfileBundleMatches(candidateSha, disposition.bundleSha256)
    ) {
      throw new HarnessInvariantError(
        'AGENT_MCP_PROFILE_REFRESH_SCOPE_INVALID',
        profile.id === G06_CAST_OFFLINE_V2_PROFILE_ID
          ? 'A G06 v2 report refresh may include only its report, acceptance matrix, frontier evidence, exact source-catalog helper and acceptance verifier files, and the documented G14 terminal-disposition report/test exception, with the MCP bundle unchanged.'
          : profile.id === R04_RENDER_V2_PROFILE_ID
            ? 'An R04 v2 report refresh may include only its report, acceptance matrix, frontier evidence, exact source-catalog MCP server/helper and acceptance verifier files, the documented G14 terminal-disposition report/test exception, and this policy file, with the MCP bundle unchanged.'
            : profile.id === 'p03-person-name-cn-agent-mcp-v4'
              ? 'A P03 v4 report refresh may also include only the exact acceptance validator, Harness allowlist, and their regressions needed to record the signed source-Candidate result; the MCP bundle must remain unchanged.'
              : profile.id === 'p01-person-director-offline-matrix-v1-20261023'
                ? 'A P01 director report refresh may include its sanitized report, acceptance matrix, frontier evidence, Harness report-validator allowlist, and its exact public-probe and per-tool acceptance regressions; the MCP bundle must remain unchanged.'
                : 'A report-bearing Candidate refresh may include only its sanitized report, acceptance matrix, and frontier evidence, with the exact MCP bundle unchanged.',
        { profileId: profile.id, changedPaths: changedSinceReport },
      );
    }
  }
}

function readAgentMcpProfileLabels() {
  const labels = JSON.parse(gh('label', 'list', '--limit', '1000', '--json', 'name,description'));
  if (!Array.isArray(labels)) {
    throw new HarnessInvariantError(
      'PROFILE_CONTROL_STATE_UNAVAILABLE',
      'Unable to read repository-scoped Agent/MCP profile latches.',
    );
  }
  return labels;
}

function assertAgentMcpProfileReviewReadiness(
  { runNumber, prNumber, profile, runnerReceiptPublicKey },
  { checkRunnerReceiptKey = true, checkBundle = true } = {},
) {
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const run = runResult.state;
  const epoch = epochResult.state;
  const pr = epochResult.view;
  const candidateSha = epoch.candidate_sha;
  const baseSha = epoch.base_sha;
  const currentBaseSha = remoteBaseSha('master');
  const latestReview = epoch.review_history?.at(-1);
  const profileCiEvidence = profileRequiresExactCiRunEvidence(profile.id)
    ? deriveP06CiRunEvidence(epoch.ci?.url, pr.statusCheckRollup)
    : null;
  let runnerReceiptPublicKeySha256;
  if (checkRunnerReceiptKey) {
    try {
      runnerReceiptPublicKeySha256 = g16RunnerPublicKeySha256(
        runnerReceiptPublicKey?.publicKeyBase64,
      );
    } catch {
      runnerReceiptPublicKeySha256 = null;
    }
  }
  const existingDisposition = agentMcpProfileClaims(epoch)[profile.id];
  if (
    Number(runNumber) !== 95 ||
    !Number.isSafeInteger(Number(prNumber)) ||
    Number(prNumber) < 1 ||
    run.state !== 'EPOCH_ACTIVE' ||
    run.profile !== 'AUTONOMOUS_EVOLUTION' ||
    run.active_epoch_pr !== Number(prNumber) ||
    run.pending_epoch != null ||
    epoch.state !== 'REVIEW_PASSED' ||
    epoch.epoch_id !== profile.epochId ||
    epoch.pr_number !== Number(prNumber) ||
    !epoch.advances_frontier_ids?.includes(profile.frontierId) ||
    epoch.scope_closure?.related_work_remaining !== false ||
    epoch.adversarial_preflight?.completed !== true ||
    existingDisposition !== undefined ||
    epoch.branch !== currentBranch() ||
    currentHead() !== candidateSha ||
    git('status', '--porcelain') !== '' ||
    pr.state !== 'OPEN' ||
    pr.isDraft ||
    pr.baseRefName !== 'master' ||
    pr.headRefName !== epoch.branch ||
    pr.headRefOid !== candidateSha ||
    epoch.base_branch !== 'master' ||
    epoch.reviewed_base_sha !== baseSha ||
    currentBaseSha !== baseSha ||
    epoch.review_pass_sha !== candidateSha ||
    epoch.ci?.sha !== candidateSha ||
    epoch.ci?.status !== 'SUCCESS' ||
    !mandatoryChecksSuccessful(pr.statusCheckRollup) ||
    (profileRequiresExactCiRunEvidence(profile.id) && !profileCiEvidence) ||
    latestReview?.candidate_sha !== candidateSha ||
    latestReview.reviewed_base_sha !== baseSha ||
    latestReview.verdict !== 'PASS' ||
    !isG16LunaMaxReviewerId(latestReview.reviewer_id, Number(prNumber)) ||
    (profile.id === 'c02-cardcaptor-tv-movie-v1' &&
      latestReview.reviewer_id !== epoch.review_history?.[0]?.reviewer_id) ||
    (runnerReceiptPublicKey?.reviewerId !== undefined &&
      latestReview.reviewer_id !== runnerReceiptPublicKey.reviewerId) ||
    profile.model !== 'gpt-6-luna' ||
    profile.reasoningEffort !== 'max' ||
    (checkRunnerReceiptKey &&
      (!/^[0-9a-f]{64}$/u.test(runnerReceiptPublicKey?.bundleSha256 ?? '') ||
        !/^[A-Za-z0-9+/]{40,100}={0,2}$/u.test(runnerReceiptPublicKey?.publicKeyBase64 ?? '') ||
        !/^[0-9a-f]{64}$/u.test(runnerReceiptPublicKeySha256 ?? '')))
  ) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_CLAIM_GATE_FAILED',
      'A profile one-shot claim requires the clean active exact Candidate, unchanged Base, seven-check CI, and exact Luna Max PASS.',
      { runNumber, prNumber, candidateSha, baseSha, profileId: profile.id },
    );
  }
  if (
    checkBundle &&
    !agentMcpProfileBundleMatches(candidateSha, runnerReceiptPublicKey.bundleSha256)
  ) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_BUNDLE_MISMATCH',
      'The registered profile claim must bind the current exact-Candidate MCP bundle.',
      { candidateSha, profileId: profile.id },
    );
  }
  return {
    runResult,
    epochResult,
    run,
    epoch,
    pr,
    candidateSha,
    baseSha,
    reviewerId: latestReview.reviewer_id,
    runnerReceiptPublicKeySha256,
    ...(profileCiEvidence ?? {}),
  };
}

function commandEpochAgentMcpProfileStatus(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const profileId = required(options, 'profile-id');
  const profile = getAgentMcpProfileById(profileId);
  if (!profile) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_UNKNOWN',
      'Unknown profile id; the registered profile set is closed.',
      { profileId },
    );
  }
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const disposition = agentMcpProfileClaims(epochResult.state)[profile.id] ?? null;
  const labels = readAgentMcpProfileLabels();
  const claimLabel = labels.find((label) => label.name === profile.claimLabelName) ?? null;
  const terminalLabelName = agentMcpProfileTerminalLabelName(profile);
  const terminalLabel = labels.find((label) => label.name === terminalLabelName) ?? null;
  const expectedDescription = agentMcpProfileClaimLabelDescription(profile);
  const claimMatchesProfile = agentMcpProfileClaimMatchesRegisteredProfile(
    profile,
    disposition,
    runNumber,
    prNumber,
  );
  let state = 'UNCLAIMED';
  if (claimLabel && claimLabel.description !== expectedDescription) {
    state = 'LATCH_CONFLICT';
  } else if ((claimLabel === null) !== (disposition === null)) {
    state = 'AMBIGUOUS';
  } else if (disposition) {
    state = disposition.state;
    if (!claimMatchesProfile || disposition.retryAllowed !== false) state = 'CLAIM_MISMATCH';
  }
  if (disposition && ['INCONCLUSIVE', 'REPORT_WRITTEN'].includes(disposition.state)) {
    let expectedTerminalDescription;
    try {
      expectedTerminalDescription = agentMcpProfileTerminalLabelDescription(
        profile,
        disposition.state,
        disposition.reportSha256 ?? disposition.unacceptedReportSha256 ?? null,
      );
    } catch {
      state = 'TERMINAL_DISPOSITION_INVALID';
    }
    if (!terminalLabel || terminalLabel.description !== expectedTerminalDescription) {
      state = 'TERMINAL_LATCH_MISMATCH';
    }
  } else if (terminalLabel) {
    state =
      disposition?.state === 'CLAIMED' && !claimMatchesProfile
        ? 'CLAIM_MISMATCH_TERMINAL_LATCH'
        : 'AMBIGUOUS_TERMINAL_LATCH';
  }
  let reviewGate = { eligible: false, reason: null };
  if (state === 'UNCLAIMED') {
    try {
      assertAgentMcpProfileReviewReadiness(
        {
          runNumber,
          prNumber,
          profile,
        },
        { checkRunnerReceiptKey: false, checkBundle: false },
      );
      reviewGate = { eligible: true, reason: null };
    } catch (error) {
      reviewGate = {
        eligible: false,
        reason: error instanceof HarnessInvariantError ? error.code : 'PROFILE_REVIEW_GATE_FAILED',
      };
    }
  }
  print({
    state,
    run: Number(runNumber),
    pr: Number(prNumber),
    epoch_id: epochResult.state.epoch_id,
    profile_id: profile.id,
    frontier_id: profile.frontierId,
    tool_name: profile.toolName,
    argument_profile: profile.argumentProfile,
    expected_arguments_sha256: agentMcpProfileArgumentsSha256(profile),
    registry_sha256: agentMcpProfileRegistrySha256(profile.id),
    call_count: profile.calls.length,
    retry_allowed: false,
    claim_label_present: claimLabel !== null,
    terminal_label_present: terminalLabel !== null,
    terminal_label_description: terminalLabel?.description ?? null,
    review_gate: reviewGate,
    disposition,
    issue_state: runResult.state.state,
  });
}

function commandEpochAgentMcpProfileReconcileAmbiguous(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const profileId = required(options, 'profile-id');
  const profile = getAgentMcpProfileById(profileId);
  if (!profile) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_UNKNOWN',
      'Unknown profile id; the registered profile set is closed.',
      { profileId },
    );
  }
  const p02V2Profile = profile.id === 'p02-person-profile-offline-agent-mcp-v2';
  const c03ActivityV2Profile = profile.id === 'c03-person-activity-offline-agent-mcp-matrix-v2';
  if (
    Number(runNumber) !== 95 ||
    !Number.isSafeInteger(Number(prNumber)) ||
    Number(prNumber) < 1 ||
    (!A01_AGGREGATE_COHORT_OFFLINE_PROFILE_IDS.includes(profile.id) &&
      !p02V2Profile &&
      !c03ActivityV2Profile)
  ) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_RECONCILE_INVALID',
      'Ambiguous-latch reconciliation is limited to the registered Run #95 A01, P02 v2, and C03 v2 offline profiles.',
    );
  }

  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const run = runResult.state;
  const epoch = epochResult.state;
  const pr = epochResult.view;
  if (
    run.state !== 'EPOCH_ACTIVE' ||
    run.active_epoch_pr !== Number(prNumber) ||
    run.pending_epoch != null ||
    epoch.pr_number !== Number(prNumber) ||
    epoch.epoch_id !== profile.epochId ||
    !epoch.advances_frontier_ids?.includes(profile.frontierId) ||
    epoch.adversarial_preflight?.completed !== true ||
    pr.state !== 'OPEN' ||
    (!p02V2Profile && pr.isDraft)
  ) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_RECONCILE_EPOCH_MISMATCH',
      'Ambiguous-latch reconciliation must match the active registered profile Epoch.',
      { runNumber: Number(runNumber), prNumber: Number(prNumber), profileId },
    );
  }

  const labels = readAgentMcpProfileLabels();
  const claimLabel = labels.find((label) => label.name === profile.claimLabelName);
  if (claimLabel?.description !== agentMcpProfileClaimLabelDescription(profile)) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_AMBIGUOUS_LATCH_UNCONFIRMED',
      'The exact permanent profile claim latch is not present; refusing reconciliation.',
      { profileId },
    );
  }
  const terminalDescription = agentMcpProfileTerminalLabelDescription(profile, 'INCONCLUSIVE');
  const terminalLabelName = agentMcpProfileTerminalLabelName(profile);
  const terminalLabel = labels.find((label) => label.name === terminalLabelName);
  if (terminalLabel && terminalLabel.description !== terminalDescription) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_AMBIGUOUS_TERMINAL_CONFLICT',
      'A different terminal profile latch already exists; refusing reconciliation.',
      { profileId },
    );
  }

  if (p02V2Profile) {
    const dispositions = agentMcpProfileClaims(epoch);
    const current = dispositions[profile.id];
    const currentClaimBindingMismatch =
      current?.state === 'CLAIMED' &&
      !agentMcpProfileClaimMatchesRegisteredProfile(profile, current, runNumber, prNumber) &&
      isTerminalizableAgentMcpProfileBindingMismatch(profile, current, prNumber);
    const invalidClaimSha256 = currentClaimBindingMismatch ? canonicalHash(current) : null;
    if (
      current?.state === 'INCONCLUSIVE' &&
      current.ambiguousLatchReconciled === true &&
      current.claimIdentityRecovered === false &&
      current.claimBindingMismatchTerminalized !== true &&
      current.terminalLabelDescription === terminalDescription &&
      terminalLabel?.description === terminalDescription
    ) {
      print({
        state: 'AGENT_MCP_PROFILE_AMBIGUOUS_LATCH_ALREADY_RECONCILED',
        run: 95,
        pr: Number(prNumber),
        profileId,
        resultState: 'INCONCLUSIVE',
        retryAllowed: false,
      });
      return;
    }
    if (
      current?.state === 'INCONCLUSIVE' &&
      current.ambiguousLatchReconciled === true &&
      current.claimIdentityRecovered === false &&
      current.claimBindingMismatchTerminalized === true &&
      /^[0-9a-f]{64}$/u.test(current.invalidClaimSha256 ?? '') &&
      current.terminalLabelDescription === terminalDescription &&
      terminalLabel?.description === terminalDescription &&
      !fs.existsSync(path.join(root, profile.reportPath))
    ) {
      print({
        state: 'AGENT_MCP_PROFILE_CLAIM_MISMATCH_ALREADY_TERMINALIZED',
        run: 95,
        pr: Number(prNumber),
        profileId,
        invalidClaimId: current.invalidClaimId,
        invalidClaimSha256: current.invalidClaimSha256,
        resultState: 'INCONCLUSIVE',
        retryAllowed: false,
      });
      return;
    }
    if (current !== undefined && !currentClaimBindingMismatch) {
      throw new HarnessInvariantError(
        'AGENT_MCP_PROFILE_DISPOSITION_NOT_AMBIGUOUS',
        'A durable P02 v2 profile disposition is neither ambiguous nor a terminalizable profile-binding mismatch.',
        { profileId, currentState: current.state },
      );
    }
    if (fs.existsSync(path.join(root, profile.reportPath))) {
      throw new HarnessInvariantError(
        'AGENT_MCP_PROFILE_AMBIGUOUS_REPORT_PRESENT',
        'A P02 v2 report exists without a durable claim; refusing ambiguous-latch reconciliation.',
        { profileId },
      );
    }

    const terminal = acquireAgentMcpProfileTerminalGitHubLatch(gh, profile, 'INCONCLUSIVE');
    const latestRun = issueState(runNumber).state;
    const latestEpochResult = epochState(prNumber);
    const latestEpoch = latestEpochResult.state;
    const latestDispositions = agentMcpProfileClaims(latestEpoch);
    const latestClaimLabel = readAgentMcpProfileLabels().find(
      (label) => label.name === profile.claimLabelName,
    );
    const latestTerminalLabel = readAgentMcpProfileLabels().find(
      (label) => label.name === terminalLabelName,
    );
    if (
      latestRun.state !== 'EPOCH_ACTIVE' ||
      latestRun.active_epoch_pr !== Number(prNumber) ||
      latestRun.pending_epoch != null ||
      latestEpoch.epoch_id !== profile.epochId ||
      latestEpoch.pr_number !== Number(prNumber) ||
      latestEpochResult.view.state !== 'OPEN' ||
      (currentClaimBindingMismatch
        ? !isTerminalizableAgentMcpProfileBindingMismatch(
            profile,
            latestDispositions[profile.id],
            prNumber,
          ) || canonicalHash(latestDispositions[profile.id]) !== invalidClaimSha256
        : latestDispositions[profile.id] !== undefined) ||
      latestClaimLabel?.description !== agentMcpProfileClaimLabelDescription(profile) ||
      latestTerminalLabel?.description !== terminalDescription ||
      fs.existsSync(path.join(root, profile.reportPath))
    ) {
      throw new HarnessInvariantError(
        'AGENT_MCP_PROFILE_AMBIGUOUS_RECONCILIATION_STALE',
        'The active P02 v2 Epoch or ambiguous disposition changed during terminal-latch creation; refusing a stale PR write.',
        { profileId, prNumber: Number(prNumber) },
      );
    }
    const failureDiagnostics = normalizeAgentMcpProfileDiagnostics({
      schemaVersion: 1,
      reasonCode: currentClaimBindingMismatch
        ? 'P02_PROFILE_CLAIM_BINDING_MISMATCH_TERMINALIZED'
        : 'P02_AMBIGUOUS_LATCH_RECONCILED',
      checks: currentClaimBindingMismatch
        ? { claimReadbackValid: false, invocationStateUnknown: false }
        : { invocationStateUnknown: true },
      counters: {},
    });
    const nextEpoch = structuredClone(latestEpoch);
    const disposition = {
      schemaVersion: 1,
      claimId: null,
      ...(currentClaimBindingMismatch
        ? {
            invalidClaimId: current.claimId,
            invalidClaimSha256,
            claimBindingMismatchTerminalized: true,
          }
        : {}),
      claimIdentityRecovered: false,
      ambiguousLatchReconciled: true,
      state: 'INCONCLUSIVE',
      profileId: profile.id,
      frontierId: profile.frontierId,
      epochId: profile.epochId,
      runNumber: 95,
      prNumber: Number(prNumber),
      toolName: profile.toolName,
      argumentProfile: profile.argumentProfile,
      expectedArguments: profile.calls.map((call) => structuredClone(call.arguments)),
      expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
      registrySha256: agentMcpProfileRegistrySha256(profile.id),
      sourceCandidateSha: null,
      baseSha: null,
      ciSha: null,
      ciStatus: 'UNKNOWN',
      reviewerId: null,
      bundleSha256: null,
      reportWritten: false,
      failureDiagnostics,
      terminalLabel: terminal.name,
      terminalLabelDescription: terminal.description,
      retryAllowed: false,
      finishedAt: new Date().toISOString(),
    };
    nextEpoch.adversarial_preflight.agent_mcp_profile_dispositions = {
      ...latestDispositions,
      [profile.id]: disposition,
    };
    updatePr(prNumber, nextEpoch);
    print({
      state: currentClaimBindingMismatch
        ? 'AGENT_MCP_PROFILE_CLAIM_MISMATCH_TERMINALIZED'
        : 'AGENT_MCP_PROFILE_AMBIGUOUS_LATCH_RECONCILED',
      run: 95,
      pr: Number(prNumber),
      profileId,
      ...(currentClaimBindingMismatch
        ? { invalidClaimId: current.claimId, invalidClaimSha256 }
        : {}),
      resultState: 'INCONCLUSIVE',
      retryAllowed: false,
    });
    return;
  }

  const dispositions = agentMcpProfileClaims(epoch);
  const current = dispositions[profile.id];
  const initialMatchingClaim =
    current?.state === 'CLAIMED' &&
    isMatchingA01AggregateProfileClaim(profile, current, Number(prNumber));
  if (current) {
    if (
      current.state === 'INCONCLUSIVE' &&
      current.ambiguousLatchReconciled === true &&
      current.claimIdentityRecovered === false &&
      current.terminalLabelDescription === terminalDescription &&
      terminalLabel?.description === terminalDescription
    ) {
      print({
        state: 'AGENT_MCP_PROFILE_AMBIGUOUS_LATCH_ALREADY_RECONCILED',
        run: 95,
        pr: Number(prNumber),
        profileId,
        resultState: 'INCONCLUSIVE',
        retryAllowed: false,
      });
      return;
    }
    const matchingClaim =
      current.state === 'CLAIMED' &&
      isMatchingA01AggregateProfileClaim(profile, current, Number(prNumber));
    if (!matchingClaim || terminalLabel?.description !== terminalDescription) {
      if (
        isA01AggregateClaimTerminalizedDuringReconciliation(
          profile,
          current,
          Number(prNumber),
          terminalDescription,
        ) &&
        terminalLabel?.description === terminalDescription &&
        !fs.existsSync(path.join(root, profile.reportPath))
      ) {
        print({
          state: 'AGENT_MCP_PROFILE_AMBIGUOUS_LATCH_ALREADY_RECONCILED',
          run: 95,
          pr: Number(prNumber),
          profileId,
          claimId: current.claimId,
          resultState: 'INCONCLUSIVE',
          retryAllowed: false,
        });
        return;
      }
      throw new HarnessInvariantError(
        'AGENT_MCP_PROFILE_DISPOSITION_NOT_AMBIGUOUS',
        'A durable profile disposition already exists; refusing ambiguous-latch reconciliation.',
        { profileId, currentState: current.state },
      );
    }
  }
  if (fs.existsSync(path.join(root, profile.reportPath))) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_AMBIGUOUS_REPORT_PRESENT',
      'A profile report exists without a durable claim; refusing to overwrite or reinterpret it.',
      { profileId },
    );
  }

  const terminal = acquireAgentMcpProfileTerminalGitHubLatch(gh, profile, 'INCONCLUSIVE');
  const latestRun = issueState(runNumber).state;
  const latestEpochResult = epochState(prNumber);
  const latestEpoch = latestEpochResult.state;
  const latestDispositions = agentMcpProfileClaims(latestEpoch);
  const latestDisposition = latestDispositions[profile.id];
  const latestLabels = readAgentMcpProfileLabels();
  const latestClaimLabel = latestLabels.find((label) => label.name === profile.claimLabelName);
  const latestTerminalLabel = latestLabels.find((label) => label.name === terminalLabelName);
  if (
    latestDisposition?.state === 'INCONCLUSIVE' &&
    latestDisposition.ambiguousLatchReconciled === true &&
    latestDisposition.claimIdentityRecovered === false &&
    latestDisposition.terminalLabelDescription === terminalDescription &&
    latestTerminalLabel?.description === terminalDescription
  ) {
    print({
      state: 'AGENT_MCP_PROFILE_AMBIGUOUS_LATCH_ALREADY_RECONCILED',
      run: 95,
      pr: Number(prNumber),
      profileId,
      resultState: 'INCONCLUSIVE',
      retryAllowed: false,
    });
    return;
  }
  if (
    isA01AggregateClaimTerminalizedDuringReconciliation(
      profile,
      latestDisposition,
      Number(prNumber),
      terminalDescription,
    ) &&
    latestTerminalLabel?.description === terminalDescription &&
    !fs.existsSync(path.join(root, profile.reportPath))
  ) {
    print({
      state: 'AGENT_MCP_PROFILE_AMBIGUOUS_LATCH_ALREADY_RECONCILED',
      run: 95,
      pr: Number(prNumber),
      profileId,
      claimId: latestDisposition.claimId,
      resultState: 'INCONCLUSIVE',
      retryAllowed: false,
    });
    return;
  }
  const matchingClaim =
    latestDisposition?.state === 'CLAIMED' &&
    isMatchingA01AggregateProfileClaim(profile, latestDisposition, Number(prNumber)) &&
    (!initialMatchingClaim || canonicalHash(current) === canonicalHash(latestDisposition));
  if (
    latestRun.state !== 'EPOCH_ACTIVE' ||
    latestRun.active_epoch_pr !== Number(prNumber) ||
    latestEpoch.epoch_id !== epoch.epoch_id ||
    latestEpoch.epoch_id !== profile.epochId ||
    latestEpoch.pr_number !== Number(prNumber) ||
    latestEpochResult.view.state !== 'OPEN' ||
    latestEpochResult.view.isDraft ||
    (latestDisposition !== undefined && !matchingClaim) ||
    latestClaimLabel?.description !== agentMcpProfileClaimLabelDescription(profile) ||
    latestTerminalLabel?.description !== terminalDescription ||
    fs.existsSync(path.join(root, profile.reportPath))
  ) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_AMBIGUOUS_RECONCILIATION_STALE',
      'The active Epoch or ambiguous profile disposition changed during terminal-latch creation; refusing a stale PR write.',
      { profileId, prNumber: Number(prNumber) },
    );
  }
  const failureDiagnostics = normalizeAgentMcpProfileDiagnostics({
    schemaVersion: 1,
    reasonCode: matchingClaim
      ? 'A01_AGGREGATE_MATRIX_AMBIGUOUS_CLAIM_TERMINALIZED'
      : c03ActivityV2Profile
        ? 'C03_ACTIVITY_V2_AMBIGUOUS_LATCH_RECONCILED'
        : 'A01_AGGREGATE_MATRIX_AMBIGUOUS_LATCH_RECONCILED',
    checks: { invocationStateUnknown: true },
    counters: {},
  });
  const nextEpoch = structuredClone(latestEpoch);
  const disposition = matchingClaim
    ? {
        ...latestDisposition,
        state: 'INCONCLUSIVE',
        claimIdentityRecovered: true,
        ambiguousLatchReconciled: true,
        reportWritten: false,
        failureDiagnostics,
        terminalLabel: terminal.name,
        terminalLabelDescription: terminal.description,
        retryAllowed: false,
        finishedAt: new Date().toISOString(),
      }
    : {
        schemaVersion: 1,
        claimId: null,
        claimIdentityRecovered: false,
        ambiguousLatchReconciled: true,
        state: 'INCONCLUSIVE',
        profileId: profile.id,
        frontierId: profile.frontierId,
        epochId: profile.epochId,
        runNumber: 95,
        prNumber: Number(prNumber),
        toolName: profile.toolName,
        argumentProfile: profile.argumentProfile,
        expectedArguments: profile.calls.map((call) => structuredClone(call.arguments)),
        expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
        registrySha256: agentMcpProfileRegistrySha256(profile.id),
        sourceCandidateSha: null,
        baseSha: null,
        ciSha: null,
        ciStatus: 'UNKNOWN',
        reviewerId: null,
        bundleSha256: null,
        reportWritten: false,
        failureDiagnostics,
        terminalLabel: terminal.name,
        terminalLabelDescription: terminal.description,
        retryAllowed: false,
        finishedAt: new Date().toISOString(),
      };
  nextEpoch.adversarial_preflight.agent_mcp_profile_dispositions = {
    ...latestDispositions,
    [profile.id]: disposition,
  };
  updatePr(prNumber, nextEpoch);
  print({
    state: matchingClaim
      ? 'AGENT_MCP_PROFILE_AMBIGUOUS_LATCH_CLAIM_TERMINALIZED'
      : 'AGENT_MCP_PROFILE_AMBIGUOUS_LATCH_RECONCILED',
    run: 95,
    pr: Number(prNumber),
    profileId,
    ...(matchingClaim ? { claimId: disposition.claimId } : {}),
    resultState: 'INCONCLUSIVE',
    retryAllowed: false,
  });
}

function commandEpochAgentMcpProfileClaim(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const profileId = required(options, 'profile-id');
  const bundleSha256 = required(options, 'bundle-sha256');
  const reviewerId = required(options, 'reviewer-id');
  const runnerPublicKey = required(options, 'runner-public-key');
  const profile = getAgentMcpProfileById(profileId);
  if (!profile) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_UNKNOWN',
      'Unknown profile id; the registered profile set is closed.',
      { profileId },
    );
  }
  if (Number(runNumber) !== 95 || !/^[0-9a-f]{64}$/u.test(bundleSha256)) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_CLAIM_INVALID',
      'Profile claims require Run #95 and a SHA-256 MCP bundle digest.',
    );
  }
  const gate = {
    runNumber,
    prNumber,
    profile,
    runnerReceiptPublicKey: {
      reviewerId,
      bundleSha256,
      publicKeyBase64: runnerPublicKey,
    },
  };
  const ready = assertAgentMcpProfileReviewReadiness(gate);
  const claimId = `profile-run-95-pr-${prNumber}-${ready.candidateSha.slice(0, 12)}-${Date.now()}`;
  const claim = {
    schemaVersion: 1,
    claimId,
    state: 'CLAIMED',
    profileId: profile.id,
    frontierId: profile.frontierId,
    epochId: profile.epochId,
    runNumber: 95,
    prNumber: Number(prNumber),
    toolName: profile.toolName,
    argumentProfile: profile.argumentProfile,
    expectedArguments: profile.calls.map((call) => structuredClone(call.arguments)),
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(profile),
    registrySha256: agentMcpProfileRegistrySha256(profile.id),
    sourceCandidateSha: ready.candidateSha,
    baseSha: ready.baseSha,
    ciSha: ready.candidateSha,
    ciStatus: 'SUCCESS',
    ...(profileRequiresExactCiRunEvidence(profile.id)
      ? { ciRunId: ready.ciRunId, ciChecks: ready.ciChecks }
      : {}),
    reviewerId: ready.reviewerId,
    bundleSha256,
    runnerReceiptPublicKey: runnerPublicKey,
    runnerReceiptPublicKeySha256: ready.runnerReceiptPublicKeySha256,
    reportWritten: false,
    retryAllowed: false,
    claimedAt: new Date().toISOString(),
  };
  try {
    claimAgentMcpProfileAtomically({
      claim,
      assertReady: () => {
        const currentReady = assertAgentMcpProfileReviewReadiness(gate);
        if (
          profileRequiresExactCiRunEvidence(profile.id) &&
          (currentReady.ciRunId !== claim.ciRunId ||
            canonicalHash(currentReady.ciChecks) !== canonicalHash(claim.ciChecks))
        ) {
          throw new HarnessInvariantError(
            'AGENT_MCP_PROFILE_CI_IDENTITY_CHANGED',
            'Profile CI run identity changed while the one-shot claim was being established.',
            { profileId },
          );
        }
      },
      acquireGlobalLatch: () => acquireAgentMcpProfileGitHubLatch(gh, profile),
      persistClaim: (currentClaim) => {
        const latest = epochState(prNumber);
        const current = agentMcpProfileClaims(latest.state);
        if (Object.hasOwn(current, profile.id)) {
          throw new HarnessInvariantError(
            'AGENT_MCP_PROFILE_ALREADY_CLAIMED',
            'A durable profile disposition already exists; refusing to overwrite it.',
            { profileId },
          );
        }
        const nextEpoch = structuredClone(latest.state);
        nextEpoch.adversarial_preflight = {
          ...nextEpoch.adversarial_preflight,
          agent_mcp_profile_dispositions: {
            ...current,
            [profile.id]: currentClaim,
          },
        };
        updatePr(prNumber, nextEpoch);
      },
      readClaim: () => agentMcpProfileClaims(epochState(prNumber).state)[profile.id] ?? null,
      verifyClaim: (observed, expected) => canonicalHash(observed) === canonicalHash(expected),
    });
  } catch (error) {
    if (error instanceof AgentMcpProfileClaimError) {
      throw new HarnessInvariantError(error.code, error.message, { profileId });
    }
    throw error;
  }
  print({
    state: 'AGENT_MCP_PROFILE_CLAIMED',
    claimId,
    run: 95,
    pr: Number(prNumber),
    profileId: profile.id,
    candidateSha: ready.candidateSha,
    baseSha: ready.baseSha,
    ciSha: ready.candidateSha,
    ciStatus: 'SUCCESS',
    ...(profileRequiresExactCiRunEvidence(profile.id)
      ? { ciRunId: ready.ciRunId, ciChecks: ready.ciChecks }
      : {}),
    reviewerId: ready.reviewerId,
    bundleSha256,
    expectedArgumentsSha256: claim.expectedArgumentsSha256,
    registrySha256: claim.registrySha256,
    retryAllowed: false,
  });
}

function assertAgentMcpProfileClaimCurrent(profile, claim) {
  const runResult = issueState(claim.runNumber);
  const epochResult = epochState(claim.prNumber);
  const run = runResult.state;
  const epoch = epochResult.state;
  const pr = epochResult.view;
  const latestReview = epoch.review_history?.at(-1);
  const currentBaseSha = remoteBaseSha('master');
  const profileCiEvidence = profileRequiresExactCiRunEvidence(profile.id)
    ? deriveP06CiRunEvidence(epoch.ci?.url, pr.statusCheckRollup)
    : null;
  const profileCiIdentityCurrent =
    !profileRequiresExactCiRunEvidence(profile.id) ||
    (profileCiEvidence !== null &&
      claim.ciRunId === profileCiEvidence.ciRunId &&
      canonicalHash(claim.ciChecks) === canonicalHash(profileCiEvidence.ciChecks));
  const valid =
    runResult.view.number === claim.runNumber &&
    run.state === 'EPOCH_ACTIVE' &&
    run.active_epoch_pr === claim.prNumber &&
    run.pending_epoch == null &&
    epoch.epoch_id === profile.epochId &&
    epoch.pr_number === claim.prNumber &&
    epoch.state === 'REVIEW_PASSED' &&
    epoch.scope_closure?.related_work_remaining === false &&
    epoch.adversarial_preflight?.completed === true &&
    epoch.base_branch === 'master' &&
    epoch.base_sha === claim.baseSha &&
    epoch.reviewed_base_sha === claim.baseSha &&
    currentBaseSha === claim.baseSha &&
    epoch.candidate_sha === claim.sourceCandidateSha &&
    epoch.review_pass_sha === claim.sourceCandidateSha &&
    epoch.ci?.sha === claim.ciSha &&
    epoch.ci?.status === 'SUCCESS' &&
    latestReview?.candidate_sha === claim.sourceCandidateSha &&
    latestReview.reviewed_base_sha === claim.baseSha &&
    latestReview.reviewer_id === claim.reviewerId &&
    latestReview.verdict === 'PASS' &&
    pr.state === 'OPEN' &&
    !pr.isDraft &&
    pr.baseRefName === 'master' &&
    pr.headRefName === epoch.branch &&
    pr.headRefOid === claim.sourceCandidateSha &&
    mandatoryChecksSuccessful(pr.statusCheckRollup) &&
    profileCiIdentityCurrent &&
    agentMcpProfileBundleMatches(claim.sourceCandidateSha, claim.bundleSha256, true, profile);
  if (!valid) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_CLAIM_STALE',
      'Profile result must bind the original active Candidate, Base, CI, reviewer PASS, and MCP bundle.',
      { profileId: profile.id, claimId: claim.claimId },
    );
  }
  return { run, epoch, pr, latestReview };
}

function validateAgentMcpProfileReport(profile, claim, reportPath) {
  switch (profile.id) {
    case 'c01-rating-count-gap-v1':
      return validateC01SanitizedReportFile(claim, root, reportPath);
    case 'c02-cardcaptor-tv-movie-v1':
      return validateC02SanitizedReportFile(claim, root, reportPath);
    case 'p03-person-name-cn-agent-mcp-v1':
      return validateP03SanitizedReportFile(claim, root, reportPath);
    case 'p03-person-name-cn-agent-mcp-v2':
    case 'p03-person-name-cn-agent-mcp-v3':
    case 'p03-person-name-cn-agent-mcp-v4':
      return validateP03V2SanitizedReportFile(claim, root, reportPath);
    case 'p07-person-season-distribution-agent-mcp-v1':
      return validateP07SanitizedReportFile(claim, root, reportPath);
    case 's05-bounded-non-tv-voice-agent-mcp-v1':
      return validateS05SanitizedReportFile(claim, root, reportPath);
    case 's01-annual-tv-voice-agent-mcp-v1':
      return validateS01SanitizedReportFile(claim, root, reportPath);
    case 'r05-k-on-season-shared-person-v1':
      return validateR05SanitizedReportFile(claim, root, reportPath);
    case 'c03-voice-actor-comparison-v1':
      return validateC03SanitizedReportFile(claim, root, reportPath);
    case 'c03-person-activity-offline-agent-mcp-matrix-v2':
      return validateC03PersonActivityOfflineV2SanitizedReportFile(claim, root, reportPath);
    case 'p01-person-director-offline-matrix-v1-20261023':
      return validateP01PersonActivityDirectorOfflineSanitizedReportFile(claim, root, reportPath);
    case 'p06-render-person-profile-offline-agent-mcp-v1':
    case 'p06-render-person-profile-offline-agent-mcp-v2':
    case 'p06-render-person-profile-offline-agent-mcp-v3':
      return validateP06SanitizedReportFile(claim, root, reportPath);
    case 'render-subject-card-offline-agent-mcp-v1':
    case 'render-subject-card-compact-typography-agent-mcp-v2':
    case 'render-subject-card-compact-typography-agent-mcp-v3':
      return validateRenderSubjectCardOfflineSanitizedReportFile(claim, root, reportPath);
    case 'c07-render-comparison-offline-agent-mcp-matrix-v1':
    case 'c07-render-comparison-offline-agent-mcp-matrix-v2':
    case 'c07-render-comparison-offline-agent-mcp-matrix-v3':
      return validateC07RenderComparisonOfflineSanitizedReportFile(claim, root, reportPath);
    case 'g01-render-query-subjects-offline-agent-mcp-v1':
    case 'g01-render-query-subjects-offline-agent-mcp-v2':
      return validateG01RenderQueryOfflineSanitizedReportFile(claim, root, reportPath);
    case 'g01-query-subjects-offline-agent-mcp-matrix-v1':
    case 'g01-query-subjects-offline-agent-mcp-matrix-v2':
      return validateG01QuerySubjectsOfflineSanitizedReportFile(claim, root, reportPath);
    case 'query-subjects-fresh-public-matrix-v1':
      return validateQuerySubjectsFreshPublicSanitizedReportFile(claim, root, reportPath);
    case 'query-subjects-fresh-public-matrix-v2':
      return validateQuerySubjectsFreshPublicV2SanitizedReportFile(claim, root, reportPath);
    case 'p02-person-profile-offline-agent-mcp-v1':
    case 'p02-person-profile-offline-agent-mcp-v2':
      return validateP02SanitizedReportFile(claim, root, reportPath);
    case 'r04-series-watch-order-offline-agent-mcp-v1':
      return validateR04SanitizedReportFile(claim, root, reportPath);
    case 'r04-series-watch-order-offline-agent-mcp-v2':
      return validateR04SeriesWatchOrderOfflineV2SanitizedReportFile(claim, root, reportPath);
    case 'r04-render-series-watch-order-offline-agent-mcp-v1':
      return validateR04RenderSanitizedReportFile(claim, root, reportPath);
    case 'r04-render-series-watch-order-offline-agent-mcp-matrix-v2':
      return validateR04RenderV2SanitizedReportFile(claim, root, reportPath);
    case 'r01-subject-relations-offline-agent-mcp-v1':
      return validateR01RelationsOfflineSanitizedReportFile(claim, root, reportPath);
    case 'r03-two-hop-relations-offline-agent-mcp-v1':
      return validateR03RelationsOfflineSanitizedReportFile(claim, root, reportPath);
    case 'r03-direct-relations-offline-agent-mcp-matrix-v2':
      return validateR03RelationsOfflineSanitizedReportFile(claim, root, reportPath);
    case 'r02-positive-direct-relations-agent-mcp-v1':
      return validateR02SanitizedReportFile(claim, root, reportPath);
    case 'c04-cohort-comparison-agent-mcp-matrix-v1':
      return validateC04SanitizedReportFile(claim, root, reportPath);
    case 'query-render-title-agent-mcp-v1':
      return validateTitleQueryRenderSanitizedReportFile(claim, root, reportPath);
    case 'm07-manage-index-unbound-agent-mcp-v1':
      return validateM07SanitizedReportFile(claim, root, reportPath);
    case 'auth-start-offline-agent-mcp-v1':
      return validateAuthStartSanitizedReportFile(claim, root, reportPath);
    case 'a01-render-cohort-aggregation-agent-mcp-offline-v1':
      return validateA01RenderCohortAggregationSanitizedReportFile(claim, root, reportPath);
    case 'a01-aggregate-cohort-offline-agent-mcp-matrix-v1':
    case 'a01-aggregate-cohort-offline-agent-mcp-matrix-v2':
      return validateA01AggregateCohortProfileReportFile(claim, root, reportPath);
    case 'a01-rating-dispersion-1998-spring-v1':
      return validateA01RatingDispersionSanitizedReportFile(claim, root, reportPath);
    case G06_CAST_OFFLINE_PROFILE_ID:
    case G06_CAST_OFFLINE_V2_PROFILE_ID:
      return validateG06SubjectCastOfflineSanitizedReportFile(claim, root, reportPath);
    default:
      throw new HarnessInvariantError(
        'AGENT_MCP_PROFILE_REPORT_VALIDATOR_MISSING',
        'No sanitized report validator is registered for this profile.',
        { profileId: profile.id },
      );
  }
}

function commandEpochAgentMcpProfileResult(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const profileId = required(options, 'profile-id');
  const claimId = required(options, 'claim-id');
  const resultState = required(options, 'state');
  const reportSha256 = options['report-sha256'] ?? null;
  let failureDiagnostics = null;
  if (options['diagnostics-json'] !== undefined) {
    if (resultState !== 'INCONCLUSIVE' || typeof options['diagnostics-json'] !== 'string') {
      throw new HarnessInvariantError(
        'AGENT_MCP_PROFILE_DIAGNOSTICS_INVALID',
        'Allowlisted diagnostics may accompany only an INCONCLUSIVE result.',
      );
    }
    let diagnosticsInput;
    try {
      diagnosticsInput = JSON.parse(options['diagnostics-json']);
    } catch {
      throw new HarnessInvariantError(
        'AGENT_MCP_PROFILE_DIAGNOSTICS_INVALID',
        'Profile diagnostics must be valid JSON.',
      );
    }
    try {
      failureDiagnostics = normalizeAgentMcpProfileDiagnostics(diagnosticsInput);
    } catch {
      throw new HarnessInvariantError(
        'AGENT_MCP_PROFILE_DIAGNOSTICS_INVALID',
        'Profile diagnostics must contain only bounded allowlisted checks and counters.',
      );
    }
  }
  const profile = getAgentMcpProfileById(profileId);
  if (!profile) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_UNKNOWN',
      'Unknown profile id; the registered profile set is closed.',
      { profileId },
    );
  }
  if (!['INCONCLUSIVE', 'REPORT_WRITTEN'].includes(resultState) || Number(runNumber) !== 95) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_RESULT_INVALID',
      'Profile result requires Run #95 and a terminal INCONCLUSIVE or REPORT_WRITTEN state.',
    );
  }
  const epochResult = epochState(prNumber);
  const runResult = issueState(runNumber);
  const current = agentMcpProfileClaims(epochResult.state)[profile.id];
  if (!current || current.claimId !== claimId || current.state === undefined) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_CLAIM_MISMATCH',
      'The active Epoch has no matching durable profile claim.',
      { profileId, claimId },
    );
  }
  const claimMatches =
    current.profileId === profile.id &&
    current.frontierId === profile.frontierId &&
    current.epochId === profile.epochId &&
    current.runNumber === 95 &&
    current.prNumber === Number(prNumber) &&
    current.toolName === profile.toolName &&
    current.argumentProfile === profile.argumentProfile &&
    canonicalHash(current.expectedArguments) ===
      canonicalHash(profile.calls.map((call) => call.arguments)) &&
    current.expectedArgumentsSha256 === agentMcpProfileArgumentsSha256(profile) &&
    current.registrySha256 === agentMcpProfileRegistrySha256(profile.id) &&
    current.sourceCandidateSha === current.ciSha &&
    current.ciStatus === 'SUCCESS' &&
    current.reviewerId &&
    isG16LunaMaxReviewerId(current.reviewerId, Number(prNumber)) &&
    current.bundleSha256 &&
    current.runnerReceiptPublicKeySha256 &&
    current.retryAllowed === false &&
    (!profileRequiresExactCiRunEvidence(profile.id) || isValidP06CiRunEvidence(current));
  if (!claimMatches) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_CLAIM_MISMATCH',
      'The persisted profile claim does not match its closed registry entry.',
      { profileId, claimId },
    );
  }
  const claimLabel = readAgentMcpProfileLabels().find(
    (label) => label.name === profile.claimLabelName,
  );
  if (claimLabel?.description !== agentMcpProfileClaimLabelDescription(profile)) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_CLAIM_LATCH_MISMATCH',
      'A profile result requires the exact permanent repository-scoped claim latch.',
      { profileId, claimId },
    );
  }
  const existingTerminalLabel = readAgentMcpProfileLabels().find(
    (label) => label.name === agentMcpProfileTerminalLabelName(profile),
  );
  const reportDigestValid =
    resultState === 'REPORT_WRITTEN'
      ? /^[0-9a-f]{64}$/u.test(reportSha256 ?? '')
      : reportSha256 === null || /^[0-9a-f]{64}$/u.test(reportSha256);
  const existingTerminalLatchMatches =
    reportDigestValid &&
    existingTerminalLabel?.description ===
      agentMcpProfileTerminalLabelDescription(profile, resultState, reportSha256);
  const replayingTerminalLatch = current.state === 'CLAIMED' && existingTerminalLatchMatches;
  if (existingTerminalLabel && !existingTerminalLatchMatches) {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_TERMINAL_LATCH_MISMATCH',
      'A durable terminal profile label exists with a different result or report digest.',
      { profileId, claimId },
    );
  }
  if (current.state === resultState) {
    if (
      failureDiagnostics &&
      canonicalHash(current.failureDiagnostics ?? null) !== canonicalHash(failureDiagnostics)
    ) {
      throw new HarnessInvariantError(
        'AGENT_MCP_PROFILE_TERMINAL_DIAGNOSTICS_MISMATCH',
        'A terminal profile disposition is immutable; diagnostics cannot be added or replaced later.',
        { profileId, claimId },
      );
    }
    const terminalReportSha256 = current.reportSha256 ?? current.unacceptedReportSha256 ?? null;
    if (resultState === 'INCONCLUSIVE' && reportSha256 !== terminalReportSha256) {
      throw new HarnessInvariantError(
        'AGENT_MCP_PROFILE_INCONCLUSIVE_REPORT_HASH',
        'A replayed INCONCLUSIVE result must supply the exact digest from its terminal disposition.',
      );
    }
    const terminalDescription = agentMcpProfileTerminalLabelDescription(
      profile,
      resultState,
      terminalReportSha256,
    );
    const terminalLabel = readAgentMcpProfileLabels().find(
      (label) => label.name === agentMcpProfileTerminalLabelName(profile),
    );
    if (terminalLabel?.description !== terminalDescription) {
      throw new HarnessInvariantError(
        'AGENT_MCP_PROFILE_TERMINAL_LATCH_MISMATCH',
        'The terminal profile label does not match the durable disposition.',
      );
    }
    if (resultState === 'REPORT_WRITTEN') {
      const validation = validateAgentMcpProfileReport(
        profile,
        current,
        path.join(root, profile.reportPath),
      );
      if (
        !validation.passed ||
        validation.reportSha256 !== current.reportSha256 ||
        reportSha256 !== current.reportSha256
      ) {
        throw new HarnessInvariantError(
          'AGENT_MCP_PROFILE_REPORT_INVALID',
          validation.reason ?? 'The recorded report no longer matches its durable profile claim.',
        );
      }
    }
    print({
      state: 'AGENT_MCP_PROFILE_RESULT_ALREADY_RECORDED',
      claimId,
      profileId,
      resultState,
      reportSha256: current.reportSha256 ?? null,
      unacceptedReportSha256: current.unacceptedReportSha256 ?? null,
      failureDiagnostics: current.failureDiagnostics ?? null,
      retryAllowed: false,
      issue_state: runResult.state.state,
    });
    return;
  }
  if (current.state !== 'CLAIMED') {
    throw new HarnessInvariantError(
      'AGENT_MCP_PROFILE_ALREADY_TERMINAL',
      'A terminal profile result is immutable and cannot be replaced.',
      { profileId, claimId, currentState: current.state },
    );
  }

  let acceptedReport = null;
  let boundReportSha256 = reportSha256;
  if (resultState === 'REPORT_WRITTEN') {
    if (!/^[0-9a-f]{64}$/u.test(reportSha256 ?? '')) {
      throw new HarnessInvariantError(
        'AGENT_MCP_PROFILE_REPORT_HASH_REQUIRED',
        'REPORT_WRITTEN requires the exact sanitized report SHA-256.',
      );
    }
    // The exact terminal label is the write-ahead record. Replay it even if the
    // Candidate went stale after the first PR-body write failed.
    if (!replayingTerminalLatch) assertAgentMcpProfileClaimCurrent(profile, current);
    const status = git('status', '--porcelain', '--untracked-files=all');
    const statusLines = status.split('\n').filter(Boolean);
    const p01ReportWithValidatorFix =
      profile.id === 'p01-person-director-offline-matrix-v1-20261023' &&
      statusLines.length === 2 &&
      statusLines.includes(`?? ${profile.reportPath}`) &&
      statusLines.includes('M scripts/agent-harness.mjs');
    if (status !== `?? ${profile.reportPath}` && !p01ReportWithValidatorFix) {
      throw new HarnessInvariantError(
        'AGENT_MCP_PROFILE_WORKTREE_UNEXPECTED',
        'Only the claim-bound report, plus the exact P01 Harness validator registration when applicable, may be present while recording REPORT_WRITTEN.',
        { status: status.split('\n') },
      );
    }
    acceptedReport = validateAgentMcpProfileReport(
      profile,
      current,
      path.join(root, profile.reportPath),
    );
    if (
      !acceptedReport.passed ||
      acceptedReport.reportPath !== profile.reportPath ||
      acceptedReport.reportSha256 !== reportSha256
    ) {
      throw new HarnessInvariantError(
        'AGENT_MCP_PROFILE_REPORT_INVALID',
        acceptedReport.reason ?? 'Sanitized profile report does not match the exact claim.',
      );
    }
  } else {
    const reportPath = path.join(root, profile.reportPath);
    const reportExists = fs.existsSync(reportPath);
    if (reportExists) {
      const bytes = fs.readFileSync(reportPath);
      const observedSha256 = createHash('sha256').update(bytes).digest('hex');
      if (reportSha256 !== observedSha256) {
        throw new HarnessInvariantError(
          'AGENT_MCP_PROFILE_INCONCLUSIVE_REPORT_HASH',
          'An unaccepted report digest must match the exact retained profile artifact.',
        );
      }
      const validation = validateAgentMcpProfileReport(profile, current, reportPath);
      if (validation.passed && !replayingTerminalLatch) {
        let claimCurrent = true;
        try {
          assertAgentMcpProfileClaimCurrent(profile, current);
        } catch (error) {
          if (
            !(error instanceof HarnessInvariantError) ||
            error.code !== 'AGENT_MCP_PROFILE_CLAIM_STALE'
          ) {
            throw error;
          }
          claimCurrent = false;
        }
        if (
          classifyAgentMcpProfileInconclusiveReport({
            reportValid: true,
            claimCurrent,
          }) === 'REPORT_WRITTEN_REQUIRED'
        ) {
          throw new HarnessInvariantError(
            'AGENT_MCP_PROFILE_REPORT_WRITTEN_REQUIRED',
            'A valid report for the still-current Candidate must be recorded as REPORT_WRITTEN.',
          );
        }
      }
      boundReportSha256 = observedSha256;
    } else if (reportSha256 !== null) {
      throw new HarnessInvariantError(
        'AGENT_MCP_PROFILE_INCONCLUSIVE_REPORT_HASH',
        'A report digest was supplied but the canonical C03 report file is absent.',
      );
    }
    const status = git('status', '--porcelain', '--untracked-files=all');
    if (status !== (reportExists ? `?? ${profile.reportPath}` : '')) {
      throw new HarnessInvariantError(
        'AGENT_MCP_PROFILE_WORKTREE_UNEXPECTED',
        'An INCONCLUSIVE result may retain only its exact unaccepted profile report.',
        { status: status.split('\n') },
      );
    }
  }

  const terminalLabel = acquireAgentMcpProfileTerminalGitHubLatch(
    gh,
    profile,
    resultState,
    boundReportSha256,
  );
  const nextEpoch = structuredClone(epochResult.state);
  const nextDisposition = {
    ...current,
    state: resultState,
    reportWritten: resultState === 'REPORT_WRITTEN',
    ...(acceptedReport
      ? {
          reportPath: acceptedReport.reportPath,
          reportSha256: acceptedReport.reportSha256,
          runnerReceiptSha256: canonicalHash(acceptedReport.report.runnerReceipt),
        }
      : boundReportSha256
        ? { unacceptedReportSha256: boundReportSha256 }
        : {}),
    ...(failureDiagnostics ? { failureDiagnostics } : {}),
    terminalLabel: terminalLabel.name,
    terminalLabelDescription: terminalLabel.description,
    retryAllowed: false,
    finishedAt: new Date().toISOString(),
  };
  nextEpoch.adversarial_preflight.agent_mcp_profile_dispositions = {
    ...agentMcpProfileClaims(nextEpoch),
    [profile.id]: nextDisposition,
  };
  updatePr(prNumber, nextEpoch);
  print({
    state: 'AGENT_MCP_PROFILE_RESULT_RECORDED',
    claimId,
    profileId,
    resultState,
    reportWritten: resultState === 'REPORT_WRITTEN',
    reportSha256: acceptedReport?.reportSha256 ?? null,
    unacceptedReportSha256: resultState === 'INCONCLUSIVE' ? boundReportSha256 : null,
    failureDiagnostics,
    retryAllowed: false,
    terminalLabelCreated: terminalLabel.created,
    issue_state: runResult.state.state,
  });
}

function assertR01OneShotClaimReadiness(gate) {
  const {
    runNumber,
    prNumber,
    candidateSha,
    baseSha,
    bundleSha256,
    model,
    reasoningEffort,
    reviewerId,
  } = gate;
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const run = runResult.state;
  const epoch = epochResult.state;
  const pr = epochResult.view;
  const latestReview = epoch.review_history?.at(-1);
  const currentBaseSha = remoteBaseSha('master');
  const reviewerPattern = new RegExp(`^gpt-6-luna-max-run95-pr${prNumber}-round\\d+$`, 'u');
  const preflight = epoch.adversarial_preflight ?? {};
  if (
    Number(runNumber) !== 95 ||
    !Number.isSafeInteger(Number(prNumber)) ||
    Number(prNumber) < 1 ||
    !/^[0-9a-f]{40}$/u.test(candidateSha ?? '') ||
    !/^[0-9a-f]{40}$/u.test(baseSha ?? '') ||
    !/^[0-9a-f]{64}$/u.test(bundleSha256 ?? '') ||
    run.state !== 'EPOCH_ACTIVE' ||
    run.profile !== 'AUTONOMOUS_EVOLUTION' ||
    run.active_epoch_pr !== Number(prNumber) ||
    run.pending_epoch != null ||
    epoch.state !== 'REVIEW_PASSED' ||
    epoch.epoch_id !== R01_EPOCH_ID ||
    epoch.pr_number !== Number(prNumber) ||
    !epoch.advances_frontier_ids?.includes('R01') ||
    epoch.scope_closure?.related_work_remaining !== false ||
    preflight.completed !== true ||
    Object.hasOwn(preflight, 'r01_one_shot_disposition') ||
    epoch.branch !== currentBranch() ||
    currentHead() !== candidateSha ||
    git('status', '--porcelain') !== '' ||
    pr.state !== 'OPEN' ||
    pr.isDraft ||
    pr.baseRefName !== 'master' ||
    pr.headRefName !== epoch.branch ||
    pr.headRefOid !== candidateSha ||
    epoch.base_branch !== 'master' ||
    epoch.base_sha !== baseSha ||
    epoch.reviewed_base_sha !== baseSha ||
    currentBaseSha !== baseSha ||
    epoch.candidate_sha !== candidateSha ||
    epoch.review_pass_sha !== candidateSha ||
    epoch.ci?.sha !== candidateSha ||
    epoch.ci?.status !== 'SUCCESS' ||
    !mandatoryChecksSuccessful(pr.statusCheckRollup) ||
    model !== R01_MODEL ||
    reasoningEffort !== R01_REASONING_EFFORT ||
    latestReview?.candidate_sha !== candidateSha ||
    latestReview.reviewed_base_sha !== baseSha ||
    latestReview.verdict !== 'PASS' ||
    latestReview.reviewer_id !== reviewerId ||
    !reviewerPattern.test(reviewerId ?? '')
  ) {
    throw new HarnessInvariantError(
      'R01_ONESHOT_CLAIM_GATE_FAILED',
      'R01 one-shot claim requires the clean active exact Candidate, current Base, seven-check CI, and latest exact-identity Luna Max PASS.',
      { runNumber, prNumber, candidateSha, baseSha },
    );
  }
}

function commandEpochR01OneShotClaim(gate, { printOutput = true } = {}) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const {
    runNumber,
    prNumber,
    candidateSha,
    baseSha,
    bundleSha256,
    model,
    reasoningEffort,
    reviewerId,
  } = gate;
  assertR01OneShotClaimReadiness(gate);
  const claimId = `r01-run-${runNumber}-pr-${prNumber}-${candidateSha.slice(0, 12)}-${Date.now()}`;
  const claim = {
    claimId,
    frontierId: 'R01',
    epochId: R01_EPOCH_ID,
    runNumber: Number(runNumber),
    toolName: R01_TOOL_NAME,
    argumentProfile: R01_ARGUMENT_PROFILE,
    expectedArgumentsSha256: canonicalHash(R01_EXPECTED_QUERY_ARGUMENTS),
    state: 'CLAIMED',
    sourceCandidateSha: candidateSha,
    baseSha,
    ciSha: candidateSha,
    ciStatus: 'SUCCESS',
    bundleSha256,
    prNumber: Number(prNumber),
    reviewerId,
    model,
    reasoningEffort,
    reportWritten: false,
    retryAllowed: false,
    claimedAt: new Date().toISOString(),
  };
  try {
    claimR01OneShotAtomically({
      claim,
      assertReady: () => assertR01OneShotClaimReadiness(gate),
      acquireGlobalLatch: () => acquireR01OneShotGitHubLatch(gh),
      persistClaim: (value) => {
        const latest = epochState(prNumber);
        if (Object.hasOwn(latest.state.adversarial_preflight ?? {}, 'r01_one_shot_disposition')) {
          throw new HarnessInvariantError(
            'R01_ONESHOT_ALREADY_CLAIMED',
            'A durable R01 one-shot disposition already exists; refusing to overwrite it.',
          );
        }
        const nextEpoch = structuredClone(latest.state);
        nextEpoch.adversarial_preflight = {
          ...nextEpoch.adversarial_preflight,
          r01_one_shot_disposition: value,
        };
        updatePr(prNumber, nextEpoch);
      },
      readClaim: () =>
        epochState(prNumber).state.adversarial_preflight?.r01_one_shot_disposition ?? null,
      verifyClaim: (observed, expected) => canonicalHash(observed) === canonicalHash(expected),
    });
  } catch (error) {
    if (error instanceof R01OneShotClaimError)
      throw new HarnessInvariantError(error.code, error.message);
    throw error;
  }
  if (printOutput) {
    print({
      state: 'R01_ONE_SHOT_CLAIMED',
      claimId,
      runNumber: Number(runNumber),
      prNumber: Number(prNumber),
      candidateSha,
      baseSha,
      reviewerId,
      bundleSha256,
      expectedArgumentsSha256: canonicalHash(R01_EXPECTED_QUERY_ARGUMENTS),
      model,
      reasoningEffort,
      retryAllowed: false,
    });
  }
  return claim;
}

function commandEpochR01OneShotResult(
  claim,
  resultState,
  reportSha256,
  { printOutput = true, reconciliation = null, terminalLatched = false } = {},
) {
  ensureControlPlane();
  if (!['INCONCLUSIVE', 'REPORT_WRITTEN'].includes(resultState))
    throw new HarnessInvariantError(
      'R01_ONESHOT_RESULT_INVALID',
      'Only terminal R01 one-shot states are supported.',
    );

  const runResult = issueState(claim.runNumber);
  const epochResult = epochState(claim.prNumber);
  const current = epochResult.state.adversarial_preflight?.r01_one_shot_disposition;
  if (
    !current ||
    typeof current.claimId !== 'string' ||
    current.claimId.length === 0 ||
    current.claimId !== claim.claimId ||
    current.runNumber !== 95 ||
    current.prNumber !== Number(claim.prNumber) ||
    current.frontierId !== 'R01' ||
    current.epochId !== R01_EPOCH_ID ||
    current.toolName !== R01_TOOL_NAME ||
    current.argumentProfile !== R01_ARGUMENT_PROFILE ||
    current.expectedArgumentsSha256 !== canonicalHash(R01_EXPECTED_QUERY_ARGUMENTS) ||
    current.sourceCandidateSha !== claim.sourceCandidateSha ||
    current.baseSha !== claim.baseSha ||
    current.ciSha !== claim.sourceCandidateSha ||
    current.ciStatus !== 'SUCCESS' ||
    current.reviewerId !== claim.reviewerId ||
    current.bundleSha256 !== claim.bundleSha256 ||
    current.model !== R01_MODEL ||
    current.reasoningEffort !== R01_REASONING_EFFORT ||
    current.retryAllowed !== false
  ) {
    throw new HarnessInvariantError(
      'R01_ONESHOT_CLAIM_MISMATCH',
      'The durable Harness control plane has no matching R01 one-shot claim.',
    );
  }
  const observedReportSha256 =
    resultState === 'INCONCLUSIVE'
      ? (reconciliation?.observedReportSha256 ??
        current.reconciliation?.observedReportSha256 ??
        null)
      : null;
  const reportExists = fs.existsSync(R01_REPORT_PATH);
  let terminalResultSha256 = resultState === 'REPORT_WRITTEN' ? reportSha256 : observedReportSha256;
  if (terminalLatched) {
    let terminal;
    try {
      terminal = readR01OneShotTerminalGitHubLatch(gh);
    } catch (error) {
      if (error instanceof R01OneShotClaimError)
        throw new HarnessInvariantError(error.code, error.message);
      throw error;
    }
    if (
      !terminal ||
      terminal.state !== resultState ||
      (resultState === 'REPORT_WRITTEN' && terminal.reportSha256 !== reportSha256)
    ) {
      throw new HarnessInvariantError(
        'R01_ONESHOT_TERMINAL_MISMATCH',
        'The permanent terminal latch does not authorize this reconciliation result.',
      );
    }
    terminalResultSha256 = terminal.reportSha256;
  }
  let lateUnacceptedReportSha256 = null;
  if (current.state === resultState) {
    if (resultState === 'REPORT_WRITTEN') {
      const report = validateR01SanitizedReportFile(current, root);
      if (
        !report.passed ||
        report.reportSha256 !== current.reportSha256 ||
        reportSha256 !== current.reportSha256
      )
        throw new HarnessInvariantError(
          'R01_ONESHOT_REPORT_INVALID',
          report.reason ?? 'The recorded R01 report no longer matches its claim.',
        );
    } else if (reportExists) {
      const actual = createHash('sha256').update(fs.readFileSync(R01_REPORT_PATH)).digest('hex');
      if (terminalLatched && terminalResultSha256 === null) {
        lateUnacceptedReportSha256 = actual;
      } else if (!observedReportSha256 || actual !== observedReportSha256) {
        throw new HarnessInvariantError(
          'R01_ONESHOT_REPORT_TERMINAL_CONFLICT',
          'The canonical report appeared or changed after the terminal R01 result.',
        );
      }
    }
    if (!terminalLatched) {
      try {
        acquireR01OneShotTerminalGitHubLatch(gh, resultState, terminalResultSha256);
      } catch (error) {
        if (error instanceof R01OneShotClaimError)
          throw new HarnessInvariantError(error.code, error.message);
        throw error;
      }
    }
    const response = {
      state: 'R01_ONE_SHOT_RESULT_ALREADY_RECORDED',
      claimId: current.claimId,
      resultState,
      ...(resultState === 'REPORT_WRITTEN' ? { reportSha256: current.reportSha256 } : {}),
    };
    if (printOutput) print(response);
    return response;
  }
  if (current.state !== 'CLAIMED')
    throw new HarnessInvariantError(
      'R01_ONESHOT_ALREADY_TERMINAL',
      'A terminal R01 one-shot result cannot be replaced.',
    );

  let acceptedReport;
  if (resultState === 'REPORT_WRITTEN') {
    const run = runResult.state;
    const epoch = epochResult.state;
    const pr = epochResult.view;
    const latestReview = epoch.review_history?.at(-1);
    const candidateCurrent =
      run.state === 'EPOCH_ACTIVE' &&
      run.profile === 'AUTONOMOUS_EVOLUTION' &&
      run.active_epoch_pr === Number(claim.prNumber) &&
      run.pending_epoch == null &&
      epoch.state === 'REVIEW_PASSED' &&
      epoch.epoch_id === R01_EPOCH_ID &&
      epoch.pr_number === Number(claim.prNumber) &&
      epoch.advances_frontier_ids?.includes('R01') === true &&
      epoch.scope_closure?.related_work_remaining === false &&
      epoch.adversarial_preflight?.completed === true &&
      epoch.base_branch === 'master' &&
      epoch.base_sha === current.baseSha &&
      epoch.reviewed_base_sha === current.baseSha &&
      remoteBaseSha('master') === current.baseSha &&
      epoch.candidate_sha === current.sourceCandidateSha &&
      epoch.review_pass_sha === current.sourceCandidateSha &&
      epoch.ci?.sha === current.ciSha &&
      epoch.ci?.status === 'SUCCESS' &&
      latestReview?.candidate_sha === current.sourceCandidateSha &&
      latestReview.reviewed_base_sha === current.baseSha &&
      latestReview.reviewer_id === current.reviewerId &&
      latestReview.verdict === 'PASS' &&
      pr.state === 'OPEN' &&
      !pr.isDraft &&
      pr.baseRefName === 'master' &&
      pr.headRefName === epoch.branch &&
      pr.headRefOid === current.sourceCandidateSha &&
      mandatoryChecksSuccessful(pr.statusCheckRollup);
    if (!candidateCurrent)
      throw new HarnessInvariantError(
        'R01_ONESHOT_REPORT_STALE',
        'R01 REPORT_WRITTEN requires the claimed Candidate, Base, CI, reviewer PASS, and ready PR to remain current.',
      );
    acceptedReport = validateR01SanitizedReportFile(current, root);
    if (
      !acceptedReport.passed ||
      acceptedReport.reportPath !== R01_REPORT_RELATIVE_PATH ||
      acceptedReport.reportSha256 !== reportSha256
    )
      throw new HarnessInvariantError(
        'R01_ONESHOT_REPORT_INVALID',
        acceptedReport.reason ?? 'The R01 report does not match the durable one-shot claim.',
      );
  } else if (reportExists) {
    const actual = createHash('sha256').update(fs.readFileSync(R01_REPORT_PATH)).digest('hex');
    if (terminalLatched && resultState === 'INCONCLUSIVE' && terminalResultSha256 === null) {
      lateUnacceptedReportSha256 = actual;
    } else if (!reconciliation || !/^[0-9a-f]{64}$/u.test(observedReportSha256 ?? '')) {
      throw new HarnessInvariantError(
        'R01_ONESHOT_REPORT_EXISTS',
        'A canonical report can accompany INCONCLUSIVE only after reconciliation records its digest.',
      );
    } else if (actual !== observedReportSha256) {
      throw new HarnessInvariantError(
        'R01_ONESHOT_REPORT_CHANGED',
        'The canonical report changed during R01 reconciliation.',
      );
    }
  } else if (observedReportSha256 !== null) {
    throw new HarnessInvariantError(
      'R01_ONESHOT_REPORT_MISSING',
      'Reconciliation supplied a report digest but the canonical report is absent.',
    );
  }

  if (!terminalLatched) {
    try {
      acquireR01OneShotTerminalGitHubLatch(gh, resultState, terminalResultSha256);
    } catch (error) {
      if (error instanceof R01OneShotClaimError)
        throw new HarnessInvariantError(error.code, error.message);
      throw error;
    }
  }

  const nextEpoch = structuredClone(epochResult.state);
  const nextDisposition = {
    ...current,
    state: resultState,
    reportWritten: resultState === 'REPORT_WRITTEN',
    ...(acceptedReport
      ? { reportPath: acceptedReport.reportPath, reportSha256: acceptedReport.reportSha256 }
      : {}),
    retryAllowed: false,
    finishedAt: new Date().toISOString(),
  };
  if (reconciliation) {
    nextDisposition.reconciliation = {
      method: R01_TERMINAL_RECONCILIATION_METHOD,
      reportValidation: reconciliation.reportValidation,
      ...(observedReportSha256 ? { observedReportSha256 } : {}),
      ...(lateUnacceptedReportSha256 ? { lateUnacceptedReportSha256 } : {}),
      reconciledAt: new Date().toISOString(),
    };
  }
  nextEpoch.adversarial_preflight.r01_one_shot_disposition = nextDisposition;
  updatePr(claim.prNumber, nextEpoch);
  const response = {
    state: 'R01_ONE_SHOT_RESULT_RECORDED',
    claimId: current.claimId,
    resultState,
    reportWritten: resultState === 'REPORT_WRITTEN',
    ...(acceptedReport ? { reportSha256: acceptedReport.reportSha256 } : {}),
  };
  if (printOutput) print(response);
  return response;
}

function commandEpochR01OneShotReconcile(options) {
  ensureControlPlane();
  const runNumber = Number(required(options, 'run'));
  const prNumber = Number(required(options, 'pr'));
  if (runNumber !== 95 || !Number.isSafeInteger(prNumber) || prNumber < 1) {
    throw new HarnessInvariantError(
      'R01_ONESHOT_RECONCILE_TARGET_INVALID',
      'R01 reconciliation is limited to Run 95 and a valid Epoch PR.',
    );
  }

  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const claim = epochResult.state.adversarial_preflight?.r01_one_shot_disposition;
  if (
    epochResult.state.epoch_id !== R01_EPOCH_ID ||
    epochResult.state.pr_number !== prNumber ||
    (runResult.state.active_epoch_pr !== prNumber &&
      !runResult.state.parked_epoch_prs?.includes(prNumber)) ||
    !claim ||
    claim.runNumber !== runNumber ||
    claim.prNumber !== prNumber ||
    claim.epochId !== R01_EPOCH_ID ||
    claim.frontierId !== 'R01' ||
    claim.toolName !== R01_TOOL_NAME ||
    claim.retryAllowed !== false
  ) {
    throw new HarnessInvariantError(
      'R01_ONESHOT_RECONCILE_CLAIM_INVALID',
      'The requested active or parked Epoch has no matching durable R01 one-shot claim.',
    );
  }

  try {
    verifyR01OneShotGitHubLatch(gh);
  } catch (error) {
    if (error instanceof R01OneShotClaimError)
      throw new HarnessInvariantError(error.code, error.message);
    throw error;
  }

  let terminal;
  try {
    terminal = readR01OneShotTerminalGitHubLatch(gh);
  } catch (error) {
    if (error instanceof R01OneShotClaimError)
      throw new HarnessInvariantError(error.code, error.message);
    throw error;
  }
  if (terminal?.state === 'REPORT_WRITTEN') {
    const result = commandEpochR01OneShotResult(claim, 'REPORT_WRITTEN', terminal.reportSha256, {
      reconciliation: { reportValidation: 'VALID' },
      terminalLatched: true,
    });
    print({ state: 'R01_ONE_SHOT_RECONCILED', result: result.resultState, claimId: claim.claimId });
    return;
  }
  if (terminal?.state === 'INCONCLUSIVE') {
    const result = commandEpochR01OneShotResult(claim, 'INCONCLUSIVE', null, {
      reconciliation: {
        reportValidation:
          terminal.reportSha256 || fs.existsSync(R01_REPORT_PATH)
            ? 'UNACCEPTED_AFTER_TERMINAL'
            : 'ABSENT',
        ...(terminal.reportSha256 ? { observedReportSha256: terminal.reportSha256 } : {}),
      },
      terminalLatched: true,
    });
    print({ state: 'R01_ONE_SHOT_RECONCILED', result: result.resultState, claimId: claim.claimId });
    return;
  }

  if (claim.state === 'REPORT_WRITTEN') {
    const report = validateR01SanitizedReportFile(claim, root);
    if (!report.passed || report.reportSha256 !== claim.reportSha256) {
      throw new HarnessInvariantError(
        'R01_ONESHOT_REPORT_INVALID',
        report.reason ?? 'The recorded R01 report no longer matches its claim.',
      );
    }
    const result = commandEpochR01OneShotResult(claim, 'REPORT_WRITTEN', report.reportSha256, {
      reconciliation: { reportValidation: 'VALID' },
    });
    print({ state: 'R01_ONE_SHOT_RECONCILED', result: result.resultState, claimId: claim.claimId });
    return;
  }
  if (claim.state === 'INCONCLUSIVE') {
    let observedReportSha256 = claim.reconciliation?.observedReportSha256 ?? null;
    if (fs.existsSync(R01_REPORT_PATH)) {
      const actual = createHash('sha256').update(fs.readFileSync(R01_REPORT_PATH)).digest('hex');
      if (observedReportSha256 && actual !== observedReportSha256) {
        throw new HarnessInvariantError(
          'R01_ONESHOT_REPORT_TERMINAL_CONFLICT',
          'The unaccepted R01 report changed after its terminal disposition.',
        );
      }
      observedReportSha256 = actual;
    } else if (observedReportSha256) {
      throw new HarnessInvariantError(
        'R01_ONESHOT_REPORT_MISSING',
        'The terminal R01 disposition records a report digest but its file is absent.',
      );
    }
    const result = commandEpochR01OneShotResult(claim, 'INCONCLUSIVE', null, {
      reconciliation: {
        reportValidation: observedReportSha256
          ? 'UNACCEPTED_AFTER_TERMINAL'
          : (claim.reconciliation?.reportValidation ?? 'ABSENT'),
        ...(observedReportSha256 ? { observedReportSha256 } : {}),
      },
    });
    print({ state: 'R01_ONE_SHOT_RECONCILED', result: result.resultState, claimId: claim.claimId });
    return;
  }
  if (claim.state !== 'CLAIMED') {
    throw new HarnessInvariantError(
      'R01_ONESHOT_RECONCILE_STATE_INVALID',
      'Only CLAIMED or terminal R01 dispositions can be reconciled.',
    );
  }

  if (fs.existsSync(R01_REPORT_PATH)) {
    const observedReportSha256 = createHash('sha256')
      .update(fs.readFileSync(R01_REPORT_PATH))
      .digest('hex');
    const report = validateR01SanitizedReportFile(claim, root);
    if (
      report.passed &&
      report.reportPath === R01_REPORT_RELATIVE_PATH &&
      report.reportSha256 === observedReportSha256
    ) {
      try {
        const result = commandEpochR01OneShotResult(claim, 'REPORT_WRITTEN', observedReportSha256, {
          reconciliation: { reportValidation: 'VALID' },
        });
        print({
          state: 'R01_ONE_SHOT_RECONCILED',
          result: result.resultState,
          claimId: claim.claimId,
        });
        return;
      } catch (error) {
        if (!(error instanceof HarnessInvariantError) || error.code !== 'R01_ONESHOT_REPORT_STALE')
          throw error;
        const result = commandEpochR01OneShotResult(claim, 'INCONCLUSIVE', null, {
          reconciliation: { reportValidation: 'STALE', observedReportSha256 },
        });
        print({
          state: 'R01_ONE_SHOT_RECONCILED',
          result: result.resultState,
          claimId: claim.claimId,
        });
        return;
      }
    }
    const result = commandEpochR01OneShotResult(claim, 'INCONCLUSIVE', null, {
      reconciliation: { reportValidation: 'INVALID', observedReportSha256 },
    });
    print({ state: 'R01_ONE_SHOT_RECONCILED', result: result.resultState, claimId: claim.claimId });
    return;
  }

  const result = commandEpochR01OneShotResult(claim, 'INCONCLUSIVE', null, {
    reconciliation: { reportValidation: 'ABSENT' },
  });
  print({ state: 'R01_ONE_SHOT_RECONCILED', result: result.resultState, claimId: claim.claimId });
}

function persistHarnessR01OneShotResult(claim, state, reportSha256) {
  let response;
  try {
    response = commandEpochR01OneShotResult(claim, state, reportSha256, { printOutput: false });
  } catch {
    /* The GitHub PR update may have applied before its response was lost. */
  }
  if (
    ['R01_ONE_SHOT_RESULT_RECORDED', 'R01_ONE_SHOT_RESULT_ALREADY_RECORDED'].includes(
      response?.state,
    ) &&
    response?.claimId === claim.claimId &&
    response.resultState === state &&
    (state !== 'REPORT_WRITTEN' || response.reportSha256 === reportSha256)
  )
    return true;
  try {
    const disposition = epochState(claim.prNumber).state.adversarial_preflight
      ?.r01_one_shot_disposition;
    if (
      !disposition ||
      disposition.claimId !== claim.claimId ||
      disposition.state !== state ||
      disposition.retryAllowed !== false
    )
      return false;
    if (state === 'INCONCLUSIVE') return !fs.existsSync(R01_REPORT_PATH);
    const report = validateR01SanitizedReportFile(disposition, root);
    return (
      report.passed &&
      report.reportPath === R01_REPORT_RELATIVE_PATH &&
      report.reportSha256 === reportSha256
    );
  } catch {
    return false;
  }
}

function commandEpochR01OneShotRun(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  if (Number(runNumber) !== 95)
    throw new HarnessInvariantError(
      'R01_ONESHOT_RUN_INVALID',
      'R01 one-shot runs are limited to Run 95.',
    );
  process.exitCode = runR01CodexAgentMcp({
    claimHarness: (gate) => commandEpochR01OneShotClaim(gate, { printOutput: false }),
    assertClaimStillClaimed: (claim) => {
      const current = epochState(claim.prNumber).state.adversarial_preflight
        ?.r01_one_shot_disposition;
      if (
        !current ||
        current.state !== 'CLAIMED' ||
        canonicalHash(current) !== canonicalHash(claim)
      ) {
        throw new HarnessInvariantError(
          'R01_ONESHOT_CLAIM_NO_LONGER_ACTIVE',
          'The durable R01 disposition is no longer this exact CLAIMED attempt.',
        );
      }
      const terminal = readR01OneShotTerminalGitHubLatch(gh);
      if (terminal) {
        throw new HarnessInvariantError(
          'R01_ONESHOT_ALREADY_TERMINAL',
          'A permanent R01 terminal result already exists; refusing to continue the attempt.',
        );
      }
      return true;
    },
    discardUnacceptedReport: (reportSha256) => {
      const terminal = readR01OneShotTerminalGitHubLatch(gh);
      return (
        terminal?.state === 'INCONCLUSIVE' &&
        (terminal.reportSha256 === null || terminal.reportSha256 === reportSha256)
      );
    },
    persistResult: (claim, state, reportSha256) =>
      persistHarnessR01OneShotResult(claim, state, reportSha256),
  });
}

function assertG06OneShotClaimReadiness(gate) {
  const {
    runNumber,
    prNumber,
    candidateSha,
    baseSha,
    bundleSha256,
    model,
    reasoningEffort,
    reviewerId,
    receiptPublicKey,
  } = gate;
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const run = runResult.state;
  const epoch = epochResult.state;
  const pr = epochResult.view;
  const latestReview = epoch.review_history?.at(-1);
  const currentBaseSha = remoteBaseSha('master');
  const reviewerPattern = new RegExp(`^gpt-6-luna-max-run95-pr${prNumber}-round\\d+$`, 'u');
  const preflight = epoch.adversarial_preflight ?? {};
  if (
    Number(runNumber) !== 95 ||
    !Number.isSafeInteger(Number(prNumber)) ||
    Number(prNumber) < 1 ||
    !/^[0-9a-f]{40}$/u.test(candidateSha ?? '') ||
    !/^[0-9a-f]{40}$/u.test(baseSha ?? '') ||
    !/^[0-9a-f]{64}$/u.test(bundleSha256 ?? '') ||
    run.state !== 'EPOCH_ACTIVE' ||
    run.profile !== 'AUTONOMOUS_EVOLUTION' ||
    run.active_epoch_pr !== Number(prNumber) ||
    run.pending_epoch != null ||
    epoch.state !== 'REVIEW_PASSED' ||
    epoch.epoch_id !== G06_EPOCH_ID ||
    epoch.pr_number !== Number(prNumber) ||
    !epoch.advances_frontier_ids?.includes('G06') ||
    epoch.scope_closure?.related_work_remaining !== false ||
    preflight.completed !== true ||
    Object.hasOwn(preflight, 'g06_one_shot_disposition') ||
    epoch.branch !== currentBranch() ||
    currentHead() !== candidateSha ||
    git('status', '--porcelain') !== '' ||
    pr.state !== 'OPEN' ||
    pr.isDraft ||
    pr.baseRefName !== 'master' ||
    pr.headRefName !== epoch.branch ||
    pr.headRefOid !== candidateSha ||
    epoch.base_branch !== 'master' ||
    epoch.base_sha !== baseSha ||
    epoch.reviewed_base_sha !== baseSha ||
    currentBaseSha !== baseSha ||
    epoch.candidate_sha !== candidateSha ||
    epoch.review_pass_sha !== candidateSha ||
    epoch.ci?.sha !== candidateSha ||
    epoch.ci?.status !== 'SUCCESS' ||
    !mandatoryChecksSuccessful(pr.statusCheckRollup) ||
    model !== G06_MODEL ||
    reasoningEffort !== G06_REASONING_EFFORT ||
    !isG06RunnerReceiptPublicKey(receiptPublicKey) ||
    latestReview?.candidate_sha !== candidateSha ||
    latestReview.reviewed_base_sha !== baseSha ||
    latestReview.verdict !== 'PASS' ||
    latestReview.reviewer_id !== reviewerId ||
    !reviewerPattern.test(reviewerId ?? '')
  ) {
    throw new HarnessInvariantError(
      'G06_ONESHOT_CLAIM_GATE_FAILED',
      'G06 one-shot claim requires the clean active exact Candidate, current Base, seven-check CI, and latest exact-identity Luna Max PASS.',
      { runNumber, prNumber, candidateSha, baseSha },
    );
  }
}

function commandEpochG06OneShotClaim(gate, { printOutput = true } = {}) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const {
    runNumber,
    prNumber,
    candidateSha,
    baseSha,
    bundleSha256,
    model,
    reasoningEffort,
    reviewerId,
    receiptPublicKey,
  } = gate;
  assertG06OneShotClaimReadiness(gate);
  const claim = {
    claimId: `g06-run-${runNumber}-pr-${prNumber}-${candidateSha.slice(0, 12)}-${Date.now()}`,
    frontierId: 'G06',
    epochId: G06_EPOCH_ID,
    runNumber: Number(runNumber),
    toolName: G06_TOOL_NAME,
    argumentProfile: G06_ARGUMENT_PROFILE,
    expectedArgumentsSha256: canonicalHash(G06_EXPECTED_QUERY_ARGUMENTS),
    state: 'CLAIMED',
    sourceCandidateSha: candidateSha,
    baseSha,
    ciSha: candidateSha,
    ciStatus: 'SUCCESS',
    bundleSha256,
    prNumber: Number(prNumber),
    reviewerId,
    model,
    reasoningEffort,
    reportWritten: false,
    receiptPublicKey,
    retryAllowed: false,
    claimedAt: new Date().toISOString(),
  };
  try {
    claimG06OneShotAtomically({
      claim,
      assertReady: () => assertG06OneShotClaimReadiness(gate),
      acquireGlobalLatch: (value) => acquireG06OneShotGitHubLatch(gh, value.receiptPublicKey),
      persistClaim: (value) => {
        const latest = epochState(prNumber);
        if (Object.hasOwn(latest.state.adversarial_preflight ?? {}, 'g06_one_shot_disposition')) {
          throw new HarnessInvariantError(
            'G06_ONESHOT_ALREADY_CLAIMED',
            'A durable G06 one-shot disposition already exists; refusing to overwrite it.',
          );
        }
        const next = structuredClone(latest.state);
        next.adversarial_preflight = {
          ...next.adversarial_preflight,
          g06_one_shot_disposition: value,
        };
        updatePr(prNumber, next);
      },
      readClaim: () =>
        epochState(prNumber).state.adversarial_preflight?.g06_one_shot_disposition ?? null,
      verifyClaim: (observed, expected) => canonicalHash(observed) === canonicalHash(expected),
    });
  } catch (error) {
    if (error instanceof G06OneShotClaimError)
      throw new HarnessInvariantError(error.code, error.message);
    throw error;
  }
  const result = {
    state: 'G06_ONE_SHOT_CLAIMED',
    ...claim,
  };
  if (printOutput) print(result);
  return claim;
}

function g06TerminalState(label) {
  const description = label?.description ?? '';
  if (description === 'G06-INCONCLUSIVE:report=none')
    return { state: 'INCONCLUSIVE', reportSha256: null };
  const match = /^G06-REPORT_WRITTEN:sha256=([0-9a-f]{64})$/u.exec(description);
  return match ? { state: 'REPORT_WRITTEN', reportSha256: match[1] } : null;
}

function assertG06PassedCandidateStillCurrent(claim, run, epoch, pr) {
  const latestReview = epoch.review_history?.at(-1);
  const currentBaseSha = remoteBaseSha('master');
  const current =
    run.state === 'EPOCH_ACTIVE' &&
    run.profile === 'AUTONOMOUS_EVOLUTION' &&
    run.active_epoch_pr === Number(claim.prNumber) &&
    run.pending_epoch == null &&
    epoch.state === 'REVIEW_PASSED' &&
    epoch.epoch_id === G06_EPOCH_ID &&
    epoch.pr_number === Number(claim.prNumber) &&
    epoch.advances_frontier_ids?.includes('G06') === true &&
    epoch.scope_closure?.related_work_remaining === false &&
    epoch.adversarial_preflight?.completed === true &&
    epoch.base_branch === 'master' &&
    epoch.base_sha === claim.baseSha &&
    epoch.reviewed_base_sha === claim.baseSha &&
    currentBaseSha === claim.baseSha &&
    epoch.candidate_sha === claim.sourceCandidateSha &&
    epoch.review_pass_sha === claim.sourceCandidateSha &&
    epoch.ci?.sha === claim.ciSha &&
    epoch.ci?.status === 'SUCCESS' &&
    latestReview?.candidate_sha === claim.sourceCandidateSha &&
    latestReview.reviewed_base_sha === claim.baseSha &&
    latestReview.reviewer_id === claim.reviewerId &&
    latestReview.verdict === 'PASS' &&
    pr.state === 'OPEN' &&
    !pr.isDraft &&
    pr.baseRefName === 'master' &&
    pr.headRefName === epoch.branch &&
    pr.headRefOid === claim.sourceCandidateSha &&
    mandatoryChecksSuccessful(pr.statusCheckRollup);
  if (!current) {
    throw new HarnessInvariantError(
      'G06_ONESHOT_REPORT_STALE',
      'G06 REPORT_WRITTEN requires the claimed Candidate, current Base, exact CI, reviewer PASS, and ready PR to remain current.',
    );
  }
}

function persistG06ReconciliationMetadata(runNumber, prNumber, reconciliation) {
  const latestEpoch = epochState(prNumber);
  const nextEpoch = structuredClone(latestEpoch.state);
  const disposition = nextEpoch.adversarial_preflight?.g06_one_shot_disposition;
  if (!disposition) {
    throw new HarnessInvariantError(
      'G06_ONESHOT_RECONCILIATION_CLAIM_MISSING',
      'Cannot record G06 reconciliation without its durable claim.',
    );
  }
  if (
    !reconciliation ||
    reconciliation.terminalLatch !== disposition.state ||
    !['VALID', 'ABSENT', 'INVALID'].includes(reconciliation.reportValidation) ||
    (reconciliation.reportValidation === 'VALID' &&
      !/^[0-9a-f]{64}$/u.test(reconciliation.observedReportSha256 ?? '')) ||
    (disposition.state === 'REPORT_WRITTEN' && reconciliation.reportValidation !== 'VALID') ||
    (disposition.state === 'REPORT_WRITTEN' &&
      reconciliation.observedReportSha256 !== disposition.reportSha256) ||
    (disposition.state === 'INCONCLUSIVE' && reconciliation.reportValidation === 'VALID')
  ) {
    throw new HarnessInvariantError(
      'G06_ONESHOT_RECONCILIATION_INVALID',
      'G06 terminal reconciliation must bind its terminal state and complete report validation.',
    );
  }
  const priorReconciliation = disposition.reconciliation ?? {};
  disposition.reconciliation = {
    ...priorReconciliation,
    ...reconciliation,
    reconciledAt:
      priorReconciliation.reconciledAt ?? reconciliation.reconciledAt ?? new Date().toISOString(),
  };
  if (!Object.hasOwn(reconciliation, 'observedReportSha256')) {
    delete disposition.reconciliation.observedReportSha256;
  }
  nextEpoch.next_action = 'AUTO_MERGE_AFTER_G06_RECONCILIATION';
  updatePr(prNumber, nextEpoch);

  const observed = epochState(prNumber).state.adversarial_preflight?.g06_one_shot_disposition;
  if (
    observed?.claimId !== disposition.claimId ||
    observed.state !== disposition.state ||
    observed.reconciliation?.terminalLatch !== disposition.state ||
    typeof observed.reconciliation?.reconciledAt !== 'string' ||
    observed.reconciliation.reportValidation !== reconciliation.reportValidation ||
    observed.reconciliation.observedReportSha256 !== reconciliation.observedReportSha256
  ) {
    throw new HarnessInvariantError(
      'G06_ONESHOT_RECONCILIATION_READBACK_MISMATCH',
      'The terminal G06 reconciliation did not read back exactly.',
    );
  }

  const latestRun = issueState(runNumber);
  const nextRun = structuredClone(latestRun.state);
  if (nextRun.active_epoch_pr === Number(prNumber)) {
    nextRun.next_action = 'MERGE_AFTER_G06_RECONCILIATION';
    updateIssue(runNumber, nextRun);
  }
}

function commandEpochG06OneShotResult(
  claim,
  resultState,
  reportSha256 = null,
  { printOutput = true, reconciliation = null } = {},
) {
  ensureControlPlane();
  if (!['INCONCLUSIVE', 'REPORT_WRITTEN'].includes(resultState)) {
    throw new HarnessInvariantError(
      'G06_ONESHOT_RESULT_INVALID',
      'Only terminal G06 one-shot states are supported.',
    );
  }
  const runResult = issueState(claim.runNumber);
  const epochResult = epochState(claim.prNumber);
  const current = epochResult.state.adversarial_preflight?.g06_one_shot_disposition;
  if (
    !current ||
    current.claimId !== claim.claimId ||
    current.runNumber !== 95 ||
    current.prNumber !== Number(claim.prNumber) ||
    current.frontierId !== 'G06' ||
    current.epochId !== G06_EPOCH_ID ||
    current.toolName !== G06_TOOL_NAME ||
    current.argumentProfile !== G06_ARGUMENT_PROFILE ||
    current.expectedArgumentsSha256 !== canonicalHash(G06_EXPECTED_QUERY_ARGUMENTS) ||
    current.sourceCandidateSha !== claim.sourceCandidateSha ||
    current.baseSha !== claim.baseSha ||
    current.ciSha !== claim.sourceCandidateSha ||
    current.ciStatus !== 'SUCCESS' ||
    current.reviewerId !== claim.reviewerId ||
    current.bundleSha256 !== claim.bundleSha256 ||
    current.model !== G06_MODEL ||
    current.reasoningEffort !== G06_REASONING_EFFORT ||
    current.receiptPublicKey !== claim.receiptPublicKey ||
    current.retryAllowed !== false
  ) {
    throw new HarnessInvariantError(
      'G06_ONESHOT_CLAIM_MISMATCH',
      'Harness has no matching durable G06 one-shot claim.',
    );
  }

  let terminal;
  try {
    terminal = g06TerminalState(readG06OneShotTerminalGitHubLatch(gh));
  } catch (error) {
    if (error instanceof G06OneShotClaimError)
      throw new HarnessInvariantError(error.code, error.message);
    throw error;
  }
  if (current.state === resultState) {
    if (
      !terminal ||
      terminal.state !== resultState ||
      (resultState === 'REPORT_WRITTEN' && terminal.reportSha256 !== current.reportSha256)
    ) {
      throw new HarnessInvariantError(
        'G06_ONESHOT_TERMINAL_MISMATCH',
        'G06 Harness disposition and permanent terminal latch disagree.',
      );
    }
    if (resultState === 'REPORT_WRITTEN') {
      const report = validateG06SanitizedReportFile(
        current,
        G06_REPORT_ROOT,
        G06_EPOCH_REPORT_PATH,
      );
      if (!report.passed || report.reportSha256 !== current.reportSha256) {
        throw new HarnessInvariantError(
          'G06_ONESHOT_REPORT_INVALID',
          report.reason ?? 'Recorded G06 report is invalid.',
        );
      }
    }
    if (reconciliation) {
      persistG06ReconciliationMetadata(claim.runNumber, claim.prNumber, reconciliation);
    }
    const response = {
      state: 'G06_ONE_SHOT_RESULT_ALREADY_RECORDED',
      claimId: current.claimId,
      resultState,
      ...(resultState === 'REPORT_WRITTEN' ? { reportSha256: current.reportSha256 } : {}),
    };
    if (printOutput) print(response);
    return response;
  }
  if (current.state !== 'CLAIMED') {
    throw new HarnessInvariantError(
      'G06_ONESHOT_ALREADY_TERMINAL',
      'A terminal G06 one-shot result cannot be replaced.',
    );
  }
  if (
    runResult.state.active_epoch_pr !== Number(claim.prNumber) &&
    !runResult.state.parked_epoch_prs?.includes(Number(claim.prNumber))
  ) {
    throw new HarnessInvariantError(
      'G06_ONESHOT_CLAIM_MISMATCH',
      'G06 claim is no longer active or parked on Run #95.',
    );
  }

  let report = null;
  if (resultState === 'REPORT_WRITTEN') {
    assertG06PassedCandidateStillCurrent(
      claim,
      runResult.state,
      epochResult.state,
      epochResult.view,
    );
    report = validateG06SanitizedReportFile(
      { ...current, reportSha256 },
      G06_REPORT_ROOT,
      G06_EPOCH_REPORT_PATH,
    );
    if (
      !report.passed ||
      report.reportSha256 !== reportSha256 ||
      report.reportPath !== G06_REPORT_RELATIVE_PATH
    ) {
      throw new HarnessInvariantError(
        'G06_ONESHOT_REPORT_INVALID',
        report.reason ?? 'G06 report does not bind the claim.',
      );
    }
    if (
      terminal &&
      (terminal.state !== 'REPORT_WRITTEN' || terminal.reportSha256 !== reportSha256)
    ) {
      throw new HarnessInvariantError(
        'G06_ONESHOT_TERMINAL_CONFLICT',
        'A different permanent G06 terminal result already exists.',
      );
    }
  } else if (terminal && terminal.state !== 'INCONCLUSIVE') {
    throw new HarnessInvariantError(
      'G06_ONESHOT_TERMINAL_CONFLICT',
      'The permanent G06 result is REPORT_WRITTEN.',
    );
  }

  try {
    acquireG06OneShotTerminalGitHubLatch(
      gh,
      resultState,
      resultState === 'REPORT_WRITTEN' ? reportSha256 : null,
    );
  } catch (error) {
    if (error instanceof G06OneShotClaimError)
      throw new HarnessInvariantError(error.code, error.message);
    throw error;
  }
  const next = structuredClone(epochResult.state);
  next.adversarial_preflight.g06_one_shot_disposition = {
    ...current,
    state: resultState,
    reportWritten: resultState === 'REPORT_WRITTEN',
    ...(report ? { reportPath: report.reportPath, reportSha256: report.reportSha256 } : {}),
    ...(reconciliation ? { reconciliation } : {}),
    retryAllowed: false,
    finishedAt: new Date().toISOString(),
  };
  updatePr(claim.prNumber, next);
  if (reconciliation) {
    persistG06ReconciliationMetadata(claim.runNumber, claim.prNumber, reconciliation);
  }
  const observed = epochState(claim.prNumber).state.adversarial_preflight?.g06_one_shot_disposition;
  if (
    observed?.claimId !== claim.claimId ||
    observed.state !== resultState ||
    observed.retryAllowed !== false
  ) {
    throw new HarnessInvariantError(
      'G06_ONESHOT_RESULT_READBACK_MISMATCH',
      'The terminal G06 result did not read back exactly.',
    );
  }
  const response = {
    state: 'G06_ONE_SHOT_RESULT_RECORDED',
    claimId: claim.claimId,
    resultState,
    reportWritten: resultState === 'REPORT_WRITTEN',
    ...(report ? { reportSha256: report.reportSha256 } : {}),
  };
  if (printOutput) print(response);
  return response;
}

function persistHarnessG06OneShotResult(claim, state, reportSha256) {
  let response;
  try {
    response = commandEpochG06OneShotResult(claim, state, reportSha256, { printOutput: false });
  } catch {
    /* A GitHub write may have applied before its response was lost. */
  }
  if (
    ['G06_ONE_SHOT_RESULT_RECORDED', 'G06_ONE_SHOT_RESULT_ALREADY_RECORDED'].includes(
      response?.state,
    ) &&
    response.claimId === claim.claimId &&
    response.resultState === state &&
    (state !== 'REPORT_WRITTEN' || response.reportSha256 === reportSha256)
  )
    return true;
  try {
    const disposition = epochState(claim.prNumber).state.adversarial_preflight
      ?.g06_one_shot_disposition;
    const terminal = g06TerminalState(readG06OneShotTerminalGitHubLatch(gh));
    if (
      !disposition ||
      disposition.claimId !== claim.claimId ||
      disposition.state !== state ||
      disposition.retryAllowed !== false ||
      terminal?.state !== state ||
      (state === 'REPORT_WRITTEN' && terminal.reportSha256 !== reportSha256)
    )
      return false;
    if (state === 'INCONCLUSIVE') return true;
    const report = validateG06SanitizedReportFile(
      disposition,
      G06_REPORT_ROOT,
      G06_EPOCH_REPORT_PATH,
    );
    return report.passed && report.reportSha256 === reportSha256;
  } catch {
    return false;
  }
}

function commandEpochG06OneShotReconcile(options) {
  ensureControlPlane();
  const runNumber = Number(required(options, 'run'));
  const prNumber = Number(required(options, 'pr'));
  if (runNumber !== 95 || !Number.isSafeInteger(prNumber) || prNumber < 1) {
    throw new HarnessInvariantError(
      'G06_ONESHOT_RECONCILE_TARGET_INVALID',
      'G06 reconciliation is limited to Run #95 and a valid PR.',
    );
  }
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const claim = epochResult.state.adversarial_preflight?.g06_one_shot_disposition;
  if (
    epochResult.state.epoch_id !== G06_EPOCH_ID ||
    epochResult.state.pr_number !== prNumber ||
    (runResult.state.active_epoch_pr !== prNumber &&
      !runResult.state.parked_epoch_prs?.includes(prNumber)) ||
    !claim ||
    claim.runNumber !== runNumber ||
    claim.prNumber !== prNumber ||
    claim.epochId !== G06_EPOCH_ID ||
    claim.frontierId !== 'G06' ||
    claim.toolName !== G06_TOOL_NAME ||
    claim.argumentProfile !== G06_ARGUMENT_PROFILE ||
    !isG06RunnerReceiptPublicKey(claim.receiptPublicKey) ||
    claim.retryAllowed !== false
  ) {
    throw new HarnessInvariantError(
      'G06_ONESHOT_RECONCILE_CLAIM_INVALID',
      'The requested Run #95 G06 Epoch has no matching durable claim.',
    );
  }
  const localClaimPath = canonicalG06ClaimPath();
  if (fs.existsSync(localClaimPath)) {
    let localClaim;
    try {
      localClaim = readJsonFile(localClaimPath);
    } catch {
      throw new HarnessInvariantError(
        'G06_ONESHOT_LOCAL_CLAIM_INVALID',
        'Local G06 one-shot claim is unreadable; preserve it and never retry.',
      );
    }
    if (!localG06ClaimMatchesHarnessClaim(localClaim, claim)) {
      throw new HarnessInvariantError(
        'G06_ONESHOT_LOCAL_CLAIM_MISMATCH',
        'Local and durable G06 one-shot claims disagree; preserve both and never retry.',
      );
    }
  }
  try {
    verifyG06OneShotGitHubLatch(gh, claim.receiptPublicKey);
  } catch (error) {
    if (error instanceof G06OneShotClaimError)
      throw new HarnessInvariantError(error.code, error.message);
    throw error;
  }
  let terminal;
  try {
    terminal = g06TerminalState(readG06OneShotTerminalGitHubLatch(gh));
  } catch (error) {
    if (error instanceof G06OneShotClaimError)
      throw new HarnessInvariantError(error.code, error.message);
    throw error;
  }
  if (terminal) {
    let observedReportSha256 = null;
    let reportValidation = 'ABSENT';
    if (fs.existsSync(G06_EPOCH_REPORT_PATH)) {
      observedReportSha256 = createHash('sha256')
        .update(fs.readFileSync(G06_EPOCH_REPORT_PATH))
        .digest('hex');
      const checked = validateG06SanitizedReportFile(
        { ...claim, reportSha256: observedReportSha256 },
        G06_REPORT_ROOT,
        G06_EPOCH_REPORT_PATH,
      );
      if (terminal.state === 'REPORT_WRITTEN') {
        if (
          !checked.passed ||
          checked.reportSha256 !== terminal.reportSha256 ||
          observedReportSha256 !== terminal.reportSha256
        ) {
          throw new HarnessInvariantError(
            'G06_ONESHOT_REPORT_INVALID',
            checked.reason ?? 'The terminal G06 report does not match its permanent latch.',
          );
        }
        reportValidation = 'VALID';
        observedReportSha256 = checked.reportSha256;
      } else if (checked.passed) {
        throw new HarnessInvariantError(
          'G06_ONESHOT_TERMINAL_CONFLICT',
          'A valid claim-bound report conflicts with the permanent INCONCLUSIVE terminal latch.',
        );
      } else {
        reportValidation = 'INVALID';
      }
    } else if (terminal.state === 'REPORT_WRITTEN') {
      throw new HarnessInvariantError(
        'G06_ONESHOT_REPORT_INVALID',
        'The permanent REPORT_WRITTEN latch has no local sanitized report to reconcile.',
      );
    }
    const result = commandEpochG06OneShotResult(claim, terminal.state, terminal.reportSha256, {
      reconciliation: {
        terminalLatch: terminal.state,
        reportValidation,
        ...(observedReportSha256 ? { observedReportSha256 } : {}),
      },
    });
    print({
      state: 'G06_ONE_SHOT_RECONCILED',
      result: result.resultState,
      claimId: claim.claimId,
      retryAllowed: false,
    });
    return;
  }

  let reportSha256 = null;
  let reportIsValid = false;
  if (fs.existsSync(G06_EPOCH_REPORT_PATH)) {
    reportSha256 = createHash('sha256')
      .update(fs.readFileSync(G06_EPOCH_REPORT_PATH))
      .digest('hex');
    const checked = validateG06SanitizedReportFile(
      { ...claim, reportSha256 },
      G06_REPORT_ROOT,
      G06_EPOCH_REPORT_PATH,
    );
    reportIsValid = checked.passed && checked.reportSha256 === reportSha256;
  }
  const resultState = reportIsValid ? 'REPORT_WRITTEN' : 'INCONCLUSIVE';
  const result = commandEpochG06OneShotResult(
    claim,
    resultState,
    reportIsValid ? reportSha256 : null,
    {
      reconciliation: {
        terminalLatch: resultState,
        reportValidation: reportIsValid ? 'VALID' : reportSha256 ? 'INVALID' : 'ABSENT',
        ...(reportSha256 ? { observedReportSha256: reportSha256 } : {}),
      },
    },
  );
  print({
    state: 'G06_ONE_SHOT_RECONCILED',
    result: result.resultState,
    claimId: claim.claimId,
    retryAllowed: false,
  });
}

function commandEpochG06OneShotRun(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = Number(required(options, 'run'));
  if (runNumber !== 95) {
    throw new HarnessInvariantError(
      'G06_ONESHOT_RUN_INVALID',
      'G06 one-shot runs are limited to Run #95.',
    );
  }
  process.exitCode = runG06CodexAgentMcp({
    claimHarness: (gate) => commandEpochG06OneShotClaim(gate, { printOutput: false }),
    assertClaimStillClaimed: (claim) => {
      const current = epochState(claim.prNumber).state.adversarial_preflight
        ?.g06_one_shot_disposition;
      if (
        !current ||
        current.state !== 'CLAIMED' ||
        canonicalHash(current) !== canonicalHash(claim)
      ) {
        throw new HarnessInvariantError(
          'G06_ONESHOT_CLAIM_NO_LONGER_ACTIVE',
          'The exact durable G06 claim is no longer active.',
        );
      }
      const terminal = readG06OneShotTerminalGitHubLatch(gh);
      if (terminal)
        throw new HarnessInvariantError(
          'G06_ONESHOT_ALREADY_TERMINAL',
          'A permanent G06 terminal result already exists.',
        );
      return verifyG06OneShotGitHubLatch(gh, claim.receiptPublicKey) != null;
    },
    persistResult: (claim, state, reportSha256) =>
      persistHarnessG06OneShotResult(claim, state, reportSha256),
  });
}

function assertD07OneShotClaimReadiness(gate) {
  const {
    runNumber,
    prNumber,
    candidateSha,
    baseSha,
    bundleSha256,
    reviewerId,
    model,
    reasoningEffort,
  } = gate;
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const run = runResult.state;
  const epoch = epochResult.state;
  const pr = epochResult.view;
  const latestReview = epoch.review_history?.at(-1);
  git('fetch', '--no-tags', 'origin', 'master');
  const currentBaseSha = remoteBaseSha('master');
  const reviewerPattern = new RegExp(`^gpt-6-luna-max-run95-pr${prNumber}-round\\d+$`, 'u');
  const preflight = epoch.adversarial_preflight ?? {};
  if (
    Number(runNumber) !== 95 ||
    !Number.isSafeInteger(Number(prNumber)) ||
    Number(prNumber) < 1 ||
    !/^[0-9a-f]{40}$/u.test(candidateSha ?? '') ||
    !/^[0-9a-f]{40}$/u.test(baseSha ?? '') ||
    !/^[0-9a-f]{64}$/u.test(bundleSha256 ?? '') ||
    run.state !== 'EPOCH_ACTIVE' ||
    run.profile !== 'AUTONOMOUS_EVOLUTION' ||
    run.active_epoch_pr !== Number(prNumber) ||
    run.pending_epoch != null ||
    epoch.state !== 'REVIEW_PASSED' ||
    epoch.epoch_id !== D07_EPOCH_ID ||
    epoch.pr_number !== Number(prNumber) ||
    !epoch.advances_frontier_ids?.includes('D07') ||
    epoch.scope_closure?.related_work_remaining !== false ||
    preflight.completed !== true ||
    Object.hasOwn(preflight, 'd07_one_shot_disposition') ||
    epoch.branch !== currentBranch() ||
    currentHead() !== candidateSha ||
    git('status', '--porcelain') !== '' ||
    pr.state !== 'OPEN' ||
    pr.isDraft ||
    pr.baseRefName !== 'master' ||
    pr.headRefName !== epoch.branch ||
    pr.headRefOid !== candidateSha ||
    epoch.base_branch !== 'master' ||
    epoch.base_sha !== baseSha ||
    epoch.reviewed_base_sha !== baseSha ||
    currentBaseSha !== baseSha ||
    epoch.candidate_sha !== candidateSha ||
    epoch.review_pass_sha !== candidateSha ||
    epoch.ci?.sha !== candidateSha ||
    epoch.ci?.status !== 'SUCCESS' ||
    !mandatoryChecksSuccessful(pr.statusCheckRollup) ||
    model !== D07_MODEL ||
    reasoningEffort !== D07_REASONING_EFFORT ||
    latestReview?.candidate_sha !== candidateSha ||
    latestReview.reviewed_base_sha !== baseSha ||
    latestReview.verdict !== 'PASS' ||
    latestReview.reviewer_id !== reviewerId ||
    !reviewerPattern.test(reviewerId ?? '')
  ) {
    throw new HarnessInvariantError(
      'D07_ONESHOT_CLAIM_GATE_FAILED',
      'D07 one-shot requires the clean active exact Candidate, current Base, seven-check CI, and latest exact-identity Luna Max PASS.',
      { runNumber, prNumber, candidateSha, baseSha },
    );
  }
}

function commandEpochD07OneShotClaim(options, { printOutput = true } = {}) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const gate = {
    runNumber,
    prNumber,
    candidateSha: required(options, 'candidate'),
    baseSha: required(options, 'base'),
    claimId: required(options, 'claim-id'),
    reviewerId: required(options, 'reviewer-id'),
    bundleSha256: required(options, 'bundle-sha256'),
    model: required(options, 'model'),
    reasoningEffort: required(options, 'reasoning-effort'),
  };
  const expectedClaimIdPattern = new RegExp(
    `^d07-run-95-pr-${Number(prNumber)}-${gate.candidateSha.slice(0, 12)}-[0-9a-f]{12}$`,
    'u',
  );
  if (!expectedClaimIdPattern.test(gate.claimId)) {
    throw new HarnessInvariantError(
      'D07_ONESHOT_CLAIM_INVALID',
      'The D07 claim ID must bind the exact PR and Candidate.',
    );
  }
  assertD07OneShotClaimReadiness(gate);
  const claim = {
    claimId: gate.claimId,
    frontierId: 'D07',
    epochId: D07_EPOCH_ID,
    runNumber: Number(runNumber),
    prNumber: Number(prNumber),
    toolName: D07_TOOL_NAME,
    argumentProfile: D07_ARGUMENT_PROFILE,
    expectedArgumentsSha256: canonicalHash(D07_QUERY_ARGUMENTS_BY_YEAR),
    expectedCallCount: D07_EXPECTED_YEARS.length,
    sourceCandidateSha: gate.candidateSha,
    baseSha: gate.baseSha,
    ciSha: gate.candidateSha,
    ciStatus: 'SUCCESS',
    bundleSha256: gate.bundleSha256,
    reviewerId: gate.reviewerId,
    model: gate.model,
    reasoningEffort: gate.reasoningEffort,
    state: 'CLAIMED',
    reportWritten: false,
    reportSha256: null,
    retryAllowed: false,
    runnerPid: process.pid,
    claimedAt: new Date().toISOString(),
  };
  setD07RunnerProcessTitle(claim.claimId);
  try {
    claimD07OneShotAtomically({
      claim,
      assertReady: () => assertD07OneShotClaimReadiness(gate),
      persistLocalClaim: writeD07LocalClaimJournal,
      acquireGlobalLatch: () => acquireD07OneShotGitHubLatch(gh, claim.claimId),
      persistClaim: (value) => {
        const latest = epochState(prNumber);
        if (Object.hasOwn(latest.state.adversarial_preflight ?? {}, 'd07_one_shot_disposition')) {
          throw new HarnessInvariantError(
            'D07_ONESHOT_ALREADY_CLAIMED',
            'A durable D07 one-shot disposition already exists; refusing to overwrite it.',
          );
        }
        const next = structuredClone(latest.state);
        next.adversarial_preflight = {
          ...next.adversarial_preflight,
          d07_one_shot_disposition: value,
        };
        next.next_action = 'D07_ONE_SHOT_CLAIMED_DO_NOT_RETRY';
        updatePr(prNumber, next);
      },
      readClaim: () =>
        epochState(prNumber).state.adversarial_preflight?.d07_one_shot_disposition ?? null,
      verifyClaim: (observed, expected) => canonicalHash(observed) === canonicalHash(expected),
    });
  } catch (error) {
    if (error instanceof D07OneShotClaimError)
      throw new HarnessInvariantError(error.code, error.message);
    throw error;
  }
  if (printOutput) print({ state: 'D07_ONE_SHOT_CLAIMED', ...claim });
  return claim;
}

function commandEpochD07OneShotResult(options, { printOutput = true } = {}) {
  ensureControlPlane();
  const runNumber = Number(required(options, 'run'));
  const prNumber = Number(required(options, 'pr'));
  const claimId = required(options, 'claim-id');
  const resultState = required(options, 'state');
  const reportSha256 = options['report-sha256'] ?? null;
  if (!['INCONCLUSIVE', 'REPORT_WRITTEN'].includes(resultState)) {
    throw new HarnessInvariantError(
      'D07_ONESHOT_RESULT_INVALID',
      'Only terminal D07 results are supported.',
    );
  }
  const epochResult = epochState(prNumber);
  const current = epochResult.state.adversarial_preflight?.d07_one_shot_disposition;
  if (
    runNumber !== 95 ||
    epochResult.state.epoch_id !== D07_EPOCH_ID ||
    epochResult.state.pr_number !== prNumber ||
    current?.claimId !== claimId ||
    current?.retryAllowed !== false ||
    !Object.hasOwn(current ?? {}, 'reportWritten')
  ) {
    throw new HarnessInvariantError(
      'D07_ONESHOT_CLAIM_MISMATCH',
      'The active D07 PR does not contain the requested no-retry claim.',
    );
  }
  if (current.state !== 'CLAIMED') {
    if (
      current.state === resultState &&
      current.reportSha256 === reportSha256 &&
      current.reportPath === (resultState === 'REPORT_WRITTEN' ? D07_REPORT_RELATIVE_PATH : null) &&
      verifyD07OneShotGitHubLatch(gh, current.claimId) &&
      readD07OneShotTerminalGitHubLatch(gh)?.state === resultState
    ) {
      const result = { state: 'D07_ONE_SHOT_RESULT_ALREADY_RECORDED', claimId, resultState };
      if (printOutput) print(result);
      clearD07LocalClaimJournal(claimId);
      return result;
    }
    throw new HarnessInvariantError(
      'D07_ONESHOT_TERMINAL_IMMUTABLE',
      'A terminal D07 result cannot be replaced.',
    );
  }
  if (resultState === 'REPORT_WRITTEN') {
    if (!/^[0-9a-f]{64}$/u.test(reportSha256 ?? '') || !fs.existsSync(D07_REPORT_PATH)) {
      throw new HarnessInvariantError(
        'D07_ONESHOT_REPORT_MISSING',
        'REPORT_WRITTEN requires the claim-bound sanitized D07 report file and digest.',
      );
    }
    const observedSha256 = createHash('sha256')
      .update(fs.readFileSync(D07_REPORT_PATH))
      .digest('hex');
    if (observedSha256 !== reportSha256) {
      throw new HarnessInvariantError(
        'D07_ONESHOT_REPORT_DIGEST_MISMATCH',
        'The D07 report bytes do not match the supplied terminal digest.',
      );
    }
    let report;
    try {
      report = JSON.parse(fs.readFileSync(D07_REPORT_PATH, 'utf8'));
    } catch {
      throw new HarnessInvariantError(
        'D07_ONESHOT_REPORT_INVALID',
        'The D07 sanitized report is not valid JSON.',
      );
    }
    if (!validateD07SanitizedReport(report, current).passed) {
      throw new HarnessInvariantError(
        'D07_ONESHOT_REPORT_INVALID',
        'The D07 sanitized report does not match its immutable one-shot claim.',
      );
    }
  } else if (reportSha256 !== null || fs.existsSync(D07_REPORT_PATH)) {
    throw new HarnessInvariantError(
      'D07_ONESHOT_INCONCLUSIVE_REPORT_PRESENT',
      'An INCONCLUSIVE D07 result cannot retain an accepted report.',
    );
  }
  let terminal;
  try {
    verifyD07OneShotGitHubLatch(gh, current.claimId);
    terminal = acquireD07OneShotTerminalGitHubLatch(gh, resultState, reportSha256);
    verifyD07OneShotGitHubLatch(gh, current.claimId);
  } catch (error) {
    if (error instanceof D07OneShotClaimError)
      throw new HarnessInvariantError(error.code, error.message);
    throw error;
  }
  const next = structuredClone(epochResult.state);
  next.adversarial_preflight = {
    ...next.adversarial_preflight,
    d07_one_shot_disposition: {
      ...current,
      state: resultState,
      reportWritten: resultState === 'REPORT_WRITTEN',
      reportPath: resultState === 'REPORT_WRITTEN' ? D07_REPORT_RELATIVE_PATH : null,
      reportSha256,
      terminalLabel: terminal.state,
      finishedAt: new Date().toISOString(),
      retryAllowed: false,
    },
  };
  next.next_action =
    resultState === 'REPORT_WRITTEN'
      ? 'COMMIT_D07_REPORT_AND_REFRESH_CANDIDATE'
      : 'D07_ONE_SHOT_INCONCLUSIVE_NO_RETRY';
  updatePr(prNumber, next);
  clearD07LocalClaimJournal(claimId);
  const result = { state: 'D07_ONE_SHOT_RESULT_RECORDED', claimId, resultState, reportSha256 };
  if (printOutput) print(result);
  return result;
}

function commandEpochD07OneShotRun(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = Number(required(options, 'run'));
  if (runNumber !== 95) {
    throw new HarnessInvariantError(
      'D07_ONESHOT_RUN_INVALID',
      'D07 one-shot runs are limited to Run #95.',
    );
  }
  process.exitCode = runD07CodexAgentMcp({
    readGate: () => {
      const run = issueState(95).state;
      const prNumber = run.active_epoch_pr;
      if (!Number.isSafeInteger(prNumber)) {
        throw new HarnessInvariantError(
          'D07_ONESHOT_NO_ACTIVE_EPOCH',
          'Run 95 has no active D07 Epoch.',
        );
      }
      const result = epochState(prNumber);
      return {
        run: { ...run, number: 95 },
        epoch: result.state,
        pr: { ...result.view, number: prNumber },
      };
    },
    currentBaseSha: () => remoteBaseSha('master'),
    claimHarness: (gate) =>
      commandEpochD07OneShotClaim(
        {
          run: gate.runNumber,
          pr: gate.prNumber,
          candidate: gate.candidateSha,
          base: gate.baseSha,
          'claim-id': gate.claimId,
          'reviewer-id': gate.reviewerId,
          'bundle-sha256': gate.bundleSha256,
          model: gate.model,
          'reasoning-effort': gate.reasoningEffort,
        },
        { printOutput: false },
      ),
    assertClaimStillClaimed: (claim) => {
      git('fetch', '--no-tags', 'origin', 'master');
      if (remoteBaseSha('master') !== claim.baseSha) return false;
      const current = epochState(claim.prNumber).state.adversarial_preflight
        ?.d07_one_shot_disposition;
      if (
        !current ||
        current.state !== 'CLAIMED' ||
        canonicalHash(current) !== canonicalHash(claim)
      ) {
        return false;
      }
      verifyD07OneShotGitHubLatch(gh, claim.claimId);
      if (readD07OneShotTerminalGitHubLatch(gh)) return false;
      return true;
    },
    persistResult: (claim, state, reportSha256) => {
      const result = commandEpochD07OneShotResult(
        {
          run: claim.runNumber,
          pr: claim.prNumber,
          'claim-id': claim.claimId,
          state,
          ...(reportSha256 ? { 'report-sha256': reportSha256 } : {}),
        },
        { printOutput: false },
      );
      return (
        result?.state === 'D07_ONE_SHOT_RESULT_RECORDED' ||
        result?.state === 'D07_ONE_SHOT_RESULT_ALREADY_RECORDED'
      );
    },
  });
}

function commandEpochD07OneShotReconcile(options) {
  ensureControlPlane();
  const runNumber = Number(required(options, 'run'));
  const prNumber = Number(required(options, 'pr'));
  if (runNumber !== 95) {
    throw new HarnessInvariantError(
      'D07_ONESHOT_RECONCILE_INVALID',
      'D07 one-shot reconciliation is limited to Run #95.',
    );
  }
  let epochResult = epochState(prNumber);
  if (epochResult.state.epoch_id !== D07_EPOCH_ID || epochResult.state.pr_number !== prNumber) {
    throw new HarnessInvariantError(
      'D07_ONESHOT_RECONCILE_INVALID',
      'The requested PR is not the Run 95 D07 Epoch.',
    );
  }

  let disposition = epochResult.state.adversarial_preflight?.d07_one_shot_disposition;
  let localClaim = readD07LocalClaimJournal();
  let globalClaimLabel = readD07OneShotGitHubLatch(gh);
  let globalLatchMissing = globalClaimLabel === null;

  if (!disposition && globalLatchMissing && localClaim) {
    if (
      isD07RunnerProcessActive({ runnerPid: localClaim.runnerPid, claimId: localClaim.claimId })
    ) {
      throw new HarnessInvariantError(
        'D07_ONESHOT_RUNNER_ACTIVE',
        'The D07 claim preflight is still active; wait before reconciling its repository latch.',
      );
    }
    try {
      acquireD07OneShotGitHubLatch(gh, localClaim.claimId);
      globalClaimLabel = verifyD07OneShotGitHubLatch(gh, localClaim.claimId);
      globalLatchMissing = false;
    } catch (error) {
      if (error instanceof D07OneShotClaimError) {
        throw new HarnessInvariantError(error.code, error.message);
      }
      throw error;
    }
  }

  if (!disposition && globalLatchMissing) {
    throw new HarnessInvariantError(
      'D07_ONESHOT_CLAIM_MISSING',
      'The active D07 PR has no durable or local claim to reconcile; no query may be retried.',
    );
  }

  if (!disposition) {
    const globalClaimId = d07OneShotClaimIdFromLabel(globalClaimLabel);
    if (
      !globalClaimId ||
      !localClaim ||
      localClaim.claimId !== globalClaimId ||
      localClaim.runNumber !== runNumber ||
      localClaim.prNumber !== prNumber
    ) {
      throw new HarnessInvariantError(
        'D07_ONESHOT_ORPHAN_LATCH',
        'The permanent D07 latch has no matching local claim record; preserve it and never retry.',
      );
    }
    if (
      isD07RunnerProcessActive({ runnerPid: localClaim.runnerPid, claimId: localClaim.claimId })
    ) {
      throw new HarnessInvariantError(
        'D07_ONESHOT_RUNNER_ACTIVE',
        'The exact claim-bound D07 runner is still active; wait for its terminal result.',
      );
    }
    const next = structuredClone(epochResult.state);
    next.adversarial_preflight = {
      ...next.adversarial_preflight,
      d07_one_shot_disposition: localClaim,
    };
    next.next_action = 'D07_ONE_SHOT_CLAIMED_DO_NOT_RETRY';
    updatePr(prNumber, next);
    epochResult = epochState(prNumber);
    disposition = epochResult.state.adversarial_preflight?.d07_one_shot_disposition;
    if (!disposition || canonicalHash(disposition) !== canonicalHash(localClaim)) {
      throw new HarnessInvariantError(
        'D07_ONESHOT_CLAIM_READBACK_MISMATCH',
        'The orphan D07 claim journal could not be restored to the active PR body.',
      );
    }
  }

  if (!disposition) {
    throw new HarnessInvariantError(
      'D07_ONESHOT_CLAIM_MISSING',
      'The active D07 PR has no durable claim to reconcile; no query may be retried.',
    );
  }
  verifyD07OneShotGitHubLatch(gh, disposition.claimId);
  if (localClaim) {
    if (localClaim.claimId !== disposition.claimId) {
      throw new HarnessInvariantError(
        'D07_ONESHOT_LOCAL_CLAIM_MISMATCH',
        'The local D07 recovery journal does not match the durable PR claim.',
      );
    }
    const originalDisposition = structuredClone(disposition);
    if (originalDisposition.state !== 'CLAIMED') {
      for (const key of [
        'state',
        'reportWritten',
        'reportPath',
        'reportSha256',
        'terminalLabel',
        'finishedAt',
      ]) {
        delete originalDisposition[key];
      }
      originalDisposition.state = 'CLAIMED';
      originalDisposition.reportWritten = false;
      originalDisposition.reportPath = null;
      originalDisposition.reportSha256 = null;
    }
    if (canonicalHash(localClaim) !== canonicalHash(originalDisposition)) {
      throw new HarnessInvariantError(
        'D07_ONESHOT_LOCAL_CLAIM_MISMATCH',
        'The local D07 recovery journal does not match the durable PR claim.',
      );
    }
  }
  if (
    disposition.state === 'CLAIMED' &&
    isD07RunnerProcessActive({ runnerPid: disposition.runnerPid, claimId: disposition.claimId })
  ) {
    throw new HarnessInvariantError(
      'D07_ONESHOT_RUNNER_ACTIVE',
      'The exact claim-bound D07 runner is still active; wait for its terminal result.',
    );
  }
  if (disposition.state === 'CLAIMED') {
    fs.rmSync(d07RunnerTempDirectory(disposition.claimId), { recursive: true, force: true });
  }

  let resultState = disposition.state;
  let reportSha256 = disposition.reportSha256 ?? null;
  const terminal = readD07OneShotTerminalGitHubLatch(gh);
  if (terminal) {
    resultState = terminal.state;
    reportSha256 = terminal.reportSha256;
  } else if (disposition.state === 'CLAIMED') {
    if (fs.existsSync(D07_REPORT_PATH)) {
      const bytes = fs.readFileSync(D07_REPORT_PATH);
      let report;
      try {
        report = JSON.parse(bytes.toString('utf8'));
      } catch {
        throw new HarnessInvariantError(
          'D07_ONESHOT_REPORT_INVALID',
          'A report exists but is not valid JSON; preserve it and keep the D07 latch spent.',
        );
      }
      if (!validateD07SanitizedReport(report, disposition).passed) {
        throw new HarnessInvariantError(
          'D07_ONESHOT_REPORT_INVALID',
          'A report exists but does not match the durable D07 claim; preserve it and keep the latch spent.',
        );
      }
      reportSha256 = createHash('sha256').update(bytes).digest('hex');
      resultState = 'REPORT_WRITTEN';
    } else {
      reportSha256 = null;
      resultState = 'INCONCLUSIVE';
    }
  } else {
    throw new HarnessInvariantError(
      'D07_ONESHOT_TERMINAL_MISSING',
      'The D07 disposition is terminal but its permanent terminal latch is missing; keep the latch spent.',
    );
  }

  if (resultState === 'REPORT_WRITTEN') {
    if (!fs.existsSync(D07_REPORT_PATH)) {
      throw new HarnessInvariantError(
        'D07_ONESHOT_REPORT_MISSING',
        'The permanent D07 result claims a report that is not present locally.',
      );
    }
    const bytes = fs.readFileSync(D07_REPORT_PATH);
    const report = JSON.parse(bytes.toString('utf8'));
    const observed = createHash('sha256').update(bytes).digest('hex');
    if (observed !== reportSha256 || !validateD07SanitizedReport(report, disposition).passed) {
      throw new HarnessInvariantError(
        'D07_ONESHOT_REPORT_INVALID',
        'The permanent D07 result does not match the local claim-bound sanitized report.',
      );
    }
  } else if (fs.existsSync(D07_REPORT_PATH)) {
    throw new HarnessInvariantError(
      'D07_ONESHOT_INCONCLUSIVE_REPORT_PRESENT',
      'An inconclusive D07 result cannot accept a report file.',
    );
  }

  const result = commandEpochD07OneShotResult(
    {
      run: runNumber,
      pr: prNumber,
      'claim-id': disposition.claimId,
      state: resultState,
      ...(reportSha256 ? { 'report-sha256': reportSha256 } : {}),
    },
    { printOutput: false },
  );
  if (
    result?.state !== 'D07_ONE_SHOT_RESULT_RECORDED' &&
    result?.state !== 'D07_ONE_SHOT_RESULT_ALREADY_RECORDED'
  ) {
    throw new HarnessInvariantError(
      'D07_ONESHOT_RECONCILIATION_FAILED',
      'Harness did not confirm the D07 terminal result readback.',
    );
  }
  fs.rmSync(d07RunnerTempDirectory(disposition.claimId), { recursive: true, force: true });
  print({
    state: 'D07_ONE_SHOT_RECONCILED',
    result: resultState,
    claimId: disposition.claimId,
    retryAllowed: false,
  });
}

function assertP01OneShotClaimReadiness({
  run,
  epoch,
  pr,
  runNumber,
  prNumber,
  candidateSha,
  baseSha,
  bundleSha256,
  model,
  reasoningEffort,
  reviewerId,
  runnerReceiptPublicKey,
}) {
  const currentBaseSha = remoteBaseSha(epoch.base_branch);
  const latestReview = epoch.review_history?.at(-1);
  const reviewerPattern = new RegExp(`^gpt-6-luna-max-run95-pr${prNumber}-round\\d+$`, 'u');
  const preflight = epoch.adversarial_preflight ?? {};
  let runnerReceiptPublicKeySha256;
  try {
    runnerReceiptPublicKeySha256 = p01RunnerPublicKeySha256(runnerReceiptPublicKey);
  } catch {
    runnerReceiptPublicKeySha256 = null;
  }
  if (
    Number(runNumber) !== 95 ||
    run.state !== 'EPOCH_ACTIVE' ||
    run.active_epoch_pr !== Number(prNumber) ||
    run.pending_epoch != null ||
    run.profile !== 'AUTONOMOUS_EVOLUTION' ||
    epoch.state !== 'REVIEW_PASSED' ||
    epoch.epoch_id !== 'run95-p01-person-role-agent-mcp' ||
    epoch.pr_number !== Number(prNumber) ||
    !epoch.advances_frontier_ids?.includes('P01') ||
    Object.hasOwn(preflight, 'p01_one_shot_disposition') ||
    epoch.branch !== currentBranch() ||
    currentHead() !== candidateSha ||
    pr.state !== 'OPEN' ||
    pr.isDraft ||
    pr.baseRefName !== 'master' ||
    pr.headRefName !== epoch.branch ||
    pr.headRefOid !== candidateSha ||
    epoch.base_branch !== 'master' ||
    epoch.base_sha !== baseSha ||
    epoch.reviewed_base_sha !== baseSha ||
    currentBaseSha !== baseSha ||
    epoch.candidate_sha !== candidateSha ||
    epoch.review_pass_sha !== candidateSha ||
    epoch.ci?.sha !== candidateSha ||
    epoch.ci?.status !== 'SUCCESS' ||
    model !== 'gpt-6-luna' ||
    reasoningEffort !== 'max' ||
    !mandatoryChecksSuccessful(pr.statusCheckRollup) ||
    !/^[0-9a-f]{64}$/u.test(bundleSha256 ?? '') ||
    !/^[0-9a-f]{64}$/u.test(runnerReceiptPublicKeySha256 ?? '') ||
    latestReview?.candidate_sha !== candidateSha ||
    latestReview.reviewed_base_sha !== baseSha ||
    latestReview.verdict !== 'PASS' ||
    latestReview.reviewer_id !== reviewerId ||
    !reviewerPattern.test(reviewerId)
  ) {
    throw new HarnessInvariantError(
      'P01_ONESHOT_CLAIM_GATE_FAILED',
      'P01 one-shot claim requires the clean active exact Candidate, current Base, seven-check CI, and latest exact-identity Luna Max PASS.',
      { runNumber, prNumber, candidateSha, baseSha },
    );
  }
}

function commandEpochP01OneShotClaim(options, { printOutput = true } = {}) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const candidateSha = required(options, 'candidate');
  const baseSha = required(options, 'base');
  const bundleSha256 = required(options, 'bundle-sha256');
  const model = required(options, 'model');
  const reasoningEffort = required(options, 'reasoning-effort');
  const reviewerId = required(options, 'reviewer-id');
  const runnerReceiptPublicKey = required(options, 'runner-receipt-public-key');
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  if (Object.hasOwn(epochResult.state.adversarial_preflight ?? {}, 'p01_one_shot_disposition')) {
    throw new HarnessInvariantError(
      'P01_ONESHOT_ALREADY_CLAIMED',
      'A durable P01 one-shot claim or result already exists; refusing a duplicate claim.',
    );
  }
  assertP01OneShotClaimReadiness({
    run: runResult.state,
    epoch: epochResult.state,
    pr: epochResult.view,
    runNumber,
    prNumber,
    candidateSha,
    baseSha,
    bundleSha256,
    model,
    reasoningEffort,
    reviewerId,
    runnerReceiptPublicKey,
  });
  const claimedAt = new Date().toISOString();
  const argumentsSha256 = canonicalHash(P01_EXPECTED_QUERY_ARGUMENTS);
  const claimId = `p01-run-${runNumber}-pr-${prNumber}-${candidateSha.slice(0, 12)}-${Date.now()}`;
  const nextEpoch = structuredClone(epochResult.state);
  nextEpoch.adversarial_preflight = {
    ...nextEpoch.adversarial_preflight,
    p01_one_shot_disposition: {
      claimId,
      frontierId: 'P01',
      epochId: 'run95-p01-person-role-agent-mcp',
      runNumber: Number(runNumber),
      toolName: 'bangumi.get_person_activity',
      argumentProfile: P01_ARGUMENT_PROFILE,
      expectedArgumentsSha256: argumentsSha256,
      state: 'CLAIMED',
      sourceCandidateSha: candidateSha,
      baseSha,
      ciSha: candidateSha,
      ciStatus: 'SUCCESS',
      bundleSha256,
      prNumber: Number(prNumber),
      reviewerId,
      model,
      reasoningEffort,
      runnerReceiptPublicKey,
      runnerReceiptPublicKeySha256: p01RunnerPublicKeySha256(runnerReceiptPublicKey),
      reportWritten: false,
      retryAllowed: false,
      claimedAt,
    },
  };
  updatePr(prNumber, nextEpoch);
  const result = {
    state: 'P01_ONE_SHOT_CLAIMED',
    claimId,
    runNumber: Number(runNumber),
    candidateSha,
    baseSha,
    ciSha: candidateSha,
    ciStatus: 'SUCCESS',
    prNumber: Number(prNumber),
    reviewerId,
    bundleSha256,
    expectedArgumentsSha256: argumentsSha256,
    model,
    reasoningEffort,
    runnerReceiptPublicKeySha256: p01RunnerPublicKeySha256(runnerReceiptPublicKey),
  };
  if (printOutput) print(result);
  return result;
}

function p01ExecutionEnvironment(source = process.env) {
  const environment = sanitizeP01GitEnvironment(source);
  for (const key of Object.keys(environment)) {
    if (
      /(?:BANGUMI|BGM_|OAUTH|TOKEN|SECRET|CREDENTIAL|API[_-]?KEY|BASE[_-]?URL|MODEL[_-]?CATALOG|MODEL[_-]?PROVIDER|CODEX_PROFILE|CODEX_MODEL|CODEX_PROVIDER|ANTHROPIC|GEMINI|GOOGLE|VERTEX|AZURE|MISTRAL|OLLAMA|LMSTUDIO)/iu.test(
        key,
      )
    ) {
      delete environment[key];
    }
  }
  return environment;
}

function p01Sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function markP01Claim(claimPath, claim, state, summary) {
  try {
    const next = {
      ...claim,
      state,
      finishedAt: new Date().toISOString(),
      ...(summary ? { summary } : {}),
    };
    const temporary = `${claimPath}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(next, null, 2)}\n`, {
      mode: 0o600,
      flag: 'wx',
    });
    fs.renameSync(temporary, claimPath);
  } catch {
    /* Keep the original create-once claim if replacement fails. */
  }
}

function invokeP01Codex(options) {
  const result = spawnSync('codex', buildCodexExecArgs(options), {
    cwd: root,
    env: p01ExecutionEnvironment(),
    encoding: 'utf8',
    maxBuffer: P01_MAX_STDOUT_BYTES,
    timeout: P01_CODEX_TIMEOUT_MS,
    stdio: ['ignore', 'pipe', 'ignore'],
  });
  return {
    exitCode: Number.isInteger(result.status) ? result.status : 1,
    stdout: typeof result.stdout === 'string' ? result.stdout : '',
    failed: Boolean(result.error) || result.status !== 0,
  };
}

function invokeP01ReportWriter(input) {
  const result = spawnSync(process.execPath, [P01_REPORT_WRITER], {
    cwd: root,
    env: p01ExecutionEnvironment(),
    input: JSON.stringify(input),
    encoding: 'utf8',
    maxBuffer: 64 * 1024,
    timeout: 15_000,
    stdio: ['pipe', 'pipe', 'ignore'],
  });
  let output = null;
  try {
    output = JSON.parse(result.stdout ?? '');
  } catch {
    /* Writer stdout is sanitized. */
  }
  return { exitCode: result.status ?? 1, output };
}

function runP01CodexAgentMcp({ claimHarness, persistResult }) {
  const sourceRevision = cleanCandidate();
  const claimPath = canonicalP01ClaimPath();
  const initialGate = assertCurrentReviewGate(sourceRevision);
  const cliVersion = codexCliVersion();
  const bundleSha256 = buildExactCandidateBundle(sourceRevision);
  if (!currentBundleMatches(sourceRevision, bundleSha256))
    throw new Error('P01 MCP bundle changed before claim creation.');
  const currentGate = assertCurrentReviewGate(sourceRevision);
  if (
    currentGate.prNumber !== initialGate.prNumber ||
    currentGate.reviewerId !== initialGate.reviewerId ||
    currentGate.baseSha !== initialGate.baseSha
  ) {
    throw new Error(
      'Active P01 Epoch, Base, Candidate, or Luna Max reviewer changed during preflight.',
    );
  }
  const runnerReceiptKeyPair = generateP01RunnerReceiptKeyPair();
  const runnerReceiptPublicKey = runnerReceiptKeyPair.publicKeyBase64;
  const durableGate = { ...currentGate, bundleSha256, runnerReceiptPublicKey };
  const remoteClaim = claimHarness(durableGate);
  validateP01HarnessClaim(remoteClaim, durableGate);
  let claim;
  try {
    claim = createP01OneShotClaim(claimPath, {
      ...durableGate,
      sourceRevision,
      bundleSha256,
      claimId: remoteClaim.claimId,
    });
  } catch {
    persistResult(remoteClaim, 'INCONCLUSIVE');
    throw new Error(
      'P01 local create-once claim failed after the durable Harness claim; the frontier is terminal.',
    );
  }
  let temporaryDirectory;
  let reportSha256 = null;
  let safe = {
    codexCliVersion: cliVersion,
    sourceRevision,
    baseSha: currentGate.baseSha,
    prNumber: currentGate.prNumber,
    reviewerId: currentGate.reviewerId,
    bundleSha256,
    codexExitCode: null,
    eventStreamParsed: false,
    codexMcpToolEventCount: 0,
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    allowedCallCount: 0,
  };
  try {
    temporaryDirectory = fs.mkdtempSync(path.join(path.resolve(os.tmpdir()), 'bgk-p01-run95-'));
    const summaryPath = path.join(temporaryDirectory, 'server-summary.json');
    const execution = invokeP01Codex({
      nodePath: process.execPath,
      summaryPath,
      sourceRevision,
      bundleSha256,
    });
    const parsed = parseCodexJsonl(execution.stdout);
    const events = summarizeCodexEvents(parsed.events);
    const serverSummary = readServerSummary(summaryPath);
    const summaryMatches = serverSummaryMatchesCandidate(
      serverSummary,
      sourceRevision,
      bundleSha256,
    );
    const eventSummary = canonicalP01SafeEventSummary(events);
    safe = {
      ...safe,
      codexExitCode: execution.exitCode,
      eventStreamParsed: parsed.parsed && events.eventStreamComplete,
      ...eventSummary,
      targetServerMatch:
        events.mcpServerNames.length === 1 && events.mcpServerNames[0] === P01_SERVER_ID,
      allowedCallCount: Number.isSafeInteger(serverSummary?.allowedCallCount)
        ? serverSummary.allowedCallCount
        : 0,
      deniedCallCount: Number.isSafeInteger(serverSummary?.deniedCallCount)
        ? serverSummary.deniedCallCount
        : null,
      resultStatus:
        typeof serverSummary?.serverResultStatus === 'string'
          ? serverSummary.serverResultStatus
          : 'unavailable',
      serverSummaryMatchesCandidate: summaryMatches,
    };
    if (
      execution.failed ||
      !summaryMatches ||
      !currentBundleMatches(sourceRevision, bundleSha256) ||
      !parsed.parsed ||
      !events.eventStreamComplete ||
      events.codexMcpToolEventCount !== 1 ||
      events.mcpServerNames.length !== 1 ||
      events.mcpServerNames[0] !== P01_SERVER_ID ||
      events.completedMcpCalls.length !== 1 ||
      events.completedMcpCalls[0]?.tool !== P01_TOOL_NAME ||
      events.toolCalls.length !== 1 ||
      events.toolCalls[0]?.state !== 'DONE' ||
      hasUnexpectedP01CodexToolActivity(events) ||
      serverSummary?.allowedCallCount !== 1 ||
      serverSummary?.deniedCallCount !== 0 ||
      serverSummary?.serverResultStatus !== 'SUCCESS'
    ) {
      markP01Claim(claimPath, claim, 'INCONCLUSIVE', safe);
      persistResult(remoteClaim, 'INCONCLUSIVE');
      process.stdout.write(
        `${JSON.stringify({ passed: false, state: 'INCONCLUSIVE', ...safe })}\n`,
      );
      return 1;
    }
    const postGate = assertCurrentReviewGate(sourceRevision, {
      allowClaimed: true,
      bundleSha256,
      runnerReceiptPublicKey,
    });
    if (
      postGate.prNumber !== currentGate.prNumber ||
      postGate.baseSha !== currentGate.baseSha ||
      postGate.reviewerId !== currentGate.reviewerId
    ) {
      markP01Claim(claimPath, claim, 'INCONCLUSIVE', { ...safe, reason: 'active_epoch_changed' });
      persistResult(remoteClaim, 'INCONCLUSIVE');
      process.stdout.write(
        `${JSON.stringify({ passed: false, state: 'INCONCLUSIVE', ...safe, reason: 'active_epoch_changed' })}\n`,
      );
      return 1;
    }
    const call = events.completedMcpCalls[0];
    const answerResult = verifyP01PersonPositionAnswer(
      events.answer,
      call?.arguments,
      call?.result,
      events.toolCalls,
      textResultBytes(call?.result),
    );
    if (!answerResult.passed) {
      markP01Claim(claimPath, claim, 'INCONCLUSIVE', {
        ...safe,
        answerChecks: answerResult.answerChecks,
      });
      persistResult(remoteClaim, 'INCONCLUSIVE');
      process.stdout.write(
        `${JSON.stringify({
          passed: false,
          state: 'INCONCLUSIVE',
          ...safe,
          answerChecks: answerResult.answerChecks,
        })}\n`,
      );
      return 1;
    }
    const writerInput = {
      model: P01_MODEL,
      reasoningEffort: P01_REASONING_EFFORT,
      codexCliVersion: cliVersion,
      claimId: remoteClaim.claimId,
      runnerReceiptPublicKey,
      runnerEventStreamSha256: p01Sha256(execution.stdout),
      runnerServerSummarySha256: p01Sha256(fs.readFileSync(summaryPath)),
      processExitCode: execution.exitCode,
      resultStatus: serverSummary.serverResultStatus,
      eventStreamParsed: parsed.parsed && events.eventStreamComplete,
      serverToolNames: serverSummary.serverToolNames,
      serverToolCount: serverSummary.serverToolCount,
      codexMcpToolEventCount: events.codexMcpToolEventCount,
      mcpServerNames: events.mcpServerNames,
      nonMcpToolEventCount: events.nonMcpToolEventCount,
      nonMcpToolTypes: eventSummary.nonMcpToolTypes,
      shellToolCallCount: events.shellToolCallCount,
      allowedCallCount: serverSummary.allowedCallCount,
      deniedCallCount: serverSummary.deniedCallCount,
      privacy: serverSummary.privacy,
      serverResultSummary: serverSummary.result,
      candidateGate: {
        candidateSha: sourceRevision,
        baseSha: currentGate.baseSha,
        ciSha: sourceRevision,
        ciStatus: 'SUCCESS',
        reviewPassSha: sourceRevision,
        reviewVerdict: 'PASS',
        reviewerId: currentGate.reviewerId,
      },
      queryArguments: call?.arguments,
      answer: events.answer,
      toolOutput: call?.result,
      toolCalls: events.toolCalls,
      toolTextUtf8Bytes: textResultBytes(call?.result),
      sourceRevision,
      baseSha: currentGate.baseSha,
      bundleSha256,
      prNumber: currentGate.prNumber,
      reviewerId: currentGate.reviewerId,
    };
    const receiptPayload = buildP01RunnerReceiptPayload(writerInput, answerResult);
    writerInput.runnerReceipt = createP01RunnerReceipt(receiptPayload, runnerReceiptKeyPair);
    const writer = invokeP01ReportWriter(writerInput);
    if (writer.exitCode !== 0 || writer.output?.passed !== true) {
      const answerChecks = writer.output?.answerChecks ?? null;
      markP01Claim(claimPath, claim, 'INCONCLUSIVE', { ...safe, answerChecks });
      persistResult(remoteClaim, 'INCONCLUSIVE');
      process.stdout.write(
        `${JSON.stringify({ passed: false, state: 'INCONCLUSIVE', ...safe, answerChecks })}\n`,
      );
      return 1;
    }
    const output = writer.output;
    reportSha256 = p01Sha256(fs.readFileSync(P01_REPORT_PATH));
    markP01Claim(claimPath, claim, 'REPORT_WRITTEN_ACK_PENDING', {
      ...safe,
      reportSha256,
      answerCounters: output.answerCounters,
      resultSummary: output.resultSummary,
    });
    if (!persistResult(remoteClaim, 'REPORT_WRITTEN', reportSha256)) {
      markP01Claim(claimPath, claim, 'REPORT_WRITTEN_ACK_PENDING', {
        ...safe,
        reportSha256,
        reason: 'durable_harness_result_ack_unconfirmed; preserve report and do not retry query',
      });
      process.stdout.write(
        `${JSON.stringify({
          passed: false,
          state: 'REPORT_WRITTEN_ACK_PENDING',
          claimId: remoteClaim.claimId,
          reportSha256,
          ...safe,
          reason: 'durable_harness_result_ack_unconfirmed; preserve report and do not retry query',
        })}\n`,
      );
      return 1;
    }
    markP01Claim(claimPath, claim, 'REPORT_WRITTEN', {
      ...safe,
      reportSha256,
      answerCounters: output.answerCounters,
      resultSummary: output.resultSummary,
    });
    process.stdout.write(
      `${JSON.stringify({
        passed: true,
        state: 'REPORT_WRITTEN',
        sourceRevision,
        baseSha: currentGate.baseSha,
        bundleSha256,
        reportSha256,
        answerCounters: output.answerCounters,
        resultSummary: output.resultSummary,
      })}\n`,
    );
    return 0;
  } catch {
    if (reportSha256) {
      markP01Claim(claimPath, claim, 'REPORT_WRITTEN_ACK_PENDING', {
        ...safe,
        reportSha256,
        reason: 'runner_interrupted_after_report_write; preserve report and do not retry query',
      });
      persistResult(remoteClaim, 'REPORT_WRITTEN', reportSha256);
      process.stdout.write(
        `${JSON.stringify({
          passed: false,
          state: 'REPORT_WRITTEN_ACK_PENDING',
          claimId: remoteClaim.claimId,
          reportSha256,
          ...safe,
          reason: 'runner_interrupted_after_report_write; preserve report and do not retry query',
        })}\n`,
      );
      return 1;
    }
    markP01Claim(claimPath, claim, 'INCONCLUSIVE', safe);
    persistResult(remoteClaim, 'INCONCLUSIVE');
    process.stdout.write(`${JSON.stringify({ passed: false, state: 'INCONCLUSIVE', ...safe })}\n`);
    return 1;
  } finally {
    if (temporaryDirectory) fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
}

function commandEpochP01OneShotRun(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  if (Number(runNumber) !== 95) {
    throw new HarnessInvariantError(
      'P01_ONESHOT_RUN_INVALID',
      'P01 one-shot runs are limited to Run 95.',
    );
  }
  process.exitCode = runP01CodexAgentMcp({
    claimHarness: (gate) =>
      commandEpochP01OneShotClaim(
        {
          run: String(runNumber),
          pr: String(gate.prNumber),
          candidate: gate.candidateSha,
          base: gate.baseSha,
          'bundle-sha256': gate.bundleSha256,
          'runner-receipt-public-key': gate.runnerReceiptPublicKey,
          model: 'gpt-6-luna',
          'reasoning-effort': 'max',
          'reviewer-id': gate.reviewerId,
        },
        { printOutput: false },
      ),
    persistResult: (claim, state, reportSha256) =>
      persistHarnessP01OneShotResult(claim, state, reportSha256, {
        invoke: () =>
          commandEpochP01OneShotResult(
            {
              run: String(runNumber),
              pr: String(claim.prNumber),
              'claim-id': claim.claimId,
              state,
            },
            { printOutput: false },
          ),
        readStatus: (prNumber) => ({ epoch: epochState(prNumber) }),
      }),
  });
}

function commandEpochP01OneShotResult(options, { printOutput = true } = {}) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const claimId = required(options, 'claim-id');
  const resultState = required(options, 'state');
  if (Number(runNumber) !== 95) {
    throw new HarnessInvariantError(
      'P01_ONESHOT_RUN_INVALID',
      'P01 one-shot results are limited to Run 95.',
    );
  }
  if (!['INCONCLUSIVE', 'REPORT_WRITTEN'].includes(resultState)) {
    throw new HarnessInvariantError(
      'P01_ONESHOT_RESULT_INVALID',
      'Only terminal one-shot states are supported.',
    );
  }
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  if (
    runResult.state.active_epoch_pr !== Number(prNumber) ||
    runResult.state.pending_epoch != null
  ) {
    throw new HarnessInvariantError(
      'P01_ONESHOT_EPOCH_INACTIVE',
      'P01 result must belong to the active Epoch.',
    );
  }
  const current = epochResult.state.adversarial_preflight?.p01_one_shot_disposition;
  let runnerReceiptPublicKeyValid = false;
  try {
    runnerReceiptPublicKeyValid =
      p01RunnerPublicKeySha256(current?.runnerReceiptPublicKey) ===
      current?.runnerReceiptPublicKeySha256;
  } catch {
    runnerReceiptPublicKeyValid = false;
  }
  if (
    !current ||
    current.claimId !== claimId ||
    current.runNumber !== Number(runNumber) ||
    current.prNumber !== Number(prNumber) ||
    current.epochId !== 'run95-p01-person-role-agent-mcp' ||
    current.frontierId !== 'P01' ||
    current.toolName !== 'bangumi.get_person_activity' ||
    current.argumentProfile !== P01_ARGUMENT_PROFILE ||
    current.model !== 'gpt-6-luna' ||
    current.reasoningEffort !== 'max' ||
    current.ciSha !== current.sourceCandidateSha ||
    current.ciStatus !== 'SUCCESS' ||
    !/^[0-9a-f]{64}$/u.test(current.bundleSha256 ?? '') ||
    !runnerReceiptPublicKeyValid ||
    current.expectedArgumentsSha256 !== canonicalHash(P01_EXPECTED_QUERY_ARGUMENTS)
  ) {
    throw new HarnessInvariantError(
      'P01_ONESHOT_CLAIM_MISMATCH',
      'The durable Harness control plane has no matching P01 one-shot claim.',
      { runNumber, prNumber },
    );
  }
  if (current.state === resultState) {
    if (resultState === 'REPORT_WRITTEN') {
      const reportPath =
        process.env.HARNESS_MOCK_STATE && process.env.HARNESS_P01_REPORT_PATH
          ? path.resolve(process.env.HARNESS_P01_REPORT_PATH)
          : path.join(root, 'docs/live-probes/p01-person-position-agent-mcp-run95.json');
      const report = validateP01SanitizedReportFile(current, root, reportPath);
      if (!report.passed || report.reportSha256 !== current.reportSha256) {
        throw new HarnessInvariantError(
          'P01_ONESHOT_REPORT_INVALID',
          report.reason ?? 'The recorded P01 report hash no longer matches its durable result.',
        );
      }
    }
    const response = {
      state: 'P01_ONE_SHOT_RESULT_ALREADY_RECORDED',
      claimId,
      resultState,
      ...(resultState === 'REPORT_WRITTEN' ? { reportSha256: current.reportSha256 } : {}),
    };
    if (printOutput) print(response);
    return response;
  }
  if (current.state !== 'CLAIMED') {
    throw new HarnessInvariantError(
      'P01_ONESHOT_ALREADY_TERMINAL',
      'A terminal P01 one-shot result cannot be replaced.',
      { existingState: current.state, requestedState: resultState },
    );
  }
  let acceptedReport;
  if (resultState === 'REPORT_WRITTEN') {
    const activeEpoch = epochResult.state;
    const pr = epochResult.view;
    const latestReview = activeEpoch.review_history?.at(-1);
    const liveCandidateMatches =
      activeEpoch.state === 'REVIEW_PASSED' &&
      activeEpoch.epoch_id === current.epochId &&
      activeEpoch.pr_number === Number(prNumber) &&
      activeEpoch.branch === currentBranch() &&
      currentHead() === current.sourceCandidateSha &&
      pr.state === 'OPEN' &&
      !pr.isDraft &&
      pr.baseRefName === 'master' &&
      pr.headRefName === activeEpoch.branch &&
      pr.headRefOid === current.sourceCandidateSha &&
      activeEpoch.base_branch === 'master' &&
      activeEpoch.base_sha === current.baseSha &&
      activeEpoch.reviewed_base_sha === current.baseSha &&
      remoteBaseSha('master') === current.baseSha &&
      activeEpoch.candidate_sha === current.sourceCandidateSha &&
      activeEpoch.review_pass_sha === current.sourceCandidateSha &&
      activeEpoch.ci?.sha === current.ciSha &&
      activeEpoch.ci?.status === 'SUCCESS' &&
      latestReview?.candidate_sha === current.sourceCandidateSha &&
      latestReview.reviewed_base_sha === current.baseSha &&
      latestReview.reviewer_id === current.reviewerId &&
      latestReview.verdict === 'PASS' &&
      mandatoryChecksSuccessful(pr.statusCheckRollup);
    if (!liveCandidateMatches) {
      throw new HarnessInvariantError(
        'P01_ONESHOT_REPORT_STALE',
        'P01 REPORT_WRITTEN requires the claim Candidate, Base, CI, reviewer PASS, and open ready PR to remain current.',
      );
    }
    const reportPath =
      process.env.HARNESS_MOCK_STATE && process.env.HARNESS_P01_REPORT_PATH
        ? path.resolve(process.env.HARNESS_P01_REPORT_PATH)
        : path.join(root, 'docs/live-probes/p01-person-position-agent-mcp-run95.json');
    acceptedReport = validateP01SanitizedReportFile(current, root, reportPath);
    if (!acceptedReport.passed) {
      throw new HarnessInvariantError(
        'P01_ONESHOT_REPORT_INVALID',
        acceptedReport.reason ?? 'The P01 sanitized report failed validation.',
      );
    }
  }
  const nextEpoch = structuredClone(epochResult.state);
  nextEpoch.adversarial_preflight.p01_one_shot_disposition = {
    ...current,
    state: resultState,
    reportWritten: resultState === 'REPORT_WRITTEN',
    ...(acceptedReport
      ? { reportPath: acceptedReport.reportPath, reportSha256: acceptedReport.reportSha256 }
      : {}),
    retryAllowed: false,
    finishedAt: new Date().toISOString(),
  };
  updatePr(prNumber, nextEpoch);
  const response = {
    state: 'P01_ONE_SHOT_RESULT_RECORDED',
    claimId,
    resultState,
    reportWritten: resultState === 'REPORT_WRITTEN',
    ...(acceptedReport ? { reportSha256: acceptedReport.reportSha256 } : {}),
  };
  if (printOutput) print(response);
  return response;
}

function commandFrontierReviewReserve(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  const runtimeRecovery = options['runtime-recovery'] === true;
  const runResult = issueState(runNumber);
  if (currentBranch() !== 'master') {
    throw new HarnessInvariantError(
      'FRONTIER_REVIEW_MUST_RUN_ON_MASTER',
      'Frontier closure review must start from synchronized master',
    );
  }
  const baseSha = remoteBaseSha('master');
  if (currentHead() !== baseSha) {
    throw new HarnessInvariantError('MASTER_NOT_SYNCHRONIZED', 'master must equal origin/master');
  }
  const frontier = requireValidFrontier();
  const evidence = runtimeRecovery
    ? restoreEvidence(runResult.state.frontier_closure?.evidence)
    : readJsonFile(required(options, 'evidence'));
  if (!evidence) {
    throw new HarnessInvariantError(
      'FRONTIER_REVIEW_EVIDENCE_MISSING',
      'Runtime recovery requires the complete durable frontier closure evidence',
    );
  }
  assertDiscoveryExhaustionEvidence(evidence, baseSha, frontier);
  if (
    runtimeRecovery &&
    (runResult.state.frontier_closure.base_sha !== baseSha ||
      runResult.state.frontier_closure.ledger_hash !== frontier.hash ||
      runResult.state.frontier_closure.evidence_hash !== canonicalHash(evidence))
  ) {
    throw new HarnessInvariantError(
      'FRONTIER_REVIEW_EVIDENCE_CORRUPT',
      'Runtime recovery must reconstruct the exact originally reserved closure inputs',
    );
  }
  let next;
  try {
    next = reserveFrontierReview(runResult.state, {
      baseSha,
      ledgerHash: frontier.hash,
      evidenceHash: canonicalHash(evidence),
      runtimeRecovery,
    });
  } catch (error) {
    if (
      !(error instanceof HarnessInvariantError) ||
      !['FRONTIER_REVIEW_BUDGET_EXHAUSTED', 'FRONTIER_REVIEW_REJECTED'].includes(error.code)
    ) {
      throw error;
    }
    next = structuredClone(runResult.state);
    next.state = 'STOPPED_RUN_BUDGET_EXHAUSTED_RESUMABLE';
    next.next_action = 'START_NEW_OUTER_RUN_TO_CONTINUE_FRONTIER_DISCOVERY';
    updateIssue(runNumber, next);
    gh('issue', 'close', String(runNumber), '--reason', 'completed');
    print({ state: next.state, issue_state: 'CLOSED' });
    return;
  }
  next.frontier_closure.evidence = archiveEvidence(evidence);
  updateIssue(runNumber, next);
  print({
    state: runtimeRecovery
      ? 'FRONTIER_REVIEW_RUNTIME_RECOVERY_RESERVED'
      : 'FRONTIER_REVIEW_REQUIRED',
    base_sha: baseSha,
    ledger_hash: frontier.hash,
    evidence_hash: canonicalHash(evidence),
  });
}

function commandFrontierReviewReconcile(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const runResult = issueState(runNumber);
  const next = reconcileFrontierReviewReservation(
    runResult.state,
    options['definitely-not-started'] === true,
    { runtimeRecovery: options['runtime-recovery'] === true },
  );
  updateIssue(runNumber, next);
  print({
    state: next.state,
    counted_as_consumed: options['definitely-not-started'] !== true,
  });
}

function commandFrontierReviewStarted(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const reviewerId = required(options, 'reviewer-id');
  const runResult = issueState(runNumber);
  const next = markFrontierReviewStarted(runResult.state, reviewerId, {
    runtimeRecovery: options['runtime-recovery'] === true,
  });
  updateIssue(runNumber, next);
  print({ state: 'FRONTIER_REVIEW_RUNNING', reviewer_id: reviewerId });
}

function commandFrontierReviewWait(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const reviewerId = required(options, 'reviewer-id');
  const runResult = issueState(runNumber);
  const runtimeState = options['runtime-state'];
  if (runtimeState && runtimeState !== 'ACTIVE') {
    throw new HarnessInvariantError(
      'REVIEW_RUNTIME_STATE_INVALID',
      'frontier:review-wait is compatible only with an observed ACTIVE runtime',
    );
  }
  const result = waitForFrontierReviewer(runResult.state, reviewerId, runtimeState);
  print({
    state: 'WAIT_TIMEOUT_FRONTIER_REVIEWER_STILL_RUNNING',
    reviewer_id: reviewerId,
    durable_write: result.durableWrite,
    git_mutations: result.gitMutations,
    launches: result.launches,
  });
}

function commandFrontierReviewRuntime(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const reviewerId = required(options, 'reviewer-id');
  const runtimeState = required(options, 'runtime-state');
  const runResult = issueState(runNumber);
  const result = waitForFrontierReviewer(runResult.state, reviewerId, runtimeState, options.reason);
  if (result.durableWrite) updateIssue(runNumber, result.run);
  print({
    state: result.run.state,
    runtime_state: runtimeState,
    reviewer_id: reviewerId,
    durable_write: result.durableWrite,
    git_mutations: result.gitMutations,
    launches: result.launches,
  });
}

function commandFrontierReviewContext(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const runResult = issueState(runNumber);
  const evidence = restoreEvidence(
    runResult.state.frontier_closure?.evidence ??
      runResult.state.discovery_exhaustion?.evidence_archive,
  );
  if (!evidence) {
    throw new HarnessInvariantError(
      'FRONTIER_REVIEW_EVIDENCE_MISSING',
      'No durable frontier closure evidence is available for reconstruction',
    );
  }
  if (canonicalHash(evidence) !== runResult.state.frontier_closure.evidence_hash) {
    throw new HarnessInvariantError(
      'FRONTIER_REVIEW_EVIDENCE_CORRUPT',
      'Reconstructed frontier closure evidence does not match its bound hash',
    );
  }
  print(evidence);
}

function commandFrontierReviewResult(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const verdict = required(options, 'verdict');
  const findings = options.findings ? readJsonFile(options.findings) : [];
  const runResult = issueState(runNumber);
  const next = applyFrontierReviewResult(runResult.state, { verdict, findings });
  updateIssue(runNumber, next);
  print({ state: next.state, verdict });
}

function commandFrontierResumeDiscovery(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const runResult = issueState(runNumber);
  const next = resumeDiscoveryAfterFrontierRejection(runResult.state);
  updateIssue(runNumber, next);
  print({ state: next.state, closure_state: next.frontier_closure.state });
}

function commandEpochPark(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const state = required(options, 'state');
  const reason = required(options, 'reason');
  if (!['PARKED_FOR_HUMAN', 'INTEGRATION_BLOCKED'].includes(state)) {
    throw new HarnessInvariantError('INVALID_PARK_STATE', `Unsupported park state: ${state}`);
  }
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const epoch = structuredClone(epochResult.state);
  const runState = structuredClone(runResult.state);
  epoch.state = state;
  epoch.next_action = reason;
  runState.active_epoch_pr = null;
  if (!runState.parked_epoch_prs.includes(Number(prNumber))) {
    runState.parked_epoch_prs.push(Number(prNumber));
  }
  if (state === 'PARKED_FOR_HUMAN') {
    runState.state = 'ACTIVE';
    runState.next_action = 'SELECT_INDEPENDENT_SAFE_EPOCH_OR_STOP';
  } else {
    runState.state = 'INTEGRATION_BLOCKED';
    runState.next_action = `RESUME_PR_${prNumber}`;
  }
  updatePr(prNumber, epoch);
  updateIssue(runNumber, runState);
  print({ state, same_pr: Number(prNumber), branch: epoch.branch });
}

function commandEpochResumeFinalCorrective(options) {
  ensureControlPlane();
  ensureCleanWorkingTree();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  if (currentBranch() !== epochResult.state.branch) {
    throw new HarnessInvariantError(
      'WRONG_EPOCH_BRANCH',
      `Checkout ${epochResult.state.branch} before resuming final corrective`,
    );
  }
  const resumed = resumeReviewLimitForFinalCorrective(runResult.state, epochResult.state);
  updatePr(prNumber, resumed.epoch);
  updateIssue(runNumber, resumed.run);
  print({
    state: resumed.epoch.state,
    same_pr: Number(prNumber),
    branch: resumed.epoch.branch,
    review_launches_remaining: 0,
  });
}

function completeMergedIntegration({ runNumber, prNumber, runState, epoch, mergedPr }) {
  let result;
  try {
    if (currentBranch() !== epoch.base_branch) git('switch', epoch.base_branch);
    git('pull', '--ff-only', 'origin', epoch.base_branch);
    const candidateIsAncestor = isAncestor(epoch.candidate_sha, `origin/${epoch.base_branch}`);
    const mergeIsAncestor = isAncestor(mergedPr.mergeCommit.oid, `origin/${epoch.base_branch}`);
    if (!candidateIsAncestor || !mergeIsAncestor) {
      throw new HarnessInvariantError(
        'MERGE_VERIFICATION_FAILED',
        'The pushed target does not contain the reviewed Candidate and reported merge commit',
      );
    }
    result = completeMerge(runState, epoch, {
      mergeSha: mergedPr.mergeCommit.oid,
      candidateIsAncestor: true,
    });
    if (remoteBranchExists(epoch.branch)) git('push', 'origin', '--delete', epoch.branch);
    if (git('branch', '--list', epoch.branch)) git('branch', '-d', epoch.branch);
    git('fetch', 'origin', '--prune');
  } catch (error) {
    const blocked = recordIntegrationBlocked(
      runState,
      epoch,
      `PR MERGED as ${mergedPr.mergeCommit.oid}, but post-merge verification/cleanup failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
    blocked.epoch.merge_sha = mergedPr.mergeCommit.oid;
    blocked.epoch.github_pr_state = 'MERGED';
    updatePr(prNumber, blocked.epoch);
    updateIssue(runNumber, blocked.run);
    throw new HarnessInvariantError(
      'INTEGRATION_BLOCKED',
      'The PR merged, but verification or cleanup failed; control state records the blocker',
    );
  }
  updatePr(prNumber, result.epoch);
  updateIssue(runNumber, result.run);
  print({
    state: 'MERGED',
    merge_sha: mergedPr.mergeCommit.oid,
    candidate_sha: epoch.candidate_sha,
    branch_cleaned: epoch.branch,
  });
}

function assertD07OneShotReconciledBeforeMerge(epoch, runNumber, prNumber) {
  const disposition = epoch.adversarial_preflight?.d07_one_shot_disposition;
  const latestReview = epoch.review_history?.at(-1);
  const terminalState = disposition?.state;
  const reportWritten = terminalState === 'REPORT_WRITTEN';
  const claimReview = epoch.review_history?.find(
    (review) =>
      review?.candidate_sha === disposition?.sourceCandidateSha &&
      review?.reviewed_base_sha === disposition?.baseSha &&
      review?.verdict === 'PASS' &&
      review?.reviewer_id === disposition?.reviewerId,
  );
  if (
    epoch.epoch_id !== D07_EPOCH_ID ||
    epoch.state !== 'REVIEW_PASSED' ||
    epoch.pr_number !== Number(prNumber) ||
    !disposition ||
    disposition.runNumber !== Number(runNumber) ||
    disposition.prNumber !== Number(prNumber) ||
    disposition.epochId !== D07_EPOCH_ID ||
    disposition.frontierId !== 'D07' ||
    disposition.toolName !== D07_TOOL_NAME ||
    disposition.argumentProfile !== D07_ARGUMENT_PROFILE ||
    disposition.expectedArgumentsSha256 !== canonicalHash(D07_QUERY_ARGUMENTS_BY_YEAR) ||
    disposition.expectedCallCount !== D07_EXPECTED_YEARS.length ||
    !/^[0-9a-f]{40}$/u.test(disposition.sourceCandidateSha ?? '') ||
    disposition.baseSha !== epoch.base_sha ||
    disposition.ciSha !== disposition.sourceCandidateSha ||
    disposition.ciStatus !== 'SUCCESS' ||
    disposition.retryAllowed !== false ||
    !['INCONCLUSIVE', 'REPORT_WRITTEN'].includes(terminalState) ||
    disposition.reportWritten !== reportWritten ||
    disposition.reportPath !== (reportWritten ? D07_REPORT_RELATIVE_PATH : null) ||
    disposition.terminalLabel !== terminalState ||
    typeof disposition.finishedAt !== 'string' ||
    !claimReview ||
    disposition.model !== D07_MODEL ||
    disposition.reasoningEffort !== D07_REASONING_EFFORT ||
    latestReview?.candidate_sha !== epoch.candidate_sha ||
    latestReview?.reviewed_base_sha !== epoch.base_sha ||
    latestReview?.verdict !== 'PASS' ||
    epoch.review_pass_sha !== epoch.candidate_sha
  ) {
    throw new HarnessInvariantError(
      'D07_ONESHOT_RECONCILIATION_REQUIRED',
      'A D07 Epoch cannot merge without the exact no-retry claim and terminal result.',
    );
  }
  try {
    git('merge-base', '--is-ancestor', disposition.sourceCandidateSha, epoch.candidate_sha);
    verifyD07OneShotGitHubLatch(gh, disposition.claimId);
  } catch {
    throw new HarnessInvariantError(
      'D07_ONESHOT_RECONCILIATION_REQUIRED',
      'The original D07 claim or Candidate ancestry is not verified.',
    );
  }
  let terminal;
  try {
    terminal = readD07OneShotTerminalGitHubLatch(gh);
  } catch (error) {
    if (error instanceof D07OneShotClaimError)
      throw new HarnessInvariantError(error.code, error.message);
    throw error;
  }
  if (
    terminal?.state !== terminalState ||
    terminal.reportSha256 !== (disposition.reportSha256 ?? null)
  ) {
    throw new HarnessInvariantError(
      'D07_ONESHOT_RECONCILIATION_REQUIRED',
      'The permanent D07 terminal latch does not match the Epoch disposition.',
    );
  }
  if (reportWritten) {
    if (
      !/^[0-9a-f]{64}$/u.test(disposition.reportSha256 ?? '') ||
      !fs.existsSync(D07_REPORT_PATH)
    ) {
      throw new HarnessInvariantError(
        'D07_ONESHOT_REPORT_MISSING',
        'A D07 REPORT_WRITTEN disposition requires the sanitized report in the Candidate.',
      );
    }
    const reportBytes = fs.readFileSync(D07_REPORT_PATH);
    const observedSha256 = createHash('sha256').update(reportBytes).digest('hex');
    if (observedSha256 !== disposition.reportSha256) {
      throw new HarnessInvariantError(
        'D07_ONESHOT_REPORT_DIGEST_MISMATCH',
        'The D07 report bytes do not match the terminal disposition digest.',
      );
    }
    let report;
    try {
      report = JSON.parse(reportBytes.toString('utf8'));
    } catch {
      throw new HarnessInvariantError(
        'D07_ONESHOT_REPORT_INVALID',
        'The D07 report is not valid JSON.',
      );
    }
    if (!validateD07SanitizedReport(report, disposition).passed) {
      throw new HarnessInvariantError(
        'D07_ONESHOT_REPORT_INVALID',
        'The D07 report does not match its exact claim.',
      );
    }
    if (
      frontierContext().ledger.records.find((record) => record.id === 'D07')?.status !== 'PARTIAL'
    ) {
      throw new HarnessInvariantError(
        'D07_ONESHOT_FRONTIER_NOT_ADVANCED',
        'A valid D07 report must be committed with its bounded PARTIAL frontier evidence.',
      );
    }
  } else if (fs.existsSync(D07_REPORT_PATH)) {
    throw new HarnessInvariantError(
      'D07_ONESHOT_INCONCLUSIVE_REPORT_PRESENT',
      'An INCONCLUSIVE D07 result cannot merge with a D07 report file.',
    );
  }
  return reportWritten;
}

function assertG06OneShotReconciledBeforeMerge(epoch, runNumber, prNumber) {
  const disposition = epoch.adversarial_preflight?.g06_one_shot_disposition;
  const reconciliation = disposition?.reconciliation;
  const latestReview = epoch.review_history?.at(-1);
  const terminalState = disposition?.state;
  const reportWritten = terminalState === 'REPORT_WRITTEN';
  if (
    epoch.epoch_id !== G06_EPOCH_ID ||
    epoch.state !== 'REVIEW_PASSED' ||
    epoch.pr_number !== Number(prNumber) ||
    !disposition ||
    disposition.runNumber !== Number(runNumber) ||
    disposition.prNumber !== Number(prNumber) ||
    disposition.epochId !== G06_EPOCH_ID ||
    disposition.frontierId !== 'G06' ||
    disposition.toolName !== G06_TOOL_NAME ||
    disposition.argumentProfile !== G06_ARGUMENT_PROFILE ||
    disposition.expectedArgumentsSha256 !== canonicalHash(G06_EXPECTED_QUERY_ARGUMENTS) ||
    disposition.sourceCandidateSha !== epoch.candidate_sha ||
    disposition.baseSha !== epoch.base_sha ||
    disposition.ciSha !== epoch.candidate_sha ||
    disposition.ciStatus !== 'SUCCESS' ||
    epoch.review_pass_sha !== epoch.candidate_sha ||
    disposition.reviewerId !== latestReview?.reviewer_id ||
    latestReview?.candidate_sha !== epoch.candidate_sha ||
    latestReview?.reviewed_base_sha !== epoch.base_sha ||
    latestReview?.verdict !== 'PASS' ||
    disposition.model !== G06_MODEL ||
    disposition.reasoningEffort !== G06_REASONING_EFFORT ||
    disposition.retryAllowed !== false ||
    !['INCONCLUSIVE', 'REPORT_WRITTEN'].includes(terminalState) ||
    disposition.reportWritten !== reportWritten ||
    reconciliation?.terminalLatch !== terminalState ||
    typeof reconciliation?.reconciledAt !== 'string' ||
    reconciliation.reconciledAt.length === 0 ||
    (reportWritten && reconciliation.reportValidation !== 'VALID') ||
    (reportWritten && reconciliation.observedReportSha256 !== disposition.reportSha256) ||
    (!reportWritten && !['ABSENT', 'INVALID'].includes(reconciliation.reportValidation))
  ) {
    throw new HarnessInvariantError(
      'G06_ONESHOT_RECONCILIATION_REQUIRED',
      'A G06 Epoch cannot merge before its exact one-shot claim has a terminal, reconciled result.',
    );
  }

  verifyG06OneShotGitHubLatch(gh, disposition.receiptPublicKey);
  const terminal = g06TerminalState(readG06OneShotTerminalGitHubLatch(gh));
  if (
    terminal?.state !== terminalState ||
    (reportWritten && terminal.reportSha256 !== disposition.reportSha256) ||
    (!reportWritten && terminal.reportSha256 !== null)
  ) {
    throw new HarnessInvariantError(
      'G06_ONESHOT_RECONCILIATION_REQUIRED',
      'The permanent G06 terminal latch does not match the reconciled Epoch disposition.',
    );
  }
  if (reportWritten) {
    const report = validateG06SanitizedReportFile(
      disposition,
      G06_REPORT_ROOT,
      G06_EPOCH_REPORT_PATH,
    );
    if (!report.passed || report.reportSha256 !== disposition.reportSha256) {
      throw new HarnessInvariantError(
        'G06_ONESHOT_REPORT_INVALID',
        report.reason ?? 'The reconciled G06 report is no longer valid.',
      );
    }
  }
  return reportWritten;
}

function assertP05OneShotReconciledBeforeMerge(epoch, runNumber, prNumber) {
  const claim = epoch.adversarial_preflight?.p05_one_shot_disposition;
  const reviewerPattern = new RegExp(`^gpt-6-luna-max-run95-pr${prNumber}-round\\d+$`, 'u');
  if (
    !claim ||
    claim.frontierId !== 'P05' ||
    claim.epochId !== P05_EPOCH_ID ||
    claim.runNumber !== Number(runNumber) ||
    claim.prNumber !== Number(prNumber) ||
    !['INCONCLUSIVE', 'REPORT_WRITTEN'].includes(claim.state) ||
    claim.retryAllowed !== false ||
    claim.ciStatus !== 'SUCCESS' ||
    claim.ciSha !== claim.sourceCandidateSha ||
    claim.expectedArgumentsSha256 !== P05_ARGUMENTS_SHA256 ||
    !reviewerPattern.test(claim.reviewerId ?? '') ||
    claim.globalLatch?.name !== P05_ONE_SHOT_LATCH_LABEL_NAME ||
    claim.globalLatch?.description !== P05_ONE_SHOT_LATCH_LABEL_DESCRIPTION ||
    !epoch.advances_frontier_ids?.includes('P05') ||
    !epoch.review_history?.some(
      (review) =>
        review.candidate_sha === claim.sourceCandidateSha &&
        review.reviewed_base_sha === claim.baseSha &&
        review.reviewer_id === claim.reviewerId &&
        review.verdict === 'PASS',
    )
  ) {
    throw new HarnessInvariantError(
      'P05_ONESHOT_RECONCILIATION_REQUIRED',
      'P05 integration requires its exact durable terminal one-shot claim and permanent repository latch.',
    );
  }
  try {
    verifyP05OneShotGitHubLatch(gh);
  } catch (error) {
    if (error instanceof P05OneShotClaimError) {
      throw new HarnessInvariantError(error.code, error.message);
    }
    throw error;
  }

  if (claim.state === 'REPORT_WRITTEN' && claim.reportWritten !== true) {
    throw new HarnessInvariantError(
      'P05_ONESHOT_REPORT_INVALID',
      'A REPORT_WRITTEN P05 claim must bind an accepted report.',
    );
  }
  if (claim.state === 'INCONCLUSIVE' && claim.reportWritten !== false) {
    throw new HarnessInvariantError(
      'P05_ONESHOT_REPORT_INVALID',
      'An INCONCLUSIVE P05 claim cannot count its report as accepted evidence.',
    );
  }
  if (!claim.artifactPath && claim.artifactSha256 == null) {
    if (claim.state === 'REPORT_WRITTEN') {
      throw new HarnessInvariantError(
        'P05_ONESHOT_REPORT_INVALID',
        'A REPORT_WRITTEN P05 claim must include its report path and digest.',
      );
    }
    return;
  }
  if (
    claim.artifactPath !== P05_ONE_SHOT_REPORT_PATH ||
    !/^[0-9a-f]{64}$/u.test(claim.artifactSha256 ?? '')
  ) {
    throw new HarnessInvariantError(
      'P05_ONESHOT_REPORT_INVALID',
      'The durable P05 artifact path or digest is invalid.',
    );
  }
  const artifactPath = path.resolve(root, claim.artifactPath);
  if (!fs.existsSync(artifactPath)) {
    throw new HarnessInvariantError(
      'P05_ONESHOT_REPORT_MISSING',
      'The durable P05 claim names a report that is absent from the merge Candidate.',
    );
  }
  const artifactBytes = fs.readFileSync(artifactPath);
  const artifactSha256 = createHash('sha256').update(artifactBytes).digest('hex');
  if (artifactSha256 !== claim.artifactSha256) {
    throw new HarnessInvariantError(
      'P05_ONESHOT_REPORT_DIGEST_MISMATCH',
      'The P05 report bytes do not match the durable one-shot claim.',
    );
  }
  let report;
  try {
    report = JSON.parse(artifactBytes.toString('utf8'));
  } catch {
    throw new HarnessInvariantError(
      'P05_ONESHOT_REPORT_INVALID',
      'The P05 report is not valid JSON.',
    );
  }
  const expectedResultState = claim.state === 'REPORT_WRITTEN' ? 'SUCCESS' : 'INCONCLUSIVE';
  if (
    report.runNumber !== Number(runNumber) ||
    report.frontierId !== 'P05' ||
    report.epochId !== P05_EPOCH_ID ||
    report.prNumber !== Number(prNumber) ||
    report.claimId !== claim.claimId ||
    report.sourceRevision !== claim.sourceCandidateSha ||
    report.baseSha !== claim.baseSha ||
    report.ciSha !== claim.ciSha ||
    report.reviewerId !== claim.reviewerId ||
    report.reviewVerdict !== 'PASS' ||
    report.reviewPassSha !== claim.sourceCandidateSha ||
    report.toolName !== P05_TOOL_NAME ||
    report.argumentProfile !== P05_ARGUMENT_PROFILE ||
    canonicalHash(report.arguments) !== claim.expectedArgumentsSha256 ||
    report.toolInvocationCount !== 1 ||
    report.resultState !== expectedResultState
  ) {
    throw new HarnessInvariantError(
      'P05_ONESHOT_REPORT_INVALID',
      'The P05 report does not match the exact one-shot claim.',
    );
  }
  const expectedAssertions = [
    'exactHarnessCandidateGate',
    'exactPublicReadArguments',
    'exactlyOneToolInvocation',
    'anonymousPublicRequestObserved',
    'personMediaSummaryValid',
  ];
  if (
    claim.state === 'REPORT_WRITTEN' &&
    (!p05PersonMediaSummaryIsValid(report.resultSummary) ||
      Object.keys(report.assertions ?? {})
        .sort()
        .join(',') !== expectedAssertions.sort().join(',') ||
      expectedAssertions.some((key) => report.assertions[key] !== true))
  ) {
    throw new HarnessInvariantError(
      'P05_ONESHOT_REPORT_INVALID',
      'The P05 report assertions or returned-row summary are incomplete.',
    );
  }
}

function assertG06CastOfflineProfileReconciledBeforeMerge(epoch, runNumber, prNumber) {
  const profile = [G06_CAST_OFFLINE_PROFILE_ID, G06_CAST_OFFLINE_V2_PROFILE_ID]
    .map((profileId) => getAgentMcpProfileById(profileId))
    .find((candidate) => candidate?.epochId === epoch.epoch_id);
  const profileSpec = getG06CastOfflineProfileSpec(profile);
  const disposition = profile ? agentMcpProfileClaims(epoch)[profile.id] : null;
  const latestReview = epoch.review_history?.at(-1);
  const terminalState = disposition?.state;
  const reportWritten = terminalState === 'REPORT_WRITTEN';
  const terminalReportSha256 =
    disposition?.reportSha256 ?? disposition?.unacceptedReportSha256 ?? null;
  const claimReview = epoch.review_history?.find(
    (review) =>
      review?.candidate_sha === disposition?.sourceCandidateSha &&
      review?.reviewed_base_sha === disposition?.baseSha &&
      review?.reviewer_id === disposition?.reviewerId &&
      review?.verdict === 'PASS',
  );
  if (
    !profile ||
    !profileSpec ||
    epoch.epoch_id !== profile.epochId ||
    epoch.state !== 'REVIEW_PASSED' ||
    epoch.pr_number !== Number(prNumber) ||
    disposition?.profileId !== profile.id ||
    disposition.frontierId !== 'G06' ||
    disposition.epochId !== profile.epochId ||
    disposition.runNumber !== Number(runNumber) ||
    disposition.prNumber !== Number(prNumber) ||
    disposition.toolName !== 'bangumi.get_subject_cast' ||
    disposition.argumentProfile !== profile.argumentProfile ||
    disposition.expectedArgumentsSha256 !== agentMcpProfileArgumentsSha256(profile) ||
    disposition.registrySha256 !== agentMcpProfileRegistrySha256(profile.id) ||
    disposition.retryAllowed !== false ||
    !['INCONCLUSIVE', 'REPORT_WRITTEN'].includes(terminalState) ||
    disposition.reportWritten !== reportWritten ||
    !/^[0-9a-f]{40}$/u.test(disposition.sourceCandidateSha ?? '') ||
    !isAncestor(disposition.sourceCandidateSha, epoch.candidate_sha) ||
    disposition.baseSha !== epoch.base_sha ||
    disposition.ciSha !== disposition.sourceCandidateSha ||
    disposition.ciStatus !== 'SUCCESS' ||
    disposition.reviewerId !== claimReview?.reviewer_id ||
    claimReview?.reviewed_base_sha !== disposition.baseSha ||
    latestReview?.candidate_sha !== epoch.candidate_sha ||
    latestReview?.reviewed_base_sha !== epoch.base_sha ||
    latestReview?.verdict !== 'PASS' ||
    epoch.review_pass_sha !== epoch.candidate_sha ||
    !isG16LunaMaxReviewerId(latestReview?.reviewer_id, Number(prNumber)) ||
    !epoch.advances_frontier_ids?.includes('G06')
  ) {
    throw new HarnessInvariantError(
      'G06_CAST_OFFLINE_RECONCILIATION_REQUIRED',
      'The G06 offline matrix Epoch requires its exact terminal profile claim and reviewed final Candidate before merge.',
    );
  }

  const labels = readAgentMcpProfileLabels();
  const claimLabel = labels.find((label) => label.name === profile.claimLabelName);
  const terminalLabel = labels.find(
    (label) => label.name === agentMcpProfileTerminalLabelName(profile),
  );
  let expectedTerminalDescription;
  try {
    expectedTerminalDescription = agentMcpProfileTerminalLabelDescription(
      profile,
      terminalState,
      terminalReportSha256,
    );
  } catch {
    expectedTerminalDescription = null;
  }
  if (
    claimLabel?.description !== agentMcpProfileClaimLabelDescription(profile) ||
    !terminalLabel ||
    terminalLabel.description !== expectedTerminalDescription
  ) {
    throw new HarnessInvariantError(
      'G06_CAST_OFFLINE_TERMINAL_LATCH_MISMATCH',
      'The permanent G06 offline profile claim and terminal labels must match its durable disposition.',
    );
  }

  const frontier = frontierContext().ledger;
  const record = frontier.records.find((item) => item.id === 'G06');
  const sourceRefs = record?.source_refs;
  const reportPath = path.join(G06_REPORT_ROOT, profile.reportPath);
  if (
    record?.status !== 'PARTIAL' ||
    !Array.isArray(sourceRefs) ||
    !sourceRefs.includes(profile.selectionEvidencePath)
  ) {
    throw new HarnessInvariantError(
      'G06_CAST_OFFLINE_FRONTIER_INVALID',
      'The G06 scenario must remain PARTIAL and cite the matrix-only selection contract.',
    );
  }

  const changed = new Set(changedPaths(disposition.sourceCandidateSha));
  const allowedRefreshPaths = new Set([
    profile.reportPath,
    'docs/product/frontier-ledger.json',
    'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
    ...(profile.id === G06_CAST_OFFLINE_V2_PROFILE_ID
      ? G06_CAST_OFFLINE_V2_ACCEPTANCE_REFRESH_PATHS
      : []),
  ]);
  if ([...changed].some((item) => !allowedRefreshPaths.has(item))) {
    throw new HarnessInvariantError(
      'G06_CAST_OFFLINE_REFRESH_SCOPE_INVALID',
      profile.id === G06_CAST_OFFLINE_V2_PROFILE_ID
        ? 'The final Candidate may contain only the validated G06 report, its frontier reference, generated matrix, source-catalog helper, and exact G06 v2 acceptance verifier files.'
        : 'The final Candidate may contain only the validated G06 report, its frontier reference, and generated matrix refresh.',
      { changed: [...changed] },
    );
  }

  if (reportWritten) {
    if (
      disposition.reportPath !== profile.reportPath ||
      !/^[0-9a-f]{64}$/u.test(disposition.reportSha256 ?? '') ||
      !sourceRefs.includes(profile.reportPath) ||
      !changed.has(profile.reportPath) ||
      !changed.has('docs/product/frontier-ledger.json') ||
      !changed.has('docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md')
    ) {
      throw new HarnessInvariantError(
        'G06_CAST_OFFLINE_REPORT_REFRESH_REQUIRED',
        'A written G06 matrix report must be committed with its G06 source reference and generated acceptance row.',
      );
    }
    const validation = validateG06SubjectCastOfflineSanitizedReportFile(
      disposition,
      root,
      reportPath,
    );
    if (!validation.passed || validation.reportSha256 !== disposition.reportSha256) {
      throw new HarnessInvariantError(
        'G06_CAST_OFFLINE_REPORT_INVALID',
        validation.reason ?? 'The G06 offline matrix report does not match its terminal claim.',
      );
    }
  } else if (
    (disposition.reportPath !== undefined && disposition.reportPath !== null) ||
    disposition.reportSha256 !== undefined ||
    (disposition.unacceptedReportSha256 !== undefined &&
      !/^[0-9a-f]{64}$/u.test(disposition.unacceptedReportSha256)) ||
    fs.existsSync(reportPath)
  ) {
    throw new HarnessInvariantError(
      'G06_CAST_OFFLINE_INCONCLUSIVE_REPORT_PRESENT',
      'An inconclusive G06 offline matrix claim cannot merge with a report artifact.',
    );
  }
}

function assertC07RenderComparisonOfflineProfileReconciledBeforeMerge(
  epoch,
  runNumber,
  prNumber,
  profileId = C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID,
) {
  const config = getC07RenderComparisonOfflineConfig(profileId);
  const profile = getAgentMcpProfileById(profileId);
  const disposition = agentMcpProfileClaims(epoch)[profileId];
  const latestReview = epoch.review_history?.at(-1);
  const terminalState = disposition?.state;
  const reportWritten = terminalState === 'REPORT_WRITTEN';
  const terminalReportSha256 =
    disposition?.reportSha256 ?? disposition?.unacceptedReportSha256 ?? null;
  const claimReview = epoch.review_history?.find(
    (review) =>
      review?.candidate_sha === disposition?.sourceCandidateSha &&
      review?.reviewed_base_sha === disposition?.baseSha &&
      review?.reviewer_id === disposition?.reviewerId &&
      review?.verdict === 'PASS',
  );
  if (
    !config ||
    epoch.epoch_id !== config.epochId ||
    epoch.state !== 'REVIEW_PASSED' ||
    epoch.pr_number !== Number(prNumber) ||
    !profile ||
    disposition?.profileId !== profileId ||
    disposition.frontierId !== 'C07' ||
    disposition.epochId !== config.epochId ||
    disposition.runNumber !== Number(runNumber) ||
    disposition.prNumber !== Number(prNumber) ||
    disposition.toolName !== 'bangumi.render_subject_cohort_comparison' ||
    disposition.argumentProfile !== config.argumentProfile ||
    disposition.expectedArgumentsSha256 !== agentMcpProfileArgumentsSha256(profile) ||
    disposition.registrySha256 !== agentMcpProfileRegistrySha256(profile.id) ||
    disposition.retryAllowed !== false ||
    !['INCONCLUSIVE', 'REPORT_WRITTEN'].includes(terminalState) ||
    disposition.reportWritten !== reportWritten ||
    !/^[0-9a-f]{40}$/u.test(disposition.sourceCandidateSha ?? '') ||
    !isAncestor(disposition.sourceCandidateSha, epoch.candidate_sha) ||
    disposition.baseSha !== epoch.base_sha ||
    disposition.ciSha !== disposition.sourceCandidateSha ||
    disposition.ciStatus !== 'SUCCESS' ||
    disposition.reviewerId !== claimReview?.reviewer_id ||
    claimReview?.reviewed_base_sha !== disposition.baseSha ||
    latestReview?.candidate_sha !== epoch.candidate_sha ||
    latestReview?.reviewed_base_sha !== epoch.base_sha ||
    latestReview?.verdict !== 'PASS' ||
    epoch.review_pass_sha !== epoch.candidate_sha ||
    !isG16LunaMaxReviewerId(latestReview?.reviewer_id, Number(prNumber)) ||
    !epoch.advances_frontier_ids?.includes('C07')
  ) {
    throw new HarnessInvariantError(
      'C07_RENDER_COMPARISON_OFFLINE_RECONCILIATION_REQUIRED',
      'The C07 offline renderer matrix Epoch requires its exact terminal profile claim and reviewed final Candidate before merge.',
    );
  }

  const labels = readAgentMcpProfileLabels();
  const claimLabel = labels.find((label) => label.name === profile.claimLabelName);
  const terminalLabel = labels.find(
    (label) => label.name === agentMcpProfileTerminalLabelName(profile),
  );
  let expectedTerminalDescription;
  try {
    expectedTerminalDescription = agentMcpProfileTerminalLabelDescription(
      profile,
      terminalState,
      terminalReportSha256,
    );
  } catch {
    expectedTerminalDescription = null;
  }
  if (
    claimLabel?.description !== agentMcpProfileClaimLabelDescription(profile) ||
    !terminalLabel ||
    terminalLabel.description !== expectedTerminalDescription
  ) {
    throw new HarnessInvariantError(
      'C07_RENDER_COMPARISON_OFFLINE_TERMINAL_LATCH_MISMATCH',
      'The permanent C07 offline profile claim and terminal labels must match its durable disposition.',
    );
  }

  const frontier = frontierContext().ledger;
  const record = frontier.records.find((item) => item.id === 'C07');
  const sourceRefs = record?.source_refs;
  if (
    record?.status !== 'UNASSESSED' ||
    !Array.isArray(sourceRefs) ||
    !sourceRefs.includes(config.selectionEvidencePath)
  ) {
    throw new HarnessInvariantError(
      'C07_RENDER_COMPARISON_OFFLINE_FRONTIER_INVALID',
      'The C07 scenario must remain UNASSESSED and cite the matrix-only selection contract.',
    );
  }

  const reportPath = path.join(root, config.reportPath);
  const changed = new Set(changedPaths(disposition.sourceCandidateSha));
  const allowedRefreshPaths = new Set([
    config.reportPath,
    'docs/product/frontier-ledger.json',
    'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
  ]);
  if ([...changed].some((item) => !allowedRefreshPaths.has(item))) {
    throw new HarnessInvariantError(
      'C07_RENDER_COMPARISON_OFFLINE_REFRESH_SCOPE_INVALID',
      'The final Candidate may contain only the validated C07 matrix report, its frontier reference, and generated acceptance matrix.',
      { changed: [...changed] },
    );
  }

  if (reportWritten) {
    if (
      disposition.reportPath !== config.reportPath ||
      !/^[0-9a-f]{64}$/u.test(disposition.reportSha256 ?? '') ||
      (disposition.unacceptedReportSha256 !== null &&
        disposition.unacceptedReportSha256 !== undefined) ||
      !sourceRefs.includes(config.reportPath) ||
      !changed.has(config.reportPath) ||
      !changed.has('docs/product/frontier-ledger.json') ||
      !changed.has('docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md')
    ) {
      throw new HarnessInvariantError(
        'C07_RENDER_COMPARISON_OFFLINE_REPORT_REFRESH_REQUIRED',
        'A written C07 matrix report must be committed with its frontier reference and generated acceptance row.',
      );
    }
    const validation = validateC07RenderComparisonOfflineSanitizedReportFile(
      disposition,
      root,
      reportPath,
    );
    if (!validation.passed || validation.reportSha256 !== disposition.reportSha256) {
      throw new HarnessInvariantError(
        'C07_RENDER_COMPARISON_OFFLINE_REPORT_INVALID',
        validation.reason ??
          'The C07 offline renderer matrix report does not match its terminal claim.',
      );
    }
  } else if (
    (disposition.reportPath !== undefined && disposition.reportPath !== null) ||
    disposition.reportSha256 !== undefined ||
    (disposition.unacceptedReportSha256 !== null &&
      disposition.unacceptedReportSha256 !== undefined &&
      !/^[0-9a-f]{64}$/u.test(disposition.unacceptedReportSha256)) ||
    fs.existsSync(reportPath)
  ) {
    throw new HarnessInvariantError(
      'C07_RENDER_COMPARISON_OFFLINE_INCONCLUSIVE_REPORT_PRESENT',
      'An inconclusive C07 offline matrix claim cannot merge with an accepted report artifact.',
    );
  }
}

function assertG01RenderQueryOfflineProfileReconciledBeforeMerge(
  epoch,
  runNumber,
  prNumber,
  profileId = G01_RENDER_QUERY_OFFLINE_PROFILE_ID,
) {
  const profile = getAgentMcpProfileById(profileId);
  const profileSpec = getG01RenderQueryOfflineProfileSpec(profileId);
  const disposition = agentMcpProfileClaims(epoch)[profileId];
  const latestReview = epoch.review_history?.at(-1);
  const terminalState = disposition?.state;
  const reportWritten = terminalState === 'REPORT_WRITTEN';
  const terminalReportSha256 =
    disposition?.reportSha256 ?? disposition?.unacceptedReportSha256 ?? null;
  const claimReview = epoch.review_history?.find(
    (review) =>
      review?.candidate_sha === disposition?.sourceCandidateSha &&
      review?.reviewed_base_sha === disposition?.baseSha &&
      review?.reviewer_id === disposition?.reviewerId &&
      review?.verdict === 'PASS',
  );
  if (
    !profileSpec ||
    epoch.epoch_id !== profileSpec.epochId ||
    epoch.state !== 'REVIEW_PASSED' ||
    epoch.pr_number !== Number(prNumber) ||
    !profile ||
    disposition?.profileId !== profileId ||
    disposition.frontierId !== 'G01' ||
    disposition.epochId !== profileSpec.epochId ||
    disposition.runNumber !== Number(runNumber) ||
    disposition.prNumber !== Number(prNumber) ||
    disposition.toolName !== 'bangumi.render_query_subjects' ||
    disposition.argumentProfile !== profileSpec.argumentProfile ||
    disposition.expectedArgumentsSha256 !== agentMcpProfileArgumentsSha256(profile) ||
    disposition.registrySha256 !== agentMcpProfileRegistrySha256(profile.id) ||
    disposition.retryAllowed !== false ||
    !['INCONCLUSIVE', 'REPORT_WRITTEN'].includes(terminalState) ||
    disposition.reportWritten !== reportWritten ||
    !/^[0-9a-f]{40}$/u.test(disposition.sourceCandidateSha ?? '') ||
    !isAncestor(disposition.sourceCandidateSha, epoch.candidate_sha) ||
    disposition.baseSha !== epoch.base_sha ||
    disposition.ciSha !== disposition.sourceCandidateSha ||
    disposition.ciStatus !== 'SUCCESS' ||
    disposition.reviewerId !== claimReview?.reviewer_id ||
    claimReview?.reviewed_base_sha !== disposition.baseSha ||
    latestReview?.candidate_sha !== epoch.candidate_sha ||
    latestReview?.reviewed_base_sha !== epoch.base_sha ||
    latestReview?.verdict !== 'PASS' ||
    epoch.review_pass_sha !== epoch.candidate_sha ||
    !isG16LunaMaxReviewerId(latestReview?.reviewer_id, Number(prNumber)) ||
    !epoch.advances_frontier_ids?.includes('G01')
  ) {
    throw new HarnessInvariantError(
      'G01_RENDER_QUERY_OFFLINE_RECONCILIATION_REQUIRED',
      'The G01 offline render-query matrix Epoch requires its exact terminal profile claim and reviewed final Candidate before merge.',
    );
  }

  const labels = readAgentMcpProfileLabels();
  const claimLabel = labels.find((label) => label.name === profile.claimLabelName);
  const terminalLabel = labels.find(
    (label) => label.name === agentMcpProfileTerminalLabelName(profile),
  );
  let expectedTerminalDescription;
  try {
    expectedTerminalDescription = agentMcpProfileTerminalLabelDescription(
      profile,
      terminalState,
      terminalReportSha256,
    );
  } catch {
    expectedTerminalDescription = null;
  }
  if (
    claimLabel?.description !== agentMcpProfileClaimLabelDescription(profile) ||
    !terminalLabel ||
    terminalLabel.description !== expectedTerminalDescription
  ) {
    throw new HarnessInvariantError(
      'G01_RENDER_QUERY_OFFLINE_TERMINAL_LATCH_MISMATCH',
      'The permanent G01 offline profile claim and terminal labels must match its durable disposition.',
    );
  }

  const frontier = frontierContext().ledger;
  const record = frontier.records.find((item) => item.id === 'G01');
  const sourceRefs = record?.source_refs;
  if (
    record?.status !== 'PARTIAL' ||
    !Array.isArray(sourceRefs) ||
    !sourceRefs.includes(profileSpec.selectionEvidencePath)
  ) {
    throw new HarnessInvariantError(
      'G01_RENDER_QUERY_OFFLINE_FRONTIER_INVALID',
      'The G01 scenario must remain PARTIAL and cite the matrix-only selection contract.',
    );
  }

  const reportPath = path.join(root, profileSpec.reportPath);
  const changed = new Set(changedPaths(disposition.sourceCandidateSha));
  const allowedRefreshPaths = new Set([
    profileSpec.reportPath,
    'docs/product/frontier-ledger.json',
    'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
  ]);
  if ([...changed].some((item) => !allowedRefreshPaths.has(item))) {
    throw new HarnessInvariantError(
      'G01_RENDER_QUERY_OFFLINE_REFRESH_SCOPE_INVALID',
      'The final Candidate may contain only the validated G01 matrix report, its frontier reference, and generated acceptance matrix.',
      { changed: [...changed] },
    );
  }

  if (reportWritten) {
    if (
      disposition.reportPath !== profileSpec.reportPath ||
      !/^[0-9a-f]{64}$/u.test(disposition.reportSha256 ?? '') ||
      (disposition.unacceptedReportSha256 !== null &&
        disposition.unacceptedReportSha256 !== undefined) ||
      !sourceRefs.includes(profileSpec.reportPath) ||
      !changed.has(profileSpec.reportPath) ||
      !changed.has('docs/product/frontier-ledger.json') ||
      !changed.has('docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md')
    ) {
      throw new HarnessInvariantError(
        'G01_RENDER_QUERY_OFFLINE_REPORT_REFRESH_REQUIRED',
        'A written G01 matrix report must be committed with its frontier reference and generated acceptance row.',
      );
    }
    const validation = validateG01RenderQueryOfflineSanitizedReportFile(
      disposition,
      root,
      reportPath,
      profileId,
    );
    if (!validation.passed || validation.reportSha256 !== disposition.reportSha256) {
      throw new HarnessInvariantError(
        'G01_RENDER_QUERY_OFFLINE_REPORT_INVALID',
        validation.reason ??
          'The G01 offline render-query matrix report does not match its terminal claim.',
      );
    }
  } else if (
    (disposition.reportPath !== undefined && disposition.reportPath !== null) ||
    disposition.reportSha256 !== undefined ||
    (disposition.unacceptedReportSha256 !== null &&
      disposition.unacceptedReportSha256 !== undefined &&
      !/^[0-9a-f]{64}$/u.test(disposition.unacceptedReportSha256)) ||
    fs.existsSync(reportPath)
  ) {
    throw new HarnessInvariantError(
      'G01_RENDER_QUERY_OFFLINE_INCONCLUSIVE_REPORT_PRESENT',
      'An inconclusive G01 offline matrix claim cannot merge with an accepted report artifact.',
    );
  }
}

function assertG01QuerySubjectsOfflineProfileReconciledBeforeMerge(
  epoch,
  runNumber,
  prNumber,
  profileId = G01_QUERY_SUBJECTS_OFFLINE_PROFILE_ID,
) {
  const profile = getAgentMcpProfileById(profileId);
  const spec = getG01QuerySubjectsOfflineProfileSpec(profileId);
  const disposition = agentMcpProfileClaims(epoch)[profileId];
  const latestReview = epoch.review_history?.at(-1);
  const terminalState = disposition?.state;
  const reportWritten = terminalState === 'REPORT_WRITTEN';
  const terminalReportSha256 =
    disposition?.reportSha256 ?? disposition?.unacceptedReportSha256 ?? null;
  const claimReview = epoch.review_history?.find(
    (review) =>
      review?.candidate_sha === disposition?.sourceCandidateSha &&
      review?.reviewed_base_sha === disposition?.baseSha &&
      review?.reviewer_id === disposition?.reviewerId &&
      review?.verdict === 'PASS',
  );
  if (
    !spec ||
    epoch.epoch_id !== spec.epochId ||
    epoch.state !== 'REVIEW_PASSED' ||
    epoch.pr_number !== Number(prNumber) ||
    !profile ||
    disposition?.profileId !== profileId ||
    disposition.frontierId !== 'G01' ||
    disposition.epochId !== spec.epochId ||
    disposition.runNumber !== Number(runNumber) ||
    disposition.prNumber !== Number(prNumber) ||
    disposition.toolName !== 'bangumi.query_subjects' ||
    disposition.argumentProfile !== profile.argumentProfile ||
    disposition.expectedArgumentsSha256 !== agentMcpProfileArgumentsSha256(profile) ||
    disposition.registrySha256 !== agentMcpProfileRegistrySha256(profile.id) ||
    disposition.retryAllowed !== false ||
    !['INCONCLUSIVE', 'REPORT_WRITTEN'].includes(terminalState) ||
    disposition.reportWritten !== reportWritten ||
    !/^[0-9a-f]{40}$/u.test(disposition.sourceCandidateSha ?? '') ||
    !isAncestor(disposition.sourceCandidateSha, epoch.candidate_sha) ||
    disposition.baseSha !== epoch.base_sha ||
    disposition.ciSha !== disposition.sourceCandidateSha ||
    disposition.ciStatus !== 'SUCCESS' ||
    disposition.reviewerId !== claimReview?.reviewer_id ||
    claimReview?.reviewed_base_sha !== disposition.baseSha ||
    latestReview?.candidate_sha !== epoch.candidate_sha ||
    latestReview?.reviewed_base_sha !== epoch.base_sha ||
    latestReview?.verdict !== 'PASS' ||
    epoch.review_pass_sha !== epoch.candidate_sha ||
    !isG16LunaMaxReviewerId(latestReview?.reviewer_id, Number(prNumber)) ||
    !epoch.advances_frontier_ids?.includes('G01')
  ) {
    throw new HarnessInvariantError(
      'G01_QUERY_SUBJECTS_OFFLINE_RECONCILIATION_REQUIRED',
      'The G01 query-subjects offline matrix Epoch requires its exact terminal one-shot claim and reviewed final Candidate before merge.',
    );
  }

  const labels = readAgentMcpProfileLabels();
  const claimLabel = labels.find((label) => label.name === profile.claimLabelName);
  const terminalLabel = labels.find(
    (label) => label.name === agentMcpProfileTerminalLabelName(profile),
  );
  let expectedTerminalDescription;
  try {
    expectedTerminalDescription = agentMcpProfileTerminalLabelDescription(
      profile,
      terminalState,
      terminalReportSha256,
    );
  } catch {
    expectedTerminalDescription = null;
  }
  if (
    claimLabel?.description !== agentMcpProfileClaimLabelDescription(profile) ||
    !terminalLabel ||
    terminalLabel.description !== expectedTerminalDescription
  ) {
    throw new HarnessInvariantError(
      'G01_QUERY_SUBJECTS_OFFLINE_TERMINAL_LATCH_MISMATCH',
      'The permanent query-subjects claim and terminal latches must match its durable disposition.',
    );
  }

  const frontier = frontierContext().ledger;
  const record = frontier.records.find((item) => item.id === 'G01');
  if (record?.status !== 'PARTIAL') {
    throw new HarnessInvariantError(
      'G01_QUERY_SUBJECTS_OFFLINE_FRONTIER_INVALID',
      'The matrix-only query profile must leave the G01 scenario PARTIAL.',
    );
  }

  const reportPath = path.join(root, spec.reportPath);
  const changed = new Set(changedPaths(disposition.sourceCandidateSha));
  const allowedRefreshPaths = new Set([spec.reportPath, 'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md']);
  if ([...changed].some((item) => !allowedRefreshPaths.has(item))) {
    throw new HarnessInvariantError(
      'G01_QUERY_SUBJECTS_OFFLINE_REFRESH_SCOPE_INVALID',
      'The final Candidate may contain only the sanitized matrix report and generated acceptance row.',
      { changed: [...changed] },
    );
  }

  if (reportWritten) {
    if (
      disposition.reportPath !== spec.reportPath ||
      !/^[0-9a-f]{64}$/u.test(disposition.reportSha256 ?? '') ||
      (disposition.unacceptedReportSha256 !== null &&
        disposition.unacceptedReportSha256 !== undefined) ||
      !changed.has(spec.reportPath) ||
      !changed.has('docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md')
    ) {
      throw new HarnessInvariantError(
        'G01_QUERY_SUBJECTS_OFFLINE_REPORT_REFRESH_REQUIRED',
        'A written query-subjects matrix report must be committed with its generated acceptance row.',
      );
    }
    const validation = validateG01QuerySubjectsOfflineSanitizedReportFile(
      disposition,
      root,
      reportPath,
    );
    if (!validation.passed || validation.reportSha256 !== disposition.reportSha256) {
      throw new HarnessInvariantError(
        'G01_QUERY_SUBJECTS_OFFLINE_REPORT_INVALID',
        validation.reason ?? 'The query-subjects offline report does not match its terminal claim.',
      );
    }
  } else if (
    (disposition.reportPath !== undefined && disposition.reportPath !== null) ||
    disposition.reportSha256 !== undefined ||
    (disposition.unacceptedReportSha256 !== null &&
      disposition.unacceptedReportSha256 !== undefined &&
      !/^[0-9a-f]{64}$/u.test(disposition.unacceptedReportSha256)) ||
    fs.existsSync(reportPath)
  ) {
    throw new HarnessInvariantError(
      'G01_QUERY_SUBJECTS_OFFLINE_INCONCLUSIVE_REPORT_PRESENT',
      'An inconclusive query-subjects profile cannot merge with an accepted report artifact.',
    );
  }
}

function commandEpochMerge(options, { resumeBlocked = false } = {}) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const prNumber = required(options, 'pr');
  const runResult = issueState(runNumber);
  const epochResult = epochState(prNumber);
  const persistedEpoch = epochResult.state;
  const runState = structuredClone(runResult.state);
  let epoch = persistedEpoch;
  if (resumeBlocked) {
    epoch = restoreIntegrationAuthority(persistedEpoch, runState.outer_sol);
    runState.state = 'EPOCH_ACTIVE';
    runState.next_action = `RETRY_AUTOMATIC_INTEGRATION_PR_${prNumber}`;
  } else if (!['REVIEW_PASSED', 'FINAL_CORRECTIVE_READY'].includes(epoch.state)) {
    throw new HarnessInvariantError(
      'INTEGRATION_AUTHORITY_REQUIRED',
      `Epoch state ${epoch.state} cannot enter automatic integration`,
    );
  }
  if (runState.active_epoch_pr !== Number(prNumber)) {
    throw new HarnessInvariantError(
      'ACTIVE_EPOCH_MISMATCH',
      'The Run Issue does not identify this PR as its active Epoch',
    );
  }
  if (epoch.epoch_id === D07_EPOCH_ID) {
    assertD07OneShotReconciledBeforeMerge(epoch, runNumber, prNumber);
    ensureCleanWorkingTree();
  } else if (epoch.epoch_id === G06_EPOCH_ID) {
    const reportValidated = assertG06OneShotReconciledBeforeMerge(epoch, runNumber, prNumber);
    ensureG06MergeWorkingTree(reportValidated);
  } else if (epoch.epoch_id === P05_EPOCH_ID) {
    assertP05OneShotReconciledBeforeMerge(epoch, runNumber, prNumber);
    ensureCleanWorkingTree();
  } else if ([G06_CAST_OFFLINE_EPOCH_ID, G06_CAST_OFFLINE_V2_EPOCH_ID].includes(epoch.epoch_id)) {
    assertG06CastOfflineProfileReconciledBeforeMerge(epoch, runNumber, prNumber);
    ensureCleanWorkingTree();
  } else if (
    [
      C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID,
      C07_RENDER_COMPARISON_OFFLINE_V2_PROFILE_ID,
      C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID,
    ].some(
      (profileId) => getC07RenderComparisonOfflineConfig(profileId)?.epochId === epoch.epoch_id,
    )
  ) {
    const profileId = [
      C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID,
      C07_RENDER_COMPARISON_OFFLINE_V2_PROFILE_ID,
      C07_RENDER_COMPARISON_OFFLINE_V3_PROFILE_ID,
    ].find(
      (candidate) => getC07RenderComparisonOfflineConfig(candidate)?.epochId === epoch.epoch_id,
    );
    assertC07RenderComparisonOfflineProfileReconciledBeforeMerge(
      epoch,
      runNumber,
      prNumber,
      profileId,
    );
    ensureCleanWorkingTree();
  } else if (
    [G01_RENDER_QUERY_OFFLINE_PROFILE_ID, G01_RENDER_QUERY_OFFLINE_V2_PROFILE_ID].some(
      (profileId) => getG01RenderQueryOfflineProfileSpec(profileId)?.epochId === epoch.epoch_id,
    )
  ) {
    const profileId = [
      G01_RENDER_QUERY_OFFLINE_PROFILE_ID,
      G01_RENDER_QUERY_OFFLINE_V2_PROFILE_ID,
    ].find(
      (candidate) => getG01RenderQueryOfflineProfileSpec(candidate)?.epochId === epoch.epoch_id,
    );
    assertG01RenderQueryOfflineProfileReconciledBeforeMerge(epoch, runNumber, prNumber, profileId);
    ensureCleanWorkingTree();
  } else if (
    [G01_QUERY_SUBJECTS_OFFLINE_PROFILE_ID, G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_ID].some(
      (profileId) => getG01QuerySubjectsOfflineProfileSpec(profileId)?.epochId === epoch.epoch_id,
    )
  ) {
    const profileId = [
      G01_QUERY_SUBJECTS_OFFLINE_PROFILE_ID,
      G01_QUERY_SUBJECTS_OFFLINE_V2_PROFILE_ID,
    ].find(
      (candidate) => getG01QuerySubjectsOfflineProfileSpec(candidate)?.epochId === epoch.epoch_id,
    );
    assertG01QuerySubjectsOfflineProfileReconciledBeforeMerge(
      epoch,
      runNumber,
      prNumber,
      profileId,
    );
    ensureCleanWorkingTree();
  } else ensureCleanWorkingTree();
  if (
    resumeBlocked &&
    (epochResult.view.headRefName !== epoch.branch ||
      epochResult.view.baseRefName !== epoch.base_branch)
  ) {
    throw new HarnessInvariantError(
      'INTEGRATION_PR_MISMATCH',
      'The blocked PR no longer has the recorded feature and target branches',
      {
        recorded_head: epoch.branch,
        current_head: epochResult.view.headRefName,
        recorded_base: epoch.base_branch,
        current_base: epochResult.view.baseRefName,
      },
    );
  }
  if (resumeBlocked && !mandatoryChecksSuccessful(epochResult.view.statusCheckRollup)) {
    throw new HarnessInvariantError(
      'EXACT_SHA_CI_REQUIRED',
      'Every mandatory check must still report SUCCESS for the exact blocked Candidate',
    );
  }
  if (resumeBlocked && epochResult.view.state === 'MERGED') {
    if (!epochResult.view.mergeCommit?.oid) {
      throw new HarnessInvariantError(
        'MERGE_VERIFICATION_FAILED',
        'GitHub reports MERGED without a merge commit SHA',
      );
    }
    const authorizedBaseSha =
      epoch.state === 'REVIEW_PASSED' ? epoch.reviewed_base_sha : epoch.final_corrective_base_sha;
    assertMergeReadiness({
      epoch,
      outerSol: runState.outer_sol,
      branchHeadSha: epoch.candidate_sha,
      prHeadSha: epochResult.view.headRefOid,
      currentBaseSha: authorizedBaseSha,
    });
    git('fetch', 'origin', epoch.base_branch);
    completeMergedIntegration({
      runNumber,
      prNumber,
      runState,
      epoch,
      mergedPr: epochResult.view,
    });
    return;
  }
  if (epochResult.view.state !== 'OPEN' || epochResult.view.isDraft) {
    throw new HarnessInvariantError(
      'INTEGRATION_BLOCKED',
      'Automatic integration requires an open, review-ready PR',
      { pr_state: epochResult.view.state, is_draft: epochResult.view.isDraft },
    );
  }
  if (resumeBlocked && epochResult.view.mergeStateStatus !== 'CLEAN') {
    throw new HarnessInvariantError(
      'INTEGRATION_BLOCKED',
      'The blocked PR is not currently cleanly mergeable',
      { merge_state_status: epochResult.view.mergeStateStatus },
    );
  }
  if (currentBranch() !== epoch.branch) {
    throw new HarnessInvariantError('WRONG_EPOCH_BRANCH', `Checkout ${epoch.branch} first`);
  }
  git('fetch', 'origin', epoch.base_branch, epoch.branch);
  const currentBaseSha = git('rev-parse', `origin/${epoch.base_branch}`);
  if (
    epoch.state === 'FINAL_CORRECTIVE_READY' &&
    epoch.final_corrective_base_sha !== currentBaseSha
  ) {
    const driftedEpoch = structuredClone(epoch);
    const driftedRun = structuredClone(runState);
    driftedEpoch.state = 'FINAL_CORRECTIVE_REQUIRED';
    driftedEpoch.candidate_sha = null;
    driftedEpoch.review_pass_sha = null;
    driftedEpoch.ci = { sha: null, status: 'NOT_RUN', url: null };
    driftedEpoch.corrective_closure = [];
    driftedEpoch.final_corrective_sha = null;
    driftedEpoch.final_corrective_base_sha = null;
    driftedEpoch.next_action = 'SYNCHRONIZE_BASE_REVALIDATE_FINAL_CORRECTIVE';
    driftedRun.state = 'EPOCH_ACTIVE';
    driftedRun.active_epoch_pr = Number(prNumber);
    driftedRun.parked_epoch_prs = driftedRun.parked_epoch_prs.filter(
      (number) => number !== Number(prNumber),
    );
    driftedRun.next_action = `RESUME_PR_${prNumber}_FINAL_CORRECTIVE`;
    updatePr(prNumber, driftedEpoch);
    updateIssue(runNumber, driftedRun);
    throw new HarnessInvariantError(
      'FINAL_CORRECTIVE_BASE_DRIFT',
      'Synchronize the changed base, rerun closure validation, and establish a new exact Candidate',
      { finalCorrectiveBaseSha: epoch.final_corrective_base_sha, currentBaseSha },
    );
  }
  const finalCorrective = epoch.state === 'FINAL_CORRECTIVE_READY';
  if (!finalCorrective) {
    const baseAction = afterPassBaseAction({
      reviewedBaseSha: epoch.reviewed_base_sha,
      currentBaseSha,
      epochReview: epoch.review,
      outerReview: runState.outer_sol,
    });
    if (!baseAction.ready) {
      const driftedEpoch = structuredClone(epoch);
      const driftedRun = structuredClone(runState);
      driftedEpoch.candidate_sha = null;
      driftedEpoch.review_pass_sha = null;
      driftedEpoch.ci = { sha: null, status: 'NOT_RUN', url: null };
      if (baseAction.action === 'SYNCHRONIZE_VALIDATE_FINAL_CORRECTIVE') {
        driftedEpoch.state = 'FINAL_CORRECTIVE_REQUIRED';
        driftedEpoch.findings = [
          {
            id: 'base-drift-after-pass',
            priority: 'P1',
            summary:
              'Revalidate the passed Candidate after synchronizing the advanced target base.',
            acceptance:
              'Synchronize the base safely, resolve the full integration class, rerun relevant regression and mandatory validation, and establish exact-SHA CI.',
          },
        ];
        driftedEpoch.corrective_closure = [];
        driftedEpoch.final_corrective_sha = null;
        driftedEpoch.final_corrective_base_sha = null;
        driftedEpoch.final_corrective_reason = 'BASE_DRIFT_AFTER_PASS';
        driftedEpoch.next_action = 'SYNCHRONIZE_BASE_REVALIDATE_FINAL_CORRECTIVE';
        driftedRun.state = 'EPOCH_ACTIVE';
        driftedRun.active_epoch_pr = Number(prNumber);
        driftedRun.next_action = `RESUME_PR_${prNumber}_FINAL_CORRECTIVE`;
      } else {
        driftedEpoch.state = 'PASS_INVALIDATED_BASE_DRIFT';
        driftedEpoch.next_action = 'SYNCHRONIZE_VALIDATE_NEW_CANDIDATE_AND_REVIEW';
      }
      updatePr(prNumber, driftedEpoch);
      updateIssue(runNumber, driftedRun);
      throw new HarnessInvariantError(
        baseAction.code,
        'The reviewed base advanced; establish separately validated integration authority',
        { reviewedBaseSha: epoch.reviewed_base_sha, currentBaseSha },
      );
    }
  }
  assertMergeReadiness({
    epoch,
    outerSol: runState.outer_sol,
    branchHeadSha: currentHead(),
    prHeadSha: epochResult.view.headRefOid,
    currentBaseSha,
  });
  try {
    gh('pr', 'merge', String(prNumber), '--merge');
  } catch (error) {
    const blocked = recordIntegrationBlocked(
      runState,
      epoch,
      error instanceof Error ? error.message : String(error),
    );
    updatePr(prNumber, blocked.epoch);
    updateIssue(runNumber, blocked.run);
    throw new HarnessInvariantError(
      'INTEGRATION_BLOCKED',
      'GitHub did not merge the PR; the same PR remains authoritative',
    );
  }
  const mergedPr = prView(prNumber);
  if (mergedPr.state !== 'MERGED' || !mergedPr.mergeCommit?.oid) {
    throw new HarnessInvariantError('INTEGRATION_BLOCKED', 'GitHub did not report MERGED');
  }
  completeMergedIntegration({
    runNumber,
    prNumber,
    runState,
    epoch,
    mergedPr,
  });
}

function commandEpochResumeIntegration(options) {
  commandEpochMerge(options, { resumeBlocked: true });
}

function commandRunStop(options) {
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const state = required(options, 'state');
  const nextAction = required(options, 'next-action');
  const runResult = issueState(runNumber);
  const next = structuredClone(runResult.state);
  if (state === NO_OPPORTUNITY_STOP) {
    if (next.active_epoch_pr || next.pending_epoch) {
      throw new HarnessInvariantError(
        'ACTIVE_EPOCH_EXISTS',
        'Trusted frontier exhaustion cannot abandon an active or pending Epoch',
      );
    }
    ensureCleanWorkingTree();
    if (currentBranch() !== 'master') {
      throw new HarnessInvariantError(
        'DISCOVERY_MUST_FINISH_ON_MASTER',
        'No-opportunity discovery must finish on synchronized master',
      );
    }
    const currentBaseSha = remoteBaseSha('master');
    if (currentHead() !== currentBaseSha) {
      throw new HarnessInvariantError(
        'MASTER_NOT_SYNCHRONIZED',
        'No-opportunity discovery evidence must cover synchronized master',
      );
    }
    const evidence = readJsonFile(required(options, 'evidence'));
    const frontier = requireValidFrontier();
    assertDiscoveryExhaustionEvidence(evidence, currentBaseSha, frontier);
    const evidenceHash = canonicalHash(evidence);
    assertTrustedFrontierStop(next, {
      baseSha: currentBaseSha,
      ledgerHash: frontier.hash,
      evidenceHash,
    });
    const evidenceArchive =
      next.frontier_closure?.evidence?.encoding === 'gzip+base64'
        ? next.frontier_closure.evidence
        : archiveEvidence(evidence);
    next.discovery_exhaustion = {
      policy_version: evidence.policy_version,
      audited_sha: evidence.audited_sha,
      audited_at: evidence.audited_at,
      ledger_hash: evidence.ledger_hash,
      evidence_hash: evidenceHash,
      evidence_archive: evidenceArchive,
    };
    next.frontier_closure.evidence = null;
  }
  next.state = state;
  next.next_action = nextAction;
  updateIssue(runNumber, next);
  gh('issue', 'close', String(runNumber), '--reason', 'completed');
  print({ state, next_action: nextAction, issue_state: 'CLOSED' });
}

function commandGoalCheck(options) {
  const discoveryState = options['discovery-state'];
  if (discoveryState === 'UNCHANGED_EXHAUSTION' && options.run === undefined) {
    const discovery = inspectDiscoveryCheck(options);
    if (discovery.state !== 'UNCHANGED_EXHAUSTION') {
      throw new HarnessInvariantError(
        'GOAL_CONTINUATION_REQUIRED',
        'UNCHANGED_EXHAUSTION must be revalidated from the current repository and control plane',
        { discovery_state: discovery.state },
      );
    }
    assertGoalStopAllowed({ discoveryState });
    print({
      state: 'GOAL_STOP_ALLOWED',
      discovery_state: discoveryState,
      current_sha: discovery.current_sha,
      ledger_hash: discovery.ledger_hash,
    });
    return;
  }
  ensureControlPlane();
  const runNumber = required(options, 'run');
  const runResult = issueState(runNumber);
  const epochResult = options.pr ? epochState(String(options.pr)) : null;
  if (!epochResult) {
    const openEpochPrs = JSON.parse(
      gh(
        'pr',
        'list',
        '--state',
        'open',
        '--limit',
        '100',
        '--json',
        'number,title,body,state,url,createdAt,updatedAt',
      ),
    ).filter((pr) => pr.body?.includes(`<!-- ${EPOCH_MARKER}:start -->`));
    if (openEpochPrs.length > 0) {
      throw new HarnessInvariantError(
        'GOAL_CONTINUATION_REQUIRED',
        'An open nonterminal Epoch PR prevents Goal completion',
        { open_epoch_prs: openEpochPrs.map((pr) => pr.number) },
      );
    }
  }
  assertGoalStopAllowed({
    run: runResult.state,
    epoch: epochResult?.state,
    discoveryState,
  });
  print({
    state: 'GOAL_STOP_ALLOWED',
    run_state: runResult.state.state,
    epoch_state: epochResult?.state.state ?? null,
  });
}

const commands = {
  help: commandHelp,
  status: commandStatus,
  'frontier:check': commandFrontierCheck,
  'frontier:status': commandFrontierStatus,
  'discovery:check': commandDiscoveryCheck,
  'run:start': commandRunStart,
  'run:budget-extend': commandRunBudgetExtend,
  'epoch:start': commandEpochStart,
  'epoch:open-pr': commandEpochOpenPr,
  'guard:legacy-paths': commandGuard,
  'candidate:check': commandCandidateCheck,
  'review:reserve': commandReviewReserve,
  'review:budget-extend': commandEpochReviewBudgetExtend,
  'review:started': commandReviewStarted,
  'review:reconcile': commandReviewReconcile,
  'review:runtime': commandReviewRuntime,
  'review:wait': commandReviewWait,
  'review:result': commandReviewResult,
  'epoch:g19-one-shot-claim': commandEpochG19OneShotClaim,
  'epoch:g19-one-shot-result': commandEpochG19OneShotResult,
  'epoch:p05-one-shot-claim': commandEpochP05OneShotClaim,
  'epoch:p05-one-shot-result': commandEpochP05OneShotResult,
  'epoch:g04-one-shot-run': commandEpochG04OneShotRun,
  'epoch:g04-legacy-claim-reconcile': commandEpochG04LegacyClaimReconcile,
  'epoch:g16-one-shot-run': commandEpochG16OneShotRun,
  'epoch:agent-mcp-profile-status': commandEpochAgentMcpProfileStatus,
  'epoch:agent-mcp-profile-reconcile-ambiguous': commandEpochAgentMcpProfileReconcileAmbiguous,
  'epoch:agent-mcp-profile-claim': commandEpochAgentMcpProfileClaim,
  'epoch:agent-mcp-profile-result': commandEpochAgentMcpProfileResult,
  'epoch:r01-one-shot-run': commandEpochR01OneShotRun,
  'epoch:r01-one-shot-reconcile': commandEpochR01OneShotReconcile,
  'epoch:g06-one-shot-run': commandEpochG06OneShotRun,
  'epoch:g06-one-shot-reconcile': commandEpochG06OneShotReconcile,
  'epoch:d07-one-shot-claim': commandEpochD07OneShotClaim,
  'epoch:d07-one-shot-result': commandEpochD07OneShotResult,
  'epoch:d07-one-shot-run': commandEpochD07OneShotRun,
  'epoch:d07-one-shot-reconcile': commandEpochD07OneShotReconcile,
  'epoch:p01-one-shot-run': commandEpochP01OneShotRun,
  'epoch:p01-one-shot-result': commandEpochP01OneShotResult,
  'frontier:review-reserve': commandFrontierReviewReserve,
  'frontier:review-started': commandFrontierReviewStarted,
  'frontier:review-reconcile': commandFrontierReviewReconcile,
  'frontier:review-runtime': commandFrontierReviewRuntime,
  'frontier:review-wait': commandFrontierReviewWait,
  'frontier:review-context': commandFrontierReviewContext,
  'frontier:review-result': commandFrontierReviewResult,
  'frontier:resume-discovery': commandFrontierResumeDiscovery,
  'epoch:park': commandEpochPark,
  'epoch:resume-final-corrective': commandEpochResumeFinalCorrective,
  'epoch:resume-integration': commandEpochResumeIntegration,
  'epoch:merge': commandEpochMerge,
  'run:stop': commandRunStop,
  'goal:check': commandGoalCheck,
};

function main() {
  const { command, options } = parseArgs(process.argv.slice(2));
  const handler = commands[command];
  if (!handler) throw new HarnessInvariantError('UNKNOWN_COMMAND', `Unknown command: ${command}`);
  handler(options);
}

try {
  main();
} catch (error) {
  if (error instanceof HarnessInvariantError) {
    process.stderr.write(`${error.code}: ${error.message}\n`);
    if (Object.keys(error.details).length) {
      process.stderr.write(`${JSON.stringify(error.details, null, 2)}\n`);
    }
    process.exitCode = 2;
  } else {
    process.stderr.write(
      `HARNESS_ERROR: ${error instanceof Error ? error.message : String(error)}\n`,
    );
    process.exitCode = 1;
  }
}
