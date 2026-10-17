import {
  P03_PROFILE_ID,
  summarizeP03PersonProfileToolResult,
} from './p03-person-name-cn-evidence.mjs';
import {
  P07_PROFILE_ID,
  summarizeP07PersonActivityToolResult,
} from './p07-person-season-evidence.mjs';
import {
  S05_PROFILE_ID,
  summarizeS05PersonActivityToolResult,
} from './s05-person-activity-evidence.mjs';
import {
  R05_PROFILE_ID,
  summarizeR05SubjectOverlapToolResult,
} from './r05-shared-person-overlap-evidence.mjs';
import { P02_PERSON_PROFILE_OFFLINE_PROFILE_ID } from './p02-person-profile-offline-fixture.mjs';
import { G06_CAST_OFFLINE_PROFILE_ID } from './g06-subject-cast-offline-profile.mjs';
import { R04_SERIES_WATCH_ORDER_OFFLINE_PROFILE_ID } from './r04-series-watch-order-offline-fixture.mjs';
import { C04_COHORT_COMPARISON_PROFILE_ID } from './c04-cohort-comparison-public-profile.mjs';
import {
  R01_RELATIONS_OFFLINE_PROFILE_ID,
  summarizeR01RelationsOfflineToolResult,
} from './r01-relations-offline-profile.mjs';
import {
  R03_RELATIONS_OFFLINE_PROFILE_ID,
  summarizeR03RelationsOfflineToolResult,
} from './r03-relations-offline-profile.mjs';
import {
  R02_POSITIVE_DIRECT_RELATIONS_PROFILE_ID,
  summarizeR02PositiveDirectRelationsToolResult,
} from './r02-positive-direct-relations-profile.mjs';
import { A01_RENDER_COHORT_AGGREGATION_PROFILE_ID } from './a01-render-cohort-aggregation-offline-fixture.mjs';
import {
  A01_RATING_DISPERSION_PROFILE,
  A01_RATING_DISPERSION_PROFILE_ID,
} from './a01-rating-dispersion-profile.mjs';
import { R04_RENDER_SERIES_WATCH_ORDER_PROFILE_ID } from './r04-render-series-watch-order-offline-fixture.mjs';
import { TITLE_QUERY_RENDER_PROFILE_ID } from './title-query-render-agent-mcp-profile.mjs';
import {
  isG01RenderQueryOfflineProfileId,
  summarizeG01RenderQueryOfflineToolResult,
} from './g01-render-query-subjects-offline-profile.mjs';
import {
  G01_QUERY_SUBJECTS_OFFLINE_PROFILE_ID,
  summarizeG01QuerySubjectsOfflineToolResult,
} from './g01-query-subjects-offline-matrix-profile.mjs';

const C04_RESULT_STATES = new Set([
  'ok',
  'complete',
  'partial',
  'conflict',
  'unavailable',
  'not_computable',
  'not_found',
  'upstream_error',
  'unsupported',
  'stale',
  'auth_required',
  'permission_denied',
  'error',
]);
const C04_METRIC_KEYS = new Set(['score', 'heat', 'episodesReported', 'ratingStandardDeviation']);
const TITLE_QUERY_COVERAGE_STATES = new Set([
  'complete',
  'partial',
  'unavailable',
  'not_computable',
  'unknown',
]);
const TITLE_QUERY_TOTAL_KINDS = new Set(['exact', 'estimated', 'unknown', 'unavailable']);
const TITLE_QUERY_WARNING_CODES = new Set([
  'EXPERIMENTAL_SOURCE',
  'HYDRATION_FAILED',
  'OUTPUT_TRUNCATED',
  'OTHER',
]);

function boundedCounter(value) {
  return Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000 ? value : null;
}

function summarizeTitleQueryResult(result) {
  const coverage = result?.coverage;
  const items = Array.isArray(result?.items) ? result.items : [];
  const warnings = Array.isArray(result?.warnings) ? result.warnings : [];
  const warningCodes = [
    ...new Set(
      warnings.map((warning) =>
        TITLE_QUERY_WARNING_CODES.has(warning?.code) ? warning.code : 'OTHER',
      ),
    ),
  ].slice(0, 4);
  return {
    resultState: ['ok', 'partial'].includes(result?.state) ? result.state : 'unknown',
    returnedItems: Math.min(items.length, 2),
    coverage: {
      state: TITLE_QUERY_COVERAGE_STATES.has(coverage?.state) ? coverage.state : 'unknown',
      requested: boundedCounter(coverage?.requested),
      scanned: boundedCounter(coverage?.scanned),
      matched: boundedCounter(coverage?.matched),
      returned: boundedCounter(coverage?.returned),
      pagesRequested: boundedCounter(coverage?.pagesRequested),
      pagesScanned: boundedCounter(coverage?.pagesScanned),
      upstreamExhausted:
        typeof coverage?.upstreamExhausted === 'boolean' ? coverage.upstreamExhausted : null,
      budgetExceeded:
        typeof coverage?.budgetExceeded === 'boolean' ? coverage.budgetExceeded : null,
      totalKind: TITLE_QUERY_TOTAL_KINDS.has(coverage?.totalKind) ? coverage.totalKind : 'unknown',
    },
    warningCodes,
  };
}

function summarizeTitleQueryRenderArtifact(result, artifactSummary) {
  const artifact = artifactSummary && typeof artifactSummary === 'object' ? artifactSummary : {};
  return {
    resultState:
      result?.artifact?.id && artifact.returned === true ? 'artifact_returned' : 'artifact_missing',
    artifact: {
      returned: artifact.returned === true,
      persisted: artifact.persisted === true,
      mimeType: typeof artifact.mimeType === 'string' ? artifact.mimeType : null,
      width: Number.isSafeInteger(artifact.width) ? artifact.width : null,
      height: Number.isSafeInteger(artifact.height) ? artifact.height : null,
      byteLength: Number.isSafeInteger(artifact.byteLength) ? artifact.byteLength : null,
      sha256: typeof artifact.sha256 === 'string' ? artifact.sha256 : null,
      pngSignatureValid: artifact.pngSignatureValid === true,
      decoded: artifact.decoded === true,
      dimensionsMatch: artifact.dimensionsMatch === true,
    },
  };
}

function summarizeC04CohortResult(result) {
  const cohorts = Array.isArray(result?.cohorts) ? result.cohorts.slice(0, 2) : [];
  const metrics = Array.isArray(result?.metrics) ? result.metrics.slice(0, 4) : [];
  const coverage = result?.coverage;
  return {
    resultState: C04_RESULT_STATES.has(result?.state) ? result.state : 'unknown',
    cohortCount: cohorts.length,
    cohorts: cohorts.map((cohort) => ({
      queryState: C04_RESULT_STATES.has(cohort?.coverage?.query?.state)
        ? cohort.coverage.query.state
        : 'unknown',
      detailHydrationsAttempted: Number.isSafeInteger(cohort?.coverage?.detailHydrationsAttempted)
        ? cohort.coverage.detailHydrationsAttempted
        : null,
      detailHydrationsSucceeded: Number.isSafeInteger(cohort?.coverage?.detailHydrationsSucceeded)
        ? cohort.coverage.detailHydrationsSucceeded
        : null,
      detailHydrationsFailed: Number.isSafeInteger(cohort?.coverage?.detailHydrationsFailed)
        ? cohort.coverage.detailHydrationsFailed
        : null,
      subjectCount: Array.isArray(cohort?.subjects) ? cohort.subjects.length : null,
    })),
    metricCount: metrics.length,
    metrics: metrics.map((metric) => ({
      key: C04_METRIC_KEYS.has(metric?.key) ? metric.key : 'unclassified',
      state: C04_RESULT_STATES.has(metric?.state) ? metric.state : 'unknown',
      validCounts: Array.isArray(metric?.validCounts)
        ? metric.validCounts
            .slice(0, 2)
            .map((value) => (Number.isSafeInteger(value) && value >= 0 ? value : null))
        : [],
      partialCounts: Array.isArray(metric?.partialCounts)
        ? metric.partialCounts
            .slice(0, 2)
            .map((value) => (Number.isSafeInteger(value) && value >= 0 ? value : null))
        : [],
      missingCounts: Array.isArray(metric?.missingCounts)
        ? metric.missingCounts
            .slice(0, 2)
            .map((value) => (Number.isSafeInteger(value) && value >= 0 ? value : null))
        : [],
      conflictCounts: Array.isArray(metric?.conflictCounts)
        ? metric.conflictCounts
            .slice(0, 2)
            .map((value) => (Number.isSafeInteger(value) && value >= 0 ? value : null))
        : [],
      notComputableCounts: Array.isArray(metric?.notComputableCounts)
        ? metric.notComputableCounts
            .slice(0, 2)
            .map((value) => (Number.isSafeInteger(value) && value >= 0 ? value : null))
        : [],
    })),
    coverage: {
      maxSubjectsPerCohort: Number.isSafeInteger(coverage?.maxSubjectsPerCohort)
        ? coverage.maxSubjectsPerCohort
        : null,
      totalSubjectsReturned: Number.isSafeInteger(coverage?.totalSubjectsReturned)
        ? coverage.totalSubjectsReturned
        : null,
      cohortsComplete: Number.isSafeInteger(coverage?.cohortsComplete)
        ? coverage.cohortsComplete
        : null,
      cohortsPartial: Number.isSafeInteger(coverage?.cohortsPartial)
        ? coverage.cohortsPartial
        : null,
      detailHydrationsAttempted: Number.isSafeInteger(coverage?.detailHydrationsAttempted)
        ? coverage.detailHydrationsAttempted
        : null,
      detailHydrationsSucceeded: Number.isSafeInteger(coverage?.detailHydrationsSucceeded)
        ? coverage.detailHydrationsSucceeded
        : null,
      detailHydrationsFailed: Number.isSafeInteger(coverage?.detailHydrationsFailed)
        ? coverage.detailHydrationsFailed
        : null,
      truncated: typeof coverage?.truncated === 'boolean' ? coverage.truncated : null,
    },
  };
}

export function summarizeA01RatingDispersionResult(result) {
  const cohorts = Array.isArray(result?.cohorts) ? result.cohorts.slice(0, 2) : [];
  const coverage = result?.coverage;
  const metric = Array.isArray(result?.metrics)
    ? result.metrics.find((item) => item?.key === 'ratingStandardDeviation')
    : null;
  const nonnegativeCounter = (value) =>
    Number.isSafeInteger(value) && value >= 0 && value <= 1_000_000 ? value : null;
  const finiteNumber = (value) =>
    typeof value === 'number' && Number.isFinite(value) ? value : null;
  const countRows = (cohort) => {
    const states = {
      available: 0,
      partial: 0,
      missing: 0,
      conflict: 0,
      notComputable: 0,
      unknown: 0,
    };
    for (const subject of Array.isArray(cohort?.subjects) ? cohort.subjects.slice(0, 4) : []) {
      const state = subject?.metricStates?.ratingStandardDeviation;
      if (state === 'available') states.available += 1;
      else if (state === 'partial') states.partial += 1;
      else if (state === 'missing') states.missing += 1;
      else if (state === 'conflict') states.conflict += 1;
      else if (state === 'not_computable') states.notComputable += 1;
      else states.unknown += 1;
    }
    return states;
  };
  const states = new Set([
    'ok',
    'complete',
    'partial',
    'conflict',
    'unavailable',
    'not_computable',
    'not_found',
    'upstream_error',
    'unsupported',
    'stale',
    'auth_required',
    'permission_denied',
    'error',
  ]);
  return {
    resultState: states.has(result?.state) ? result.state : 'unknown',
    cohortCount: cohorts.length,
    fixedTargetIdentityMatched:
      Array.isArray(cohorts[0]?.subjects) &&
      cohorts[0].subjects.length === 1 &&
      cohorts[0].subjects[0]?.id === A01_RATING_DISPERSION_PROFILE?.answerProfile?.targetSubjectId,
    cohorts: cohorts.map((cohort) => ({
      queryState: states.has(cohort?.coverage?.query?.state)
        ? cohort.coverage.query.state
        : 'unknown',
      subjectCount: Array.isArray(cohort?.subjects) ? Math.min(cohort.subjects.length, 4) : null,
      queryHydrationsAttempted: nonnegativeCounter(
        cohort?.coverage?.query?.coverage?.hydrationsAttempted,
      ),
      ratingStandardDeviationCounts: countRows(cohort),
      detailHydrationsAttempted: nonnegativeCounter(cohort?.coverage?.detailHydrationsAttempted),
      detailHydrationsSucceeded: nonnegativeCounter(cohort?.coverage?.detailHydrationsSucceeded),
      detailHydrationsFailed: nonnegativeCounter(cohort?.coverage?.detailHydrationsFailed),
    })),
    ratingStandardDeviation: {
      state: states.has(metric?.state) ? metric.state : 'unknown',
      formulaId: typeof metric?.formula?.id === 'string' ? metric.formula.id : null,
      formulaVersion: Number.isSafeInteger(metric?.formula?.version)
        ? metric.formula.version
        : null,
      averages: Array.isArray(metric?.averages)
        ? metric.averages.slice(0, 2).map(finiteNumber)
        : [null, null],
      partialAverages: Array.isArray(metric?.partialAverages)
        ? metric.partialAverages.slice(0, 2).map(finiteNumber)
        : [null, null],
      validCounts: Array.isArray(metric?.validCounts)
        ? metric.validCounts.slice(0, 2).map(nonnegativeCounter)
        : [],
      partialCounts: Array.isArray(metric?.partialCounts)
        ? metric.partialCounts.slice(0, 2).map(nonnegativeCounter)
        : [],
      missingCounts: Array.isArray(metric?.missingCounts)
        ? metric.missingCounts.slice(0, 2).map(nonnegativeCounter)
        : [],
      conflictCounts: Array.isArray(metric?.conflictCounts)
        ? metric.conflictCounts.slice(0, 2).map(nonnegativeCounter)
        : [],
      notComputableCounts: Array.isArray(metric?.notComputableCounts)
        ? metric.notComputableCounts.slice(0, 2).map(nonnegativeCounter)
        : [],
    },
    coverage: {
      maxSubjectsPerCohort: nonnegativeCounter(coverage?.maxSubjectsPerCohort),
      totalSubjectsReturned: nonnegativeCounter(coverage?.totalSubjectsReturned),
      cohortsComplete: nonnegativeCounter(coverage?.cohortsComplete),
      cohortsPartial: nonnegativeCounter(coverage?.cohortsPartial),
      detailHydrationsAttempted: nonnegativeCounter(coverage?.detailHydrationsAttempted),
      detailHydrationsSucceeded: nonnegativeCounter(coverage?.detailHydrationsSucceeded),
      detailHydrationsFailed: nonnegativeCounter(coverage?.detailHydrationsFailed),
      truncated: typeof coverage?.truncated === 'boolean' ? coverage.truncated : null,
      overlapCount: nonnegativeCounter(coverage?.overlap?.count),
    },
  };
}

function summarizeC04Artifact(artifactSummary) {
  const artifact = artifactSummary && typeof artifactSummary === 'object' ? artifactSummary : {};
  return {
    resultState: artifact.returned === true ? 'artifact_returned' : 'artifact_missing',
    artifact: {
      returned: artifact.returned === true,
      persisted: artifact.persisted === true,
      mimeType: typeof artifact.mimeType === 'string' ? artifact.mimeType : null,
      width: Number.isInteger(artifact.width) ? artifact.width : null,
      height: Number.isInteger(artifact.height) ? artifact.height : null,
      byteLength: Number.isInteger(artifact.byteLength) ? artifact.byteLength : null,
      sha256: typeof artifact.sha256 === 'string' ? artifact.sha256 : null,
      pngSignatureValid: artifact.pngSignatureValid === true,
    },
  };
}

function summarizeG06SubjectCastOfflineResult(result, expectedArguments) {
  const coverage = result?.source;
  const counter = (value) =>
    Number.isSafeInteger(value) && value >= 0 && value <= 100_000 ? value : null;
  return {
    status: result?.status === 'ok' ? 'ok' : 'unknown',
    subjectIdMatches: result?.subjectId === expectedArguments?.subjectId,
    rowsObserved: counter(result?.observed),
    rowsReturned: counter(result?.returned),
    multiRoleVoiceActorCount: counter(
      Array.isArray(result?.multiRoleVoiceActors) ? result.multiRoleVoiceActors.length : null,
    ),
    truncated: typeof result?.truncated === 'boolean' ? result.truncated : null,
    schemaDriftRows: counter(result?.schemaDriftRows),
    invalidActorIdRows: counter(result?.invalidActorIdRows),
    sourceStatus: ['observed', 'partial'].includes(coverage?.status) ? coverage.status : 'unknown',
    paginationAvailable:
      typeof coverage?.paginationAvailable === 'boolean' ? coverage.paginationAvailable : null,
    totalCountAvailable:
      typeof coverage?.totalCountAvailable === 'boolean' ? coverage.totalCountAvailable : null,
  };
}

export function summarizeProfileToolResult(
  result,
  expectedArguments,
  profileId = null,
  artifactSummary = null,
  toolName = null,
) {
  if (isG01RenderQueryOfflineProfileId(profileId)) {
    return toolName === 'bangumi.render_query_subjects'
      ? summarizeG01RenderQueryOfflineToolResult(result, artifactSummary)
      : { resultState: 'unexpected_tool' };
  }
  if (profileId === G01_QUERY_SUBJECTS_OFFLINE_PROFILE_ID) {
    return toolName === 'bangumi.query_subjects'
      ? summarizeG01QuerySubjectsOfflineToolResult(result)
      : { resultState: 'unexpected_tool' };
  }
  if (profileId === TITLE_QUERY_RENDER_PROFILE_ID) {
    return toolName === 'bangumi.render_query_subjects'
      ? summarizeTitleQueryRenderArtifact(result, artifactSummary)
      : summarizeTitleQueryResult(result);
  }
  if (profileId === C04_COHORT_COMPARISON_PROFILE_ID) {
    return toolName === 'bangumi.render_subject_cohort_comparison'
      ? summarizeC04Artifact(artifactSummary)
      : summarizeC04CohortResult(result);
  }
  if (profileId === A01_RATING_DISPERSION_PROFILE_ID) {
    return summarizeA01RatingDispersionResult(result);
  }
  if (
    profileId === 'p06-render-person-profile-offline-agent-mcp-v1' ||
    profileId === 'c07-render-comparison-offline-agent-mcp-matrix-v1' ||
    profileId === A01_RENDER_COHORT_AGGREGATION_PROFILE_ID ||
    profileId === R04_RENDER_SERIES_WATCH_ORDER_PROFILE_ID
  ) {
    const artifact = artifactSummary && typeof artifactSummary === 'object' ? artifactSummary : {};
    return {
      resultState: result?.artifact?.id ? 'artifact_returned' : 'artifact_missing',
      artifact: {
        returned: artifact.returned === true,
        persisted: artifact.persisted === true,
        mimeType: typeof artifact.mimeType === 'string' ? artifact.mimeType : null,
        width: Number.isInteger(artifact.width) ? artifact.width : null,
        height: Number.isInteger(artifact.height) ? artifact.height : null,
        byteLength: Number.isInteger(artifact.byteLength) ? artifact.byteLength : null,
        sha256: typeof artifact.sha256 === 'string' ? artifact.sha256 : null,
        pngSignatureValid: artifact.pngSignatureValid === true,
        ...(artifact.decoded === true ? { decoded: true } : {}),
        ...(artifact.dimensionsMatch === true ? { dimensionsMatch: true } : {}),
      },
    };
  }
  if (profileId === P02_PERSON_PROFILE_OFFLINE_PROFILE_ID) {
    return {
      personId:
        Number.isSafeInteger(result?.person?.id) && result.person.id > 0 ? result.person.id : null,
      state: typeof result?.state === 'string' ? result.state : 'unknown',
    };
  }
  if (profileId === G06_CAST_OFFLINE_PROFILE_ID) {
    return summarizeG06SubjectCastOfflineResult(result, expectedArguments);
  }
  if (profileId === R01_RELATIONS_OFFLINE_PROFILE_ID) {
    return summarizeR01RelationsOfflineToolResult(result, expectedArguments);
  }
  if (profileId === R03_RELATIONS_OFFLINE_PROFILE_ID) {
    return summarizeR03RelationsOfflineToolResult(result, expectedArguments);
  }
  if (profileId === R02_POSITIVE_DIRECT_RELATIONS_PROFILE_ID) {
    return summarizeR02PositiveDirectRelationsToolResult(result, expectedArguments);
  }
  if (profileId === R04_SERIES_WATCH_ORDER_OFFLINE_PROFILE_ID) {
    const coverage = result?.coverage;
    return {
      state: ['complete', 'partial', 'not_computable'].includes(result?.state)
        ? result.state
        : 'unknown',
      subjectId:
        Number.isSafeInteger(result?.subjectId) && result.subjectId > 0 ? result.subjectId : null,
      watchOrderCount: Array.isArray(result?.watchOrder) ? result.watchOrder.length : null,
      relatedCount: Array.isArray(result?.related) ? result.related.length : null,
      relationRequests: Number.isSafeInteger(coverage?.relationRequests)
        ? coverage.relationRequests
        : null,
      relationRowsObserved: Number.isSafeInteger(coverage?.relationRowsObserved)
        ? coverage.relationRowsObserved
        : null,
      detailsAttempted: Number.isSafeInteger(coverage?.detailsAttempted)
        ? coverage.detailsAttempted
        : null,
    };
  }
  if (profileId === P03_PROFILE_ID) {
    return summarizeP03PersonProfileToolResult(result, expectedArguments);
  }
  if (profileId === P07_PROFILE_ID) {
    return summarizeP07PersonActivityToolResult(result, expectedArguments);
  }
  if (profileId === S05_PROFILE_ID) {
    return summarizeS05PersonActivityToolResult(result, expectedArguments);
  }
  if (profileId === R05_PROFILE_ID) {
    return summarizeR05SubjectOverlapToolResult(result, expectedArguments);
  }
  const summary = result?.summary;
  const coverage = result?.coverage;
  const rows = Array.isArray(result?.rows) ? result.rows : [];
  const byRole = Array.isArray(summary?.byRole) ? summary.byRole : [];
  return {
    personId: expectedArguments.personId,
    state: typeof result?.state === 'string' ? result.state : 'unknown',
    window: {
      months: Number.isInteger(result?.window?.months) ? result.window.months : null,
      start: typeof result?.window?.start === 'string' ? result.window.start : null,
      end: typeof result?.window?.end === 'string' ? result.window.end : null,
      asOfSemantics:
        typeof result?.window?.asOfSemantics === 'string' ? result.window.asOfSemantics : null,
    },
    summary: {
      uniqueSubjects: Number.isInteger(summary?.uniqueSubjects) ? summary.uniqueSubjects : null,
      byRole: byRole.slice(0, 4).map((item) => ({
        key: ['main', 'support', 'unknown', 'staff'].includes(item?.key)
          ? item.key
          : 'unclassified',
        creditRows: Number.isInteger(item?.creditRows) ? item.creditRows : null,
        uniqueSubjects: Number.isInteger(item?.uniqueSubjects) ? item.uniqueSubjects : null,
      })),
    },
    coverage: {
      relationRowsObserved: Number.isInteger(coverage?.relationRowsObserved)
        ? coverage.relationRowsObserved
        : null,
      relationRowsSelected: Number.isInteger(coverage?.relationRowsSelected)
        ? coverage.relationRowsSelected
        : null,
      relationRowsDroppedAtLimit: Number.isInteger(coverage?.relationRowsDroppedAtLimit)
        ? coverage.relationRowsDroppedAtLimit
        : null,
      subjectDetailsSucceeded: Number.isInteger(coverage?.subjectDetailsSucceeded)
        ? coverage.subjectDetailsSucceeded
        : null,
      subjectDetailsFailed: Number.isInteger(coverage?.subjectDetailsFailed)
        ? coverage.subjectDetailsFailed
        : null,
      rowsEligible: Number.isInteger(coverage?.rowsEligible) ? coverage.rowsEligible : null,
      rowsReturned: Number.isInteger(coverage?.rowsReturned) ? coverage.rowsReturned : null,
      outputTruncated:
        typeof coverage?.outputTruncated === 'boolean' ? coverage.outputTruncated : null,
      staffRoleUnknownRows: Number.isInteger(coverage?.staffRoleUnknownRows)
        ? coverage.staffRoleUnknownRows
        : null,
      truncated: typeof coverage?.truncated === 'boolean' ? coverage.truncated : null,
    },
    observedRows: rows.slice(0, expectedArguments.maxRows).map((row) => ({
      subjectId: Number.isSafeInteger(row?.subjectId) && row.subjectId > 0 ? row.subjectId : null,
      roleFamily: ['main', 'support', 'unknown'].includes(row?.roleFamily)
        ? row.roleFamily
        : 'unknown',
    })),
  };
}
