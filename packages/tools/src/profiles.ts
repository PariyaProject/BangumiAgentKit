/**
 * Model-facing tool profiles.
 *
 * The compact profile is deliberately a small, public read-only surface. It
 * is an allowlist rather than a second implementation of any Bangumi API;
 * the tool definitions and their schemas remain the single source of truth.
 */

export type ToolMode = 'compact' | 'curated' | 'full';

export type ToolProfile = 'compact' | 'full';

export const COMPACT_MCP_PROFILE_ID = 'bangumi-compact-v1' as const;

export const COMPACT_MCP_TOOL_NAMES = [
  'bangumi.search_subjects',
  'bangumi.get_subject',
  'bangumi.get_subject_cast',
  'bangumi.query_subjects',
] as const;

export type CompactMcpToolName = (typeof COMPACT_MCP_TOOL_NAMES)[number];

export interface ToolProfileDefinition {
  readonly id: string;
  readonly mode: ToolProfile;
  readonly description: string;
  readonly toolNames: readonly CompactMcpToolName[];
}

/**
 * Stable metadata for the reusable MCP profile consumed by Bot deployments.
 * Keep this object data-only so applications can use it for drift checks and
 * catalog generation without constructing a runtime or opening a database.
 */
export const COMPACT_MCP_PROFILE: ToolProfileDefinition = Object.freeze({
  id: COMPACT_MCP_PROFILE_ID,
  mode: 'compact',
  description:
    'Bounded public read-only Bangumi discovery and subject lookup for model-facing MCP clients.',
  toolNames: COMPACT_MCP_TOOL_NAMES,
});

export function normalizeToolMode(mode: ToolMode | undefined): ToolProfile {
  // `curated` was present in the original public type before a working
  // profile switch existed. Keep it as a compatibility alias for compact.
  // Omitting the mode preserves the historical full registry behavior.
  return mode === undefined || mode === 'full' ? 'full' : 'compact';
}

export function isCompactMcpToolName(name: string): name is CompactMcpToolName {
  return (COMPACT_MCP_TOOL_NAMES as readonly string[]).includes(name);
}
