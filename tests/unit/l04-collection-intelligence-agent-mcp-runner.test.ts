import { describe, expect, it } from 'vitest';
import { L04_AGENT_PROMPT } from '../../scripts/acceptance/run-l04-collection-intelligence-agent-mcp.mjs';
import { L04_SYNTHETIC_COLLECTION_FACTS } from '../../scripts/acceptance/l04-collection-intelligence-answer-check.mjs';

describe('L04 synthetic Agent/MCP prompt', () => {
  it('asks for a natural answer grounded in the tool result without seeding expected facts', () => {
    expect(L04_AGENT_PROMPT).toContain('base the answer only on its returned data');
    expect(L04_AGENT_PROMPT).toContain('Do not derive the observed count from the requested limit');
    expect(L04_AGENT_PROMPT).toContain('Write a natural answer');
    expect(L04_AGENT_PROMPT).not.toContain('Use exactly these');
    expect(L04_AGENT_PROMPT).not.toContain(L04_SYNTHETIC_COLLECTION_FACTS.topTag);
    expect(L04_AGENT_PROMPT).not.toContain('出现 7 次');
    expect(L04_AGENT_PROMPT).not.toContain('源报告共 30 条');
    expect(L04_AGENT_PROMPT).not.toContain('本次观察到的最多标签是');
  });
});
