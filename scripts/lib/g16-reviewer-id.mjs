const stableHarnessReviewerId = /^run95-g16-review[1-9]\d*-gpt-6-luna-max-[0-9a-f]{7,40}$/u;
const localRuntimeReviewerId = /^\/root\/[a-z0-9_]+$/u;

export function isG16LunaMaxReviewerId(reviewerId, prNumber) {
  if (typeof reviewerId !== 'string' || !Number.isSafeInteger(prNumber) || prNumber < 1) {
    return false;
  }
  const syntheticReviewerId = new RegExp(
    `^gpt-6-luna-max-run95-pr${prNumber}-round[1-9]\\d*$`,
    'u',
  );
  return (
    syntheticReviewerId.test(reviewerId) ||
    stableHarnessReviewerId.test(reviewerId) ||
    localRuntimeReviewerId.test(reviewerId)
  );
}
