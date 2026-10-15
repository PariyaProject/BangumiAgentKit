import {
  R05_COVERAGE_NOTE,
  R05_PROFILE_ID,
  buildR05McpTextProjection,
  summarizeR05SubjectOverlapToolResult,
} from '../../../scripts/lib/r05-shared-person-overlap-evidence.mjs';
import {
  agentMcpProfileArgumentsSha256,
  getAgentMcpProfileById,
} from '../../../scripts/lib/agent-mcp-profile-claims.mjs';
import { makeR05OverlapToolResult } from './r05-overlap-result.mjs';

const PROFILE = getAgentMcpProfileById(R05_PROFILE_ID);

export function makeR05ProfileReportInput(root, claim) {
  const rawResult = makeR05OverlapToolResult();
  const resultSummary = summarizeR05SubjectOverlapToolResult(rawResult, PROFILE.calls[0].arguments);
  const serverSummary = {
    serverProfile: 'closed-profile-sequence-anonymous-public-v1',
    profileId: PROFILE.id,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    sourceRevision: claim.sourceCandidateSha,
    bundleSha256: claim.bundleSha256,
    toolName: PROFILE.toolName,
    serverToolNames: [PROFILE.toolName],
    serverToolCount: 1,
    expectedCallCount: 1,
    serverResultStatus: 'SUCCESS',
    allowedCallCount: 1,
    deniedCallCount: 0,
    catalogSha256: 'd'.repeat(64),
    toolDescriptionSha256: 'e'.repeat(64),
    inputSchemaSha256: 'f'.repeat(64),
    results: [{ sequenceIndex: 0, status: 'SUCCESS', resultSummary }],
  };
  const events = {
    processExitCode: 0,
    eventStreamParsed: true,
    turnCompleted: true,
    mcpTextProjectionValid: true,
    codexMcpToolEventCount: 1,
    codexErrorItemCount: 0,
    nonMcpToolEventCount: 0,
    nonMcpToolTypes: [],
    shellToolCallCount: 0,
    mcpServerNames: ['bgk_r05_overlap'],
    allowedCallCount: 1,
    deniedCallCount: 0,
  };
  const call = {
    tool: PROFILE.toolName,
    arguments: PROFILE.calls[0].arguments,
    result: {
      structuredContent: rawResult,
      content: [{ type: 'text', text: JSON.stringify(buildR05McpTextProjection(resultSummary)) }],
    },
  };
  const answer = JSON.stringify({
    subjectIds: [1424, 3774],
    sharedPerson: { personId: 3847, creditSubjectIds: [1424, 3774] },
    castState: 'partial',
    coverageNote: R05_COVERAGE_NOTE,
  });

  return {
    root,
    claim,
    serverSummary,
    completedMcpCalls: [call],
    answer,
    codexCliVersion: '1.2.14',
    events,
    eventStreamSha256: '1'.repeat(64),
    serverSummarySha256: '2'.repeat(64),
  };
}
