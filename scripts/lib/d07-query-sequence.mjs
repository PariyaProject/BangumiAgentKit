import { createHash } from 'node:crypto';
import {
  D07_EXPECTED_YEARS,
  D07_QUERY_ARGUMENTS_BY_YEAR,
} from '../acceptance/d07-current-rank-answer-check.mjs';

const TARGET_TOOL = 'bangumi.query_subjects';

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, canonicalize(value[key])]),
    );
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

/** A fail-closed, ordered, one-attempt gate for the ten D07 year queries. */
export function createD07QuerySequenceGate() {
  let nextIndex = 0;
  let deniedCalls = 0;
  let terminal = false;

  return {
    authorize(toolName, args) {
      if (terminal) {
        deniedCalls += 1;
        return { allowed: false, code: 'SEQUENCE_TERMINAL' };
      }
      if (toolName !== TARGET_TOOL) {
        deniedCalls += 1;
        terminal = true;
        return { allowed: false, code: 'UNEXPECTED_TOOL' };
      }
      if (nextIndex >= D07_EXPECTED_YEARS.length) {
        deniedCalls += 1;
        terminal = true;
        return { allowed: false, code: 'CALL_LIMIT_REACHED' };
      }
      const year = D07_EXPECTED_YEARS[nextIndex];
      if (canonicalJson(args ?? {}) !== canonicalJson(D07_QUERY_ARGUMENTS_BY_YEAR[year])) {
        deniedCalls += 1;
        terminal = true;
        return { allowed: false, code: 'ARGUMENT_MISMATCH' };
      }
      nextIndex += 1;
      return { allowed: true, year };
    },
    summary() {
      return {
        allowedCalls: nextIndex,
        deniedCalls,
        nextIndex,
        terminal,
      };
    },
  };
}

function titleSha256(item) {
  const title = item?.displayName;
  if (typeof title !== 'string' || title.trim().length === 0) return null;
  return createHash('sha256').update(title, 'utf8').digest('hex');
}

/** Keep only source identifiers, rank, coverage, time, and a title digest. */
export function summarizeD07QueryResult(year, result) {
  const rows = Array.isArray(result?.items) ? result.items : [];
  const coverage = result?.coverage ?? {};
  return {
    year,
    state: result?.state ?? 'error',
    operation: result?.plan?.operation ?? null,
    retrievedAt: typeof result?.retrievedAt === 'string' ? result.retrievedAt : null,
    totalKind: coverage.totalKind ?? null,
    coverage: {
      state: coverage.state ?? null,
      requested: coverage.requested ?? null,
      scanned: coverage.scanned ?? null,
      matched: coverage.matched ?? null,
      returned: coverage.returned ?? null,
    },
    itemCount: rows.length,
    items: rows.slice(0, 1).map((item) => ({
      id: Number.isSafeInteger(item?.id) ? item.id : null,
      rank: Number.isSafeInteger(item?.rank) ? item.rank : null,
      titleSha256: titleSha256(item),
    })),
  };
}
