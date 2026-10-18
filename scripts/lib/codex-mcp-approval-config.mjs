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

function isBlockedDisabledWebSearchError(item) {
  return (
    item?.type === 'error' &&
    typeof item.message === 'string' &&
    EXPECTED_BLOCKED_WEB_SEARCH_MESSAGES.has(item.message)
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
