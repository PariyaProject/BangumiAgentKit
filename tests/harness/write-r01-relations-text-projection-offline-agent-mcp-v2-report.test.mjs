import assert from 'node:assert/strict';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { createHash, generateKeyPairSync } from 'node:crypto';
import {
  agentMcpProfileArgumentsSha256,
  agentMcpProfileRegistrySha256,
  canonicalAgentMcpProfileJson,
  getAgentMcpProfileById,
} from '../../scripts/lib/agent-mcp-profile-claims.mjs';
import { verifyR01TextProjectionAnswer } from '../../scripts/acceptance/r01-relations-text-projection-answer-check.mjs';
import {
  buildR01TextProjectionProfileReport,
  validateR01TextProjectionProfileReport,
} from '../../scripts/acceptance/write-r01-relations-text-projection-offline-agent-mcp-v2-report.mjs';
import { P06_REQUIRED_CI_CHECKS } from '../../scripts/lib/p06-ci-run-evidence.mjs';
import {
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS,
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_PROFILE_ID,
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT,
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_SUBJECT_ID,
  R01_RELATIONS_TEXT_PROJECTION_OFFLINE_NETWORK_MODE,
  R01_RELATIONS_TEXT_PROJECTION_TOOL_NAME,
  r01RelationsTextProjectionSyntheticRows,
} from '../../scripts/lib/r01-relations-text-projection-offline-profile.mjs';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const PROFILE = getAgentMcpProfileById(R01_RELATIONS_TEXT_PROJECTION_OFFLINE_PROFILE_ID);
const SERVER_ID = 'bgk_r01_relations';
const sha256 = (value) => createHash('sha256').update(value).digest('hex');
const REQUIRED_SCOPE =
  '本次文本投影省略的关系仍在structuredContent；官方端点没有分页或总数，因此不代表完整关系图，也不证明未返回关系不存在。';

function makeTempRoot() {
  const root = mkdtempSync(path.join(os.tmpdir(), 'bgk-r01-text-projection-report-'));
  mkdirSync(path.join(root, 'docs/live-probes'), { recursive: true });
  mkdirSync(path.dirname(path.join(root, PROFILE.selectionEvidencePath)), { recursive: true });
  copyFileSync(
    path.join(ROOT, 'docs/tool-catalog.json'),
    path.join(root, 'docs/tool-catalog.json'),
  );
  copyFileSync(
    path.join(ROOT, PROFILE.selectionEvidencePath),
    path.join(root, PROFILE.selectionEvidencePath),
  );
  return root;
}

function makeClaim(publicKeyBase64) {
  return {
    claimId: `profile-run-95-pr-8888-${'a'.repeat(12)}-1780000000000`,
    state: 'CLAIMED',
    profileId: PROFILE.id,
    frontierId: 'R01',
    epochId: PROFILE.epochId,
    runNumber: 95,
    prNumber: 8888,
    toolName: PROFILE.toolName,
    argumentProfile: PROFILE.argumentProfile,
    expectedArgumentsSha256: agentMcpProfileArgumentsSha256(PROFILE),
    registrySha256: agentMcpProfileRegistrySha256(PROFILE.id),
    sourceCandidateSha: 'a'.repeat(40),
    baseSha: 'b'.repeat(40),
    ciSha: 'a'.repeat(40),
    ciStatus: 'SUCCESS',
    ciRunId: '12345',
    ciChecks: P06_REQUIRED_CI_CHECKS.map((name) => ({
      name,
      status: 'COMPLETED',
      conclusion: 'SUCCESS',
    })),
    reviewerId: '/root/r01_text_projection_report_test',
    bundleSha256: 'c'.repeat(64),
    runnerReceiptPublicKey: publicKeyBase64,
    runnerReceiptPublicKeySha256: sha256(Buffer.from(publicKeyBase64, 'base64')),
    reportWritten: false,
    retryAllowed: false,
  };
}

function makeToolOutput() {
  const items = r01RelationsTextProjectionSyntheticRows().map(
    ({ id, name, name_cn, relation }) => ({
      id,
      type: 'anime',
      name,
      nameCn: name_cn,
      relation,
    }),
  );
  const structuredContent = {
    state: 'observed',
    subjectId: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_SUBJECT_ID,
    source: {
      api: 'Bangumi official v0',
      operation: 'GET /v0/subjects/{subject_id}/subjects',
      direction: 'source_subject_to_returned_target',
      scope: 'visible_direct_rows_returned_for_source_subject',
      retrievedAt: '2026-10-23T00:00:00.000Z',
    },
    coverage: {
      responseRowsObserved: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT,
      rowsReturned: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_ROW_COUNT,
      schemaDriftRows: 0,
      truncated: false,
      paginationAvailable: false,
      totalCountAvailable: false,
      completeness: 'not_provided_by_source',
    },
    limitations: [
      '仅表示本次响应中指定来源条目指向目标条目的直接关系，不含反向或传递关系。',
      '官方 v0 此操作没有分页、总数或系列完整性字段；未返回关系不等于不存在。',
      'relation 是来源记录的原始标签；接口行顺序不表示官方观看顺序。',
      '匿名可见性可能不包含敏感条目。',
    ],
    items,
  };
  const textResult = {
    ...structuredContent,
    items: items.slice(0, 12),
    textProjection: {
      rowsIncluded: 12,
      rowsOmitted: 18,
      displayNamesClipped: 0,
      relationLabelsClipped: 0,
      limitationsClipped: 0,
      imageFieldsOmitted: 0,
      fullStructuredContentAvailable: true,
    },
  };
  return {
    content: [{ type: 'text', text: JSON.stringify(textResult) }],
    structuredContent,
  };
}

function makeAnswer(toolOutput) {
  const textResult = JSON.parse(toolOutput.content[0].text);
  return JSON.stringify({
    sourceRowsObserved: 30,
    sourceRowsReturned: 30,
    sourceTruncated: false,
    textRowsIncluded: textResult.textProjection.rowsIncluded,
    textRowsOmitted: textResult.textProjection.rowsOmitted,
    structuredContentAvailable: true,
    firstDisplayedRelation: '改编',
    scope: REQUIRED_SCOPE,
  });
}

function makeBuildInput(claim) {
  const toolOutput = makeToolOutput();
  const answer = makeAnswer(toolOutput);
  const toolCalls = [
    {
      name: R01_RELATIONS_TEXT_PROJECTION_TOOL_NAME,
      state: 'DONE',
      arguments: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS,
    },
  ];
  const answerCheck = verifyR01TextProjectionAnswer(
    answer,
    R01_RELATIONS_TEXT_PROJECTION_OFFLINE_EXPECTED_ARGUMENTS,
    toolOutput,
    toolCalls,
  );
  const catalogBytes = readFileSync(path.join(ROOT, 'docs/tool-catalog.json'));
  const catalog = JSON.parse(catalogBytes.toString('utf8'));
  const catalogTool = catalog.find((tool) => tool.name === PROFILE.toolName);
  return {
    claim,
    serverSummary: {
      catalogSha256: sha256(catalogBytes),
      toolDescriptionSha256: sha256(catalogTool.description),
      inputSchemaSha256: sha256(canonicalAgentMcpProfileJson(catalogTool.inputSchema)),
      serverToolNames: [PROFILE.toolName],
      serverToolCount: 1,
      allowedCallCount: 1,
      deniedCallCount: 0,
      results: [
        {
          status: 'SUCCESS',
          resultSummary: {
            state: 'observed',
            sourceRowsObserved: 30,
            sourceRowsReturned: 30,
            sourceSchemaDriftRows: 0,
            sourceTruncated: false,
            paginationAvailable: false,
            totalCountAvailable: false,
            completeness: 'not_provided_by_source',
          },
        },
      ],
      offlineFixture: {
        profile: R01_RELATIONS_TEXT_PROJECTION_OFFLINE_NETWORK_MODE,
        requestCount: 1,
        relationRequestCount: 1,
        duplicateRequestCount: 0,
        unexpectedRequestCount: 0,
        authorizationHeaderCount: 0,
        expectedOperationsComplete: true,
      },
    },
    events: {
      processExitCode: 0,
      eventStreamParsed: true,
      turnCompleted: true,
      codexMcpToolEventCount: 1,
      codexErrorItemCount: 0,
      blockedWebSearchErrorItemCount: 0,
      unexpectedCodexErrorItemCount: 0,
      nonMcpToolEventCount: 0,
      nonMcpToolTypes: [],
      shellToolCallCount: 0,
      mcpServerNames: [SERVER_ID],
      exactCall: true,
      exactToolEvent: true,
    },
    answer,
    answerCheck,
    toolOutput: toolOutput,
    toolCalls,
    codexCliVersion: '1.0.0',
    eventStreamSha256: 'd'.repeat(64),
    serverSummarySha256: 'e'.repeat(64),
  };
}

test('R01 text-projection report binds the runner receipt, exact claim, and sanitized result', () => {
  const root = makeTempRoot();
  const keyPair = generateKeyPairSync('ed25519');
  const publicKeyBase64 = keyPair.publicKey
    .export({ type: 'spki', format: 'der' })
    .toString('base64');
  const claim = makeClaim(publicKeyBase64);
  const reportPath = path.join(root, PROFILE.reportPath);
  mkdirSync(path.dirname(reportPath), { recursive: true });

  try {
    const mismatchedInput = makeBuildInput(claim);
    mismatchedInput.answerCheck = {
      ...mismatchedInput.answerCheck,
      resultSummary: {
        ...mismatchedInput.answerCheck.resultSummary,
        textRowsOmitted: 17,
      },
    };
    assert.equal(
      buildR01TextProjectionProfileReport(mismatchedInput, {
        privateKey: keyPair.privateKey,
        root,
        reportPath,
      }).passed,
      false,
    );

    const result = buildR01TextProjectionProfileReport(makeBuildInput(claim), {
      privateKey: keyPair.privateKey,
      root,
      reportPath,
    });
    assert.equal(result.passed, true, JSON.stringify(result));
    const bytes = readFileSync(reportPath);
    const report = JSON.parse(bytes.toString('utf8'));
    assert.equal(result.reportSha256, sha256(bytes));
    assert.equal(validateR01TextProjectionProfileReport(report, claim, bytes, root).passed, true);
    assert.equal(
      validateR01TextProjectionProfileReport(
        report,
        { ...claim, runnerReceiptPublicKeySha256: 'f'.repeat(64) },
        bytes,
        root,
      ).passed,
      false,
    );

    const writtenClaim = {
      ...claim,
      state: 'REPORT_WRITTEN',
      reportWritten: true,
      reportSha256: sha256(bytes),
    };
    assert.equal(
      validateR01TextProjectionProfileReport(report, writtenClaim, bytes, root).passed,
      true,
    );
    assert.equal(
      validateR01TextProjectionProfileReport(
        report,
        { ...writtenClaim, epochId: 'wrong-epoch' },
        bytes,
        root,
      ).passed,
      false,
    );
    assert.equal(
      validateR01TextProjectionProfileReport(
        report,
        { ...writtenClaim, reportSha256: 'f'.repeat(64) },
        bytes,
        root,
      ).passed,
      false,
    );
    assert.equal(
      validateR01TextProjectionProfileReport(
        { ...report, resultSummary: { ...report.resultSummary, textRowsOmitted: 17 } },
        claim,
        null,
        root,
      ).passed,
      false,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
