export const P06_REQUIRED_CI_CHECKS = Object.freeze([
  'harness-control',
  'sqlite-default',
  'host-integration',
  'standalone-release-smoke',
  'postgres-compat',
  'provider-foundation',
  'discovery-foundation',
]);

const RUN_URL = /^\/PariyaProject\/BangumiAgentKit\/actions\/runs\/([1-9]\d*)\/?$/u;
const CHECK_URL =
  /^\/PariyaProject\/BangumiAgentKit\/actions\/runs\/([1-9]\d*)\/job\/[1-9]\d*\/?$/u;

function actionRunId(value, pattern) {
  try {
    const url = new URL(value);
    if (url.origin !== 'https://github.com') return null;
    return url.pathname.match(pattern)?.[1] ?? null;
  } catch {
    return null;
  }
}

export function deriveP06CiRunEvidence(ciUrl, statusCheckRollup) {
  const ciRunId = actionRunId(ciUrl, RUN_URL);
  if (!ciRunId || !Array.isArray(statusCheckRollup)) return null;

  const byName = new Map();
  for (const check of statusCheckRollup) {
    const name = check?.name ?? check?.context;
    if (!P06_REQUIRED_CI_CHECKS.includes(name)) continue;
    const entries = byName.get(name) ?? [];
    entries.push(check);
    byName.set(name, entries);
  }

  const ciChecks = [];
  for (const name of P06_REQUIRED_CI_CHECKS) {
    const entries = byName.get(name);
    if (entries?.length !== 1) return null;
    const check = entries[0];
    if (
      check?.status !== 'COMPLETED' ||
      check?.conclusion !== 'SUCCESS' ||
      actionRunId(check?.detailsUrl, CHECK_URL) !== ciRunId
    ) {
      return null;
    }
    ciChecks.push({ name, status: 'COMPLETED', conclusion: 'SUCCESS' });
  }

  return { ciRunId, ciChecks };
}

export function isValidP06CiRunEvidence(value) {
  if (
    !value ||
    typeof value !== 'object' ||
    !/^[1-9]\d{3,}$/u.test(value.ciRunId ?? '') ||
    !Array.isArray(value.ciChecks) ||
    value.ciChecks.length !== P06_REQUIRED_CI_CHECKS.length
  ) {
    return false;
  }
  return P06_REQUIRED_CI_CHECKS.every((name, index) => {
    const check = value.ciChecks[index];
    return (
      check?.name === name &&
      check?.status === 'COMPLETED' &&
      check?.conclusion === 'SUCCESS' &&
      Object.keys(check).sort().join('\0') === 'conclusion\0name\0status'
    );
  });
}
