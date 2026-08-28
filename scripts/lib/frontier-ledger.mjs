import { createHash } from 'node:crypto';

export const FRONTIER_SCHEMA = 'bangumi-frontier/v1';
export const ACTIONABLE_FRONTIER_STATUSES = new Set([
  'UNASSESSED',
  'PARTIAL',
  'RESEARCH_READY',
  'IMPLEMENTATION_READY',
]);
export const CLOSED_FRONTIER_STATUSES = new Set([
  'DELIVERED',
  'SUPERSEDED',
  'CLOSED_NO_SAFE_SOURCE',
  'CLOSED_LOW_VALUE',
  'PROTECTED_BOUNDARY',
]);
export const FRONTIER_STATUSES = new Set([
  ...ACTIONABLE_FRONTIER_STATUSES,
  ...CLOSED_FRONTIER_STATUSES,
]);

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, stableValue(nested)]),
    );
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(stableValue(value));
}

export function canonicalHash(value) {
  return createHash('sha256').update(canonicalJson(value)).digest('hex');
}

function isText(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function pathFromReference(reference) {
  return reference.split('#', 1)[0].split(':', 1)[0];
}

function countBy(items, key) {
  return Object.fromEntries(
    [...new Set(items.map((item) => item[key]))]
      .sort()
      .map((value) => [value, items.filter((item) => item[key] === value).length]),
  );
}

function issue(issues, code, message, details = {}) {
  issues.push({ code, message, details });
}

function validateReferences(issues, references, label, pathExists) {
  if (
    !Array.isArray(references) ||
    references.length === 0 ||
    references.some((ref) => !isText(ref))
  ) {
    issue(issues, 'FRONTIER_REFERENCE_REQUIRED', `${label} must contain repository references`);
    return;
  }
  for (const reference of references) {
    const referencedPath = pathFromReference(reference);
    if (!referencedPath || !pathExists(referencedPath)) {
      issue(issues, 'FRONTIER_REFERENCE_MISSING', `${label} references a missing path`, {
        reference,
      });
    }
  }
}

export function inspectFrontierLedger(
  ledger,
  {
    pathExists = () => true,
    expectedScenarioIds = [],
    expectedOpportunityIds = [],
    expectedQuestions = {},
    knownCapabilities = [],
    expectedPolicyVersion,
  } = {},
) {
  const issues = [];
  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) {
    issue(issues, 'FRONTIER_LEDGER_REQUIRED', 'Frontier ledger must be a JSON object');
    return {
      ok: false,
      issues,
      hash: canonicalHash(ledger ?? null),
      records: [],
      counts: { total: 0, by_status: {}, by_lane: {}, by_kind: {} },
      actionable_ids: [],
    };
  }
  if (
    ledger.schema !== FRONTIER_SCHEMA ||
    !Number.isInteger(ledger.version) ||
    ledger.version < 1
  ) {
    issue(issues, 'FRONTIER_SCHEMA_INVALID', `Expected ${FRONTIER_SCHEMA} with a positive version`);
  }
  if (!isText(ledger.policy_version)) {
    issue(issues, 'FRONTIER_POLICY_REQUIRED', 'Ledger policy_version is required');
  } else if (expectedPolicyVersion && ledger.policy_version !== expectedPolicyVersion) {
    issue(issues, 'FRONTIER_POLICY_STALE', 'Ledger policy_version is stale', {
      expected: expectedPolicyVersion,
      actual: ledger.policy_version,
    });
  }
  if (!Array.isArray(ledger.records)) {
    issue(issues, 'FRONTIER_RECORDS_REQUIRED', 'Ledger records must be an array');
  }
  const records = Array.isArray(ledger.records) ? ledger.records : [];
  const boundaries = Array.isArray(ledger.protected_boundaries) ? ledger.protected_boundaries : [];
  const boundaryIds = new Set();
  for (const [index, boundary] of boundaries.entries()) {
    if (!isText(boundary?.id) || boundaryIds.has(boundary.id)) {
      issue(issues, 'FRONTIER_BOUNDARY_INVALID', 'Protected boundary ids must be unique', {
        index,
        id: boundary?.id,
      });
      continue;
    }
    boundaryIds.add(boundary.id);
    if (!isText(boundary.title)) {
      issue(issues, 'FRONTIER_BOUNDARY_INVALID', 'Protected boundary title is required', {
        id: boundary.id,
      });
    }
    validateReferences(
      issues,
      boundary.charter_refs,
      `boundary ${boundary.id}.charter_refs`,
      pathExists,
    );
  }

  const ids = new Set();
  for (const [index, record] of records.entries()) {
    const label = `records[${index}]`;
    for (const field of [
      'id',
      'kind',
      'user_question',
      'lane',
      'status',
      'next_action',
      'reopen_when',
    ]) {
      if (!isText(record?.[field])) {
        issue(issues, 'FRONTIER_RECORD_INVALID', `${label}.${field} is required`);
      }
    }
    if (isText(record?.id)) {
      if (ids.has(record.id)) {
        issue(issues, 'FRONTIER_ID_DUPLICATE', `Duplicate frontier id ${record.id}`);
      }
      ids.add(record.id);
    }
    if (!FRONTIER_STATUSES.has(record?.status)) {
      issue(issues, 'FRONTIER_STATUS_INVALID', `${label}.status is not governed`, {
        id: record?.id,
        status: record?.status,
      });
    }
    validateReferences(issues, record?.source_refs, `${label}.source_refs`, pathExists);
    if (!Array.isArray(record?.related_ids)) {
      issue(issues, 'FRONTIER_RELATIONS_INVALID', `${label}.related_ids must be an array`);
    }
    if (record?.status === 'DELIVERED') {
      if (
        !Array.isArray(record.evidence?.capabilities) ||
        record.evidence.capabilities.length === 0
      ) {
        issue(
          issues,
          'FRONTIER_DELIVERED_EVIDENCE_REQUIRED',
          `${record.id} needs capability evidence`,
        );
      } else if (
        knownCapabilities.length > 0 &&
        record.evidence.capabilities.some((capability) => !knownCapabilities.includes(capability))
      ) {
        issue(
          issues,
          'FRONTIER_DELIVERED_CAPABILITY_UNKNOWN',
          `${record.id} names a capability absent from the generated tool catalog`,
          {
            unknown: record.evidence.capabilities.filter(
              (capability) => !knownCapabilities.includes(capability),
            ),
          },
        );
      }
      validateReferences(issues, record.evidence?.tests, `${label}.evidence.tests`, pathExists);
    }
    if (record?.status === 'PROTECTED_BOUNDARY') {
      if (!isText(record.boundary_id) || !boundaryIds.has(record.boundary_id)) {
        issue(
          issues,
          'FRONTIER_BOUNDARY_UNKNOWN',
          `${record.id} names no canonical Charter boundary`,
          {
            boundary_id: record.boundary_id,
          },
        );
      }
    }
    if (record?.status === 'CLOSED_NO_SAFE_SOURCE') {
      if (!isText(record.research_closure?.completed_at)) {
        issue(
          issues,
          'FRONTIER_RESEARCH_CLOSURE_REQUIRED',
          `${record.id} needs a research close time`,
        );
      }
      validateReferences(
        issues,
        record.research_closure?.evidence_refs,
        `${label}.research_closure.evidence_refs`,
        pathExists,
      );
    }
    if (CLOSED_FRONTIER_STATUSES.has(record?.status) && !isText(record.closure_reason)) {
      issue(
        issues,
        'FRONTIER_CLOSURE_REASON_REQUIRED',
        `${record.id} needs a concrete closure reason`,
      );
    }
  }

  for (const record of records) {
    for (const relatedId of record.related_ids ?? []) {
      if (!ids.has(relatedId)) {
        issue(issues, 'FRONTIER_RELATION_UNKNOWN', `${record.id} references unknown ${relatedId}`);
      }
    }
  }
  for (const expectedId of expectedScenarioIds) {
    if (!ids.has(expectedId)) {
      issue(
        issues,
        'FRONTIER_SCENARIO_MISSING',
        `Scenario ${expectedId} is absent from the ledger`,
      );
    }
  }
  const scenarioIds = records
    .filter((record) => record.kind === 'scenario')
    .map((record) => record.id);
  if (expectedScenarioIds.length > 0) {
    for (const id of scenarioIds) {
      if (!expectedScenarioIds.includes(id)) {
        issue(
          issues,
          'FRONTIER_SCENARIO_UNKNOWN',
          `Ledger scenario ${id} is absent from the catalog`,
        );
      }
    }
  }
  for (const expectedId of expectedOpportunityIds) {
    if (!ids.has(expectedId)) {
      issue(
        issues,
        'FRONTIER_OPPORTUNITY_MISSING',
        `Opportunity ${expectedId} is absent from the ledger`,
      );
    }
  }
  for (const [id, expectedQuestion] of Object.entries(expectedQuestions)) {
    const actual = records.find((record) => record.id === id)?.user_question;
    if (actual !== expectedQuestion) {
      issue(
        issues,
        'FRONTIER_QUESTION_MISMATCH',
        `${id} question differs from its source catalog`,
        {
          expected: expectedQuestion,
          actual,
        },
      );
    }
  }

  const actionableIds = records
    .filter((record) => ACTIONABLE_FRONTIER_STATUSES.has(record.status))
    .map((record) => record.id)
    .sort();
  return {
    ok: issues.length === 0,
    issues,
    hash: canonicalHash(ledger),
    records,
    counts: {
      total: records.length,
      by_status: countBy(records, 'status'),
      by_lane: countBy(records, 'lane'),
      by_kind: countBy(records, 'kind'),
    },
    actionable_ids: actionableIds,
  };
}

function sameStringSet(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    [...new Set(left)].sort().join('\n') === [...new Set(right)].sort().join('\n')
  );
}

export function inspectFrontierClosure({
  ledger,
  evidence,
  currentBaseSha,
  policyVersion,
  pathExists = () => true,
  expectedScenarioIds = [],
  expectedOpportunityIds = [],
  expectedQuestions = {},
  knownCapabilities = [],
}) {
  const ledgerResult = inspectFrontierLedger(ledger, {
    pathExists,
    expectedScenarioIds,
    expectedOpportunityIds,
    expectedQuestions,
    knownCapabilities,
    expectedPolicyVersion: policyVersion,
  });
  const issues = [...ledgerResult.issues];
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) {
    issue(issues, 'DISCOVERY_EVIDENCE_REQUIRED', 'Frontier closure evidence must be an object');
    return { ok: false, issues, ledger: ledgerResult };
  }
  if (evidence.policy_version !== policyVersion) {
    issue(issues, 'DISCOVERY_POLICY_STALE', 'Closure evidence policy version is stale', {
      expected: policyVersion,
      actual: evidence.policy_version,
    });
  }
  if (evidence.audited_sha !== currentBaseSha) {
    issue(issues, 'DISCOVERY_EVIDENCE_STALE', 'Closure evidence does not cover current master', {
      expected: currentBaseSha,
      actual: evidence.audited_sha,
    });
  }
  if (evidence.ledger_hash !== ledgerResult.hash) {
    issue(
      issues,
      'FRONTIER_LEDGER_HASH_MISMATCH',
      'Closure evidence does not bind the exact ledger',
      {
        expected: ledgerResult.hash,
        actual: evidence.ledger_hash,
      },
    );
  }

  const assessments = Array.isArray(evidence.frontier_assessments)
    ? evidence.frontier_assessments
    : [];
  const assessmentIds = assessments.map((assessment) => assessment?.id).filter(isText);
  const recordIds = ledgerResult.records.map((record) => record.id);
  if (!sameStringSet(assessmentIds, recordIds)) {
    issue(
      issues,
      'FRONTIER_COVERAGE_INCOMPLETE',
      'Closure must assess every canonical frontier record',
      {
        missing: recordIds.filter((id) => !assessmentIds.includes(id)).sort(),
        unknown: assessmentIds.filter((id) => !recordIds.includes(id)).sort(),
      },
    );
  }
  if (new Set(assessmentIds).size !== assessmentIds.length) {
    issue(issues, 'FRONTIER_COVERAGE_DUPLICATE', 'Frontier assessments contain duplicate ids');
  }
  const recordsById = new Map(ledgerResult.records.map((record) => [record.id, record]));
  const conclusions = new Set();
  const deltas = new Set();
  const conclusionFingerprints = new Set();
  const deltaFingerprints = new Set();
  for (const assessment of assessments) {
    const record = recordsById.get(assessment?.id);
    if (!record) continue;
    if (assessment.status !== record.status) {
      issue(
        issues,
        'FRONTIER_STATUS_CONTRADICTION',
        `${record.id} assessment contradicts the ledger`,
        {
          ledger: record.status,
          assessment: assessment.status,
        },
      );
    }
    if (!isText(assessment.conclusion) || assessment.conclusion.length < 32) {
      issue(issues, 'FRONTIER_ASSESSMENT_GENERIC', `${record.id} needs a concrete conclusion`);
    } else {
      conclusions.add(assessment.conclusion.trim());
      conclusionFingerprints.add(
        assessment.conclusion.replaceAll(record.id, '<FRONTIER_ID>').trim(),
      );
    }
    if (
      !isText(assessment.delta_since_previous_audit) ||
      assessment.delta_since_previous_audit.length < 24
    ) {
      issue(issues, 'FRONTIER_ASSESSMENT_GENERIC', `${record.id} needs a cross-audit delta`);
    } else {
      deltas.add(assessment.delta_since_previous_audit.trim());
      deltaFingerprints.add(
        assessment.delta_since_previous_audit.replaceAll(record.id, '<FRONTIER_ID>').trim(),
      );
    }
    if (!sameStringSet(assessment.evidence_refs, record.source_refs)) {
      issue(
        issues,
        'FRONTIER_EVIDENCE_CONTRADICTION',
        `${record.id} evidence references differ from the ledger`,
      );
    }
  }
  if (assessments.length > 1 && conclusions.size !== assessments.length) {
    issue(
      issues,
      'FRONTIER_ASSESSMENT_GENERIC',
      'Every frontier record needs a distinct evidence-backed conclusion',
    );
  }
  if (assessments.length > 1 && conclusionFingerprints.size !== assessments.length) {
    issue(
      issues,
      'FRONTIER_ASSESSMENT_GENERIC',
      'Frontier conclusions must differ in substance, not only by record id',
    );
  }
  if (assessments.length > 1 && deltas.size !== assessments.length) {
    issue(
      issues,
      'FRONTIER_ASSESSMENT_GENERIC',
      'Every frontier record needs a distinct cross-audit delta',
    );
  }
  if (assessments.length > 1 && deltaFingerprints.size !== assessments.length) {
    issue(
      issues,
      'FRONTIER_ASSESSMENT_GENERIC',
      'Cross-audit deltas must differ in substance, not only by record id',
    );
  }
  if (!sameStringSet(evidence.assessed_frontier_ids, recordIds)) {
    issue(
      issues,
      'FRONTIER_COVERAGE_INCOMPLETE',
      'assessed_frontier_ids must equal the ledger inventory',
    );
  }
  if (canonicalJson(evidence.frontier_inventory) !== canonicalJson(ledgerResult.counts)) {
    issue(issues, 'FRONTIER_INVENTORY_MISMATCH', 'Evidence inventory does not match the ledger');
  }
  if (ledgerResult.actionable_ids.length > 0) {
    issue(
      issues,
      'FRONTIER_ACTIONABLE_REMAINS',
      'Trusted exhaustion is impossible while frontier work remains',
      {
        actionable_ids: ledgerResult.actionable_ids,
      },
    );
  }
  return {
    ok: issues.length === 0,
    issues,
    ledger: ledgerResult,
    evidence_hash: canonicalHash(evidence),
  };
}
