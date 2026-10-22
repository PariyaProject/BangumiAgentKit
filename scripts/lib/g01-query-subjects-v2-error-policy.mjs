const EXPECTED_G01_V2_DISABLED_WEB_SEARCH_MESSAGES = new Set([
  'The web search tool is disabled.',
  'The web search tool is unavailable.',
  'The web_search tool is disabled for this Codex invocation because web search was not enabled in the request configuration.',
  'The web-search tool is disabled by the current Codex configuration.',
]);

function errorItems(events) {
  const byId = new Map();
  const anonymousErrors = [];
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.type !== 'item.completed' || event.item?.type !== 'error') continue;
    const id = typeof event.item.id === 'string' ? event.item.id : null;
    if (id) byId.set(id, event.item);
    else anonymousErrors.push(event.item);
  }
  return [...byId.values(), ...anonymousErrors];
}

/**
 * Classify only exact, known disabled-web-search diagnostics for the fresh G01 v2 profile.
 * Unknown or paraphrased messages remain unexpected so network failures cannot earn credit.
 */
export function summarizeG01QuerySubjectsV2CodexErrors(events) {
  const errors = errorItems(events);
  const blockedWebSearchErrorItemCount = errors.filter(
    (item) =>
      typeof item.message === 'string' &&
      EXPECTED_G01_V2_DISABLED_WEB_SEARCH_MESSAGES.has(item.message),
  ).length;
  return {
    errorItemCount: errors.length,
    blockedWebSearchErrorItemCount,
    unexpectedCodexErrorItemCount: errors.length - blockedWebSearchErrorItemCount,
  };
}
