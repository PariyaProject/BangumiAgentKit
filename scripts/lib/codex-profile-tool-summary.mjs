import {
  P03_PROFILE_ID,
  summarizeP03PersonProfileToolResult,
} from './p03-person-name-cn-evidence.mjs';
import {
  R05_PROFILE_ID,
  summarizeR05SubjectOverlapToolResult,
} from './r05-shared-person-overlap-evidence.mjs';

export function summarizeProfileToolResult(
  result,
  expectedArguments,
  profileId = null,
  artifactSummary = null,
) {
  if (profileId === 'p06-render-person-profile-offline-agent-mcp-v1') {
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
  if (profileId === P03_PROFILE_ID) {
    return summarizeP03PersonProfileToolResult(result, expectedArguments);
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
