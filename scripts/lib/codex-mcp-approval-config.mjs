function isExactServerName(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/u.test(value);
}

function isExactToolName(value) {
  return typeof value === 'string' && /^bangumi\.[a-z][a-z0-9_]*$/u.test(value);
}

/**
 * Configure a dedicated profile server with an exact exposed-tool allowlist.
 * Approval is server-wide, so the allowlist must contain every exposed tool.
 */
export function codexMcpExactToolAccessConfig(serverName, toolNames) {
  if (
    !isExactServerName(serverName) ||
    !Array.isArray(toolNames) ||
    toolNames.length < 1 ||
    toolNames.length > 8 ||
    toolNames.some((toolName) => !isExactToolName(toolName)) ||
    new Set(toolNames).size !== toolNames.length
  ) {
    throw new TypeError('Codex MCP approval config requires an exact server and unique tools.');
  }
  return [
    `mcp_servers.${serverName}.enabled_tools=${JSON.stringify(toolNames)}`,
    `mcp_servers.${serverName}.default_tools_approval_mode="approve"`,
  ];
}

const EXPECTED_BLOCKED_WEB_SEARCH_MESSAGES = new Set([
  'The web search tool is disabled.',
  'The web search tool is unavailable.',
]);

const VERBOSE_DISABLED_WEB_SEARCH_MESSAGE_MAX_LENGTH = 512;
const WEB_SEARCH_TOOL_MARKER = /\bweb[_\s-]+search(?:\s+tool)?\b/iu;
const DISABLED_WEB_SEARCH_RELATION =
  /\bweb[_\s-]+search(?:\s+tool)?\b[^.!?;\n]{0,96}\bdisabled\b|\bdisabled\b[^.!?;\n]{0,96}\bweb[_\s-]+search(?:\s+tool)?\b/iu;
const NEGATED_DISABLED_MARKER =
  /\b(?:not|never)\s+(?:(?:currently|explicitly|actually)\s+)?disabled\b|\b(?:isn't|wasn't)\s+disabled\b/iu;
const NETWORK_FAILURE_MARKERS = [
  /\b(?:dns|enotfound|ehostunreach|etimedout|econn[a-z0-9_]*)\b/iu,
  /\b(?:timeout|timed?[\s-]+out)\b/iu,
  /\bhttp\s+[45]\d{2}\b/iu,
  /\b(?:network|connection|socket)\s+(?:request\s+)?(?:failure|failed|error|refused|reset|closed|timeout|timed?[\s-]+out)\b/iu,
  /\b(?:request\s+)?(?:failed|unable)\s+to\s+connect\b/iu,
];

function isBlockedDisabledWebSearchError(item) {
  if (item?.type !== 'error' || typeof item.message !== 'string') return false;
  if (EXPECTED_BLOCKED_WEB_SEARCH_MESSAGES.has(item.message)) return true;
  return (
    item.message.length <= VERBOSE_DISABLED_WEB_SEARCH_MESSAGE_MAX_LENGTH &&
    WEB_SEARCH_TOOL_MARKER.test(item.message) &&
    !NEGATED_DISABLED_MARKER.test(item.message) &&
    !NETWORK_FAILURE_MARKERS.some((marker) => marker.test(item.message)) &&
    DISABLED_WEB_SEARCH_RELATION.test(item.message)
  );
}

/** Summarize error events without retaining their messages or other CLI output. */
export function summarizeCodexErrorItems(events) {
  const byId = new Map();
  const anonymousErrors = [];
  for (const event of Array.isArray(events) ? events : []) {
    if (event?.type !== 'item.completed' || event.item?.type !== 'error') continue;
    const id = typeof event.item.id === 'string' ? event.item.id : null;
    if (id) byId.set(id, event.item);
    else anonymousErrors.push(event.item);
  }
  const unique = [...byId.values()];
  const blockedWebSearchErrorItemCount =
    unique.filter(isBlockedDisabledWebSearchError).length +
    anonymousErrors.filter(isBlockedDisabledWebSearchError).length;
  const errorItemCount = unique.length + anonymousErrors.length;
  return {
    errorItemCount,
    blockedWebSearchErrorItemCount,
    unexpectedCodexErrorItemCount: errorItemCount - blockedWebSearchErrorItemCount,
  };
}
