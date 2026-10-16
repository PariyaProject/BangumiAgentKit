function isExactServerName(value) {
  return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/u.test(value);
}

function isExactToolName(value) {
  return typeof value === 'string' && /^bangumi\.[a-z][a-z0-9_]*$/u.test(value);
}

/**
 * Codex CLI needs an explicit per-tool approval setting for noninteractive MCP calls.
 * The quoted TOML component is required because Bangumi tool names contain a dot.
 */
export function codexMcpExactToolApprovalConfig(serverName, toolNames) {
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
  return toolNames.map(
    (toolName) =>
      `mcp_servers.${serverName}.tools.${JSON.stringify(toolName)}.approval_mode="approve"`,
  );
}

function isBlockedDisabledWebSearchError(item) {
  if (item?.type !== 'error' || typeof item.message !== 'string') return false;
  return /web[\s_-]?search/iu.test(item.message) && /(?:disabled|unavailable)/iu.test(item.message);
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
