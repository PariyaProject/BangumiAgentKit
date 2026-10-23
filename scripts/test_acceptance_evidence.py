#!/usr/bin/env python3
"""Negative tests for catalog-bound public API acceptance evidence."""

import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).with_name('generate-tool-acceptance-tasks.py')
SPEC = importlib.util.spec_from_file_location('tool_acceptance_generator', SCRIPT)
if SPEC is None or SPEC.loader is None:
    raise RuntimeError('Could not load acceptance generator')
GENERATOR = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(GENERATOR)

TABLE_CHECKER_SCRIPT = Path(__file__).with_name('check-tool-acceptance-table.py')
TABLE_SPEC = importlib.util.spec_from_file_location('tool_acceptance_table_checker', TABLE_CHECKER_SCRIPT)
if TABLE_SPEC is None or TABLE_SPEC.loader is None:
    raise RuntimeError('Could not load acceptance table checker')
TABLE_CHECKER = importlib.util.module_from_spec(TABLE_SPEC)
TABLE_SPEC.loader.exec_module(TABLE_CHECKER)


def _commit_catalog_source_revision(root):
    subprocess.run(
        ['git', '-C', str(root), 'init', '--quiet'],
        check=True, capture_output=True,
    )
    subprocess.run(
        ['git', '-C', str(root), '-c', 'user.name=Acceptance Test',
         '-c', 'user.email=acceptance-test@example.invalid', 'add', '--',
         'docs/tool-catalog.json'],
        check=True, capture_output=True,
    )
    subprocess.run(
        ['git', '-C', str(root), '-c', 'user.name=Acceptance Test',
         '-c', 'user.email=acceptance-test@example.invalid', 'commit',
         '--quiet', '-m', 'Fixture source catalog'],
        check=True, capture_output=True,
    )
    return subprocess.run(
        ['git', '-C', str(root), 'rev-parse', 'HEAD'],
        check=True, capture_output=True, text=True,
    ).stdout.strip()


class G01RenderQueryProfileContractTests(unittest.TestCase):
    def test_v1_and_v2_are_independently_bound_in_acceptance_helpers(self):
        profile_ids = [
            'g01-render-query-subjects-offline-agent-mcp-v1',
            'g01-render-query-subjects-offline-agent-mcp-v2',
        ]
        for profile_id in profile_ids:
            with self.subTest(profile_id=profile_id):
                profile = GENERATOR.codex_g01_render_query_offline_profile_spec(profile_id)
                self.assertIsNotNone(profile)
                registry_sha, arguments_sha = GENERATOR.codex_g01_render_query_offline_profile_hashes(profile)
                self.assertRegex(registry_sha, r'^[0-9a-f]{64}$')
                self.assertRegex(arguments_sha, r'^[0-9a-f]{64}$')
                changed_paths = [
                    profile['reportPath'],
                    'docs/product/frontier-ledger.json',
                    'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
                ]
                self.assertTrue(
                    GENERATOR.codex_g01_render_query_offline_profile_evidence_refresh_paths_are_valid(
                        changed_paths, profile_id,
                    ),
                )
                changed_paths[0] = 'docs/live-probes/wrong-profile-report.json'
                self.assertFalse(
                    GENERATOR.codex_g01_render_query_offline_profile_evidence_refresh_paths_are_valid(
                        changed_paths, profile_id,
                    ),
                )

                version = 'v2' if profile_id.endswith('-v2') else 'v1'
                acknowledgement = (
                    'G01_RENDER_QUERY_SYNTHETIC_OFFLINE_V2_OK'
                    if version == 'v2'
                    else 'G01_RENDER_QUERY_SYNTHETIC_OFFLINE_OK'
                )
                report = {
                    'profileId': profile_id,
                    'evidenceKind': profile['evidenceKind'],
                    'profile': f'codex-luna-max-offline-agent-mcp-matrix-{version}',
                    'epochId': profile['epochId'],
                    'runNumber': 95,
                    'frontierId': 'G01',
                    'scenarioId': None,
                    'resultStatus': 'SUCCESS',
                    'codexMcpToolEventCount': 1,
                    'codexErrorItemCount': 0,
                    'allowedCallCount': 1,
                    'deniedCallCount': 0,
                    'nonMcpToolEventCount': 0,
                    'nonMcpToolTypes': [],
                    'shellToolCallCount': 0,
                    'toolName': profile['toolName'],
                    'serverToolNames': [profile['toolName']],
                    'mcpServerNames': ['bgk_g01_render_query'],
                    'networkMode': profile['networkMode'],
                    'offlineFixture': {
                        'profile': profile['networkMode'],
                        'requestCount': 2,
                        'searchRequestCount': 1,
                        'subjectDetailRequestCount': 1,
                        'duplicateRequestCount': 0,
                        'unexpectedRequestCount': 0,
                        'authorizationHeaderCount': 0,
                        'expectedOperationsComplete': True,
                        'rawFixturePayloadStored': False,
                    },
                    'offlineAssetBoundary': {
                        'assetResolutionCallCount': 0,
                        'nonEmptyAssetUrlCount': 0,
                        'blockedAssetRequestCount': 0,
                    },
                    'networkBoundary': {
                        'liveBangumiApiRequestCount': 0,
                        'rendererAssetRequestCount': 0,
                    },
                    'artifact': {
                        'returned': True,
                        'persisted': False,
                        'mimeType': 'image/png',
                        'width': 10,
                        'height': 10,
                        'byteLength': 32,
                        'pngSignatureValid': True,
                    },
                    'answerChecks': {f'check{index}': True for index in range(10)},
                    'answerCheckMethod': profile['answerCheckMethod'],
                    'answerSha256': hashlib.sha256(acknowledgement.encode()).hexdigest(),
                    'answerUtf8Bytes': len(acknowledgement.encode()),
                }
                if version == 'v2':
                    report['mcpToolErrorResultCount'] = 0
                self.assertTrue(
                    TABLE_CHECKER.g01_render_query_report_matches(
                        profile['toolName'], profile['reportPath'], report,
                    ),
                )
                report['mcpToolErrorResultCount'] = 1 if version == 'v2' else 0
                self.assertFalse(
                    TABLE_CHECKER.g01_render_query_report_matches(
                        profile['toolName'], profile['reportPath'], report,
                    ),
                )

    def test_candidate_binding_uses_the_selected_profile_epoch_and_report_path(self):
        profile_id = 'g01-render-query-subjects-offline-agent-mcp-v2'
        profile = GENERATOR.codex_g01_render_query_offline_profile_spec(profile_id)
        candidate_sha = 'a' * 40
        base_sha = 'b' * 40
        branch = 'codex/epoch-run95-g01-render-query-offline-matrix-v2-call-20261018'
        report = {
            'profileId': profile_id,
            'prNumber': 223,
            'sourceRevision': candidate_sha,
            'baseSha': base_sha,
            'mcpBundleSha256': 'c' * 64,
        }
        epoch_status = {
            'run': {
                'number': 95,
                'state': {'state': 'EPOCH_ACTIVE', 'active_epoch_pr': 223},
            },
            'epoch': {
                'github_state': 'OPEN',
                'state': {
                    'candidate_sha': candidate_sha,
                    'epoch_id': profile['epochId'],
                    'pr_number': 223,
                    'base_branch': 'master',
                    'base_sha': base_sha,
                    'branch': branch,
                    'review_history': [],
                },
                'pr_base_ref_name': 'master',
                'pr_base_sha': base_sha,
                'pr_head_ref_name': branch,
                'pr_is_draft': False,
                'pr_head_sha': candidate_sha,
            },
        }
        changed_paths = [
            profile['reportPath'],
            'docs/product/frontier-ledger.json',
            'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
        ]
        self.assertTrue(
            GENERATOR.codex_g01_render_query_offline_profile_candidate_binding_is_valid(
                report, epoch_status, changed_paths, 'c' * 64,
            ),
        )
        epoch_status['epoch']['state']['epoch_id'] = (
            'run95-g01-render-query-subjects-offline-matrix-20261017'
        )
        self.assertFalse(
            GENERATOR.codex_g01_render_query_offline_profile_candidate_binding_is_valid(
                report, epoch_status, changed_paths, 'c' * 64,
            ),
        )


class RenderSubjectCardOfflineProfileAcceptanceTests(unittest.TestCase):
    def setUp(self):
        self.profile = TABLE_CHECKER.RENDER_SUBJECT_CARD_OFFLINE_PROFILE
        self.ack = b'RENDER_SUBJECT_CARD_SYNTHETIC_ARTIFACT_READY'
        self.source = 'a' * 40
        self.base = 'b' * 40
        self.pr = 257
        self.calls = self.profile['calls']
        self.registry_sha = hashlib.sha256(json.dumps(
            self.profile, sort_keys=True, separators=(',', ':'), ensure_ascii=False,
        ).encode('utf-8')).hexdigest()
        self.arguments_sha = hashlib.sha256(json.dumps(
            [call['arguments'] for call in self.calls],
            sort_keys=True, separators=(',', ':'), ensure_ascii=False,
        ).encode('utf-8')).hexdigest()
        self.report = {
            'schemaVersion': 1,
            'evidenceKind': self.profile['evidenceKind'],
            'runNumber': 95,
            'frontierId': 'OP-008',
            'scenarioId': None,
            'epochId': self.profile['epochId'],
            'profileId': self.profile['id'],
            'profile': 'codex-luna-max-offline-agent-mcp-matrix-v3',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'reviewerId': f'gpt-6-luna-max-run95-pr{self.pr}-round1',
            'codexCliVersion': '1.2.14',
            'sourceRevision': self.source,
            'baseSha': self.base,
            'ciSha': self.source,
            'ciStatus': 'SUCCESS',
            'ciRunId': '39577770000',
            'ciChecks': [
                {'name': name, 'status': 'COMPLETED', 'conclusion': 'SUCCESS'}
                for name in (
                    'harness-control', 'sqlite-default', 'host-integration',
                    'standalone-release-smoke', 'postgres-compat', 'provider-foundation',
                    'discovery-foundation',
                )
            ],
            'prNumber': self.pr,
            'claimId': f'profile-run-95-pr-{self.pr}-{self.source[:12]}-1792600000000',
            'mcpBundleSha256': 'c' * 64,
            'registrySha256': self.registry_sha,
            'toolName': self.profile['toolName'],
            'argumentProfile': self.profile['argumentProfile'],
            'expectedArgumentsSha256': self.arguments_sha,
            'serverToolNames': [self.profile['toolName']],
            'serverToolCount': 1,
            'networkMode': self.profile['networkMode'],
            'mcpServerNames': ['bgk_render_subject_card_offline'],
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'eventStreamParsed': True,
            'turnCompleted': True,
            'codexMcpToolEventCount': 1,
            'codexErrorItemCount': 0,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'answerCheckMethod': self.profile['answerCheckMethod'],
            'answerSha256': hashlib.sha256(self.ack).hexdigest(),
            'answerUtf8Bytes': len(self.ack),
            'offlineFixture': {
                'profile': self.profile['networkMode'],
                'expectedOperation': 'GET /v0/subjects/991903',
                'requestCount': 1,
                'expectedRequestCount': 1,
                'unexpectedRequestCount': 0,
                'authorizationHeaderCount': 0,
                'collectionRequestCount': 0,
                'expectedOperationComplete': True,
                'rawFixturePayloadStored': False,
            },
            'offlineAssetBoundary': {
                'assetResolutionCallCount': 0,
                'nonEmptyAssetUrlCount': 0,
                'blockedAssetRequestCount': 0,
                'localFallbackUsed': True,
            },
            'networkBoundary': {
                'liveBangumiApiRequestCount': 0,
                'rendererAssetRequestCount': 0,
                'fullCodexHarnessNetworkSandboxed': False,
            },
            'artifact': {
                'returned': True, 'persisted': False, 'mimeType': 'image/png',
                'width': 720, 'height': 1576, 'byteLength': 257734,
                'sha256': 'd' * 64, 'pngSignatureValid': True,
            },
            'answerChecks': {
                'exactRegisteredProfile': True,
                'oneAllowedMcpTool': True,
                'fixedArguments': True,
                'exactCandidateBundle': True,
                'offlineFixtureOnly': True,
                'noAuthorizationOrCollection': True,
                'noAssetResolution': True,
                'artifactReturned': True,
                'exactAcknowledgement': True,
                'privacyPreserved': True,
            },
            'privacy': {
                'authProfile': 'anonymous', 'oauthAttempted': False,
                'accountDataRead': False, 'writesAttempted': False, 'communityRead': False,
                'qqPipelineTested': False, 'timClientTested': False, 'promptStored': False,
                'answerStored': False, 'rawFixtureRowsStored': False, 'rawToolResultStored': False,
                'artifactImageBytesStored': False, 'credentialsStored': False,
            },
            'runnerReceipt': {
                'kind': 'render-subject-card-offline-agent-mcp-runner-receipt-v1',
                'payload': {}, 'signature': 'signature',
            },
        }

    def test_current_candidate_has_offline_render_subject_card_implementation_markers(self):
        revision = subprocess.run(
            ['git', 'rev-parse', 'HEAD'], cwd=GENERATOR.ROOT, check=True,
            capture_output=True, text=True,
        ).stdout.strip()
        self.assertTrue(
            GENERATOR.codex_render_subject_card_offline_profile_revision_has_implementation(
                revision,
            ),
        )

    def test_matrix_mapper_only_accepts_the_exact_offline_renderer_contract(self):
        self.assertTrue(TABLE_CHECKER.render_subject_card_offline_agent_mcp_matches(
            self.profile['toolName'], self.profile['reportPath'], self.report,
        ))
        mutations = [
            ('toolName', 'bangumi.render_subject_stats'),
            ('frontierId', 'P06'),
            ('codexMcpToolEventCount', 2),
            ('shellToolCallCount', 1),
        ]
        for field, value in mutations:
            with self.subTest(field=field):
                changed = dict(self.report)
                changed[field] = value
                self.assertFalse(TABLE_CHECKER.render_subject_card_offline_agent_mcp_matches(
                    self.profile['toolName'], self.profile['reportPath'], changed,
                ))
        changed = json.loads(json.dumps(self.report))
        changed['offlineFixture']['collectionRequestCount'] = 1
        self.assertFalse(TABLE_CHECKER.render_subject_card_offline_agent_mcp_matches(
            self.profile['toolName'], self.profile['reportPath'], changed,
        ))

    def test_candidate_binding_uses_the_selected_epoch_and_evidence_refresh_allowlist(self):
        branch = 'codex/epoch-run95-render-subject-card-offline-agent-mcp-20261021'
        epoch_status = {
            'run': {
                'number': 95,
                'state': {'state': 'EPOCH_ACTIVE', 'active_epoch_pr': self.pr},
            },
            'epoch': {
                'github_state': 'OPEN',
                'state': {
                    'candidate_sha': self.source,
                    'epoch_id': self.profile['epochId'],
                    'pr_number': self.pr,
                    'base_branch': 'master',
                    'base_sha': self.base,
                    'branch': branch,
                    'review_history': [],
                },
                'pr_base_ref_name': 'master',
                'pr_base_sha': self.base,
                'pr_head_ref_name': branch,
                'pr_is_draft': False,
                'pr_head_sha': self.source,
            },
        }
        paths = [
            self.profile['reportPath'],
            'docs/product/frontier-ledger.json',
            'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
        ]
        self.assertTrue(GENERATOR.codex_render_subject_card_offline_profile_candidate_binding_is_valid(
            self.report, epoch_status, paths, self.report['mcpBundleSha256'],
        ))
        self.assertTrue(GENERATOR.codex_render_subject_card_offline_profile_frontier_is_partial())
        paths.append('scripts/agent-harness.mjs')
        self.assertFalse(GENERATOR.codex_render_subject_card_offline_profile_candidate_binding_is_valid(
            self.report, epoch_status, paths, self.report['mcpBundleSha256'],
        ))

    def test_v5_profile_is_registered_with_its_exact_report_path_and_refresh_scope(self):
        profile_id = 'render-subject-card-compact-typography-agent-mcp-v5'
        profile = TABLE_CHECKER.RENDER_SUBJECT_CARD_OFFLINE_PROFILES[profile_id]
        arguments = [call['arguments'] for call in profile['calls']]
        arguments_sha = hashlib.sha256(json.dumps(
            arguments, sort_keys=True, separators=(',', ':'), ensure_ascii=False,
        ).encode('utf-8')).hexdigest()
        registry_sha = hashlib.sha256(json.dumps(
            profile, sort_keys=True, separators=(',', ':'), ensure_ascii=False,
        ).encode('utf-8')).hexdigest()
        report = json.loads(json.dumps(self.report))
        report.update({
            'epochId': profile['epochId'],
            'profileId': profile_id,
            'evidenceKind': profile['evidenceKind'],
            'profile': 'codex-luna-max-offline-agent-mcp-matrix-v5',
            'toolName': profile['toolName'],
            'argumentProfile': profile['argumentProfile'],
            'answerCheckMethod': profile['answerCheckMethod'],
            'expectedArgumentsSha256': arguments_sha,
            'registrySha256': registry_sha,
            'networkMode': profile['networkMode'],
        })
        report['offlineFixture'].update({
            'profile': profile['networkMode'],
            'expectedOperation': f"GET /v0/subjects/{arguments[0]['subjectId']}",
        })

        self.assertTrue(TABLE_CHECKER.render_subject_card_offline_agent_mcp_matches(
            profile['toolName'], profile['reportPath'], report,
        ))
        self.assertFalse(TABLE_CHECKER.render_subject_card_offline_agent_mcp_matches(
            profile['toolName'], self.profile['reportPath'], report,
        ))
        self.assertEqual(
            GENERATOR.codex_render_subject_card_offline_profile_spec(profile_id),
            profile,
        )
        self.assertTrue(
            GENERATOR.codex_render_subject_card_offline_profile_revision_has_implementation(
                '3d13ce869ab473fc65bc556e1cf75db4cc73e100', profile,
            ),
        )
        self.assertIn(
            GENERATOR.LIVE_PROBE_DIR / Path(profile['reportPath']).name,
            GENERATOR.model_mcp_e2e_report_paths(),
        )
        refresh_paths = [
            profile['reportPath'],
            'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
            'docs/product/frontier-ledger.json',
            'scripts/agent-harness.mjs',
            'scripts/check-tool-acceptance-table.py',
            'scripts/generate-tool-acceptance-tasks.py',
            'scripts/test_acceptance_evidence.py',
            'tests/harness/agent-harness-cli.test.mjs',
        ]
        self.assertTrue(
            GENERATOR.codex_render_subject_card_offline_profile_evidence_refresh_paths_are_valid(
                refresh_paths, profile,
            ),
        )
        refresh_paths.append('scripts/unrelated.py')
        self.assertFalse(
            GENERATOR.codex_render_subject_card_offline_profile_evidence_refresh_paths_are_valid(
                refresh_paths, profile,
            ),
        )

        candidate = 'e' * 40
        branch = f"codex/epoch-{profile['epochId']}"
        epoch_status = {
            'run': {
                'number': 95,
                'state': {'state': 'EPOCH_ACTIVE', 'active_epoch_pr': self.pr},
            },
            'epoch': {
                'github_state': 'OPEN',
                'state': {
                    'candidate_sha': candidate,
                    'epoch_id': profile['epochId'],
                    'pr_number': self.pr,
                    'base_branch': 'master',
                    'base_sha': self.base,
                    'branch': branch,
                    'review_history': [],
                },
                'pr_base_ref_name': 'master',
                'pr_base_sha': self.base,
                'pr_head_ref_name': branch,
                'pr_is_draft': False,
                'pr_head_sha': candidate,
            },
        }
        refresh_paths = [
            profile['reportPath'],
            'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
            'docs/product/frontier-ledger.json',
            'scripts/agent-harness.mjs',
            'scripts/check-tool-acceptance-table.py',
            'scripts/generate-tool-acceptance-tasks.py',
            'scripts/test_acceptance_evidence.py',
            'tests/harness/agent-harness-cli.test.mjs',
        ]
        self.assertTrue(
            GENERATOR.codex_render_subject_card_offline_profile_candidate_binding_is_valid(
                report, epoch_status, refresh_paths, report['mcpBundleSha256'],
            ),
        )


class C03PersonActivityOfflineV2MatrixTests(unittest.TestCase):
    def setUp(self):
        self.profile = TABLE_CHECKER.C03_PERSON_ACTIVITY_OFFLINE_V2_PROFILE
        self.report = {
            'schemaVersion': 1,
            'evidenceKind': self.profile['evidenceKind'],
            'profileId': self.profile['id'],
            'epochId': self.profile['epochId'],
            'runNumber': 95,
            'frontierId': 'C03',
            'scenarioId': None,
            'profile': 'codex-luna-max-offline-agent-mcp-matrix-v2',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'reviewerId': 'gpt-6-luna-max-run95-pr240-round1',
            'sourceRevision': 'a' * 40,
            'baseSha': 'c' * 40,
            'ciSha': 'a' * 40,
            'ciStatus': 'SUCCESS',
            'ciRunId': '39256838410',
            'ciChecks': [
                {'name': name, 'status': 'COMPLETED', 'conclusion': 'SUCCESS'}
                for name in (
                    'harness-control', 'sqlite-default', 'host-integration',
                    'standalone-release-smoke', 'postgres-compat', 'provider-foundation',
                    'discovery-foundation',
                )
            ],
            'prNumber': 240,
            'claimId': 'profile-run-95-pr-240-aaaaaaaaaaaa-1',
            'mcpBundleSha256': 'b' * 64,
            'resultStatus': 'SUCCESS',
            'processExitCode': 0,
            'eventStreamParsed': True,
            'turnCompleted': True,
            'codexMcpToolEventCount': 1,
            'codexErrorItemCount': 0,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'toolName': self.profile['toolName'],
            'argumentProfile': self.profile['argumentProfile'],
            'expectedArgumentsSha256': hashlib.sha256(json.dumps(
                [call['arguments'] for call in self.profile['calls']],
                sort_keys=True, separators=(',', ':'), ensure_ascii=False,
            ).encode('utf-8')).hexdigest(),
            'registrySha256': hashlib.sha256(json.dumps(
                self.profile, sort_keys=True, separators=(',', ':'), ensure_ascii=False,
            ).encode('utf-8')).hexdigest(),
            'selectionEvidenceSha256': hashlib.sha256(
                (TABLE_CHECKER.ROOT / self.profile['selectionEvidencePath']).read_bytes(),
            ).hexdigest(),
            'serverToolNames': [self.profile['toolName']],
            'serverToolCount': 1,
            'mcpServerNames': ['bgk_c03_person_activity_offline_v2'],
            'networkMode': self.profile['networkMode'],
            'resultSummary': {
                'resultState': 'partial',
                'windowMonths': 12,
                'uniqueSubjects': 1,
                'roleCounts': {'main': 1, 'support': 0, 'unknown': 0},
                'coverage': {
                    'relationRowsObserved': 1,
                    'relationRowsSelected': 1,
                    'relationRowsDroppedAtLimit': 0,
                    'subjectDetailsSucceeded': 1,
                    'subjectDetailsFailed': 0,
                    'rowsEligible': 1,
                    'rowsReturned': 1,
                    'unknownRoleRows': 0,
                    'outputTruncated': False,
                    'truncated': False,
                },
            },
            'offlineFixture': {
                'profile': self.profile['networkMode'],
                'requestCount': 3,
                'personRequestCount': 1,
                'characterRequestCount': 1,
                'subjectDetailRequestCount': 1,
                'unexpectedRequestCount': 0,
                'authorizationHeaderCount': 0,
                'expectedOperationsComplete': True,
                'operations': ['person', 'characters', 'subject_detail'],
            },
            'networkBoundary': {
                'liveBangumiApiRequestCount': 0,
                'unexpectedNetworkRequestCount': 0,
                'rendererAssetRequestCount': 0,
                'fullCodexHarnessNetworkSandboxed': False,
            },
            'answerChecks': {
                key: True
                for key in (
                    'exactRegisteredProfile', 'oneAllowedMcpTool', 'fixedArguments',
                    'exactCandidateBundle', 'offlineFixtureOnly', 'resultReadbackMatched',
                    'answerEchoedToolResult', 'outputSchemaApplied', 'noScenarioCredit',
                    'privacyPreserved',
                )
            },
            'answerCheckMethod': self.profile['answerCheckMethod'],
            'answerSha256': 'a' * 64,
            'answerUtf8Bytes': 100,
            'privacy': {
                'authProfile': 'anonymous',
                'oauthAttempted': False,
                'accountDataRead': False,
                'writesAttempted': False,
                'communityRead': False,
                'qqPipelineTested': False,
                'timClientTested': False,
                'promptStored': False,
                'answerStored': False,
                'rawFixtureRowsStored': False,
                'rawToolResultStored': False,
                'artifactImageBytesStored': False,
                'credentialsStored': False,
            },
            'runnerReceipt': {
                'schemaVersion': 1,
                'kind': 'c03-person-activity-offline-matrix-v2-runner-receipt-v1',
                'publicKeyBase64': 'bm90LWEtYS1rZXk=',
                'publicKeySha256': 'd' * 64,
                'payload': {},
                'signature': '',
            },
        }

    def test_matrix_generator_registers_the_v2_report_path(self):
        expected = GENERATOR.LIVE_PROBE_DIR / Path(self.profile['reportPath']).name
        self.assertIn(expected, GENERATOR.model_mcp_e2e_report_paths())
        self.assertFalse(
            GENERATOR.codex_c03_person_activity_offline_v2_report_is_valid(
                self.report, expected, {'state': 'UNCLAIMED'},
            ),
        )

    def harness_status(self, report_bytes):
        receipt = self.report['runnerReceipt']
        canonical_receipt = json.dumps(
            receipt, sort_keys=True, separators=(',', ':'), ensure_ascii=False,
        ).encode('utf-8')
        disposition = {
            'claimId': self.report['claimId'],
            'profileId': self.profile['id'],
            'frontierId': 'C03',
            'epochId': self.profile['epochId'],
            'runNumber': 95,
            'prNumber': self.report['prNumber'],
            'state': 'REPORT_WRITTEN',
            'sourceCandidateSha': self.report['sourceRevision'],
            'baseSha': self.report['baseSha'],
            'ciSha': self.report['ciSha'],
            'ciStatus': self.report['ciStatus'],
            'ciRunId': self.report['ciRunId'],
            'ciChecks': self.report['ciChecks'],
            'reviewerId': self.report['reviewerId'],
            'bundleSha256': self.report['mcpBundleSha256'],
            'registrySha256': self.report['registrySha256'],
            'toolName': self.profile['toolName'],
            'argumentProfile': self.profile['argumentProfile'],
            'expectedArgumentsSha256': self.report['expectedArgumentsSha256'],
            'reportWritten': True,
            'reportPath': self.profile['reportPath'],
            'reportSha256': hashlib.sha256(report_bytes).hexdigest(),
            'retryAllowed': False,
            'runnerReceiptPublicKey': receipt['publicKeyBase64'],
            'runnerReceiptPublicKeySha256': receipt['publicKeySha256'],
            'runnerReceiptSha256': hashlib.sha256(canonical_receipt).hexdigest(),
        }
        return {
            'state': 'REPORT_WRITTEN',
            'run': 95,
            'pr': self.report['prNumber'],
            'epoch_id': self.profile['epochId'],
            'profile_id': self.profile['id'],
            'frontier_id': 'C03',
            'tool_name': self.profile['toolName'],
            'argument_profile': self.profile['argumentProfile'],
            'expected_arguments_sha256': self.report['expectedArgumentsSha256'],
            'registry_sha256': self.report['registrySha256'],
            'claim_label_present': True,
            'terminal_label_present': True,
            'disposition': disposition,
        }

    def test_matrix_report_requires_active_harness_ack_and_signed_receipt(self):
        with tempfile.TemporaryDirectory(prefix='c03-v2-matrix-report-') as directory:
            root = Path(directory)
            report_path = root / self.profile['reportPath']
            report_path.parent.mkdir(parents=True)
            catalog_path = root / 'docs/tool-catalog.json'
            catalog_path.parent.mkdir(parents=True, exist_ok=True)
            catalog_path.write_bytes((TABLE_CHECKER.ROOT / 'docs/tool-catalog.json').read_bytes())
            selection_path = root / self.profile['selectionEvidencePath']
            selection_path.parent.mkdir(parents=True, exist_ok=True)
            selection_path.write_bytes((TABLE_CHECKER.ROOT / self.profile['selectionEvidencePath']).read_bytes())
            report_bytes = (json.dumps(self.report, ensure_ascii=False) + '\n').encode('utf-8')
            report_path.write_bytes(report_bytes)

            self.assertFalse(
                TABLE_CHECKER.c03_person_activity_offline_v2_report_matches(
                    self.profile['toolName'], self.profile['reportPath'], self.report,
                    report_path=report_path, harness_status={'state': 'UNCLAIMED'}, root=root,
                ),
            )
            self.assertFalse(
                TABLE_CHECKER.c03_person_activity_offline_v2_report_matches(
                    self.profile['toolName'], self.profile['reportPath'], self.report,
                    report_path=report_path, harness_status=self.harness_status(report_bytes), root=root,
                ),
            )
            self.assertFalse(
                GENERATOR.codex_c03_person_activity_offline_v2_report_is_valid(
                    self.report, report_path, self.harness_status(report_bytes), root,
                ),
            )

    def test_matrix_report_rejects_a_harness_ack_for_a_different_digest(self):
        with tempfile.TemporaryDirectory(prefix='c03-v2-matrix-report-') as directory:
            root = Path(directory)
            report_path = root / self.profile['reportPath']
            report_path.parent.mkdir(parents=True)
            catalog_path = root / 'docs/tool-catalog.json'
            catalog_path.parent.mkdir(parents=True, exist_ok=True)
            catalog_path.write_bytes((TABLE_CHECKER.ROOT / 'docs/tool-catalog.json').read_bytes())
            selection_path = root / self.profile['selectionEvidencePath']
            selection_path.parent.mkdir(parents=True, exist_ok=True)
            selection_path.write_bytes((TABLE_CHECKER.ROOT / self.profile['selectionEvidencePath']).read_bytes())
            report_bytes = (json.dumps(self.report, ensure_ascii=False) + '\n').encode('utf-8')
            report_path.write_bytes(report_bytes)
            status = self.harness_status(report_bytes)
            status['disposition']['reportSha256'] = 'f' * 64
            self.assertFalse(
                TABLE_CHECKER.c03_person_activity_offline_v2_report_matches(
                    self.profile['toolName'], self.profile['reportPath'], self.report,
                    report_path=report_path, harness_status=status, root=root,
                ),
            )

    def test_matrix_report_cannot_credit_the_c03_scenario(self):
        with tempfile.TemporaryDirectory(prefix='c03-v2-matrix-report-') as directory:
            report_path = Path(directory) / self.profile['reportPath']
            report_path.parent.mkdir(parents=True)
            report_path.write_text(json.dumps(self.report), encoding='utf-8')
            self.assertFalse(
                TABLE_CHECKER.c03_person_activity_offline_v2_report_matches(
                    self.profile['toolName'], self.profile['reportPath'], self.report,
                    report_path=report_path, harness_status={'state': 'UNCLAIMED'},
                ),
            )
        self.report['scenarioId'] = 'C03'
        self.assertFalse(
            TABLE_CHECKER.c03_person_activity_offline_v2_report_matches(
                self.profile['toolName'], self.profile['reportPath'], self.report,
            ),
        )

    def test_matrix_report_rejects_unexpected_fixture_requests(self):
        self.report['offlineFixture']['unexpectedRequestCount'] = 1
        self.assertFalse(
            TABLE_CHECKER.c03_person_activity_offline_v2_report_matches(
                self.profile['toolName'], self.profile['reportPath'], self.report,
            ),
        )

    def test_matrix_report_rejects_boolean_counts_and_malformed_state(self):
        self.report['processExitCode'] = False
        self.assertFalse(
            TABLE_CHECKER.c03_person_activity_offline_v2_report_matches(
                self.profile['toolName'], self.profile['reportPath'], self.report,
            ),
        )
        self.report['processExitCode'] = 0
        self.report['resultSummary']['resultState'] = []
        self.assertFalse(
            TABLE_CHECKER.c03_person_activity_offline_v2_report_matches(
                self.profile['toolName'], self.profile['reportPath'], self.report,
            ),
        )


class PublicApiEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix='acceptance-evidence-test-')
        self.root = Path(self.temp_dir.name)
        (self.root / 'docs/live-probes').mkdir(parents=True)
        (self.root / 'scripts').mkdir()
        self.catalog_path = self.root / 'docs/tool-catalog.json'
        self.catalog = [
            {'name': 'bangumi.get_subject', 'auth': 'none'},
            {'name': 'bangumi.get_episode', 'auth': 'none'},
            {'name': 'bangumi.get_person_profile', 'auth': 'none'},
            {'name': 'bangumi.auth_status', 'auth': 'none'},
        ]
        self.catalog_path.write_text(json.dumps(self.catalog), encoding='utf-8')
        self.probe_path = self.root / 'scripts/smoke-public-tools-online.ts'
        self.probe_path.write_text('// fixture probe source\n', encoding='utf-8')
        self.p02_probe_path = self.root / 'scripts/smoke-person-profile-chronology-online.ts'
        self.p02_probe_path.write_text('// fixture P02 probe source\n', encoding='utf-8')
        self.fresh_profile_probe_path = self.root / 'scripts/smoke-fresh-render-person-profile-public.ts'
        self.fresh_profile_probe_path.write_text('// fixture fresh renderer probe source\n', encoding='utf-8')
        self.fresh_profile_scope_path = self.root / GENERATOR.FRESH_RENDER_PERSON_PROFILE_PUBLIC_SCOPE_PROGRAM
        self.fresh_profile_scope_path.parent.mkdir(parents=True, exist_ok=True)
        self.fresh_profile_scope_path.write_text('// fixture fresh renderer scope source\n', encoding='utf-8')
        self.get_profile_probe_path = self.root / GENERATOR.FRESH_GET_PERSON_PROFILE_PUBLIC_PROGRAM
        self.get_profile_probe_path.parent.mkdir(parents=True, exist_ok=True)
        self.get_profile_probe_path.write_text('// fixture direct person profile probe source\n', encoding='utf-8')
        self.get_profile_scope_path = self.root / GENERATOR.FRESH_GET_PERSON_PROFILE_PUBLIC_SCOPE_PROGRAM
        self.get_profile_scope_path.parent.mkdir(parents=True, exist_ok=True)
        self.get_profile_scope_path.write_text('// fixture direct person profile scope source\n', encoding='utf-8')
        self.unbounded_fresh_profile_probe_path = self.root / GENERATOR.FRESH_RENDER_PERSON_PROFILE_UNBOUNDED_PROGRAM
        self.unbounded_fresh_profile_probe_path.parent.mkdir(parents=True, exist_ok=True)
        self.unbounded_fresh_profile_probe_path.write_text('// fixture historical unbounded probe source\n', encoding='utf-8')
        self.retry_accounted_fresh_profile_probe_path = self.root / GENERATOR.FRESH_RENDER_PERSON_PROFILE_RETRY_ACCOUNTED_PROGRAM
        self.retry_accounted_fresh_profile_probe_path.parent.mkdir(parents=True, exist_ok=True)
        self.retry_accounted_fresh_profile_probe_path.write_text('// fixture executed retry-accounted probe source\n', encoding='utf-8')
        self.six_matrix_probe_path = self.root / GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_PROGRAM
        self.six_matrix_probe_path.parent.mkdir(parents=True, exist_ok=True)
        self.six_matrix_probe_path.write_text('// fixture exact six-row probe source\n', encoding='utf-8')
        self.six_matrix_scope_path = self.root / GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_SCOPE_PROGRAM
        self.six_matrix_scope_path.parent.mkdir(parents=True, exist_ok=True)
        self.six_matrix_scope_path.write_text('// fixture exact six-row scope source\n', encoding='utf-8')
        self.cohort_four_probe_path = self.root / GENERATOR.FRESH_PUBLIC_COHORT_FOUR_PROGRAM
        self.cohort_four_probe_path.parent.mkdir(parents=True, exist_ok=True)
        self.cohort_four_probe_path.write_text('// fixture bounded cohort-four probe source\n', encoding='utf-8')
        self.cohort_four_scope_path = self.root / GENERATOR.FRESH_PUBLIC_COHORT_FOUR_SCOPE_PROGRAM
        self.cohort_four_scope_path.parent.mkdir(parents=True, exist_ok=True)
        self.cohort_four_scope_path.write_text('// fixture exact all-mode cohort scope source\n', encoding='utf-8')
        self.cohort_four_v2_probe_path = self.root / GENERATOR.FRESH_PUBLIC_COHORT_FOUR_V2_PROGRAM
        self.cohort_four_v2_probe_path.parent.mkdir(parents=True, exist_ok=True)
        self.cohort_four_v2_probe_path.write_text('// fixture distinct all-mode cohort v2 probe source\n', encoding='utf-8')
        self.cohort_four_v2_scope_path = self.root / GENERATOR.FRESH_PUBLIC_COHORT_FOUR_V2_SCOPE_PROGRAM
        self.cohort_four_v2_scope_path.parent.mkdir(parents=True, exist_ok=True)
        self.cohort_four_v2_scope_path.write_text('// fixture distinct cohort v2 scope source\n', encoding='utf-8')
        self.six_matrix_budget_path = self.root / GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_BUDGET_PROGRAM
        self.six_matrix_budget_path.parent.mkdir(parents=True, exist_ok=True)
        self.six_matrix_budget_path.write_text('// fixture scoped request budget source\n', encoding='utf-8')
        self.five_post_v2_probe_path = self.root / GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_PROGRAM
        self.five_post_v2_probe_path.parent.mkdir(parents=True, exist_ok=True)
        self.five_post_v2_probe_path.write_text('// fixture five-row POST-safe probe source\n', encoding='utf-8')
        self.five_post_v2_scope_path = self.root / GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_SCOPE_PROGRAM
        self.five_post_v2_scope_path.parent.mkdir(parents=True, exist_ok=True)
        self.five_post_v2_scope_path.write_text('// fixture five-row POST-safe scope source\n', encoding='utf-8')
        self.five_post_v2_fetch_path = self.root / GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_SEARCH_FETCH_PROGRAM
        self.five_post_v2_fetch_path.parent.mkdir(parents=True, exist_ok=True)
        self.five_post_v2_fetch_path.write_text('// fixture restricted public search POST transport\n', encoding='utf-8')
        self.origin_guard_v3_probe_path = self.root / GENERATOR.FRESH_PUBLIC_QUERY_SUBJECTS_ORIGIN_GUARD_V3_PROGRAM
        self.origin_guard_v3_probe_path.parent.mkdir(parents=True, exist_ok=True)
        self.origin_guard_v3_probe_path.write_text('// fixture origin-guard v3 probe source\n', encoding='utf-8')
        self.origin_guard_v3_scope_path = self.root / GENERATOR.FRESH_PUBLIC_QUERY_SUBJECTS_ORIGIN_GUARD_V3_SCOPE_PROGRAM
        self.origin_guard_v3_scope_path.parent.mkdir(parents=True, exist_ok=True)
        self.origin_guard_v3_scope_path.write_text('// fixture exact query profile source\n', encoding='utf-8')
        self.original_root = GENERATOR.ROOT
        self.original_catalog = GENERATOR.CATALOG
        self.original_probe_dir = GENERATOR.LIVE_PROBE_DIR
        self.original_epoch_reports = GENERATOR.FRESH_PUBLIC_EPOCH_RETAINED_REPORTS
        self.original_epoch_cap = GENERATOR.FRESH_PUBLIC_EPOCH_REQUEST_CAP
        GENERATOR.ROOT = self.root
        GENERATOR.CATALOG = self.catalog_path
        GENERATOR.LIVE_PROBE_DIR = self.root / 'docs/live-probes'
        GENERATOR.FRESH_PUBLIC_EPOCH_RETAINED_REPORTS = {}
        self.report_path = GENERATOR.LIVE_PROBE_DIR / 'public-tools-fixture.json'

    def tearDown(self):
        GENERATOR.ROOT = self.original_root
        GENERATOR.CATALOG = self.original_catalog
        GENERATOR.LIVE_PROBE_DIR = self.original_probe_dir
        GENERATOR.FRESH_PUBLIC_EPOCH_RETAINED_REPORTS = self.original_epoch_reports
        GENERATOR.FRESH_PUBLIC_EPOCH_REQUEST_CAP = self.original_epoch_cap
        self.temp_dir.cleanup()

    def write_report(self, **overrides):
        assertions = {
            'httpRequestObserved': True,
            'nonEmptySummary': True,
            'noErrorResult': True,
            'nonNegativeCounts': True,
            'countConsistency': True,
            'identityMatchesRequest': True,
            'passed': True,
        }
        result = {
            'tool': 'bangumi.get_subject',
            'input': {'subjectId': 123},
            'httpRequests': 1,
            'result': {'id': 123},
            'assertions': assertions,
        }
        report = {
            'schemaVersion': 1,
            'evidenceKind': 'bangumi_public_api_tool_registry_smoke',
            'mode': 'read_only_public_api_smoke',
            'sourceProgram': 'scripts/smoke-public-tools-online.ts',
            'catalogSha256': hashlib.sha256(self.catalog_path.read_bytes()).hexdigest(),
            'probeScriptSha256': hashlib.sha256(self.probe_path.read_bytes()).hexdigest(),
            'selectedTools': ['bangumi.get_subject'],
            'probeCount': 1,
            'results': [result],
        }
        report.update(overrides)
        self.report_path.write_text(json.dumps(report), encoding='utf-8')

    def test_counts_only_current_hash_bound_successful_public_results(self):
        self.write_report()
        self.assertEqual(
            GENERATOR.public_api_smoke_names(self.catalog),
            {'bangumi.get_subject'},
        )
        self.assertEqual(
            GENERATOR.public_api_smoke_sources(self.catalog),
            {'bangumi.get_subject': {'docs/live-probes/public-tools-fixture.json'}},
        )

    def test_historical_public_cohort_rows_survive_the_additive_budget_schema(self):
        previous_catalog_sha = '2e8e47b37a4ebcc2511ff3fe8727abd9496edc4f5bebf4cd0ea798b4936b0c92'
        previous_snapshot = (
            self.original_root / 'docs/live-probes/catalog-snapshots' / f'{previous_catalog_sha}.json'
        ).read_bytes()
        current_catalog = (self.original_root / 'docs/tool-catalog.json').read_bytes()
        self.catalog_path.write_bytes(current_catalog)
        self.catalog = json.loads(current_catalog)
        snapshot_path = (
            GENERATOR.LIVE_PROBE_DIR / 'catalog-snapshots' / f'{previous_catalog_sha}.json'
        )
        snapshot_path.parent.mkdir(parents=True, exist_ok=True)
        snapshot_path.write_bytes(previous_snapshot)
        tools = [
            'bangumi.aggregate_subject_cohort',
            'bangumi.compare_subject_cohorts',
            'bangumi.render_subject_cohort_aggregation',
            'bangumi.render_subject_cohort_comparison',
        ]

        self.assertTrue(
            GENERATOR.public_api_catalog_evidence_matches_current(previous_catalog_sha, tools),
        )

        changed = next(
            item for item in self.catalog if item['name'] == 'bangumi.compare_subject_cohorts'
        )
        changed['inputSchema']['properties']['cohorts']['items']['properties']['query']['properties']['budget']['properties']['maxPages']['maximum'] = 5
        self.catalog_path.write_text(json.dumps(self.catalog), encoding='utf-8')
        self.assertFalse(
            GENERATOR.public_api_catalog_evidence_matches_current(previous_catalog_sha, tools),
        )

    def test_additive_cohort_budget_keeps_old_public_catalog_evidence_compatible(self):
        added_description = (
            '每个 query 可提供受服务端安全上限约束的 budget；maxSubjects 限制每个 cohort '
            '保留的条目数，执行覆盖会明确返回。'
        )
        query_schema = {
            'type': 'object',
            'properties': {'resultMode': {'type': 'string', 'const': 'all'}},
            'required': ['resultMode'],
            'additionalProperties': False,
        }
        old_entries = []
        current_entries = []
        names = [
            'bangumi.aggregate_subject_cohort',
            'bangumi.compare_subject_cohorts',
            'bangumi.render_subject_cohort_aggregation',
            'bangumi.render_subject_cohort_comparison',
        ]
        for name in names:
            if name in {'bangumi.aggregate_subject_cohort', 'bangumi.render_subject_cohort_aggregation'}:
                old_schema = {
                    'type': 'object',
                    'properties': {
                        'cohort': {'type': 'object', 'properties': {'query': query_schema}},
                    },
                }
                current_schema = json.loads(json.dumps(old_schema))
                budget_path = current_schema['properties']['cohort']['properties']['query']['properties']
            else:
                old_schema = {
                    'type': 'object',
                    'properties': {
                        'cohorts': {
                            'type': 'array',
                            'items': {'type': 'object', 'properties': {'query': query_schema}},
                        },
                    },
                }
                current_schema = json.loads(json.dumps(old_schema))
                budget_path = current_schema['properties']['cohorts']['items']['properties']['query']['properties']
            budget_path['budget'] = {
                'type': 'object',
                'properties': {
                    'maxPages': {'type': 'integer', 'minimum': 1, 'maximum': 6},
                    'maxCandidates': {'type': 'integer', 'minimum': 1, 'maximum': 300},
                    'maxHydrations': {'type': 'integer', 'minimum': 1, 'maximum': 60},
                    'concurrency': {'type': 'integer', 'minimum': 1, 'maximum': 6},
                    'maxConceptProbes': {'type': 'integer', 'minimum': 1, 'maximum': 8},
                    'maxReturnedItems': {'type': 'integer', 'minimum': 1, 'maximum': 60},
                },
                'additionalProperties': False,
                'description': (
                    '可选的每个 cohort 查询预算；服务端会将每项限制在官方安全上限内，'
                    'maxReturnedItems 还会受 maxSubjects 限制。实际执行覆盖会返回在 coverage 中。'
                ),
            }
            old_description = 'Existing descriptive cohort tool.'
            current_description = old_description + (
                added_description if name == 'bangumi.compare_subject_cohorts' else ''
            )
            old_entries.append({
                'name': name, 'auth': 'none', 'risk': 'read',
                'description': old_description, 'inputSchema': old_schema,
            })
            current_entries.append({
                'name': name, 'auth': 'none', 'risk': 'read',
                'description': current_description, 'inputSchema': current_schema,
            })

        old_bytes = json.dumps(old_entries, ensure_ascii=False).encode('utf-8')
        self.catalog_path.write_bytes(json.dumps(current_entries, ensure_ascii=False).encode('utf-8'))
        snapshot_sha = hashlib.sha256(old_bytes).hexdigest()
        snapshot_path = self.root / 'docs/live-probes/catalog-snapshots' / f'{snapshot_sha}.json'
        snapshot_path.parent.mkdir(parents=True, exist_ok=True)
        snapshot_path.write_bytes(old_bytes)
        self.catalog = current_entries

        for old_entry, current_entry in zip(old_entries, current_entries, strict=True):
            self.assertTrue(GENERATOR.public_api_catalog_entry_is_compatible_with_current(
                old_entry['name'], old_entry, current_entry,
            ))
        self.assertTrue(GENERATOR.public_api_catalog_evidence_matches_current(snapshot_sha, names))

        changed_current = json.loads(json.dumps(current_entries[1]))
        changed_current['inputSchema']['properties']['cohorts']['items']['properties']['query']['properties']['budget']['properties']['maxPages']['maximum'] = 5
        self.assertFalse(GENERATOR.public_api_catalog_entry_is_compatible_with_current(
            'bangumi.compare_subject_cohorts', old_entries[1], changed_current,
        ))

    def test_explicitly_excluded_public_report_does_not_count(self):
        self.write_report()
        report = json.loads(self.report_path.read_text(encoding='utf-8'))
        report['acceptanceEligible'] = False
        report['acceptanceExclusionReason'] = 'The user-directed matrix disposition keeps this row pending.'
        self.report_path.write_text(json.dumps(report), encoding='utf-8')

        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())
        self.assertEqual(GENERATOR.public_api_smoke_sources(self.catalog), {})

    def test_hash_bound_exclusion_keeps_report_bytes_but_removes_its_credit(self):
        self.write_report()
        report_bytes = self.report_path.read_bytes()
        exclusions_path = self.root / 'docs/product/public-api-evidence-exclusions.json'
        exclusions_path.parent.mkdir(parents=True, exist_ok=True)
        exclusions_path.write_text(
            json.dumps({
                'schemaVersion': 1,
                'excludedReports': [{
                    'path': 'docs/live-probes/public-tools-fixture.json',
                    'sha256': hashlib.sha256(report_bytes).hexdigest(),
                    'selectedTools': ['bangumi.get_subject'],
                    'reason': 'The requested matrix scope leaves this row pending.',
                }],
            }),
            encoding='utf-8',
        )

        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())
        self.assertEqual(GENERATOR.public_api_smoke_sources(self.catalog), {})
        self.assertEqual(self.report_path.read_bytes(), report_bytes)

    def test_hash_bound_exclusion_fails_closed_when_the_report_changes(self):
        self.write_report()
        exclusions_path = self.root / 'docs/product/public-api-evidence-exclusions.json'
        exclusions_path.parent.mkdir(parents=True, exist_ok=True)
        exclusions_path.write_text(
            json.dumps({
                'schemaVersion': 1,
                'excludedReports': [{
                    'path': 'docs/live-probes/public-tools-fixture.json',
                    'sha256': 'f' * 64,
                    'selectedTools': ['bangumi.get_subject'],
                    'reason': 'The requested matrix scope leaves this row pending.',
                }],
            }),
            encoding='utf-8',
        )

        with self.assertRaises(ValueError):
            GENERATOR.public_api_smoke_sources(self.catalog)

    def write_fresh_render_person_profile_report(self):
        tool = GENERATOR.FRESH_RENDER_PERSON_PROFILE_PUBLIC_TOOL
        input_data = GENERATOR.FRESH_RENDER_PERSON_PROFILE_PUBLIC_INPUT
        if not any(item['name'] == tool for item in self.catalog):
            self.catalog.append({'name': tool, 'auth': 'none'})
            self.catalog_path.write_text(json.dumps(self.catalog), encoding='utf-8')
        assertions = {
            'httpRequestObserved': True,
            'scopeInputExact': True,
            'scopeRequestCap': True,
            'apiRetryAttemptsIncluded': True,
            'apiRedirectHopsIncluded': True,
            'rendererAssetRedirectHopsIncluded': True,
            'anonymousSearchPostAllowed': True,
            'searchPostPathRestricted': True,
            'apiRedirectOriginRestricted': True,
            'apiRedirectPrivatePathBlocked': True,
            'nonEmptySummary': True,
            'noErrorResult': True,
            'nonNegativeCounts': True,
            'countConsistency': True,
            'passed': True,
        }
        result = {
            'tool': tool,
            'input': input_data,
            'httpRequests': 3,
            'requestAccounting': {
                'bangumiApi': 2,
                'rendererAsset': 1,
                'total': 3,
                'apiRetryAttemptsIncluded': True,
                'apiRedirectHopsIncluded': True,
                'rendererAssetRedirectHopsIncluded': True,
                'anonymousSearchPostAllowed': True,
                'searchPostPathRestricted': True,
                'apiRedirectOriginRestricted': True,
                'apiRedirectPrivatePathBlocked': True,
            },
            'result': {'state': 'value', 'keys': ['artifact']},
            'assertions': assertions,
        }
        report = {
            'schemaVersion': 1,
            'evidenceKind': 'bangumi_public_api_tool_registry_smoke',
            'observedAt': '2026-10-16T00:00:00Z',
            'mode': 'read_only_public_api_smoke',
            'sourceProgram': GENERATOR.FRESH_RENDER_PERSON_PROFILE_PUBLIC_PROGRAM,
            'catalogSha256': hashlib.sha256(self.catalog_path.read_bytes()).hexdigest(),
            'probeScriptSha256': hashlib.sha256(self.fresh_profile_probe_path.read_bytes()).hexdigest(),
            'supportingSourceSha256': {
                GENERATOR.FRESH_RENDER_PERSON_PROFILE_PUBLIC_SCOPE_PROGRAM: hashlib.sha256(
                    self.fresh_profile_scope_path.read_bytes()
                ).hexdigest(),
                GENERATOR.FRESH_RENDER_PERSON_PROFILE_PUBLIC_BUDGET_PROGRAM: hashlib.sha256(
                    self.six_matrix_budget_path.read_bytes()
                ).hexdigest(),
                GENERATOR.FRESH_RENDER_PERSON_PROFILE_PUBLIC_FETCH_PROGRAM: hashlib.sha256(
                    self.five_post_v2_fetch_path.read_bytes()
                ).hexdigest(),
            },
            'scopeId': GENERATOR.FRESH_RENDER_PERSON_PROFILE_PUBLIC_SCOPE_ID,
            'requestBudget': {'maxPerTool': 4, 'maxTotal': 4},
            'requestAccounting': {
                'scope': 'bangumi_api_and_renderer_assets',
                'redirectsIncluded': True,
                'apiRetryAttemptsIncluded': True,
                'apiRedirectHopsIncluded': True,
                'rendererAssetRedirectHopsIncluded': True,
                'anonymousSearchPostAllowed': True,
                'searchPostPathRestricted': True,
                'apiRedirectOrigin': 'https://api.bgm.tv',
                'apiRedirectOriginRestricted': True,
                'apiRedirectPrivatePathBlocked': True,
                'bangumiApi': 2,
                'rendererAsset': 1,
                'total': 3,
            },
            'budgetBlocked': False,
            'httpRequests': 3,
            'selectedTools': [tool],
            'probeCount': 1,
            'results': [result],
        }
        self.report_path.write_text(json.dumps(report), encoding='utf-8')

    def test_counts_only_the_exact_fresh_person_profile_renderer_scope(self):
        self.write_fresh_render_person_profile_report()
        self.assertEqual(
            GENERATOR.public_api_smoke_names(self.catalog),
            {'bangumi.render_person_profile'},
        )

    def test_rejects_fresh_person_profile_report_without_combined_request_accounting(self):
        self.write_fresh_render_person_profile_report()
        report = json.loads(self.report_path.read_text(encoding='utf-8'))
        report.pop('requestAccounting')
        self.report_path.write_text(json.dumps(report), encoding='utf-8')
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_rejects_fresh_person_profile_report_with_inconsistent_combined_counts(self):
        self.write_fresh_render_person_profile_report()
        report = json.loads(self.report_path.read_text(encoding='utf-8'))
        report['requestAccounting']['rendererAsset'] = 2
        self.report_path.write_text(json.dumps(report), encoding='utf-8')
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_rejects_fresh_person_profile_report_without_retry_attempt_accounting(self):
        mutations = (
            lambda report: report['requestAccounting'].pop('apiRetryAttemptsIncluded'),
            lambda report: report['requestAccounting'].__setitem__('apiRetryAttemptsIncluded', False),
            lambda report: report['requestAccounting'].__setitem__('apiRedirectPrivatePathBlocked', False),
            lambda report: report['requestAccounting'].__setitem__('apiRedirectOriginRestricted', False),
            lambda report: report['results'][0]['requestAccounting'].pop('apiRetryAttemptsIncluded'),
            lambda report: report['results'][0]['requestAccounting'].__setitem__('apiRetryAttemptsIncluded', False),
            lambda report: report['results'][0]['requestAccounting'].__setitem__('apiRedirectPrivatePathBlocked', False),
            lambda report: report['results'][0]['assertions'].pop('apiRetryAttemptsIncluded'),
            lambda report: report['results'][0]['assertions'].__setitem__('apiRetryAttemptsIncluded', False),
            lambda report: report['results'][0]['assertions'].__setitem__('apiRedirectPrivatePathBlocked', False),
            lambda report: report['supportingSourceSha256'].pop(
                GENERATOR.FRESH_RENDER_PERSON_PROFILE_PUBLIC_FETCH_PROGRAM,
            ),
        )
        for mutate in mutations:
            with self.subTest(mutate=mutate):
                self.write_fresh_render_person_profile_report()
                report = json.loads(self.report_path.read_text(encoding='utf-8'))
                mutate(report)
                self.report_path.write_text(json.dumps(report), encoding='utf-8')
                self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_excludes_retry_accounted_profile_report_without_current_origin_guard(self):
        self.write_fresh_render_person_profile_report()
        report = json.loads(self.report_path.read_text(encoding='utf-8'))
        report['sourceProgram'] = GENERATOR.FRESH_RENDER_PERSON_PROFILE_RETRY_ACCOUNTED_PROGRAM
        report['probeScriptSha256'] = hashlib.sha256(
            self.retry_accounted_fresh_profile_probe_path.read_bytes()
        ).hexdigest()
        self.report_path.write_text(json.dumps(report), encoding='utf-8')
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_excludes_hash_bound_historical_report_that_omitted_asset_requests(self):
        self.write_fresh_render_person_profile_report()
        report = json.loads(self.report_path.read_text(encoding='utf-8'))
        report['sourceProgram'] = GENERATOR.FRESH_RENDER_PERSON_PROFILE_UNBOUNDED_PROGRAM
        report['probeScriptSha256'] = hashlib.sha256(
            self.unbounded_fresh_profile_probe_path.read_bytes()
        ).hexdigest()
        report['requestAccounting'] = {
            'scope': 'bangumi_api_fetch_only',
            'redirectsIncluded': False,
            'rendererAssetsIncluded': False,
            'totalHttpRequests': None,
            'creditDisposition': 'superseded_unbounded_asset_request_count',
        }
        self.report_path.write_text(json.dumps(report), encoding='utf-8')
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_rejects_fresh_person_profile_scope_with_old_input_or_budget_overrun(self):
        self.write_fresh_render_person_profile_report()
        report = json.loads(self.report_path.read_text(encoding='utf-8'))
        report['results'][0]['input'] = {
            'personId': 3474,
            'maxSubjects': 2,
            'maxCharacters': 2,
            'maxCredits': 2,
        }
        self.report_path.write_text(json.dumps(report), encoding='utf-8')
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

        self.write_fresh_render_person_profile_report()
        report = json.loads(self.report_path.read_text(encoding='utf-8'))
        report['requestBudget'] = {'maxPerTool': 5, 'maxTotal': 5}
        self.report_path.write_text(json.dumps(report), encoding='utf-8')
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def write_fresh_get_person_profile_report(self):
        tool = 'bangumi.get_person_profile'
        for item in self.catalog:
            if item.get('name') == tool:
                item['auth'] = 'none'
                item['risk'] = 'read'
        self.catalog_path.write_text(json.dumps(self.catalog), encoding='utf-8')
        counts = {'bangumiApi': 3, 'rendererAsset': 0, 'total': 3}
        result_accounting_metadata = {
            'apiRetryAttemptsIncluded': True,
            'apiRedirectHopsIncluded': True,
            'rendererAssetRedirectHopsIncluded': True,
            'anonymousSearchPostAllowed': True,
            'searchPostPathRestricted': True,
            'apiRedirectOriginRestricted': True,
            'apiRedirectPrivatePathBlocked': True,
        }
        result = {
            'tool': tool,
            'input': GENERATOR.FRESH_GET_PERSON_PROFILE_PUBLIC_INPUT,
            'attempted': True,
            'httpRequests': counts['total'],
            'requestAccounting': {**counts, **result_accounting_metadata},
            'result': {
                'state': 'partial',
                'keys': ['state', 'person', 'relatedSubjects', 'relatedCharacters'],
            },
            'assertions': {
                key: True for key in GENERATOR.FRESH_GET_PERSON_PROFILE_PUBLIC_REQUIRED_ASSERTIONS
            },
        }
        report = {
            'schemaVersion': 1,
            'evidenceKind': 'bangumi_public_api_tool_registry_smoke',
            'observedAt': '2026-10-16T00:00:00Z',
            'mode': 'read_only_public_api_smoke',
            'catalogSha256': hashlib.sha256(self.catalog_path.read_bytes()).hexdigest(),
            'probeScriptSha256': hashlib.sha256(self.get_profile_probe_path.read_bytes()).hexdigest(),
            'sourceProgram': GENERATOR.FRESH_GET_PERSON_PROFILE_PUBLIC_PROGRAM,
            'supportingSourceSha256': {
                GENERATOR.FRESH_GET_PERSON_PROFILE_PUBLIC_SCOPE_PROGRAM: hashlib.sha256(
                    self.get_profile_scope_path.read_bytes()
                ).hexdigest(),
                GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_BUDGET_PROGRAM: hashlib.sha256(
                    self.six_matrix_budget_path.read_bytes()
                ).hexdigest(),
                GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_SEARCH_FETCH_PROGRAM: hashlib.sha256(
                    self.five_post_v2_fetch_path.read_bytes()
                ).hexdigest(),
            },
            'scopeId': GENERATOR.FRESH_GET_PERSON_PROFILE_PUBLIC_SCOPE_ID,
            'requestBudget': {
                'maxPerTool': GENERATOR.FRESH_GET_PERSON_PROFILE_PUBLIC_MAX_PER_TOOL,
                'maxTotal': GENERATOR.FRESH_GET_PERSON_PROFILE_PUBLIC_MAX_TOTAL,
            },
            'requestAccounting': {
                'scope': 'bangumi_api_and_renderer_assets',
                'redirectsIncluded': True,
                **result_accounting_metadata,
                'apiRedirectOrigin': 'https://api.bgm.tv',
                **counts,
                'perTool': {tool: counts},
            },
            'budgetBlocked': False,
            'httpRequests': counts['total'],
            'selectedTools': [tool],
            'probeCount': 1,
            'limits': GENERATOR.FRESH_GET_PERSON_PROFILE_PUBLIC_LIMITS,
            'redactions': ['person relation rows, names, and image bytes are not persisted'],
            'results': [result],
        }
        self.report_path.write_text(json.dumps(report), encoding='utf-8')

    def test_counts_only_bounded_origin_guarded_get_person_profile_row(self):
        self.write_fresh_get_person_profile_report()
        self.assertEqual(
            GENERATOR.public_api_smoke_names(self.catalog),
            {'bangumi.get_person_profile'},
        )

    def test_rejects_get_person_profile_reports_with_changed_scope_or_missing_guards(self):
        mutations = (
            lambda report: report['results'][0]['input'].__setitem__('personId', 3474),
            lambda report: report['requestAccounting'].__setitem__('apiRedirectPrivatePathBlocked', False),
            lambda report: report['results'][0]['requestAccounting'].__setitem__(
                'apiRedirectPrivatePathBlocked', False,
            ),
            lambda report: report['results'][0]['assertions'].__setitem__(
                'apiRedirectOriginRestricted', False,
            ),
            lambda report: report.__setitem__('requestBudget', {'maxPerTool': 5, 'maxTotal': 5}),
            lambda report: report['supportingSourceSha256'].pop(
                GENERATOR.FRESH_GET_PERSON_PROFILE_PUBLIC_SCOPE_PROGRAM,
            ),
            lambda report: report.__setitem__('budgetBlocked', True),
        )
        for mutate in mutations:
            with self.subTest(mutate=mutate):
                self.write_fresh_get_person_profile_report()
                report = json.loads(self.report_path.read_text(encoding='utf-8'))
                mutate(report)
                self.report_path.write_text(json.dumps(report), encoding='utf-8')
                self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def write_fresh_public_cohort_four_report(self):
        tools = list(GENERATOR.FRESH_PUBLIC_COHORT_FOUR_INPUTS)
        for name in tools:
            entry = next((item for item in self.catalog if item.get('name') == name), None)
            if entry is None:
                self.catalog.append({'name': name, 'auth': 'none', 'risk': 'read'})
            else:
                entry['auth'] = 'none'
                entry['risk'] = 'read'
        self.catalog_path.write_text(json.dumps(self.catalog), encoding='utf-8')
        result_accounting_metadata = {
            'apiRetryAttemptsIncluded': True,
            'apiRedirectHopsIncluded': True,
            'rendererAssetRedirectHopsIncluded': True,
            'anonymousSearchPostAllowed': True,
            'searchPostPathRestricted': True,
            'apiRedirectOriginRestricted': True,
            'apiRedirectPrivatePathBlocked': True,
        }
        per_tool = {}
        results = []
        for name, input_data in GENERATOR.FRESH_PUBLIC_COHORT_FOUR_INPUTS.items():
            assets = 1 if name.startswith('bangumi.render_') else 0
            counts = {'bangumiApi': 1, 'rendererAsset': assets, 'total': 1 + assets}
            per_tool[name] = counts
            results.append({
                'tool': name,
                'input': input_data,
                'attempted': True,
                'httpRequests': counts['total'],
                'requestAccounting': {**counts, **result_accounting_metadata},
                'result': {'state': 'partial', 'keys': ['state', 'items', 'coverage']},
                'assertions': {
                    key: True for key in GENERATOR.FRESH_PUBLIC_COHORT_FOUR_REQUIRED_ASSERTIONS
                },
            })
        totals = {
            key: sum(counts[key] for counts in per_tool.values())
            for key in ('bangumiApi', 'rendererAsset', 'total')
        }
        report = {
            'schemaVersion': 1,
            'evidenceKind': 'bangumi_public_api_tool_registry_smoke',
            'observedAt': '2026-10-16T00:00:00Z',
            'mode': 'read_only_public_api_smoke',
            'catalogSha256': hashlib.sha256(self.catalog_path.read_bytes()).hexdigest(),
            'probeScriptSha256': hashlib.sha256(self.cohort_four_probe_path.read_bytes()).hexdigest(),
            'sourceProgram': GENERATOR.FRESH_PUBLIC_COHORT_FOUR_PROGRAM,
            'supportingSourceSha256': {
                GENERATOR.FRESH_PUBLIC_COHORT_FOUR_SCOPE_PROGRAM: hashlib.sha256(
                    self.cohort_four_scope_path.read_bytes()
                ).hexdigest(),
                GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_BUDGET_PROGRAM: hashlib.sha256(
                    self.six_matrix_budget_path.read_bytes()
                ).hexdigest(),
                GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_SEARCH_FETCH_PROGRAM: hashlib.sha256(
                    self.five_post_v2_fetch_path.read_bytes()
                ).hexdigest(),
            },
            'scopeId': GENERATOR.FRESH_PUBLIC_COHORT_FOUR_SCOPE_ID,
            'requestBudget': {
                'maxPerTool': GENERATOR.FRESH_PUBLIC_COHORT_FOUR_MAX_PER_TOOL,
                'maxTotal': GENERATOR.FRESH_PUBLIC_COHORT_FOUR_MAX_TOTAL,
            },
            'requestAccounting': {
                'scope': 'bangumi_api_and_renderer_assets',
                'redirectsIncluded': True,
                **result_accounting_metadata,
                'apiRedirectOrigin': 'https://api.bgm.tv',
                **totals,
                'perTool': per_tool,
            },
            'budgetBlocked': False,
            'httpRequests': totals['total'],
            'selectedTools': tools,
            'probeCount': len(tools),
            'limits': GENERATOR.FRESH_PUBLIC_COHORT_FOUR_LIMITS,
            'redactions': [
                'result row values, titles, names, identifiers, and image bytes are not persisted',
            ],
            'results': results,
        }
        self.report_path.write_text(json.dumps(report), encoding='utf-8')

    def test_counts_only_exact_all_mode_cohort_public_rows(self):
        self.write_fresh_public_cohort_four_report()
        self.assertEqual(
            GENERATOR.public_api_smoke_names(self.catalog),
            set(GENERATOR.FRESH_PUBLIC_COHORT_FOUR_INPUTS),
        )

    def test_rejects_cohort_four_report_with_changed_input_budget_or_private_path_guard(self):
        mutations = (
            lambda report: report['results'][0]['input']['cohort']['query'].__setitem__(
                'resultMode', 'top',
            ),
            lambda report: report['requestAccounting'].__setitem__('apiRedirectPrivatePathBlocked', False),
            lambda report: report['requestBudget'].__setitem__('maxTotal', 21),
            lambda report: report['supportingSourceSha256'].pop(
                GENERATOR.FRESH_PUBLIC_COHORT_FOUR_SCOPE_PROGRAM,
            ),
            lambda report: report.__setitem__('budgetBlocked', True),
        )
        for mutate in mutations:
            with self.subTest(mutate=mutate):
                self.write_fresh_public_cohort_four_report()
                report = json.loads(self.report_path.read_text(encoding='utf-8'))
                mutate(report)
                self.report_path.write_text(json.dumps(report), encoding='utf-8')
                self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def write_fresh_public_cohort_four_v2_report(self, request_counts=None, budget_blocked=False):
        tools = list(GENERATOR.FRESH_PUBLIC_COHORT_FOUR_V2_INPUTS)
        for name in tools:
            entry = next((item for item in self.catalog if item.get('name') == name), None)
            if entry is None:
                self.catalog.append({'name': name, 'auth': 'none', 'risk': 'read'})
            else:
                entry['auth'] = 'none'
                entry['risk'] = 'read'
        self.catalog_path.write_text(json.dumps(self.catalog), encoding='utf-8')
        result_accounting_metadata = {
            'apiRetryAttemptsIncluded': True,
            'apiRedirectHopsIncluded': True,
            'rendererAssetRedirectHopsIncluded': True,
            'anonymousSearchPostAllowed': True,
            'searchPostPathRestricted': True,
            'apiRedirectOriginRestricted': True,
            'apiRedirectPrivatePathBlocked': True,
        }
        per_tool = {}
        results = []
        for name, input_data in GENERATOR.FRESH_PUBLIC_COHORT_FOUR_V2_INPUTS.items():
            count = (request_counts or {}).get(name, 1)
            counts = {'bangumiApi': count, 'rendererAsset': 0, 'total': count}
            per_tool[name] = counts
            results.append({
                'tool': name,
                'input': input_data,
                'attempted': count > 0,
                'httpRequests': count,
                'requestAccounting': {**counts, **result_accounting_metadata},
                'result': {'state': 'partial', 'keys': ['state', 'coverage']},
                'assertions': {
                    key: True for key in GENERATOR.FRESH_PUBLIC_COHORT_FOUR_V2_REQUIRED_ASSERTIONS
                },
            })
        totals = {
            key: sum(counts[key] for counts in per_tool.values())
            for key in ('bangumiApi', 'rendererAsset', 'total')
        }
        report = {
            'schemaVersion': 1,
            'evidenceKind': 'bangumi_public_api_tool_registry_smoke',
            'observedAt': '2026-10-16T00:00:00Z',
            'mode': 'read_only_public_api_smoke',
            'catalogSha256': hashlib.sha256(self.catalog_path.read_bytes()).hexdigest(),
            'probeScriptSha256': hashlib.sha256(self.cohort_four_v2_probe_path.read_bytes()).hexdigest(),
            'sourceProgram': GENERATOR.FRESH_PUBLIC_COHORT_FOUR_V2_PROGRAM,
            'supportingSourceSha256': {
                GENERATOR.FRESH_PUBLIC_COHORT_FOUR_V2_SCOPE_PROGRAM: hashlib.sha256(
                    self.cohort_four_v2_scope_path.read_bytes()
                ).hexdigest(),
                GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_BUDGET_PROGRAM: hashlib.sha256(
                    self.six_matrix_budget_path.read_bytes()
                ).hexdigest(),
                GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_SEARCH_FETCH_PROGRAM: hashlib.sha256(
                    self.five_post_v2_fetch_path.read_bytes()
                ).hexdigest(),
            },
            'scopeId': GENERATOR.FRESH_PUBLIC_COHORT_FOUR_V2_SCOPE_ID,
            'requestBudget': {
                'maxPerTool': GENERATOR.FRESH_PUBLIC_COHORT_FOUR_V2_MAX_PER_TOOL,
                'maxTotal': GENERATOR.FRESH_PUBLIC_COHORT_FOUR_V2_MAX_TOTAL,
            },
            'requestAccounting': {
                'scope': 'bangumi_api_and_renderer_assets',
                'redirectsIncluded': True,
                'apiRetryAttemptsIncluded': True,
                'apiRedirectHopsIncluded': True,
                'rendererAssetRedirectHopsIncluded': True,
                'anonymousSearchPostAllowed': True,
                'searchPostPathRestricted': True,
                'apiRedirectOrigin': 'https://api.bgm.tv',
                'apiRedirectOriginRestricted': True,
                'apiRedirectPrivatePathBlocked': True,
                **totals,
                'perTool': per_tool,
            },
            'budgetBlocked': budget_blocked,
            'httpRequests': totals['total'],
            'selectedTools': tools,
            'probeCount': len(tools),
            'limits': GENERATOR.FRESH_PUBLIC_COHORT_FOUR_V2_LIMITS,
            'redactions': GENERATOR.FRESH_PUBLIC_COHORT_FOUR_V2_REDACTIONS,
            'results': results,
        }
        self.report_path.write_text(json.dumps(report), encoding='utf-8')

    def test_counts_only_exact_fresh_all_mode_cohort_v2_rows(self):
        self.write_fresh_public_cohort_four_v2_report()
        self.assertEqual(
            GENERATOR.public_api_smoke_names(self.catalog),
            set(GENERATOR.FRESH_PUBLIC_COHORT_FOUR_V2_INPUTS),
        )

    def test_rejects_cohort_v2_input_budget_guard_or_source_mutations(self):
        mutations = (
            lambda report: report['results'][0]['input']['cohort']['query'].__setitem__(
                'resultMode', 'top',
            ),
            lambda report: report['requestAccounting'].__setitem__('apiRedirectPrivatePathBlocked', False),
            lambda report: report['requestBudget'].__setitem__('maxTotal', 33),
            lambda report: report['supportingSourceSha256'].pop(
                GENERATOR.FRESH_PUBLIC_COHORT_FOUR_V2_SCOPE_PROGRAM,
            ),
            lambda report: report.__setitem__('budgetBlocked', True),
        )
        for mutate in mutations:
            with self.subTest(mutate=mutate):
                self.write_fresh_public_cohort_four_v2_report()
                report = json.loads(self.report_path.read_text(encoding='utf-8'))
                mutate(report)
                self.report_path.write_text(json.dumps(report), encoding='utf-8')
                self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_enforces_hash_bound_cumulative_epoch_request_cap(self):
        retained_reports = {}
        retained_values = [
            (GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_SCOPE_ID, 4, False),
            (GENERATOR.FRESH_PUBLIC_COHORT_FOUR_SCOPE_ID, 20, True),
            (GENERATOR.FRESH_GET_PERSON_PROFILE_PUBLIC_SCOPE_ID, 3, False),
            (GENERATOR.FRESH_RENDER_PERSON_PROFILE_PUBLIC_SCOPE_ID, 4, False),
        ]
        for index, (scope_id, requests, blocked) in enumerate(retained_values):
            relative_path = f'docs/live-probes/retained-{index}.json'
            report_path = self.root / relative_path
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_bytes = json.dumps({
                'scopeId': scope_id,
                'httpRequests': requests,
                'budgetBlocked': blocked,
                'requestAccounting': {'total': requests},
            }, separators=(',', ':')).encode()
            report_path.write_bytes(report_bytes)
            retained_reports[relative_path] = {
                'scope_id': scope_id,
                'sha256': hashlib.sha256(report_bytes).hexdigest(),
                'requests': requests,
                'budget_blocked': blocked,
            }

        with patch.object(GENERATOR, 'FRESH_PUBLIC_EPOCH_RETAINED_REPORTS', retained_reports):
            self.write_fresh_public_cohort_four_v2_report({
                name: GENERATOR.FRESH_PUBLIC_COHORT_FOUR_V2_MAX_PER_TOOL
                for name in GENERATOR.FRESH_PUBLIC_COHORT_FOUR_V2_TOOLS
            })
            self.assertEqual(GENERATOR.fresh_public_epoch_request_total(), 63)

            with patch.object(GENERATOR, 'FRESH_PUBLIC_EPOCH_REQUEST_CAP', 62):
                self.assertIsNone(GENERATOR.fresh_public_epoch_request_total())

            over_tool_cap = {
                name: GENERATOR.FRESH_PUBLIC_COHORT_FOUR_V2_MAX_PER_TOOL
                for name in GENERATOR.FRESH_PUBLIC_COHORT_FOUR_V2_TOOLS
            }
            over_tool_cap[GENERATOR.FRESH_PUBLIC_COHORT_FOUR_V2_TOOLS[0]] += 1
            self.write_fresh_public_cohort_four_v2_report(over_tool_cap)
            self.assertIsNone(GENERATOR.fresh_public_epoch_request_total())

    def write_fresh_public_api_matrix_six_report(self):
        for name in GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_TOOLS:
            if not any(item['name'] == name for item in self.catalog):
                self.catalog.append({'name': name, 'auth': 'none', 'risk': 'read'})
        self.catalog_path.write_text(json.dumps(self.catalog), encoding='utf-8')

        results = []
        per_tool = {}
        for name, input_data in GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_INPUTS.items():
            renderer_asset = 1 if name.startswith('bangumi.render_') else 0
            counts = {
                'bangumiApi': 1,
                'rendererAsset': renderer_asset,
                'total': 1 + renderer_asset,
            }
            per_tool[name] = counts
            results.append({
                'tool': name,
                'input': input_data,
                'attempted': True,
                'httpRequests': counts['total'],
                'requestAccounting': {
                    **counts,
                    'apiRetryAttemptsIncluded': True,
                    'apiRedirectHopsIncluded': True,
                    'rendererAssetRedirectHopsIncluded': True,
                    'anonymousSearchPostAllowed': True,
                    'searchPostPathRestricted': True,
                    'apiRedirectOriginRestricted': True,
                    'apiRedirectPrivatePathBlocked': True,
                },
                'result': {'state': 'partial', 'keys': ['state', 'items']},
                'assertions': {
                    key: True
                    for key in GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_ORIGIN_GUARD_REQUIRED_ASSERTIONS
                },
            })

        total_api = sum(item['bangumiApi'] for item in per_tool.values())
        total_assets = sum(item['rendererAsset'] for item in per_tool.values())
        total_requests = total_api + total_assets
        report = {
            'schemaVersion': 1,
            'evidenceKind': 'bangumi_public_api_tool_registry_smoke',
            'observedAt': '2026-10-16T00:00:00Z',
            'mode': 'read_only_public_api_smoke',
            'catalogSha256': hashlib.sha256(self.catalog_path.read_bytes()).hexdigest(),
            'probeScriptSha256': hashlib.sha256(self.six_matrix_probe_path.read_bytes()).hexdigest(),
            'sourceProgram': GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_PROGRAM,
            'supportingSourceSha256': {
                GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_SCOPE_PROGRAM: hashlib.sha256(
                    self.six_matrix_scope_path.read_bytes()
                ).hexdigest(),
                GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_BUDGET_PROGRAM: hashlib.sha256(
                    self.six_matrix_budget_path.read_bytes()
                ).hexdigest(),
                GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_SEARCH_FETCH_PROGRAM: hashlib.sha256(
                    self.five_post_v2_fetch_path.read_bytes()
                ).hexdigest(),
            },
            'scopeId': GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_SCOPE_ID,
            'requestBudget': {
                'maxPerTool': GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_MAX_PER_TOOL,
                'maxTotal': GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_MAX_TOTAL,
            },
            'requestAccounting': {
                'scope': 'bangumi_api_and_renderer_assets',
                'redirectsIncluded': True,
                'apiRetryAttemptsIncluded': True,
                'apiRedirectHopsIncluded': True,
                'rendererAssetRedirectHopsIncluded': True,
                'anonymousSearchPostAllowed': True,
                'searchPostPathRestricted': True,
                'apiRedirectOrigin': 'https://api.bgm.tv',
                'apiRedirectOriginRestricted': True,
                'apiRedirectPrivatePathBlocked': True,
                'bangumiApi': total_api,
                'rendererAsset': total_assets,
                'total': total_requests,
                'perTool': per_tool,
            },
            'budgetBlocked': False,
            'httpRequests': total_requests,
            'selectedTools': GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_TOOLS,
            'probeCount': len(GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_TOOLS),
            'limits': GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_LIMITS,
            'redactions': [
                'result row values, titles, names, identifiers, and image bytes are not persisted',
            ],
            'results': results,
        }
        self.report_path.write_text(json.dumps(report), encoding='utf-8')

    def test_counts_only_the_exact_hash_bound_six_row_public_matrix_scope(self):
        self.write_fresh_public_api_matrix_six_report()
        self.assertEqual(
            GENERATOR.public_api_smoke_names(self.catalog),
            set(GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_TOOLS),
        )
        sources = GENERATOR.public_api_smoke_sources(self.catalog)
        self.assertEqual(set(sources), set(GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_TOOLS))
        self.assertTrue(all(
            refs == {'docs/live-probes/public-tools-fixture.json'}
            for refs in sources.values()
        ))

    def test_credits_only_passing_rows_from_an_exact_scope_with_other_failed_rows(self):
        self.write_fresh_public_api_matrix_six_report()
        report = json.loads(self.report_path.read_text(encoding='utf-8'))
        passing_tool = 'bangumi.query_subjects'
        aggregate = {'bangumiApi': 0, 'rendererAsset': 0, 'total': 0}
        for index, result in enumerate(report['results']):
            if result['tool'] == passing_tool:
                counts = {'bangumiApi': 5, 'rendererAsset': 0, 'total': 5}
                assertions = result['assertions']
                assertions.update({
                    'httpRequestObserved': True,
                    'scopeRequestCap': True,
                    'passed': True,
                })
            else:
                counts = {'bangumiApi': 0, 'rendererAsset': 0, 'total': 0}
                result['result'] = (
                    {'state': 'error', 'keys': ['state', 'code']}
                    if index == 1
                    else {'state': 'value', 'keys': []}
                    if index == 2
                    else {'state': 'unavailable', 'keys': ['state', 'warnings', 'limitations']}
                )
                result['assertions'].update({
                    'httpRequestObserved': False,
                    'scopeRequestCap': False,
                    'noErrorResult': False,
                    'passed': False,
                })
            result['httpRequests'] = counts['total']
            result['requestAccounting'].update({
                **counts,
                'apiRetryAttemptsIncluded': True,
                'apiRedirectHopsIncluded': True,
                'rendererAssetRedirectHopsIncluded': True,
                'anonymousSearchPostAllowed': True,
                'searchPostPathRestricted': True,
                'apiRedirectOriginRestricted': True,
                'apiRedirectPrivatePathBlocked': True,
            })
            report['requestAccounting']['perTool'][result['tool']] = counts
            for key in aggregate:
                aggregate[key] += counts[key]

        report['requestAccounting'].update(aggregate)
        report['httpRequests'] = aggregate['total']
        self.report_path.write_text(json.dumps(report), encoding='utf-8')
        self.assertEqual(
            GENERATOR.public_api_smoke_sources(self.catalog),
            {passing_tool: {'docs/live-probes/public-tools-fixture.json'}},
        )

    def test_rejects_six_row_reports_with_changed_profiles_hashes_or_request_accounting(self):
        mutations = (
            lambda report: report['results'][0]['input']['cohort']['query'].__setitem__('year', 2012),
            lambda report: report['results'].reverse(),
            lambda report: report['supportingSourceSha256'].pop(
                GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_SCOPE_PROGRAM,
            ),
            lambda report: report['requestBudget'].__setitem__('maxTotal', 33),
            lambda report: report['requestAccounting'].__setitem__('apiRetryAttemptsIncluded', False),
            lambda report: report['requestAccounting'].__setitem__('apiRedirectOriginRestricted', False),
            lambda report: report['requestAccounting'].__setitem__('apiRedirectPrivatePathBlocked', False),
            lambda report: report['supportingSourceSha256'].pop(
                GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_SEARCH_FETCH_PROGRAM,
            ),
            lambda report: report['requestAccounting']['perTool'][
                GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_TOOLS[0]
            ].__setitem__('total', 9),
            lambda report: report['results'][0]['result'].__setitem__('rawRows', [{'id': 1}]),
            lambda report: report.__setitem__('budgetBlocked', True),
        )
        for mutate in mutations:
            with self.subTest(mutate=mutate):
                self.write_fresh_public_api_matrix_six_report()
                report = json.loads(self.report_path.read_text(encoding='utf-8'))
                mutate(report)
                self.report_path.write_text(json.dumps(report), encoding='utf-8')
                self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def write_fresh_public_query_subjects_origin_guard_v3_report(self):
        tool = 'bangumi.query_subjects'
        if not any(item['name'] == tool for item in self.catalog):
            self.catalog.append({'name': tool, 'auth': 'none', 'risk': 'read'})
        self.catalog_path.write_text(json.dumps(self.catalog), encoding='utf-8')
        counts = {'bangumiApi': 3, 'rendererAsset': 0, 'total': 3}
        result = {
            'tool': tool,
            'input': GENERATOR.FRESH_PUBLIC_QUERY_SUBJECTS_ORIGIN_GUARD_V3_INPUTS[tool],
            'attempted': True,
            'httpRequests': counts['total'],
            'requestAccounting': {
                **counts,
                'apiRetryAttemptsIncluded': True,
                'apiRedirectHopsIncluded': True,
                'rendererAssetRedirectHopsIncluded': True,
                'anonymousSearchPostAllowed': True,
                'searchPostPathRestricted': True,
                'apiRedirectOriginRestricted': True,
                'apiRedirectPrivatePathBlocked': True,
            },
            'result': {'state': 'partial', 'keys': ['state', 'items']},
            'assertions': {
                key: True
                for key in GENERATOR.FRESH_PUBLIC_QUERY_SUBJECTS_ORIGIN_GUARD_V3_REQUIRED_ASSERTIONS
            },
        }
        report = {
            'schemaVersion': 1,
            'evidenceKind': 'bangumi_public_api_tool_registry_smoke',
            'observedAt': '2026-10-16T00:00:00Z',
            'mode': 'read_only_public_api_smoke',
            'catalogSha256': hashlib.sha256(self.catalog_path.read_bytes()).hexdigest(),
            'probeScriptSha256': hashlib.sha256(self.origin_guard_v3_probe_path.read_bytes()).hexdigest(),
            'sourceProgram': GENERATOR.FRESH_PUBLIC_QUERY_SUBJECTS_ORIGIN_GUARD_V3_PROGRAM,
            'supportingSourceSha256': {
                GENERATOR.FRESH_PUBLIC_QUERY_SUBJECTS_ORIGIN_GUARD_V3_SCOPE_PROGRAM: hashlib.sha256(
                    self.origin_guard_v3_scope_path.read_bytes()
                ).hexdigest(),
                GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_BUDGET_PROGRAM: hashlib.sha256(
                    self.six_matrix_budget_path.read_bytes()
                ).hexdigest(),
                GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_SEARCH_FETCH_PROGRAM: hashlib.sha256(
                    self.five_post_v2_fetch_path.read_bytes()
                ).hexdigest(),
            },
            'scopeId': GENERATOR.FRESH_PUBLIC_QUERY_SUBJECTS_ORIGIN_GUARD_V3_SCOPE_ID,
            'requestBudget': {
                'maxPerTool': GENERATOR.FRESH_PUBLIC_QUERY_SUBJECTS_ORIGIN_GUARD_V3_MAX_PER_TOOL,
                'maxTotal': GENERATOR.FRESH_PUBLIC_QUERY_SUBJECTS_ORIGIN_GUARD_V3_MAX_TOTAL,
            },
            'requestAccounting': {
                'scope': 'bangumi_api_and_renderer_assets',
                'redirectsIncluded': True,
                'apiRetryAttemptsIncluded': True,
                'apiRedirectHopsIncluded': True,
                'rendererAssetRedirectHopsIncluded': True,
                'anonymousSearchPostAllowed': True,
                'searchPostPathRestricted': True,
                'apiRedirectOrigin': 'https://api.bgm.tv',
                'apiRedirectOriginRestricted': True,
                'apiRedirectPrivatePathBlocked': True,
                'publicPostPath': '/v0/search/subjects',
                **counts,
                'perTool': {tool: counts},
            },
            'budgetBlocked': False,
            'httpRequests': counts['total'],
            'selectedTools': [tool],
            'probeCount': 1,
            'limits': GENERATOR.FRESH_PUBLIC_QUERY_SUBJECTS_ORIGIN_GUARD_V3_LIMITS,
            'redactions': [
                'result row values, titles, names, identifiers, request bodies, and image bytes are not persisted',
            ],
            'results': [result],
        }
        self.report_path.write_text(json.dumps(report), encoding='utf-8')

    def test_counts_only_origin_guarded_replacement_query_subjects_profile(self):
        self.write_fresh_public_query_subjects_origin_guard_v3_report()
        self.assertEqual(
            GENERATOR.public_api_smoke_names(self.catalog),
            {'bangumi.query_subjects'},
        )
        sources = GENERATOR.public_api_smoke_sources(self.catalog)
        self.assertEqual(
            sources,
            {'bangumi.query_subjects': {'docs/live-probes/public-tools-fixture.json'}},
        )

        mutations = (
            lambda report: report['results'][0]['input'].__setitem__('year', 2018),
            lambda report: report['requestAccounting'].__setitem__('apiRedirectOriginRestricted', False),
            lambda report: report['requestAccounting'].__setitem__('apiRedirectPrivatePathBlocked', False),
            lambda report: report['requestAccounting'].__setitem__('apiRedirectOrigin', 'http://api.bgm.tv'),
            lambda report: report['supportingSourceSha256'].pop(
                GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_SEARCH_FETCH_PROGRAM,
            ),
            lambda report: report['requestBudget'].__setitem__('maxTotal', 9),
        )
        for mutate in mutations:
            with self.subTest(mutate=mutate):
                self.write_fresh_public_query_subjects_origin_guard_v3_report()
                report = json.loads(self.report_path.read_text(encoding='utf-8'))
                mutate(report)
                self.report_path.write_text(json.dumps(report), encoding='utf-8')
                self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_rejects_six_row_report_if_a_current_tool_is_not_anonymous_read_only(self):
        for field, value in (('auth', 'optional'), ('risk', 'write')):
            with self.subTest(field=field):
                self.write_fresh_public_api_matrix_six_report()
                tool = GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_TOOLS[0]
                current_tool = next(item for item in self.catalog if item['name'] == tool)
                current_tool.update({'auth': 'none', 'risk': 'read'})
                current_tool[field] = value
                self.catalog_path.write_text(json.dumps(self.catalog), encoding='utf-8')
                report = json.loads(self.report_path.read_text(encoding='utf-8'))
                report['catalogSha256'] = hashlib.sha256(self.catalog_path.read_bytes()).hexdigest()
                self.report_path.write_text(json.dumps(report), encoding='utf-8')
                self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def write_fresh_public_api_matrix_five_post_v2_report(self):
        for name in GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_TOOLS:
            if not any(item['name'] == name for item in self.catalog):
                self.catalog.append({'name': name, 'auth': 'none', 'risk': 'read'})
        self.catalog_path.write_text(json.dumps(self.catalog), encoding='utf-8')

        results = []
        per_tool = {}
        for name, input_data in GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_INPUTS.items():
            renderer_asset = 1 if name.startswith('bangumi.render_') else 0
            counts = {
                'bangumiApi': 1,
                'rendererAsset': renderer_asset,
                'total': 1 + renderer_asset,
            }
            per_tool[name] = counts
            results.append({
                'tool': name,
                'input': input_data,
                'attempted': True,
                'httpRequests': counts['total'],
                'requestAccounting': {
                    **counts,
                    'apiRetryAttemptsIncluded': True,
                    'apiRedirectHopsIncluded': True,
                    'rendererAssetRedirectHopsIncluded': True,
                    'anonymousSearchPostAllowed': True,
                    'searchPostPathRestricted': True,
                    'apiRedirectPrivatePathBlocked': True,
                },
                'result': {'state': 'partial', 'keys': ['state', 'items']},
                'assertions': {
                    key: True
                    for key in GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_REQUIRED_ASSERTIONS
                },
            })

        total_api = sum(item['bangumiApi'] for item in per_tool.values())
        total_assets = sum(item['rendererAsset'] for item in per_tool.values())
        total_requests = total_api + total_assets
        report = {
            'schemaVersion': 1,
            'evidenceKind': 'bangumi_public_api_tool_registry_smoke',
            'observedAt': '2026-10-16T00:00:00Z',
            'mode': 'read_only_public_api_smoke',
            'catalogSha256': hashlib.sha256(self.catalog_path.read_bytes()).hexdigest(),
            'probeScriptSha256': hashlib.sha256(self.five_post_v2_probe_path.read_bytes()).hexdigest(),
            'sourceProgram': GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_PROGRAM,
            'supportingSourceSha256': {
                GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_SCOPE_PROGRAM: hashlib.sha256(
                    self.five_post_v2_scope_path.read_bytes()
                ).hexdigest(),
                GENERATOR.FRESH_PUBLIC_API_MATRIX_SIX_BUDGET_PROGRAM: hashlib.sha256(
                    self.six_matrix_budget_path.read_bytes()
                ).hexdigest(),
                GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_SEARCH_FETCH_PROGRAM: hashlib.sha256(
                    self.five_post_v2_fetch_path.read_bytes()
                ).hexdigest(),
            },
            'scopeId': GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_SCOPE_ID,
            'requestBudget': {
                'maxPerTool': GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_MAX_PER_TOOL,
                'maxTotal': GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_MAX_TOTAL,
            },
            'requestAccounting': {
                'scope': 'bangumi_api_and_renderer_assets',
                'redirectsIncluded': True,
                'apiRetryAttemptsIncluded': True,
                'apiRedirectHopsIncluded': True,
                'rendererAssetRedirectHopsIncluded': True,
                'anonymousSearchPostAllowed': True,
                'searchPostPathRestricted': True,
                'apiRedirectPrivatePathBlocked': True,
                'publicPostPath': '/v0/search/subjects',
                'bangumiApi': total_api,
                'rendererAsset': total_assets,
                'total': total_requests,
                'perTool': per_tool,
            },
            'budgetBlocked': False,
            'httpRequests': total_requests,
            'selectedTools': GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_TOOLS,
            'probeCount': len(GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_TOOLS),
            'limits': GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_LIMITS,
            'redactions': [
                'result row values, titles, names, identifiers, request bodies, and image bytes are not persisted',
            ],
            'results': results,
        }
        self.report_path.write_text(json.dumps(report), encoding='utf-8')

    def test_counts_only_the_exact_post_safe_five_row_scope(self):
        self.write_fresh_public_api_matrix_five_post_v2_report()
        self.assertEqual(
            GENERATOR.public_api_smoke_names(self.catalog),
            set(GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_TOOLS),
        )

    def test_rejects_five_row_post_report_with_changed_input_route_or_support_hash(self):
        mutations = (
            lambda report: report['results'][0]['input']['cohort']['query'].__setitem__('year', 2012),
            lambda report: report['supportingSourceSha256'].pop(
                GENERATOR.FRESH_PUBLIC_API_MATRIX_FIVE_POST_V2_SEARCH_FETCH_PROGRAM,
            ),
            lambda report: report['requestAccounting'].__setitem__('publicPostPath', '/v0/subjects'),
            lambda report: report['requestAccounting'].__setitem__('apiRedirectPrivatePathBlocked', False),
            lambda report: report['requestAccounting'].__setitem__('anonymousSearchPostAllowed', False),
            lambda report: report.__setitem__('budgetBlocked', True),
        )
        for mutate in mutations:
            with self.subTest(mutate=mutate):
                self.write_fresh_public_api_matrix_five_post_v2_report()
                report = json.loads(self.report_path.read_text(encoding='utf-8'))
                mutate(report)
                self.report_path.write_text(json.dumps(report), encoding='utf-8')
                self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def write_p02_chronology_report(self, *, http_requests=4, max_per_tool=4, max_total=4):
        assertions = {
            'httpRequestObserved': True,
            'httpRequestBudget': True,
            'nonEmptySummary': True,
            'noErrorResult': True,
            'nonNegativeCounts': True,
            'countConsistency': True,
            'nonErrorResult': True,
            'correctPerson': True,
            'chronologyReturned': True,
            'chronologyBounded': True,
            'chronologyCountsConsistent': True,
            'relationCoverageConsistent': True,
            'passed': True,
        }
        summary = {
            'state': 'partial',
            'subjectCoverage': {'observed': 107, 'returned': 107, 'truncated': False},
            'releaseChronology': {
                'state': 'partial',
                'sourceCompleteness': 'undocumented',
                'dateSemantics': 'official-subject-air-release-date',
                'selectedSubjectDetails': 1,
                'succeededSubjectDetails': 1,
                'failedSubjectDetails': 0,
                'validDateSubjects': 1,
                'missingDateSubjects': 0,
                'invalidDateSubjects': 0,
                'omittedAnimeSubjects': 19,
                'earliestObserved': {'date': '2016-03-28', 'tiedSubjectCount': 1},
                'latestObserved': {'date': '2016-03-28', 'tiedSubjectCount': 1},
            },
        }
        result = {
            'tool': GENERATOR.P02_PUBLIC_CHRONOLOGY_TOOL,
            'input': GENERATOR.P02_PUBLIC_CHRONOLOGY_INPUT,
            'httpRequests': http_requests,
            'result': summary,
            'assertions': assertions,
        }
        report = {
            'schemaVersion': 1,
            'evidenceKind': 'bangumi_public_api_tool_registry_smoke',
            'observedAt': '2026-10-15T11:06:39.385Z',
            'mode': 'read_only_public_api_smoke',
            'sourceProgram': 'scripts/smoke-person-profile-chronology-online.ts',
            'catalogSha256': hashlib.sha256(self.catalog_path.read_bytes()).hexdigest(),
            'probeScriptSha256': hashlib.sha256(self.p02_probe_path.read_bytes()).hexdigest(),
            'requestBudget': {'maxPerTool': max_per_tool, 'maxTotal': max_total},
            'httpRequests': http_requests,
            'budgetBlocked': False,
            'selectedTools': [GENERATOR.P02_PUBLIC_CHRONOLOGY_TOOL],
            'probeCount': 1,
            'input': GENERATOR.P02_PUBLIC_CHRONOLOGY_INPUT,
            'result': summary,
            'results': [result],
            'limits': GENERATOR.P02_PUBLIC_CHRONOLOGY_LIMITS,
        }
        path = self.report_path.with_name('public-tools-p02-chronology-fixture.json')
        path.write_text(json.dumps(report), encoding='utf-8')
        return path

    def update_p02_chronology_summaries(self, update):
        path = self.report_path.with_name('public-tools-p02-chronology-fixture.json')
        report = json.loads(path.read_text(encoding='utf-8'))
        update(report['result']['releaseChronology'])
        update(report['results'][0]['result']['releaseChronology'])
        path.write_text(json.dumps(report), encoding='utf-8')

    def test_counts_hash_bound_profile_specific_report_within_budget(self):
        path = self.write_p02_chronology_report()
        self.assertEqual(
            GENERATOR.public_api_smoke_sources(self.catalog),
            {GENERATOR.P02_PUBLIC_CHRONOLOGY_TOOL: {f'docs/live-probes/{path.name}'}},
        )

    def test_excludes_profile_specific_report_over_budget(self):
        self.write_p02_chronology_report(http_requests=5)
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_excludes_profile_specific_report_with_a_different_input(self):
        self.write_p02_chronology_report()
        path = self.report_path.with_name('public-tools-p02-chronology-fixture.json')
        report = json.loads(path.read_text(encoding='utf-8'))
        report['results'][0]['input']['personId'] += 1
        path.write_text(json.dumps(report), encoding='utf-8')
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_excludes_profile_specific_report_with_a_different_budget(self):
        self.write_p02_chronology_report(max_total=5)
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_excludes_profile_specific_report_after_request_guard_blocks(self):
        self.write_p02_chronology_report()
        path = self.report_path.with_name('public-tools-p02-chronology-fixture.json')
        report = json.loads(path.read_text(encoding='utf-8'))
        report['budgetBlocked'] = True
        path.write_text(json.dumps(report), encoding='utf-8')
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_excludes_profile_specific_report_with_a_different_top_level_input(self):
        self.write_p02_chronology_report()
        path = self.report_path.with_name('public-tools-p02-chronology-fixture.json')
        report = json.loads(path.read_text(encoding='utf-8'))
        report['input']['personId'] += 1
        path.write_text(json.dumps(report), encoding='utf-8')
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_excludes_profile_specific_report_with_extra_raw_top_level_field(self):
        self.write_p02_chronology_report()
        path = self.report_path.with_name('public-tools-p02-chronology-fixture.json')
        report = json.loads(path.read_text(encoding='utf-8'))
        report['rawResponse'] = {'person': {'name': 'private raw payload'}}
        path.write_text(json.dumps(report), encoding='utf-8')
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_excludes_profile_specific_report_with_extra_summary_field(self):
        self.write_p02_chronology_report()
        path = self.report_path.with_name('public-tools-p02-chronology-fixture.json')
        report = json.loads(path.read_text(encoding='utf-8'))
        report['results'][0]['result']['rawSubjectRows'] = [{'id': 999}]
        path.write_text(json.dumps(report), encoding='utf-8')
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_excludes_profile_specific_report_missing_a_chronology_assertion(self):
        self.write_p02_chronology_report()
        path = self.report_path.with_name('public-tools-p02-chronology-fixture.json')
        report = json.loads(path.read_text(encoding='utf-8'))
        del report['results'][0]['assertions']['chronologyCountsConsistent']
        path.write_text(json.dumps(report), encoding='utf-8')
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_excludes_profile_specific_report_with_an_extra_assertion(self):
        self.write_p02_chronology_report()
        path = self.report_path.with_name('public-tools-p02-chronology-fixture.json')
        report = json.loads(path.read_text(encoding='utf-8'))
        report['results'][0]['assertions']['rawResponsePresent'] = True
        path.write_text(json.dumps(report), encoding='utf-8')
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_excludes_profile_specific_report_with_an_impossible_calendar_date(self):
        self.write_p02_chronology_report()
        self.update_p02_chronology_summaries(
            lambda chronology: chronology['earliestObserved'].update(date='2016-99-99'),
        )
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_excludes_profile_specific_report_with_state_inconsistent_with_date_counts(self):
        self.write_p02_chronology_report()

        def remove_all_valid_dates(chronology):
            chronology['validDateSubjects'] = 0
            chronology['missingDateSubjects'] = 1
            chronology['state'] = 'partial'
            chronology.pop('earliestObserved')
            chronology.pop('latestObserved')

        self.update_p02_chronology_summaries(remove_all_valid_dates)
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_excludes_profile_specific_report_when_earliest_is_after_latest(self):
        self.write_p02_chronology_report()
        self.update_p02_chronology_summaries(
            lambda chronology: chronology['earliestObserved'].update(date='2016-04-01'),
        )
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_excludes_profile_specific_report_with_more_tied_subjects_than_valid_dates(self):
        self.write_p02_chronology_report()
        self.update_p02_chronology_summaries(
            lambda chronology: chronology['earliestObserved'].update(tiedSubjectCount=2),
        )
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_combines_successful_partial_reports_per_tool(self):
        self.write_report()
        second_report = json.loads(self.report_path.read_text(encoding='utf-8'))
        second_report['selectedTools'] = ['bangumi.get_episode']
        second_report['results'] = [{
            **second_report['results'][0],
            'tool': 'bangumi.get_episode',
            'input': {'episodeId': 456},
            'result': {'id': 456},
        }]
        second_path = self.report_path.with_name('public-tools-episode-fixture.json')
        second_path.write_text(json.dumps(second_report), encoding='utf-8')

        self.assertEqual(
            GENERATOR.public_api_smoke_sources(self.catalog),
            {
                'bangumi.get_subject': {'docs/live-probes/public-tools-fixture.json'},
                'bangumi.get_episode': {'docs/live-probes/public-tools-episode-fixture.json'},
            },
        )

    def test_retains_unchanged_tool_evidence_from_catalog_snapshot(self):
        previous_catalog = [
            {
                'name': 'bangumi.get_subject',
                'auth': 'none',
                'risk': 'read',
                'inputSchema': {'properties': {'subjectId': {'type': 'integer'}}},
            },
            {
                'name': 'bangumi.get_episode',
                'auth': 'none',
                'risk': 'read',
                'inputSchema': {'properties': {'episodeId': {'type': 'integer'}}},
            },
            {'name': 'bangumi.auth_status', 'auth': 'none'},
        ]
        previous_bytes = json.dumps(previous_catalog).encode('utf-8')
        previous_hash = hashlib.sha256(previous_bytes).hexdigest()
        snapshots = GENERATOR.LIVE_PROBE_DIR / 'catalog-snapshots'
        snapshots.mkdir()
        (snapshots / f'{previous_hash}.json').write_bytes(previous_bytes)

        current_catalog = json.loads(previous_bytes)
        current_catalog[1]['inputSchema']['properties']['cursor'] = {'type': 'string'}
        self.catalog_path.write_text(json.dumps(current_catalog), encoding='utf-8')
        self.write_report(
            catalogSha256=previous_hash,
            selectedTools=['bangumi.get_subject', 'bangumi.get_episode'],
            probeCount=2,
            results=[
                {
                    'tool': 'bangumi.get_subject',
                    'input': {'subjectId': 123},
                    'httpRequests': 1,
                    'result': {'id': 123},
                    'assertions': {
                        'httpRequestObserved': True,
                        'nonEmptySummary': True,
                        'noErrorResult': True,
                        'nonNegativeCounts': True,
                        'countConsistency': True,
                        'passed': True,
                    },
                },
                {
                    'tool': 'bangumi.get_episode',
                    'input': {'episodeId': 456},
                    'httpRequests': 1,
                    'result': {'id': 456},
                    'assertions': {
                        'httpRequestObserved': True,
                        'nonEmptySummary': True,
                        'noErrorResult': True,
                        'nonNegativeCounts': True,
                        'countConsistency': True,
                        'passed': True,
                    },
                },
            ],
        )

        self.assertEqual(
            GENERATOR.public_api_smoke_sources(current_catalog),
            {'bangumi.get_subject': {'docs/live-probes/public-tools-fixture.json'}},
        )

    def test_retains_default_relation_probe_across_opt_in_analysis_mode(self):
        current_catalog_bytes = self.original_catalog.read_bytes()
        current_catalog = json.loads(current_catalog_bytes)
        current_tool = next(
            item for item in current_catalog
            if item['name'] == 'bangumi.get_subject_relations'
        )
        previous_tool = json.loads(json.dumps(current_tool))
        added_description = GENERATOR.SUBJECT_RELATIONS_ANALYSIS_ADDED_DESCRIPTION
        self.assertTrue(current_tool['description'].endswith(added_description))
        previous_tool['description'] = current_tool['description'][:-len(added_description)]
        del previous_tool['inputSchema']['properties']['analysisMode']
        previous_catalog_bytes = json.dumps([previous_tool], indent=2).encode('utf-8')
        previous_catalog_sha = hashlib.sha256(previous_catalog_bytes).hexdigest()
        snapshot_dir = GENERATOR.LIVE_PROBE_DIR / 'catalog-snapshots'
        snapshot_dir.mkdir(parents=True)
        (snapshot_dir / f'{previous_catalog_sha}.json').write_bytes(previous_catalog_bytes)

        self.catalog_path.write_bytes(current_catalog_bytes)
        self.catalog = current_catalog
        tool_name = 'bangumi.get_subject_relations'
        self.write_report(
            catalogSha256=previous_catalog_sha,
            selectedTools=[tool_name],
            probeCount=1,
            results=[{
                'tool': tool_name,
                'input': {'subjectId': 123},
                'httpRequests': 1,
                'result': {'state': 'value', 'keys': ['0']},
                'assertions': {
                    name: True for name in GENERATOR.PUBLIC_API_REQUIRED_ASSERTIONS
                },
            }],
        )

        self.assertTrue(
            GENERATOR.public_api_catalog_evidence_matches_current(
                previous_catalog_sha, [tool_name],
            ),
        )
        self.assertEqual(
            GENERATOR.public_api_smoke_sources(current_catalog),
            {tool_name: {'docs/live-probes/public-tools-fixture.json'}},
        )

        changed_catalog = json.loads(json.dumps(current_catalog))
        changed_tool = next(item for item in changed_catalog if item['name'] == tool_name)
        changed_tool['inputSchema']['properties']['subjectId']['maximum'] = 99
        self.catalog_path.write_text(json.dumps(changed_catalog), encoding='utf-8')
        self.assertFalse(
            GENERATOR.public_api_catalog_evidence_matches_current(
                previous_catalog_sha, [tool_name],
            ),
        )

    def test_model_mcp_evidence_keeps_the_per_tool_report_path(self):
        catalog_hash = hashlib.sha256(self.catalog_path.read_bytes()).hexdigest()
        report_path = self.root / 'docs/live-probes/pariya-agent-public-e2e-fixture.json'
        report_path.write_text(json.dumps({
            'schemaVersion': 1,
            'evidenceKind': 'antigravity_cli_mcp_tool_use',
            'catalogSha256': catalog_hash,
            'profile': 'bangumi-full-public-qa-v1',
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'resultCount': 1,
            'qqPipelineTested': False,
            'timClientTested': False,
            'scenarios': [{
                'id': 'get-subject',
                'passed': True,
                'toolCalls': [{'name': 'bangumi.get_subject', 'state': 'DONE'}],
            }],
        }), encoding='utf-8')
        self.assertEqual(
            GENERATOR.model_mcp_e2e_sources(self.catalog),
            {'bangumi.get_subject': {'docs/live-probes/pariya-agent-public-e2e-fixture.json'}},
        )

    def test_rejects_stale_catalog_hash(self):
        self.write_report(catalogSha256='0' * 64)
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_rejects_zero_http_requests(self):
        self.write_report(results=[{
            'tool': 'bangumi.get_subject',
            'input': {'subjectId': 123},
            'httpRequests': 0,
            'result': {'id': 123},
            'assertions': {'passed': True},
        }])
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_rejects_failed_result_assertions(self):
        self.write_report(results=[{
            'tool': 'bangumi.get_subject',
            'input': {'subjectId': 123},
            'httpRequests': 1,
            'result': {'id': 123},
            'assertions': {'identityMatchesRequest': False, 'passed': False},
        }])
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_rejects_reports_missing_shape_assertions(self):
        self.write_report(results=[{
            'tool': 'bangumi.get_subject',
            'input': {'subjectId': 123},
            'httpRequests': 1,
            'result': {'id': 123},
            'assertions': {'passed': True},
        }])
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())

    def test_rejects_private_username_in_recorded_input(self):
        self.write_report(results=[{
            'tool': 'bangumi.get_subject',
            'input': {'subjectId': 123, 'username': 'must-not-be-saved'},
            'httpRequests': 1,
            'result': {'id': 123},
            'assertions': {'passed': True},
        }])
        self.assertEqual(GENERATOR.public_api_smoke_names(self.catalog), set())


class CodexModelMcpEvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        keypair_script = (
            'import { generateKeyPairSync } from "node:crypto"; '
            'const pair = generateKeyPairSync("ed25519"); '
            'process.stdout.write(JSON.stringify({'
            'privateKeyPem: pair.privateKey.export({type:"pkcs8",format:"pem"}), '
            'publicKeyPem: pair.publicKey.export({type:"spki",format:"pem"})}));'
        )
        keypair_result = subprocess.run(
            ['node', '--input-type=module', '-e', keypair_script],
            capture_output=True,
            text=True,
            check=True,
        )
        keypair = json.loads(keypair_result.stdout)
        cls.s03_test_attestation_private_key = keypair['privateKeyPem']
        cls.s03_test_attestation_public_key = keypair['publicKeyPem']

    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix='codex-model-mcp-evidence-test-')
        self.root = Path(self.temp_dir.name)
        self.live_probe_dir = self.root / 'docs/live-probes'
        self.live_probe_dir.mkdir(parents=True)
        self.catalog = [
            {
                'name': 'bangumi.get_subject_stats_intelligence',
                'auth': 'none', 'risk': 'read',
                'description': 'Current stats snapshot and evidence.',
                'inputSchema': {'type': 'object', 'properties': {'subjectId': {'type': 'integer'}}},
            },
            {
                'name': 'bangumi.render_subject_stats_intelligence',
                'auth': 'none', 'risk': 'read',
                'description': 'Render current stats snapshot.',
                'inputSchema': {'type': 'object', 'properties': {'subjectId': {'type': 'integer'}}},
            },
            {
                'name': 'bangumi.get_subject_relations',
                'auth': 'none', 'risk': 'read',
                'description': 'Read direct official subject relations with optional evidence.',
                'inputSchema': {
                    'type': 'object',
                    'properties': {
                        'subjectId': {'type': 'integer'},
                        'includeEvidence': {'type': 'boolean'},
                    },
                    'required': ['subjectId'],
                },
            },
            {
                'name': 'bangumi.query_subjects',
                'auth': 'none', 'risk': 'read',
                'description': 'Bounded public subject discovery with local reported Subject.eps filtering.',
                'inputSchema': {
                    'type': 'object',
                    'properties': {
                        'media': {'type': 'string'},
                        'season': {'type': 'string', 'pattern': '^(?:current|\\d{4}-(winter|spring|summer|autumn))$'},
                        'from': {'type': 'string'},
                        'to': {'type': 'string'},
                        'ratingCount': {'type': 'object'},
                        'reportedEpisodeCount': {
                            'type': 'object',
                            'properties': {
                                'min': {'type': 'integer', 'minimum': 0},
                                'max': {'type': 'integer', 'minimum': 0},
                            },
                            'additionalProperties': False,
                        },
                        'tags': {'type': 'array'},
                        'categories': {'type': 'string'},
                        'resultMode': {'type': 'string'},
                        'limit': {'type': 'integer'},
                        'explain': {'type': 'string'},
                    },
                },
            },
            {
                'name': 'bangumi.render_query_subjects',
                'auth': 'none', 'risk': 'read',
                'description': 'Render bounded public subject discovery results.',
                'inputSchema': {
                    'type': 'object',
                    'properties': {
                        'media': {'type': 'string'},
                        'from': {'type': 'string'},
                        'to': {'type': 'string'},
                        'concepts': {'type': 'array'},
                        'sort': {'type': 'string'},
                        'order': {'type': 'string'},
                        'resultMode': {'type': 'string'},
                        'limit': {'type': 'integer'},
                        'explain': {'type': 'string'},
                    },
                },
            },
            {
                'name': 'bangumi.get_person_activity',
                'auth': 'none', 'risk': 'read',
                'description': 'Person activity with a coverage-aware top rated voice role ranking.',
                'inputSchema': {
                    'type': 'object',
                    'properties': {
                        'personId': {'type': 'integer'},
                        'rankingMode': {'type': 'string'},
                        'media': {'type': 'string'},
                    },
                    'required': ['personId'],
                },
            },
            {
                'name': 'bangumi.get_series_watch_order',
                'auth': 'none', 'risk': 'read',
                'description': 'Bounded series relations with optional voice actor overlap.',
                'inputSchema': {
                    'type': 'object',
                    'properties': {
                        'subjectId': {'type': 'integer'},
                        'voiceActorPersonId': {'type': 'integer'},
                        'maxVoiceCredits': {'type': 'integer'},
                    },
                    'required': ['subjectId'],
                },
            },
            {'name': 'bangumi.auth_status', 'auth': 'none', 'risk': 'read'},
        ]
        source_catalog = json.loads(GENERATOR.CATALOG.read_text(encoding='utf-8'))
        self.catalog.append(next(
            item for item in source_catalog
            if item.get('name') == 'bangumi.compare_subject_cohorts'
        ))
        self.catalog.append(next(
            item for item in source_catalog
            if item.get('name') == 'bangumi.aggregate_subject_cohort'
        ))
        self.catalog.append(next(
            item for item in source_catalog
            if item.get('name') == 'bangumi.render_subject_cohort_comparison'
        ))
        self.catalog_path = self.root / 'docs/tool-catalog.json'
        self.catalog_path.write_text(json.dumps(self.catalog, ensure_ascii=False), encoding='utf-8')
        self.original_root = GENERATOR.ROOT
        (
            self.source_revision,
            self.stale_candidate_source_revision,
            self.unrelated_source_revision,
        ) = self._init_probe_source_history()
        self.original_catalog = GENERATOR.CATALOG
        self.original_probe_dir = GENERATOR.LIVE_PROBE_DIR
        GENERATOR.ROOT = self.root
        GENERATOR.CATALOG = self.catalog_path
        GENERATOR.LIVE_PROBE_DIR = self.live_probe_dir
        self.report_path = self.live_probe_dir / 'pariya-agent-codex-luna-e2e-G23.json'
        self.original_urlopen = GENERATOR.urllib.request.urlopen
        self.s03_control_candidate_revision = self.source_revision
        self.s03_control_base_sha = 'b' * 40
        self.s03_control_key_sha256 = hashlib.sha256(
            self.s03_test_attestation_public_key.encode('utf-8'),
        ).hexdigest()
        self.s03_control_available = True
        self.p01_control_pr_number = None
        self.p01_control_body = None
        self.p01_control_available = True
        self.p01_pr_state = 'open'
        self.p01_pr_merged = False
        self.p01_pr_head_sha = None
        GENERATOR.urllib.request.urlopen = self._fake_s03_control_urlopen

    def _fake_s03_control_urlopen(self, request, timeout=10):
        if (
            self.p01_control_pr_number is not None
            and request.full_url.endswith(f'/pulls/{self.p01_control_pr_number}')
        ):
            if not self.p01_control_available or not isinstance(self.p01_control_body, str):
                raise GENERATOR.urllib.error.URLError('P01 fixture control plane unavailable')
            payload = json.dumps({
                'number': self.p01_control_pr_number,
                'state': self.p01_pr_state,
                'merged': self.p01_pr_merged,
                'head': {'sha': self.p01_pr_head_sha},
                'body': self.p01_control_body,
            }).encode('utf-8')

            class P01Response:
                def __enter__(self):
                    return self

                def __exit__(self, exception_type, exception, traceback):
                    return False

                def read(self, size=-1):
                    return payload if size < 0 else payload[:size]

            return P01Response()
        if not self.s03_control_available:
            raise GENERATOR.urllib.error.URLError('fixture control plane unavailable')

        reviewer_id = 'gpt-6-luna-max-run95-s03-pr128-round1'
        marker = (
            'S03 runner attestation trust: candidate '
            f'{self.s03_control_candidate_revision}; Ed25519 public key SHA-256 '
            f'{self.s03_control_key_sha256}.'
        )
        epoch = {
            'schema': 'bangumi-harness/v3',
            'kind': 'epoch',
            'pr_number': 128,
            'base_sha': self.s03_control_base_sha,
            'adversarial_preflight': {'completed': True, 'summary': marker},
            'review_history': [{
                'candidate_sha': self.s03_control_candidate_revision,
                'reviewed_base_sha': self.s03_control_base_sha,
                'reviewer_id': reviewer_id,
                'verdict': 'PASS',
            }],
        }
        fence = chr(96) * 3
        body = (
            '<!-- bangumi-harness:v3:epoch:start -->\n'
            + fence
            + 'json\n'
            + json.dumps(epoch)
            + '\n'
            + fence
            + '\n<!-- bangumi-harness:v3:epoch:end -->'
        )
        payload = json.dumps({'number': 128, 'body': body}).encode('utf-8')

        class Response:
            def __enter__(self):
                return self

            def __exit__(self, exception_type, exception, traceback):
                return False

            def read(self, size=-1):
                return payload if size < 0 else payload[:size]

        return Response()

    def _set_p01_control_record(
        self,
        report,
        report_bytes,
        report_sha_override=None,
        *,
        current_candidate='source',
        current_review_pass='source',
        epoch_state='REVIEW_PASSED',
        refresh_history=None,
        review_history=None,
        pr_head_sha=None,
        pr_state='open',
        pr_merged=False,
    ):
        self.p01_control_pr_number = report['prNumber']
        reviewer_id = report['reviewerId']
        source_revision = report['sourceRevision']
        base_sha = report['baseSha']
        receipt = report['runnerReceipt']
        current_candidate = source_revision if current_candidate == 'source' else current_candidate
        current_review_pass = source_revision if current_review_pass == 'source' else current_review_pass
        if review_history is None:
            review_history = [{
                'review_number': 1,
                'candidate_sha': source_revision,
                'reviewed_base_sha': base_sha,
                'reviewer_id': reviewer_id,
                'verdict': 'PASS',
            }]
        self.p01_pr_head_sha = pr_head_sha or current_candidate
        self.p01_pr_state = pr_state
        self.p01_pr_merged = pr_merged
        disposition = {
            'claimId': report['claimId'],
            'frontierId': 'P01',
            'epochId': GENERATOR.CODEX_P01_EPOCH_ID,
            'runNumber': 95,
            'toolName': 'bangumi.get_person_activity',
            'argumentProfile': GENERATOR.CODEX_P01_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR._canonical_json_sha256(
                GENERATOR.CODEX_P01_EXPECTED_ARGUMENTS,
            ),
            'state': 'REPORT_WRITTEN',
            'sourceCandidateSha': source_revision,
            'baseSha': base_sha,
            'ciSha': source_revision,
            'ciStatus': 'SUCCESS',
            'bundleSha256': report['mcpBundleSha256'],
            'prNumber': self.p01_control_pr_number,
            'reviewerId': reviewer_id,
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'runnerReceiptPublicKeySha256': receipt['publicKeySha256'],
            'reportWritten': True,
            'retryAllowed': False,
            'reportPath': GENERATOR.CODEX_P01_REPORT_RELATIVE_PATH,
            'reportSha256': report_sha_override or hashlib.sha256(report_bytes).hexdigest(),
        }
        epoch = {
            'schema': 'bangumi-harness/v3',
            'kind': 'epoch',
            'epoch_id': GENERATOR.CODEX_P01_EPOCH_ID,
            'pr_number': self.p01_control_pr_number,
            'state': epoch_state,
            'base_sha': base_sha,
            'candidate_sha': current_candidate,
            'review_pass_sha': current_review_pass,
            'candidate_refresh_history': refresh_history or [],
            'adversarial_preflight': {
                'completed': True,
                'p01_one_shot_disposition': disposition,
            },
            'review_history': review_history,
        }
        fence = chr(96) * 3
        self.p01_control_body = (
            '<!-- bangumi-harness:v3:epoch:start -->\n'
            + fence + 'json\n'
            + json.dumps(epoch)
            + '\n' + fence
            + '\n<!-- bangumi-harness:v3:epoch:end -->'
        )

    def _git(self, *args):
        return subprocess.run(
            ['git', *args], cwd=self.root, check=True, capture_output=True, text=True,
        )

    def _sign_s03_test_proof(self, proof_sha256):
        signer_script = (
            'import { createPrivateKey, sign } from "node:crypto"; '
            'import { readFileSync } from "node:fs"; '
            'const input = JSON.parse(readFileSync(0,"utf8")); '
            'process.stdout.write(sign(null, Buffer.from(input.proofSha256,"hex"), '
            'createPrivateKey(input.privateKeyPem)).toString("base64"));'
        )
        result = subprocess.run(
            ['node', '--input-type=module', '-e', signer_script],
            input=json.dumps({
                'privateKeyPem': self.s03_test_attestation_private_key,
                'proofSha256': proof_sha256,
            }),
            capture_output=True,
            text=True,
            check=True,
        )
        return result.stdout.strip()

    def _init_probe_source_history(self):
        relative_paths = {
            *GENERATOR.CODEX_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_G20_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_R01_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_A01_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_A01_AGGREGATE_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_G26_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_D07_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_S02_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_G04_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_G05_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_G16_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_C03_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_G19_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_P01_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_S03_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_D05_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_D04_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_G02_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_C07_RENDERER_PROBE_IMPLEMENTATION_MARKERS,
        }
        for relative_path in relative_paths:
            if relative_path in {
                GENERATOR.CODEX_D05_BUNDLE_ATTESTATION_RELATIVE_PATH,
                GENERATOR.CODEX_S03_BUNDLE_ATTESTATION_RELATIVE_PATH,
            }:
                continue
            source_path = self.original_root / relative_path
            fixture_path = self.root / relative_path
            fixture_path.parent.mkdir(parents=True, exist_ok=True)
            fixture_path.write_bytes(source_path.read_bytes())
        attestation_key_path = (
            self.root / GENERATOR.CODEX_S03_ATTESTATION_PUBLIC_KEY_RELATIVE_PATH
        )
        attestation_key_path.parent.mkdir(parents=True, exist_ok=True)
        attestation_key_path.write_text(self.s03_test_attestation_public_key, encoding='utf-8')
        s02_attestation_path = self.root / GENERATOR.CODEX_S02_BUNDLE_ATTESTATION_RELATIVE_PATH
        s02_attestation_path.parent.mkdir(parents=True, exist_ok=True)
        s02_attestation_path.write_text(json.dumps({
            'schemaVersion': 1,
            'kind': 's02-mcp-runtime-bundle-attestation-v1',
            'bundleSha256': 'e' * 64,
        }), encoding='utf-8')
        relative_paths.add(GENERATOR.CODEX_S02_BUNDLE_ATTESTATION_RELATIVE_PATH)
        d05_attestation_path = self.root / GENERATOR.CODEX_D05_BUNDLE_ATTESTATION_RELATIVE_PATH
        d05_attestation_path.parent.mkdir(parents=True, exist_ok=True)
        d05_attestation_path.write_text(json.dumps({
            'schemaVersion': 1,
            'kind': 'd05-mcp-runtime-bundle-attestation-v1',
            'bundleSha256': 'f' * 64,
        }), encoding='utf-8')
        relative_paths.add(GENERATOR.CODEX_D05_BUNDLE_ATTESTATION_RELATIVE_PATH)
        s03_attestation_path = self.root / GENERATOR.CODEX_S03_BUNDLE_ATTESTATION_RELATIVE_PATH
        s03_attestation_path.parent.mkdir(parents=True, exist_ok=True)
        s03_attestation_path.write_text(json.dumps({
            'schemaVersion': 1,
            'kind': 's03-mcp-runtime-bundle-attestation-v1',
            'bundleSha256': 'a' * 64,
        }), encoding='utf-8')
        relative_paths.add(GENERATOR.CODEX_S03_BUNDLE_ATTESTATION_RELATIVE_PATH)
        smoke_script = self.root / 'scripts/smoke-public-tools-online.ts'
        smoke_script.parent.mkdir(parents=True, exist_ok=True)
        smoke_script.write_text('// public probe report validator fixture\n', encoding='utf-8')
        self._git('init', '-q')
        self._git('config', 'gc.auto', '0')
        self._git('config', 'maintenance.auto', 'false')
        self._git('config', 'user.name', 'Acceptance Evidence Test')
        self._git('config', 'user.email', 'acceptance-evidence@example.invalid')
        self._git('commit', '--allow-empty', '-qm', 'probe acceptance base fixture')
        self._git('add', *sorted(relative_paths))
        self._git('commit', '-qm', 'add one-tool probe implementation fixture')
        stale_candidate_revision = self._git('rev-parse', 'HEAD').stdout.strip()
        self._git('commit', '--allow-empty', '-qm', 'candidate revision authorizing the G20 probe')
        candidate_revision = self._git('rev-parse', 'HEAD').stdout.strip()
        server_path = self.root / 'apps/mcp/codex-one-tool-mcp-server.mjs'
        server_path.write_text('export const unrelatedProgram = true;\n', encoding='utf-8')
        self._git('add', 'apps/mcp/codex-one-tool-mcp-server.mjs')
        self._git('commit', '-qm', 'replace probe implementation with unrelated code')
        unrelated_revision = self._git('rev-parse', 'HEAD').stdout.strip()
        self._git('tag', 'test-unrelated-source-revision', unrelated_revision)
        self._git('reset', '--hard', candidate_revision)
        return candidate_revision, stale_candidate_revision, unrelated_revision

    def tearDown(self):
        GENERATOR.ROOT = self.original_root
        GENERATOR.CATALOG = self.original_catalog
        GENERATOR.LIVE_PROBE_DIR = self.original_probe_dir
        GENERATOR.urllib.request.urlopen = self.original_urlopen
        self.temp_dir.cleanup()

    @staticmethod
    def sha256(value):
        return hashlib.sha256(value.encode('utf-8')).hexdigest()

    def write_report(
        self, tool_name='bangumi.get_subject_stats_intelligence', *, frontier_id=None, **overrides,
    ):
        tool = next(item for item in self.catalog if item['name'] == tool_name)
        is_r01 = (
            frontier_id == 'R01'
            and tool_name in GENERATOR.CODEX_R01_PROBE_ARGUMENTS
        )
        is_g20 = tool_name in GENERATOR.CODEX_G20_PROBE_ARGUMENTS and not is_r01
        is_d04 = tool_name == 'bangumi.query_subjects'
        is_renderer = tool_name.startswith('bangumi.render_')
        arguments = (GENERATOR.CODEX_D04_PROBE_ARGUMENTS[tool_name] if is_d04
                     else GENERATOR.CODEX_R01_PROBE_ARGUMENTS[tool_name] if is_r01
                     else GENERATOR.CODEX_PROBE_ARGUMENTS[tool_name])
        if is_g20 or is_r01:
            answer_checks = {key: True for key in GENERATOR.CODEX_G20_ANSWER_CHECK_FIELDS}
            result = self._g20_result_fixture(source_subject_id=arguments['subjectId'])
        elif is_d04:
            answer_checks = {key: True for key in GENERATOR.CODEX_D04_ANSWER_CHECK_FIELDS}
            result = {
                'toolName': tool_name,
                'resultState': 'partial',
                'resultByteLength': 4096,
                'resultSha256': 'd' * 64,
                'sourceOperations': [{'operation': 'POST /v0/search/subjects', 'attempted': 1,
                                      'succeeded': 1, 'failed': 0}],
                'artifact': {'returned': False, 'persisted': False},
            }
        else:
            answer_checks = {
                key: True for key in (GENERATOR.CODEX_RENDERER_ANSWER_CHECK_FIELDS if is_renderer
                                      else GENERATOR.CODEX_STATS_ANSWER_CHECK_FIELDS)
            }
            result = {
                'toolName': tool_name,
                'resultState': 'artifact_returned' if is_renderer else 'partial',
                'resultByteLength': 128,
                'resultSha256': 'b' * 64,
                'sourceOperations': [{'operation': 'GET /v0/subjects/{subject_id}', 'attempted': 1,
                                      'succeeded': 1, 'failed': 0}],
                'artifact': ({'returned': True, 'persisted': False, 'mimeType': 'image/png',
                              'width': 720, 'height': 1200, 'byteLength': 128000,
                              'sha256': 'c' * 64, 'pngSignatureValid': True}
                             if is_renderer else {'returned': False, 'persisted': False}),
            }
        if is_r01:
            visible_rows = result.pop('visibleRows')
            result['visibleRowCount'] = len(visible_rows)
            result['visibleRowsSha256'] = GENERATOR._canonical_json_sha256(visible_rows)
        report = {
            'schemaVersion': 1,
            'evidenceKind': 'codex_cli_mcp_tool_use',
            'sourceRevision': self.source_revision,
            'codexCliVersion': '0.160.0',
            'catalogSha256': hashlib.sha256(self.catalog_path.read_bytes()).hexdigest(),
            'profile': 'codex-luna-max-one-tool-v1',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'toolName': tool_name,
            'toolDescriptionSha256': self.sha256(tool['description']),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'argumentProfile': (
                GENERATOR.CODEX_R01_ARGUMENT_PROFILE if is_r01
                else GENERATOR.CODEX_ARGUMENT_PROFILES[tool_name]
            ),
            'expectedArgumentsSha256': GENERATOR._canonical_json_sha256(arguments),
            'serverToolNames': [tool_name],
            'serverToolCount': 1,
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'resultCount': 1,
            'eventStreamParsed': True,
            'codexMcpToolEventCount': 1,
            **({'codexErrorItemCount': 0} if is_r01 else {}),
            'nonMcpToolEventCount': 0,
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'qqPipelineTested': False,
            'timClientTested': False,
            'privacy': ({key: False for key in GENERATOR.CODEX_PRIVACY_FLAGS} |
                        {'authProfile': 'anonymous'} |
                        ({'communityRead': False} if is_d04 else {})),
            'scenarios': [{
                'id': tool_name,
                'passed': True,
                'exactArgumentsMatched': True,
                'oneToolAllowlistVerified': True,
                'resultReadbackVerified': True,
                'answerCheckPassed': True,
                'answerChecks': answer_checks,
                'toolCalls': [{'name': tool_name, 'state': 'DONE'}],
                'result': result,
            }],
        }
        if is_r01:
            report.update({
                'runNumber': 95,
                'frontierId': 'R01',
                'epochId': 'run95-r01-subject-relations-agent-mcp-followup',
                'reviewerId': 'gpt-6-luna-max-run95-pr147-round1',
                'baseSha': self._git('rev-parse', f'{self.source_revision}^').stdout.strip(),
                'prNumber': 147,
                'claimId': f"r01-run-95-pr-147-{self.source_revision[:12]}-1791765972000",
                'mcpBundleSha256': GENERATOR.codex_g26_candidate_bundle_sha256(self.source_revision),
                'observedAt': '2026-10-13T00:00:00.000Z',
            })
        if is_d04:
            report.update({
                'runNumber': 95,
                'frontierId': 'D04',
                'mcpBundleSha256': 'e' * 64,
                'prNumber': 113,
                'baseSha': 'b' * 40,
                'observedAt': '2026-10-09T00:00:00.000Z',
                'coverage': {
                    'resultState': 'partial',
                    'operation': 'searchSubjects',
                    'officialV0Plan': True,
                    'totalKind': 'estimated',
                    'coverageState': 'partial',
                    'counters': {
                        'requested': 100, 'scanned': 2, 'matched': 2, 'returned': 2,
                        'pagesRequested': 1, 'pagesScanned': 1, 'hydrationsAttempted': 0,
                        'hydrationsSucceeded': 0, 'hydrationsFailed': 0,
                        'hydrationsUnresolved': 0, 'outputCap': 100,
                    },
                    'flags': {
                        'upstreamExhausted': True,
                        'budgetExceeded': False,
                        'hydrationBudgetExceeded': False,
                    },
                    'queryChecks': {
                        key: True for key in GENERATOR.CODEX_D04_QUERY_CHECKS
                    },
                    'rows': {'observed': 2, 'valid': 2, 'withReportedEpisodeEvidence': 2},
                    'experimentalDisclosure': True,
                    'reportedEpsDisclosure': True,
                    'warningCodes': ['EXPERIMENTAL_SOURCE'],
                },
                'warningCodes': ['EXPERIMENTAL_SOURCE'],
                'resultHash': 'd' * 64,
                'resultByteLength': 4096,
            })
        report.update(overrides)
        self.report_path.write_text(json.dumps(report, ensure_ascii=False), encoding='utf-8')

    def write_a01_aggregate_report(self, **overrides):
        tool_name = 'bangumi.aggregate_subject_cohort'
        tool = next(item for item in self.catalog if item['name'] == tool_name)
        arguments = GENERATOR.CODEX_A01_AGGREGATE_ARGUMENTS
        base_sha = self._git('rev-parse', f'{self.source_revision}^').stdout.strip()
        bundle_sha = GENERATOR.codex_g26_candidate_bundle_sha256(self.source_revision)
        self.assertIsNotNone(bundle_sha)
        answer_checks = {
            key: True for key in GENERATOR.CODEX_A01_AGGREGATE_ANSWER_CHECK_FIELDS
        }
        metrics = [
            {
                'key': key,
                'state': 'partial',
                'value': value,
                'valid': 1,
                'partial': 0,
                'missing': 0,
                'conflicts': 0,
                'notComputable': 0,
            }
            for key, value in (
                ('score', 7.5),
                ('heat', 100.0),
                ('episodesReported', 12.0),
                ('ratingStandardDeviation', 1.2),
            )
        ]
        summary = {
            'state': 'partial',
            'formulaVersion': 'subject-cohort-comparison-v1',
            'query': {
                'state': 'partial',
                'scanned': 20,
                'matched': 1,
                'returned': 1,
                'totalKind': 'estimated',
                'budgetExceeded': False,
                'upstreamExhausted': False,
            },
            'coverage': {
                'maxSubjectsPerCohort': 1,
                'totalSubjectsReturned': 1,
                'cohortsComplete': 0,
                'cohortsPartial': 1,
                'detailHydrationsAttempted': 1,
                'detailHydrationsSucceeded': 1,
                'detailHydrationsFailed': 0,
                'truncated': True,
            },
            'metrics': metrics,
            'officialOperations': ['searchSubjects', 'getSubjectById'],
        }
        report = {
            'schemaVersion': 1,
            'evidenceKind': 'codex_cli_mcp_tool_use',
            'sourceRevision': self.source_revision,
            'codexCliVersion': '0.162.0-alpha.2',
            'catalogSha256': hashlib.sha256(self.catalog_path.read_bytes()).hexdigest(),
            'profile': 'codex-luna-max-one-tool-v1',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'toolName': tool_name,
            'toolDescriptionSha256': self.sha256(tool['description']),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'argumentProfile': GENERATOR.CODEX_A01_AGGREGATE_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR._canonical_json_sha256(arguments),
            'serverToolNames': [tool_name],
            'serverToolCount': 1,
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'resultCount': 1,
            'eventStreamParsed': True,
            'codexMcpToolEventCount': 1,
            'nonMcpToolEventCount': 0,
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'qqPipelineTested': False,
            'timClientTested': False,
            'privacy': ({key: False for key in GENERATOR.CODEX_A01_AGGREGATE_PRIVACY_FIELDS}
                        | {'authProfile': 'anonymous'}),
            'scenarios': [{
                'id': tool_name,
                'passed': True,
                'exactArgumentsMatched': True,
                'oneToolAllowlistVerified': True,
                'resultReadbackVerified': True,
                'answerCheckPassed': True,
                'answerChecks': answer_checks,
                'toolCalls': [{'name': tool_name, 'state': 'DONE'}],
                'result': {
                    'toolName': tool_name,
                    'resultState': 'partial',
                    'resultByteLength': 2048,
                    'resultSha256': 'd' * 64,
                    'summary': summary,
                },
            }],
            'runNumber': 95,
            'frontierId': 'A01',
            'epochId': 'run95-a01-aggregate-state-precedence-followup',
            'mcpBundleSha256': bundle_sha,
            'prNumber': GENERATOR.CODEX_A01_AGGREGATE_PR_NUMBER,
            'baseSha': base_sha,
            'observedAt': '2026-10-09T00:00:00.000Z',
            'mcpServerNames': ['bgk_a01_aggregate_one_tool'],
            'candidateGate': {
                'candidateSha': self.source_revision,
                'baseSha': base_sha,
                'ciSha': self.source_revision,
                'ciStatus': 'SUCCESS',
                'reviewPassSha': self.source_revision,
                'reviewVerdict': 'PASS',
                'reviewerId': 'gpt-6-luna-max-round1',
            },
            'queryArguments': arguments,
            'answerSha256': 'f' * 64,
            'answerUtf8Bytes': 128,
            'state': 'PASS',
        }
        report.update(overrides)
        self.report_path = self.live_probe_dir / 'pariya-agent-codex-luna-e2e-A01-aggregate.json'
        self.report_path.write_text(json.dumps(report, ensure_ascii=False), encoding='utf-8')
        return report

    def write_g02_report(self, tool_name='bangumi.query_subjects', **overrides):
        tool = next(item for item in self.catalog if item['name'] == tool_name)
        is_renderer = tool_name == 'bangumi.render_query_subjects'
        arguments = GENERATOR.CODEX_G02_PROBE_ARGUMENTS[tool_name]
        artifact = ({
            'returned': True, 'persisted': False, 'mimeType': 'image/png',
            'width': 720, 'height': 1200, 'byteLength': 128000,
            'sha256': 'c' * 64, 'pngSignatureValid': True,
        } if is_renderer else {'returned': False, 'persisted': False})
        result_state = 'artifact_returned' if is_renderer else 'ok'
        answer_checks = {
            key: True for key in (
                GENERATOR.CODEX_G02_RENDERER_ANSWER_CHECK_FIELDS if is_renderer
                else GENERATOR.CODEX_G02_QUERY_ANSWER_CHECK_FIELDS
            )
        }
        result_counters = (
            {'resultState': 'artifact_returned', 'artifactReturned': True}
            if is_renderer else {
                'resultState': 'ok',
                'coverageState': 'unknown',
                'totalKind': 'estimated',
                'requested': 10,
                'scanned': 20,
                'matched': 20,
                'returned': 2,
                'warningCodes': ['EXPERIMENTAL_SOURCE'],
                'sourceRowsValidated': 2,
                'answerRowsMatched': 2,
            }
        )
        report = {
            'schemaVersion': 1,
            'evidenceKind': 'codex_cli_mcp_tool_use',
            'sourceRevision': self.source_revision,
            'codexCliVersion': '0.162.0-alpha.2',
            'catalogSha256': hashlib.sha256(self.catalog_path.read_bytes()).hexdigest(),
            'profile': 'codex-luna-max-one-tool-v1',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'toolName': tool_name,
            'toolDescriptionSha256': self.sha256(tool['description']),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'argumentProfile': GENERATOR.CODEX_G02_ARGUMENT_PROFILES[tool_name],
            'expectedArgumentsSha256': GENERATOR._canonical_json_sha256(arguments),
            'serverToolNames': [tool_name],
            'serverToolCount': 1,
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'resultCount': 1,
            'eventStreamParsed': True,
            'codexMcpToolEventCount': 1,
            'nonMcpToolEventCount': 0,
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'qqPipelineTested': False,
            'timClientTested': False,
            'privacy': ({key: False for key in GENERATOR.CODEX_G02_PRIVACY_FIELDS}
                        | {'authProfile': 'anonymous'}),
            'scenarios': [{
                'id': tool_name,
                'passed': True,
                'exactArgumentsMatched': True,
                'oneToolAllowlistVerified': True,
                'resultReadbackVerified': True,
                'answerCheckPassed': True,
                'answerChecks': answer_checks,
                'toolCalls': [{'name': tool_name, 'state': 'DONE'}],
                'result': {
                    'toolName': tool_name,
                    'resultState': result_state,
                    'resultByteLength': 2048,
                    'resultSha256': 'd' * 64,
                    'sourceOperations': [],
                    'artifact': artifact,
                },
            }],
            'runNumber': 95,
            'frontierId': 'G02',
            'mcpBundleSha256': 'e' * 64,
            'prNumber': 117,
            'baseSha': 'b' * 40,
            'observedAt': '2026-10-09T00:00:00.000Z',
            'resultCounters': result_counters,
        }
        report.update(overrides)
        filename = ('pariya-agent-codex-luna-e2e-G02-render.json' if is_renderer
                    else 'pariya-agent-codex-luna-e2e-G02-query.json')
        self.report_path = self.live_probe_dir / filename
        self.report_path.write_text(json.dumps(report, ensure_ascii=False), encoding='utf-8')
        return report

    def write_c07_renderer_report(self):
        self.write_report(tool_name='bangumi.render_subject_cohort_comparison')
        report = json.loads(self.report_path.read_text(encoding='utf-8'))
        scenario = report['scenarios'][0]
        scenario['answerChecks'] = {
            key: True for key in GENERATOR.CODEX_C07_RENDERER_ANSWER_CHECK_FIELDS
        }
        scenario['result'].update({
            'resultState': 'artifact_returned',
            'resultByteLength': 180_000,
            'resultSha256': 'd' * 64,
            'sourceOperations': [],
            'artifact': {
                'returned': True,
                'persisted': False,
                'mimeType': 'image/png',
                'width': 720,
                'height': 1240,
                'byteLength': 180_000,
                'sha256': 'c' * 64,
                'pngSignatureValid': True,
            },
        })
        report.update({
            'frontierId': 'C07',
            'runNumber': 95,
            'epochId': GENERATOR.CODEX_C07_RENDERER_EPOCH_ID,
            'observedAt': '2026-10-12T12:00:00.000Z',
            'baseSha': 'b' * 40,
            'prNumber': GENERATOR.CODEX_C07_RENDERER_PR_NUMBER,
            'eventStreamComplete': True,
            'mcpBundleSha256': 'e' * 64,
            'mcpServerNames': ['bgk_c07_cohort_renderer_one_tool'],
            'candidateGate': {
                'candidateSha': self.source_revision,
                'baseSha': 'b' * 40,
                'ciSha': self.source_revision,
                'ciStatus': 'SUCCESS',
                'ciCheckCount': 7,
                'reviewPassSha': self.source_revision,
                'reviewVerdict': 'PASS',
                'reviewerId': 'gpt-6-luna-max-run95-pr144-round1',
            },
            'offlineFixture': {
                'profile': GENERATOR.CODEX_C07_RENDER_OFFLINE_FIXTURE_PROFILE,
                'localStubRequests': 4,
                'searchResponses': 2,
                'subjectDetailResponses': 2,
                'unexpectedRequests': 0,
                'authorizationHeaders': 0,
                'liveBangumiRequests': 0,
                'rawFixturePayloadStored': False,
            },
            'artifactValidation': {
                'decoded': True,
                'dimensionsMatch': True,
                'nonblankPixelSignalVerified': True,
            },
            'serverSummaryMatchesCandidate': True,
            'sameCandidateAfterCall': True,
        })
        self.report_path.write_text(json.dumps(report, ensure_ascii=False), encoding='utf-8')
        frontier_path = self.root / 'docs/product/frontier-ledger.json'
        frontier_path.parent.mkdir(parents=True, exist_ok=True)
        frontier_path.write_text(json.dumps({
            'records': [
                {'id': 'C07', 'status': 'UNASSESSED'},
                {'id': 'A01', 'status': 'UNASSESSED'},
            ],
        }), encoding='utf-8')
        return report

    def test_c07_probe_revision_requires_dynamic_active_epoch_binding(self):
        markers = GENERATOR.CODEX_C07_RENDERER_PROBE_IMPLEMENTATION_MARKERS[
            'scripts/acceptance/run-c07-cohort-renderer-codex-agent-mcp.mjs'
        ]
        self.assertIn('epoch.advances_frontier_ids.includes(FRONTIER_ID)', markers)
        self.assertIn('epochNumber !== activePrNumber', markers)
        self.assertIn("objective.includes('fixed local synthetic fixture')", markers)
        self.assertNotIn("acceptanceText.includes('offline fixture')", markers)
        self.assertNotIn('const PR_NUMBER = 140;', markers)

    def test_m07_matrix_cell_requires_exact_auth_denial_profile_and_write_policy(self):
        tool_name = GENERATOR.CODEX_M07_TOOL_NAME
        tool = {
            'name': tool_name,
            'auth': 'required',
            'risk': 'write',
            'description': 'Manage the current user index.',
            'inputSchema': {'type': 'object'},
        }
        report = {
            'toolName': tool_name,
            'argumentProfile': GENERATOR.CODEX_M07_ARGUMENT_PROFILE,
            'profileId': GENERATOR.CODEX_M07_PROFILE_ID,
            'acceptanceScope': 'agent-mcp-matrix-only',
        }
        with patch.object(GENERATOR, 'codex_m07_profile_report_is_valid', return_value=True):
            self.assertTrue(GENERATOR.codex_mcp_evidence_is_valid(
                report, {tool_name: tool}, {tool_name: tool},
            ))
            for invalid_tool in (
                {**tool, 'auth': 'none'},
                {**tool, 'risk': 'read'},
            ):
                self.assertFalse(GENERATOR.codex_mcp_evidence_is_valid(
                    report, {tool_name: invalid_tool}, {tool_name: invalid_tool},
                ))
            for invalid_report in (
                {**report, 'acceptanceScope': 'scenario-answer'},
                {**report, 'toolName': 'bangumi.auth_start'},
                {**report, 'profileId': 'other-profile'},
            ):
                self.assertFalse(GENERATOR.codex_mcp_evidence_is_valid(
                    invalid_report, {tool_name: tool}, {tool_name: tool},
                ))

    def test_m07_revision_markers_are_present_in_their_exact_source_files(self):
        for relative_path, markers in GENERATOR.CODEX_M07_PROFILE_IMPLEMENTATION_MARKERS.items():
            source = (self.original_root / relative_path).read_text(encoding='utf-8')
            for marker in markers:
                with self.subTest(path=relative_path, marker=marker):
                    self.assertIn(marker, source)

    def test_m07_report_requires_the_exact_harness_terminal_disposition(self):
        receipt = {'publicKeyBase64': 'synthetic-public-key', 'publicKeySha256': 'a' * 64}
        report = {
            'claimId': 'profile-run-95-pr177-0123456789ab-1792155200000',
            'profileId': GENERATOR.CODEX_M07_PROFILE_ID,
            'frontierId': 'M07',
            'epochId': GENERATOR.CODEX_M07_EPOCH_ID,
            'runNumber': 95,
            'prNumber': 177,
            'sourceRevision': '0' * 40,
            'baseSha': '1' * 40,
            'ciStatus': 'SUCCESS',
            'reviewerId': 'gpt-6-luna-max-run95-pr177-round1',
            'mcpBundleSha256': '2' * 64,
            'toolName': GENERATOR.CODEX_M07_TOOL_NAME,
            'argumentProfile': GENERATOR.CODEX_M07_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR.CODEX_M07_EXPECTED_ARGUMENTS_SHA256,
            'registrySha256': GENERATOR.CODEX_M07_PROFILE_REGISTRY_SHA256,
            'runnerReceipt': receipt,
        }
        report_sha256 = '3' * 64
        disposition = {
            'claimId': report['claimId'],
            'profileId': report['profileId'],
            'frontierId': 'M07',
            'epochId': report['epochId'],
            'runNumber': 95,
            'prNumber': 177,
            'state': 'REPORT_WRITTEN',
            'sourceCandidateSha': report['sourceRevision'],
            'baseSha': report['baseSha'],
            'ciSha': report['sourceRevision'],
            'ciStatus': 'SUCCESS',
            'reviewerId': report['reviewerId'],
            'bundleSha256': report['mcpBundleSha256'],
            'registrySha256': report['registrySha256'],
            'toolName': report['toolName'],
            'argumentProfile': report['argumentProfile'],
            'expectedArgumentsSha256': report['expectedArgumentsSha256'],
            'reportWritten': True,
            'reportPath': GENERATOR.CODEX_M07_REPORT_RELATIVE_PATH,
            'reportSha256': report_sha256,
            'retryAllowed': False,
            'runnerReceiptPublicKey': receipt['publicKeyBase64'],
            'runnerReceiptPublicKeySha256': receipt['publicKeySha256'],
            'runnerReceiptSha256': GENERATOR._canonical_json_sha256(receipt),
        }
        status = {
            'state': 'REPORT_WRITTEN',
            'profile_id': report['profileId'],
            'pr': report['prNumber'],
            'tool_name': report['toolName'],
            'argument_profile': report['argumentProfile'],
            'expected_arguments_sha256': report['expectedArgumentsSha256'],
            'registry_sha256': report['registrySha256'],
            'claim_label_present': True,
            'terminal_label_present': True,
            'disposition': disposition,
        }
        self.assertIsNotNone(GENERATOR.codex_m07_profile_disposition_matches_report(
            report, status, report_sha256,
        ))
        wrong_sha = dict(status, disposition={**disposition, 'reportSha256': 'f' * 64})
        self.assertIsNone(GENERATOR.codex_m07_profile_disposition_matches_report(
            report, wrong_sha, report_sha256,
        ))
        inconclusive = dict(status, state='INCONCLUSIVE')
        self.assertIsNone(GENERATOR.codex_m07_profile_disposition_matches_report(
            report, inconclusive, report_sha256,
        ))

    def test_m07_report_candidate_refresh_is_limited_to_report_matrix_and_frontier(self):
        report = {
            'prNumber': 177,
            'sourceRevision': '0' * 40,
            'baseSha': '1' * 40,
            'reviewerId': 'gpt-6-luna-max-run95-pr177-round1',
            'mcpBundleSha256': 'c' * 64,
        }
        epoch_status = {
            'run': {
                'number': 95,
                'state': {'state': 'EPOCH_ACTIVE', 'active_epoch_pr': 177},
            },
            'epoch': {
                'github_state': 'OPEN',
                'state': {
                    'epoch_id': GENERATOR.CODEX_M07_EPOCH_ID,
                    'pr_number': 177,
                    'base_branch': 'master',
                    'base_sha': report['baseSha'],
                    'reviewed_base_sha': report['baseSha'],
                    'candidate_sha': '2' * 40,
                    'branch': 'codex/m07-profile',
                    'review_history': [{
                        'candidate_sha': report['sourceRevision'],
                        'reviewed_base_sha': report['baseSha'],
                        'reviewer_id': report['reviewerId'],
                        'verdict': 'PASS',
                    }],
                },
                'pr_base_ref_name': 'master',
                'pr_base_sha': report['baseSha'],
                'pr_head_ref_name': 'codex/m07-profile',
                'pr_is_draft': False,
                'pr_head_sha': '2' * 40,
            },
        }
        allowed_paths = {
            GENERATOR.CODEX_M07_REPORT_RELATIVE_PATH,
            'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
            'docs/product/frontier-ledger.json',
        }
        with (
            patch.object(
                GENERATOR, '_codex_p02_profile_report_candidate_paths',
                return_value=allowed_paths,
            ),
            patch.object(GENERATOR, 'codex_g26_candidate_bundle_sha256', return_value='c' * 64),
        ):
            self.assertTrue(GENERATOR.codex_m07_profile_candidate_binding_is_current(
                report, epoch_status, 'c' * 64,
            ))
            self.assertFalse(GENERATOR.codex_m07_profile_candidate_binding_is_current(
                report, epoch_status, 'd' * 64,
            ))
            disallowed_paths = allowed_paths | {'scripts/agent-harness.mjs'}
            with patch.object(
                GENERATOR, '_codex_p02_profile_report_candidate_paths',
                return_value=disallowed_paths,
            ):
                self.assertFalse(GENERATOR.codex_m07_profile_candidate_binding_is_current(
                    report, epoch_status, 'c' * 64,
                ))

    def test_m07_matrix_report_requires_an_unassessed_frontier_record(self):
        frontier_path = self.root / 'docs/product/frontier-ledger.json'
        frontier_path.parent.mkdir(parents=True, exist_ok=True)
        source_refs = [
            GENERATOR.CODEX_M07_SELECTION_EVIDENCE_RELATIVE_PATH,
            GENERATOR.CODEX_M07_REPORT_RELATIVE_PATH,
        ]
        frontier = {'records': [{'id': 'M07', 'status': 'UNASSESSED', 'source_refs': source_refs}]}
        frontier_path.write_text(json.dumps(frontier), encoding='utf-8')
        with patch.object(GENERATOR, 'ROOT', self.root):
            self.assertTrue(GENERATOR.codex_m07_frontier_is_unassessed())
            promoted = json.loads(json.dumps(frontier))
            promoted['records'][0]['status'] = 'PARTIAL'
            frontier_path.write_text(json.dumps(promoted), encoding='utf-8')
            self.assertFalse(GENERATOR.codex_m07_frontier_is_unassessed())
            missing_report = json.loads(json.dumps(frontier))
            missing_report['records'][0]['source_refs'].remove(
                GENERATOR.CODEX_M07_REPORT_RELATIVE_PATH,
            )
            frontier_path.write_text(json.dumps(missing_report), encoding='utf-8')
            self.assertFalse(GENERATOR.codex_m07_frontier_is_unassessed())

    def test_auth_start_matrix_cell_requires_exact_profile_and_anonymous_read_policy(self):
        tool_name = GENERATOR.CODEX_AUTH_START_TOOL_NAME
        tool = {
            'name': tool_name,
            'auth': 'none',
            'risk': 'read',
            'description': 'Create a Bangumi OAuth URL.',
            'inputSchema': {'type': 'object'},
        }
        report = {
            'toolName': tool_name,
            'argumentProfile': GENERATOR.CODEX_AUTH_START_ARGUMENT_PROFILE,
            'profileId': GENERATOR.CODEX_AUTH_START_PROFILE_ID,
            'acceptanceScope': 'agent-mcp-matrix-only',
        }
        with patch.object(GENERATOR, 'codex_auth_start_profile_report_is_valid', return_value=True):
            self.assertTrue(GENERATOR.codex_mcp_evidence_is_valid(
                report, {tool_name: tool}, {tool_name: tool},
            ))
            for invalid_tool in (
                {**tool, 'auth': 'required'},
                {**tool, 'risk': 'write'},
            ):
                self.assertFalse(GENERATOR.codex_mcp_evidence_is_valid(
                    report, {tool_name: invalid_tool}, {tool_name: invalid_tool},
                ))
            for invalid_report in (
                {**report, 'acceptanceScope': 'oauth-account'},
                {**report, 'argumentProfile': 'different-input'},
                {**report, 'profileId': 'another-profile'},
            ):
                self.assertFalse(GENERATOR.codex_mcp_evidence_is_valid(
                    invalid_report, {tool_name: tool}, {tool_name: tool},
                ))

    def test_auth_start_profile_disposition_requires_exact_report_written_claim(self):
        receipt = {'publicKeyBase64': 'synthetic-public-key', 'publicKeySha256': 'a' * 64}
        report = {
            'claimId': 'profile-run-95-pr999-0123456789ab-1792320000000',
            'profileId': GENERATOR.CODEX_AUTH_START_PROFILE_ID,
            'frontierId': 'OP-009',
            'epochId': GENERATOR.CODEX_AUTH_START_EPOCH_ID,
            'runNumber': 95,
            'prNumber': 999,
            'sourceRevision': '0' * 40,
            'baseSha': '1' * 40,
            'ciStatus': 'SUCCESS',
            'reviewerId': 'gpt-6-luna-max-run95-pr999-round1',
            'mcpBundleSha256': '2' * 64,
            'toolName': GENERATOR.CODEX_AUTH_START_TOOL_NAME,
            'argumentProfile': GENERATOR.CODEX_AUTH_START_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR.CODEX_AUTH_START_EXPECTED_ARGUMENTS_SHA256,
            'registrySha256': GENERATOR.CODEX_AUTH_START_PROFILE_REGISTRY_SHA256,
            'runnerReceipt': receipt,
        }
        report_sha256 = '3' * 64
        disposition = {
            'claimId': report['claimId'],
            'profileId': report['profileId'],
            'frontierId': report['frontierId'],
            'epochId': report['epochId'],
            'runNumber': 95,
            'prNumber': report['prNumber'],
            'state': 'REPORT_WRITTEN',
            'sourceCandidateSha': report['sourceRevision'],
            'baseSha': report['baseSha'],
            'ciSha': report['sourceRevision'],
            'ciStatus': 'SUCCESS',
            'reviewerId': report['reviewerId'],
            'bundleSha256': report['mcpBundleSha256'],
            'registrySha256': report['registrySha256'],
            'toolName': report['toolName'],
            'argumentProfile': report['argumentProfile'],
            'expectedArgumentsSha256': report['expectedArgumentsSha256'],
            'reportWritten': True,
            'reportPath': GENERATOR.CODEX_AUTH_START_REPORT_RELATIVE_PATH,
            'reportSha256': report_sha256,
            'retryAllowed': False,
            'runnerReceiptPublicKey': receipt['publicKeyBase64'],
            'runnerReceiptPublicKeySha256': receipt['publicKeySha256'],
            'runnerReceiptSha256': GENERATOR._canonical_json_sha256(receipt),
        }
        status = {
            'state': 'REPORT_WRITTEN',
            'profile_id': report['profileId'],
            'pr': report['prNumber'],
            'tool_name': report['toolName'],
            'argument_profile': report['argumentProfile'],
            'expected_arguments_sha256': report['expectedArgumentsSha256'],
            'registry_sha256': report['registrySha256'],
            'claim_label_present': True,
            'terminal_label_present': True,
            'disposition': disposition,
        }
        self.assertIsNotNone(GENERATOR.codex_auth_start_profile_disposition_matches_report(
            report, status, report_sha256,
        ))
        self.assertIsNone(GENERATOR.codex_auth_start_profile_disposition_matches_report(
            report, dict(status, state='INCONCLUSIVE'), report_sha256,
        ))
        self.assertIsNone(GENERATOR.codex_auth_start_profile_disposition_matches_report(
            report, dict(status, claim_label_present=False), report_sha256,
        ))

    def test_auth_start_frontier_stays_partial_and_requires_both_contract_and_report(self):
        frontier_path = self.root / 'docs/product/frontier-ledger.json'
        frontier_path.parent.mkdir(parents=True, exist_ok=True)
        refs = [
            GENERATOR.CODEX_AUTH_START_SELECTION_EVIDENCE_RELATIVE_PATH,
            GENERATOR.CODEX_AUTH_START_REPORT_RELATIVE_PATH,
        ]
        frontier = {'records': [{'id': 'OP-009', 'status': 'PARTIAL', 'source_refs': refs}]}
        frontier_path.write_text(json.dumps(frontier), encoding='utf-8')
        with patch.object(GENERATOR, 'ROOT', self.root):
            self.assertTrue(GENERATOR.codex_auth_start_frontier_is_partial())
            complete = json.loads(json.dumps(frontier))
            complete['records'][0]['status'] = 'DELIVERED'
            frontier_path.write_text(json.dumps(complete), encoding='utf-8')
            self.assertFalse(GENERATOR.codex_auth_start_frontier_is_partial())
            missing_report = json.loads(json.dumps(frontier))
            missing_report['records'][0]['source_refs'].remove(
                GENERATOR.CODEX_AUTH_START_REPORT_RELATIVE_PATH,
            )
            frontier_path.write_text(json.dumps(missing_report), encoding='utf-8')
            self.assertFalse(GENERATOR.codex_auth_start_frontier_is_partial())

    def test_auth_start_profile_report_dispatch_adds_only_the_auth_start_matrix_row(self):
        tool_name = GENERATOR.CODEX_AUTH_START_TOOL_NAME
        tool = {
            'name': tool_name,
            'auth': 'none',
            'risk': 'read',
            'description': 'Generate an OAuth URL without accessing account data.',
            'inputSchema': {'type': 'object', 'properties': {'capabilities': {'type': 'array'}}},
        }
        catalog = [tool]
        catalog_bytes = json.dumps(catalog, ensure_ascii=False).encode('utf-8')
        catalog_path = self.root / 'docs/tool-catalog.json'
        catalog_path.parent.mkdir(parents=True, exist_ok=True)
        catalog_path.write_bytes(catalog_bytes)
        report = {
            'evidenceKind': GENERATOR.CODEX_AUTH_START_EVIDENCE_KIND,
            'profileId': GENERATOR.CODEX_AUTH_START_PROFILE_ID,
            'toolName': tool_name,
            'argumentProfile': GENERATOR.CODEX_AUTH_START_ARGUMENT_PROFILE,
            'acceptanceScope': 'agent-mcp-matrix-only',
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'prNumber': 999,
        }
        report_path = self.live_probe_dir / Path(GENERATOR.CODEX_AUTH_START_REPORT_RELATIVE_PATH).name
        report_path.write_text(json.dumps(report), encoding='utf-8')
        current_by_name = {tool_name: tool}
        with (
            patch.object(GENERATOR, 'ROOT', self.root),
            patch.object(GENERATOR, 'CATALOG', catalog_path),
            patch.object(GENERATOR, 'LIVE_PROBE_DIR', self.live_probe_dir),
            patch.object(GENERATOR, 'codex_auth_start_profile_harness_status', return_value={}),
            patch.object(GENERATOR, 'codex_auth_start_profile_epoch_harness_status', return_value={}),
            patch.object(GENERATOR, 'codex_auth_start_profile_report_is_valid', return_value=True),
        ):
            sources = GENERATOR.model_mcp_e2e_sources(catalog)
        self.assertEqual(set(sources), {tool_name})
        self.assertEqual(len(sources[tool_name]), 1)

    def test_accepts_only_bounded_renderer_report_without_changing_frontier_status(self):
        report = self.write_c07_renderer_report()
        current_by_name = {item['name']: item for item in self.catalog}
        self.assertTrue(
            GENERATOR.codex_c07_renderer_probe_revision_has_implementation(self.source_revision),
        )
        self.assertTrue(GENERATOR.codex_mcp_evidence_is_valid(
            report, current_by_name, current_by_name,
        ))

        output_file_completion = json.loads(json.dumps(report))
        output_file_completion['eventStreamComplete'] = False
        self.assertTrue(GENERATOR.codex_mcp_evidence_is_valid(
            output_file_completion, current_by_name, current_by_name,
        ))
        unverified_output_file = json.loads(json.dumps(output_file_completion))
        unverified_output_file['scenarios'][0]['answerChecks']['cliFinalMessageVerified'] = False
        self.assertFalse(GENERATOR.codex_mcp_evidence_is_valid(
            unverified_output_file, current_by_name, current_by_name,
        ))

        invalid_reports = []
        invalid_fixture = json.loads(json.dumps(report))
        invalid_fixture['offlineFixture']['liveBangumiRequests'] = 1
        invalid_reports.append(invalid_fixture)
        persisted_artifact = json.loads(json.dumps(report))
        persisted_artifact['scenarios'][0]['result']['artifact']['persisted'] = True
        invalid_reports.append(persisted_artifact)
        changed_candidate = json.loads(json.dumps(report))
        changed_candidate['candidateGate']['reviewPassSha'] = 'f' * 40
        invalid_reports.append(changed_candidate)
        bad_renderability = json.loads(json.dumps(report))
        bad_renderability['artifactValidation']['nonblankPixelSignalVerified'] = False
        invalid_reports.append(bad_renderability)
        wrong_epoch = json.loads(json.dumps(report))
        wrong_epoch['epochId'] = 'another-epoch'
        invalid_reports.append(wrong_epoch)
        wrong_pr = json.loads(json.dumps(report))
        wrong_pr['prNumber'] = 150
        invalid_reports.append(wrong_pr)
        mismatched_base_gate = json.loads(json.dumps(report))
        mismatched_base_gate['candidateGate']['baseSha'] = 'd' * 40
        invalid_reports.append(mismatched_base_gate)
        retired_pr_140 = json.loads(json.dumps(report))
        retired_pr_140['epochId'] = 'run95-c07-cohort-comparison-renderer-luna-mcp'
        retired_pr_140['prNumber'] = 140
        retired_pr_140['candidateGate']['reviewerId'] = 'gpt-6-luna-max-run95-pr140-round1'
        invalid_reports.append(retired_pr_140)
        for invalid in invalid_reports:
            self.assertFalse(GENERATOR.codex_mcp_evidence_is_valid(
                invalid, current_by_name, current_by_name,
            ))

        frontier_path = self.root / 'docs/product/frontier-ledger.json'
        frontier = json.loads(frontier_path.read_text(encoding='utf-8'))
        frontier['records'][0]['status'] = 'PARTIAL'
        frontier_path.write_text(json.dumps(frontier), encoding='utf-8')
        self.assertFalse(GENERATOR.codex_mcp_evidence_is_valid(
            report, current_by_name, current_by_name,
        ))

    def test_accepts_both_exact_catalog_bound_luna_max_one_tool_reports(self):
        self.write_report()
        stats_bytes = self.report_path.read_bytes()
        self.write_report(tool_name='bangumi.render_subject_stats_intelligence')
        stats_path = self.live_probe_dir / 'pariya-agent-codex-luna-e2e-G23-stats.json'
        stats_path.write_bytes(stats_bytes)
        self.assertEqual(
            GENERATOR.model_mcp_e2e_sources(self.catalog),
            {
                'bangumi.get_subject_stats_intelligence': {
                    'docs/live-probes/pariya-agent-codex-luna-e2e-G23-stats.json'
                },
                'bangumi.render_subject_stats_intelligence': {
                    'docs/live-probes/pariya-agent-codex-luna-e2e-G23.json'
                },
            },
        )

    def test_accepts_catalog_bound_sanitized_d04_query_report(self):
        self.report_path = self.live_probe_dir / 'pariya-agent-codex-luna-e2e-D04-run95.json'
        self.write_report(tool_name='bangumi.query_subjects')
        report = json.loads(self.report_path.read_text(encoding='utf-8'))
        self.assertTrue(GENERATOR.codex_d04_probe_revision_has_implementation(self.source_revision))
        self.assertTrue(GENERATOR.codex_mcp_evidence_is_valid(
            report,
            {item['name']: item for item in self.catalog},
            {item['name']: item for item in self.catalog},
        ))
        self.assertEqual(
            GENERATOR.model_mcp_e2e_sources(self.catalog)['bangumi.query_subjects'],
            {'docs/live-probes/pariya-agent-codex-luna-e2e-D04-run95.json'},
        )
        self.assertNotIn('answer', report)
        self.assertNotIn('prompt', report)
        self.assertNotIn('structuredContent', report['scenarios'][0]['result'])

    def test_accepts_sanitized_distinct_a01_aggregate_tool_report(self):
        report = self.write_a01_aggregate_report()
        self.assertTrue(GENERATOR.codex_a01_aggregate_probe_revision_has_implementation(
            self.source_revision,
        ))
        self.assertTrue(GENERATOR.codex_mcp_evidence_is_valid(
            report,
            {item['name']: item for item in self.catalog},
            {item['name']: item for item in self.catalog},
        ))
        self.assertFalse(GENERATOR.codex_a01_aggregate_report_matches_candidate_revision(
            self.report_path,
            self.source_revision,
        ))
        self._git('add', self.report_path.relative_to(self.root).as_posix())
        self._git('commit', '-qm', 'add exact-Candidate A01 aggregate report')
        self.assertTrue(GENERATOR.codex_a01_aggregate_report_matches_candidate_revision(
            self.report_path,
            self.source_revision,
        ))
        self.assertEqual(
            GENERATOR.model_mcp_e2e_sources(self.catalog)['bangumi.aggregate_subject_cohort'],
            {'docs/live-probes/pariya-agent-codex-luna-e2e-A01-aggregate.json'},
        )
        self.assertNotIn('answer', report)
        self.assertNotIn('prompt', report)
        self.assertNotIn('structuredContent', report['scenarios'][0]['result'])

    def test_rejects_a01_aggregate_report_with_expanded_scope_or_stale_gate(self):
        invalid = [
            {'prNumber': GENERATOR.CODEX_A01_AGGREGATE_PR_NUMBER + 3},
            {'queryArguments': {
                'cohort': {'query': {'media': 'anime', 'year': 2013, 'resultMode': 'all'}},
                'maxSubjects': 1,
            }},
            {'candidateGate': {
                'candidateSha': self.source_revision,
                'baseSha': 'b' * 40,
                'ciSha': self.source_revision,
                'ciStatus': 'SUCCESS',
                'reviewPassSha': 'c' * 40,
                'reviewVerdict': 'PASS',
                'reviewerId': 'gpt-6-luna-max-round1',
            }},
            {'mcpServerNames': ['bgk_a01_aggregate_one_tool', 'other-server']},
        ]
        for override in invalid:
            with self.subTest(override=override):
                report = self.write_a01_aggregate_report(**override)
                self.assertFalse(GENERATOR.codex_mcp_evidence_is_valid(
                    report,
                    {item['name']: item for item in self.catalog},
                    {item['name']: item for item in self.catalog},
                ))

        report = self.write_a01_aggregate_report()
        report['scenarios'][0]['result']['summary']['coverage']['totalSubjectsReturned'] = 2
        self.assertFalse(GENERATOR.codex_mcp_evidence_is_valid(
            report,
            {item['name']: item for item in self.catalog},
            {item['name']: item for item in self.catalog},
        ))

    def test_rejects_a01_aggregate_report_bound_to_an_older_candidate(self):
        report = self.write_a01_aggregate_report()
        stale_revision = self.stale_candidate_source_revision
        stale_base = self._git('rev-parse', f'{stale_revision}^').stdout.strip()
        report['sourceRevision'] = stale_revision
        report['baseSha'] = stale_base
        report['candidateGate'].update({
            'candidateSha': stale_revision,
            'baseSha': stale_base,
            'ciSha': stale_revision,
            'reviewPassSha': stale_revision,
        })
        self.report_path.write_text(json.dumps(report, ensure_ascii=False), encoding='utf-8')
        self.assertTrue(GENERATOR.codex_mcp_evidence_is_valid(
            report,
            {item['name']: item for item in self.catalog},
            {item['name']: item for item in self.catalog},
        ))
        self._git('add', self.report_path.relative_to(self.root).as_posix())
        self._git('commit', '-qm', 'add aggregate report with stale Candidate metadata')
        self.assertNotIn(
            'bangumi.aggregate_subject_cohort',
            GENERATOR.model_mcp_e2e_sources(self.catalog),
        )

    def test_rejects_a01_aggregate_report_changed_after_commit(self):
        report = self.write_a01_aggregate_report()
        self._git('add', self.report_path.relative_to(self.root).as_posix())
        self._git('commit', '-qm', 'add exact-Candidate A01 aggregate report')
        self.assertTrue(GENERATOR.codex_a01_aggregate_report_matches_candidate_revision(
            self.report_path,
            self.source_revision,
        ))
        self.report_path.write_text(
            self.report_path.read_text(encoding='utf-8') + ' ',
            encoding='utf-8',
        )
        self.assertFalse(GENERATOR.codex_a01_aggregate_report_matches_candidate_revision(
            self.report_path,
            self.source_revision,
        ))
        self.assertNotIn(
            'bangumi.aggregate_subject_cohort',
            GENERATOR.model_mcp_e2e_sources(self.catalog),
        )

        rewritten = self.write_a01_aggregate_report()
        rewritten['scenarios'][0]['result']['summary']['query']['scanned'] = 21
        self.report_path.write_text(json.dumps(rewritten, ensure_ascii=False), encoding='utf-8')
        self._git('add', self.report_path.relative_to(self.root).as_posix())
        self._git('commit', '-qm', 'rewrite committed aggregate report')
        self.assertFalse(GENERATOR.codex_a01_aggregate_report_matches_candidate_revision(
            self.report_path,
            self.source_revision,
        ))
        self.assertNotIn(
            'bangumi.aggregate_subject_cohort',
            GENERATOR.model_mcp_e2e_sources(self.catalog),
        )

    def test_rejects_inconsistent_a01_aggregate_sanitized_summary(self):
        def make_metric_complete(report):
            report['scenarios'][0]['result']['summary']['metrics'][0]['state'] = 'complete'

        def make_overall_complete(report):
            result = report['scenarios'][0]['result']
            result['resultState'] = 'complete'
            result['summary']['state'] = 'complete'

        def make_budget_exceeded_untruncated(report):
            summary = report['scenarios'][0]['result']['summary']
            summary['query']['budgetExceeded'] = True
            summary['coverage']['cohortsComplete'] = 1
            summary['coverage']['cohortsPartial'] = 0
            summary['coverage']['truncated'] = False

        def make_complete_with_budget_and_output_truncation(report):
            result = report['scenarios'][0]['result']
            summary = result['summary']
            result['resultState'] = 'complete'
            summary['state'] = 'complete'
            summary['query'].update({
                'state': 'ok',
                'scanned': 20,
                'matched': 20,
                'returned': 1,
                'budgetExceeded': True,
                'upstreamExhausted': False,
            })
            summary['coverage'].update({
                'cohortsComplete': 1,
                'cohortsPartial': 0,
                'truncated': True,
            })
            for metric in summary['metrics']:
                metric['state'] = 'complete'

        def make_complete_with_output_truncation(report):
            result = report['scenarios'][0]['result']
            summary = result['summary']
            result['resultState'] = 'complete'
            summary['state'] = 'complete'
            summary['query'].update({
                'state': 'ok',
                'scanned': 20,
                'matched': 1,
                'returned': 1,
                'budgetExceeded': False,
                'upstreamExhausted': True,
            })
            summary['coverage'].update({
                'cohortsComplete': 1,
                'cohortsPartial': 0,
                'truncated': True,
            })
            for metric in summary['metrics']:
                metric['state'] = 'complete'

        def make_partial_query_with_complete_coverage(report):
            summary = report['scenarios'][0]['result']['summary']
            summary['query'].update({
                'state': 'partial',
                'scanned': 20,
                'matched': 1,
                'returned': 1,
                'budgetExceeded': False,
                'upstreamExhausted': True,
            })
            summary['coverage'].update({
                'cohortsComplete': 1,
                'cohortsPartial': 0,
                'truncated': False,
            })

        def make_partial_coverage_all_not_computable(report):
            result = report['scenarios'][0]['result']
            summary = result['summary']
            result['resultState'] = 'not_computable'
            summary['state'] = 'not_computable'
            for metric in summary['metrics']:
                metric.update({
                    'state': 'not_computable',
                    'value': None,
                    'valid': 0,
                    'partial': 0,
                    'missing': 0,
                    'conflicts': 0,
                    'notComputable': 1,
                })

        def make_answer_byte_count_unbounded(report):
            report['answerUtf8Bytes'] = 64_001

        invalid_summaries = [
            make_metric_complete,
            make_overall_complete,
            make_budget_exceeded_untruncated,
            make_complete_with_budget_and_output_truncation,
            make_complete_with_output_truncation,
            make_partial_query_with_complete_coverage,
            make_partial_coverage_all_not_computable,
            lambda report: report['scenarios'][0]['result']['summary']['query'].update(
                {'returned': 0},
            ),
            lambda report: report['scenarios'][0]['result']['summary']['query'].update(
                {'state': 'not_found'},
            ),
            lambda report: report['scenarios'][0]['result']['summary']['coverage'].update({
                'detailHydrationsSucceeded': 0,
            }),
            make_answer_byte_count_unbounded,
        ]
        for mutate in invalid_summaries:
            with self.subTest(mutate=mutate):
                report = self.write_a01_aggregate_report()
                mutate(report)
                self.assertFalse(GENERATOR.codex_mcp_evidence_is_valid(
                    report,
                    {item['name']: item for item in self.catalog},
                    {item['name']: item for item in self.catalog},
                ))

    def test_a01_aggregate_preserves_terminal_errors_and_conflicts_over_partial_coverage(self):
        terminal_states = (
            'upstream_error', 'auth_required', 'permission_denied',
            'unavailable', 'unsupported', 'stale',
        )
        for state in terminal_states:
            with self.subTest(state=state):
                report = self.write_a01_aggregate_report()
                result = report['scenarios'][0]['result']
                summary = result['summary']
                result['resultState'] = state
                summary['state'] = state
                summary['query'].update({
                    'state': state,
                    'scanned': 0,
                    'matched': 0,
                    'returned': 0,
                    'totalKind': 'unknown',
                    'budgetExceeded': False,
                    'upstreamExhausted': False,
                })
                summary['coverage'].update({
                    'totalSubjectsReturned': 0,
                    'cohortsComplete': 0,
                    'cohortsPartial': 1,
                    'detailHydrationsAttempted': 0,
                    'detailHydrationsSucceeded': 0,
                    'detailHydrationsFailed': 0,
                    'truncated': True,
                })
                for metric in summary['metrics']:
                    metric.update({
                        'state': state,
                        'value': None,
                        'valid': 0,
                        'partial': 0,
                        'missing': 0,
                        'conflicts': 0,
                        'notComputable': 0,
                    })

                self.assertTrue(GENERATOR.codex_a01_aggregate_result_is_valid(result))

        report = self.write_a01_aggregate_report()
        result = report['scenarios'][0]['result']
        summary = result['summary']
        result['resultState'] = 'conflict'
        summary['state'] = 'conflict'
        for metric in summary['metrics']:
            metric.update({
                'state': 'not_computable',
                'value': None,
                'valid': 0,
                'partial': 0,
                'missing': 0,
                'conflicts': 0,
                'notComputable': 1,
            })
        summary['metrics'][0].update({
            'state': 'conflict',
            'conflicts': 1,
            'notComputable': 0,
        })

        self.assertTrue(GENERATOR.codex_a01_aggregate_result_is_valid(result))

    def test_accepts_current_catalog_g02_reports_and_codex_prerelease_version(self):
        query_report = self.write_g02_report()
        self.assertTrue(GENERATOR.codex_g02_probe_revision_has_implementation(self.source_revision))
        self.assertTrue(GENERATOR.codex_mcp_evidence_is_valid(
            query_report,
            {item['name']: item for item in self.catalog},
            {item['name']: item for item in self.catalog},
        ))
        query_path = self.report_path
        self.write_g02_report(tool_name='bangumi.render_query_subjects')
        render_path = self.report_path
        self.assertTrue(GENERATOR.codex_mcp_evidence_is_valid(
            json.loads(render_path.read_text(encoding='utf-8')),
            {item['name']: item for item in self.catalog},
            {item['name']: item for item in self.catalog},
        ))
        self.assertEqual(
            GENERATOR.model_mcp_e2e_sources(self.catalog),
            {
                'bangumi.query_subjects': {query_path.relative_to(self.root).as_posix()},
                'bangumi.render_query_subjects': {render_path.relative_to(self.root).as_posix()},
            },
        )
        for report_path in (query_path, render_path):
            report = json.loads(report_path.read_text(encoding='utf-8'))
            self.assertNotIn('answer', report)
            self.assertNotIn('prompt', report)
            self.assertNotIn('structuredContent', report['scenarios'][0]['result'])
        self._git('add', query_path.relative_to(self.root).as_posix(),
                  render_path.relative_to(self.root).as_posix())
        self._git('commit', '-qm', 'add sanitized current-catalog G02 reports')
        self.assertTrue(GENERATOR.codex_g02_report_matches_candidate_revision(
            query_path, self.source_revision,
        ))
        self.assertEqual(set(GENERATOR.model_mcp_e2e_sources(self.catalog)), {
            'bangumi.query_subjects', 'bangumi.render_query_subjects',
        })

    def test_rejects_g02_report_from_an_older_candidate_with_same_probe_implementation(self):
        report = self.write_g02_report(sourceRevision=self.stale_candidate_source_revision)
        self.assertTrue(GENERATOR.codex_g02_probe_revision_has_implementation(
            self.stale_candidate_source_revision,
        ))
        self.assertFalse(GENERATOR.codex_g02_report_matches_candidate_revision(
            self.report_path, self.stale_candidate_source_revision,
        ))
        self.assertTrue(GENERATOR.codex_mcp_evidence_is_valid(
            report,
            {item['name']: item for item in self.catalog},
            {item['name']: item for item in self.catalog},
        ))
        self.assertNotIn('bangumi.query_subjects', GENERATOR.model_mcp_e2e_names(self.catalog))

    def test_rejects_g02_complete_or_global_coverage_and_bad_artifact_claims(self):
        invalid_query = [
            {'argumentProfile': 'd04-reported-episode-count-discovery-v1'},
            {'expectedArgumentsSha256': 'f' * 64},
            {'resultCounters': {
                'resultState': 'ok', 'coverageState': 'unknown', 'totalKind': 'estimated',
                'scanned': 20, 'matched': 20, 'returned': 2,
                'warningCodes': ['EXPERIMENTAL_SOURCE'], 'sourceRowsValidated': 2,
                'answerRowsMatched': 2,
            }},
            {'resultCounters': {
                'resultState': 'ok', 'coverageState': 'complete', 'totalKind': 'exact',
                'requested': 10, 'scanned': 20, 'matched': 20, 'returned': 2,
                'warningCodes': ['EXPERIMENTAL_SOURCE'], 'sourceRowsValidated': 2,
                'answerRowsMatched': 2,
            }},
            {'resultCounters': {
                'resultState': 'ok', 'coverageState': 'unknown', 'totalKind': 'estimated',
                'requested': 10, 'scanned': 20, 'matched': 20, 'returned': 2,
                'warningCodes': [], 'sourceRowsValidated': 2, 'answerRowsMatched': 2,
            }},
            {'resultCounters': {
                'resultState': 'ok', 'coverageState': 'unknown', 'totalKind': 'estimated',
                'requested': 10, 'scanned': 20, 'matched': 20, 'returned': 2,
                'warningCodes': ['PRIVATE_TITLE_IN_SOURCE', 'EXPERIMENTAL_SOURCE'],
                'sourceRowsValidated': 2, 'answerRowsMatched': 2,
            }},
            {'resultCounters': {
                'resultState': 'ok', 'coverageState': 'unknown', 'totalKind': 'estimated',
                'requested': 10, 'scanned': 20, 'matched': 20, 'returned': 2,
                'warningCodes': [
                    'EXPERIMENTAL_SOURCE',
                    *sorted(GENERATOR.CODEX_G02_WARNING_CODES - {'EXPERIMENTAL_SOURCE'})[:20],
                ],
                'sourceRowsValidated': 2, 'answerRowsMatched': 2,
            }},
            {'resultCounters': {
                'resultState': 'ok', 'coverageState': 'unknown', 'totalKind': 'estimated',
                'requested': 10, 'scanned': 501, 'matched': 501, 'returned': 2,
                'warningCodes': ['EXPERIMENTAL_SOURCE'],
                'sourceRowsValidated': 2, 'answerRowsMatched': 2,
            }},
            {'resultCounters': {
                'resultState': 'ok', 'coverageState': 'unknown', 'totalKind': 'estimated',
                'requested': 10, 'scanned': 20, 'matched': 21, 'returned': 2,
                'warningCodes': ['EXPERIMENTAL_SOURCE'],
                'sourceRowsValidated': 2, 'answerRowsMatched': 2,
            }},
        ]
        for override in invalid_query:
            with self.subTest(override=override):
                report = self.write_g02_report(**override)
                self.assertFalse(GENERATOR.codex_mcp_evidence_is_valid(
                    report,
                    {item['name']: item for item in self.catalog},
                    {item['name']: item for item in self.catalog},
                ))

        report = self.write_g02_report(tool_name='bangumi.render_query_subjects')
        report['scenarios'][0]['result']['artifact']['persisted'] = True
        self.assertFalse(GENERATOR.codex_mcp_evidence_is_valid(
            report,
            {item['name']: item for item in self.catalog},
            {item['name']: item for item in self.catalog},
        ))

    def test_rejects_d04_report_with_unknown_coverage_or_changed_query_summary(self):
        self.report_path = self.live_probe_dir / 'pariya-agent-codex-luna-e2e-D04-run95.json'
        invalid = [
            {'coverage': {'coverageState': 'unknown'}},
            {'warningCodes': []},
            {'mcpBundleSha256': 'z' * 64},
            {'prNumber': 0},
        ]
        for override in invalid:
            with self.subTest(override=override):
                self.write_report(tool_name='bangumi.query_subjects', **override)
                self.assertNotIn('bangumi.query_subjects', GENERATOR.model_mcp_e2e_names(self.catalog))

    def test_accepts_catalog_bound_g20_report_with_verified_visible_rows_only(self):
        self.report_path = self.live_probe_dir / 'pariya-agent-codex-luna-e2e-G20-relations.json'
        self.write_report(tool_name='bangumi.get_subject_relations')
        report = json.loads(self.report_path.read_text(encoding='utf-8'))
        self.assertTrue(GENERATOR.codex_g20_probe_revision_has_implementation(self.source_revision))
        self.assertTrue(GENERATOR.codex_g20_report_matches_candidate_revision(
            self.report_path, self.source_revision,
        ))
        self.assertEqual(
            GENERATOR.model_mcp_e2e_names(self.catalog),
            {'bangumi.get_subject_relations'},
        )
        self.assertEqual(
            GENERATOR.model_mcp_e2e_sources(self.catalog)['bangumi.get_subject_relations'],
            {'docs/live-probes/pariya-agent-codex-luna-e2e-G20-relations.json'},
        )
        self.assertNotIn('answer', report['scenarios'][0])
        self.assertNotIn('prompt', report['scenarios'][0])
        self.assertNotIn('structuredContent', report['scenarios'][0]['result'])
        self.assertEqual(len(report['scenarios'][0]['result']['visibleRows']), 2)

        self._git('add', 'docs/live-probes/pariya-agent-codex-luna-e2e-G20-relations.json')
        self._git('commit', '-qm', 'add sanitized G20 evidence after its candidate')
        self.assertEqual(
            GENERATOR.model_mcp_e2e_sources(self.catalog)['bangumi.get_subject_relations'],
            {'docs/live-probes/pariya-agent-codex-luna-e2e-G20-relations.json'},
        )

    def test_accepts_catalog_bound_r01_report_for_its_distinct_fixed_subject(self):
        self.report_path = self.live_probe_dir / 'pariya-agent-codex-luna-e2e-R01-relations.json'
        self.write_report(tool_name='bangumi.get_subject_relations', frontier_id='R01')
        report = json.loads(self.report_path.read_text(encoding='utf-8'))
        self.assertEqual(report['argumentProfile'], GENERATOR.CODEX_R01_ARGUMENT_PROFILE)
        self.assertEqual(
            report['expectedArgumentsSha256'],
            GENERATOR._canonical_json_sha256(
                GENERATOR.CODEX_R01_PROBE_ARGUMENTS['bangumi.get_subject_relations']
            ),
        )
        self.assertEqual(report['scenarios'][0]['result']['sourceSubjectId'], 41529)
        self.assertNotIn('visibleRows', report['scenarios'][0]['result'])
        self.assertNotIn('Fixture root', json.dumps(report, ensure_ascii=False))
        self.assertTrue(
            GENERATOR.codex_r01_probe_revision_has_implementation(self.source_revision)
        )
        self.assertTrue(
            GENERATOR.codex_r01_report_matches_candidate_revision(
                self.report_path, self.source_revision,
            )
        )
        report_bytes = self.report_path.read_bytes()
        harness_status, latches = self._r01_harness_status_fixture(report, report_bytes)
        self.assertIsNotNone(GENERATOR.codex_r01_harness_disposition_matches_report(
            report,
            harness_status,
            hashlib.sha256(report_bytes).hexdigest(),
            latches,
        ))
        with patch.object(GENERATOR, 'codex_r01_harness_status', return_value=harness_status), \
                patch.object(GENERATOR, 'codex_r01_harness_latches', return_value=latches):
            self.assertEqual(
                GENERATOR.model_mcp_e2e_names(self.catalog),
                {'bangumi.get_subject_relations'},
            )
            self.assertEqual(
                GENERATOR.model_mcp_e2e_sources(self.catalog)['bangumi.get_subject_relations'],
                {'docs/live-probes/pariya-agent-codex-luna-e2e-R01-relations.json'},
            )

    def test_r01_valid_looking_report_is_not_credited_after_inconclusive_terminal_latch(self):
        self.report_path = self.live_probe_dir / 'pariya-agent-codex-luna-e2e-R01-relations.json'
        self.write_report(tool_name='bangumi.get_subject_relations', frontier_id='R01')
        report = json.loads(self.report_path.read_text(encoding='utf-8'))
        report_bytes = self.report_path.read_bytes()
        harness_status, latches = self._r01_harness_status_fixture(report, report_bytes)
        disposition = harness_status['epoch']['state']['adversarial_preflight'][
            'r01_one_shot_disposition'
        ]
        disposition.update({'state': 'INCONCLUSIVE', 'reportWritten': False})
        disposition.pop('reportPath')
        disposition.pop('reportSha256')
        latches['terminal']['description'] = 'R01-INCONCLUSIVE:report=none'

        self.assertTrue(GENERATOR.codex_mcp_evidence_is_valid(
            report,
            {item['name']: item for item in self.catalog},
            {item['name']: item for item in self.catalog},
        ))
        self.assertIsNone(GENERATOR.codex_r01_harness_disposition_matches_report(
            report,
            harness_status,
            hashlib.sha256(report_bytes).hexdigest(),
            latches,
        ))
        with patch.object(GENERATOR, 'codex_r01_harness_status', return_value=harness_status), \
                patch.object(GENERATOR, 'codex_r01_harness_latches', return_value=latches):
            self.assertNotIn(
                'bangumi.get_subject_relations',
                GENERATOR.model_mcp_e2e_sources(self.catalog),
            )

    def test_r01_report_cannot_be_rebound_to_another_subject_candidate_or_path(self):
        self.report_path = self.live_probe_dir / 'pariya-agent-codex-luna-e2e-R01-relations.json'
        self.write_report(tool_name='bangumi.get_subject_relations', frontier_id='R01')
        report = json.loads(self.report_path.read_text(encoding='utf-8'))
        report['scenarios'][0]['result']['sourceSubjectId'] = 227245
        self.report_path.write_text(json.dumps(report, ensure_ascii=False), encoding='utf-8')
        self.assertFalse(
            GENERATOR.codex_mcp_evidence_is_valid(
                report,
                {item['name']: item for item in self.catalog},
                {item['name']: item for item in self.catalog},
            )
        )
        report['scenarios'][0]['result']['sourceSubjectId'] = 41529
        self.report_path.write_text(json.dumps(report, ensure_ascii=False), encoding='utf-8')
        self.assertTrue(
            GENERATOR.codex_r01_probe_revision_has_implementation(
                self.stale_candidate_source_revision,
            )
        )
        self.assertFalse(
            GENERATOR.codex_r01_report_matches_candidate_revision(
                self.report_path, self.stale_candidate_source_revision,
            )
        )
        report['sourceRevision'] = self.stale_candidate_source_revision
        self.report_path.write_text(json.dumps(report, ensure_ascii=False), encoding='utf-8')
        alternate_path = self.live_probe_dir / 'another-r01-report.json'
        alternate_path.write_text(json.dumps(report, ensure_ascii=False), encoding='utf-8')
        self.assertFalse(
            GENERATOR.codex_r01_report_matches_candidate_revision(
                alternate_path, self.source_revision,
            )
        )
        self.assertEqual(GENERATOR.model_mcp_e2e_names(self.catalog), set())

    def test_r01_rejects_codex_error_items_even_when_the_event_stream_is_complete(self):
        self.report_path = self.live_probe_dir / 'pariya-agent-codex-luna-e2e-R01-relations.json'
        self.write_report(
            tool_name='bangumi.get_subject_relations',
            frontier_id='R01',
            codexErrorItemCount=1,
        )
        report = json.loads(self.report_path.read_text(encoding='utf-8'))
        report['eventStreamParsed'] = True
        self.assertFalse(
            GENERATOR.codex_mcp_evidence_is_valid(
                report,
                {item['name']: item for item in self.catalog},
                {item['name']: item for item in self.catalog},
            )
        )

    def test_r01_rejects_claim_ids_not_bound_to_the_candidate_and_pr(self):
        self.report_path = self.live_probe_dir / 'pariya-agent-codex-luna-e2e-R01-relations.json'
        self.write_report(tool_name='bangumi.get_subject_relations', frontier_id='R01')
        report = json.loads(self.report_path.read_text(encoding='utf-8'))
        report['claimId'] = 143
        self.assertFalse(
            GENERATOR.codex_mcp_evidence_is_valid(
                report,
                {item['name']: item for item in self.catalog},
                {item['name']: item for item in self.catalog},
            )
        )
        del report['codexErrorItemCount']
        self.assertFalse(
            GENERATOR.codex_mcp_evidence_is_valid(
                report,
                {item['name']: item for item in self.catalog},
                {item['name']: item for item in self.catalog},
            )
        )

    def test_rejects_g20_report_from_older_revision_with_same_implementation_markers(self):
        self.report_path = self.live_probe_dir / 'pariya-agent-codex-luna-e2e-G20-relations.json'
        self.write_report(
            tool_name='bangumi.get_subject_relations',
            sourceRevision=self.stale_candidate_source_revision,
        )
        self.assertTrue(
            GENERATOR.codex_g20_probe_revision_has_implementation(
                self.stale_candidate_source_revision,
            )
        )
        self.assertFalse(
            GENERATOR.codex_g20_report_matches_candidate_revision(
                self.report_path, self.stale_candidate_source_revision,
            )
        )
        self.assertNotIn('bangumi.get_subject_relations', GENERATOR.model_mcp_e2e_names(self.catalog))

    def test_rejects_g20_contract_mismatch_or_incomplete_visible_readback(self):
        self.report_path = self.live_probe_dir / 'pariya-agent-codex-luna-e2e-G20-relations.json'
        invalid_reports = [
            {'argumentProfile': 'fixed-public-subject-218707-v1'},
            {'sourceRevision': self.unrelated_source_revision},
            {'scenarios': [{
                'id': 'bangumi.get_subject_relations',
                'passed': True,
                'exactArgumentsMatched': True,
                'oneToolAllowlistVerified': True,
                'resultReadbackVerified': True,
                'answerCheckPassed': True,
                'answerChecks': {key: True for key in GENERATOR.CODEX_G20_ANSWER_CHECK_FIELDS},
                'toolCalls': [{'name': 'bangumi.get_subject_relations', 'state': 'DONE'}],
                'result': {**self._g20_result_fixture(), 'sourceSubjectId': 218707},
            }]},
            {'scenarios': [{
                'id': 'bangumi.get_subject_relations',
                'passed': True,
                'exactArgumentsMatched': True,
                'oneToolAllowlistVerified': True,
                'resultReadbackVerified': True,
                'answerCheckPassed': True,
                'answerChecks': {key: True for key in GENERATOR.CODEX_G20_ANSWER_CHECK_FIELDS},
                'toolCalls': [{'name': 'bangumi.get_subject_relations', 'state': 'DONE'}],
                'result': {
                    **self._g20_result_fixture(),
                    'visibleRows': [],
                },
            }]},
            {'scenarios': [{
                'id': 'bangumi.get_subject_relations',
                'passed': True,
                'exactArgumentsMatched': True,
                'oneToolAllowlistVerified': True,
                'resultReadbackVerified': True,
                'answerCheckPassed': True,
                'answerChecks': {key: True for key in GENERATOR.CODEX_G20_ANSWER_CHECK_FIELDS},
                'toolCalls': [{'name': 'bangumi.get_subject_relations', 'state': 'DONE'}],
                'result': {**self._g20_result_fixture(), 'structuredContent': {'items': []}},
            }]},
        ]
        for override in invalid_reports:
            with self.subTest(override=override):
                self.write_report(tool_name='bangumi.get_subject_relations', **override)
                self.assertEqual(
                    GENERATOR.model_mcp_e2e_names(self.catalog),
                    set(),
                )

    @staticmethod
    def _g20_result_fixture(source_subject_id=227245):
        return {
            'toolName': 'bangumi.get_subject_relations',
            'resultState': 'observed',
            'resultByteLength': 1024,
            'resultSha256': 'd' * 64,
            'sourceOperations': [],
            'artifact': {'returned': False, 'persisted': False},
            'sourceSubjectId': source_subject_id,
            'source': {
                'api': 'Bangumi official v0',
                'operation': 'GET /v0/subjects/{subject_id}/subjects',
                'direction': 'source_subject_to_returned_target',
                'scope': 'visible_direct_rows_returned_for_source_subject',
                'retrievedAt': '2026-10-07T10:30:00.000Z',
            },
            'coverage': {
                'responseRowsObserved': 2,
                'rowsReturned': 2,
                'schemaDriftRows': 0,
                'truncated': False,
                'paginationAvailable': False,
                'totalCountAvailable': False,
                'completeness': 'not_provided_by_source',
            },
            'limitationsCount': 4,
            'visibleRows': [
                {'id': 218707, 'name': 'Fixture root', 'nameCn': '测试主线', 'relation': '主线故事'},
                {'id': 227246, 'name': 'Fixture extra', 'relation': '外传'},
            ],
            'textProjection': {
                'textUtf8Bytes': 1180,
                'rowsIncluded': 2,
                'rowsOmitted': 0,
                'displayNamesClipped': 0,
                'relationLabelsClipped': 0,
                'limitationsClipped': 0,
                'imageFieldsOmitted': 2,
                'fullStructuredContentAvailable': True,
            },
            'answerCounters': {
                'visibleSourceRows': 2,
                'invalidSourceRowsCount': 0,
                'duplicateSourceRowsCount': 0,
                'answerRowsParsed': 2,
                'rowsMatched': 2,
                'missingRowsCount': 0,
                'mismatchedRowsCount': 0,
                'unmatchedRowsCount': 0,
                'duplicateAnswerRowsCount': 0,
                'unstructuredAnswerLinesCount': 0,
                'toolTextUtf8Bytes': 1180,
            },
        }

    def test_rejects_wrong_model_effort_catalog_scope_privacy_or_raw_content(self):
        invalid_reports = [
            {'model': 'gemini-3.8-flash-low'},
            {'reasoningEffort': 'high'},
            {'sourceRevision': 'a' * 40},
            {'sourceRevision': self.unrelated_source_revision},
            {'catalogSha256': '0' * 64},
            {'toolDescriptionSha256': '0' * 64},
            {'serverToolNames': ['bangumi.get_subject_stats_intelligence', 'bangumi.auth_status']},
            {'allowedCallCount': 2},
            {'privacy': {**{key: False for key in GENERATOR.CODEX_PRIVACY_FLAGS},
                         'authProfile': 'anonymous', 'oauthAttempted': True}},
            {'answer': 'raw model answer must never be retained'},
            {'scenarios': [{
                'id': 'bangumi.get_subject_stats_intelligence',
                'passed': True,
                'exactArgumentsMatched': True,
                'oneToolAllowlistVerified': True,
                'resultReadbackVerified': True,
                'answerCheckPassed': True,
                'answerChecks': {key: True for key in GENERATOR.CODEX_STATS_ANSWER_CHECK_FIELDS},
                'toolCalls': [{'name': 'bangumi.get_subject_stats_intelligence', 'state': 'DONE'}],
                'result': {
                    'toolName': 'bangumi.get_subject_stats_intelligence',
                    'resultState': 'partial',
                    'resultByteLength': 128,
                    'resultSha256': 'b' * 64,
                    'sourceOperations': [{'operation': 'GET /v0/subjects/{subject_id}',
                                         'attempted': 1, 'succeeded': 1, 'failed': 0}],
                    'artifact': {'returned': False, 'persisted': False},
                    'unrecognizedPayload': 'raw Bangumi response',
                },
            }]},
            {'scenarios': [{'passed': True, 'exactArgumentsMatched': True,
                            'oneToolAllowlistVerified': True, 'resultReadbackVerified': True,
                            'answerCheckPassed': True,
                            'toolCalls': [{'name': 'bangumi.get_subject_stats_intelligence', 'state': 'DONE'},
                                          {'name': 'bangumi.auth_status', 'state': 'DONE'}],
                            'result': {'toolName': 'bangumi.get_subject_stats_intelligence',
                                       'resultState': 'partial'}}]},
        ]
        for override in invalid_reports:
            with self.subTest(override=override):
                self.write_report(**override)
                self.assertEqual(GENERATOR.model_mcp_e2e_names(self.catalog), set())

    def test_rejects_renderer_report_without_ephemeral_png_metadata(self):
        self.write_report(tool_name='bangumi.render_subject_stats_intelligence')
        report = json.loads(self.report_path.read_text(encoding='utf-8'))
        report['scenarios'][0]['result']['artifact']['persisted'] = True
        self.report_path.write_text(json.dumps(report), encoding='utf-8')
        self.assertEqual(GENERATOR.model_mcp_e2e_names(self.catalog), set())

    def _d05_report_fixture(self, source_revision=None):
        catalog_bytes = self.catalog_path.read_bytes()
        tool = next(item for item in self.catalog if item['name'] == 'bangumi.query_subjects')
        revision = source_revision or self.source_revision
        return {
            'schemaVersion': 1,
            'evidenceKind': 'codex_cli_d05_current_season_agent_mcp',
            'runNumber': 95,
            'scenarioId': 'D05',
            'profile': 'run95-d05-current-season-multitag-heat-agent-mcp-v1',
            'frontierId': 'D05',
            'sourceRevision': revision,
            'mcpBundleSha256': GENERATOR.codex_d05_candidate_bundle_sha256(revision),
            'prNumber': 127,
            'baseSha': 'b' * 40,
            'observedAt': '2026-10-08T05:00:00.000Z',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'codexCliVersion': '1.2.14',
            'toolName': 'bangumi.query_subjects',
            'argumentProfile': 'fixed-d05-current-season-campus-romance-heat-v1',
            'expectedArgumentsSha256': GENERATOR._canonical_json_sha256(
                GENERATOR.CODEX_D05_EXPECTED_ARGUMENTS,
            ),
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(tool['description'].encode('utf-8')).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'serverToolNames': ['bangumi.query_subjects'],
            'mcpServerNames': ['bgk_d05_one_tool'],
            'serverToolCount': 1,
            'processExitCode': 0,
            'resultCount': 1,
            'eventStreamParsed': True,
            'codexMcpToolEventCount': 1,
            'nonMcpToolEventCount': 0,
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'resultStatus': 'SUCCESS',
            'qqPipelineTested': False,
            'timClientTested': False,
            'toolCalls': [{'name': 'bangumi.query_subjects', 'state': 'DONE'}],
            'answerCheckMethod': 'd05-current-season-multitag-heat-v1',
            'toolTextUtf8Bytes': 1800,
            'resultCounters': {
                'state': 'partial',
                'season': '2026-autumn',
                'totalKind': 'estimated',
                'scanned': 20,
                'matched': 2,
                'returned': 2,
                'sourceRowsValid': 2,
                'sourceRowsInvalid': 0,
                'sourceRowsDuplicate': 0,
                'textRowsOmitted': 0,
                'displayNamesClipped': 0,
                'textUtf8Bytes': 1800,
                'answerRows': 2,
            },
            'answerChecks': {
                key: True for key in GENERATOR.CODEX_D05_ANSWER_CHECK_FIELDS
            },
            'warningCodes': ['EXPERIMENTAL_SOURCE'],
            'privacy': {
                'authProfile': 'anonymous',
                'oauthAttempted': False,
                'accountDataRead': False,
                'writesAttempted': False,
                'qqPipelineTested': False,
                'timClientTested': False,
                'promptStored': False,
                'answerStored': False,
                'rawResultStored': False,
                'artifactImageBytesStored': False,
                'credentialsStored': False,
            },
            'rawAnswerPersisted': False,
            'rawToolResultPersisted': False,
        }

    def test_d05_report_counts_as_public_and_agent_mcp_evidence_for_current_query_tool(self):
        report = self._d05_report_fixture()
        report_path = self.live_probe_dir / GENERATOR.CODEX_D05_REPORT_RELATIVE_PATH.split('/')[-1]
        report_path.write_text(json.dumps(report), encoding='utf-8')

        self.assertTrue(GENERATOR.codex_d05_report_is_valid(report))
        self.assertTrue(
            GENERATOR.codex_d05_report_matches_candidate_revision(
                report_path, report['sourceRevision'],
            ),
        )
        self.assertEqual(
            GENERATOR.model_mcp_e2e_sources(self.catalog).get('bangumi.query_subjects'),
            {GENERATOR.CODEX_D05_REPORT_RELATIVE_PATH},
        )
        self.assertEqual(
            GENERATOR.public_api_smoke_sources(self.catalog).get('bangumi.query_subjects'),
            {GENERATOR.CODEX_D05_REPORT_RELATIVE_PATH},
        )

    def test_d05_report_rejects_stale_candidate_catalog_or_unsanitized_result(self):
        report = self._d05_report_fixture()
        self.assertTrue(GENERATOR.codex_d05_report_is_valid(report))

        stale = {**report, 'sourceRevision': self.stale_candidate_source_revision}
        stale_path = self.live_probe_dir / GENERATOR.CODEX_D05_REPORT_RELATIVE_PATH.split('/')[-1]
        stale_path.write_text(json.dumps(stale), encoding='utf-8')
        self.assertFalse(
            GENERATOR.codex_d05_report_matches_candidate_revision(
                stale_path, stale['sourceRevision'],
            ),
        )

        raw_answer = {**report, 'answer': 'raw answer must not persist'}
        self.assertFalse(GENERATOR.codex_d05_report_is_valid(raw_answer))

        failed_check = {
            **report,
            'answerChecks': {**report['answerChecks'], 'requestFilterMatches': False},
        }
        self.assertFalse(GENERATOR.codex_d05_report_is_valid(failed_check))

    def _g26_report_fixture(self, source_revision=None):
        catalog_bytes = self.catalog_path.read_bytes()
        tool = next(item for item in self.catalog if item['name'] == 'bangumi.query_subjects')
        return {
            'schemaVersion': 1,
            'evidenceKind': 'codex_cli_g26_exact_tag_agent_mcp',
            'runNumber': 95,
            'frontierId': 'G26',
            'scenarioId': 'G26',
            'sourceRevision': source_revision or self.source_revision,
            'mcpBundleSha256': GENERATOR.codex_g26_candidate_bundle_sha256(
                source_revision or self.source_revision,
            ),
            'observedAt': '2026-10-07T12:00:00.000Z',
            'codexCliVersion': '1.2.14',
            'profile': 'codex-luna-max-one-tool-v1',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'toolName': 'bangumi.query_subjects',
            'argumentProfile': 'fixed-g26-exact-public-tag-2019-2024-v1',
            'expectedArgumentsSha256': GENERATOR._canonical_json_sha256(
                GENERATOR.CODEX_G26_EXPECTED_ARGUMENTS,
            ),
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(tool['description'].encode('utf-8')).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'eventStreamParsed': True,
            'codexMcpToolEventCount': 1,
            'nonMcpToolEventCount': 0,
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'toolCalls': [{'name': 'bangumi.query_subjects', 'state': 'DONE'}],
            'answerCheckMethod': 'g26-exact-public-tag-query-v1',
            'answerChecks': {
                key: True for key in GENERATOR.CODEX_G26_ANSWER_CHECK_FIELDS
            },
            'resultCounters': {
                'resultState': 'ok',
                'coverageState': 'complete',
                'totalKind': 'estimated',
                'scanned': 2,
                'matched': 2,
                'returned': 2,
                'pagesRequested': 1,
                'pagesScanned': 1,
                'upstreamExhausted': True,
                'budgetExceeded': False,
                'hydrationsAttempted': 0,
                'hydrationsSucceeded': 0,
                'hydrationsFailed': 0,
                'hydrationsUnresolved': 0,
                'hydrationBudgetExceeded': False,
                'outputCap': None,
                'visibleSourceRows': 2,
                'invalidSourceRowsCount': 0,
                'duplicateSourceRowsCount': 0,
                'textRowsIncluded': 2,
                'textRowsOmitted': 0,
                'displayNamesClipped': 0,
                'textUtf8Bytes': 2100,
                'answerRowsParsed': 2,
                'rowsMatched': 2,
                'missingRowsCount': 0,
                'mismatchedRowsCount': 0,
                'unmatchedRowsCount': 0,
                'duplicateAnswerRowsCount': 0,
                'unstructuredAnswerLinesCount': 0,
            },
            'warningCodes': ['EXPERIMENTAL_SOURCE'],
            'privacy': {
                'authProfile': 'anonymous',
                'oauthAttempted': False,
                'accountDataRead': False,
                'writesAttempted': False,
                'qqPipelineTested': False,
                'timClientTested': False,
                'promptStored': False,
                'answerStored': False,
                'rawResultStored': False,
                'credentialsStored': False,
            },
        }

    def _d07_report_fixture(self, source_revision=None):
        catalog_bytes = self.catalog_path.read_bytes()
        tool = next(item for item in self.catalog if item['name'] == 'bangumi.query_subjects')
        revision = source_revision or self.source_revision
        base_sha = self.stale_candidate_source_revision
        years = list(GENERATOR.CODEX_D07_EXPECTED_YEARS)
        summaries = [
            {
                'year': year,
                'subjectId': 10000 + year,
                'rank': index + 1,
                'titleSha256': hashlib.sha256(f'Anime {year}'.encode('utf-8')).hexdigest(),
                'retrievedAt': f'2026-10-13T12:{index:02}:00.000Z',
            }
            for index, year in enumerate(years)
        ]
        coverage_summaries = [
            {
                'year': year,
                'resultState': ('ok', 'ok', 'partial')[index % 3],
                'coverageState': ('complete', 'unknown', 'partial')[index % 3],
                'requested': 1,
                'scanned': (8, 20, 20)[index % 3],
                'matched': (4, 7, 7)[index % 3],
                'returned': 1,
                'totalKind': 'exact',
            }
            for index, year in enumerate(years)
        ]
        return {
            'schemaVersion': 1,
            'evidenceKind': 'codex_cli_d07_current_rank_agent_mcp',
            'runNumber': 95,
            'scenarioId': 'D07',
            'profile': 'run95-d07-current-rank-by-release-year-agent-mcp-v1',
            'frontierId': 'D07',
            'epochId': GENERATOR.CODEX_D07_EPOCH_ID,
            'sourceRevision': revision,
            'baseSha': base_sha,
            'prNumber': 158,
            'claimId': f"d07-run-95-pr-158-{revision[:12]}-cccccccccccc",
            'reviewerId': 'gpt-6-luna-max-run95-pr158-round1',
            'mcpBundleSha256': GENERATOR.codex_g26_candidate_bundle_sha256(revision),
            'observedAt': '2026-10-13T12:30:00.000Z',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'codexCliVersion': '0.162.0-alpha.17.2',
            'toolName': 'bangumi.query_subjects',
            'argumentProfile': GENERATOR.CODEX_D07_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR._canonical_json_sha256(
                GENERATOR.CODEX_D07_ARGUMENTS_BY_YEAR,
            ),
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(tool['description'].encode('utf-8')).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'serverToolNames': ['bangumi.query_subjects'],
            'serverToolCount': 1,
            'mcpServerNames': ['bgk_d07_one_tool'],
            'expectedCallCount': len(years),
            'processExitCode': 0,
            'eventStreamParsed': True,
            'eventStreamComplete': True,
            'turnCompleted': True,
            'codexMcpToolEventCount': len(years),
            'codexErrorItemCount': 0,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'allowedCallCount': len(years),
            'deniedCallCount': 0,
            'resultStatus': 'SUCCESS',
            'answerCheckMethod': GENERATOR.CODEX_D07_ANSWER_CHECK_METHOD,
            'answerChecks': {key: True for key in GENERATOR.CODEX_D07_ANSWER_CHECK_FIELDS},
            'resultCounters': {
                'expectedYears': len(years),
                'observedCalls': len(years),
                'yearsWithOneObservedRank': len(years),
                'rankMinimum': 1,
                'rankMaximum': len(years),
            },
            'resultSummaries': summaries,
            'coverageSummaries': coverage_summaries,
            'retrievedAt': {
                'first': '2026-10-13T12:00:00.000Z',
                'last': '2026-10-13T12:09:00.000Z',
            },
            'privacy': {
                'authProfile': 'anonymous',
                'oauthAttempted': False,
                'accountDataRead': False,
                'writesAttempted': False,
                'communityRead': False,
                'qqPipelineTested': False,
                'timClientTested': False,
                'promptStored': False,
                'answerStored': False,
                'rawResultStored': False,
                'credentialsStored': False,
            },
            'rawAnswerPersisted': False,
            'rawToolResultPersisted': False,
        }

    def _d07_harness_status_fixture(self, report, report_bytes):
        disposition = {
            'claimId': report['claimId'],
            'frontierId': 'D07',
            'epochId': GENERATOR.CODEX_D07_EPOCH_ID,
            'runNumber': 95,
            'prNumber': report['prNumber'],
            'toolName': 'bangumi.query_subjects',
            'argumentProfile': GENERATOR.CODEX_D07_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': report['expectedArgumentsSha256'],
            'expectedCallCount': len(GENERATOR.CODEX_D07_EXPECTED_YEARS),
            'state': 'REPORT_WRITTEN',
            'sourceCandidateSha': report['sourceRevision'],
            'baseSha': report['baseSha'],
            'ciSha': report['sourceRevision'],
            'ciStatus': 'SUCCESS',
            'bundleSha256': report['mcpBundleSha256'],
            'reviewerId': report['reviewerId'],
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'reportWritten': True,
            'reportPath': GENERATOR.CODEX_D07_REPORT_RELATIVE_PATH,
            'reportSha256': hashlib.sha256(report_bytes).hexdigest(),
            'terminalLabel': 'REPORT_WRITTEN',
            'retryAllowed': False,
        }
        return {
            'run': {
                'number': 95,
                'state': {'profile': 'AUTONOMOUS_EVOLUTION', 'active_epoch_pr': report['prNumber']},
            },
            'epoch': {
                'number': report['prNumber'],
                'github_state': 'OPEN',
                'state': {
                    'epoch_id': GENERATOR.CODEX_D07_EPOCH_ID,
                    'pr_number': report['prNumber'],
                    'review_history': [{
                        'candidate_sha': report['sourceRevision'],
                        'reviewed_base_sha': report['baseSha'],
                        'reviewer_id': report['reviewerId'],
                        'verdict': 'PASS',
                    }],
                    'adversarial_preflight': {'d07_one_shot_disposition': disposition},
                },
            },
        }

    def _s02_report_fixture(self, source_revision=None):
        catalog_bytes = self.catalog_path.read_bytes()
        tool = next(item for item in self.catalog if item['name'] == 'bangumi.get_person_activity')
        revision = source_revision or self.source_revision
        coverage = {key: 0 for key in GENERATOR.CODEX_S02_COVERAGE_FIELDS}
        coverage.update({
            'relationRowsObserved': 4,
            'relationRowsSelected': 4,
            'subjectDetailRequests': 2,
            'subjectDetailsSucceeded': 2,
            'mainRoleSubjectsSelected': 2,
            'scoreableMainRoleSubjects': 2,
            'unknownRoleRows': 1,
            'rowsReturned': 1,
        })
        return {
            'schemaVersion': 1,
            'evidenceKind': 'codex_cli_s02_person_activity_agent_mcp',
            'runNumber': 95,
            'frontierId': 'S02',
            'scenarioId': 'S02',
            'sourceRevision': revision,
            'mcpBundleSha256': GENERATOR.codex_s02_candidate_bundle_sha256(revision),
            'observedAt': '2026-10-08T05:00:00.000Z',
            'codexCliVersion': '1.2.14',
            'profile': 'codex-luna-max-one-tool-v1',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'toolName': 'bangumi.get_person_activity',
            'argumentProfile': 'fixed-s02-person-3474-top-rated-main-voice-v1',
            'expectedArgumentsSha256': GENERATOR._canonical_json_sha256(
                GENERATOR.CODEX_S02_EXPECTED_ARGUMENTS,
            ),
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(tool['description'].encode('utf-8')).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'eventStreamParsed': True,
            'codexMcpToolEventCount': 1,
            'nonMcpToolEventCount': 0,
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'toolCalls': [{'name': 'bangumi.get_person_activity', 'state': 'DONE'}],
            'answerCheckMethod': 's02-top-rated-main-voice-answer-v1',
            'answerChecks': {
                key: True for key in GENERATOR.CODEX_S02_ANSWER_CHECK_FIELDS
            },
            'answerCounters': {
                'sourceRows': 1,
                'answerRows': 1,
                'rowsMatched': 1,
                'missingRowsCount': 0,
                'extraRowsCount': 0,
                'duplicateAnswerRowsCount': 0,
                'coverageFieldsMatched': len(GENERATOR.CODEX_S02_COVERAGE_FIELDS),
            },
            'resultSummary': {
                'state': 'partial',
                'scope': 'current_official_person_character_response',
                'media': 'all',
                'truncated': False,
                'rows': [{'subjectId': 1001, 'ratingScore': 8.9, 'ratingTotal': 8123}],
                'coverage': coverage,
            },
            'privacy': {
                'authProfile': 'anonymous',
                **{
                    key: False
                    for key in GENERATOR.CODEX_S02_PRIVACY_FIELDS - {'authProfile'}
                },
            },
        }

    def _p01_report_fixture(self, source_revision=None):
        catalog_bytes = self.catalog_path.read_bytes()
        tool = next(item for item in self.catalog if item['name'] == 'bangumi.get_person_activity')
        revision = source_revision or self.source_revision
        base_sha = self._git('rev-parse', f'{revision}^').stdout.strip()
        month_index = 2026 * 12 + 10 - 1 - 35
        month_keys = []
        for offset in range(36):
            year, month_zero_based = divmod(month_index + offset, 12)
            month_keys.append(f'{year:04d}-{month_zero_based + 1:02d}')
        coverage = {key: 0 for key in GENERATOR.CODEX_P01_COVERAGE_FIELDS}
        coverage.update({
            'relationRowsObserved': 1,
            'relationRowsSelected': 1,
            'relationSelectionStrategy': 'all',
            'sampled': False,
            'subjectIdsObserved': 1,
            'subjectIdsSelected': 1,
            'subjectDetailIdsObserved': 1,
            'subjectDetailRequests': 1,
            'subjectDetailsSucceeded': 1,
            'rowsEligible': 1,
            'rowsReturned': 1,
            'outputTruncated': False,
            'uniqueSubjects': 1,
            'uniqueCharacters': 0,
            'maxRelations': 48,
            'maxSubjectDetails': 16,
            'maxRows': 8,
            'detailConcurrency': 4,
            'responseLimitBytes': 1_048_576,
            'truncated': False,
            'retrievedAt': '2026-10-11T08:00:00.000Z',
        })
        source_operations = [
            {'operation': 'GET /v0/persons/{person_id}', 'attempted': 1, 'succeeded': 1, 'failed': 0},
            {'operation': 'GET /v0/persons/{person_id}/subjects', 'attempted': 1, 'succeeded': 1, 'failed': 0},
            {'operation': 'GET /v0/subjects/{subject_id}', 'attempted': 1, 'succeeded': 1, 'failed': 0},
        ]
        reviewer_id = 'gpt-6-luna-max-run95-pr147-round1'
        report = {
            'schemaVersion': 1,
            'evidenceKind': 'codex_p01_person_position_agent_mcp',
            'runNumber': 95,
            'frontierId': 'P01',
            'scenarioId': 'P01',
            'epochId': GENERATOR.CODEX_P01_EPOCH_ID,
            'profile': GENERATOR.CODEX_P01_ARGUMENT_PROFILE,
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'reviewerId': reviewer_id,
            'claimId': f'p01-run-95-pr-147-{revision[:12]}-123',
            'codexCliVersion': '0.162.0',
            'sourceRevision': revision,
            'baseSha': base_sha,
            'prNumber': 147,
            'mcpBundleSha256': GENERATOR.codex_g26_candidate_bundle_sha256(revision),
            'observedAt': '2026-10-11T08:00:00.000Z',
            'candidateGate': {
                'candidateSha': revision,
                'baseSha': base_sha,
                'ciSha': revision,
                'ciStatus': 'SUCCESS',
                'reviewPassSha': revision,
                'reviewVerdict': 'PASS',
                'reviewerId': reviewer_id,
            },
            'toolName': 'bangumi.get_person_activity',
            'argumentProfile': GENERATOR.CODEX_P01_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR._canonical_json_sha256(
                GENERATOR.CODEX_P01_EXPECTED_ARGUMENTS,
            ),
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(tool['description'].encode('utf-8')).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'serverToolNames': ['bangumi.get_person_activity'],
            'serverToolCount': 1,
            'mcpServerNames': ['bgk_p01_one_tool'],
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'eventStreamParsed': True,
            'codexMcpToolEventCount': 1,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'answerCheckMethod': 'p01-bounded-person-role-frequency-answer-v1',
            'answerChecks': {key: True for key in GENERATOR.CODEX_P01_ANSWER_CHECK_FIELDS},
            'answerCounters': {
                'sourceRows': 1,
                'answerRows': 1,
                'rowsMatched': 1,
                'sourceRoleLabels': 1,
                'answerRoleLabels': 1,
                'knownRoleRows': 1,
                'unknownRoleRows': 0,
                'toolTextUtf8Bytes': 2400,
                'coverageFieldsMatched': len(GENERATOR.CODEX_P01_COVERAGE_FIELDS),
            },
            'toolCalls': [{
                'name': 'bangumi.get_person_activity',
                'state': 'DONE',
                'argumentsSha256': GENERATOR._canonical_json_sha256(
                    GENERATOR.CODEX_P01_EXPECTED_ARGUMENTS,
                ),
            }],
            'toolTextUtf8Bytes': 2400,
            'resultSummary': {
                'personId': 1040,
                'kind': 'staff',
                'media': 'anime',
                'state': 'partial',
                'window': {
                    'months': 36,
                    'start': '2023-11-01',
                    'end': '2026-10-11',
                    'monthKeys': month_keys,
                    'asOfSemantics': 'calendar_months_ending_on_as_of_date',
                },
                'summary': {'creditRows': 1, 'uniqueSubjects': 1, 'uniqueCharacters': 0},
                'coverage': coverage,
                'rowCount': 1,
                'roleLabelCount': 1,
                'unknownRoleRows': 0,
                'sourceRowDigest': 'd' * 64,
                'sourceOperations': source_operations,
            },
            'resultByteLength': 4096,
            'resultSha256': 'e' * 64,
            'answerUtf8Bytes': 1200,
            'answerSha256': 'f' * 64,
            'sourceOperations': source_operations,
            'privacy': {
                'authProfile': 'anonymous',
                'oauthAttempted': False,
                'accountDataRead': False,
                'writesAttempted': False,
                'communityRead': False,
                'qqPipelineTested': False,
                'timClientTested': False,
                'promptStored': False,
                'answerStored': False,
                'rawResultStored': False,
                'artifactImageBytesStored': False,
                'credentialsStored': False,
            },
        }
        public_der = bytes.fromhex('302a300506032b6570032100') + b'k' * 32
        event_stream_sha256 = '7' * 64
        server_summary_sha256 = '8' * 64
        receipt_payload = {
            'schemaVersion': 1,
            'kind': GENERATOR.CODEX_P01_RUNNER_RECEIPT_KIND,
            'claimId': report['claimId'],
            'runNumber': 95,
            'frontierId': 'P01',
            'epochId': GENERATOR.CODEX_P01_EPOCH_ID,
            'prNumber': report['prNumber'],
            'sourceRevision': report['sourceRevision'],
            'baseSha': report['baseSha'],
            'ciSha': report['sourceRevision'],
            'ciStatus': 'SUCCESS',
            'reviewerId': report['reviewerId'],
            'bundleSha256': report['mcpBundleSha256'],
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'toolName': 'bangumi.get_person_activity',
            'argumentProfile': GENERATOR.CODEX_P01_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': report['expectedArgumentsSha256'],
            'codexCliVersion': report['codexCliVersion'],
            'processExitCode': report['processExitCode'],
            'resultStatus': report['resultStatus'],
            'eventStreamParsed': report['eventStreamParsed'],
            'serverToolNames': report['serverToolNames'],
            'serverToolCount': report['serverToolCount'],
            'mcpServerNames': report['mcpServerNames'],
            'codexMcpToolEventCount': report['codexMcpToolEventCount'],
            'nonMcpToolEventCount': report['nonMcpToolEventCount'],
            'nonMcpToolTypes': report['nonMcpToolTypes'],
            'shellToolCallCount': report['shellToolCallCount'],
            'allowedCallCount': report['allowedCallCount'],
            'deniedCallCount': report['deniedCallCount'],
            'eventStreamSha256': event_stream_sha256,
            'serverSummarySha256': server_summary_sha256,
            'toolArgumentsSha256': GENERATOR._canonical_json_sha256(
                GENERATOR.CODEX_P01_EXPECTED_ARGUMENTS,
            ),
            'toolTextUtf8Bytes': report['toolTextUtf8Bytes'],
            'resultByteLength': report['resultByteLength'],
            'resultSha256': report['resultSha256'],
            'answerUtf8Bytes': report['answerUtf8Bytes'],
            'answerSha256': report['answerSha256'],
            'answerChecksSha256': GENERATOR._canonical_json_sha256(report['answerChecks']),
            'answerCountersSha256': GENERATOR._canonical_json_sha256(report['answerCounters']),
            'resultSummarySha256': GENERATOR._canonical_json_sha256(report['resultSummary']),
        }
        public_der_base64 = base64.b64encode(public_der).decode('ascii')
        report['runnerReceipt'] = {
            'schemaVersion': 1,
            'kind': GENERATOR.CODEX_P01_RUNNER_RECEIPT_KIND,
            'publicKeyBase64': public_der_base64,
            'publicKeySha256': hashlib.sha256(public_der).hexdigest(),
            'payload': receipt_payload,
            'signature': base64.b64encode(b's' * 64).decode('ascii'),
        }
        return report

    def _g04_report_fixture(self, source_revision=None):
        catalog_bytes = self.catalog_path.read_bytes()
        tool = next(item for item in self.catalog if item['name'] == 'bangumi.get_person_activity')
        revision = source_revision or self.source_revision
        base_sha = self._git('rev-parse', f'{revision}^').stdout.strip()
        coverage = {key: 0 for key in GENERATOR.CODEX_G04_COVERAGE_FIELDS}
        coverage.update({
            'relationRowsObserved': 62,
            'relationRowsSelected': 48,
            'relationRowsDroppedAtLimit': 14,
            'subjectIdsObserved': 56,
            'subjectIdsSelected': 40,
            'subjectIdsDroppedAtRelationLimit': 16,
            'subjectDetailIdsObserved': 40,
            'subjectDetailRequests': 16,
            'subjectDetailsSucceeded': 16,
            'subjectDetailsFailed': 0,
            'subjectDetailIdsDroppedAtLimit': 24,
            'rowsEligible': 2,
            'rowsReturned': 2,
            'outputTruncated': False,
            'uniqueSubjects': 2,
            'uniqueCharacters': 2,
            'maxRelations': 48,
            'maxSubjectDetails': 16,
            'maxRows': 8,
            'responseLimitBytes': 1_048_576,
            'truncated': True,
        })
        report = {
            'schemaVersion': 1,
            'evidenceKind': 'codex_cli_g04_person_activity_agent_mcp',
            'runNumber': 95,
            'frontierId': 'G04',
            'scenarioId': 'G04',
            'epochId': GENERATOR.CODEX_G04_EPOCH_ID,
            'profile': 'codex-luna-max-one-tool-v1',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'reviewerId': 'gpt-6-luna-max-run95-pr136-round1',
            'codexCliVersion': '1.2.14',
            'sourceRevision': revision,
            'baseSha': base_sha,
            'prNumber': 136,
            'claimId': 'g04-run-95-pr-136-aaaaaaaaaaaa-123',
            'mcpBundleSha256': GENERATOR.codex_g26_candidate_bundle_sha256(revision),
            'runnerEventStreamSha256': '1' * 64,
            'runnerServerSummarySha256': '2' * 64,
            'observedAt': '2026-10-08T05:00:00.000Z',
            'toolName': 'bangumi.get_person_activity',
            'argumentProfile': GENERATOR.CODEX_G04_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR._canonical_json_sha256(
                GENERATOR.CODEX_G04_EXPECTED_ARGUMENTS,
            ),
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(tool['description'].encode('utf-8')).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'serverToolNames': ['bangumi.get_person_activity'],
            'serverToolCount': 1,
            'mcpServerNames': ['bgk_g04_one_tool'],
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'eventStreamParsed': True,
            'codexMcpToolEventCount': 1,
            'codexErrorItemCount': 3,
            'nonMcpToolEventCount': 0,
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'answerCheckMethod': 'g04-bounded-person-activity-answer-v1',
            'answerChecks': {
                key: True for key in GENERATOR.CODEX_G04_ANSWER_CHECK_FIELDS
            },
            'answerCounters': {
                'sourceRows': 2,
                'answerRows': 2,
                'rowsMatched': 2,
                'missingRows': 0,
                'extraRows': 0,
                'coverageFieldsMatched': len(GENERATOR.CODEX_G04_COVERAGE_FIELDS),
                'toolTextUtf8Bytes': 3000,
            },
            'toolCalls': [{'name': 'bangumi.get_person_activity', 'state': 'DONE'}],
            'toolTextUtf8Bytes': 3000,
            'resultSummary': {
                'personId': 13684,
                'kind': 'voice',
                'media': 'tv',
                'state': 'partial',
                'window': {
                    'months': 12,
                    'start': '2025-11-01',
                    'end': '2026-10-08',
                    'monthKeys': ['2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'],
                    'asOfSemantics': 'calendar_months_ending_on_as_of_date',
                },
                'summary': {'creditRows': 2, 'uniqueSubjects': 2, 'uniqueCharacters': 2},
                'coverage': coverage,
                'rowCount': 2,
                'rowDigest': 'd' * 64,
            },
            'resultByteLength': 4096,
            'resultSha256': 'e' * 64,
            'answerUtf8Bytes': 1800,
            'answerSha256': 'f' * 64,
            'sourceOperations': [
                {'operation': 'GET /v0/persons/{person_id}', 'attempted': 1, 'succeeded': 1, 'failed': 0},
                {'operation': 'GET /v0/persons/{person_id}/characters', 'attempted': 1, 'succeeded': 1, 'failed': 0},
                {'operation': 'GET /v0/subjects/{subject_id}', 'attempted': 16, 'succeeded': 16, 'failed': 0},
            ],
            'privacy': {
                'authProfile': 'anonymous',
                **{key: False for key in GENERATOR.CODEX_G04_PRIVACY_FIELDS - {'authProfile'}},
            },
        }
        report['runnerReceipt'] = self._sign_g04_runner_receipt(
            GENERATOR.codex_g04_runner_receipt_payload(report),
        )
        return report

    def _sign_g04_runner_receipt(self, payload):
        signer_script = (
            'import { pathToFileURL } from "node:url"; '
            'import { readFileSync } from "node:fs"; '
            'const moduleUrl = pathToFileURL(process.cwd() + "/scripts/acceptance/g04-runner-receipt.mjs"); '
            'const module = await import(moduleUrl); '
            'const input = JSON.parse(readFileSync(0,"utf8")); '
            'const keyPair = module.generateG04RunnerReceiptKeyPair(); '
            'process.stdout.write(JSON.stringify(module.createG04RunnerReceipt(input.payload,keyPair)));'
        )
        result = subprocess.run(
            ['node', '--input-type=module', '-e', signer_script],
            cwd=self.root,
            input=json.dumps({'payload': payload}),
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(result.stdout)

    def _g04_harness_status_fixture(
        self, report, report_bytes=None, *, active_pr=None, github_state='OPEN',
    ):
        receipt = report['runnerReceipt']
        disposition = {
            'claimId': report['claimId'],
            'frontierId': 'G04',
            'epochId': GENERATOR.CODEX_G04_EPOCH_ID,
            'runNumber': 95,
            'toolName': report['toolName'],
            'argumentProfile': report['argumentProfile'],
            'expectedArgumentsSha256': report['expectedArgumentsSha256'],
            'state': 'REPORT_WRITTEN',
            'sourceCandidateSha': report['sourceRevision'],
            'baseSha': report['baseSha'],
            'ciSha': report['sourceRevision'],
            'ciStatus': 'SUCCESS',
            'bundleSha256': report['mcpBundleSha256'],
            'prNumber': report['prNumber'],
            'reviewerId': report['reviewerId'],
            'model': report['model'],
            'reasoningEffort': report['reasoningEffort'],
            'runnerReceiptPublicKey': receipt['publicKeyBase64'],
            'runnerReceiptPublicKeySha256': receipt['publicKeySha256'],
            'reportWritten': True,
            'reportPath': GENERATOR.CODEX_G04_REPORT_RELATIVE_PATH,
            'reportSha256': hashlib.sha256(report_bytes).hexdigest() if report_bytes else 'a' * 64,
            'retryAllowed': False,
        }
        return {
            'run': {
                'number': 95,
                'state': {
                    'profile': 'AUTONOMOUS_EVOLUTION',
                    'active_epoch_pr': (
                        report['prNumber'] if active_pr is None else active_pr
                    ),
                },
            },
            'epoch': {
                'number': report['prNumber'],
                'github_state': github_state,
                'state': {
                    'epoch_id': GENERATOR.CODEX_G04_EPOCH_ID,
                    'pr_number': report['prNumber'],
                    'adversarial_preflight': {'g04_one_shot_disposition': disposition},
                },
            },
        }

    def _g05_report_fixture(self, source_revision=None):
        catalog_bytes = self.catalog_path.read_bytes()
        tool = next(item for item in self.catalog if item['name'] == 'bangumi.get_person_activity')
        revision = source_revision or self.source_revision
        base_sha = self._git('rev-parse', f'{revision}^').stdout.strip()

        def window(start, end, month_keys):
            return {
                'months': 6,
                'start': start,
                'end': end,
                'monthKeys': month_keys,
                'asOfSemantics': 'calendar_months_ending_on_as_of_date',
            }

        def coverage(rows, unique_subjects):
            value = {key: 0 for key in GENERATOR.CODEX_G05_COVERAGE_FIELDS}
            value.update({
                'relationRowsObserved': rows,
                'relationRowsSelected': rows,
                'subjectIdsObserved': rows,
                'subjectIdsSelected': rows,
                'subjectDetailIdsObserved': rows,
                'subjectDetailRequests': rows,
                'subjectDetailsSucceeded': rows,
                'rowsEligible': rows,
                'rowsReturned': rows,
                'uniqueSubjects': unique_subjects,
                'uniqueCharacters': unique_subjects,
                'maxRelations': 48,
                'maxSubjectDetails': 12,
                'maxRows': 20,
                'responseLimitBytes': 1_048_576,
                'outputTruncated': False,
                'truncated': False,
            })
            return value

        def summary(rows, month_key, month_keys):
            return {
                'creditRows': rows,
                'uniqueSubjects': rows,
                'uniqueCharacters': rows,
                'byMonth': [{
                    'month': key,
                    'creditRows': rows if key == month_key else 0,
                    'uniqueSubjects': rows if key == month_key else 0,
                    'uniqueCharacters': rows if key == month_key else 0,
                } for key in month_keys],
            }

        def operations(details):
            return {
                'GET /v0/persons/{person_id}': {'attempted': 1, 'succeeded': 1, 'failed': 0},
                'GET /v0/persons/{person_id}/characters': {'attempted': 1, 'succeeded': 1, 'failed': 0},
                'GET /v0/subjects/{subject_id}': {'attempted': details, 'succeeded': details, 'failed': 0},
            }

        recent_window = window('2026-05-01', '2026-10-11', [
            '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10',
        ])
        previous_window = window('2025-11-01', '2026-04-30', [
            '2025-11', '2025-12', '2026-01', '2026-02', '2026-03', '2026-04',
        ])
        recent_coverage = coverage(1, 1)
        previous_coverage = coverage(2, 2)
        recent_summary = summary(1, '2026-05', recent_window['monthKeys'])
        previous_summary = summary(2, '2026-04', previous_window['monthKeys'])
        source_operations = {'recent': operations(1), 'previous': operations(2)}
        result_summary = {
            'personId': 13684,
            'kind': 'voice',
            'media': 'tv',
            'state': 'partial',
            'comparisonState': 'partial',
            'window': recent_window,
            'recent': {
                'state': 'partial', 'window': recent_window,
                'summary': recent_summary, 'coverage': recent_coverage,
            },
            'previous': {
                'state': 'partial', 'window': previous_window,
                'summary': previous_summary, 'coverage': previous_coverage,
            },
            'delta': {'state': 'partial', 'creditRows': -1, 'uniqueSubjects': -1, 'uniqueCharacters': -1},
            'peak': {
                'metric': 'uniqueSubjects', 'state': 'partial',
                'months': [{
                    'period': 'previous', 'month': '2026-04',
                    'creditRows': 2, 'uniqueSubjects': 2, 'uniqueCharacters': 2,
                }],
            },
            'rowCount': 1,
            'rowDigest': 'd' * 64,
            'sourceOperations': source_operations,
        }
        return {
            'schemaVersion': 1,
            'evidenceKind': 'codex_cli_g05_person_activity_comparison_agent_mcp',
            'runNumber': 95,
            'frontierId': 'G05',
            'scenarioId': 'G05',
            'epochId': GENERATOR.CODEX_G05_EPOCH_ID,
            'profile': 'codex-luna-max-one-tool-v1',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'reviewerId': 'gpt-6-luna-max-run95-pr130-round1',
            'codexCliVersion': '0.162.0',
            'sourceRevision': revision,
            'baseSha': base_sha,
            'prNumber': 130,
            'mcpBundleSha256': GENERATOR.codex_g26_candidate_bundle_sha256(revision),
            'observedAt': '2026-10-11T08:00:00.000Z',
            'toolName': 'bangumi.get_person_activity',
            'argumentProfile': GENERATOR.CODEX_G05_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR._canonical_json_sha256(
                GENERATOR.CODEX_G05_EXPECTED_ARGUMENTS,
            ),
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(tool['description'].encode('utf-8')).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'serverToolNames': ['bangumi.get_person_activity'],
            'serverToolCount': 1,
            'mcpServerNames': ['bgk_g05_one_tool'],
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'eventStreamParsed': True,
            'codexMcpToolEventCount': 1,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'answerCheckMethod': 'g05-bounded-person-activity-comparison-v1',
            'answerChecks': {key: True for key in GENERATOR.CODEX_G05_ANSWER_CHECK_FIELDS},
            'answerCounters': {
                'sourceRows': 1, 'answerRows': 1, 'rowsMatched': 1, 'missingRows': 0,
                'extraRows': 0, 'coverageFieldsMatched': len(GENERATOR.CODEX_G05_COVERAGE_FIELDS),
                'toolTextUtf8Bytes': 3218,
            },
            'toolCalls': [{'name': 'bangumi.get_person_activity', 'state': 'DONE'}],
            'toolTextUtf8Bytes': 3218,
            'resultSummary': result_summary,
            'resultByteLength': 2048,
            'resultSha256': 'e' * 64,
            'answerUtf8Bytes': 1024,
            'answerSha256': 'f' * 64,
            'sourceOperations': source_operations,
            'privacy': {
                'authProfile': 'anonymous',
                **{key: False for key in GENERATOR.CODEX_G05_PRIVACY_FIELDS - {'authProfile'}},
            },
        }

    def _g16_report_fixture(
        self, source_revision=None, reviewer_id='gpt-6-luna-max-run95-pr141-round1',
    ):
        catalog_bytes = self.catalog_path.read_bytes()
        tool = next(item for item in self.catalog if item['name'] == 'bangumi.get_person_activity')
        revision = source_revision or self.source_revision
        base_sha = self._git('rev-parse', f'{revision}^').stdout.strip()
        month_keys = []
        year, month = 2023, 11
        for _ in range(36):
            month_keys.append(f'{year:04d}-{month:02d}')
            month += 1
            if month == 13:
                year += 1
                month = 1
        coverage = {key: 0 for key in GENERATOR.CODEX_G16_COVERAGE_FIELDS}
        coverage.update({
            'relationRowsObserved': 60,
            'relationRowsSelected': 48,
            'relationRowsDroppedAtLimit': 4,
            'subjectIdsObserved': 52,
            'subjectIdsSelected': 48,
            'subjectIdsDroppedAtRelationLimit': 4,
            'subjectDetailIdsObserved': 48,
            'subjectDetailRequests': 16,
            'subjectDetailsSucceeded': 16,
            'subjectDetailIdsDroppedAtLimit': 32,
            'rowsEligible': 2,
            'rowsReturned': 2,
            'outputTruncated': False,
            'uniqueSubjects': 2,
            'uniqueCharacters': 0,
            'missingDateRows': 1,
            'outsideWindowRows': 32,
            'mediaExcludedRows': 7,
            'mediaUnknownRows': 1,
            'staffRoleExcludedRows': 8,
            'staffRoleUnknownRows': 2,
            'maxRelations': 48,
            'maxSubjectDetails': 16,
            'maxRows': 20,
            'responseLimitBytes': 1_048_576,
            'truncated': True,
        })
        source_operations = [
            {'operation': 'GET /v0/persons/{person_id}', 'attempted': 1, 'succeeded': 1, 'failed': 0},
            {'operation': 'GET /v0/persons/{person_id}/subjects', 'attempted': 1, 'succeeded': 1, 'failed': 0},
            {'operation': 'GET /v0/subjects/{subject_id}', 'attempted': 16, 'succeeded': 16, 'failed': 0},
        ]
        result_summary = {
            'personId': 6154,
            'kind': 'staff',
            'staffRole': 'director',
            'media': 'tv',
            'state': 'partial',
            'window': {
                'months': 36,
                'start': '2023-11-01',
                'end': '2026-10-11',
                'monthKeys': month_keys,
                'asOfSemantics': 'calendar_months_ending_on_as_of_date',
            },
            'summary': {'creditRows': 2, 'uniqueSubjects': 2, 'uniqueCharacters': 0},
            'coverage': coverage,
            'rowCount': 2,
            'rowDigest': 'd' * 64,
            'sourceOperations': source_operations,
        }
        report = {
            'schemaVersion': 1,
            'evidenceKind': 'codex_cli_g16_director_person_activity_agent_mcp',
            'runNumber': 95,
            'frontierId': 'G16',
            'scenarioId': 'G16',
            'epochId': GENERATOR.CODEX_G16_EPOCH_ID,
            'profile': 'codex-luna-max-one-tool-v1',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'reviewerId': reviewer_id,
            'codexCliVersion': '0.162.0',
            'sourceRevision': revision,
            'baseSha': base_sha,
            'prNumber': 141,
            'claimId': f'g16-run-95-pr-141-{revision[:12]}-123',
            'mcpBundleSha256': GENERATOR.codex_g26_candidate_bundle_sha256(revision),
            'runnerEventStreamSha256': '1' * 64,
            'runnerServerSummarySha256': '2' * 64,
            'observedAt': '2026-10-11T08:00:00.000Z',
            'toolName': 'bangumi.get_person_activity',
            'argumentProfile': GENERATOR.CODEX_G16_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR._canonical_json_sha256(
                GENERATOR.CODEX_G16_EXPECTED_ARGUMENTS,
            ),
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(tool['description'].encode('utf-8')).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'serverToolNames': ['bangumi.get_person_activity'],
            'serverToolCount': 1,
            'mcpServerNames': ['bgk_g16_one_tool'],
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'eventStreamParsed': True,
            'codexMcpToolEventCount': 1,
            'codexErrorItemCount': 0,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'answerCheckMethod': 'g16-bounded-director-person-activity-answer-v1',
            'answerChecks': {key: True for key in GENERATOR.CODEX_G16_ANSWER_CHECK_FIELDS},
            'answerCounters': {
                'sourceRows': 2, 'answerRows': 2, 'rowsMatched': 2, 'missingRows': 0,
                'extraRows': 0, 'coverageFieldsMatched': len(GENERATOR.CODEX_G16_COVERAGE_FIELDS),
                'toolTextUtf8Bytes': 2400,
            },
            'toolCalls': [{'name': 'bangumi.get_person_activity', 'state': 'DONE'}],
            'toolTextUtf8Bytes': 2400,
            'resultSummary': result_summary,
            'resultByteLength': 4096,
            'resultSha256': 'e' * 64,
            'answerUtf8Bytes': 1800,
            'answerSha256': 'f' * 64,
            'sourceOperations': source_operations,
            'privacy': {
                'authProfile': 'anonymous',
                **{key: False for key in GENERATOR.CODEX_G16_PRIVACY_FIELDS - {'authProfile'}},
            },
        }
        report['runnerReceipt'] = self._sign_g16_runner_receipt(
            GENERATOR.codex_g16_runner_receipt_payload(report),
        )
        return report

    def _sign_g16_runner_receipt(self, payload):
        signer_script = (
            'import { pathToFileURL } from "node:url"; '
            'import { readFileSync } from "node:fs"; '
            'const moduleUrl = pathToFileURL(process.cwd() + "/scripts/acceptance/g16-agent-mcp-runner-receipt.mjs"); '
            'const module = await import(moduleUrl); '
            'const input = JSON.parse(readFileSync(0,"utf8")); '
            'const keyPair = module.generateG16RunnerReceiptKeyPair(); '
            'process.stdout.write(JSON.stringify(module.createG16RunnerReceipt(input.payload,keyPair)));'
        )
        result = subprocess.run(
            ['node', '--input-type=module', '-e', signer_script],
            cwd=self.root,
            input=json.dumps({'payload': payload}),
            capture_output=True,
            text=True,
            check=True,
        )
        return json.loads(result.stdout)

    def _g16_harness_status_fixture(
        self, report, report_bytes=None, *, active_pr=None, github_state='OPEN',
    ):
        receipt = report['runnerReceipt']
        disposition = {
            'claimId': report['claimId'],
            'frontierId': 'G16',
            'epochId': GENERATOR.CODEX_G16_EPOCH_ID,
            'runNumber': 95,
            'toolName': report['toolName'],
            'argumentProfile': report['argumentProfile'],
            'expectedArgumentsSha256': report['expectedArgumentsSha256'],
            'state': 'REPORT_WRITTEN',
            'sourceCandidateSha': report['sourceRevision'],
            'baseSha': report['baseSha'],
            'ciSha': report['sourceRevision'],
            'ciStatus': 'SUCCESS',
            'bundleSha256': report['mcpBundleSha256'],
            'prNumber': report['prNumber'],
            'reviewerId': report['reviewerId'],
            'model': report['model'],
            'reasoningEffort': report['reasoningEffort'],
            'runnerReceiptPublicKey': receipt['publicKeyBase64'],
            'runnerReceiptPublicKeySha256': receipt['publicKeySha256'],
            'reportWritten': True,
            'reportPath': GENERATOR.CODEX_G16_REPORT_RELATIVE_PATH,
            'reportSha256': hashlib.sha256(report_bytes).hexdigest() if report_bytes else 'a' * 64,
            'runnerReceiptSha256': GENERATOR._canonical_json_sha256(receipt),
            'retryAllowed': False,
        }
        return {
            'run': {
                'number': 95,
                'state': {
                    'profile': 'AUTONOMOUS_EVOLUTION',
                    'active_epoch_pr': report['prNumber'] if active_pr is None else active_pr,
                },
            },
            'epoch': {
                'number': report['prNumber'],
                'github_state': github_state,
                'state': {
                    'epoch_id': GENERATOR.CODEX_G16_EPOCH_ID,
                    'pr_number': report['prNumber'],
                    'adversarial_preflight': {'g16_one_shot_disposition': disposition},
                },
            },
        }

    def _r01_harness_status_fixture(self, report, report_bytes):
        report_sha256 = hashlib.sha256(report_bytes).hexdigest()
        disposition = {
            'claimId': report['claimId'],
            'frontierId': 'R01',
            'epochId': GENERATOR.CODEX_R01_EPOCH_ID,
            'runNumber': 95,
            'prNumber': report['prNumber'],
            'toolName': 'bangumi.get_subject_relations',
            'argumentProfile': GENERATOR.CODEX_R01_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR._canonical_json_sha256(
                GENERATOR.CODEX_R01_PROBE_ARGUMENTS['bangumi.get_subject_relations'],
            ),
            'state': 'REPORT_WRITTEN',
            'sourceCandidateSha': report['sourceRevision'],
            'baseSha': report['baseSha'],
            'ciSha': report['sourceRevision'],
            'ciStatus': 'SUCCESS',
            'reviewerId': report['reviewerId'],
            'bundleSha256': report['mcpBundleSha256'],
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'reportWritten': True,
            'reportPath': GENERATOR.CODEX_R01_REPORT_RELATIVE_PATH,
            'reportSha256': report_sha256,
            'retryAllowed': False,
        }
        status = {
            'run': {
                'number': 95,
                'state': {
                    'profile': 'AUTONOMOUS_EVOLUTION',
                    'active_epoch_pr': report['prNumber'],
                },
            },
            'epoch': {
                'number': report['prNumber'],
                'github_state': 'OPEN',
                'pr_head_sha': report['sourceRevision'],
                'state': {
                    'epoch_id': GENERATOR.CODEX_R01_EPOCH_ID,
                    'pr_number': report['prNumber'],
                    'base_branch': 'master',
                    'base_sha': report['baseSha'],
                    'reviewed_base_sha': report['baseSha'],
                    'candidate_sha': report['sourceRevision'],
                    'review_pass_sha': report['sourceRevision'],
                    'ci': {'sha': report['sourceRevision'], 'status': 'SUCCESS'},
                    'review_history': [{
                        'candidate_sha': report['sourceRevision'],
                        'reviewed_base_sha': report['baseSha'],
                        'verdict': 'PASS',
                        'reviewer_id': report['reviewerId'],
                    }],
                    'adversarial_preflight': {'r01_one_shot_disposition': disposition},
                },
            },
        }
        latches = {
            'claim': {
                'name': GENERATOR.CODEX_R01_CLAIM_LATCH_NAME,
                'description': GENERATOR.CODEX_R01_CLAIM_LATCH_DESCRIPTION,
            },
            'terminal': {
                'name': GENERATOR.CODEX_R01_TERMINAL_LATCH_NAME,
                'description': f'R01-REPORT_WRITTEN:sha256={report_sha256}',
            },
        }
        return status, latches

    def _g16_is_valid(self, report, report_bytes=None, harness_status=None):
        bytes_value = report_bytes or json.dumps(report).encode('utf-8')
        status = harness_status or self._g16_harness_status_fixture(report, bytes_value)
        return GENERATOR.codex_g16_report_is_valid(
            report, status, hashlib.sha256(bytes_value).hexdigest(),
        )

    def _sign_g06_runner_report(self, report):
        result = subprocess.run(
            [
                'node',
                str(Path(__file__).resolve().parents[1] / 'tests/fixtures/sign-g06-runner-report.mjs'),
            ],
            cwd=Path(__file__).resolve().parents[1],
            input=json.dumps(report),
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        proof = json.loads(result.stdout)
        return proof['receiptPublicKey'], proof['runnerReceipt']

    def _g06_report_fixture(self, source_revision=None):
        tool = next((item for item in self.catalog if item['name'] == 'bangumi.get_subject_cast'), None)
        if tool is None:
            tool = {
                'name': 'bangumi.get_subject_cast',
                'auth': 'none',
                'risk': 'read',
                'description': 'Read bounded current-source subject cast rows.',
                'inputSchema': {
                    'type': 'object',
                    'properties': {'subjectId': {'type': 'integer'}, 'limit': {'type': 'integer'}},
                    'required': ['subjectId'],
                },
            }
            self.catalog.append(tool)
            self.catalog_path.write_text(json.dumps(self.catalog, ensure_ascii=False), encoding='utf-8')
        catalog_bytes = self.catalog_path.read_bytes()
        revision = source_revision or self.source_revision
        base_sha = self._git('rev-parse', f'{revision}^').stdout.strip()
        privacy = {
            'authProfile': 'anonymous',
            'oauthAttempted': False,
            'accountDataRead': False,
            'writesAttempted': False,
            'communityRead': False,
            'qqPipelineTested': False,
            'timClientTested': False,
            'promptStored': False,
            'answerStored': False,
            'rawResultStored': False,
            'artifactImageBytesStored': False,
            'credentialsStored': False,
        }
        counters = {
            'sourceRowsObserved': 1,
            'sourceRowsReturned': 1,
            'rowsUsedForAnswerCheck': 1,
            'structuredContentReadbackAvailable': True,
            'rowsOmittedFromText': 0,
            'actorRowsOmittedFromText': 0,
            'sourceTruncated': False,
            'schemaDriftRows': 0,
            'invalidActorIdRows': 0,
            'visibleCastRowsCount': 1,
            'castRowsMatchedCount': 1,
            'missingCastRowsCount': 0,
            'mismatchedCastRowsCount': 0,
            'duplicateAnswerRowsCount': 0,
            'unmatchedAnswerRowsCount': 0,
            'clippedCastRowsUnavailableCount': 0,
            'clippedActorNamesUnavailableCount': 0,
            'characterActorPairsMatchedCount': 1,
            'rawRelationLabelsMatchedCount': 1,
            'toolTextUtf8Bytes': 256,
        }
        report = {
            'schemaVersion': 1,
            'evidenceKind': 'codex_cli_g06_subject_cast_agent_mcp',
            'runNumber': 95,
            'frontierId': 'G06',
            'scenarioId': 'G06',
            'epochId': GENERATOR.CODEX_G06_EPOCH_ID,
            'claimId': f'g06-run-95-pr-170-{revision[:12]}-123',
            'prNumber': 170,
            'sourceRevision': revision,
            'baseSha': base_sha,
            'ciSha': revision,
            'ciStatus': 'SUCCESS',
            'reviewerId': 'gpt-6-luna-max-run95-pr170-round1',
            'bundleSha256': '8' * 64,
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(tool['description'].encode('utf-8')).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'observedAt': '2026-10-13T02:00:00.000Z',
            'toolName': 'bangumi.get_subject_cast',
            'argumentProfile': GENERATOR.CODEX_G06_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR._canonical_json_sha256(
                GENERATOR.CODEX_G06_EXPECTED_ARGUMENTS,
            ),
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'codexCliVersion': '0.162.0',
            'processExitCode': 0,
            'eventStreamParsed': True,
            'codexMcpToolEventCount': 1,
            'codexErrorItemCount': 0,
            'mcpServerNames': ['bgk_g06_one_tool'],
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'answerCheckMethod': GENERATOR.CODEX_G06_ANSWER_CHECK_METHOD,
            'answerChecks': {key: True for key in GENERATOR.CODEX_G06_ANSWER_CHECK_FIELDS},
            'answerCounters': counters,
            'toolResultSummary': {
                'status': 'ok',
                'subjectIdMatches': True,
                'rowsObserved': 1,
                'rowsReturned': 1,
                'rowsInReadback': 1,
                'rowsOmittedFromText': 0,
                'actorRowsOmittedFromText': 0,
                'truncated': False,
                'schemaDriftRows': 0,
                'invalidActorIdRows': 0,
                'resultSha256': '9' * 64,
            },
            'toolTextUtf8Bytes': 256,
            'answerUtf8Bytes': 512,
            'answerSha256': 'a' * 64,
            'privacy': privacy,
        }
        self.g06_receipt_public_key, report['runnerReceipt'] = self._sign_g06_runner_report(report)
        return report

    def _g06_harness_status_fixture(self, report, report_bytes):
        disposition = {
            'claimId': report['claimId'],
            'frontierId': 'G06',
            'epochId': GENERATOR.CODEX_G06_EPOCH_ID,
            'runNumber': 95,
            'prNumber': report['prNumber'],
            'toolName': report['toolName'],
            'argumentProfile': report['argumentProfile'],
            'expectedArgumentsSha256': report['expectedArgumentsSha256'],
            'state': 'REPORT_WRITTEN',
            'sourceCandidateSha': report['sourceRevision'],
            'baseSha': report['baseSha'],
            'ciSha': report['sourceRevision'],
            'ciStatus': 'SUCCESS',
            'reviewerId': report['reviewerId'],
            'bundleSha256': report['bundleSha256'],
            'model': report['model'],
            'reasoningEffort': report['reasoningEffort'],
            'reportWritten': True,
            'reportPath': GENERATOR.CODEX_G06_REPORT_RELATIVE_PATH,
            'reportSha256': hashlib.sha256(report_bytes).hexdigest(),
            'receiptPublicKey': self.g06_receipt_public_key,
            'retryAllowed': False,
        }
        return {
            'run': {
                'number': 95,
                'state': {'profile': 'AUTONOMOUS_EVOLUTION', 'active_epoch_pr': report['prNumber']},
            },
            'epoch': {
                'number': report['prNumber'],
                'github_state': 'OPEN',
                'state': {
                    'epoch_id': GENERATOR.CODEX_G06_EPOCH_ID,
                    'pr_number': report['prNumber'],
                    'adversarial_preflight': {'g06_one_shot_disposition': disposition},
                },
            },
        }

    def _g06_is_valid(self, report, report_bytes=None, harness_status=None):
        bytes_value = report_bytes or json.dumps(report).encode('utf-8')
        status = harness_status or self._g06_harness_status_fixture(report, bytes_value)
        return GENERATOR.codex_g06_report_is_valid(
            report, status, hashlib.sha256(bytes_value).hexdigest(),
        )

    def _g19_report_fixture(self, source_revision=None):
        catalog_bytes = self.catalog_path.read_bytes()
        tool = next(item for item in self.catalog if item['name'] == 'bangumi.get_person_activity')
        revision = source_revision or self.source_revision
        base_sha = self._git('rev-parse', f'{revision}^').stdout.strip()
        origin_coverage = {key: 0 for key in GENERATOR.CODEX_G19_ORIGIN_COVERAGE_FIELDS}
        origin_coverage.update({
            'explicitOriginalSubjects': 1,
            'subjectsObserved': 1,
            'subjectsWithMetaTags': 1,
            'tagsObserved': 2,
            'tagsValid': 2,
            'tagsReturned': 2,
            'maxTagsPerSubject': 32,
            'maxTagCharacters': 96,
            'responseLimitBytes': 1_048_576,
            'truncated': False,
        })
        coverage = {key: 0 for key in GENERATOR.CODEX_G19_COVERAGE_FIELDS}
        coverage.update({
            'relationRowsObserved': 1,
            'relationRowsSelected': 1,
            'relationSelectionStrategy': 'all',
            'sampled': False,
            'subjectIdsObserved': 1,
            'subjectIdsSelected': 1,
            'subjectDetailIdsObserved': 1,
            'subjectDetailRequests': 1,
            'subjectDetailsSucceeded': 1,
            'rowsEligible': 1,
            'rowsReturned': 1,
            'outputTruncated': False,
            'uniqueSubjects': 1,
            'uniqueCharacters': 1,
            'maxRelations': 48,
            'maxSubjectDetails': 16,
            'maxRows': 8,
            'detailConcurrency': 4,
            'responseLimitBytes': 1_048_576,
            'truncated': False,
            'origin': origin_coverage,
        })
        source_operations = [
            {'operation': 'GET /v0/persons/{person_id}', 'attempted': 1, 'succeeded': 1, 'failed': 0},
            {'operation': 'GET /v0/persons/{person_id}/subjects', 'attempted': 1, 'succeeded': 1, 'failed': 0},
            {'operation': 'GET /v0/persons/{person_id}/characters', 'attempted': 1, 'succeeded': 1, 'failed': 0},
            {'operation': 'GET /v0/subjects/{subject_id}', 'attempted': 1, 'succeeded': 1, 'failed': 0},
        ]
        result_summary = {
            'personId': 3474,
            'kind': 'all',
            'media': 'anime',
            'state': 'complete',
            'window': {
                'months': 3,
                'start': '2026-08-01',
                'end': '2026-10-11',
                'monthKeys': ['2026-08', '2026-09', '2026-10'],
                'asOfSemantics': 'calendar_months_ending_on_as_of_date',
            },
            'summary': {
                'creditRows': 1,
                'uniqueSubjects': 1,
                'uniqueCharacters': 1,
                'origin': {'explicitOriginalSubjects': 1, 'notObservedSubjects': 0, 'unknownSubjects': 0},
            },
            'coverage': coverage,
            'rowCount': 1,
            'rowDigest': 'd' * 64,
            'sourceOperations': source_operations,
        }
        return {
            'schemaVersion': 1,
            'evidenceKind': 'codex_g19_person_origin_agent_mcp',
            'runNumber': 95,
            'frontierId': 'G19',
            'scenarioId': 'G19',
            'epochId': GENERATOR.CODEX_G19_EPOCH_ID,
            'profile': GENERATOR.CODEX_G19_ARGUMENT_PROFILE,
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'reviewerId': 'gpt-6-luna-max-run95-pr143-round1',
            'codexCliVersion': '0.162.0',
            'sourceRevision': revision,
            'baseSha': base_sha,
            'prNumber': 143,
            'mcpBundleSha256': GENERATOR.codex_g26_candidate_bundle_sha256(revision),
            'observedAt': '2026-10-11T08:00:00.000Z',
            'toolName': 'bangumi.get_person_activity',
            'argumentProfile': GENERATOR.CODEX_G19_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR._canonical_json_sha256(
                GENERATOR.CODEX_G19_EXPECTED_ARGUMENTS,
            ),
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(tool['description'].encode('utf-8')).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'serverToolNames': ['bangumi.get_person_activity'],
            'serverToolCount': 1,
            'mcpServerNames': ['bgk_g19_one_tool'],
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'eventStreamParsed': True,
            'codexMcpToolEventCount': 1,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'answerCheckMethod': 'g19-bounded-person-origin-answer-v1',
            'answerChecks': {key: True for key in GENERATOR.CODEX_G19_ANSWER_CHECK_FIELDS},
            'answerCounters': {
                'sourceRows': 1,
                'answerRows': 1,
                'rowsMatched': 1,
                'missingRows': 0,
                'extraRows': 0,
                'coverageFieldsMatched': len(GENERATOR.CODEX_G19_COVERAGE_FIELDS)
                    + len(GENERATOR.CODEX_G19_ORIGIN_COVERAGE_FIELDS),
                'toolTextUtf8Bytes': 2400,
            },
            'toolCalls': [{
                'name': 'bangumi.get_person_activity',
                'state': 'DONE',
                'argumentsSha256': GENERATOR._canonical_json_sha256(GENERATOR.CODEX_G19_EXPECTED_ARGUMENTS),
            }],
            'toolTextUtf8Bytes': 2400,
            'resultSummary': result_summary,
            'resultByteLength': 1100,
            'resultSha256': 'e' * 64,
            'answerUtf8Bytes': 800,
            'answerSha256': 'f' * 64,
            'sourceOperations': source_operations,
            'privacy': {
                'authProfile': 'anonymous', 'oauthAttempted': False, 'accountDataRead': False,
                'writesAttempted': False, 'qqPipelineTested': False, 'timClientTested': False,
                'promptStored': False, 'answerStored': False, 'rawResultStored': False,
                'artifactImageBytesStored': False, 'credentialsStored': False, 'communityRead': False,
            },
        }

    def _s03_report_fixture(self, source_revision=None):
        catalog_bytes = self.catalog_path.read_bytes()
        tool = next(item for item in self.catalog if item['name'] == 'bangumi.get_series_watch_order')
        revision = source_revision or self.source_revision
        self.s03_control_candidate_revision = revision
        coverage = {
            'relationRowsObserved': 12,
            'eligibleDirectAnimeWorksObserved': 1,
            'eligibleDirectAnimeWorksSelected': 1,
            'eligibleDirectAnimeWorksOmitted': 0,
            'personRowsObserved': 75,
            'personRowsReturned': 75,
            'personRowsOmitted': 0,
            'matchedCreditRows': 2,
            'duplicateRows': 0,
            'schemaDriftRows': 0,
            'maxRelatedAnimeWorks': 8,
            'maxVoiceCredits': 120,
            'maxResponseBytes': 1_048_576,
            'truncated': False,
        }
        report = {
            'schemaVersion': 1,
            'evidenceKind': 'codex_cli_s03_series_voice_overlap_agent_mcp',
            'runNumber': 95,
            'scenarioId': 'S03',
            'profile': 'run95-s03-series-voice-overlap-agent-mcp-v1',
            'frontierId': 'S03',
            'sourceRevision': revision,
            'mcpBundleSha256': GENERATOR.codex_s03_candidate_bundle_sha256(revision),
            'prNumber': 128,
            'baseSha': 'b' * 40,
            'observedAt': '2026-10-08T06:00:00.000Z',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'codexCliVersion': '1.2.14',
            'toolName': 'bangumi.get_series_watch_order',
            'argumentProfile': 'fixed-s03-spy-family-goto-hiroki-voice-overlap-v1',
            'expectedArgumentsSha256': GENERATOR._canonical_json_sha256(
                GENERATOR.CODEX_S03_EXPECTED_ARGUMENTS,
            ),
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(tool['description'].encode('utf-8')).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'serverToolNames': ['bangumi.get_series_watch_order'],
            'mcpServerNames': ['bgk_s03_one_tool'],
            'serverToolCount': 1,
            'processExitCode': 0,
            'resultCount': 1,
            'eventStreamParsed': True,
            'codexMcpToolEventCount': 1,
            'nonMcpToolEventCount': 0,
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'resultStatus': 'SUCCESS',
            'toolCalls': [{'name': 'bangumi.get_series_watch_order', 'state': 'DONE'}],
            'answerCheckMethod': 's03-series-voice-overlap-answer-v1',
            'toolTextUtf8Bytes': 1800,
            'answerChecks': {
                key: True for key in GENERATOR.CODEX_S03_ANSWER_CHECK_FIELDS
            },
            'resultCounters': {
                'distinctWorks': 2,
                'answerWorks': 2,
                'matchedCreditRows': 2,
                'personRowsObserved': 75,
                'personRowsReturned': 75,
                'directAnimeWorksOmitted': 0,
                'coverageFieldsMatched': len(GENERATOR.CODEX_S03_COVERAGE_FIELDS),
            },
            'resultSummary': {
                'rootSubjectId': 329906,
                'matchStatus': 'multi_work_found',
                'distinctWorks': 2,
                'subjectIds': [329906, 373267],
                'characterIds': [71479, 7602],
                'state': 'observed',
                'coverage': coverage,
                'sourceOperationStatus': 'succeeded',
            },
            'privacy': {
                'authProfile': 'anonymous',
                **{
                    key: False
                    for key in GENERATOR.CODEX_S03_PRIVACY_FIELDS - {'authProfile'}
                },
            },
            'rawAnswerPersisted': False,
            'rawToolResultPersisted': False,
        }
        provenance = {
            'schemaVersion': 1,
            'kind': 's03-runner-evidence-digest-v1',
            'algorithm': 'Ed25519',
            'reviewerId': 'gpt-6-luna-max-run95-s03-pr128-round1',
            'keyIdSha256': hashlib.sha256(
                self.s03_test_attestation_public_key.encode('utf-8'),
            ).hexdigest(),
            'summaryPathSha256': '1' * 64,
            'serverSummarySha256': '2' * 64,
            'eventsSha256': '3' * 64,
        }
        proof_payload = {
            'sourceRevision': report['sourceRevision'],
            'baseSha': report['baseSha'],
            'bundleSha256': report['mcpBundleSha256'],
            'prNumber': report['prNumber'],
            'reviewerId': provenance['reviewerId'],
            'model': report['model'],
            'reasoningEffort': report['reasoningEffort'],
            'expectedArgumentsSha256': report['expectedArgumentsSha256'],
            'algorithm': provenance['algorithm'],
            'keyIdSha256': provenance['keyIdSha256'],
            'summaryPathSha256': provenance['summaryPathSha256'],
            'serverSummarySha256': provenance['serverSummarySha256'],
            'eventsSha256': provenance['eventsSha256'],
            'reportSha256': GENERATOR._canonical_json_sha256(report),
        }
        provenance['proofSha256'] = GENERATOR._canonical_json_sha256(proof_payload)
        provenance['signature'] = self._sign_s03_test_proof(provenance['proofSha256'])
        report['evidenceProvenance'] = provenance
        return report

    def _write_g26_frontier(self, status, source_refs=None):
        frontier_path = self.root / 'docs/product/frontier-ledger.json'
        frontier_path.parent.mkdir(parents=True, exist_ok=True)
        frontier_path.write_text(json.dumps({
            'records': [{
                'id': 'G26',
                'status': status,
                'source_refs': source_refs or ['docs/research/user-scenario-catalog.md'],
            }],
        }), encoding='utf-8')

    def _write_d07_frontier(self, status, source_refs=None):
        frontier_path = self.root / 'docs/product/frontier-ledger.json'
        frontier_path.parent.mkdir(parents=True, exist_ok=True)
        frontier_path.write_text(json.dumps({
            'records': [{
                'id': 'D07',
                'status': status,
                'source_refs': source_refs or ['docs/research/user-scenario-catalog.md'],
            }],
        }), encoding='utf-8')

    def test_g26_frontier_stays_unassessed_without_a_live_report(self):
        self._write_g26_frontier('UNASSESSED')
        self.assertTrue(GENERATOR.validate_g26_frontier_evidence())
        self.assertFalse(GENERATOR.codex_g26_report_is_valid({}))

    def test_accepts_exact_candidate_bound_sanitized_s02_report(self):
        report_path = self.live_probe_dir / Path(GENERATOR.CODEX_S02_REPORT_RELATIVE_PATH).name
        report = self._s02_report_fixture()
        report_path.write_text(json.dumps(report), encoding='utf-8')

        self.assertTrue(GENERATOR.codex_s02_probe_revision_has_implementation(self.source_revision))
        self.assertTrue(GENERATOR.codex_s02_report_is_valid(report))
        self.assertTrue(
            GENERATOR.codex_s02_report_matches_candidate_revision(
                report_path, self.source_revision,
            ),
        )
        self.assertEqual(
            GENERATOR.model_mcp_e2e_sources(self.catalog)['bangumi.get_person_activity'],
            {GENERATOR.CODEX_S02_REPORT_RELATIVE_PATH},
        )
        self.assertNotIn('answer', report)
        self.assertNotIn('prompt', report)
        self.assertNotIn('作品甲', json.dumps(report, ensure_ascii=False))

        self._git('add', GENERATOR.CODEX_S02_REPORT_RELATIVE_PATH)
        self._git('commit', '-qm', 'add sanitized S02 one-shot evidence')
        self.assertTrue(
            GENERATOR.codex_s02_report_matches_candidate_revision(
                report_path, self.source_revision,
            ),
        )

    def test_accepts_only_exact_candidate_bound_sanitized_p01_report(self):
        report_path = self.live_probe_dir / Path(GENERATOR.CODEX_P01_REPORT_RELATIVE_PATH).name
        report = self._p01_report_fixture()

        self.assertTrue(GENERATOR.codex_p01_probe_revision_has_implementation(self.source_revision))
        self.assertTrue(GENERATOR.codex_p01_report_is_valid(report))
        wrong_claim = dict(report)
        wrong_claim['claimId'] = 'p01-run-95-pr-147-000000000000-123'
        self.assertFalse(GENERATOR.codex_p01_report_is_valid(wrong_claim))
        no_runner_receipt = dict(report)
        no_runner_receipt.pop('runnerReceipt')
        self.assertFalse(GENERATOR.codex_p01_report_is_valid(no_runner_receipt))
        report_bytes = json.dumps(report).encode('utf-8')
        report_path.write_bytes(report_bytes)
        self._set_p01_control_record(report, report_bytes)
        self.assertTrue(
            GENERATOR.codex_p01_report_matches_candidate_revision(report_path, self.source_revision),
        )
        self.assertEqual(
            GENERATOR.model_mcp_e2e_sources(self.catalog)['bangumi.get_person_activity'],
            {GENERATOR.CODEX_P01_REPORT_RELATIVE_PATH},
        )
        self.assertNotIn('answer', report)
        self.assertNotIn('prompt', report)
        self.assertNotIn('rawRole', json.dumps(report))

        self._git('add', GENERATOR.CODEX_P01_REPORT_RELATIVE_PATH)
        self._git('commit', '-qm', 'add sanitized P01 one-shot evidence')
        report_commit = self._git('rev-parse', 'HEAD').stdout.strip()
        self._set_p01_control_record(
            report,
            report_bytes,
            current_candidate=self.source_revision,
            current_review_pass=self.source_revision,
            epoch_state='REVIEW_PASSED',
            pr_head_sha=report_commit,
        )
        self.assertTrue(
            GENERATOR.codex_p01_report_matches_candidate_revision(report_path, self.source_revision),
        )

        report_refresh = {
            'review_number': 1,
            'previous_candidate_sha': self.source_revision,
            'candidate_sha': report_commit,
            'reviewed_base_sha': report['baseSha'],
            'reason': 'Attach the accepted sanitized P01 report and refresh the exact Candidate.',
            'at': '2026-10-11T08:30:00.000Z',
        }
        # Harness refresh clears the original current-pass authority. The exact
        # historical PASS plus immutable disposition and refresh edge preserve
        # this report while the refreshed Candidate awaits its new review.
        self._set_p01_control_record(
            report,
            report_bytes,
            current_candidate=report_commit,
            current_review_pass=None,
            epoch_state='REVIEW_READY',
            refresh_history=[report_refresh],
            pr_head_sha=report_commit,
        )
        self.assertTrue(
            GENERATOR.codex_p01_report_matches_candidate_revision(report_path, self.source_revision),
        )
        self.assertEqual(
            GENERATOR.model_mcp_e2e_sources(self.catalog)['bangumi.get_person_activity'],
            {GENERATOR.CODEX_P01_REPORT_RELATIVE_PATH},
        )

        # A new PASS on the refreshed Candidate must not hide the report's
        # original, exact Candidate/Base/reviewer PASS.
        self._set_p01_control_record(
            report,
            report_bytes,
            current_candidate=report_commit,
            current_review_pass=report_commit,
            epoch_state='REVIEW_PASSED',
            refresh_history=[report_refresh],
            review_history=[
                {
                    'review_number': 1,
                    'candidate_sha': self.source_revision,
                    'reviewed_base_sha': report['baseSha'],
                    'reviewer_id': report['reviewerId'],
                    'verdict': 'PASS',
                },
                {
                    'review_number': 2,
                    'candidate_sha': report_commit,
                    'reviewed_base_sha': report['baseSha'],
                    'reviewer_id': report['reviewerId'],
                    'verdict': 'PASS',
                },
            ],
            pr_head_sha=report_commit,
        )
        self.assertTrue(
            GENERATOR.codex_p01_report_matches_candidate_revision(report_path, self.source_revision),
        )

        (self.root / 'later-candidate-note.txt').write_text('later corrective Candidate\n', encoding='utf-8')
        self._git('add', 'later-candidate-note.txt')
        self._git('commit', '-qm', 'advance beyond the report refresh Candidate')
        later_candidate = self._git('rev-parse', 'HEAD').stdout.strip()
        self._set_p01_control_record(
            report,
            report_bytes,
            current_candidate=later_candidate,
            current_review_pass=later_candidate,
            epoch_state='REVIEW_PASSED',
            refresh_history=[report_refresh],
            review_history=[
                {
                    'review_number': 1,
                    'candidate_sha': self.source_revision,
                    'reviewed_base_sha': report['baseSha'],
                    'reviewer_id': report['reviewerId'],
                    'verdict': 'PASS',
                },
                {
                    'review_number': 2,
                    'candidate_sha': report_commit,
                    'reviewed_base_sha': report['baseSha'],
                    'reviewer_id': report['reviewerId'],
                    'verdict': 'PASS',
                },
                {
                    'review_number': 3,
                    'candidate_sha': later_candidate,
                    'reviewed_base_sha': report['baseSha'],
                    'reviewer_id': report['reviewerId'],
                    'verdict': 'PASS',
                },
            ],
            pr_head_sha=later_candidate,
        )
        self.assertTrue(
            GENERATOR.codex_p01_report_matches_candidate_revision(report_path, self.source_revision),
            'the historical report stays bound to its direct refresh while the live PR advances',
        )

        self._set_p01_control_record(
            report,
            report_bytes,
            current_candidate=later_candidate,
            current_review_pass=later_candidate,
            epoch_state='REVIEW_PASSED',
            refresh_history=[report_refresh],
            review_history=[
                {
                    'review_number': 1,
                    'candidate_sha': self.source_revision,
                    'reviewed_base_sha': 'f' * 40,
                    'reviewer_id': report['reviewerId'],
                    'verdict': 'PASS',
                },
                {
                    'review_number': 3,
                    'candidate_sha': later_candidate,
                    'reviewed_base_sha': report['baseSha'],
                    'reviewer_id': report['reviewerId'],
                    'verdict': 'PASS',
                },
            ],
            pr_head_sha=later_candidate,
        )
        self.assertFalse(
            GENERATOR.codex_p01_report_matches_candidate_revision(report_path, self.source_revision),
            'a later PASS cannot substitute for the report Candidate/Base/reviewer PASS',
        )

        # A corrective review clears candidate_sha, but its latest immutable
        # review record still identifies the live PR head and must preserve the
        # already accepted one-shot evidence.
        self._set_p01_control_record(
            report,
            report_bytes,
            current_candidate=None,
            current_review_pass=None,
            epoch_state='CORRECTIVE_REQUIRED',
            refresh_history=[report_refresh],
            review_history=[
                {
                    'review_number': 1,
                    'candidate_sha': self.source_revision,
                    'reviewed_base_sha': report['baseSha'],
                    'reviewer_id': report['reviewerId'],
                    'verdict': 'PASS',
                },
                {
                    'review_number': 2,
                    'candidate_sha': report_commit,
                    'reviewed_base_sha': report['baseSha'],
                    'reviewer_id': report['reviewerId'],
                    'verdict': 'CORRECTIVE_REQUIRED',
                },
            ],
            pr_head_sha=report_commit,
        )
        self.assertTrue(
            GENERATOR.codex_p01_report_matches_candidate_revision(report_path, self.source_revision),
            'a later corrective verdict must not erase the historical exact PASS',
        )

        invalid_refresh = dict(report_refresh, previous_candidate_sha=self.stale_candidate_source_revision)
        self._set_p01_control_record(
            report,
            report_bytes,
            current_candidate=later_candidate,
            current_review_pass=later_candidate,
            epoch_state='REVIEW_PASSED',
            refresh_history=[invalid_refresh],
            pr_head_sha=later_candidate,
        )
        self.assertFalse(
            GENERATOR.codex_p01_report_matches_candidate_revision(report_path, self.source_revision),
            'a current PASS cannot replace the exact report Candidate refresh lineage',
        )

        self._set_p01_control_record(
            report,
            report_bytes,
            current_candidate=later_candidate,
            current_review_pass=later_candidate,
            epoch_state='REVIEW_PASSED',
            refresh_history=[report_refresh],
            pr_head_sha=later_candidate,
            pr_state='closed',
            pr_merged=False,
        )
        self.assertFalse(
            GENERATOR.codex_p01_report_matches_candidate_revision(report_path, self.source_revision),
            'a closed, unmerged PR must not authorize acceptance evidence',
        )
        self._set_p01_control_record(
            report,
            report_bytes,
            current_candidate=later_candidate,
            current_review_pass=later_candidate,
            epoch_state='REVIEW_PASSED',
            refresh_history=[report_refresh],
            pr_head_sha=later_candidate,
            pr_state='closed',
            pr_merged=True,
        )
        self.assertTrue(
            GENERATOR.codex_p01_report_matches_candidate_revision(report_path, self.source_revision),
            'a merged PR retains its accepted immutable report',
        )

        # An otherwise valid, self-consistent edit must not bypass the exact digest
        # Harness accepted before this evidence was committed.
        report_path.write_bytes(report_path.read_bytes() + b'\n')
        edited_report = json.loads(report_path.read_bytes())
        self.assertTrue(GENERATOR.codex_p01_report_is_valid(edited_report))
        self.assertFalse(
            GENERATOR.codex_p01_report_matches_candidate_revision(
                report_path, self.source_revision,
            ),
        )
        self.assertNotIn(
            GENERATOR.CODEX_P01_REPORT_RELATIVE_PATH,
            GENERATOR.model_mcp_e2e_sources(self.catalog).get(
                'bangumi.get_person_activity', set(),
            ),
        )

        stale_report = self._p01_report_fixture(self.stale_candidate_source_revision)
        self.assertTrue(GENERATOR.codex_p01_report_is_valid(stale_report))
        self.assertFalse(
            GENERATOR.codex_p01_report_matches_candidate_revision(
                report_path, self.stale_candidate_source_revision,
            ),
        )

    def test_rejects_p01_report_with_stale_gates_privacy_or_false_coverage(self):
        invalid_mutations = [
            lambda report: report.update(model='gpt-6-sol'),
            lambda report: report.update(reasoningEffort='high'),
            lambda report: report['candidateGate'].update(reviewPassSha='0' * 40),
            lambda report: report['toolCalls'].append(report['toolCalls'][0]),
            lambda report: report['runnerReceipt']['payload'].update(eventStreamParsed=False),
            lambda report: report['runnerReceipt'].update(publicKeySha256='0' * 64),
            lambda report: report['runnerReceipt'].update(publicKeyBase64='☃'),
            lambda report: report['resultSummary']['coverage'].update(truncated=True),
            lambda report: report['resultSummary'].update(rawRole='must not be retained'),
            lambda report: report['privacy'].update(communityRead=True),
        ]
        for mutate in invalid_mutations:
            with self.subTest(mutate=mutate):
                report = self._p01_report_fixture()
                mutate(report)
                self.assertFalse(GENERATOR.codex_p01_report_is_valid(report))

        complete_with_unknown_role = self._p01_report_fixture()
        complete_with_unknown_role['resultSummary']['state'] = 'complete'
        complete_with_unknown_role['resultSummary']['unknownRoleRows'] = 1
        complete_with_unknown_role['resultSummary']['roleLabelCount'] = 0
        complete_with_unknown_role['answerCounters'].update({
            'sourceRoleLabels': 0,
            'answerRoleLabels': 0,
            'knownRoleRows': 0,
            'unknownRoleRows': 1,
        })
        self.assertFalse(GENERATOR.codex_p01_report_is_valid(complete_with_unknown_role))

    def test_rejects_s02_evidence_with_wrong_rank_order_scope_or_raw_content(self):
        invalid_reports = [
            {'model': 'gpt-6-sol'},
            {'reasoningEffort': 'high'},
            {'mcpBundleSha256': '0' * 64},
            {'answerChecks': {'queryArgumentsMatch': False}},
            {'answer': 'raw response must never be retained'},
            {'resultSummary': {'state': 'complete'}},
        ]
        for override in invalid_reports:
            with self.subTest(override=override):
                report = self._s02_report_fixture()
                report.update(override)
                self.assertFalse(GENERATOR.codex_s02_report_is_valid(report))

        report = self._s02_report_fixture()
        report['resultSummary']['rows'] = [
            {'subjectId': 1001, 'ratingScore': 8.7, 'ratingTotal': 8123},
            {'subjectId': 1002, 'ratingScore': 8.9, 'ratingTotal': 8123},
        ]
        report['answerCounters'].update({
            'sourceRows': 2,
            'answerRows': 2,
            'rowsMatched': 2,
        })
        report['resultSummary']['coverage']['rowsReturned'] = 2
        self.assertFalse(GENERATOR.codex_s02_report_is_valid(report))

    def test_rejects_s02_report_from_a_stale_candidate(self):
        report_path = self.live_probe_dir / Path(GENERATOR.CODEX_S02_REPORT_RELATIVE_PATH).name
        report = self._s02_report_fixture(self.stale_candidate_source_revision)
        report_path.write_text(json.dumps(report), encoding='utf-8')
        self.assertTrue(GENERATOR.codex_s02_report_is_valid(report))
        self.assertFalse(
            GENERATOR.codex_s02_report_matches_candidate_revision(
                report_path, self.stale_candidate_source_revision,
            ),
        )

    def test_accepts_exact_candidate_bound_sanitized_g04_person_activity_report(self):
        report_path = self.live_probe_dir / Path(GENERATOR.CODEX_G04_REPORT_RELATIVE_PATH).name
        report = self._g04_report_fixture()
        report_path.write_text(json.dumps(report), encoding='utf-8')
        report_bytes = report_path.read_bytes()
        harness_status = self._g04_harness_status_fixture(report, report_bytes)
        report_sha256 = hashlib.sha256(report_bytes).hexdigest()

        self.assertTrue(GENERATOR.codex_g04_probe_revision_has_implementation(self.source_revision))
        self.assertFalse(
            GENERATOR.codex_g04_report_is_valid(report),
            'a report without the durable Harness claim is not evidence',
        )
        self.assertTrue(GENERATOR.codex_g04_report_is_valid(report, harness_status, report_sha256))
        wrong_digest_status = json.loads(json.dumps(harness_status))
        wrong_digest_disposition = wrong_digest_status['epoch']['state']['adversarial_preflight']
        wrong_digest_disposition['g04_one_shot_disposition']['reportSha256'] = 'b' * 64
        self.assertFalse(
            GENERATOR.codex_g04_report_is_valid(
                report, wrong_digest_status, report_sha256,
            ),
            'the tracked report bytes must match the durable Harness report digest',
        )
        self.assertTrue(
            GENERATOR.codex_g04_report_matches_candidate_revision(
                report_path, self.source_revision, harness_status,
            ),
        )
        with patch.object(
            GENERATOR,
            'codex_g04_harness_status',
            return_value=harness_status,
        ):
            sources = GENERATOR.model_mcp_e2e_sources(self.catalog)
        self.assertEqual(
            sources['bangumi.get_person_activity'],
            {GENERATOR.CODEX_G04_REPORT_RELATIVE_PATH},
        )
        self.assertNotIn('answer', report)
        self.assertNotIn('toolOutput', report)
        self.assertNotIn('prompt', report)

        self._git('add', GENERATOR.CODEX_G04_REPORT_RELATIVE_PATH)
        self._git('commit', '-qm', 'add sanitized G04 one-shot evidence')
        self.assertTrue(
            GENERATOR.codex_g04_report_matches_candidate_revision(
                report_path, self.source_revision, harness_status,
            ),
        )

    def test_rejects_g04_report_with_wrong_model_raw_content_or_coverage(self):
        report = self._g04_report_fixture()
        harness_status = self._g04_harness_status_fixture(report)
        invalid_reports = [
            {'model': 'gpt-6-sol'},
            {'reasoningEffort': 'high'},
            {'reviewerId': 'gpt-6-luna-max-run95-pr128-round1'},
            {'prNumber': 128},
            {'codexErrorItemCount': -1},
            {'mcpBundleSha256': '0' * 64},
            {'answerChecks': {'structuredResultReadback': False}},
            {'answer': 'raw answer must never be retained'},
        ]
        for override in invalid_reports:
            with self.subTest(override=override):
                candidate = self._g04_report_fixture()
                candidate.update(override)
                self.assertFalse(
                    GENERATOR.codex_g04_report_is_valid(candidate, harness_status, 'a' * 64),
                )

        missing_error_count = self._g04_report_fixture()
        del missing_error_count['codexErrorItemCount']
        self.assertFalse(
            GENERATOR.codex_g04_report_is_valid(missing_error_count, harness_status, 'a' * 64),
        )

        report['resultSummary']['coverage']['subjectDetailRequests'] = 48
        self.assertFalse(GENERATOR.codex_g04_report_is_valid(report, harness_status, 'a' * 64))

    def test_rejects_g04_report_from_a_stale_candidate(self):
        report_path = self.live_probe_dir / Path(GENERATOR.CODEX_G04_REPORT_RELATIVE_PATH).name
        report = self._g04_report_fixture(self.stale_candidate_source_revision)
        report_path.write_text(json.dumps(report), encoding='utf-8')
        report_bytes = report_path.read_bytes()
        harness_status = self._g04_harness_status_fixture(report, report_bytes)
        self.assertTrue(
            GENERATOR.codex_g04_report_is_valid(
                report, harness_status, hashlib.sha256(report_bytes).hexdigest(),
            ),
        )
        self.assertFalse(
            GENERATOR.codex_g04_report_matches_candidate_revision(
                report_path, self.stale_candidate_source_revision, harness_status,
            ),
        )

    def test_rejects_self_signed_g04_report_without_current_epoch_trust(self):
        active_report = self._g04_report_fixture()
        active_status = self._g04_harness_status_fixture(active_report)

        stale_pr_report = self._g04_report_fixture()
        stale_pr_report['prNumber'] = 128
        stale_pr_report['reviewerId'] = 'gpt-6-luna-max-run95-pr128-round1'
        stale_pr_report['claimId'] = 'g04-run-95-pr-128-aaaaaaaaaaaa-123'
        stale_pr_report['runnerReceipt'] = self._sign_g04_runner_receipt(
            GENERATOR.codex_g04_runner_receipt_payload(stale_pr_report),
        )
        self.assertFalse(
            GENERATOR.codex_g04_report_is_valid(
                stale_pr_report, active_status, 'a' * 64,
            ),
            'a valid signature for a stale PR/reviewer pair cannot replace the active Epoch claim',
        )

        stale_pr_status = self._g04_harness_status_fixture(stale_pr_report)
        self.assertTrue(
            GENERATOR.codex_g04_report_is_valid(
                stale_pr_report, stale_pr_status, 'a' * 64,
            ),
            'the report and its own durable claim form a valid historical pair',
        )
        stale_pr_status['run']['state']['active_epoch_pr'] = 136
        self.assertFalse(
            GENERATOR.codex_g04_report_is_valid(
                stale_pr_report, stale_pr_status, 'a' * 64,
            ),
            'an open PR claim is invalid when the Run names a different active Epoch PR',
        )

        merged_history_status = self._g04_harness_status_fixture(
            stale_pr_report, active_pr=136, github_state='MERGED',
        )
        self.assertTrue(
            GENERATOR.codex_g04_report_is_valid(
                stale_pr_report, merged_history_status, 'a' * 64,
            ),
            'a merged historical report remains valid after a later Epoch becomes active',
        )

        untrusted_report = self._g04_report_fixture()
        self.assertNotEqual(
            untrusted_report['runnerReceipt']['publicKeyBase64'],
            active_status['epoch']['state']['adversarial_preflight']
            ['g04_one_shot_disposition']['runnerReceiptPublicKey'],
        )
        self.assertFalse(
            GENERATOR.codex_g04_report_is_valid(
                untrusted_report, active_status, 'a' * 64,
            ),
            'a self-signed receipt is invalid unless its key matches the durable Harness trust anchor',
        )

        tampered_report = self._g04_report_fixture()
        signature = bytearray(base64.b64decode(tampered_report['runnerReceipt']['signature']))
        signature[0] ^= 1
        tampered_report['runnerReceipt']['signature'] = base64.b64encode(signature).decode('ascii')
        tampered_status = self._g04_harness_status_fixture(tampered_report)
        self.assertFalse(
            GENERATOR.codex_g04_report_is_valid(
                tampered_report, tampered_status, 'a' * 64,
            ),
            'well-shaped but invalid Ed25519 signatures must be rejected',
        )

    def test_accepts_exact_candidate_bound_sanitized_g05_comparison_report(self):
        report_path = self.live_probe_dir / Path(GENERATOR.CODEX_G05_REPORT_RELATIVE_PATH).name
        report = self._g05_report_fixture()
        report_path.write_text(json.dumps(report), encoding='utf-8')

        self.assertTrue(GENERATOR.codex_g05_probe_revision_has_implementation(self.source_revision))
        self.assertTrue(GENERATOR.codex_g05_report_is_valid(report))
        self.assertTrue(
            GENERATOR.codex_g05_report_matches_candidate_revision(
                report_path, self.source_revision,
            ),
        )
        self.assertEqual(
            GENERATOR.model_mcp_e2e_sources(self.catalog)['bangumi.get_person_activity'],
            {GENERATOR.CODEX_G05_REPORT_RELATIVE_PATH},
        )
        for forbidden in ('answer', 'toolOutput', 'prompt', 'rows', 'subjectName', 'rawRole'):
            self.assertNotIn(forbidden, report)

        self._git('add', GENERATOR.CODEX_G05_REPORT_RELATIVE_PATH)
        self._git('commit', '-qm', 'add sanitized G05 comparison evidence')
        self.assertTrue(
            GENERATOR.codex_g05_report_matches_candidate_revision(
                report_path, self.source_revision,
            ),
        )

    def test_rejects_g05_report_with_wrong_model_raw_content_or_comparison(self):
        invalid_reports = [
            {'model': 'gpt-6-sol'},
            {'reasoningEffort': 'high'},
            {'reviewerId': 'gpt-6-luna-max-run95-pr129-round1'},
            {'mcpBundleSha256': '0' * 64},
            {'nonMcpToolTypes': ['file_change']},
            {'answerChecks': {'exactSingleToolCall': False}},
            {'answer': 'raw answer must never be retained'},
        ]
        for override in invalid_reports:
            with self.subTest(override=override):
                candidate = self._g05_report_fixture()
                candidate.update(override)
                self.assertFalse(GENERATOR.codex_g05_report_is_valid(candidate))

        report = self._g05_report_fixture()
        report['resultSummary']['previous']['window']['end'] = '2026-04-29'
        self.assertFalse(GENERATOR.codex_g05_report_is_valid(report))

    def test_rejects_g05_incomplete_months_and_inconsistent_monthly_summary_counts(self):
        report = self._g05_report_fixture()
        report['resultSummary']['recent']['summary']['byMonth'].pop()
        self.assertFalse(GENERATOR.codex_g05_report_is_valid(report))

        report = self._g05_report_fixture()
        active_month = next(
            item for item in report['resultSummary']['recent']['summary']['byMonth']
            if item['month'] == '2026-05'
        )
        active_month['creditRows'] = 0
        self.assertFalse(GENERATOR.codex_g05_report_is_valid(report))

        report = self._g05_report_fixture()
        active_month = next(
            item for item in report['resultSummary']['recent']['summary']['byMonth']
            if item['month'] == '2026-05'
        )
        active_month['uniqueSubjects'] = 2
        self.assertFalse(GENERATOR.codex_g05_report_is_valid(report))

        report = self._g05_report_fixture()
        active_month = next(
            item for item in report['resultSummary']['recent']['summary']['byMonth']
            if item['month'] == '2026-05'
        )
        active_month['uniqueSubjects'] = 0
        self.assertFalse(GENERATOR.codex_g05_report_is_valid(report))

    def test_rejects_g05_impossible_coverage_count_relationships(self):
        report = self._g05_report_fixture()
        coverage = report['resultSummary']['recent']['coverage']
        coverage['subjectIdsObserved'] = 2
        coverage['subjectIdsDroppedAtRelationLimit'] = 1
        self.assertFalse(GENERATOR.codex_g05_report_is_valid(report))

        report = self._g05_report_fixture()
        coverage = report['resultSummary']['recent']['coverage']
        coverage.update({
            'relationRowsObserved': 2,
            'relationRowsDroppedAtLimit': 1,
            'subjectIdsObserved': 2,
            'subjectIdsSelected': 2,
            'subjectDetailIdsObserved': 2,
            'subjectDetailRequests': 2,
            'subjectDetailsSucceeded': 2,
        })
        details_operation = report['sourceOperations']['recent']['GET /v0/subjects/{subject_id}']
        details_operation.update({'attempted': 2, 'succeeded': 2})
        self.assertFalse(GENERATOR.codex_g05_report_is_valid(report))

        report = self._g05_report_fixture()
        coverage = report['resultSummary']['recent']['coverage']
        coverage['subjectDetailRequests'] = 2
        coverage['subjectDetailsSucceeded'] = 2
        details_operation = report['sourceOperations']['recent']['GET /v0/subjects/{subject_id}']
        details_operation.update({'attempted': 2, 'succeeded': 2})
        self.assertFalse(GENERATOR.codex_g05_report_is_valid(report))

        report = self._g05_report_fixture()
        coverage = report['resultSummary']['recent']['coverage']
        coverage.update({'rowsEligible': 2, 'outputTruncated': True, 'truncated': True})
        recent_summary = report['resultSummary']['recent']['summary']
        recent_summary['creditRows'] = 2
        active_month = next(item for item in recent_summary['byMonth'] if item['month'] == '2026-05')
        active_month['creditRows'] = 2
        report['resultSummary']['delta']['creditRows'] = 0
        self.assertFalse(GENERATOR.codex_g05_report_is_valid(report))

    def test_rejects_g05_report_from_a_stale_candidate(self):
        report_path = self.live_probe_dir / Path(GENERATOR.CODEX_G05_REPORT_RELATIVE_PATH).name
        report = self._g05_report_fixture(self.stale_candidate_source_revision)
        report_path.write_text(json.dumps(report), encoding='utf-8')
        self.assertTrue(GENERATOR.codex_g05_report_is_valid(report))
        self.assertFalse(
            GENERATOR.codex_g05_report_matches_candidate_revision(
                report_path, self.stale_candidate_source_revision,
            ),
        )

    def test_accepts_exact_candidate_bound_sanitized_g16_director_report(self):
        report_path = self.live_probe_dir / Path(GENERATOR.CODEX_G16_REPORT_RELATIVE_PATH).name
        report = self._g16_report_fixture()
        report_path.write_text(json.dumps(report), encoding='utf-8')
        report_bytes = report_path.read_bytes()
        report_sha256 = hashlib.sha256(report_bytes).hexdigest()
        harness_status = self._g16_harness_status_fixture(report, report_bytes)

        self.assertTrue(GENERATOR.codex_g16_probe_revision_has_implementation(self.source_revision))
        self.assertTrue(GENERATOR.codex_g16_report_is_valid(report, harness_status, report_sha256))
        self.assertTrue(
            GENERATOR.codex_g16_report_matches_candidate_revision(
                report_path, self.source_revision,
            ),
        )
        with patch.object(GENERATOR, 'codex_g16_harness_status', return_value=harness_status):
            self.assertEqual(
                GENERATOR.model_mcp_e2e_sources(self.catalog)['bangumi.get_person_activity'],
                {GENERATOR.CODEX_G16_REPORT_RELATIVE_PATH},
            )
        for forbidden in ('answer', 'toolOutput', 'prompt', 'rows', 'subjectName', 'rawRole'):
            self.assertNotIn(forbidden, report)

        self._git('add', GENERATOR.CODEX_G16_REPORT_RELATIVE_PATH)
        self._git('commit', '-qm', 'add sanitized G16 director evidence')
        self.assertTrue(
            GENERATOR.codex_g16_report_matches_candidate_revision(
                report_path, self.source_revision,
            ),
        )

    def test_accepts_g16_report_with_exact_stable_harness_reviewer_identity(self):
        reviewer_id = 'run95-g16-review1-gpt-6-luna-max-98df510'
        report = self._g16_report_fixture(reviewer_id=reviewer_id)
        report_bytes = json.dumps(report).encode('utf-8')
        status = self._g16_harness_status_fixture(report, report_bytes)
        self.assertTrue(GENERATOR.codex_g16_report_is_valid(
            report, status, hashlib.sha256(report_bytes).hexdigest(),
        ))
        mismatched_status = self._g16_harness_status_fixture(report, report_bytes)
        mismatched_status['epoch']['state']['adversarial_preflight']['g16_one_shot_disposition'][
            'reviewerId'
        ] = 'run95-g16-review2-gpt-6-luna-max-deadbee'
        self.assertFalse(GENERATOR.codex_g16_report_is_valid(
            report, mismatched_status, hashlib.sha256(report_bytes).hexdigest(),
        ))

        wrong_role = self._g16_report_fixture(
            reviewer_id='run95-g16-review1-gpt-5-sol-98df510',
        )
        wrong_role_bytes = json.dumps(wrong_role).encode('utf-8')
        wrong_role_status = self._g16_harness_status_fixture(wrong_role, wrong_role_bytes)
        self.assertFalse(GENERATOR.codex_g16_report_is_valid(
            wrong_role, wrong_role_status, hashlib.sha256(wrong_role_bytes).hexdigest(),
        ))

    def test_rejects_g16_report_with_wrong_profile_or_impossible_role_coverage(self):
        invalid_reports = [
            {'model': 'gpt-6-sol'},
            {'reasoningEffort': 'high'},
            {'reviewerId': 'gpt-6-luna-max-run95-pr142-round1'},
            {'nonMcpToolTypes': ['error']},
            {'answerChecks': {'answerRowsMatch': False}},
            {'answer': 'raw answer must never be retained'},
        ]
        for override in invalid_reports:
            with self.subTest(override=override):
                candidate = self._g16_report_fixture()
                candidate.update(override)
                self.assertFalse(self._g16_is_valid(candidate))

        report = self._g16_report_fixture()
        report['resultSummary']['coverage']['staffRoleUnknownRows'] = 20
        self.assertFalse(self._g16_is_valid(report))

        report = self._g16_report_fixture()
        report['resultSummary']['window']['monthKeys'].pop()
        self.assertFalse(self._g16_is_valid(report))

        report = self._g16_report_fixture()
        report['runnerReceipt']['signature'] = 'A' * 88
        self.assertFalse(self._g16_is_valid(report))

        report = self._g16_report_fixture()
        report_bytes = json.dumps(report).encode('utf-8')
        wrong_status = self._g16_harness_status_fixture(report, report_bytes)
        wrong_status['epoch']['state']['adversarial_preflight']['g16_one_shot_disposition']['reportSha256'] = 'b' * 64
        self.assertFalse(GENERATOR.codex_g16_report_is_valid(
            report, wrong_status, hashlib.sha256(report_bytes).hexdigest(),
        ))

    def test_rejects_g16_report_from_a_stale_candidate(self):
        report_path = self.live_probe_dir / Path(GENERATOR.CODEX_G16_REPORT_RELATIVE_PATH).name
        report = self._g16_report_fixture(self.stale_candidate_source_revision)
        report_path.write_text(json.dumps(report), encoding='utf-8')
        report_bytes = report_path.read_bytes()
        status = self._g16_harness_status_fixture(report, report_bytes)
        self.assertTrue(GENERATOR.codex_g16_report_is_valid(
            report, status, hashlib.sha256(report_bytes).hexdigest(),
        ))
        self.assertFalse(
            GENERATOR.codex_g16_report_matches_candidate_revision(
                report_path, self.stale_candidate_source_revision,
            ),
        )

    def test_accepts_exact_candidate_bound_sanitized_g06_subject_cast_report(self):
        report_path = self.live_probe_dir / Path(GENERATOR.CODEX_G06_REPORT_RELATIVE_PATH).name
        report = self._g06_report_fixture()
        report_path.write_text(json.dumps(report), encoding='utf-8')
        report_bytes = report_path.read_bytes()
        report_sha256 = hashlib.sha256(report_bytes).hexdigest()
        harness_status = self._g06_harness_status_fixture(report, report_bytes)
        with (
            patch.object(GENERATOR, 'codex_g06_probe_revision_has_implementation', return_value=True),
            patch.object(GENERATOR, 'codex_g26_candidate_bundle_sha256', return_value=report['bundleSha256']),
            patch.object(GENERATOR, 'codex_g06_harness_status', return_value=harness_status),
        ):
            self.assertTrue(GENERATOR.codex_g06_report_is_valid(report, harness_status, report_sha256))
            self.assertTrue(
                GENERATOR.codex_g06_report_matches_candidate_revision(
                    report_path, self.source_revision,
                ),
            )
            self.assertEqual(
                GENERATOR.model_mcp_e2e_sources(self.catalog)['bangumi.get_subject_cast'],
                {GENERATOR.CODEX_G06_REPORT_RELATIVE_PATH},
            )
        for forbidden in ('answer', 'toolOutput', 'prompt', 'rawRows', 'rawResult', 'characterName'):
            self.assertNotIn(forbidden, report)

        self._git('add', GENERATOR.CODEX_G06_REPORT_RELATIVE_PATH)
        self._git('commit', '-qm', 'add sanitized G06 subject cast evidence')
        with patch.object(GENERATOR, 'codex_g06_probe_revision_has_implementation', return_value=True):
            self.assertTrue(
                GENERATOR.codex_g06_report_matches_candidate_revision(
                    report_path, self.source_revision,
                ),
            )

    def test_rejects_g06_reports_with_changed_scope_privacy_or_harness_digest(self):
        report = self._g06_report_fixture()
        report_bytes = json.dumps(report).encode('utf-8')
        status = self._g06_harness_status_fixture(report, report_bytes)
        with (
            patch.object(GENERATOR, 'codex_g06_probe_revision_has_implementation', return_value=True),
            patch.object(GENERATOR, 'codex_g26_candidate_bundle_sha256', return_value=report['bundleSha256']),
        ):
            self.assertTrue(self._g06_is_valid(report, report_bytes, status))
            for override in (
                {'model': 'gpt-6-sol'},
                {'reasoningEffort': 'high'},
                {'toolName': 'bangumi.get_subject_relations'},
                {'answerChecks': {**report['answerChecks'], 'serverPrivacySafe': False}},
                {'answerChecks': {**report['answerChecks'], 'boundedAnswerBytes': False}},
                {'answerUtf8Bytes': 3601},
            ):
                with self.subTest(override=override):
                    invalid = {**report, **override}
                    invalid_bytes = json.dumps(invalid).encode('utf-8')
                    invalid_status = self._g06_harness_status_fixture(invalid, invalid_bytes)
                    self.assertFalse(self._g06_is_valid(invalid, invalid_bytes, invalid_status))

            unsafe = json.loads(json.dumps(report))
            unsafe['privacy']['accountDataRead'] = True
            unsafe_bytes = json.dumps(unsafe).encode('utf-8')
            unsafe_status = self._g06_harness_status_fixture(unsafe, unsafe_bytes)
            self.assertFalse(self._g06_is_valid(unsafe, unsafe_bytes, unsafe_status))

            wrong_digest_status = self._g06_harness_status_fixture(report, report_bytes)
            wrong_digest_status['epoch']['state']['adversarial_preflight']['g06_one_shot_disposition'][
                'reportSha256'
            ] = 'b' * 64
            self.assertFalse(self._g06_is_valid(report, report_bytes, wrong_digest_status))

    def test_reconciliation_evidence_requires_a_runner_signature_bound_to_the_durable_claim(self):
        report = self._g06_report_fixture()
        durable_public_key = self.g06_receipt_public_key
        report_without_receipt = {key: value for key, value in report.items() if key != 'runnerReceipt'}
        other_public_key, other_receipt = self._sign_g06_runner_report(report_without_receipt)
        self.assertNotEqual(other_public_key, durable_public_key)
        report_without_receipt['runnerReceipt'] = other_receipt
        report_bytes = json.dumps(report_without_receipt).encode('utf-8')
        self.g06_receipt_public_key = durable_public_key
        status = self._g06_harness_status_fixture(report_without_receipt, report_bytes)

        self.assertFalse(self._g06_is_valid(report_without_receipt, report_bytes, status))

        forged = {key: value for key, value in report.items() if key != 'runnerReceipt'}
        forged_bytes = json.dumps(forged).encode('utf-8')
        self.g06_receipt_public_key = durable_public_key
        forged_status = self._g06_harness_status_fixture(forged, forged_bytes)
        self.assertFalse(self._g06_is_valid(forged, forged_bytes, forged_status))

    def test_accepts_exact_candidate_bound_sanitized_g19_person_origin_report(self):
        report_path = self.live_probe_dir / Path(GENERATOR.CODEX_G19_REPORT_RELATIVE_PATH).name
        report = self._g19_report_fixture()
        report_path.write_text(json.dumps(report), encoding='utf-8')

        self.assertTrue(GENERATOR.codex_g19_probe_revision_has_implementation(self.source_revision))
        self.assertTrue(GENERATOR.codex_g19_report_is_valid(report))
        self.assertTrue(
            GENERATOR.codex_g19_report_matches_candidate_revision(
                report_path, self.source_revision,
            ),
        )
        self.assertEqual(
            GENERATOR.model_mcp_e2e_sources(self.catalog)['bangumi.get_person_activity'],
            {GENERATOR.CODEX_G19_REPORT_RELATIVE_PATH},
        )
        for forbidden in ('answer', 'toolOutput', 'prompt', 'rows', 'subjectName', 'rawRole', 'metaTags'):
            self.assertNotIn(forbidden, report)

        self._git('add', GENERATOR.CODEX_G19_REPORT_RELATIVE_PATH)
        self._git('commit', '-qm', 'add sanitized G19 person origin evidence')
        self.assertTrue(
            GENERATOR.codex_g19_report_matches_candidate_revision(
                report_path, self.source_revision,
            ),
        )

    def test_rejects_g19_wrong_profile_or_impossible_origin_coverage(self):
        invalid_reports = [
            {'model': 'gpt-6-sol'},
            {'reasoningEffort': 'high'},
            {'reviewerId': 'gpt-6-luna-max-run95-pr142-round1'},
            {'nonMcpToolTypes': ['error']},
            {'answerChecks': {'answerGroupsMatch': False}},
            {'answer': 'raw answer must never be retained'},
            {'toolCalls': [{'name': 'bangumi.get_person_activity', 'state': 'DONE'}]},
        ]
        for override in invalid_reports:
            with self.subTest(override=override):
                candidate = self._g19_report_fixture()
                candidate.update(override)
                self.assertFalse(GENERATOR.codex_g19_report_is_valid(candidate))

        report = self._g19_report_fixture()
        report['resultSummary']['coverage']['origin']['unknownSubjects'] = 1
        self.assertFalse(GENERATOR.codex_g19_report_is_valid(report))

        report = self._g19_report_fixture()
        report['resultSummary']['coverage']['origin']['tagsOmitted'] = 1
        self.assertFalse(GENERATOR.codex_g19_report_is_valid(report))

        partial_origin_updates = [
            {'subjectsPartial': 1},
            {'malformedTagValues': 1, 'tagsObserved': 3, 'tagsValid': 2, 'tagsReturned': 2},
            {'textTruncatedTags': 1, 'truncated': True},
        ]
        for updates in partial_origin_updates:
            with self.subTest(updates=updates):
                report = self._g19_report_fixture()
                report['resultSummary']['coverage']['origin'].update(updates)
                self.assertFalse(GENERATOR.codex_g19_report_is_valid(report))

        partial_origin_updates = [
            {'subjectsPartial': 1},
            {'malformedTagValues': 1, 'tagsObserved': 3, 'tagsValid': 2, 'tagsReturned': 2},
            {'textTruncatedTags': 1, 'truncated': True},
        ]
        for updates in partial_origin_updates:
            with self.subTest(updates=updates):
                report = self._g19_report_fixture()
                report['resultSummary']['coverage']['origin'].update(updates)
                self.assertFalse(GENERATOR.codex_g19_report_is_valid(report))

    def test_rejects_g19_report_from_a_stale_candidate(self):
        report_path = self.live_probe_dir / Path(GENERATOR.CODEX_G19_REPORT_RELATIVE_PATH).name
        report = self._g19_report_fixture(self.stale_candidate_source_revision)
        report_path.write_text(json.dumps(report), encoding='utf-8')
        self.assertTrue(GENERATOR.codex_g19_report_is_valid(report))
        self.assertFalse(
            GENERATOR.codex_g19_report_matches_candidate_revision(
                report_path, self.stale_candidate_source_revision,
            ),
        )

    def test_accepts_exact_candidate_bound_s03_positive_agent_mcp_report(self):
        report_path = self.live_probe_dir / Path(GENERATOR.CODEX_S03_REPORT_RELATIVE_PATH).name
        report = self._s03_report_fixture()
        report_path.write_text(json.dumps(report), encoding='utf-8')

        self.assertTrue(GENERATOR.codex_s03_probe_revision_has_implementation(self.source_revision))
        self.assertTrue(GENERATOR.codex_s03_report_is_valid(report))
        self.assertTrue(
            GENERATOR.codex_s03_report_matches_candidate_revision(
                report_path, self.source_revision,
            ),
        )
        self.assertEqual(
            GENERATOR.model_mcp_e2e_sources(self.catalog)['bangumi.get_series_watch_order'],
            {GENERATOR.CODEX_S03_REPORT_RELATIVE_PATH},
        )
        self.assertEqual(
            GENERATOR.public_api_smoke_sources(self.catalog)['bangumi.get_series_watch_order'],
            {GENERATOR.CODEX_S03_REPORT_RELATIVE_PATH},
        )
        self.assertNotIn('answer', report)
        self.assertNotIn('prompt', report)
        self.assertNotIn('角色甲', json.dumps(report, ensure_ascii=False))

        self._git('add', GENERATOR.CODEX_S03_REPORT_RELATIVE_PATH)
        self._git('commit', '-qm', 'add sanitized S03 one-shot evidence')
        self.assertTrue(
            GENERATOR.codex_s03_report_matches_candidate_revision(
                report_path, self.source_revision,
            ),
        )

    def test_rejects_s03_report_without_positive_id_grounded_scope_or_privacy(self):
        report = self._s03_report_fixture()
        invalid_reports = [
            {'model': 'gpt-6-sol'},
            {'reasoningEffort': 'high'},
            {'mcpBundleSha256': '0' * 64},
            {'answerChecks': {'twoDistinctWorksMatched': False}},
            {'resultCounters': {**report['resultCounters'], 'distinctWorks': 1}},
            {'resultSummary': {**report['resultSummary'], 'subjectIds': [329906]}},
            {
                'evidenceProvenance': {
                    **report['evidenceProvenance'],
                    'eventsSha256': '4' * 64,
                },
            },
            {
                'evidenceProvenance': {
                    **report['evidenceProvenance'],
                    'proofSha256': '0' * 64,
                },
            },
            {
                'evidenceProvenance': {
                    **report['evidenceProvenance'],
                    'signature': (
                        ('B' if report['evidenceProvenance']['signature'][0] == 'A' else 'A')
                        + report['evidenceProvenance']['signature'][1:]
                    ),
                },
            },
            {'privacy': {**report['privacy'], 'accountDataRead': True}},
            {'answer': 'raw answer must never persist'},
        ]
        for override in invalid_reports:
            with self.subTest(override=override):
                candidate = {**report, **override}
                self.assertFalse(GENERATOR.codex_s03_report_is_valid(candidate))

    def test_rejects_s03_report_from_a_stale_candidate(self):
        report_path = self.live_probe_dir / Path(GENERATOR.CODEX_S03_REPORT_RELATIVE_PATH).name
        report = self._s03_report_fixture(self.stale_candidate_source_revision)
        report_path.write_text(json.dumps(report), encoding='utf-8')
        self.assertTrue(GENERATOR.codex_s03_report_is_valid(report))
        self.assertFalse(
            GENERATOR.codex_s03_report_matches_candidate_revision(
                report_path, report['sourceRevision'],
            ),
        )

    def test_requires_the_candidate_pass_and_trusted_key_from_harness_control_plane(self):
        report = self._s03_report_fixture()
        self.s03_control_key_sha256 = '0' * 64
        self.assertFalse(GENERATOR.codex_s03_report_is_valid(report))

        self.s03_control_key_sha256 = hashlib.sha256(
            self.s03_test_attestation_public_key.encode('utf-8'),
        ).hexdigest()
        self.s03_control_available = False
        self.assertFalse(GENERATOR.codex_s03_report_is_valid(report))

    def test_accepts_candidate_bound_sanitized_g26_report_and_partial_frontier(self):
        report_path = self.live_probe_dir / 'g26-exact-tag-agent-mcp-run95.json'
        report_path.write_text(json.dumps(self._g26_report_fixture()), encoding='utf-8')
        self._write_g26_frontier('PARTIAL', [
            'docs/research/user-scenario-catalog.md',
            GENERATOR.CODEX_G26_REPORT_RELATIVE_PATH,
        ])

        report = json.loads(report_path.read_text(encoding='utf-8'))
        self.assertTrue(GENERATOR.codex_g26_probe_revision_has_implementation(self.source_revision))
        self.assertTrue(GENERATOR.codex_g26_report_is_valid(report))
        self.assertTrue(
            GENERATOR.codex_g26_report_matches_candidate_revision(
                report_path, self.source_revision,
            ),
        )
        self.assertTrue(GENERATOR.validate_g26_frontier_evidence())
        self.assertNotIn('answer', report)
        self.assertNotIn('prompt', report)
        self.assertNotIn('items', report['resultCounters'])

        self._git('add', 'docs/live-probes/g26-exact-tag-agent-mcp-run95.json')
        self._git('commit', '-qm', 'add sanitized G26 evidence after its candidate')
        self.assertTrue(
            GENERATOR.codex_g26_report_matches_candidate_revision(
                report_path, self.source_revision,
            ),
        )

    def test_rejects_stale_or_unreferenced_g26_evidence_before_frontier_promotion(self):
        report_path = self.live_probe_dir / 'g26-exact-tag-agent-mcp-run95.json'
        report_path.write_text(
            json.dumps(self._g26_report_fixture(self.stale_candidate_source_revision)),
            encoding='utf-8',
        )
        self._write_g26_frontier('PARTIAL', [
            'docs/research/user-scenario-catalog.md',
            GENERATOR.CODEX_G26_REPORT_RELATIVE_PATH,
        ])
        report = json.loads(report_path.read_text(encoding='utf-8'))
        self.assertTrue(GENERATOR.codex_g26_report_is_valid(report))
        self.assertFalse(
            GENERATOR.codex_g26_report_matches_candidate_revision(
                report_path, self.stale_candidate_source_revision,
            ),
        )
        self.assertFalse(GENERATOR.validate_g26_frontier_evidence())

        self._write_g26_frontier('PARTIAL')
        self.assertFalse(GENERATOR.validate_g26_frontier_evidence())

    def test_rejects_g26_evidence_that_matches_only_a_clipped_text_projection(self):
        report = self._g26_report_fixture()
        counters = report['resultCounters']
        counters['textRowsIncluded'] = 1
        counters['textRowsOmitted'] = 1
        counters['answerRowsParsed'] = 1
        counters['rowsMatched'] = 1

        self.assertFalse(GENERATOR.codex_g26_report_is_valid(report))

    def test_d07_frontier_stays_unassessed_until_the_claim_bound_report_is_accepted(self):
        self._write_d07_frontier('UNASSESSED')
        self.assertTrue(GENERATOR.validate_d07_frontier_evidence())
        self.assertFalse(GENERATOR.codex_d07_report_is_valid({}))

    def test_accepts_only_exact_candidate_bound_d07_report_and_terminal_harness_claim(self):
        report_path = self.live_probe_dir / Path(GENERATOR.CODEX_D07_REPORT_RELATIVE_PATH).name
        report = self._d07_report_fixture()
        report_text = json.dumps(report, ensure_ascii=False, indent=2) + '\n'
        report_bytes = report_text.encode('utf-8')
        report_path.write_bytes(report_bytes)
        report_sha256 = hashlib.sha256(report_bytes).hexdigest()
        harness_status = self._d07_harness_status_fixture(report, report_bytes)
        self._write_d07_frontier('PARTIAL', [
            'docs/research/user-scenario-catalog.md',
            GENERATOR.CODEX_D07_REPORT_RELATIVE_PATH,
        ])

        self.assertTrue(GENERATOR.codex_d07_probe_revision_has_implementation(self.source_revision))
        self.assertTrue(GENERATOR.codex_d07_report_is_valid(report, harness_status, report_sha256))
        self.assertTrue(
            GENERATOR.codex_d07_harness_disposition_matches_report(
                report, harness_status, report_sha256,
            ),
        )
        self.assertTrue(
            GENERATOR.codex_d07_report_matches_candidate_revision(
                report_path, self.source_revision,
            ),
        )
        with patch.object(
            GENERATOR, 'codex_d07_harness_status', return_value=harness_status,
        ):
            self.assertTrue(GENERATOR.validate_d07_frontier_evidence())

        self._git('add', GENERATOR.CODEX_D07_REPORT_RELATIVE_PATH)
        self._git('commit', '-qm', 'add sanitized D07 evidence after its candidate')
        self.assertTrue(
            GENERATOR.codex_d07_report_matches_candidate_revision(
                report_path, self.source_revision,
            ),
        )
        with patch.object(
            GENERATOR, 'codex_d07_harness_status', return_value=harness_status,
        ):
            self.assertEqual(
                GENERATOR.model_mcp_e2e_sources(self.catalog)['bangumi.query_subjects'],
                {GENERATOR.CODEX_D07_REPORT_RELATIVE_PATH},
            )

        self.assertNotIn('answer', report)
        self.assertNotIn('toolCalls', report)
        self.assertNotIn('Example anime', report_text)

    def test_d07_report_rejects_raw_fields_wrong_years_and_wrong_terminal_digest(self):
        report = self._d07_report_fixture()
        invalid_reports = [
            {**report, 'answer': 'raw output'},
            {**report, 'resultSummaries': report['resultSummaries'][:-1]},
            {
                **report,
                'resultSummaries': [
                    {**report['resultSummaries'][0], 'retrievedAt': 'invalid-time'},
                    *report['resultSummaries'][1:],
                ],
            },
            {
                **report,
                'coverageSummaries': [
                    {**report['coverageSummaries'][0], 'scanned': 0},
                    *report['coverageSummaries'][1:],
                ],
            },
            {**report, 'model': 'gpt-6-sol'},
            {
                **report,
                'answerChecks': {**report['answerChecks'], 'historicalRankNotClaimed': False},
            },
        ]
        for invalid in invalid_reports:
            with self.subTest(keys=set(invalid)):
                self.assertFalse(GENERATOR.codex_d07_report_is_valid(invalid))

        report_bytes = json.dumps(report).encode('utf-8')
        status = self._d07_harness_status_fixture(report, report_bytes)
        self.assertIsNone(
            GENERATOR.codex_d07_harness_disposition_matches_report(
                report, status, '0' * 64,
            ),
        )
        self._write_d07_frontier('PARTIAL')
        self.assertFalse(GENERATOR.validate_d07_frontier_evidence())

    def test_g26_candidate_validation_ignores_caller_git_repository_overrides(self):
        expected = GENERATOR.codex_g26_candidate_bundle_sha256(self.source_revision)
        self.assertRegex(expected or '', r'^[0-9a-f]{64}$')
        report_path = self.live_probe_dir / 'g26-exact-tag-agent-mcp-run95.json'
        report_path.write_text(
            json.dumps(self._g26_report_fixture()),
            encoding='utf-8',
        )
        self._git('add', report_path.relative_to(self.root).as_posix())
        self._git('commit', '-qm', 'add sanitized G26 evidence after its candidate')
        self.assertTrue(
            GENERATOR.codex_g26_report_matches_candidate_revision(
                report_path, self.source_revision,
            ),
        )

        alternate = self.root / 'alternate-git-context'
        alternate.mkdir()
        subprocess.run(['git', 'init', '-q'], cwd=alternate, check=True)
        caller_global_config = self.root / 'caller-global.gitconfig'
        caller_global_config.write_text(
            f'[core]\n\tworktree = {alternate}\n',
            encoding='utf-8',
        )
        caller_system_config = self.root / 'caller-system.gitconfig'
        caller_system_config.write_text(
            f'[core]\n\tworktree = {alternate}\n',
            encoding='utf-8',
        )
        overrides = {
            'GIT_DIR': str(alternate / '.git'),
            'GIT_WORK_TREE': str(alternate),
            'GIT_COMMON_DIR': str(alternate / '.git'),
            'GIT_INDEX_FILE': str(alternate / '.git' / 'index'),
            'GIT_CONFIG_COUNT': '1',
            'GIT_CONFIG_KEY_0': 'core.worktree',
            'GIT_CONFIG_VALUE_0': str(alternate),
            'GIT_CONFIG_GLOBAL': str(caller_global_config),
            'GIT_CONFIG_SYSTEM': str(caller_system_config),
            'GIT_CONFIG_NOSYSTEM': '0',
        }
        previous = {key: os.environ.get(key) for key in overrides}
        try:
            os.environ.update(overrides)
            sanitized_environment = GENERATOR._sanitized_repository_git_environment()
            self.assertEqual(sanitized_environment['GIT_CONFIG_GLOBAL'], os.devnull)
            self.assertEqual(sanitized_environment['GIT_CONFIG_SYSTEM'], os.devnull)
            self.assertEqual(sanitized_environment['GIT_CONFIG_NOSYSTEM'], '1')
            GENERATOR._codex_probe_revision_has_implementation.cache_clear()
            self.assertTrue(GENERATOR._codex_revision_has_markers(
                str(self.root),
                self.source_revision,
                GENERATOR.CODEX_G26_PROBE_IMPLEMENTATION_MARKERS,
            ))
            self.assertEqual(
                GENERATOR.codex_g26_candidate_bundle_sha256(self.source_revision),
                expected,
            )
            GENERATOR._codex_probe_revision_has_implementation.cache_clear()
            self.assertTrue(
                GENERATOR.codex_g26_report_matches_candidate_revision(
                    report_path, self.source_revision,
                ),
            )
        finally:
            for key, value in previous.items():
                if value is None:
                    os.environ.pop(key, None)
                else:
                    os.environ[key] = value
            GENERATOR._codex_probe_revision_has_implementation.cache_clear()

    def test_rejects_g26_report_with_raw_data_wrong_scope_or_failed_answer_checks(self):
        invalid_reports = [
            {'answer': 'raw answer must not be persisted'},
            {'sourceRevision': self.unrelated_source_revision},
            {'mcpBundleSha256': 'c' * 64},
            {'expectedArgumentsSha256': '0' * 64},
            {'answerChecks': {'passed': False}},
            {'resultCounters': {'visibleSourceRows': 2}},
            {'warningCodes': []},
            {'privacy': {'authProfile': 'anonymous', 'rawResultStored': True}},
        ]
        for override in invalid_reports:
            with self.subTest(override=override):
                report = self._g26_report_fixture()
                report.update(override)
                self.assertFalse(GENERATOR.codex_g26_report_is_valid(report))

    @staticmethod
    def _a01_subject(subject_id, name, state='available', deviation=1.2):
        subject = {
            'id': subject_id,
            'name': name,
            'displayName': name,
            'ratingStandardDeviationState': state,
        }
        if state in {'available', 'partial'}:
            subject.update({
                'ratingCount': 100,
                'ratingHistogramPopulation': 100,
                'ratingStandardDeviation': deviation,
            })
        return subject

    @staticmethod
    def _a01_query_plan(index):
        def plan_filter(field, operator, value, classification='PUSHDOWN'):
            return {
                'field': field,
                'classification': classification,
                'operator': operator,
                'value': value,
                'source': 'official_v0',
                'operation': 'searchSubjects',
            }

        pushdown = [
            *([plan_filter('keyword', 'eq', '少女终末旅行')] if index == 0 else []),
            plan_filter('media', 'in', ['anime']),
            plan_filter('dateRange', 'range', {
                'from': '2017-10-01',
                'to': '2018-01-01',
            }),
            plan_filter('nsfw', 'eq', False),
            plan_filter('sort:relevance', 'eq', 'relevance'),
        ]
        post_filters = (
            [plan_filter('categories', 'in', ['tv'], 'POST_FILTER')]
            if index == 0 else []
        )
        hydration_requirements = [
            {'reason': 'nsfw_filter', 'fields': ['nsfw'], 'source': 'candidate_or_detail'},
            *([{'reason': 'category_filter', 'fields': ['platform'], 'source': 'candidate_or_detail'}]
              if index == 0 else []),
        ]
        return {
            'source': 'official_v0',
            'operation': 'searchSubjects',
            'season': '2017-autumn',
            'sort': 'relevance',
            'order': 'desc',
            'totalKind': 'estimated',
            'pushdown': pushdown,
            'postFilters': post_filters,
            'derivedFilters': [],
            'unsupported': [],
            'hydrationRequired': True,
            'hydrationRequirements': hydration_requirements,
            'requestedTopN': 8,
            'resultMode': 'all',
            'quality': 'bounded_exact',
            'budget': {
                'maxPages': 6,
                'maxCandidates': 300,
                'maxHydrations': 60,
                'concurrency': 6,
                'maxConceptProbes': 8,
                'maxReturnedItems': 8,
            },
            'steps': [{
                'kind': 'search',
                'source': 'official_v0',
                'operation': 'searchSubjects',
                'page': 0,
                'request': {
                    'keyword': '少女终末旅行' if index == 0 else '',
                    'limit': 20,
                    'offset': 0,
                    'sort': 'match',
                    'filter': {
                        'type': [2],
                        'airDate': ['>=2017-10-01', '<2018-01-01'],
                        'nsfw': False,
                    },
                },
            }],
            'limitations': [
                'Enumeration is bounded by maxPages and maxCandidates.',
                'Official subject search is experimental; estimated totals do not establish completeness of the entire Bangumi database.',
                'all requests a complete attempt; budget exhaustion is reported as partial.',
            ],
        }

    def _a01_cohort(self, index):
        query = GENERATOR.CODEX_A01_QUERY_ARGUMENTS['cohorts'][index]
        effective_query = {
            **query['query'],
            'limit': GENERATOR.CODEX_A01_QUERY_ARGUMENTS['maxSubjects'],
            'budget': GENERATOR.CODEX_A01_QUERY_BUDGET,
        }
        if index == 0:
            subjects = [self._a01_subject(218707, '少女終末旅行')]
            query_coverage_state = 'complete'
            query_state = 'ok'
            scanned = matched = returned = 1
            upstream_exhausted = True
            rating_coverage = {
                'valid': 1, 'partial': 0, 'missing': 0, 'conflicts': 0,
                'notComputable': 0, 'state': 'complete',
            }
        else:
            subjects = [
                self._a01_subject(218707, '少女終末旅行'),
                self._a01_subject(218708, '样本作品', 'missing'),
            ]
            query_coverage_state = 'unknown'
            query_state = 'ok'
            scanned = matched = returned = 2
            upstream_exhausted = False
            rating_coverage = {
                'valid': 1, 'partial': 0, 'missing': 1, 'conflicts': 0,
                'notComputable': 0, 'state': 'partial',
            }
        query_coverage = {
            'state': query_coverage_state,
            'requested': scanned if upstream_exhausted else 0,
            'scanned': scanned,
            'matched': matched,
            'returned': returned,
            'pagesRequested': 1,
            'pagesScanned': 1,
            'upstreamExhausted': upstream_exhausted,
            'budgetExceeded': False,
            'postFilterCount': returned,
            'totalKind': 'estimated',
            'hydrationsAttempted': returned,
            'hydrationsSucceeded': returned,
            'hydrationsFailed': 0,
            'hydrationsUnresolved': 0,
            'unresolvedCandidates': 0,
            'hydrationBudgetExceeded': False,
        }
        return {
            'label': query['label'],
            'query': effective_query,
            'querySummary': f"{query['label']} · 2017-autumn · official-v0 bounded sample",
            'queryPlan': self._a01_query_plan(index),
            'queryState': query_state,
            'queryCoverage': query_coverage,
            'detailHydrations': {
                'attempted': returned,
                'succeeded': returned,
                'failed': 0,
            },
            'ratingStandardDeviationCoverage': rating_coverage,
            'subjects': subjects,
        }

    def _a01_result_fixture(self):
        observed_at = '2026-10-09T10:00:00.000Z'
        official_source = {
            'class': 'official-v0',
            'operations': ['searchSubjects', 'getSubjectById'],
            'attemptedAt': observed_at,
            'retrievedAt': observed_at,
        }
        derived_source = {
            'class': 'derived-s7',
            'operations': ['bangumi.rating.population_sd.v1'],
            'attemptedAt': observed_at,
            'retrievedAt': observed_at,
        }
        evidence = [
            {
                'source': {
                    'class': 'official_v0',
                    'provider': 'bangumi',
                    'version': 'v0',
                    'operation': 'searchSubjects',
                    'experimental': True,
                },
                'retrievedAt': observed_at,
            },
            {
                'source': {
                    'class': 'official_v0',
                    'provider': 'bangumi',
                    'version': 'v0',
                    'operation': 'getSubjectById',
                },
                'retrievedAt': observed_at,
            },
            {
                'source': {
                    'class': 'derived',
                    'provider': 'bangumi-agent-kit',
                    'operation': 'bangumi.rating.population_sd.v1',
                    'version': '1',
                },
                'retrievedAt': observed_at,
            },
        ]
        return {
            'state': 'partial',
            'comparisonMetrics': [
                {'key': 'score', 'state': 'partial'},
                {'key': 'heat', 'state': 'partial'},
                {'key': 'episodesReported', 'state': 'partial'},
                {'key': 'ratingStandardDeviation', 'state': 'partial'},
            ],
            'formulaVersion': 'subject-cohort-comparison-v1',
            'cohorts': [self._a01_cohort(0), self._a01_cohort(1)],
            'ratingStandardDeviation': {
                'key': 'ratingStandardDeviation',
                'label': '平均评分总体标准差',
                'sourceField': 'subject.rating.count[1..10]',
                'averages': [None, None],
                'partialAverages': [1.2, 1.2],
                'validCounts': [1, 1],
                'partialCounts': [0, 0],
                'missingCounts': [0, 1],
                'conflictCounts': [0, 0],
                'notComputableCounts': [0, 0],
                'formula': {
                    'id': 'bangumi.rating.population_sd.v1',
                    'version': 1,
                    'description': 'Population standard deviation from the official histogram.',
                },
                'state': 'partial',
            },
            'coverage': {
                'maxSubjectsPerCohort': 8,
                'totalSubjectsReturned': 3,
                'cohortsComplete': 1,
                'cohortsPartial': 1,
                'detailHydrationsAttempted': 3,
                'detailHydrationsSucceeded': 3,
                'detailHydrationsFailed': 0,
                'truncated': True,
                'overlap': {'count': 1, 'subjectIds': [218707]},
                'evidence': {
                    'retained': 3, 'omitted': 0, 'deduplicated': 0,
                    'omittedByBound': 0, 'bytes': 300, 'maxRefs': 256,
                    'maxBytes': 96_000, 'truncated': False,
                },
                'warnings': {'retained': 1, 'omitted': 0, 'max': 12, 'truncated': False},
            },
            'source': {'official': official_source, 'derived': derived_source},
            'retrievedAt': observed_at,
            'evidence': evidence,
            'warnings': [{
                'code': 'COHORT_OVERLAP',
                'state': 'partial',
                'message': 'Overlapping rows remain in both bounded samples.',
                'cohort': '2017-autumn 动画返回样本',
            }],
            'limitations': ['Current bounded returned samples only; no significance test.'],
        }

    def _a01_report_fixture(self):
        tool = next(
            item for item in self.catalog
            if item['name'] == 'bangumi.compare_subject_cohorts'
        )
        candidate = self.source_revision
        base = self.stale_candidate_source_revision
        bundle_hash = GENERATOR.codex_g26_candidate_bundle_sha256(candidate)
        self.assertIsNotNone(bundle_hash)
        return {
            'schemaVersion': 1,
            'evidenceKind': 'codex_cli_a01_agent_mcp',
            'profile': 'codex-luna-max-one-tool-v1',
            'scenarioId': 'A01',
            'runNumber': 95,
            'frontierId': 'A01',
            'epochId': 'run95-a01-agent-mcp-acceptance',
            'state': 'ANSWER_CHECK_PASSED',
            'observedAt': '2026-10-09T10:00:00.000Z',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'codexCliVersion': '1.2.14',
            'sourceRevision': candidate,
            'baseSha': base,
            'prNumber': 125,
            'mcpBundleSha256': bundle_hash,
            'candidateGate': {
                'candidateSha': candidate,
                'baseSha': base,
                'reviewPassSha': candidate,
                'reviewVerdict': 'PASS',
                'reviewerId': 'gpt-6-luna-max-run95-a01-pr125-round1',
                'ciSha': candidate,
                'ciStatus': 'SUCCESS',
            },
            'toolName': 'bangumi.compare_subject_cohorts',
            'argumentProfile': GENERATOR.CODEX_A01_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR._canonical_json_sha256(
                GENERATOR.CODEX_A01_QUERY_ARGUMENTS,
            ),
            'queryArguments': GENERATOR.CODEX_A01_QUERY_ARGUMENTS,
            'catalogSha256': hashlib.sha256(self.catalog_path.read_bytes()).hexdigest(),
            'toolDescriptionSha256': self.sha256(tool['description']),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'serverToolNames': ['bangumi.compare_subject_cohorts'],
            'serverToolCount': 1,
            'mcpServerNames': ['bgk_a01_one_tool'],
            'processExitCode': 0,
            'resultCount': 1,
            'eventStreamParsed': True,
            'codexMcpToolEventCount': 1,
            'nonMcpToolEventCount': 0,
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'resultStatus': 'SUCCESS',
            'qqPipelineTested': False,
            'timClientTested': False,
            'serverSummaryMatchesCandidate': True,
            'sameCandidateAfterCall': True,
            'result': self._a01_result_fixture(),
            'answerSha256': 'a' * 64,
            'answerUtf8Bytes': 2400,
            'answerCheckMethod': 'a01-bounded-cohort-answer-v1',
            'answerChecks': {
                key: True for key in GENERATOR.CODEX_A01_ANSWER_CHECK_FIELDS
            },
            'toolCalls': [{
                'name': 'bangumi.compare_subject_cohorts',
                'state': 'DONE',
                'arguments': GENERATOR.CODEX_A01_QUERY_ARGUMENTS,
            }],
            'privacy': {
                'authProfile': 'anonymous',
                'oauthAttempted': False,
                'accountDataRead': False,
                'writesAttempted': False,
                'qqPipelineTested': False,
                'timClientTested': False,
                'promptStored': False,
                'answerStored': False,
                'rawResultStored': False,
                'artifactImageBytesStored': False,
                'credentialsStored': False,
            },
            'acceptanceLimit': (
                'One anonymous current-snapshot sample only; this does not establish global season coverage or statistical significance. No retry is authorized.'
            ),
        }

    def test_a01_checked_report_counts_for_public_api_and_agent_mcp(self):
        report = self._a01_report_fixture()
        self.assertTrue(GENERATOR.codex_a01_report_is_valid(
            report, {item['name']: item for item in self.catalog},
        ))
        self.report_path = self.live_probe_dir / 'pariya-agent-codex-luna-e2e-A01.json'
        self.report_path.write_text(json.dumps(report, ensure_ascii=False), encoding='utf-8')
        expected = {
            'bangumi.compare_subject_cohorts': {
                'docs/live-probes/pariya-agent-codex-luna-e2e-A01.json',
            },
        }
        self.assertEqual(GENERATOR.public_api_smoke_sources(self.catalog), expected)
        self.assertEqual(GENERATOR.model_mcp_e2e_sources(self.catalog), expected)

    def test_c04_signed_matrix_report_credits_only_its_two_registered_tools(self):
        relative_path = 'docs/live-probes/c04-cohort-comparison-agent-mcp-run95.json'
        report_path = self.root / relative_path
        report_path.write_text(json.dumps({
            'evidenceKind': 'codex_cli_c04_cohort_comparison_agent_mcp_matrix',
            'prNumber': 191,
            'toolNames': [
                'bangumi.compare_subject_cohorts',
                'bangumi.render_subject_cohort_comparison',
            ],
        }), encoding='utf-8')
        epoch_status = {'epoch': {'state': {}}}
        with (
            patch.object(GENERATOR, 'codex_c04_profile_harness_status', return_value={'state': 'REPORT_WRITTEN'}) as harness_status,
            patch.object(GENERATOR, 'codex_c04_profile_epoch_harness_status', return_value=epoch_status) as epoch_harness_status,
            patch.object(GENERATOR, 'codex_c04_profile_report_is_valid', return_value=True) as report_validator,
            patch.object(GENERATOR, 'codex_c04_profile_report_matches_candidate_revision', return_value=True) as candidate_binding,
        ):
            sources = GENERATOR.model_mcp_e2e_sources(self.catalog)
        harness_status.assert_called_once_with(191)
        epoch_harness_status.assert_called_once_with(191)
        report_validator.assert_called_once()
        candidate_binding.assert_called_once_with(report_path, None)
        self.assertEqual(sources, {
            'bangumi.compare_subject_cohorts': {relative_path},
            'bangumi.render_subject_cohort_comparison': {relative_path},
        })

        with (
            patch.object(GENERATOR, 'codex_c04_profile_harness_status', return_value={'state': 'REPORT_WRITTEN'}),
            patch.object(GENERATOR, 'codex_c04_profile_epoch_harness_status', return_value=epoch_status),
            patch.object(GENERATOR, 'codex_c04_profile_report_is_valid', return_value=False),
            patch.object(GENERATOR, 'codex_c04_profile_report_matches_candidate_revision', return_value=True) as candidate_binding,
        ):
            sources = GENERATOR.model_mcp_e2e_sources(self.catalog)
        candidate_binding.assert_not_called()
        self.assertEqual(sources, {})

    def test_c04_matrix_evidence_stays_valid_after_a01_frontier_advances(self):
        frontier_path = self.root / 'docs/product/frontier-ledger.json'
        frontier_path.parent.mkdir(parents=True, exist_ok=True)
        frontier_path.write_text(json.dumps({
            'records': [
                {'id': 'A01', 'status': 'PARTIAL'},
                {'id': 'C04', 'status': 'DELIVERED'},
                {'id': 'C07', 'status': 'UNASSESSED'},
            ],
        }), encoding='utf-8')

        with patch.object(GENERATOR, 'ROOT', self.root):
            self.assertTrue(GENERATOR.codex_c04_frontier_is_matrix_only())

    def test_a01_rating_dispersion_report_maps_only_its_registered_agent_mcp_tool(self):
        relative_path = GENERATOR.CODEX_A01_RATING_DISPERSION_REPORT_RELATIVE_PATH
        report_path = self.root / relative_path
        report_path.write_text(json.dumps({
            'evidenceKind': GENERATOR.CODEX_A01_RATING_DISPERSION_EVIDENCE_KIND,
            'profileId': GENERATOR.CODEX_A01_RATING_DISPERSION_PROFILE_ID,
            'prNumber': 191,
            'toolName': 'bangumi.compare_subject_cohorts',
        }), encoding='utf-8')
        epoch_status = {'epoch': {'state': {}}}
        with (
            patch.object(GENERATOR, 'codex_a01_rating_dispersion_profile_harness_status', return_value={'state': 'REPORT_WRITTEN'}) as harness_status,
            patch.object(GENERATOR, 'codex_a01_rating_dispersion_profile_epoch_harness_status', return_value=epoch_status) as epoch_harness_status,
            patch.object(GENERATOR, 'codex_a01_rating_dispersion_profile_report_is_valid', return_value=True) as report_validator,
            patch.object(GENERATOR, 'codex_a01_rating_dispersion_profile_report_matches_candidate_revision', return_value=True) as candidate_binding,
        ):
            sources = GENERATOR.model_mcp_e2e_sources(self.catalog)
        harness_status.assert_called_once_with(191)
        epoch_harness_status.assert_called_once_with(191)
        report_validator.assert_called_once()
        candidate_binding.assert_called_once_with(report_path, None)
        self.assertEqual(sources, {'bangumi.compare_subject_cohorts': {relative_path}})

        with (
            patch.object(GENERATOR, 'codex_a01_rating_dispersion_profile_harness_status', return_value={'state': 'REPORT_WRITTEN'}),
            patch.object(GENERATOR, 'codex_a01_rating_dispersion_profile_epoch_harness_status', return_value=epoch_status),
            patch.object(GENERATOR, 'codex_a01_rating_dispersion_profile_report_is_valid', return_value=False),
            patch.object(GENERATOR, 'codex_a01_rating_dispersion_profile_report_matches_candidate_revision', return_value=True) as candidate_binding,
        ):
            sources = GENERATOR.model_mcp_e2e_sources(self.catalog)
        candidate_binding.assert_not_called()
        self.assertEqual(sources, {})

    def test_title_query_render_signed_matrix_route_credits_only_its_two_tools(self):
        relative_path = 'docs/live-probes/title-query-render-agent-mcp-run95.json'
        report_path = self.root / relative_path
        tool_names = [
            'bangumi.query_subjects',
            'bangumi.render_query_subjects',
        ]
        report = {
            'evidenceKind': 'codex_cli_title_query_render_agent_mcp_matrix',
            'profileId': 'query-render-title-agent-mcp-v1',
            'runNumber': 95,
            'frontierId': 'G01',
            'scenarioId': None,
            'toolNames': tool_names,
        }
        self.assertEqual(
            GENERATOR.codex_title_query_render_profile_matrix_targets(report),
            tuple(tool_names),
        )
        self.assertEqual(
            GENERATOR.codex_title_query_render_profile_matrix_targets({
                **report,
                'toolNames': [*tool_names, 'bangumi.get_subject'],
            }),
            (),
        )
        self.assertEqual(
            GENERATOR.codex_title_query_render_profile_matrix_targets({
                **report,
                'scenarioId': 'G01',
            }),
            (),
        )
        epoch_status = {'epoch': {'state': {}}}

        def write_report(value):
            report_path.write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')

        with (
            patch.object(
                GENERATOR,
                'codex_title_query_render_profile_harness_status',
                return_value={'state': 'REPORT_WRITTEN'},
            ),
            patch.object(
                GENERATOR,
                'codex_title_query_render_profile_epoch_harness_status',
                return_value=epoch_status,
            ),
            patch.object(
                GENERATOR,
                'codex_title_query_render_profile_report_is_valid',
                return_value=True,
            ),
            patch.object(
                GENERATOR,
                '_codex_relations_report_matches_candidate_revision',
                return_value=True,
            ),
        ):
            write_report(report)
            sources = GENERATOR.model_mcp_e2e_sources(self.catalog)
        self.assertEqual(sources, {name: {relative_path} for name in tool_names})

        with (
            patch.object(
                GENERATOR,
                'codex_title_query_render_profile_harness_status',
                return_value={'state': 'REPORT_WRITTEN'},
            ),
            patch.object(
                GENERATOR,
                'codex_title_query_render_profile_epoch_harness_status',
                return_value=epoch_status,
            ),
            patch.object(
                GENERATOR,
                'codex_title_query_render_profile_report_is_valid',
                return_value=True,
            ),
            patch.object(
                GENERATOR,
                '_codex_relations_report_matches_candidate_revision',
                return_value=True,
            ),
        ):
            write_report({**report, 'toolNames': [*tool_names, 'bangumi.get_subject']})
            sources = GENERATOR.model_mcp_e2e_sources(self.catalog)
        self.assertEqual(sources, {})

    def test_g01_query_subjects_offline_signed_matrix_route_credits_only_query_tool(self):
        for profile_id in GENERATOR.CODEX_G01_QUERY_SUBJECTS_OFFLINE_PROFILE_IDS:
            with self.subTest(profile_id=profile_id):
                settings = GENERATOR.codex_g01_query_subjects_offline_profile_settings(profile_id)
                report = {
                    'evidenceKind': settings['evidenceKind'],
                    'profileId': profile_id,
                    'runNumber': 95,
                    'frontierId': 'G01',
                    'scenarioId': None,
                    'toolName': 'bangumi.query_subjects',
                }
                self.assertEqual(
                    GENERATOR.codex_g01_query_subjects_offline_profile_matrix_targets(report),
                    ('bangumi.query_subjects',),
                )
                self.assertEqual(
                    GENERATOR.codex_g01_query_subjects_offline_profile_matrix_targets({
                        **report,
                        'toolName': 'bangumi.render_query_subjects',
                    }),
                    (),
                )
                self.assertEqual(
                    GENERATOR.codex_g01_query_subjects_offline_profile_matrix_targets({
                        **report,
                        'scenarioId': 'G01',
                    }),
                    (),
                )

    def test_g01_query_subjects_offline_profiles_have_disjoint_report_and_refresh_paths(self):
        profiles = [
            GENERATOR.codex_g01_query_subjects_offline_profile_settings(profile_id)
            for profile_id in GENERATOR.CODEX_G01_QUERY_SUBJECTS_OFFLINE_PROFILE_IDS
        ]
        self.assertEqual({profile['maxCodexErrors'] for profile in profiles}, {0, 3})
        self.assertEqual(len({profile['reportPath'] for profile in profiles}), 2)
        for profile in profiles:
            with self.subTest(profile_id=profile['profileId']):
                self.assertTrue(
                    GENERATOR.codex_g01_query_subjects_offline_profile_evidence_refresh_paths_are_valid(
                        [profile['reportPath'], 'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md'],
                        profile['profileId'],
                    ),
                )
                self.assertFalse(
                    GENERATOR.codex_g01_query_subjects_offline_profile_evidence_refresh_paths_are_valid(
                        [profile['reportPath'], 'docs/product/frontier-ledger.json'],
                        profile['profileId'],
                    ),
                )

    def test_g01_query_subjects_offline_report_reference_maps_only_query_subjects(self):
        epoch_status = {'epoch': {'state': {}}}
        for profile_id in GENERATOR.CODEX_G01_QUERY_SUBJECTS_OFFLINE_PROFILE_IDS:
            with self.subTest(profile_id=profile_id):
                settings = GENERATOR.codex_g01_query_subjects_offline_profile_settings(profile_id)
                relative_path = settings['reportPath']
                report_path = self.live_probe_dir / Path(relative_path).name
                report = {
                    'evidenceKind': settings['evidenceKind'],
                    'profileId': profile_id,
                    'runNumber': 95,
                    'frontierId': 'G01',
                    'scenarioId': None,
                    'prNumber': 191,
                    'toolName': 'bangumi.query_subjects',
                }

                def write_report(value):
                    report_path.write_text(json.dumps(value, ensure_ascii=False), encoding='utf-8')

                with (
                    patch.object(
                        GENERATOR,
                        'codex_g01_query_subjects_offline_profile_harness_status',
                        return_value={'state': 'REPORT_WRITTEN'},
                    ),
                    patch.object(
                        GENERATOR,
                        'codex_g01_query_subjects_offline_profile_epoch_harness_status',
                        return_value=epoch_status,
                    ),
                    patch.object(
                        GENERATOR,
                        'codex_g01_query_subjects_offline_profile_report_is_valid',
                        return_value=True,
                    ),
                    patch.object(
                        GENERATOR,
                        'codex_g01_query_subjects_offline_profile_report_matches_candidate_revision',
                        return_value=True,
                    ),
                ):
                    write_report(report)
                    sources = GENERATOR.model_mcp_e2e_sources(self.catalog)
                self.assertEqual(sources, {'bangumi.query_subjects': {relative_path}})

                with (
                    patch.object(
                        GENERATOR,
                        'codex_g01_query_subjects_offline_profile_harness_status',
                        return_value={'state': 'REPORT_WRITTEN'},
                    ),
                    patch.object(
                        GENERATOR,
                        'codex_g01_query_subjects_offline_profile_epoch_harness_status',
                        return_value=epoch_status,
                    ),
                    patch.object(
                        GENERATOR,
                        'codex_g01_query_subjects_offline_profile_report_is_valid',
                        return_value=True,
                    ),
                    patch.object(
                        GENERATOR,
                        'codex_g01_query_subjects_offline_profile_report_matches_candidate_revision',
                        return_value=True,
                    ),
                ):
                    write_report({**report, 'toolName': 'bangumi.render_query_subjects'})
                    sources = GENERATOR.model_mcp_e2e_sources(self.catalog)
                self.assertEqual(sources, {})

    def test_a01_report_remains_countable_after_candidate_child_evidence_commit(self):
        report = self._a01_report_fixture()
        self.report_path = self.live_probe_dir / 'pariya-agent-codex-luna-e2e-A01.json'
        self.report_path.write_text(json.dumps(report, ensure_ascii=False), encoding='utf-8')
        self.assertTrue(GENERATOR.codex_a01_report_matches_candidate_revision(
            self.report_path, self.source_revision,
        ))
        self._git('add', 'docs/live-probes/pariya-agent-codex-luna-e2e-A01.json')
        self._git('commit', '-qm', 'record sanitized A01 acceptance evidence')
        self.assertTrue(GENERATOR.codex_a01_report_matches_candidate_revision(
            self.report_path, self.source_revision,
        ))
        self.assertFalse(GENERATOR.codex_a01_report_matches_candidate_revision(
            self.report_path, self.stale_candidate_source_revision,
        ))
        self.assertEqual(
            GENERATOR.model_mcp_e2e_sources(self.catalog)['bangumi.compare_subject_cohorts'],
            {'docs/live-probes/pariya-agent-codex-luna-e2e-A01.json'},
        )

    def test_a01_report_accepts_complete_metric_only_with_complete_coverage_and_delta(self):
        report = self._a01_report_fixture()
        result = report['result']
        for index, cohort in enumerate(result['cohorts']):
            cohort['queryState'] = 'ok'
            cohort['queryCoverage']['state'] = 'complete'
            cohort['queryCoverage']['requested'] = cohort['queryCoverage']['scanned']
            cohort['queryCoverage']['upstreamExhausted'] = True
            cohort['ratingStandardDeviationCoverage'].update({
                'valid': len(cohort['subjects']),
                'partial': 0,
                'missing': 0,
                'conflicts': 0,
                'notComputable': 0,
                'state': 'complete',
            })
            if index == 1:
                cohort['subjects'][1] = self._a01_subject(218708, '样本作品')

        result['state'] = 'complete'
        for metric in result['comparisonMetrics']:
            metric['state'] = 'complete'

        metric = result['ratingStandardDeviation']
        metric.update({
            'averages': [1.2, 1.2],
            'validCounts': [1, 2],
            'partialCounts': [0, 0],
            'missingCounts': [0, 0],
            'conflictCounts': [0, 0],
            'notComputableCounts': [0, 0],
            'delta': 0.0,
            'state': 'complete',
        })
        metric.pop('partialAverages')
        result['coverage'].update({
            'cohortsComplete': 2,
            'cohortsPartial': 0,
            'truncated': False,
        })

        self.assertTrue(GENERATOR.codex_a01_report_is_valid(
            report, {item['name']: item for item in self.catalog},
        ))

    def test_a01_report_accepts_unknown_coverage_when_upstream_is_not_exhausted(self):
        report = self._a01_report_fixture()
        cohort = report['result']['cohorts'][1]
        self.assertEqual(cohort['queryCoverage']['state'], 'unknown')
        self.assertFalse(cohort['queryCoverage']['upstreamExhausted'])
        self.assertEqual(cohort['queryState'], 'ok')
        self.assertTrue(GENERATOR.codex_a01_report_is_valid(
            report, {item['name']: item for item in self.catalog},
        ))

    def test_a01_report_accepts_the_runner_prerelease_cli_version(self):
        report = self._a01_report_fixture()
        report['codexCliVersion'] = '0.162.0-alpha.2'
        self.assertTrue(GENERATOR.codex_a01_report_is_valid(
            report, {item['name']: item for item in self.catalog},
        ))

        report['codexCliVersion'] = '0.162.0+build.1'
        self.assertFalse(GENERATOR.codex_a01_report_is_valid(
            report, {item['name']: item for item in self.catalog},
        ))

    def test_a01_report_requires_unresolved_candidate_alias_to_match_hydration_count(self):
        report = self._a01_report_fixture()
        self.assertTrue(GENERATOR.codex_a01_report_is_valid(
            report, {item['name']: item for item in self.catalog},
        ))

        report['result']['cohorts'][0]['queryCoverage']['unresolvedCandidates'] = 1
        self.assertFalse(GENERATOR.codex_a01_report_is_valid(
            report, {item['name']: item for item in self.catalog},
        ))

    def test_a01_report_accepts_partial_coverage_when_budget_is_exceeded(self):
        report = self._a01_report_fixture()
        cohort = report['result']['cohorts'][1]
        cohort['queryCoverage'].update({'state': 'partial', 'budgetExceeded': True})
        cohort['queryState'] = 'partial'
        self.assertTrue(GENERATOR.codex_a01_report_is_valid(
            report, {item['name']: item for item in self.catalog},
        ))

    def test_a01_report_reconciles_failed_detail_hydration_with_not_computable_rows(self):
        report = self._a01_report_fixture()
        result = report['result']
        cohort = result['cohorts'][1]
        cohort['detailHydrations'].update({'succeeded': 1, 'failed': 1})
        result['coverage'].update({
            'detailHydrationsSucceeded': 2,
            'detailHydrationsFailed': 1,
        })
        self.assertFalse(GENERATOR.codex_a01_report_is_valid(
            report, {item['name']: item for item in self.catalog},
        ))

        cohort['subjects'][1] = self._a01_subject(218708, '样本作品', 'not_computable')
        cohort['ratingStandardDeviationCoverage'].update({
            'missing': 0,
            'notComputable': 1,
        })
        result['ratingStandardDeviation'].update({
            'missingCounts': [0, 0],
            'notComputableCounts': [0, 1],
        })
        self.assertTrue(GENERATOR.codex_a01_report_is_valid(
            report, {item['name']: item for item in self.catalog},
        ))

    def test_a01_report_preserves_finite_invalid_detail_total_only_as_partial_validation(self):
        report = self._a01_report_fixture()
        result = report['result']
        cohort = result['cohorts'][1]
        cohort['subjects'][0]['ratingStandardDeviationState'] = 'partial'
        cohort['subjects'][0]['ratingHistogramTotalValidation'] = {
            'state': 'invalid',
            'detailRatingTotal': 1.5,
            'histogramPopulation': 100,
        }
        cohort['ratingStandardDeviationCoverage'].update({
            'valid': 0,
            'partial': 1,
            'state': 'partial',
        })
        metric = result['ratingStandardDeviation']
        metric.update({
            'validCounts': [1, 0],
            'partialCounts': [0, 1],
            'missingCounts': [0, 1],
            'partialAverages': [1.2, 1.2],
        })
        self.assertTrue(GENERATOR.codex_a01_report_is_valid(
            report, {item['name']: item for item in self.catalog},
        ))

        cohort['subjects'][0]['ratingHistogramTotalValidation']['state'] = 'match'
        self.assertFalse(GENERATOR.codex_a01_report_is_valid(
            report, {item['name']: item for item in self.catalog},
        ))

    def test_a01_report_rejects_wrong_model_query_target_or_coverage(self):
        invalid_mutations = [
            lambda report: report.update({'model': 'gpt-6-sol'}),
            lambda report: report['queryArguments']['cohorts'][0]['query'].update({'season': '2018-winter'}),
            lambda report: report['result']['cohorts'][0]['subjects'][0].update({'id': 123}),
            lambda report: report['result']['cohorts'][1]['subjects'].pop(),
            lambda report: report['result']['ratingStandardDeviation']['missingCounts'].__setitem__(1, 0),
            lambda report: report['result']['cohorts'][0]['query'].update({'tags': ['extra']}),
            lambda report: report['result']['cohorts'][0]['queryPlan']['steps'][0]['request']['filter'].update({'airDate': ['>=2018-01-01', '<2018-04-01']}),
            lambda report: report['result']['cohorts'][0]['queryPlan']['postFilters'].clear(),
            lambda report: report['result']['cohorts'][0]['queryPlan']['hydrationRequirements'].pop(),
            lambda report: report['result']['cohorts'][1]['queryPlan'].update({'operation': 'browseSubjects'}),
            lambda report: report['result']['cohorts'][0]['queryCoverage'].update({'totalKind': 'exact'}),
            lambda report: report['result']['cohorts'][1]['queryCoverage'].update({'totalKind': 'unknown'}),
            lambda report: report['result']['cohorts'][0]['queryCoverage'].update({
                'state': 'complete', 'upstreamExhausted': False, 'requested': 0,
            }),
            lambda report: report['result']['cohorts'][0]['queryCoverage'].update({
                'state': 'complete', 'budgetExceeded': True,
            }),
            lambda report: report['result']['cohorts'][1].update({'queryState': 'partial'}),
            lambda report: report['result']['cohorts'][1]['detailHydrations'].update({'attempted': 0}),
            lambda report: report['result'].update({'state': 'complete'}),
            lambda report: report['answerChecks'].update({'exactRows': False}),
            lambda report: report['privacy'].update({'accountDataRead': True}),
            lambda report: report['toolCalls'].append({'name': 'bangumi.get_subject', 'state': 'DONE'}),
            lambda report: report['result']['source']['official'].update({'operations': ['GET /community/topics']}),
            lambda report: report['result']['evidence'][0]['source'].update({'provider': 'private-community'}),
            lambda report: report['result']['ratingStandardDeviation'].update({
                'averages': [1.2, 1.2],
                'delta': 0.0,
                'state': 'complete',
            }),
        ]
        for mutate in invalid_mutations:
            with self.subTest(mutation=mutate):
                report = self._a01_report_fixture()
                mutate(report)
                self.assertFalse(GENERATOR.codex_a01_report_is_valid(
                    report, {item['name']: item for item in self.catalog},
                ))

    def test_a01_report_rejects_unexpected_raw_answer_fields(self):
        report = self._a01_report_fixture()
        report['answer'] = 'raw output must not be stored'
        self.assertFalse(GENERATOR.codex_a01_report_is_valid(
            report, {item['name']: item for item in self.catalog},
        ))


class PerToolClientEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix='tool-client-evidence-test-')
        self.root = Path(self.temp_dir.name)
        self.live_probe_dir = self.root / 'docs/live-probes'
        self.live_probe_dir.mkdir(parents=True)
        self.catalog = [
            {'name': 'bangumi.render_subject_overview', 'auth': 'none', 'risk': 'read'},
            {'name': 'bangumi.render_calendar', 'auth': 'none', 'risk': 'read'},
            {'name': 'bangumi.get_subject', 'auth': 'none', 'risk': 'read'},
            {'name': 'bangumi.get_subject_cast', 'auth': 'none', 'risk': 'read'},
            {'name': 'bangumi.get_subject_index_membership', 'auth': 'none', 'risk': 'read'},
            {'name': 'bangumi.get_index', 'auth': 'none', 'risk': 'read'},
            {'name': 'bangumi.render_subject_card', 'auth': 'none', 'risk': 'read'},
            {'name': 'bangumi.get_my_collection', 'auth': 'required', 'risk': 'read'},
            {'name': 'bangumi.update_collection', 'auth': 'required', 'risk': 'write'},
        ]
        self.catalog_path = self.root / 'docs/tool-catalog.json'
        self.catalog_path.write_text(json.dumps(self.catalog), encoding='utf-8')
        self.original_root = GENERATOR.ROOT
        self.original_catalog = GENERATOR.CATALOG
        self.original_probe_dir = GENERATOR.LIVE_PROBE_DIR
        GENERATOR.ROOT = self.root
        GENERATOR.CATALOG = self.catalog_path
        GENERATOR.LIVE_PROBE_DIR = self.live_probe_dir
        self.report_path = self.live_probe_dir / 'pariya-agent-production-client-e2e-2026-09-26.json'

    def tearDown(self):
        GENERATOR.ROOT = self.original_root
        GENERATOR.CATALOG = self.original_catalog
        GENERATOR.LIVE_PROBE_DIR = self.original_probe_dir
        self.temp_dir.cleanup()

    def write_report(self, **overrides):
        report = {
            'schemaVersion': 1,
            'evidenceKind': 'pariya_agent_tool_client_e2e',
            'catalogSha256': hashlib.sha256(self.catalog_path.read_bytes()).hexdigest(),
            'profile': 'public-render',
            'tool': 'bangumi.render_subject_overview',
            'gateway': {
                'image': 'pariya-agent/agy-bangumi-poc:m1',
                'status': 'OK',
                'toolErrors': 1,
                'toolCalls': [
                    {'server': 'bangumi', 'name': 'bangumi.render_subject_overview', 'state': 'ERROR'},
                    {'server': 'bangumi', 'name': 'bangumi.render_subject_overview', 'state': 'DONE'},
                ],
                'artifactReturned': True,
            },
            'qqPipeline': {
                'eventId': 'dc5f170283995af1',
                'phases': ['candidate', 'received', 'submitted', 'result', 'rendering', 'sending', 'sent'],
                'resultCode': 'OK',
                'sendFailed': False,
                'uncertain': False,
                'incomplete': False,
                'duplicate': False,
                'orderingViolations': 0,
            },
            'timClient': {
                'observed': True,
                'inputObserved': True,
                'textDisplayed': True,
                'displayedImage': True,
                'imageOrigin': 'bangumi_artifact',
                'evidenceSource': 'computer_use_observed',
                'scope': 'private_dm',
                'recipientIsBot': True,
                'onlyAuthorizedConversation': True,
            },
            'privacy': {
                'messageBodyStored': False,
                'replyBodyStored': False,
                'qqIdStored': False,
                'screenshotStored': False,
            },
        }
        report.update(overrides)
        self.report_path.write_text(json.dumps(report), encoding='utf-8')

    def test_counts_hash_bound_tool_specific_onebot_and_tim_observation(self):
        self.write_report()
        qq_sources, tim_sources = GENERATOR.live_client_e2e_sources(self.catalog)
        reference = {'docs/live-probes/pariya-agent-production-client-e2e-2026-09-26.json'}
        self.assertEqual(qq_sources, {'bangumi.render_subject_overview': reference})
        self.assertEqual(tim_sources, {'bangumi.render_subject_overview': reference})

    def test_text_only_tool_can_pass_tim_client_without_image(self):
        self.write_report(
            tool='bangumi.get_subject',
            gateway={
                'image': 'pariya-agent/agy-bangumi-poc:m1', 'status': 'OK', 'toolErrors': 0,
                'toolCalls': [{'server':'bangumi','name':'bangumi.get_subject','state':'DONE'}],
                'artifactReturned': False,
            },
            timClient={
                'observed': True, 'inputObserved': True, 'textDisplayed': True,
                'displayedImage': False, 'evidenceSource':'computer_use_observed',
                'scope':'private_dm', 'recipientIsBot':True, 'onlyAuthorizedConversation':True,
            },
        )
        qq_sources, tim_sources = GENERATOR.live_client_e2e_sources(self.catalog)
        self.assertIn('bangumi.get_subject', qq_sources)
        self.assertIn('bangumi.get_subject', tim_sources)

    def test_non_renderer_tim_card_may_be_composed_by_astrbot_presentation(self):
        self.write_report(
            tool='bangumi.get_subject_cast',
            gateway={
                'image':'pariya-agent/agy-bangumi-poc:m1','status':'OK','toolErrors':0,
                'toolCalls':[{'server':'bangumi','name':'bangumi.get_subject_cast','state':'DONE'}],
                'artifactReturned':False,
            },
            timClient={
                'observed':True,'inputObserved':True,'textDisplayed':True,'displayedImage':True,
                'imageOrigin':'astrbot_presentation','evidenceSource':'computer_use_observed',
                'scope':'private_dm','recipientIsBot':True,'onlyAuthorizedConversation':True,
            },
        )
        qq_sources,tim_sources=GENERATOR.live_client_e2e_sources(self.catalog)
        self.assertIn('bangumi.get_subject_cast',qq_sources)
        self.assertIn('bangumi.get_subject_cast',tim_sources)

    def test_safe_multi_tool_read_workflow_counts_each_exact_reported_target(self):
        tool_calls = [
            {'server': 'bangumi', 'name': 'bangumi.get_subject_index_membership', 'state': 'DONE'},
            {'server': 'bangumi', 'name': 'bangumi.get_index', 'state': 'DONE'},
            {'server': 'bangumi', 'name': 'bangumi.get_index', 'state': 'DONE'},
            {'server': 'bangumi', 'name': 'bangumi.get_index', 'state': 'DONE'},
        ]
        gateway = {
            'image': 'pariya-agent/agy-bangumi-poc:m1', 'status': 'OK', 'toolErrors': 0,
            'toolCalls': tool_calls, 'artifactReturned': False,
        }
        tim_client = {
            'observed': True, 'inputObserved': True, 'textDisplayed': True,
            'displayedImage': False, 'evidenceSource': 'computer_use_observed',
            'scope': 'private_dm', 'recipientIsBot': True, 'onlyAuthorizedConversation': True,
        }
        self.write_report(
            tool='bangumi.get_subject_index_membership', gateway=gateway, timClient=tim_client,
        )
        second = json.loads(self.report_path.read_text(encoding='utf-8'))
        second['tool'] = 'bangumi.get_index'
        second_path = self.report_path.with_name(
            'pariya-agent-production-client-e2e-2026-09-26-index-detail.json'
        )
        second_path.write_text(json.dumps(second), encoding='utf-8')

        qq_sources, tim_sources = GENERATOR.live_client_e2e_sources(self.catalog)
        self.assertIn('bangumi.get_subject_index_membership', qq_sources)
        self.assertIn('bangumi.get_index', qq_sources)
        self.assertIn('bangumi.get_subject_index_membership', tim_sources)
        self.assertIn('bangumi.get_index', tim_sources)

    def test_rejects_multi_tool_workflows_with_unsafe_failed_or_unbounded_calls(self):
        cases = [
            [
                {'server': 'bangumi', 'name': 'bangumi.get_subject_index_membership', 'state': 'DONE'},
                {'server': 'bangumi', 'name': 'bangumi.update_collection', 'state': 'DONE'},
            ],
            [
                {'server': 'bangumi', 'name': 'bangumi.get_subject_index_membership', 'state': 'DONE'},
                {'server': 'bangumi', 'name': 'bangumi.get_my_collection', 'state': 'DONE'},
            ],
            [
                {'server': 'bangumi', 'name': 'bangumi.get_subject_index_membership', 'state': 'DONE'},
                {'server': 'bangumi', 'name': 'bangumi.not_in_catalog', 'state': 'DONE'},
            ],
            [
                {'server': 'bangumi', 'name': 'bangumi.get_index', 'state': 'DONE'},
            ],
            [
                {'server': 'bangumi', 'name': 'bangumi.get_subject_index_membership', 'state': 'DONE'},
                {'server': 'other', 'name': 'bangumi.get_index', 'state': 'DONE'},
            ],
            [
                {'server': 'bangumi', 'name': 'bangumi.get_subject_index_membership', 'state': 'DONE'},
                {'server': 'bangumi', 'name': 'bangumi.get_index', 'state': 'ERROR'},
            ],
            [
                {'server': 'bangumi', 'name': 'bangumi.get_subject_index_membership', 'state': 'DONE'},
                *([{'server': 'bangumi', 'name': 'bangumi.get_index', 'state': 'DONE'}] * 9),
            ],
        ]
        for tool_calls in cases:
            with self.subTest(tool_calls=tool_calls):
                self.write_report(
                    tool='bangumi.get_subject_index_membership',
                    gateway={
                        'image': 'pariya-agent/agy-bangumi-poc:m1', 'status': 'OK',
                        'toolErrors': sum(call['state'] == 'ERROR' for call in tool_calls),
                        'toolCalls': tool_calls, 'artifactReturned': False,
                    },
                )
                self.assertEqual(GENERATOR.live_client_e2e_sources(self.catalog), ({}, {}))

    def test_multi_tool_renderer_evidence_requires_and_counts_native_artifact(self):
        self.write_report(
            tool='bangumi.get_subject',
            gateway={
                'image': 'pariya-agent/agy-bangumi-poc:m1', 'status': 'OK', 'toolErrors': 0,
                'toolCalls': [
                    {'server': 'bangumi', 'name': 'bangumi.get_subject', 'state': 'DONE'},
                    {'server': 'bangumi', 'name': 'bangumi.render_subject_card', 'state': 'DONE'},
                ],
                'artifactReturned': True,
            },
            timClient={
                'observed': True, 'inputObserved': True, 'textDisplayed': True, 'displayedImage': True,
                'imageOrigin': 'bangumi_artifact', 'evidenceSource': 'computer_use_observed',
                'scope': 'private_dm', 'recipientIsBot': True, 'onlyAuthorizedConversation': True,
            },
        )
        second = json.loads(self.report_path.read_text(encoding='utf-8'))
        second['tool'] = 'bangumi.render_subject_card'
        second_path = self.report_path.with_name(
            'pariya-agent-production-client-e2e-2026-09-26-render-card.json'
        )
        second_path.write_text(json.dumps(second), encoding='utf-8')

        qq_sources, tim_sources = GENERATOR.live_client_e2e_sources(self.catalog)
        self.assertIn('bangumi.get_subject', qq_sources)
        self.assertIn('bangumi.render_subject_card', qq_sources)
        self.assertIn('bangumi.get_subject', tim_sources)
        self.assertIn('bangumi.render_subject_card', tim_sources)

    def test_qq_pipeline_without_visible_tim_client_counts_only_qq_stage(self):
        self.write_report(timClient={'observed': False})
        qq_sources, tim_sources = GENERATOR.live_client_e2e_sources(self.catalog)
        self.assertIn('bangumi.render_subject_overview', qq_sources)
        self.assertNotIn('bangumi.render_subject_overview', tim_sources)

    def test_rejects_stale_catalog_and_private_or_write_tools(self):
        self.write_report(catalogSha256='0' * 64)
        self.assertEqual(GENERATOR.live_client_e2e_sources(self.catalog), ({}, {}))
        self.write_report(tool='bangumi.update_collection')
        self.assertEqual(GENERATOR.live_client_e2e_sources(self.catalog), ({}, {}))

    def test_rejects_uncertain_send_and_wrong_tool_retry(self):
        self.write_report(qqPipeline={
            'eventId': 'dc5f170283995af1',
            'phases': ['candidate', 'received', 'submitted', 'result', 'rendering', 'sending', 'send_failed'],
            'resultCode': 'OK', 'sendFailed': True, 'uncertain': True, 'incomplete': True,
            'duplicate': False, 'orderingViolations': 0,
        })
        self.assertEqual(GENERATOR.live_client_e2e_sources(self.catalog), ({}, {}))

    def test_rejects_reports_that_retain_private_message_content(self):
        self.write_report(privacy={'messageBodyStored': True, 'replyBodyStored': False,
                                   'qqIdStored': False, 'screenshotStored': False})
        self.assertEqual(GENERATOR.live_client_e2e_sources(self.catalog), ({}, {}))
        self.write_report(gateway={
            'image': 'pariya-agent/agy-bangumi-poc:m1', 'status': 'OK', 'toolErrors': 1,
            'toolCalls': [
                {'server': 'bangumi', 'name': 'bangumi.render_calendar', 'state': 'ERROR'},
                {'server': 'bangumi', 'name': 'bangumi.render_subject_overview', 'state': 'DONE'},
            ],
            'artifactReturned': True,
        })
        self.assertEqual(GENERATOR.live_client_e2e_sources(self.catalog), ({}, {}))

class DirectExecuteSourceTests(unittest.TestCase):
    def test_requires_tool_execute_or_known_fixture_wrapper(self):
        source = """
        tools.get('bangumi.get_subject')!.execute(input, context);
        await run(tools.get('bangumi.get_subject_cast')!, input, 'bangumi.get_subject_cast');
        tools.get('bangumi.get_person');
        registerTool('bangumi.get_episode');
        """
        self.assertEqual(
            GENERATOR.direct_execute_names(source),
            {'bangumi.get_subject', 'bangumi.get_subject_cast'},
        )

    def test_records_fixture_source_paths_per_tool(self):
        source = """tools.get('bangumi.get_subject')!.execute(input, context);
await run(
  tools.get('bangumi.get_subject_cast')!,
  input,
  'bangumi.get_subject_cast',
);
"""
        self.assertEqual(
            GENERATOR.direct_execute_source_refs([('tests/direct.ts', source)]),
            {
                'bangumi.get_subject': {'tests/direct.ts:1'},
                'bangumi.get_subject_cast': {'tests/direct.ts:3'},
            },
        )


class AcceptanceTableSourceReferenceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix='acceptance-table-reference-test-')
        self.root = Path(self.temp_dir.name)
        test_file = self.root / 'tests/direct-fixture.ts'
        test_file.parent.mkdir(parents=True)
        test_file.write_text('line one\nline two\n', encoding='utf-8')
        probe_dir = self.root / 'docs/live-probes'
        probe_dir.mkdir(parents=True)
        catalog = [
            {'name': 'bangumi.get_subject', 'auth': 'none', 'risk': 'read'},
            {'name': 'bangumi.get_my_profile', 'auth': 'required', 'risk': 'read'},
            {'name': 'bangumi.render_subject_overview', 'auth': 'none', 'risk': 'read'},
        ]
        catalog_path = self.root / 'docs/tool-catalog.json'
        catalog_path.write_text(json.dumps(catalog), encoding='utf-8')
        (probe_dir / 'public-tools-fixture.json').write_text(json.dumps({
            'selectedTools': ['bangumi.get_subject'],
            'results': [{'tool': 'bangumi.get_subject'}],
        }), encoding='utf-8')
        (probe_dir / 'agent-mcp-fixture.json').write_text(json.dumps({
            'scenarios': [{
                'passed': True,
                'toolCalls': [{'name': 'bangumi.get_subject', 'state': 'DONE'}],
            }],
        }), encoding='utf-8')
        (probe_dir / 'auth-denial-fixture.json').write_text(json.dumps({
            'profile': 'bangumi-full-auth-denial-qa-v1',
            'scenarios': [{
                'id': 'bangumi.get_my_profile',
                'passed': True,
                'toolCalls': [{'name': 'bangumi.get_my_profile', 'state': 'DONE'}],
                'assertions': {
                    'authRequiredGateObserved': True,
                    'operationExecuted': False,
                    'accountDataReturned': False,
                    'networkAccessBlocked': True,
                    'networkRequestAttempts': 0,
                    'externalApiCalled': False,
                },
            }],
        }), encoding='utf-8')
        self.client_report_name = 'pariya-agent-production-client-e2e-2026-09-26.json'
        self.client_report = {
            'schemaVersion': 1,
            'evidenceKind': 'pariya_agent_tool_client_e2e',
            'catalogSha256': hashlib.sha256(catalog_path.read_bytes()).hexdigest(),
            'profile': 'public-render',
            'tool': 'bangumi.render_subject_overview',
            'gateway': {
                'image': 'pariya-agent/agy-bangumi-poc:m1', 'status': 'OK', 'toolErrors': 1,
                'toolCalls': [
                    {'server': 'bangumi', 'name': 'bangumi.render_subject_overview', 'state': 'ERROR'},
                    {'server': 'bangumi', 'name': 'bangumi.render_subject_overview', 'state': 'DONE'},
                ],
                'artifactReturned': True,
            },
            'qqPipeline': {
                'eventId': 'dc5f170283995af1',
                'phases': ['candidate', 'received', 'submitted', 'result', 'rendering', 'sending', 'sent'],
                'resultCode': 'OK', 'sendFailed': False, 'uncertain': False,
                'incomplete': False, 'duplicate': False, 'orderingViolations': 0,
            },
            'timClient': {
                'observed': True, 'inputObserved': True, 'textDisplayed': True,
                'displayedImage': True, 'imageOrigin': 'bangumi_artifact',
                'evidenceSource': 'computer_use_observed', 'scope': 'private_dm',
                'recipientIsBot': True, 'onlyAuthorizedConversation': True,
            },
            'privacy': {
                'messageBodyStored': False, 'replyBodyStored': False,
                'qqIdStored': False, 'screenshotStored': False,
            },
        }
        (probe_dir / self.client_report_name).write_text(json.dumps(self.client_report), encoding='utf-8')
        self.original_root = TABLE_CHECKER.ROOT
        self.original_catalog = TABLE_CHECKER.CATALOG
        TABLE_CHECKER.ROOT = self.root
        TABLE_CHECKER.CATALOG = catalog_path

    def tearDown(self):
        TABLE_CHECKER.ROOT = self.original_root
        TABLE_CHECKER.CATALOG = self.original_catalog
        self.temp_dir.cleanup()

    def test_accepts_existing_test_file_and_line_reference(self):
        self.assertIsNone(
            TABLE_CHECKER.source_reference_error(
                'bangumi.get_subject', '`tests/direct-fixture.ts:2`'
            )
        )

    def test_rejects_missing_test_file_reference(self):
        error = TABLE_CHECKER.source_reference_error(
            'bangumi.get_subject', '`tests/missing.ts:2`'
        )
        self.assertIn('does not exist', error)

    def test_rejects_out_of_range_line_reference(self):
        error = TABLE_CHECKER.source_reference_error(
            'bangumi.get_subject', '`tests/direct-fixture.ts:8`'
        )
        self.assertIn('line 8 is out of range', error)

    def test_catalog_cell_points_to_the_expected_schema_entry(self):
        self.assertIsNone(
            TABLE_CHECKER.catalog_schema_reference_error(
                'bangumi.get_subject', '`docs/tool-catalog.json#/3`', 3
            )
        )
        error = TABLE_CHECKER.catalog_schema_reference_error(
            'bangumi.get_subject', '`docs/tool-catalog.json#/2`', 3
        )
        self.assertIn('expected', error)
        self.assertIn('docs/tool-catalog.json#/3', error)

    def test_accepts_public_report_reference_for_the_same_tool(self):
        self.assertIsNone(TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_subject', '◐<br>`docs/live-probes/public-tools-fixture.json`', 'public'
        ))

    def test_rejects_public_report_reference_without_the_tool(self):
        error = TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_episode', '◐<br>`docs/live-probes/public-tools-fixture.json`', 'public'
        )
        self.assertIn('does not contain evidence for bangumi.get_episode', error)

    def test_accepts_agent_mcp_report_reference_for_the_same_tool(self):
        self.assertIsNone(TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_subject', '✅<br>`docs/live-probes/agent-mcp-fixture.json`', 'agent_mcp'
        ))

    def test_p06_v3_report_maps_only_to_its_registered_renderer_agent_mcp_cell(self):
        profile = TABLE_CHECKER.P06_V3_PROFILE
        relative_path = profile['reportPath']
        report_path = self.root / relative_path
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report = {'profileId': profile['id'], 'toolName': profile['toolName']}
        report_path.write_text(json.dumps(report), encoding='utf-8')
        cell = f'✅<br>`{relative_path}`'

        def validate(candidate, report_path=None):
            return candidate == report and report_path == (self.root / relative_path).resolve()

        with patch.dict(TABLE_CHECKER.P06_ACCEPTANCE_GENERATOR, {
            'codex_p06_profile_report_is_valid': validate,
        }):
            self.assertIsNone(TABLE_CHECKER.evidence_reference_error(
                profile['toolName'], cell, 'agent_mcp',
            ))
            wrong_tool_error = TABLE_CHECKER.evidence_reference_error(
                'bangumi.render_subject_card', cell, 'agent_mcp',
            )
            self.assertIn(
                'does not contain evidence for bangumi.render_subject_card',
                wrong_tool_error,
            )

            report_path.write_text(json.dumps({'profileId': 'unregistered'}), encoding='utf-8')
            wrong_profile_error = TABLE_CHECKER.evidence_reference_error(
                profile['toolName'], cell, 'agent_mcp',
            )
            self.assertIn(
                f'does not contain evidence for {profile["toolName"]}',
                wrong_profile_error,
            )

    def test_p03_v4_report_reference_maps_only_the_person_profile_agent_mcp_cell(self):
        profile = TABLE_CHECKER.P03_V4_AGENT_MCP_PROFILE
        calls = profile['calls']
        arguments_sha = hashlib.sha256(json.dumps(
            [call['arguments'] for call in calls],
            sort_keys=True, separators=(',', ':'), ensure_ascii=False,
        ).encode('utf-8')).hexdigest()
        registry_sha = hashlib.sha256(json.dumps(
            profile, sort_keys=True, separators=(',', ':'), ensure_ascii=False,
        ).encode('utf-8')).hexdigest()
        relative_path = profile['reportPath']
        source = 'a' * 40
        base = 'b' * 40
        claim_id = 'profile-run-95-pr-261-aaaaaaaaaaaa-1700000000000'
        payload = {
            'kind': 'p03-person-name-cn-agent-mcp-runner-receipt-v4',
            'profileId': profile['id'],
            'claimId': claim_id,
            'runNumber': 95,
            'prNumber': 261,
            'sourceRevision': source,
            'baseSha': base,
            'ciSha': source,
            'ciStatus': 'SUCCESS',
            'toolName': profile['toolName'],
            'argumentProfile': profile['argumentProfile'],
        }
        report = {
            'schemaVersion': 1,
            'evidenceKind': profile['evidenceKind'],
            'profile': 'codex-luna-max-agent-mcp-matrix-v4',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'runNumber': 95,
            'frontierId': 'P03',
            'scenarioId': None,
            'acceptanceScope': 'agent-mcp-matrix-only',
            'epochId': profile['epochId'],
            'profileId': profile['id'],
            'prNumber': 261,
            'claimId': claim_id,
            'toolName': profile['toolName'],
            'argumentProfile': profile['argumentProfile'],
            'expectedArgumentsSha256': arguments_sha,
            'registrySha256': registry_sha,
            'sourceRevision': source,
            'baseSha': base,
            'ciSha': source,
            'ciStatus': 'SUCCESS',
            'resultStatus': 'SUCCESS',
            'processExitCode': 0,
            'eventStreamParsed': True,
            'turnCompleted': True,
            'codexMcpToolEventCount': 1,
            'nonMcpToolEventCount': 0,
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'serverToolNames': [profile['toolName']],
            'mcpServerNames': ['bgk_p03_name_cn'],
            'mcpTextProjectionValid': True,
            'structuredContentCompatible': True,
            'sourceCompletenessDocumented': False,
            'resultCounters': {
                'subjectsObserved': 18,
                'subjectsReturned': 5,
                'subjectsTruncated': True,
                'returnedCreditRowsObserved': 5,
                'positiveNameCnRowsObserved': 5,
            },
            'answerChecks': {'exactPositiveRows': True},
            'privacy': {
                'authProfile': 'anonymous',
                'oauthAttempted': False,
                'accountDataRead': False,
                'writesAttempted': False,
                'communityRead': False,
                'qqPipelineTested': False,
                'timClientTested': False,
                'promptStored': False,
                'answerStored': False,
                'rawSourceRowsStored': False,
                'rawToolResultStored': False,
                'eventStreamStored': False,
                'credentialsStored': False,
            },
            'runnerReceipt': {'payload': payload, 'signature': 'signed-fixture'},
        }
        report_path = self.root / relative_path
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report), encoding='utf-8')
        cell = f'✅<br>`{relative_path}`'
        self.assertIsNone(TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_person_profile', cell, 'agent_mcp',
        ))
        error = TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_person', cell, 'agent_mcp',
        )
        self.assertIn('does not contain evidence for bangumi.get_person', error)

        report['toolName'] = 'bangumi.get_person'
        report_path.write_text(json.dumps(report), encoding='utf-8')
        error = TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_person_profile', cell, 'agent_mcp',
        )
        self.assertIn('does not contain evidence for bangumi.get_person_profile', error)

    def test_c04_report_reference_maps_only_its_two_agent_mcp_tools(self):
        relative_path = 'docs/live-probes/c04-cohort-comparison-agent-mcp-run95.json'
        tool_names = [
            'bangumi.compare_subject_cohorts',
            'bangumi.render_subject_cohort_comparison',
        ]
        (self.root / relative_path).write_text(json.dumps({
            'evidenceKind': 'codex_cli_c04_cohort_comparison_agent_mcp_matrix',
            'profileId': 'c04-cohort-comparison-agent-mcp-matrix-v1',
            'runNumber': 95,
            'frontierId': 'A01',
            'scenarioId': None,
            'resultStatus': 'SUCCESS',
            'codexRunCount': 2,
            'codexMcpToolEventCount': 2,
            'allowedCallCount': 2,
            'deniedCallCount': 0,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'toolNames': tool_names,
            'serverToolNames': tool_names,
            'resultSummaries': [
                {'toolName': name, 'summary': {}}
                for name in tool_names
            ],
        }), encoding='utf-8')
        cell = f'✅<br>`{relative_path}`'
        for name in tool_names:
            self.assertIsNone(TABLE_CHECKER.evidence_reference_error(name, cell, 'agent_mcp'))
        error = TABLE_CHECKER.evidence_reference_error('bangumi.auth_status', cell, 'agent_mcp')
        self.assertIn('does not contain evidence for bangumi.auth_status', error)

    def test_title_query_render_report_reference_maps_only_its_two_agent_mcp_tools(self):
        relative_path = 'docs/live-probes/title-query-render-agent-mcp-run95.json'
        tool_names = [
            'bangumi.query_subjects',
            'bangumi.render_query_subjects',
        ]
        query = {
            'resultState': 'partial',
            'returnedItems': 1,
            'coverage': {},
            'warningCodes': ['EXPERIMENTAL_SOURCE'],
        }
        artifact = {
            'resultState': 'artifact_returned',
            'artifact': {
                'returned': True,
                'persisted': False,
                'mimeType': 'image/png',
                'width': 360,
                'height': 720,
                'byteLength': 4096,
                'pngSignatureValid': True,
                'decoded': True,
                'dimensionsMatch': True,
            },
        }
        scope = {
            'requestCount': 2,
            'allowedRequestCount': 2,
            'deniedRequestCount': 0,
            'credentialAttemptCount': 0,
            'unexpectedRouteCount': 0,
            'budgetExceeded': False,
            'maxRequests': 8,
            'anonymousOnly': True,
            'officialV0Only': True,
            'redirectPolicy': 'error',
        }
        (self.root / relative_path).write_text(json.dumps({
            'evidenceKind': 'codex_cli_title_query_render_agent_mcp_matrix',
            'profileId': 'query-render-title-agent-mcp-v1',
            'runNumber': 95,
            'frontierId': 'G01',
            'scenarioId': None,
            'resultStatus': 'SUCCESS',
            'codexRunCount': 1,
            'codexMcpToolEventCount': 2,
            'allowedCallCount': 2,
            'deniedCallCount': 0,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'toolNames': tool_names,
            'serverToolNames': tool_names,
            'resultSummaries': [
                {'toolName': tool_names[0], 'summary': query},
                {'toolName': tool_names[1], 'summary': artifact},
            ],
            'rendererAssetBoundary': {
                'assetNetworkRequestCount': 0,
                'remoteAssetResolutionDisabled': True,
            },
            'publicRequestScope': scope,
            'answerChecks': {f'check{index}': True for index in range(10)},
        }), encoding='utf-8')
        cell = f'✅<br>`{relative_path}`'
        for name in tool_names:
            self.assertIsNone(TABLE_CHECKER.evidence_reference_error(name, cell, 'agent_mcp'))
        error = TABLE_CHECKER.evidence_reference_error('bangumi.get_subject', cell, 'agent_mcp')
        self.assertIn('does not contain evidence for bangumi.get_subject', error)

        invalid = json.loads((self.root / relative_path).read_text(encoding='utf-8'))
        invalid['resultSummaries'][1]['summary']['artifact']['decoded'] = False
        (self.root / relative_path).write_text(json.dumps(invalid), encoding='utf-8')
        error = TABLE_CHECKER.evidence_reference_error(
            'bangumi.render_query_subjects', cell, 'agent_mcp',
        )
        self.assertIn('does not contain evidence for bangumi.render_query_subjects', error)

    def test_offline_query_subjects_report_reference_maps_only_query_tool(self):
        relative_path = 'docs/live-probes/g01-query-subjects-offline-agent-mcp-run95.json'
        report = {
            'evidenceKind': 'codex_cli_g01_query_subjects_offline_agent_mcp',
            'profileId': 'g01-query-subjects-offline-agent-mcp-matrix-v1',
            'runNumber': 95,
            'frontierId': 'G01',
            'scenarioId': None,
            'resultStatus': 'SUCCESS',
            'codexMcpToolEventCount': 1,
            'codexErrorItemCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'toolName': 'bangumi.query_subjects',
            'serverToolNames': ['bangumi.query_subjects'],
            'mcpServerNames': ['bgk_g01_query_subjects_offline'],
            'networkMode': 'run95-g01-query-subjects-synthetic-offline-v1',
            'offlineFixture': {
                'profile': 'run95-g01-query-subjects-synthetic-offline-v1',
                'requestCount': 1,
                'searchRequestCount': 1,
                'duplicateRequestCount': 0,
                'unexpectedRequestCount': 0,
                'rejectedHeaderCount': 0,
                'expectedOperationsComplete': True,
                'rawFixturePayloadStored': False,
            },
            'resultSummary': {
                'resultState': 'ok',
                'returnedItems': 1,
                'coverageState': 'partial',
                'requested': 1,
                'returned': 1,
                'pagesScanned': 1,
                'totalKind': 'estimated',
                'warningCount': 1,
            },
            'networkBoundary': {
                'liveBangumiApiRequestCount': 0,
                'unexpectedNetworkRequestCount': 0,
                'rendererAssetRequestCount': 0,
                'fullCodexHarnessNetworkSandboxed': False,
            },
            'answerChecks': {f'check{index}': True for index in range(9)},
            'privacy': {
                'authProfile': 'anonymous',
                'oauthAttempted': False,
                'accountDataRead': False,
                'writesAttempted': False,
                'communityRead': False,
                'qqPipelineTested': False,
                'timClientTested': False,
                'promptStored': False,
                'answerStored': False,
                'rawFixtureRowsStored': False,
                'rawToolResultStored': False,
                'artifactImageBytesStored': False,
                'credentialsStored': False,
            },
        }
        (self.root / relative_path).write_text(json.dumps(report), encoding='utf-8')
        cell = f'✅<br>`{relative_path}`'
        self.assertIsNone(TABLE_CHECKER.evidence_reference_error(
            'bangumi.query_subjects', cell, 'agent_mcp',
        ))
        error = TABLE_CHECKER.evidence_reference_error(
            'bangumi.render_query_subjects', cell, 'agent_mcp',
        )
        self.assertIn('does not contain evidence for bangumi.render_query_subjects', error)

        v2_relative_path = 'docs/live-probes/g01-query-subjects-offline-agent-mcp-v2-run95.json'
        v2_report = {
            **report,
            'evidenceKind': 'codex_cli_g01_query_subjects_offline_agent_mcp_v2',
            'profileId': 'g01-query-subjects-offline-agent-mcp-matrix-v2',
            'mcpServerNames': ['bgk_g01_query_subjects_offline_v2'],
            'networkMode': 'run95-g01-query-subjects-synthetic-offline-v2',
            'offlineFixture': {
                **report['offlineFixture'],
                'profile': 'run95-g01-query-subjects-synthetic-offline-v2',
            },
            'codexErrorItemCount': 3,
            'blockedWebSearchErrorItemCount': 3,
            'unexpectedCodexErrorItemCount': 0,
        }
        (self.root / v2_relative_path).write_text(json.dumps(v2_report), encoding='utf-8')
        v2_cell = f'✅<br>`{v2_relative_path}`'
        self.assertIsNone(TABLE_CHECKER.evidence_reference_error(
            'bangumi.query_subjects', v2_cell, 'agent_mcp',
        ))
        v2_report['codexErrorItemCount'] = 4
        v2_report['blockedWebSearchErrorItemCount'] = 4
        (self.root / v2_relative_path).write_text(json.dumps(v2_report), encoding='utf-8')
        error = TABLE_CHECKER.evidence_reference_error(
            'bangumi.query_subjects', v2_cell, 'agent_mcp',
        )
        self.assertIn('does not contain evidence for bangumi.query_subjects', error)

    def write_g06_cast_offline_v2_report(
        self, relative_path=TABLE_CHECKER.G06_CAST_OFFLINE_V2_REPORT_PATH, **overrides,
    ):
        acknowledgement = 'G06_SYNTHETIC_CAST_MATRIX_EXECUTED'
        report = {
            'schemaVersion': 1,
            'evidenceKind': TABLE_CHECKER.G06_CAST_OFFLINE_V2_REPORT_KIND,
            'runNumber': 95,
            'frontierId': 'G06',
            'scenarioId': None,
            'acceptanceScope': 'agent-mcp-matrix-only',
            'epochId': TABLE_CHECKER.G06_CAST_OFFLINE_V2_EPOCH_ID,
            'profileId': TABLE_CHECKER.G06_CAST_OFFLINE_V2_PROFILE['id'],
            'profile': 'codex-luna-max-offline-agent-mcp-matrix-v2',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'toolName': TABLE_CHECKER.G06_CAST_OFFLINE_V2_TOOL_NAME,
            'argumentProfile': TABLE_CHECKER.G06_CAST_OFFLINE_V2_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': TABLE_CHECKER.G06_CAST_OFFLINE_V2_EXPECTED_ARGUMENTS_SHA256,
            'registrySha256': TABLE_CHECKER.G06_CAST_OFFLINE_V2_REGISTRY_SHA256,
            'serverToolNames': [TABLE_CHECKER.G06_CAST_OFFLINE_V2_TOOL_NAME],
            'serverToolCount': 1,
            'mcpServerNames': ['bgk_g06_cast_offline_profile'],
            'resultStatus': 'SUCCESS',
            'processExitCode': 0,
            'eventStreamParsed': True,
            'turnCompleted': True,
            'codexMcpToolEventCount': 1,
            'codexErrorItemCount': 0,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'networkMode': TABLE_CHECKER.G06_CAST_OFFLINE_V2_NETWORK_MODE,
            'sourceRevision': 'e' * 40,
            'baseSha': 'a' * 40,
            'ciSha': 'e' * 40,
            'ciStatus': 'SUCCESS',
            'ciRunId': '39077898683',
            'ciChecks': [
                {'name': name, 'status': 'COMPLETED', 'conclusion': 'SUCCESS'}
                for name in TABLE_CHECKER.G06_CAST_OFFLINE_V2_REQUIRED_CI_CHECKS
            ],
            'prNumber': 221,
            'claimId': f'profile-run-95-pr-221-{"e" * 12}-1234567890',
            'mcpBundleSha256': 'f' * 64,
            'answerCheckMethod': TABLE_CHECKER.G06_CAST_OFFLINE_V2_ANSWER_CHECK_METHOD,
            'answerSha256': hashlib.sha256(acknowledgement.encode()).hexdigest(),
            'answerUtf8Bytes': len(acknowledgement.encode()),
            'answerChecks': {
                field: True for field in TABLE_CHECKER.G06_CAST_OFFLINE_V2_ANSWER_CHECK_FIELDS
            },
            'toolResultSummary': TABLE_CHECKER.G06_CAST_OFFLINE_V2_TOOL_RESULT_SUMMARY,
            'offlineFixture': TABLE_CHECKER.G06_CAST_OFFLINE_V2_FIXTURE,
            'networkBoundary': TABLE_CHECKER.G06_CAST_OFFLINE_V2_NETWORK_BOUNDARY,
            'privacy': TABLE_CHECKER.G06_CAST_OFFLINE_V2_PRIVACY,
            'selectionEvidenceSha256': '1' * 64,
            'runnerReceipt': {
                'kind': 'g06-cast-offline-agent-mcp-runner-receipt-v1',
                'payload': {},
                'signature': 'synthetic-test-signature',
            },
        }
        report.update(overrides)
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report), encoding='utf-8')
        return relative_path

    def test_g06_v2_offline_report_maps_only_get_subject_cast_agent_mcp(self):
        relative_path = self.write_g06_cast_offline_v2_report()
        cell = f'✅<br>`{relative_path}`'
        self.assertIsNone(TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_subject_cast', cell, 'agent_mcp',
        ))
        error = TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_subject', cell, 'agent_mcp',
        )
        self.assertIn('does not contain evidence for bangumi.get_subject', error)
        public_error = TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_subject_cast', f'◐<br>`{relative_path}`', 'public',
        )
        self.assertIn('does not contain evidence for bangumi.get_subject_cast', public_error)

    def test_g06_v2_offline_report_rejects_wrong_path_and_fixture(self):
        wrong_path = self.write_g06_cast_offline_v2_report(
            'docs/live-probes/copied-g06-v2-report.json',
        )
        error = TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_subject_cast', f'✅<br>`{wrong_path}`', 'agent_mcp',
        )
        self.assertIn('does not contain evidence for bangumi.get_subject_cast', error)

    def test_g06_v2_report_refresh_allows_only_its_acceptance_verifier_files(self):
        profile = GENERATOR.codex_g06_cast_offline_profile_spec(
            GENERATOR.CODEX_G06_CAST_OFFLINE_V2_PROFILE_ID,
        )
        base_paths = set(profile['evidenceRefreshPaths'])
        verifier_paths = GENERATOR.CODEX_G06_CAST_OFFLINE_V2_ACCEPTANCE_REFRESH_PATHS
        self.assertEqual(verifier_paths, {
            '.github/workflows/ci.yml',
            'docs/agent/HARNESS.md',
            'docs/product/frontier-ledger.json',
            'docs/research/run95-g14-query-subjects-v2-terminal-disposition-2026-10-19.md',
            'scripts/check-tool-acceptance-table.py',
            'scripts/test_acceptance_evidence.py',
            'scripts/generate-tool-acceptance-tasks.py',
            'scripts/agent-harness.mjs',
            'scripts/lib/source-revision-tool-catalog.mjs',
            'scripts/acceptance/write-g06-subject-cast-offline-agent-mcp-report.mjs',
            'tests/harness/write-g06-subject-cast-offline-agent-mcp-report.test.mjs',
            'scripts/acceptance/write-r04-render-series-watch-order-offline-agent-mcp-v2-report.mjs',
            'tests/harness/write-r04-render-series-watch-order-offline-agent-mcp-v2-report.test.mjs',
            'tests/harness/agent-harness-cli.test.mjs',
            'tests/harness/g01-public-query-render-evidence.test.mjs',
            'tests/harness/g09-public-watch-order-evidence.test.mjs',
            'tests/harness/g09-public-watch-order-render-evidence.test.mjs',
            'tests/harness/public-probe-coverage.test.mjs',
            'tests/harness/query-subjects-fresh-public-matrix-v2-profile.test.mjs',
            'tests/integration/tool-e2e-acceptance.test.ts',
        })
        self.assertTrue(GENERATOR.codex_g06_cast_offline_profile_evidence_refresh_paths_are_valid(
            base_paths | verifier_paths,
            GENERATOR.CODEX_G06_CAST_OFFLINE_V2_PROFILE_ID,
        ))
        self.assertFalse(GENERATOR.codex_g06_cast_offline_profile_evidence_refresh_paths_are_valid(
            (base_paths | verifier_paths) | {'apps/mcp/src/tools/subject-cast.ts'},
            GENERATOR.CODEX_G06_CAST_OFFLINE_V2_PROFILE_ID,
        ))
        self.assertFalse(GENERATOR.codex_g06_cast_offline_profile_evidence_refresh_paths_are_valid(
            (base_paths | verifier_paths) | {'apps/mcp/codex-one-tool-mcp-server.mjs'},
            GENERATOR.CODEX_G06_CAST_OFFLINE_V2_PROFILE_ID,
        ))
        self.assertFalse(GENERATOR.codex_g06_cast_offline_profile_evidence_refresh_paths_are_valid(
            verifier_paths,
            GENERATOR.CODEX_G06_CAST_OFFLINE_V2_PROFILE_ID,
        ))
        self.assertFalse(GENERATOR.codex_g06_cast_offline_profile_evidence_refresh_paths_are_valid(
            base_paths | verifier_paths,
            GENERATOR.CODEX_G06_CAST_OFFLINE_PROFILE_ID,
        ))

    def test_g06_v2_acceptance_ci_reads_harness_state_with_scoped_read_only_token(self):
        workflow = (GENERATOR.ROOT / '.github/workflows/ci.yml').read_text(encoding='utf-8')
        harness_job = workflow.split('  harness-control:\n', 1)[1].split(
            '\n  sqlite-default:\n', 1,
        )[0]
        self.assertIn(
            '    permissions:\n'
            '      contents: read\n'
            '      checks: read\n'
            '      issues: read\n'
            '      pull-requests: read\n',
            harness_job,
        )
        self.assertIn(
            '      - name: Validate tool acceptance evidence and matrix\n'
            '        env:\n'
            '          GH_TOKEN: ${{ github.token }}\n'
            '        run: pnpm acceptance:check',
            harness_job,
        )
        self.assertEqual(workflow.count('GH_TOKEN: ${{ github.token }}'), 1)
        self.assertNotIn('write', harness_job)

    def test_g06_v2_report_refresh_binds_live_pr_head_before_harness_candidate_update(self):
        profile = GENERATOR.codex_g06_cast_offline_profile_spec(
            GENERATOR.CODEX_G06_CAST_OFFLINE_V2_PROFILE_ID,
        )
        source_revision = 'e' * 40
        current_head = 'f' * 40
        base_sha = 'a' * 40
        branch = 'codex/epoch-run95-g06-cast-offline-matrix-v2-20261018'
        report = {
            'profileId': profile['id'],
            'prNumber': 221,
            'sourceRevision': source_revision,
            'baseSha': base_sha,
            'mcpBundleSha256': 'c' * 64,
        }
        epoch_status = {
            'run': {
                'number': 95,
                'state': {'state': 'EPOCH_ACTIVE', 'active_epoch_pr': 221},
            },
            'epoch': {
                'github_state': 'OPEN',
                'state': {
                    'epoch_id': profile['epochId'],
                    'pr_number': 221,
                    'base_branch': 'master',
                    'base_sha': base_sha,
                    'candidate_sha': source_revision,
                    'branch': branch,
                },
                'pr_base_ref_name': 'master',
                'pr_base_sha': base_sha,
                'pr_head_ref_name': branch,
                'pr_is_draft': False,
                'pr_head_sha': current_head,
            },
        }
        paths = set(GENERATOR.codex_g06_cast_offline_profile_spec(profile['id'])['evidenceRefreshPaths'])
        paths.update(GENERATOR.CODEX_G06_CAST_OFFLINE_V2_ACCEPTANCE_REFRESH_PATHS)
        self.assertTrue(GENERATOR.codex_g06_cast_offline_profile_candidate_binding_is_valid(
            report, epoch_status, paths, 'c' * 64,
        ))
        with (
            patch.object(
                GENERATOR,
                '_codex_g06_cast_offline_report_candidate_paths',
                return_value=paths,
            ) as candidate_paths,
            patch.object(GENERATOR, 'codex_g26_candidate_bundle_sha256', return_value='c' * 64),
        ):
            self.assertTrue(
                GENERATOR.codex_g06_cast_offline_profile_report_candidate_binding_is_current(
                    report, epoch_status,
                ),
            )
            candidate_paths.assert_called_once_with(source_revision, current_head)

        epoch_status['epoch']['state']['candidate_sha'] = 'd' * 40
        self.assertFalse(GENERATOR.codex_g06_cast_offline_profile_candidate_binding_is_valid(
            report, epoch_status, paths, 'c' * 64,
        ))

        relative_path = self.write_g06_cast_offline_v2_report(
            offlineFixture={
                **TABLE_CHECKER.G06_CAST_OFFLINE_V2_FIXTURE,
                'requestCount': 2,
            },
        )
        error = TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_subject_cast', f'✅<br>`{relative_path}`', 'agent_mcp',
        )
        self.assertIn('does not contain evidence for bangumi.get_subject_cast', error)

    def write_r01_offline_report(
        self, relative_path=TABLE_CHECKER.R01_OFFLINE_REPORT_PATH, **overrides,
    ):
        report = {
            'schemaVersion': 1,
            'evidenceKind': TABLE_CHECKER.R01_OFFLINE_REPORT_KIND,
            'runNumber': 95,
            'frontierId': 'R01',
            'scenarioId': None,
            'acceptanceScope': 'agent-mcp-matrix-only',
            'epochId': TABLE_CHECKER.R01_OFFLINE_EPOCH_ID,
            'profileId': TABLE_CHECKER.R01_OFFLINE_PROFILE_ID,
            'profile': 'codex-luna-max-offline-agent-mcp-matrix-v2',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'toolName': TABLE_CHECKER.R01_OFFLINE_TOOL_NAME,
            'argumentProfile': TABLE_CHECKER.R01_OFFLINE_ARGUMENT_PROFILE,
            'serverToolNames': [TABLE_CHECKER.R01_OFFLINE_TOOL_NAME],
            'serverToolCount': 1,
            'mcpServerNames': ['bgk_r01_relations'],
            'resultStatus': 'SUCCESS',
            'processExitCode': 0,
            'eventStreamParsed': True,
            'turnCompleted': True,
            'codexMcpToolEventCount': 1,
            'codexErrorItemCount': 2,
            'blockedWebSearchErrorItemCount': 2,
            'unexpectedCodexErrorItemCount': 0,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'networkMode': TABLE_CHECKER.R01_OFFLINE_NETWORK_MODE,
            'answerCheckMethod': TABLE_CHECKER.R01_OFFLINE_ANSWER_CHECK_METHOD,
            'answerSha256': 'f' * 64,
            'answerUtf8Bytes': 512,
            'resultSummary': {
                'sourceRowsObserved': 30,
                'sourceRowsReturned': 30,
                'sourceSchemaDriftRows': 0,
                'sourceTruncated': False,
                'textRowsIncluded': 12,
                'textRowsOmitted': 18,
                'textUtf8Bytes': 2580,
                'structuredContentAvailable': True,
                'textProjectionConsistent': True,
                'firstDisplayedRelationMatched': True,
            },
            'offlineFixture': TABLE_CHECKER.R01_OFFLINE_FIXTURE,
            'networkBoundary': TABLE_CHECKER.R01_OFFLINE_NETWORK_BOUNDARY,
            'privacy': TABLE_CHECKER.R01_OFFLINE_PRIVACY,
            'answerChecks': {
                field: True for field in TABLE_CHECKER.R01_OFFLINE_ANSWER_CHECK_FIELDS
            },
        }
        report.update(overrides)
        path = self.root / relative_path
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(report), encoding='utf-8')
        return relative_path

    def test_r01_offline_matrix_report_maps_only_subject_relations_agent_mcp(self):
        relative_path = self.write_r01_offline_report()
        cell = f'✅<br>`{relative_path}`'
        self.assertIsNone(TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_subject_relations', cell, 'agent_mcp',
        ))
        error = TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_subject', cell, 'agent_mcp',
        )
        self.assertIn('does not contain evidence for bangumi.get_subject', error)

        public_error = TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_subject_relations',
            f'◐<br>`{relative_path}`', 'public',
        )
        self.assertIn('does not contain evidence for bangumi.get_subject_relations', public_error)

    def test_r01_offline_matrix_report_requires_its_exact_path_and_tool_contract(self):
        wrong_path = self.write_r01_offline_report('docs/live-probes/copied-r01-report.json')
        error = TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_subject_relations', f'✅<br>`{wrong_path}`', 'agent_mcp',
        )
        self.assertIn('does not contain evidence for bangumi.get_subject_relations', error)

        relative_path = self.write_r01_offline_report(toolName='bangumi.get_subject')
        error = TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_subject_relations', f'✅<br>`{relative_path}`', 'agent_mcp',
        )
        self.assertIn('does not contain evidence for bangumi.get_subject_relations', error)

        relative_path = self.write_r01_offline_report(
            evidenceKind='unrelated_agent_mcp_report',
        )
        error = TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_subject_relations', f'✅<br>`{relative_path}`', 'agent_mcp',
        )
        self.assertIn('does not contain evidence for bangumi.get_subject_relations', error)

        relative_path = self.write_r01_offline_report(
            offlineFixture={**TABLE_CHECKER.R01_OFFLINE_FIXTURE, 'requestCount': 2},
        )
        error = TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_subject_relations', f'✅<br>`{relative_path}`', 'agent_mcp',
        )
        self.assertIn('does not contain evidence for bangumi.get_subject_relations', error)

    def test_accepts_auth_denial_report_reference_for_the_same_tool(self):
        self.assertIsNone(TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_my_profile',
            '✅<br>`docs/live-probes/auth-denial-fixture.json`',
            'auth_denial',
        ))

    def test_accepts_live_qq_pipeline_report_reference_for_the_same_tool(self):
        self.assertIsNone(TABLE_CHECKER.evidence_reference_error(
            'bangumi.render_subject_overview',
            f'✅<br>`docs/live-probes/{self.client_report_name}`', 'qq_pipeline',
        ))

    def test_accepts_live_tim_client_report_reference_for_the_same_tool(self):
        self.assertIsNone(TABLE_CHECKER.evidence_reference_error(
            'bangumi.render_subject_overview',
            f'✅<br>`docs/live-probes/{self.client_report_name}`', 'tim_client',
        ))

    def test_rejects_tim_client_report_for_a_different_tool(self):
        error = TABLE_CHECKER.evidence_reference_error(
            'bangumi.get_subject',
            f'✅<br>`docs/live-probes/{self.client_report_name}`', 'tim_client',
        )
        self.assertIn('does not contain evidence for bangumi.get_subject', error)

    def test_rejects_client_report_without_catalog_binding(self):
        report = dict(self.client_report)
        report['catalogSha256'] = '0' * 64
        (self.root / 'docs/live-probes' / self.client_report_name).write_text(
            json.dumps(report), encoding='utf-8',
        )
        error = TABLE_CHECKER.evidence_reference_error(
            'bangumi.render_subject_overview',
            f'✅<br>`docs/live-probes/{self.client_report_name}`', 'tim_client',
        )
        self.assertIn('does not contain evidence', error)

    def test_rejects_success_status_without_a_report_path(self):
        error = TABLE_CHECKER.evidence_reference_error('bangumi.get_subject', '◐', 'public')
        self.assertIn('requires report paths', error)


class AuthAcceptanceEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix='auth-acceptance-evidence-test-')
        self.report_path = Path(self.temp_dir.name) / 'auth-report.json'
        template_path = Path(__file__).parents[1] / 'docs/auth-acceptance-report.template.json'
        self.report = json.loads(template_path.read_text(encoding='utf-8'))

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_rejects_passing_report_with_unverified_steps(self):
        self.report['report_status'] = 'PASS'
        self.report_path.write_text(json.dumps(self.report), encoding='utf-8')
        completed = subprocess.run(
            [sys.executable, str(Path(__file__).with_name('validate-auth-acceptance.py')),
             '--report', str(self.report_path)],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertNotEqual(completed.returncode, 0)
        self.assertIn('report_status PASS requires all flow steps to pass', completed.stdout)

    def test_rejects_passed_step_without_evidence(self):
        self.report['flow'][0]['status'] = 'PASS'
        self.report_path.write_text(json.dumps(self.report), encoding='utf-8')
        completed = subprocess.run(
            [sys.executable, str(Path(__file__).with_name('validate-auth-acceptance.py')),
             '--report', str(self.report_path)],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertNotEqual(completed.returncode, 0)
        self.assertIn('marked PASS must include evidence', completed.stdout)

    def test_accepts_complete_pass_report_with_evidence(self):
        self.report['report_status'] = 'PASS'
        for step in self.report['flow']:
            step['status'] = 'PASS'
            step['evidence'] = ['sanitized result and timestamp']
        self.report_path.write_text(json.dumps(self.report), encoding='utf-8')
        completed = subprocess.run(
            [sys.executable, str(Path(__file__).with_name('validate-auth-acceptance.py')),
             '--report', str(self.report_path)],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(completed.returncode, 0, completed.stdout + completed.stderr)


class R05PreflightEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.path = GENERATOR.ROOT / GENERATOR.CODEX_R05_SELECTION_EVIDENCE_RELATIVE_PATH
        self.evidence = json.loads(self.path.read_text(encoding='utf-8'))

    def test_accepts_exact_anonymous_subject_and_cast_id_preflight(self):
        self.assertTrue(GENERATOR.codex_r05_selection_evidence_is_valid(self.evidence))
        self.assertTrue(GENERATOR.codex_r05_selection_evidence_file_is_valid())

    def test_rejects_changed_subject_ids_or_missing_positive_intersection(self):
        changed_subject = json.loads(json.dumps(self.evidence))
        changed_subject['selectedSubjects'][1]['id'] = 876
        self.assertFalse(GENERATOR.codex_r05_selection_evidence_is_valid(changed_subject))

        no_shared_ids = json.loads(json.dumps(self.evidence))
        no_shared_ids['sharedPersonIds'] = []
        self.assertFalse(GENERATOR.codex_r05_selection_evidence_is_valid(no_shared_ids))

        wrong_endpoint = json.loads(json.dumps(self.evidence))
        wrong_endpoint['characterRows'][0]['endpoint'] = 'https://api.bgm.tv/v0/subjects/1424/subjects'
        self.assertFalse(GENERATOR.codex_r05_selection_evidence_is_valid(wrong_endpoint))

    def test_rejects_authentication_or_raw_person_data(self):
        authenticated = json.loads(json.dumps(self.evidence))
        authenticated['oauthAttempted'] = True
        self.assertFalse(GENERATOR.codex_r05_selection_evidence_is_valid(authenticated))

        retained_names = json.loads(json.dumps(self.evidence))
        retained_names['personNamesStored'] = True
        self.assertFalse(GENERATOR.codex_r05_selection_evidence_is_valid(retained_names))


class R05CandidateBindingTests(unittest.TestCase):
    def setUp(self):
        candidate = 'a' * 40
        base = 'b' * 40
        self.report = {
            'sourceRevision': candidate,
            'baseSha': base,
            'prNumber': 170,
            'mcpBundleSha256': 'c' * 64,
        }
        self.status = {
            'run': {
                'number': 95,
                'state': {'state': 'EPOCH_ACTIVE', 'active_epoch_pr': 170},
            },
            'epoch': {
                'github_state': 'OPEN',
                'state': {
                    'epoch_id': GENERATOR.CODEX_R05_EPOCH_ID,
                    'pr_number': 170,
                    'base_branch': 'master',
                    'base_sha': base,
                    'candidate_sha': candidate,
                    'branch': 'codex/epoch-r05',
                },
                'pr_head_sha': candidate,
                'pr_head_ref_name': 'codex/epoch-r05',
                'pr_base_ref_name': 'master',
                'pr_base_sha': base,
                'pr_is_draft': False,
            },
        }
        self.paths = [
            GENERATOR.CODEX_R05_REPORT_RELATIVE_PATH,
            'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
            'docs/product/frontier-ledger.json',
        ]

    def test_accepts_current_candidate_and_only_report_refresh_paths(self):
        self.assertTrue(
            GENERATOR.codex_r05_profile_candidate_binding_is_valid(
                self.report, self.status, self.paths, self.report['mcpBundleSha256'],
            ),
        )
        self.assertTrue(GENERATOR.codex_r05_profile_evidence_refresh_paths_are_valid(self.paths))

    def test_rejects_candidate_or_path_drift(self):
        changed = json.loads(json.dumps(self.status))
        changed['epoch']['state']['base_sha'] = 'd' * 40
        changed['epoch']['pr_base_sha'] = 'd' * 40
        self.assertFalse(
            GENERATOR.codex_r05_profile_candidate_binding_is_valid(
                self.report, changed, self.paths, self.report['mcpBundleSha256'],
            ),
        )
        self.assertFalse(
            GENERATOR.codex_r05_profile_evidence_refresh_paths_are_valid(
                self.paths + ['docs/agent/PRODUCT_CHARTER.md'],
            ),
        )


class R05ProfileReportValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix='r05-profile-report-test-')
        self.root = Path(self.temp_dir.name)
        (self.root / 'docs/live-probes').mkdir(parents=True)
        selection_path = self.root / GENERATOR.CODEX_R05_SELECTION_EVIDENCE_RELATIVE_PATH
        selection_path.parent.mkdir(parents=True, exist_ok=True)
        source_selection = GENERATOR.ROOT / GENERATOR.CODEX_R05_SELECTION_EVIDENCE_RELATIVE_PATH
        selection_path.write_bytes(source_selection.read_bytes())
        self.report_path = self.root / GENERATOR.CODEX_R05_REPORT_RELATIVE_PATH
        self.original_root = GENERATOR.ROOT
        self.original_live_probe_dir = GENERATOR.LIVE_PROBE_DIR
        GENERATOR.ROOT = self.root
        GENERATOR.LIVE_PROBE_DIR = self.root / 'docs/live-probes'
        self.report = self.build_report()

    def tearDown(self):
        GENERATOR.ROOT = self.original_root
        GENERATOR.LIVE_PROBE_DIR = self.original_live_probe_dir
        self.temp_dir.cleanup()

    def build_report(self):
        selection_path = self.root / GENERATOR.CODEX_R05_SELECTION_EVIDENCE_RELATIVE_PATH
        selection_bytes = selection_path.read_bytes()
        source_revision = 'a' * 40
        shared_person = {'personId': 3847, 'creditSubjectIds': [1424, 3774]}
        return {
            'schemaVersion': 1,
            'evidenceKind': GENERATOR.CODEX_R05_EVIDENCE_KIND,
            'runNumber': 95,
            'frontierId': 'R05',
            'scenarioId': 'R05',
            'epochId': GENERATOR.CODEX_R05_EPOCH_ID,
            'profileId': GENERATOR.CODEX_R05_PROFILE_ID,
            'profile': 'codex-luna-max-agent-mcp-profile-v1',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'reviewerId': 'gpt-6-luna-max-run95-pr42-round1',
            'codexCliVersion': '1.2.14',
            'sourceRevision': source_revision,
            'baseSha': 'b' * 40,
            'ciSha': source_revision,
            'ciStatus': 'SUCCESS',
            'prNumber': 42,
            'claimId': 'profile-run-95-pr-42-abcdef123456-1700000000000',
            'mcpBundleSha256': 'c' * 64,
            'registrySha256': GENERATOR.CODEX_R05_PROFILE_REGISTRY_SHA256,
            'toolName': GENERATOR.CODEX_R05_TOOL_NAME,
            'argumentProfile': GENERATOR.CODEX_R05_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR.CODEX_R05_EXPECTED_ARGUMENTS_SHA256,
            'selectionEvidenceSha256': hashlib.sha256(selection_bytes).hexdigest(),
            'catalogSha256': 'd' * 64,
            'toolDescriptionSha256': 'e' * 64,
            'inputSchemaSha256': 'f' * 64,
            'serverToolNames': [GENERATOR.CODEX_R05_TOOL_NAME],
            'serverToolCount': 1,
            'mcpServerNames': ['bgk_r05_overlap'],
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'mcpTextProjectionValid': True,
            'eventStreamParsed': True,
            'turnCompleted': True,
            'codexMcpToolEventCount': 1,
            'codexErrorItemCount': 0,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'answerCheckMethod': GENERATOR.CODEX_R05_ANSWER_CHECK_METHOD,
            'answerSha256': '1' * 64,
            'answerUtf8Bytes': 128,
            'answerChecks': {field: True for field in GENERATOR.CODEX_R05_ANSWER_CHECK_FIELDS},
            'resultSummary': {
                'subjectIds': [1424, 3774],
                'state': 'partial',
                'kind': 'cast',
                'castRole': 'all',
                'formulaVersion': 'subject-overlap-v1',
                'subjects': [
                    {'subjectId': 1424, 'type': 'anime', 'state': 'partial'},
                    {'subjectId': 3774, 'type': 'anime', 'state': 'partial'},
                ],
                'pair': {
                    'pairId': '1424:3774',
                    'leftSubjectId': 1424,
                    'rightSubjectId': 3774,
                    'rank': 1,
                    'cast': {
                        'state': 'partial',
                        'sharedPeople': [shared_person],
                        'coverage': {},
                    },
                },
                'coverage': {
                    'requestedSubjects': 2,
                    'returnedSubjects': 2,
                    'requestedPairs': 1,
                    'returnedPairs': 1,
                    'omittedPairs': 0,
                    'limits': {'maxCast': 80, 'maxPairs': 1, 'maxPeople': 8},
                    'truncated': True,
                },
                'source': {
                    'official': {
                        'class': 'official-v0',
                        'operations': GENERATOR.CODEX_R05_OFFICIAL_OPERATIONS,
                        'attemptedAt': '2026-10-15T07:39:00Z',
                        'retrievedAt': '2026-10-15T07:39:01Z',
                    },
                    'derived': {
                        'class': 'derived-s7',
                        'operations': GENERATOR.CODEX_R05_DERIVED_OPERATIONS,
                        'attemptedAt': '2026-10-15T07:39:00Z',
                        'retrievedAt': '2026-10-15T07:39:01Z',
                    },
                },
                'warnings': [],
            },
            'privacy': {field: False for field in GENERATOR.CODEX_R05_PRIVACY_FIELDS},
            'runnerReceipt': {},
        }

    def validate_report(self, report):
        self.report_path.write_text(json.dumps(report), encoding='utf-8')
        report_bytes = self.report_path.read_bytes()

        def validate_embedded_report(args, **kwargs):
            payload = json.loads(kwargs['input'])
            embedded = base64.b64decode(payload['reportBytesBase64'])
            return subprocess.CompletedProcess(
                args,
                0,
                json.dumps({'passed': True, 'reportSha256': hashlib.sha256(embedded).hexdigest()}),
                '',
            )

        with (
            patch.object(GENERATOR, 'codex_r05_profile_revision_has_implementation', return_value=True),
            patch.object(GENERATOR, 'codex_r05_profile_report_candidate_binding_is_current', return_value=True),
            patch.object(GENERATOR, 'codex_r05_profile_disposition_matches_report', return_value={'state': 'REPORT_WRITTEN'}),
            patch.object(GENERATOR.subprocess, 'run', side_effect=validate_embedded_report),
        ):
            return GENERATOR.codex_r05_profile_report_is_valid(
                report,
                harness_status={'fixture': True},
                report_path=self.report_path,
                epoch_status={'fixture': True},
            )

    def test_accepts_a_well_shaped_positive_report_when_embedded_validation_passes(self):
        self.assertTrue(self.validate_report(self.report))

    def test_rejects_unverified_ids_extra_raw_fields_and_privacy_expansion(self):
        unknown_person = json.loads(json.dumps(self.report))
        unknown_person['resultSummary']['pair']['cast']['sharedPeople'][0]['personId'] = 9999
        self.assertFalse(self.validate_report(unknown_person))

        raw_answer = json.loads(json.dumps(self.report))
        raw_answer['rawAnswer'] = 'not allowed'
        self.assertFalse(self.validate_report(raw_answer))

        privacy_expansion = json.loads(json.dumps(self.report))
        privacy_expansion['privacy']['accountDataRead'] = True
        self.assertFalse(self.validate_report(privacy_expansion))

        unbound_source_operation = json.loads(json.dumps(self.report))
        unbound_source_operation['resultSummary']['source']['official']['operations'] = [
            'GET /community/topics',
        ]
        self.assertFalse(self.validate_report(unbound_source_operation))


class P06OfflineProfileReportValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix='p06-offline-profile-report-test-')
        self.root = Path(self.temp_dir.name)
        self.report_path = self.root / GENERATOR.CODEX_P06_REPORT_RELATIVE_PATH
        self.report_path.parent.mkdir(parents=True)
        selection_path = self.root / GENERATOR.CODEX_P06_SELECTION_EVIDENCE_RELATIVE_PATH
        selection_path.parent.mkdir(parents=True, exist_ok=True)
        selection_path.write_bytes(
            (GENERATOR.ROOT / GENERATOR.CODEX_P06_SELECTION_EVIDENCE_RELATIVE_PATH).read_bytes(),
        )
        v3_selection_path = self.root / GENERATOR.CODEX_P06_V3_SELECTION_EVIDENCE_RELATIVE_PATH
        v3_selection_path.parent.mkdir(parents=True, exist_ok=True)
        v3_selection_path.write_bytes(
            (GENERATOR.ROOT / GENERATOR.CODEX_P06_V3_SELECTION_EVIDENCE_RELATIVE_PATH).read_bytes(),
        )
        self.catalog_path = self.root / 'docs/tool-catalog.json'
        self.catalog_path.parent.mkdir(parents=True, exist_ok=True)
        self.catalog_path.write_bytes(GENERATOR.CATALOG.read_bytes())
        frontier_path = self.root / 'docs/product/frontier-ledger.json'
        frontier_path.parent.mkdir(parents=True, exist_ok=True)
        frontier = json.loads((GENERATOR.ROOT / 'docs/product/frontier-ledger.json').read_text())
        p06 = next(record for record in frontier['records'] if record['id'] == 'P06')
        p06['source_refs'].append(GENERATOR.CODEX_P06_REPORT_RELATIVE_PATH)
        if GENERATOR.CODEX_P06_V3_SELECTION_EVIDENCE_RELATIVE_PATH not in p06['source_refs']:
            p06['source_refs'].append(GENERATOR.CODEX_P06_V3_SELECTION_EVIDENCE_RELATIVE_PATH)
        frontier_path.write_text(json.dumps(frontier), encoding='utf-8')
        self.originals = (GENERATOR.ROOT, GENERATOR.CATALOG, GENERATOR.LIVE_PROBE_DIR)
        GENERATOR.ROOT = self.root
        GENERATOR.CATALOG = self.catalog_path
        GENERATOR.LIVE_PROBE_DIR = self.root / 'docs/live-probes'
        self.report = self.build_report()

    def tearDown(self):
        GENERATOR.ROOT, GENERATOR.CATALOG, GENERATOR.LIVE_PROBE_DIR = self.originals
        self.temp_dir.cleanup()

    def build_report(self, profile_id=None):
        profile = GENERATOR.codex_p06_profile_spec(profile_id)
        chronology_request_count = GENERATOR.codex_p06_profile_chronology_request_count(profile)
        catalog_bytes = self.catalog_path.read_bytes()
        catalog = json.loads(catalog_bytes)
        tool = next(item for item in catalog if item['name'] == profile['toolName'])
        selection_bytes = (self.root / profile['selectionEvidencePath']).read_bytes()
        fixture = {
            'profile': profile['networkMode'], 'requestCount': 3 + chronology_request_count,
            'personRequestCount': 1, 'subjectsRequestCount': 1, 'charactersRequestCount': 1,
            **({'chronologyRequestCount': chronology_request_count} if chronology_request_count else {}),
            'duplicateRequestCount': 0, 'unexpectedRequestCount': 0,
            'authorizationHeaderCount': 0, 'expectedOperationsComplete': True,
        }
        receipt_payload = {field: None for field in GENERATOR.CODEX_P06_RECEIPT_PAYLOAD_FIELDS}
        return {
            'schemaVersion': 1, 'evidenceKind': profile['evidenceKind'],
            'runNumber': 95, 'frontierId': 'P06', 'scenarioId': None,
            'epochId': profile['epochId'],
            'profileId': profile['id'],
            'profile': GENERATOR.codex_p06_profile_label(profile),
            'model': profile['model'], 'reasoningEffort': profile['reasoningEffort'],
            'reviewerId': 'gpt-6-luna-max-run95-pr222-round1', 'codexCliVersion': '1.2.14',
            'observedAt': '2026-10-16T05:00:00.000Z', 'sourceRevision': 'a' * 40,
            'baseSha': 'b' * 40, 'ciSha': 'a' * 40, 'ciStatus': 'SUCCESS',
            'ciRunId': '38806371672',
            'ciChecks': [
                {'name': name, 'status': 'COMPLETED', 'conclusion': 'SUCCESS'}
                for name in GENERATOR.CODEX_P06_REQUIRED_CI_CHECKS
            ],
            'prNumber': 222, 'claimId': 'profile-run-95-pr-222-aaaaaaaaaaaa-1792100000000',
            'mcpBundleSha256': 'c' * 64,
            'registrySha256': GENERATOR.codex_p06_profile_registry_sha256(profile),
            'selectionEvidenceSha256': hashlib.sha256(selection_bytes).hexdigest(),
            'toolName': profile['toolName'],
            'argumentProfile': profile['argumentProfile'],
            'expectedArgumentsSha256': GENERATOR.codex_p06_profile_expected_arguments_sha256(profile),
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(tool['description'].encode()).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'serverToolNames': [profile['toolName']], 'serverToolCount': 1,
            'networkMode': profile['networkMode'],
            'mcpServerNames': ['bgk_p06_profile'], 'processExitCode': 0,
            'resultStatus': 'SUCCESS', 'eventStreamParsed': True, 'turnCompleted': True,
            'codexMcpToolEventCount': 1, 'codexErrorItemCount': 0,
            'nonMcpToolEventCount': 0, 'nonMcpToolTypes': [], 'shellToolCallCount': 0,
            'allowedCallCount': 1, 'deniedCallCount': 0,
            'answerCheckMethod': profile['answerCheckMethod'],
            'answerSha256': hashlib.sha256(b'P06_SYNTHETIC_PROFILE_RENDERED').hexdigest(),
            'answerUtf8Bytes': len(b'P06_SYNTHETIC_PROFILE_RENDERED'),
            'answerChecks': {
                key: True for key in GENERATOR.codex_p06_profile_answer_check_fields(profile)
            },
            'offlineFixture': fixture,
            'offlineAssetBoundary': {
                'assetResolutionCallCount': 0, 'nonEmptyAssetUrlCount': 0,
                'blockedAssetRequestCount': 0,
            },
            'networkBoundary': {
                'liveBangumiApiRequestCount': 0, 'rendererAssetRequestCount': 0,
                'fullCodexHarnessNetworkSandboxed': False,
            },
            'artifact': {
                'returned': True, 'persisted': False, 'mimeType': 'image/png',
                'width': 480, 'height': 640, 'byteLength': 12000,
                'sha256': 'd' * 64, 'pngSignatureValid': True,
            },
            'privacy': {
                'authProfile': 'anonymous', 'oauthAttempted': False, 'accountDataRead': False,
                'writesAttempted': False, 'communityRead': False, 'qqPipelineTested': False,
                'timClientTested': False, 'promptStored': False, 'answerStored': False,
                'rawFixtureRowsStored': False, 'rawToolResultStored': False,
                'artifactImageBytesStored': False, 'credentialsStored': False,
            },
            'runnerReceipt': {
                'schemaVersion': 1,
                'kind': 'p06-render-person-profile-offline-runner-receipt-v1',
                'publicKeyBase64': 'AQ==', 'publicKeySha256': 'e' * 64,
                'payload': receipt_payload, 'signature': 'AA==',
            },
        }

    def validate_report(self, report, report_path=None):
        selected_report_path = report_path or self.report_path
        selected_report_path.parent.mkdir(parents=True, exist_ok=True)
        selected_report_path.write_text(json.dumps(report), encoding='utf-8')

        def validate_embedded_report(args, **kwargs):
            payload = json.loads(kwargs['input'])
            embedded = base64.b64decode(payload['reportBytesBase64'])
            return subprocess.CompletedProcess(
                args, 0,
                json.dumps({'passed': True, 'reportSha256': hashlib.sha256(embedded).hexdigest()}),
                '',
            )

        with (
            patch.object(GENERATOR, 'codex_p06_profile_revision_has_implementation', return_value=True),
            patch.object(GENERATOR, 'codex_g26_candidate_bundle_sha256', return_value='c' * 64),
            patch.object(GENERATOR, 'codex_p06_profile_report_candidate_binding_is_current', return_value=True),
            patch.object(GENERATOR, 'codex_p06_profile_disposition_matches_report', return_value={'state': 'REPORT_WRITTEN'}),
            patch.object(GENERATOR.subprocess, 'run', side_effect=validate_embedded_report),
        ):
            return GENERATOR.codex_p06_profile_report_is_valid(
                report, harness_status={'fixture': True}, report_path=selected_report_path,
                epoch_status={'fixture': True},
            )

    def test_accepts_one_synthetic_matrix_report_while_P06_remains_unassessed(self):
        self.assertTrue(GENERATOR.codex_p06_frontier_is_unassessed())
        self.assertTrue(self.validate_report(self.report))

    def test_accepts_v3_chronology_matrix_report_with_exact_fixture_counts(self):
        profile = GENERATOR.codex_p06_profile_spec(GENERATOR.CODEX_P06_V3_PROFILE_ID)
        report = self.build_report(GENERATOR.CODEX_P06_V3_PROFILE_ID)
        report_path = self.root / profile['reportPath']
        self.assertTrue(GENERATOR.codex_p06_frontier_is_unassessed(profile['id']))
        self.assertEqual(report['offlineFixture']['requestCount'], 6)
        self.assertEqual(report['offlineFixture']['chronologyRequestCount'], 3)
        self.assertTrue(self.validate_report(report, report_path))

        wrong_chronology_count = json.loads(json.dumps(report))
        wrong_chronology_count['offlineFixture']['chronologyRequestCount'] = 2
        self.assertFalse(self.validate_report(wrong_chronology_count, report_path))

        missing_chronology_check = json.loads(json.dumps(report))
        del missing_chronology_check['answerChecks']['expectedChronologyResponses']
        self.assertFalse(self.validate_report(missing_chronology_check, report_path))

    def test_v3_implementation_markers_cover_the_exact_current_candidate(self):
        result = subprocess.run(
            ['git', 'rev-parse', 'HEAD'],
            cwd=self.originals[0],
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        candidate_sha = result.stdout.strip()
        self.assertRegex(candidate_sha, r'^[0-9a-f]{40}$')
        with patch.object(GENERATOR, 'ROOT', self.originals[0]):
            self.assertTrue(
                GENERATOR.codex_p06_profile_revision_has_implementation(
                    candidate_sha, GENERATOR.CODEX_P06_V3_PROFILE_ID,
                ),
            )

    def test_v3_evidence_refresh_allowlist_is_limited_to_its_exact_validators(self):
        profile = GENERATOR.codex_p06_profile_spec(GENERATOR.CODEX_P06_V3_PROFILE_ID)
        paths = {
            profile['reportPath'],
            'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
            'docs/product/frontier-ledger.json',
            'scripts/agent-harness.mjs',
            'scripts/check-tool-acceptance-table.py',
            'scripts/generate-tool-acceptance-tasks.py',
            'scripts/test_acceptance_evidence.py',
            'tests/integration/tool-e2e-acceptance.test.ts',
            'tests/harness/agent-harness-cli.test.mjs',
        }
        self.assertTrue(
            GENERATOR.codex_p06_profile_evidence_refresh_paths_are_valid(paths, profile['id']),
        )
        self.assertFalse(
            GENERATOR.codex_p06_profile_evidence_refresh_paths_are_valid(
                paths | {'apps/mcp/codex-one-tool-mcp-server.mjs'}, profile['id'],
            ),
        )
        self.assertFalse(
            GENERATOR.codex_p06_profile_evidence_refresh_paths_are_valid(
                paths - {profile['reportPath']}, profile['id'],
            ),
        )

    def test_v3_report_binding_accepts_only_a_bounded_descendant_of_the_refreshed_candidate(self):
        profile = GENERATOR.codex_p06_profile_spec(GENERATOR.CODEX_P06_V3_PROFILE_ID)
        report = self.build_report(profile['id'])
        source_sha = 'a' * 40
        base_sha = 'b' * 40
        recorded_candidate_sha = 'c' * 40
        pr_head_sha = 'd' * 40
        branch = f"codex/epoch-{profile['epochId']}"
        report.update({
            'sourceRevision': source_sha,
            'baseSha': base_sha,
            'prNumber': 222,
        })
        epoch_status = {
            'run': {
                'number': 95,
                'state': {'state': 'EPOCH_ACTIVE', 'active_epoch_pr': 222},
            },
            'epoch': {
                'github_state': 'OPEN',
                'state': {
                    'state': 'REVIEW_READY',
                    'candidate_sha': recorded_candidate_sha,
                    'epoch_id': profile['epochId'],
                    'pr_number': 222,
                    'base_branch': 'master',
                    'base_sha': base_sha,
                    'branch': branch,
                    'review_history': [],
                },
                'pr_base_ref_name': 'master',
                'pr_base_sha': base_sha,
                'pr_head_ref_name': branch,
                'pr_is_draft': False,
                'pr_head_sha': pr_head_sha,
            },
        }
        paths = {
            profile['reportPath'],
            'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
            'docs/product/frontier-ledger.json',
            'scripts/agent-harness.mjs',
            'scripts/check-tool-acceptance-table.py',
            'scripts/generate-tool-acceptance-tasks.py',
            'scripts/test_acceptance_evidence.py',
            'tests/integration/tool-e2e-acceptance.test.ts',
            'tests/harness/agent-harness-cli.test.mjs',
        }
        def successful_ancestry(*args):
            return subprocess.CompletedProcess(args, 0)

        with patch.object(GENERATOR, '_run_repository_git', side_effect=successful_ancestry):
            self.assertTrue(GENERATOR.codex_p06_profile_candidate_binding_is_valid(
                report, epoch_status, paths, report['mcpBundleSha256'],
            ))
            self.assertFalse(GENERATOR.codex_p06_profile_candidate_binding_is_valid(
                report,
                epoch_status,
                paths | {'apps/mcp/codex-one-tool-mcp-server.mjs'},
                report['mcpBundleSha256'],
            ))
            self.assertFalse(GENERATOR.codex_p06_profile_candidate_binding_is_valid(
                report, epoch_status, paths, 'f' * 64,
            ))

        with patch.object(
            GENERATOR,
            '_run_repository_git',
            side_effect=[subprocess.CompletedProcess([], 0), subprocess.CompletedProcess([], 1)],
        ):
            self.assertFalse(GENERATOR.codex_p06_profile_candidate_binding_is_valid(
                report, epoch_status, paths, report['mcpBundleSha256'],
            ))

    def test_v3_current_report_binding_uses_the_live_pr_head(self):
        profile = GENERATOR.codex_p06_profile_spec(GENERATOR.CODEX_P06_V3_PROFILE_ID)
        report = self.build_report(profile['id'])
        head_sha = 'd' * 40
        epoch_status = {
            'epoch': {
                'state': {'candidate_sha': 'c' * 40},
                'pr_head_sha': head_sha,
            },
        }
        with (
            patch.object(GENERATOR, '_codex_p06_profile_report_candidate_paths', return_value=set()),
            patch.object(GENERATOR, 'codex_g26_candidate_bundle_sha256', return_value='c' * 64) as bundle,
            patch.object(GENERATOR, 'codex_p06_profile_candidate_binding_is_valid', return_value=True) as binding,
        ):
            self.assertTrue(
                GENERATOR.codex_p06_profile_report_candidate_binding_is_current(report, epoch_status),
            )
        bundle.assert_called_once_with(head_sha)
        binding.assert_called_once_with(report, epoch_status, set(), 'c' * 64)

    def test_rejects_scenario_credit_network_expansion_and_raw_fields(self):
        scenario_credit = json.loads(json.dumps(self.report))
        scenario_credit['scenarioId'] = 'P06'
        self.assertFalse(self.validate_report(scenario_credit))

        expanded_network = json.loads(json.dumps(self.report))
        expanded_network['offlineFixture']['requestCount'] = 4
        self.assertFalse(self.validate_report(expanded_network))

        raw_answer = json.loads(json.dumps(self.report))
        raw_answer['rawAnswer'] = 'synthetic response text'
        self.assertFalse(self.validate_report(raw_answer))

        wrong_ci_run = json.loads(json.dumps(self.report))
        wrong_ci_run['ciRunId'] = 'not-a-run-id'
        self.assertFalse(self.validate_report(wrong_ci_run))

        wrong_ci_check = json.loads(json.dumps(self.report))
        wrong_ci_check['ciChecks'][0]['conclusion'] = 'FAILURE'
        self.assertFalse(self.validate_report(wrong_ci_check))

    def test_terminal_disposition_binds_exact_ci_run_and_checks(self):
        report = self.report
        receipt = report['runnerReceipt']
        report_sha256 = 'f' * 64
        disposition = {
            'claimId': report['claimId'],
            'profileId': GENERATOR.CODEX_P06_PROFILE_ID,
            'frontierId': 'P06',
            'epochId': GENERATOR.CODEX_P06_EPOCH_ID,
            'runNumber': 95,
            'prNumber': report['prNumber'],
            'state': 'REPORT_WRITTEN',
            'sourceCandidateSha': report['sourceRevision'],
            'baseSha': report['baseSha'],
            'ciSha': report['sourceRevision'],
            'ciStatus': 'SUCCESS',
            'ciRunId': report['ciRunId'],
            'ciChecks': report['ciChecks'],
            'reviewerId': report['reviewerId'],
            'bundleSha256': report['mcpBundleSha256'],
            'registrySha256': GENERATOR.CODEX_P06_PROFILE_REGISTRY_SHA256,
            'toolName': GENERATOR.CODEX_P06_TOOL_NAME,
            'argumentProfile': GENERATOR.CODEX_P06_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR.CODEX_P06_EXPECTED_ARGUMENTS_SHA256,
            'reportWritten': True,
            'reportPath': GENERATOR.CODEX_P06_REPORT_RELATIVE_PATH,
            'reportSha256': report_sha256,
            'retryAllowed': False,
            'runnerReceiptPublicKey': receipt['publicKeyBase64'],
            'runnerReceiptPublicKeySha256': receipt['publicKeySha256'],
            'runnerReceiptSha256': GENERATOR._canonical_json_sha256(receipt),
        }
        status = {
            'state': 'REPORT_WRITTEN',
            'profile_id': GENERATOR.CODEX_P06_PROFILE_ID,
            'pr': report['prNumber'],
            'tool_name': GENERATOR.CODEX_P06_TOOL_NAME,
            'argument_profile': GENERATOR.CODEX_P06_ARGUMENT_PROFILE,
            'expected_arguments_sha256': GENERATOR.CODEX_P06_EXPECTED_ARGUMENTS_SHA256,
            'registry_sha256': GENERATOR.CODEX_P06_PROFILE_REGISTRY_SHA256,
            'claim_label_present': True,
            'terminal_label_present': True,
            'disposition': disposition,
        }
        self.assertIsNotNone(
            GENERATOR.codex_p06_profile_disposition_matches_report(
                report, status, report_sha256,
            ),
        )

        disposition['ciRunId'] = '99999999999'
        self.assertIsNone(
            GENERATOR.codex_p06_profile_disposition_matches_report(
                report, status, report_sha256,
            ),
        )

        disposition['ciRunId'] = report['ciRunId']
        disposition['ciChecks'] = [
            {'name': 'unexpected-check', 'status': 'COMPLETED', 'conclusion': 'SUCCESS'},
        ]
        self.assertIsNone(
            GENERATOR.codex_p06_profile_disposition_matches_report(
                report, status, report_sha256,
            ),
        )

    def test_v3_terminal_disposition_binds_its_registered_profile(self):
        profile = GENERATOR.codex_p06_profile_spec(GENERATOR.CODEX_P06_V3_PROFILE_ID)
        report = self.build_report(profile['id'])
        receipt = report['runnerReceipt']
        report_sha256 = 'f' * 64
        disposition = {
            'claimId': report['claimId'],
            'profileId': profile['id'],
            'frontierId': 'P06',
            'epochId': profile['epochId'],
            'runNumber': 95,
            'prNumber': report['prNumber'],
            'state': 'REPORT_WRITTEN',
            'sourceCandidateSha': report['sourceRevision'],
            'baseSha': report['baseSha'],
            'ciSha': report['sourceRevision'],
            'ciStatus': 'SUCCESS',
            'ciRunId': report['ciRunId'],
            'ciChecks': report['ciChecks'],
            'reviewerId': report['reviewerId'],
            'bundleSha256': report['mcpBundleSha256'],
            'registrySha256': GENERATOR.codex_p06_profile_registry_sha256(profile),
            'toolName': profile['toolName'],
            'argumentProfile': profile['argumentProfile'],
            'expectedArgumentsSha256': GENERATOR.codex_p06_profile_expected_arguments_sha256(profile),
            'reportWritten': True,
            'reportPath': profile['reportPath'],
            'reportSha256': report_sha256,
            'retryAllowed': False,
            'runnerReceiptPublicKey': receipt['publicKeyBase64'],
            'runnerReceiptPublicKeySha256': receipt['publicKeySha256'],
            'runnerReceiptSha256': GENERATOR._canonical_json_sha256(receipt),
        }
        status = {
            'state': 'REPORT_WRITTEN',
            'profile_id': profile['id'],
            'pr': report['prNumber'],
            'tool_name': profile['toolName'],
            'argument_profile': profile['argumentProfile'],
            'expected_arguments_sha256': GENERATOR.codex_p06_profile_expected_arguments_sha256(profile),
            'registry_sha256': GENERATOR.codex_p06_profile_registry_sha256(profile),
            'claim_label_present': True,
            'terminal_label_present': True,
            'disposition': disposition,
        }
        self.assertIsNotNone(
            GENERATOR.codex_p06_profile_disposition_matches_report(
                report, status, report_sha256,
            ),
        )
        status['profile_id'] = GENERATOR.CODEX_P06_PROFILE_ID
        self.assertIsNone(
            GENERATOR.codex_p06_profile_disposition_matches_report(
                report, status, report_sha256,
            ),
        )

    def test_rejects_a_frontier_status_change(self):
        frontier_path = self.root / 'docs/product/frontier-ledger.json'
        frontier = json.loads(frontier_path.read_text(encoding='utf-8'))
        next(item for item in frontier['records'] if item['id'] == 'P06')['status'] = 'PARTIAL'
        frontier_path.write_text(json.dumps(frontier), encoding='utf-8')
        self.assertFalse(GENERATOR.codex_p06_frontier_is_unassessed())

    def test_routes_the_report_to_only_render_person_profile_agent_mcp(self):
        self.report_path.write_text(json.dumps(self.report), encoding='utf-8')
        catalog = json.loads(self.catalog_path.read_text(encoding='utf-8'))
        with (
            patch.object(GENERATOR, 'codex_p06_profile_harness_status', return_value={'fixture': True}),
            patch.object(GENERATOR, 'codex_p06_profile_epoch_harness_status', return_value={'fixture': True}),
            patch.object(GENERATOR, 'codex_p06_profile_report_is_valid', return_value=True),
            patch.object(GENERATOR, 'codex_p06_profile_report_matches_candidate_revision', return_value=True),
        ):
            sources = GENERATOR.model_mcp_e2e_sources(catalog)
        self.assertEqual(
            sources,
            {
                'bangumi.render_person_profile': {
                    GENERATOR.CODEX_P06_REPORT_RELATIVE_PATH,
                },
            },
        )

    def test_routes_the_v3_report_to_only_render_person_profile_agent_mcp(self):
        profile = GENERATOR.codex_p06_profile_spec(GENERATOR.CODEX_P06_V3_PROFILE_ID)
        report = self.build_report(profile['id'])
        report_path = self.root / profile['reportPath']
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report), encoding='utf-8')
        catalog = json.loads(self.catalog_path.read_text(encoding='utf-8'))
        with (
            patch.object(GENERATOR, 'codex_p06_profile_harness_status', return_value={'fixture': True}),
            patch.object(GENERATOR, 'codex_p06_profile_epoch_harness_status', return_value={'fixture': True}),
            patch.object(GENERATOR, 'codex_p06_profile_report_is_valid', return_value=True),
            patch.object(GENERATOR, 'codex_p06_profile_report_matches_candidate_revision', return_value=True),
        ):
            sources = GENERATOR.model_mcp_e2e_sources(catalog)
        self.assertEqual(
            sources,
            {'bangumi.render_person_profile': {profile['reportPath']}},
        )


class G01OfflineProfileStaticMarkerTests(unittest.TestCase):
    def test_v1_and_v2_have_exact_report_revision_markers_on_base_and_current(self):
        head = subprocess.run(
            ['git', 'rev-parse', 'HEAD'],
            cwd=GENERATOR.ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(head.returncode, 0, head.stderr)
        candidate = head.stdout.strip()
        self.assertRegex(candidate, r'^[0-9a-f]{40}$')
        base_result = subprocess.run(
            ['git', 'rev-parse', 'origin/master'],
            cwd=GENERATOR.ROOT,
            capture_output=True,
            text=True,
            check=False,
        )
        self.assertEqual(base_result.returncode, 0, base_result.stderr)
        base = base_result.stdout.strip()
        self.assertRegex(base, r'^[0-9a-f]{40}$')
        for revision in (base, candidate):
            with self.subTest(revision=revision):
                for profile_id in (
                    'g01-render-query-subjects-offline-agent-mcp-v1',
                    'g01-render-query-subjects-offline-agent-mcp-v2',
                ):
                    self.assertTrue(
                        GENERATOR.codex_g01_render_query_offline_profile_revision_has_implementation(
                            revision,
                            profile_id,
                        ),
                    )

    def test_synthetic_query_subjects_implementation_keeps_g01_partial_without_matrix_credit(self):
        frontier = json.loads(
            (GENERATOR.ROOT / 'docs/product/frontier-ledger.json').read_text(encoding='utf-8'),
        )
        record = next(item for item in frontier['records'] if item['id'] == 'G01')
        evidence = record['evidence']['synthetic_offline_agent_mcp_implementation_2026_10_17']

        self.assertEqual(record['status'], 'PARTIAL')
        self.assertIn(evidence['contract'], record['source_refs'])
        self.assertIn(evidence['offline_fixture'], record['source_refs'])
        self.assertIn(evidence['direct_tool_test'], record['source_refs'])
        self.assertIn(
            'implementation and local direct-ToolRegistry fixture evidence only',
            evidence['acceptance_boundary'],
        )
        self.assertIn('adds no matrix credit by itself', evidence['acceptance_boundary'])
        self.assertIn('65/65', record['next_action'])
        self.assertIn('never retry the consumed one-shot', record['next_action'])
        self.assertIn('do not replay the consumed G01 Agent/MCP canary', record['next_action'])


class C07CurrentCandidateImplementationMarkerTests(unittest.TestCase):
    def test_current_candidate_has_all_c07_report_gate_markers_without_mocks(self):
        revision = subprocess.run(
            ['git', 'rev-parse', 'HEAD'],
            cwd=GENERATOR.ROOT,
            check=True,
            capture_output=True,
            text=True,
        ).stdout.strip()

        self.assertRegex(revision, r'^[0-9a-f]{40}$')
        self.assertTrue(
            GENERATOR.codex_c07_render_comparison_offline_profile_revision_has_implementation(
                revision,
            ),
        )


class C07RenderComparisonOfflineProfileReportValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix='c07-render-comparison-offline-report-test-')
        self.root = Path(self.temp_dir.name)
        self.report_path = self.root / GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_REPORT_RELATIVE_PATH
        self.report_path.parent.mkdir(parents=True)
        selection_path = self.root / GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_SELECTION_EVIDENCE_RELATIVE_PATH
        selection_path.parent.mkdir(parents=True, exist_ok=True)
        selection_path.write_bytes(
            (GENERATOR.ROOT / GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_SELECTION_EVIDENCE_RELATIVE_PATH).read_bytes(),
        )
        self.catalog_path = self.root / 'docs/tool-catalog.json'
        self.catalog_path.parent.mkdir(parents=True, exist_ok=True)
        self.catalog_path.write_bytes(GENERATOR.CATALOG.read_bytes())
        frontier_path = self.root / 'docs/product/frontier-ledger.json'
        frontier_path.parent.mkdir(parents=True, exist_ok=True)
        frontier = json.loads((GENERATOR.ROOT / 'docs/product/frontier-ledger.json').read_text())
        c07 = next(record for record in frontier['records'] if record['id'] == 'C07')
        c07['source_refs'].append(GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_REPORT_RELATIVE_PATH)
        frontier_path.write_text(json.dumps(frontier), encoding='utf-8')
        self.originals = (GENERATOR.ROOT, GENERATOR.CATALOG, GENERATOR.LIVE_PROBE_DIR)
        GENERATOR.ROOT = self.root
        GENERATOR.CATALOG = self.catalog_path
        GENERATOR.LIVE_PROBE_DIR = self.root / 'docs/live-probes'
        self.report = self.build_report()

    def tearDown(self):
        GENERATOR.ROOT, GENERATOR.CATALOG, GENERATOR.LIVE_PROBE_DIR = self.originals
        self.temp_dir.cleanup()

    def build_report(self):
        catalog_bytes = self.catalog_path.read_bytes()
        catalog = json.loads(catalog_bytes)
        tool = next(item for item in catalog if item['name'] == GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_TOOL_NAME)
        selection_bytes = (self.root / GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_SELECTION_EVIDENCE_RELATIVE_PATH).read_bytes()
        fixture = {
            'profile': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE,
            'requestCount': 2,
            'searchRequestCount': 1,
            'subjectDetailRequestCount': 1,
            'duplicateRequestCount': 0,
            'unexpectedRequestCount': 0,
            'authorizationHeaderCount': 0,
            'expectedOperationsComplete': True,
            'rawFixturePayloadStored': False,
        }
        receipt_payload = {field: None for field in GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_RECEIPT_PAYLOAD_FIELDS}
        return {
            'schemaVersion': 1, 'evidenceKind': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_EVIDENCE_KIND,
            'runNumber': 95, 'frontierId': 'C07', 'scenarioId': None,
            'epochId': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_EPOCH_ID,
            'profileId': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID,
            'profile': 'codex-luna-max-offline-agent-mcp-matrix-v1',
            'model': 'gpt-6-luna', 'reasoningEffort': 'max',
            'reviewerId': 'gpt-6-luna-max-run95-pr222-round1', 'codexCliVersion': '1.2.14',
            'observedAt': '2026-10-16T05:00:00.000Z', 'sourceRevision': 'a' * 40,
            'baseSha': 'b' * 40, 'ciSha': 'a' * 40, 'ciStatus': 'SUCCESS',
            'ciRunId': '38806371672',
            'ciChecks': [
                {'name': name, 'status': 'COMPLETED', 'conclusion': 'SUCCESS'}
                for name in GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_REQUIRED_CI_CHECKS
            ],
            'prNumber': 222, 'claimId': 'profile-run-95-pr-222-aaaaaaaaaaaa-1792100000000',
            'mcpBundleSha256': 'c' * 64,
            'registrySha256': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_PROFILE_REGISTRY_SHA256,
            'selectionEvidenceSha256': hashlib.sha256(selection_bytes).hexdigest(),
            'toolName': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_TOOL_NAME,
            'argumentProfile': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_EXPECTED_ARGUMENTS_SHA256,
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(tool['description'].encode()).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'serverToolNames': [GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_TOOL_NAME], 'serverToolCount': 1,
            'networkMode': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_NETWORK_MODE,
            'mcpServerNames': ['bgk_c07_render_comparison'], 'processExitCode': 0,
            'resultStatus': 'SUCCESS', 'eventStreamParsed': True, 'turnCompleted': True,
            'codexMcpToolEventCount': 1, 'codexErrorItemCount': 0,
            'nonMcpToolEventCount': 0, 'nonMcpToolTypes': [], 'shellToolCallCount': 0,
            'allowedCallCount': 1, 'deniedCallCount': 0,
            'answerCheckMethod': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_ANSWER_CHECK_METHOD,
            'answerSha256': hashlib.sha256(b'C07_SYNTHETIC_COHORT_RENDERED').hexdigest(),
            'answerUtf8Bytes': len(b'C07_SYNTHETIC_COHORT_RENDERED'),
            'answerChecks': {key: True for key in GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_ANSWER_CHECK_FIELDS},
            'offlineFixture': fixture,
            'offlineAssetBoundary': {
                'assetResolutionCallCount': 0, 'nonEmptyAssetUrlCount': 0,
                'blockedAssetRequestCount': 0,
            },
            'networkBoundary': {
                'liveBangumiApiRequestCount': 0, 'rendererAssetRequestCount': 0,
                'fullCodexHarnessNetworkSandboxed': False,
            },
            'artifact': {
                'returned': True, 'persisted': False, 'mimeType': 'image/png',
                'width': 480, 'height': 640, 'byteLength': 12000,
                'sha256': 'd' * 64, 'pngSignatureValid': True,
            },
            'privacy': {
                'authProfile': 'anonymous', 'oauthAttempted': False, 'accountDataRead': False,
                'writesAttempted': False, 'communityRead': False, 'qqPipelineTested': False,
                'timClientTested': False, 'promptStored': False, 'answerStored': False,
                'rawFixtureRowsStored': False, 'rawToolResultStored': False,
                'artifactImageBytesStored': False, 'credentialsStored': False,
            },
            'runnerReceipt': {
                'schemaVersion': 1,
                'kind': 'c07-render-comparison-offline-runner-receipt-v1',
                'publicKeyBase64': 'AQ==', 'publicKeySha256': 'e' * 64,
                'payload': receipt_payload, 'signature': 'AA==',
            },
        }

    def validate_report(self, report):
        return self.validate_report_at(report, self.report_path)

    def validate_report_at(self, report, report_path):
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report), encoding='utf-8')

        def validate_embedded_report(args, **kwargs):
            payload = json.loads(kwargs['input'])
            embedded = base64.b64decode(payload['reportBytesBase64'])
            return subprocess.CompletedProcess(
                args, 0,
                json.dumps({'passed': True, 'reportSha256': hashlib.sha256(embedded).hexdigest()}),
                '',
            )

        with (
            patch.object(GENERATOR, 'codex_c07_render_comparison_offline_profile_revision_has_implementation', return_value=True),
            patch.object(GENERATOR, 'codex_g26_candidate_bundle_sha256', return_value='c' * 64),
            patch.object(GENERATOR, 'codex_c07_render_comparison_offline_profile_report_candidate_binding_is_current', return_value=True),
            patch.object(GENERATOR, 'codex_c07_render_comparison_offline_profile_disposition_matches_report', return_value={'state': 'REPORT_WRITTEN'}),
            patch.object(GENERATOR.subprocess, 'run', side_effect=validate_embedded_report),
        ):
            return GENERATOR.codex_c07_render_comparison_offline_profile_report_is_valid(
                report,
                harness_status={'fixture': True},
                report_path=report_path,
                epoch_status={'fixture': True},
            )

    def build_v3_report(self):
        profile = GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_PROFILE_V3
        report = json.loads(json.dumps(self.report))
        registry_sha256, expected_arguments_sha256 = (
            GENERATOR.codex_c07_render_comparison_offline_profile_hashes(profile)
        )
        selection_path = self.root / profile['selectionEvidencePath']
        selection_path.parent.mkdir(parents=True, exist_ok=True)
        selection_path.write_bytes(
            (self.originals[0] / profile['selectionEvidencePath']).read_bytes(),
        )
        frontier_path = self.root / 'docs/product/frontier-ledger.json'
        frontier = json.loads(frontier_path.read_text(encoding='utf-8'))
        c07 = next(record for record in frontier['records'] if record['id'] == 'C07')
        c07['source_refs'].extend([profile['reportPath'], profile['selectionEvidencePath']])
        frontier_path.write_text(json.dumps(frontier), encoding='utf-8')

        report.update({
            'evidenceKind': profile['evidenceKind'],
            'epochId': profile['epochId'],
            'profileId': profile['id'],
            'argumentProfile': profile['argumentProfile'],
            'expectedArgumentsSha256': expected_arguments_sha256,
            'registrySha256': registry_sha256,
            'selectionEvidenceSha256': hashlib.sha256(selection_path.read_bytes()).hexdigest(),
            'networkMode': profile['networkMode'],
            'answerCheckMethod': profile['answerCheckMethod'],
            'codexErrorItemCount': 3,
            'blockedDisabledWebSearchErrorItemCount': 3,
            'unexpectedCodexErrorItemCount': 0,
        })
        report['runnerReceipt']['kind'] = 'c07-render-comparison-offline-runner-receipt-v3'
        report['runnerReceipt']['payload'].update({
            'blockedDisabledWebSearchErrorItemCount': 3,
            'unexpectedCodexErrorItemCount': 0,
        })
        report['offlineFixture']['profile'] = profile['networkMode']
        return report

    def test_accepts_one_synthetic_matrix_report_while_C07_remains_unassessed(self):
        self.assertTrue(GENERATOR.codex_c07_render_comparison_offline_frontier_is_unassessed())
        self.assertTrue(self.validate_report(self.report))

    def test_v3_report_accepts_only_bounded_safe_web_search_error_counts(self):
        profile = GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_PROFILE_V3
        report = self.build_v3_report()
        path = self.root / profile['reportPath']
        self.assertTrue(self.validate_report_at(report, path))

        unexpected = json.loads(json.dumps(report))
        unexpected['unexpectedCodexErrorItemCount'] = 1
        unexpected['runnerReceipt']['payload']['unexpectedCodexErrorItemCount'] = 1
        self.assertFalse(self.validate_report_at(unexpected, path))

        over_limit = json.loads(json.dumps(report))
        over_limit['codexErrorItemCount'] = 4
        over_limit['blockedDisabledWebSearchErrorItemCount'] = 4
        over_limit['runnerReceipt']['payload']['blockedDisabledWebSearchErrorItemCount'] = 4
        self.assertFalse(self.validate_report_at(over_limit, path))

    def test_rejects_scenario_credit_network_expansion_and_raw_fields(self):
        scenario_credit = json.loads(json.dumps(self.report))
        scenario_credit['scenarioId'] = 'C07'
        self.assertFalse(self.validate_report(scenario_credit))

        expanded_network = json.loads(json.dumps(self.report))
        expanded_network['offlineFixture']['requestCount'] = 4
        self.assertFalse(self.validate_report(expanded_network))

        raw_answer = json.loads(json.dumps(self.report))
        raw_answer['rawAnswer'] = 'synthetic response text'
        self.assertFalse(self.validate_report(raw_answer))

        wrong_ci_run = json.loads(json.dumps(self.report))
        wrong_ci_run['ciRunId'] = 'not-a-run-id'
        self.assertFalse(self.validate_report(wrong_ci_run))

        wrong_ci_check = json.loads(json.dumps(self.report))
        wrong_ci_check['ciChecks'][0]['conclusion'] = 'FAILURE'
        self.assertFalse(self.validate_report(wrong_ci_check))

    def test_terminal_disposition_binds_exact_ci_run_and_checks(self):
        report = self.report
        receipt = report['runnerReceipt']
        report_sha256 = 'f' * 64
        disposition = {
            'claimId': report['claimId'],
            'profileId': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID,
            'frontierId': 'C07',
            'epochId': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_EPOCH_ID,
            'runNumber': 95,
            'prNumber': report['prNumber'],
            'state': 'REPORT_WRITTEN',
            'sourceCandidateSha': report['sourceRevision'],
            'baseSha': report['baseSha'],
            'ciSha': report['sourceRevision'],
            'ciStatus': 'SUCCESS',
            'ciRunId': report['ciRunId'],
            'ciChecks': report['ciChecks'],
            'reviewerId': report['reviewerId'],
            'bundleSha256': report['mcpBundleSha256'],
            'registrySha256': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_PROFILE_REGISTRY_SHA256,
            'toolName': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_TOOL_NAME,
            'argumentProfile': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_EXPECTED_ARGUMENTS_SHA256,
            'reportWritten': True,
            'reportPath': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_REPORT_RELATIVE_PATH,
            'reportSha256': report_sha256,
            'retryAllowed': False,
            'runnerReceiptPublicKey': receipt['publicKeyBase64'],
            'runnerReceiptPublicKeySha256': receipt['publicKeySha256'],
            'runnerReceiptSha256': GENERATOR._canonical_json_sha256(receipt),
        }
        status = {
            'state': 'REPORT_WRITTEN',
            'profile_id': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_PROFILE_ID,
            'pr': report['prNumber'],
            'tool_name': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_TOOL_NAME,
            'argument_profile': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_ARGUMENT_PROFILE,
            'expected_arguments_sha256': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_EXPECTED_ARGUMENTS_SHA256,
            'registry_sha256': GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_PROFILE_REGISTRY_SHA256,
            'claim_label_present': True,
            'terminal_label_present': True,
            'disposition': disposition,
        }
        self.assertIsNotNone(
            GENERATOR.codex_c07_render_comparison_offline_profile_disposition_matches_report(
                report, status, report_sha256,
            ),
        )

        disposition['ciRunId'] = '99999999999'
        self.assertIsNone(
            GENERATOR.codex_c07_render_comparison_offline_profile_disposition_matches_report(
                report, status, report_sha256,
            ),
        )

        disposition['ciRunId'] = report['ciRunId']
        disposition['ciChecks'] = [
            {'name': 'unexpected-check', 'status': 'COMPLETED', 'conclusion': 'SUCCESS'},
        ]
        self.assertIsNone(
            GENERATOR.codex_c07_render_comparison_offline_profile_disposition_matches_report(
                report, status, report_sha256,
            ),
        )

    def test_rejects_a_frontier_status_change(self):
        frontier_path = self.root / 'docs/product/frontier-ledger.json'
        frontier = json.loads(frontier_path.read_text(encoding='utf-8'))
        next(item for item in frontier['records'] if item['id'] == 'C07')['status'] = 'PARTIAL'
        frontier_path.write_text(json.dumps(frontier), encoding='utf-8')
        self.assertFalse(GENERATOR.codex_c07_render_comparison_offline_frontier_is_unassessed())

    def test_routes_the_report_to_only_render_subject_cohort_comparison_agent_mcp(self):
        self.report_path.write_text(json.dumps(self.report), encoding='utf-8')
        catalog = json.loads(self.catalog_path.read_text(encoding='utf-8'))
        with (
            patch.object(GENERATOR, 'codex_c07_render_comparison_offline_profile_harness_status', return_value={'fixture': True}),
            patch.object(GENERATOR, 'codex_c07_render_comparison_offline_profile_epoch_harness_status', return_value={'fixture': True}),
            patch.object(GENERATOR, 'codex_c07_render_comparison_offline_profile_report_is_valid', return_value=True),
            patch.object(GENERATOR, 'codex_c07_render_comparison_offline_profile_report_matches_candidate_revision', return_value=True),
        ):
            sources = GENERATOR.model_mcp_e2e_sources(catalog)
        self.assertEqual(
            sources,
            {
                'bangumi.render_subject_cohort_comparison': {
                    GENERATOR.CODEX_C07_RENDER_COMPARISON_OFFLINE_REPORT_RELATIVE_PATH,
                },
            },
        )


class P02OfflineProfileReportValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix='p02-offline-profile-report-test-')
        self.root = Path(self.temp_dir.name)
        self.report_path = self.root / GENERATOR.CODEX_P02_REPORT_RELATIVE_PATH
        self.report_path.parent.mkdir(parents=True)
        selection_path = self.root / GENERATOR.CODEX_P02_SELECTION_EVIDENCE_RELATIVE_PATH
        selection_path.parent.mkdir(parents=True, exist_ok=True)
        selection_path.write_bytes(
            (GENERATOR.ROOT / GENERATOR.CODEX_P02_SELECTION_EVIDENCE_RELATIVE_PATH).read_bytes(),
        )
        v2_selection_path = self.root / GENERATOR.CODEX_P02_V2_SELECTION_EVIDENCE_RELATIVE_PATH
        v2_selection_path.parent.mkdir(parents=True, exist_ok=True)
        v2_selection_path.write_bytes(
            (GENERATOR.ROOT / GENERATOR.CODEX_P02_V2_SELECTION_EVIDENCE_RELATIVE_PATH).read_bytes(),
        )
        self.catalog_path = self.root / 'docs/tool-catalog.json'
        self.catalog_path.parent.mkdir(parents=True, exist_ok=True)
        self.catalog_path.write_bytes(GENERATOR.CATALOG.read_bytes())
        frontier_path = self.root / 'docs/product/frontier-ledger.json'
        frontier_path.parent.mkdir(parents=True, exist_ok=True)
        frontier = json.loads((GENERATOR.ROOT / 'docs/product/frontier-ledger.json').read_text())
        p02 = next(record for record in frontier['records'] if record['id'] == 'P02')
        p02['source_refs'].append(GENERATOR.CODEX_P02_REPORT_RELATIVE_PATH)
        p02['source_refs'].append(GENERATOR.CODEX_P02_SELECTION_EVIDENCE_RELATIVE_PATH)
        p02['source_refs'].append(GENERATOR.CODEX_P02_V2_REPORT_RELATIVE_PATH)
        p02['source_refs'].append(GENERATOR.CODEX_P02_V2_SELECTION_EVIDENCE_RELATIVE_PATH)
        frontier_path.write_text(json.dumps(frontier), encoding='utf-8')
        self.originals = (GENERATOR.ROOT, GENERATOR.CATALOG, GENERATOR.LIVE_PROBE_DIR)
        GENERATOR.ROOT = self.root
        GENERATOR.CATALOG = self.catalog_path
        GENERATOR.LIVE_PROBE_DIR = self.root / 'docs/live-probes'
        self.report = self.build_report()

    def tearDown(self):
        GENERATOR.ROOT, GENERATOR.CATALOG, GENERATOR.LIVE_PROBE_DIR = self.originals
        self.temp_dir.cleanup()

    def build_report(self, profile_id=GENERATOR.CODEX_P02_PROFILE_ID):
        profile = GENERATOR.codex_p02_profile_spec(profile_id)
        profile_aux = GENERATOR.CODEX_P02_PROFILE_AUX[profile_id]
        catalog_bytes = self.catalog_path.read_bytes()
        catalog = json.loads(catalog_bytes)
        tool = next(item for item in catalog if item['name'] == profile['toolName'])
        selection_bytes = (self.root / profile['selectionEvidencePath']).read_bytes()
        receipt_payload = {field: None for field in GENERATOR.CODEX_P02_RECEIPT_PAYLOAD_FIELDS}
        return {
            'schemaVersion': 1,
            'evidenceKind': profile['evidenceKind'],
            'runNumber': 95,
            'frontierId': 'P02',
            'scenarioId': None,
            'epochId': profile['epochId'],
            'profileId': profile_id,
            'profile': profile_aux['reportProfile'],
            'model': profile['model'],
            'reasoningEffort': profile['reasoningEffort'],
            'reviewerId': 'gpt-6-luna-max-run95-pr222-round1',
            'codexCliVersion': '1.2.14',
            'observedAt': '2026-10-16T05:00:00.000Z',
            'sourceRevision': 'a' * 40,
            'baseSha': 'b' * 40,
            'ciSha': 'a' * 40,
            'ciStatus': 'SUCCESS',
            'ciRunId': '38812509760',
            'ciChecks': [
                {'name': name, 'status': 'COMPLETED', 'conclusion': 'SUCCESS'}
                for name in GENERATOR.CODEX_P02_REQUIRED_CI_CHECKS
            ],
            'prNumber': 222,
            'claimId': 'profile-run-95-pr-222-aaaaaaaaaaaa-1792100000000',
            'mcpBundleSha256': 'c' * 64,
            'registrySha256': GENERATOR.codex_p02_profile_registry_sha256(profile_id),
            'selectionEvidenceSha256': hashlib.sha256(selection_bytes).hexdigest(),
            'toolName': profile['toolName'],
            'argumentProfile': profile['argumentProfile'],
            'expectedArgumentsSha256': GENERATOR.codex_p02_profile_arguments_sha256(profile_id),
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(tool['description'].encode()).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'serverToolNames': [profile['toolName']],
            'serverToolCount': 1,
            'networkMode': profile['networkMode'],
            'mcpServerNames': [profile_aux['serverId']],
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'eventStreamParsed': True,
            'turnCompleted': True,
            'codexMcpToolEventCount': 1,
            'codexErrorItemCount': 0,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'answerCheckMethod': profile['answerCheckMethod'],
            'answerSha256': hashlib.sha256(profile_aux['acknowledgement'].encode()).hexdigest(),
            'answerUtf8Bytes': len(profile_aux['acknowledgement'].encode()),
            'answerChecks': {key: True for key in GENERATOR.CODEX_P02_ANSWER_CHECK_FIELDS},
            'offlineFixture': {
                'profile': profile['networkMode'],
                'requestCount': 3,
                'personRequestCount': 1,
                'subjectsRequestCount': 1,
                'charactersRequestCount': 1,
                'duplicateRequestCount': 0,
                'unexpectedRequestCount': 0,
                'authorizationHeaderCount': 0,
                'expectedOperationsComplete': True,
            },
            'networkBoundary': {
                'liveBangumiApiRequestCount': 0,
                'rendererAssetRequestCount': 0,
                'fullCodexHarnessNetworkSandboxed': False,
            },
            'privacy': {
                'authProfile': 'anonymous', 'oauthAttempted': False, 'accountDataRead': False,
                'writesAttempted': False, 'communityRead': False, 'qqPipelineTested': False,
                'timClientTested': False, 'promptStored': False, 'answerStored': False,
                'rawFixtureRowsStored': False, 'rawToolResultStored': False,
                'artifactImageBytesStored': False, 'credentialsStored': False,
            },
            'runnerReceipt': {
                'schemaVersion': 1,
                'kind': profile_aux['receiptKind'],
                'publicKeyBase64': 'AQ==',
                'publicKeySha256': 'd' * 64,
                'payload': receipt_payload,
                'signature': 'AA==',
            },
        }

    def validate_report(self, report):
        profile = GENERATOR.codex_p02_profile_spec(report['profileId'])
        report_path = self.root / str(profile['reportPath'])
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report), encoding='utf-8')

        def validate_embedded_report(args, **kwargs):
            payload = json.loads(kwargs['input'])
            embedded = base64.b64decode(payload['reportBytesBase64'])
            return subprocess.CompletedProcess(
                args, 0,
                json.dumps({'passed': True, 'reportSha256': hashlib.sha256(embedded).hexdigest()}),
                '',
            )

        with (
            patch.object(GENERATOR, 'codex_p02_profile_revision_has_implementation', return_value=True),
            patch.object(GENERATOR, 'codex_g26_candidate_bundle_sha256', return_value='c' * 64),
            patch.object(GENERATOR, 'codex_p02_profile_report_candidate_binding_is_current', return_value=True),
            patch.object(GENERATOR, 'codex_p02_profile_disposition_matches_report', return_value={'state': 'REPORT_WRITTEN'}),
            patch.object(GENERATOR.subprocess, 'run', side_effect=validate_embedded_report),
        ):
            return GENERATOR.codex_p02_profile_report_is_valid(
                report,
                harness_status={'fixture': True},
                report_path=report_path,
                epoch_status={'fixture': True},
            )

    def test_accepts_synthetic_agent_mcp_matrix_evidence_while_P02_remains_partial(self):
        self.assertTrue(GENERATOR.codex_p02_frontier_is_partial())
        self.assertTrue(self.validate_report(self.report))

    def test_v2_accepts_only_its_distinct_report_and_keeps_P02_partial(self):
        report = self.build_report(GENERATOR.CODEX_P02_V2_PROFILE_ID)
        self.assertTrue(
            GENERATOR.codex_p02_frontier_is_partial(
                require_report_ref=True,
                profile_id=GENERATOR.CODEX_P02_V2_PROFILE_ID,
            ),
        )
        self.assertTrue(self.validate_report(report))
        runtime_reviewer = json.loads(json.dumps(report))
        runtime_reviewer['reviewerId'] = '/root/p02_v2_review'
        self.assertTrue(self.validate_report(runtime_reviewer))
        cross_version = json.loads(json.dumps(report))
        cross_version['profileId'] = GENERATOR.CODEX_P02_PROFILE_ID
        self.assertFalse(self.validate_report(cross_version))

    def test_rejects_scenario_credit_network_expansion_and_raw_fields(self):
        scenario_credit = json.loads(json.dumps(self.report))
        scenario_credit['scenarioId'] = 'P02'
        self.assertFalse(self.validate_report(scenario_credit))

        expanded_network = json.loads(json.dumps(self.report))
        expanded_network['offlineFixture']['requestCount'] = 4
        self.assertFalse(self.validate_report(expanded_network))

        raw_answer = json.loads(json.dumps(self.report))
        raw_answer['rawAnswer'] = 'synthetic response text'
        self.assertFalse(self.validate_report(raw_answer))

        incorrect_boundary = json.loads(json.dumps(self.report))
        incorrect_boundary['networkBoundary']['liveBangumiApiRequestCount'] = 1
        self.assertFalse(self.validate_report(incorrect_boundary))

    def test_keeps_the_P02_frontier_partial(self):
        frontier_path = self.root / 'docs/product/frontier-ledger.json'
        frontier = json.loads(frontier_path.read_text(encoding='utf-8'))
        next(item for item in frontier['records'] if item['id'] == 'P02')['status'] = 'UNASSESSED'
        frontier_path.write_text(json.dumps(frontier), encoding='utf-8')
        self.assertFalse(GENERATOR.codex_p02_frontier_is_partial())

    def test_routes_the_report_to_only_get_person_profile_agent_mcp(self):
        self.report_path.write_text(json.dumps(self.report), encoding='utf-8')
        v2_report = self.build_report(GENERATOR.CODEX_P02_V2_PROFILE_ID)
        v2_report_path = self.root / GENERATOR.CODEX_P02_V2_REPORT_RELATIVE_PATH
        v2_report_path.parent.mkdir(parents=True, exist_ok=True)
        v2_report_path.write_text(json.dumps(v2_report), encoding='utf-8')
        catalog = json.loads(self.catalog_path.read_text(encoding='utf-8'))
        with (
            patch.object(GENERATOR, 'codex_p02_profile_harness_status', return_value={'fixture': True}),
            patch.object(GENERATOR, 'codex_p02_profile_epoch_harness_status', return_value={'fixture': True}),
            patch.object(GENERATOR, 'codex_p02_profile_report_is_valid', return_value=True),
            patch.object(GENERATOR, 'codex_p02_profile_report_matches_candidate_revision', return_value=True),
        ):
            sources = GENERATOR.model_mcp_e2e_sources(catalog)
        self.assertEqual(
            sources,
            {
                'bangumi.get_person_profile': {
                    GENERATOR.CODEX_P02_REPORT_RELATIVE_PATH,
                    GENERATOR.CODEX_P02_V2_REPORT_RELATIVE_PATH,
                },
            },
        )


class P03FreshPublicV2ProfileRouteTests(unittest.TestCase):
    def test_v2_profile_is_fresh_and_frontier_remains_partial(self):
        profile = GENERATOR.CODEX_P03_V2_PROFILE
        self.assertEqual(profile['id'], 'p03-person-name-cn-agent-mcp-v2')
        self.assertEqual(profile['frontierId'], 'P03')
        self.assertEqual(profile['acceptanceScope'], 'agent-mcp-matrix-only')
        self.assertEqual(profile['calls'][0]['toolName'], 'bangumi.get_person_profile')
        self.assertEqual(profile['calls'][0]['arguments']['personId'], 19306)
        self.assertEqual(profile['calls'][0]['arguments']['includeChronology'], False)
        self.assertNotEqual(profile['id'], GENERATOR.CODEX_P03_V2_PROFILE_ID.replace('-v2', '-v1'))
        self.assertTrue(GENERATOR.codex_p03_v2_frontier_is_partial())
        self.assertIn(
            Path(GENERATOR.CODEX_P03_V2_REPORT_RELATIVE_PATH).name,
            [path.name for path in GENERATOR.model_mcp_e2e_report_paths()],
        )
        self.assertFalse(GENERATOR.codex_p03_v2_profile_report_is_valid({}))
        self.assertTrue(
            GENERATOR.codex_p03_v2_same_reviewer_identity(
                'gpt-6-luna-max-run95-pr260-round1',
                'gpt-6-luna-max-run95-pr260-round2',
                260,
            ),
        )
        self.assertFalse(
            GENERATOR.codex_p03_v2_same_reviewer_identity(
                'gpt-6-luna-max-run95-pr260-round1',
                'gpt-6-luna-max-run95-pr261-round2',
                260,
            ),
        )

    def test_only_v3_and_v4_accept_bounded_classified_web_search_errors(self):
        fresh_profile_ids = (
            GENERATOR.CODEX_P03_V3_PROFILE_ID,
            GENERATOR.CODEX_P03_V4_PROFILE_ID,
        )
        v2_profile_id = GENERATOR.CODEX_P03_V2_PROFILE_ID
        for profile_id in fresh_profile_ids:
            for count in range(4):
                self.assertTrue(
                    GENERATOR.codex_p03_profile_error_summary_is_valid(
                        {
                            'codexErrorItemCount': count,
                            'blockedWebSearchErrorItemCount': count,
                            'unexpectedCodexErrorItemCount': 0,
                        },
                        profile_id,
                    ),
                )
        for invalid in (
            {
                'codexErrorItemCount': 4,
                'blockedWebSearchErrorItemCount': 4,
                'unexpectedCodexErrorItemCount': 0,
            },
            {
                'codexErrorItemCount': 3,
                'blockedWebSearchErrorItemCount': 2,
                'unexpectedCodexErrorItemCount': 1,
            },
            {
                'codexErrorItemCount': 3,
                'blockedWebSearchErrorItemCount': 2,
                'unexpectedCodexErrorItemCount': 0,
            },
            {
                'codexErrorItemCount': True,
                'blockedWebSearchErrorItemCount': True,
                'unexpectedCodexErrorItemCount': 0,
            },
        ):
            for profile_id in fresh_profile_ids:
                self.assertFalse(
                    GENERATOR.codex_p03_profile_error_summary_is_valid(
                        invalid,
                        profile_id,
                    ),
                )
        self.assertTrue(
            GENERATOR.codex_p03_profile_error_summary_is_valid(
                {
                    'codexErrorItemCount': 0,
                    'blockedWebSearchErrorItemCount': 0,
                    'unexpectedCodexErrorItemCount': 0,
                },
                v2_profile_id,
            ),
        )
        self.assertFalse(
            GENERATOR.codex_p03_profile_error_summary_is_valid(
                {
                    'codexErrorItemCount': 1,
                    'blockedWebSearchErrorItemCount': 1,
                    'unexpectedCodexErrorItemCount': 0,
                },
                v2_profile_id,
            ),
        )
        self.assertFalse(
            GENERATOR.codex_p03_profile_error_summary_is_valid(
                {
                    'codexErrorItemCount': 0,
                    'blockedWebSearchErrorItemCount': 0,
                    'unexpectedCodexErrorItemCount': 0,
                },
                'p03-person-name-cn-agent-mcp-v1',
            ),
        )

    def test_report_bound_review_refresh_is_same_identity_and_evidence_only(self):
        source = 'a' * 40
        candidate = 'b' * 40
        base = 'c' * 40
        reviewer = 'gpt-6-luna-max-run95-pr260-round1'
        allowed_paths = {
            GENERATOR.CODEX_P03_V2_REPORT_RELATIVE_PATH,
            'docs/product/frontier-ledger.json',
            'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
        }
        report = {
            'profileId': GENERATOR.CODEX_P03_V2_PROFILE_ID,
            'prNumber': 260,
            'sourceRevision': source,
            'baseSha': base,
            'reviewerId': reviewer,
            'mcpBundleSha256': 'd' * 64,
        }
        epoch_status = {
            'run': {'number': 95, 'state': {'state': 'EPOCH_ACTIVE', 'active_epoch_pr': 260}},
            'epoch': {
                'github_state': 'OPEN',
                'pr_head_sha': candidate,
                'pr_head_ref_name': 'codex/p03-v2',
                'pr_base_ref_name': 'master',
                'pr_is_draft': False,
                'state': {
                    'epoch_id': GENERATOR.CODEX_P03_V2_EPOCH_ID,
                    'state': 'REVIEW_PASSED',
                    'pr_number': 260,
                    'base_branch': 'master',
                    'base_sha': base,
                    'reviewed_base_sha': base,
                    'candidate_sha': candidate,
                    'review_pass_sha': candidate,
                    'branch': 'codex/p03-v2',
                    'ci': {'sha': candidate, 'status': 'SUCCESS'},
                    'advances_frontier_ids': ['P03'],
                    'scope_closure': {'related_work_remaining': False},
                    'review_history': [
                        {
                            'candidate_sha': source,
                            'reviewed_base_sha': base,
                            'reviewer_id': reviewer,
                            'verdict': 'PASS',
                        },
                        {
                            'candidate_sha': candidate,
                            'reviewed_base_sha': base,
                            'reviewer_id': 'gpt-6-luna-max-run95-pr260-round2',
                            'verdict': 'PASS',
                        },
                    ],
                },
            },
        }
        with (
            patch.object(GENERATOR, 'codex_p03_profile_report_candidate_paths', return_value=allowed_paths),
            patch.object(GENERATOR, 'codex_g26_candidate_bundle_sha256', return_value='d' * 64),
        ):
            self.assertTrue(
                GENERATOR.codex_p03_v2_candidate_binding_is_current(report, epoch_status),
            )
            merged_epoch_status = {
                **epoch_status,
                'epoch': {
                    **epoch_status['epoch'],
                    'github_state': 'MERGED',
                    'state': {**epoch_status['epoch']['state'], 'state': 'MERGED'},
                },
            }
            self.assertTrue(
                GENERATOR.codex_p03_v2_candidate_binding_is_current(
                    report,
                    merged_epoch_status,
                ),
            )
            altered = set(allowed_paths) | {'packages/tools/src/definitions/read-tools.ts'}
            patcher = patch.object(
                GENERATOR, 'codex_p03_profile_report_candidate_paths', return_value=altered,
            )
            with patcher:
                self.assertFalse(
                    GENERATOR.codex_p03_v2_candidate_binding_is_current(report, epoch_status),
                )

    def test_report_route_adds_only_the_registered_person_profile_matrix_row(self):
        with tempfile.TemporaryDirectory(prefix='p03-v2-matrix-route-') as directory:
            live_probe_dir = Path(directory)
            report_path = live_probe_dir / Path(GENERATOR.CODEX_P03_V2_REPORT_RELATIVE_PATH).name
            report_path.write_text(
                json.dumps({
                    'evidenceKind': GENERATOR.CODEX_P03_V2_EVIDENCE_KIND,
                    'profileId': GENERATOR.CODEX_P03_V2_PROFILE_ID,
                    'prNumber': 260,
                }),
                encoding='utf-8',
            )
            catalog = json.loads(GENERATOR.CATALOG.read_text(encoding='utf-8'))
            with (
                patch.object(GENERATOR, 'LIVE_PROBE_DIR', live_probe_dir),
                patch.object(GENERATOR, 'codex_p03_profile_harness_status', return_value={'fixture': True}),
                patch.object(GENERATOR, 'codex_p03_profile_epoch_harness_status', return_value={'fixture': True}),
                patch.object(GENERATOR, 'codex_p03_profile_report_is_valid', return_value=True),
                patch.object(GENERATOR, 'codex_p03_profile_report_matches_candidate_revision', return_value=True),
            ):
                sources = GENERATOR.model_mcp_e2e_sources(catalog)
            self.assertEqual(
                sources,
                {
                    'bangumi.get_person_profile': {
                        Path(GENERATOR.CODEX_P03_V2_REPORT_RELATIVE_PATH).name,
                    },
                },
            )


class P03FreshPublicV3ProfileRouteTests(unittest.TestCase):
    def test_v3_profile_is_distinct_bounded_and_keeps_frontier_partial(self):
        profile = GENERATOR.CODEX_P03_V3_PROFILE
        self.assertEqual(profile['id'], 'p03-person-name-cn-agent-mcp-v3')
        self.assertEqual(profile['frontierId'], 'P03')
        self.assertEqual(profile['acceptanceScope'], 'agent-mcp-matrix-only')
        self.assertEqual(profile['calls'][0]['toolName'], 'bangumi.get_person_profile')
        self.assertEqual(profile['calls'][0]['arguments']['personId'], 58609)
        self.assertEqual(profile['calls'][0]['arguments']['maxSubjects'], 5)
        self.assertEqual(profile['calls'][0]['arguments']['includeChronology'], False)
        self.assertNotEqual(profile['id'], GENERATOR.CODEX_P03_V2_PROFILE_ID)
        self.assertNotEqual(profile['calls'], GENERATOR.CODEX_P03_V2_PROFILE['calls'])
        self.assertTrue(GENERATOR.codex_p03_v3_frontier_is_partial())
        self.assertIn(
            Path(GENERATOR.CODEX_P03_V3_REPORT_RELATIVE_PATH).name,
            [path.name for path in GENERATOR.model_mcp_e2e_report_paths()],
        )
        self.assertFalse(GENERATOR.codex_p03_v3_profile_report_is_valid({}))
        self.assertEqual(GENERATOR.CODEX_P03_V3_REPORT_FIELDS, GENERATOR.CODEX_P03_V2_REPORT_FIELDS)

    def test_report_subject_count_cannot_exceed_the_registered_profile_limit(self):
        v3 = GENERATOR.CODEX_P03_V3_PROFILE
        v2 = GENERATOR.CODEX_P03_V2_PROFILE
        self.assertTrue(GENERATOR.codex_p03_profile_subject_limit_is_valid(
            v3, {'subjectsReturned': 5},
        ))
        self.assertFalse(GENERATOR.codex_p03_profile_subject_limit_is_valid(
            v3, {'subjectsReturned': 6},
        ))
        self.assertTrue(GENERATOR.codex_p03_profile_subject_limit_is_valid(
            v2, {'subjectsReturned': 500},
        ))
        self.assertFalse(GENERATOR.codex_p03_profile_subject_limit_is_valid(
            v2, {'subjectsReturned': 501},
        ))
        self.assertFalse(GENERATOR.codex_p03_profile_subject_limit_is_valid(
            {'calls': [{'arguments': {'maxSubjects': True}}]},
            {'subjectsReturned': 0},
        ))

    def test_v3_report_route_adds_only_the_registered_person_profile_matrix_row(self):
        with tempfile.TemporaryDirectory(prefix='p03-v3-matrix-route-') as directory:
            live_probe_dir = Path(directory)
            report_path = live_probe_dir / Path(GENERATOR.CODEX_P03_V3_REPORT_RELATIVE_PATH).name
            report_path.write_text(
                json.dumps({
                    'evidenceKind': GENERATOR.CODEX_P03_V3_EVIDENCE_KIND,
                    'profileId': GENERATOR.CODEX_P03_V3_PROFILE_ID,
                    'prNumber': 261,
                }),
                encoding='utf-8',
            )
            catalog = json.loads(GENERATOR.CATALOG.read_text(encoding='utf-8'))
            with (
                patch.object(GENERATOR, 'LIVE_PROBE_DIR', live_probe_dir),
                patch.object(GENERATOR, 'codex_p03_profile_harness_status', return_value={'fixture': True}),
                patch.object(GENERATOR, 'codex_p03_profile_epoch_harness_status', return_value={'fixture': True}),
                patch.object(GENERATOR, 'codex_p03_profile_report_is_valid', return_value=True),
                patch.object(GENERATOR, 'codex_p03_profile_report_matches_candidate_revision', return_value=True),
            ):
                sources = GENERATOR.model_mcp_e2e_sources(catalog)
            self.assertEqual(
                sources,
                {
                    'bangumi.get_person_profile': {
                        Path(GENERATOR.CODEX_P03_V3_REPORT_RELATIVE_PATH).name,
                    },
                },
            )


class P03FreshPublicV4ProfileRouteTests(unittest.TestCase):
    def test_v4_profile_is_distinct_bounded_and_keeps_frontier_partial(self):
        profile = GENERATOR.CODEX_P03_V4_PROFILE
        arguments = profile['calls'][0]['arguments']
        self.assertEqual(profile['id'], 'p03-person-name-cn-agent-mcp-v4')
        self.assertEqual(profile['frontierId'], 'P03')
        self.assertEqual(profile['acceptanceScope'], 'agent-mcp-matrix-only')
        self.assertEqual(profile['calls'][0]['toolName'], 'bangumi.get_person_profile')
        self.assertEqual(arguments['personId'], 54025)
        self.assertEqual(arguments['maxSubjects'], 5)
        self.assertEqual(arguments['maxCharacters'], 1)
        self.assertIs(arguments['includeCredits'], True)
        self.assertIs(arguments['includeChronology'], False)
        self.assertNotEqual(profile['id'], GENERATOR.CODEX_P03_V2_PROFILE_ID)
        self.assertNotEqual(profile['id'], GENERATOR.CODEX_P03_V3_PROFILE_ID)
        self.assertNotEqual(profile['calls'], GENERATOR.CODEX_P03_V3_PROFILE['calls'])
        self.assertTrue(GENERATOR.codex_p03_v4_frontier_is_partial())
        frontier = json.loads((GENERATOR.ROOT / 'docs/product/frontier-ledger.json').read_text())
        p03 = next(record for record in frontier['records'] if record['id'] == 'P03')
        self.assertIn(
            GENERATOR.CODEX_P03_V4_SELECTION_EVIDENCE_RELATIVE_PATH,
            p03['source_refs'],
        )
        report_name = Path(GENERATOR.CODEX_P03_V4_REPORT_RELATIVE_PATH).name
        self.assertIn(report_name, [path.name for path in GENERATOR.model_mcp_e2e_report_paths()])
        self.assertFalse(GENERATOR.codex_p03_v4_profile_report_is_valid({}))
        self.assertEqual(GENERATOR.CODEX_P03_V4_REPORT_FIELDS, GENERATOR.CODEX_P03_V2_REPORT_FIELDS)

    def test_report_counts_from_reviewed_source_during_allowlisted_refresh(self):
        profile = GENERATOR.CODEX_P03_V4_PROFILE
        source = 'b' * 40
        candidate = 'e' * 40
        base = 'a' * 40
        branch = 'codex/epoch-' + profile['epochId']
        source_reviewer = 'gpt-6-luna-max-run95-pr261-round2'
        report = {
            'profileId': profile['id'],
            'prNumber': 261,
            'sourceRevision': source,
            'baseSha': base,
            'reviewerId': source_reviewer,
            'mcpBundleSha256': 'd' * 64,
        }
        allowed_paths = {
            profile['reportPath'],
            'docs/product/frontier-ledger.json',
            'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
            'scripts/agent-harness.mjs',
            'scripts/check-tool-acceptance-table.py',
            'scripts/generate-tool-acceptance-tasks.py',
            'scripts/test_acceptance_evidence.py',
            'tests/harness/frontier-ledger-data.test.mjs',
            'tests/harness/agent-harness-cli.test.mjs',
            'tests/integration/tool-e2e-acceptance.test.ts',
        }
        source_review = {
            'review_number': 2,
            'reviewer_id': source_reviewer,
            'candidate_sha': source,
            'reviewed_base_sha': base,
            'verdict': 'PASS',
        }
        epoch_state = {
            'epoch_id': profile['epochId'],
            'state': 'REVIEW_PASSED',
            'pr_number': 261,
            'base_branch': 'master',
            'base_sha': base,
            'reviewed_base_sha': base,
            'candidate_sha': source,
            'review_pass_sha': source,
            'branch': branch,
            'ci': {'sha': source, 'status': 'SUCCESS'},
            'advances_frontier_ids': ['P03'],
            'scope_closure': {'related_work_remaining': False},
            'review_history': [source_review],
        }
        epoch_status = {
            'run': {
                'number': 95,
                'state': {'state': 'EPOCH_ACTIVE', 'active_epoch_pr': 261},
            },
            'epoch': {
                'github_state': 'OPEN',
                'pr_head_sha': candidate,
                'pr_head_ref_name': branch,
                'pr_base_ref_name': 'master',
                'pr_is_draft': False,
                'state': epoch_state,
            },
        }
        with (
            patch.object(
                GENERATOR,
                'codex_p03_profile_report_candidate_paths',
                return_value=allowed_paths,
            ),
            patch.object(
                GENERATOR,
                'codex_g26_candidate_bundle_sha256',
                return_value=report['mcpBundleSha256'],
            ),
        ):
            self.assertTrue(
                GENERATOR.codex_p03_v4_candidate_binding_is_current(report, epoch_status),
            )

            current_review = {
                'review_number': 3,
                'reviewer_id': 'gpt-6-luna-max-run95-pr261-round3',
                'candidate_sha': candidate,
                'reviewed_base_sha': base,
                'verdict': 'PASS',
            }
            current_status = {
                **epoch_status,
                'epoch': {
                    **epoch_status['epoch'],
                    'state': {
                        **epoch_state,
                        'candidate_sha': candidate,
                        'review_pass_sha': candidate,
                        'ci': {'sha': candidate, 'status': 'SUCCESS'},
                        'review_history': [source_review, current_review],
                    },
                },
            }
            self.assertTrue(
                GENERATOR.codex_p03_v4_candidate_binding_is_current(report, current_status),
            )

            unapproved_paths = allowed_paths | {'packages/tools/src/definitions/read-tools.ts'}
            with patch.object(
                GENERATOR,
                'codex_p03_profile_report_candidate_paths',
                return_value=unapproved_paths,
            ):
                self.assertFalse(
                    GENERATOR.codex_p03_v4_candidate_binding_is_current(report, epoch_status),
                )

    def test_v4_report_route_adds_only_the_registered_person_profile_matrix_row(self):
        with tempfile.TemporaryDirectory(prefix='p03-v4-matrix-route-') as directory:
            live_probe_dir = Path(directory)
            report_path = live_probe_dir / Path(GENERATOR.CODEX_P03_V4_REPORT_RELATIVE_PATH).name
            report_path.write_text(
                json.dumps({
                    'evidenceKind': GENERATOR.CODEX_P03_V4_EVIDENCE_KIND,
                    'profileId': GENERATOR.CODEX_P03_V4_PROFILE_ID,
                    'prNumber': 262,
                }),
                encoding='utf-8',
            )
            catalog = json.loads(GENERATOR.CATALOG.read_text(encoding='utf-8'))
            with (
                patch.object(GENERATOR, 'LIVE_PROBE_DIR', live_probe_dir),
                patch.object(GENERATOR, 'codex_p03_profile_harness_status', return_value={'fixture': True}),
                patch.object(GENERATOR, 'codex_p03_profile_epoch_harness_status', return_value={'fixture': True}),
                patch.object(GENERATOR, 'codex_p03_profile_report_is_valid', return_value=True),
                patch.object(GENERATOR, 'codex_p03_profile_report_matches_candidate_revision', return_value=True),
            ):
                sources = GENERATOR.model_mcp_e2e_sources(catalog)
            self.assertEqual(
                sources,
                {
                    'bangumi.get_person_profile': {
                        Path(GENERATOR.CODEX_P03_V4_REPORT_RELATIVE_PATH).name,
                    },
                },
            )


class G06CastOfflineProfileReportValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix='g06-cast-offline-profile-report-test-')
        self.root = Path(self.temp_dir.name)
        self.report_path = self.root / GENERATOR.CODEX_G06_CAST_OFFLINE_REPORT_RELATIVE_PATH
        self.report_path.parent.mkdir(parents=True)
        for profile in GENERATOR.CODEX_G06_CAST_OFFLINE_PROFILE_SPECS.values():
            selection_path = self.root / profile['selectionEvidencePath']
            selection_path.parent.mkdir(parents=True, exist_ok=True)
            selection_path.write_bytes(
                (GENERATOR.ROOT / profile['selectionEvidencePath']).read_bytes(),
            )
        self.catalog_path = self.root / 'docs/tool-catalog.json'
        self.catalog_path.parent.mkdir(parents=True, exist_ok=True)
        self.catalog_path.write_bytes(GENERATOR.CATALOG.read_bytes())
        self.source_catalog = json.loads(self.catalog_path.read_text(encoding='utf-8'))
        self.source_revision = _commit_catalog_source_revision(self.root)
        frontier_path = self.root / 'docs/product/frontier-ledger.json'
        frontier_path.parent.mkdir(parents=True, exist_ok=True)
        frontier = json.loads((GENERATOR.ROOT / 'docs/product/frontier-ledger.json').read_text())
        g06 = next(record for record in frontier['records'] if record['id'] == 'G06')
        for profile in GENERATOR.CODEX_G06_CAST_OFFLINE_PROFILE_SPECS.values():
            g06['source_refs'].append(profile['reportPath'])
            g06['source_refs'].append(profile['selectionEvidencePath'])
        frontier_path.write_text(json.dumps(frontier), encoding='utf-8')
        self.originals = (GENERATOR.ROOT, GENERATOR.CATALOG, GENERATOR.LIVE_PROBE_DIR)
        GENERATOR.ROOT = self.root
        GENERATOR.CATALOG = self.catalog_path
        GENERATOR.LIVE_PROBE_DIR = self.root / 'docs/live-probes'
        self.report = self.build_report()

    def tearDown(self):
        GENERATOR.ROOT, GENERATOR.CATALOG, GENERATOR.LIVE_PROBE_DIR = self.originals
        self.temp_dir.cleanup()

    def build_report(self):
        catalog_bytes = self.catalog_path.read_bytes()
        catalog = json.loads(catalog_bytes)
        tool = next(item for item in catalog if item['name'] == GENERATOR.CODEX_G06_CAST_OFFLINE_TOOL_NAME)
        selection_bytes = (self.root / GENERATOR.CODEX_G06_CAST_OFFLINE_SELECTION_EVIDENCE_RELATIVE_PATH).read_bytes()
        receipt_payload = {
            field: None for field in GENERATOR.CODEX_G06_CAST_OFFLINE_RECEIPT_PAYLOAD_FIELDS
        }
        answer = b'G06_SYNTHETIC_CAST_MATRIX_EXECUTED'
        return {
            'schemaVersion': 1,
            'evidenceKind': GENERATOR.CODEX_G06_CAST_OFFLINE_EVIDENCE_KIND,
            'runNumber': 95,
            'frontierId': 'G06',
            'scenarioId': None,
            'acceptanceScope': 'agent-mcp-matrix-only',
            'epochId': GENERATOR.CODEX_G06_CAST_OFFLINE_EPOCH_ID,
            'profileId': GENERATOR.CODEX_G06_CAST_OFFLINE_PROFILE_ID,
            'profile': 'codex-luna-max-offline-agent-mcp-matrix-v1',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'reviewerId': 'gpt-6-luna-max-run95-pr222-round1',
            'codexCliVersion': '0.162.0-alpha.17.2',
            'observedAt': '2026-10-17T05:00:00.000Z',
            'sourceRevision': self.source_revision,
            'baseSha': 'b' * 40,
            'ciSha': self.source_revision,
            'ciStatus': 'SUCCESS',
            'ciRunId': '38900001234',
            'ciChecks': [
                {'name': name, 'status': 'COMPLETED', 'conclusion': 'SUCCESS'}
                for name in GENERATOR.CODEX_G06_CAST_OFFLINE_REQUIRED_CI_CHECKS
            ],
            'prNumber': 222,
            'claimId': f'profile-run-95-pr-222-{self.source_revision[:12]}-1792200000000',
            'mcpBundleSha256': 'c' * 64,
            'registrySha256': GENERATOR.CODEX_G06_CAST_OFFLINE_PROFILE_REGISTRY_SHA256,
            'selectionEvidenceSha256': hashlib.sha256(selection_bytes).hexdigest(),
            'toolName': GENERATOR.CODEX_G06_CAST_OFFLINE_TOOL_NAME,
            'argumentProfile': GENERATOR.CODEX_G06_CAST_OFFLINE_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR.CODEX_G06_CAST_OFFLINE_EXPECTED_ARGUMENTS_SHA256,
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(tool['description'].encode()).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'serverToolNames': [GENERATOR.CODEX_G06_CAST_OFFLINE_TOOL_NAME],
            'serverToolCount': 1,
            'networkMode': GENERATOR.CODEX_G06_CAST_OFFLINE_NETWORK_MODE,
            'mcpServerNames': [GENERATOR.CODEX_G06_CAST_OFFLINE_SERVER_ID],
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'eventStreamParsed': True,
            'turnCompleted': True,
            'codexMcpToolEventCount': 1,
            'codexErrorItemCount': 0,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'answerCheckMethod': GENERATOR.CODEX_G06_CAST_OFFLINE_ANSWER_CHECK_METHOD,
            'answerSha256': hashlib.sha256(answer).hexdigest(),
            'answerUtf8Bytes': len(answer),
            'toolResultSummary': {
                'status': 'ok', 'subjectIdMatches': True, 'rowsObserved': 2,
                'rowsReturned': 2, 'multiRoleVoiceActorCount': 1, 'truncated': False,
                'schemaDriftRows': 0, 'invalidActorIdRows': 0, 'sourceStatus': 'observed',
                'paginationAvailable': False, 'totalCountAvailable': False,
            },
            'answerChecks': {key: True for key in GENERATOR.CODEX_G06_CAST_OFFLINE_ANSWER_CHECK_FIELDS},
            'offlineFixture': {
                'profile': GENERATOR.CODEX_G06_CAST_OFFLINE_NETWORK_MODE,
                'requestCount': 1, 'allowedRequestCount': 1, 'duplicateRequestCount': 0,
                'unexpectedRequestCount': 0, 'authorizationHeaderCount': 0,
                'queryParameterCount': 0, 'requestBodyCount': 0, 'rowsReturned': 2,
                'expectedOperationComplete': True,
            },
            'networkBoundary': {
                'liveBangumiApiRequestCount': 0, 'externalProductRequestCount': 0,
                'rendererAssetRequestCount': 0, 'fullCodexHarnessNetworkSandboxed': False,
            },
            'privacy': {
                'authProfile': 'anonymous', 'oauthAttempted': False, 'accountDataRead': False,
                'writesAttempted': False, 'communityRead': False, 'qqPipelineTested': False,
                'timClientTested': False, 'promptStored': False, 'answerStored': False,
                'syntheticNamesOrIdsStored': False, 'rawFixtureRowsStored': False,
                'rawToolResultStored': False, 'artifactImageBytesStored': False,
                'credentialsStored': False,
            },
            'runnerReceipt': {
                'schemaVersion': 1,
                'kind': 'g06-cast-offline-agent-mcp-runner-receipt-v1',
                'publicKeyBase64': 'AQ==',
                'publicKeySha256': 'd' * 64,
                'payload': receipt_payload,
                'signature': 'AA==',
            },
        }

    def validate_report(self, report):
        profile = GENERATOR.codex_g06_cast_offline_profile_spec(report.get('profileId'))
        report_path = self.root / profile['reportPath']
        report_path.parent.mkdir(parents=True, exist_ok=True)
        report_path.write_text(json.dumps(report), encoding='utf-8')

        def validate_embedded_report(args, **kwargs):
            payload = json.loads(kwargs['input'])
            embedded = base64.b64decode(payload['reportBytesBase64'])
            return subprocess.CompletedProcess(
                args, 0,
                json.dumps({'passed': True, 'reportSha256': hashlib.sha256(embedded).hexdigest()}),
                '',
            )

        real_subprocess_run = subprocess.run

        def run_git_or_validate_report(args, *positional, **kwargs):
            if isinstance(args, list) and args and args[0] == 'git':
                return real_subprocess_run(args, *positional, **kwargs)
            return validate_embedded_report(args, **kwargs)

        with (
            patch.object(GENERATOR, 'codex_g06_cast_offline_profile_revision_has_implementation', return_value=True),
            patch.object(GENERATOR, 'codex_g26_candidate_bundle_sha256', return_value='c' * 64),
            patch.object(GENERATOR, 'codex_g06_cast_offline_frontier_is_partial', return_value=True),
            patch.object(GENERATOR, 'codex_g06_cast_offline_profile_report_matches_candidate_revision', return_value=True),
            patch.object(GENERATOR, 'codex_g06_cast_offline_profile_report_candidate_binding_is_current', return_value=True),
            patch.object(GENERATOR, 'codex_g06_cast_offline_profile_disposition_matches_report', return_value={'state': 'REPORT_WRITTEN'}),
            patch.object(GENERATOR.subprocess, 'run', side_effect=run_git_or_validate_report),
        ):
            return GENERATOR.codex_g06_cast_offline_profile_report_is_valid(
                report,
                harness_status={'fixture': True},
                report_path=report_path,
                epoch_status={'fixture': True},
            )

    def build_v2_report(self):
        profile = GENERATOR.codex_g06_cast_offline_profile_spec(
            GENERATOR.CODEX_G06_CAST_OFFLINE_V2_PROFILE_ID,
        )
        report = json.loads(json.dumps(self.report))
        report.update({
            'evidenceKind': profile['evidenceKind'],
            'epochId': profile['epochId'],
            'profileId': profile['id'],
            'profile': profile['reportProfile'],
            'registrySha256': profile['registrySha256'],
            'selectionEvidenceSha256': hashlib.sha256(
                (self.root / profile['selectionEvidencePath']).read_bytes(),
            ).hexdigest(),
            'argumentProfile': profile['argumentProfile'],
            'expectedArgumentsSha256': profile['expectedArgumentsSha256'],
            'networkMode': profile['networkMode'],
            'answerCheckMethod': profile['answerCheckMethod'],
            'codexErrorItemCount': 3,
        })
        report['offlineFixture']['profile'] = profile['networkMode']
        report_path = self.root / profile['reportPath']
        report_path.parent.mkdir(parents=True, exist_ok=True)
        return report, report_path, profile

    def report_written_harness_status(self, report, report_path, profile):
        report_path.write_text(json.dumps(report), encoding='utf-8')
        report_bytes = report_path.read_bytes()
        receipt = report['runnerReceipt']
        disposition = {
            'claimId': report['claimId'],
            'profileId': profile['id'],
            'frontierId': profile['frontierId'],
            'epochId': profile['epochId'],
            'runNumber': 95,
            'prNumber': report['prNumber'],
            'state': 'REPORT_WRITTEN',
            'sourceCandidateSha': report['sourceRevision'],
            'baseSha': report['baseSha'],
            'ciSha': report['sourceRevision'],
            'ciStatus': 'SUCCESS',
            'ciRunId': report['ciRunId'],
            'ciChecks': report['ciChecks'],
            'reviewerId': report['reviewerId'],
            'bundleSha256': report['mcpBundleSha256'],
            'registrySha256': profile['registrySha256'],
            'toolName': profile['toolName'],
            'argumentProfile': profile['argumentProfile'],
            'expectedArgumentsSha256': profile['expectedArgumentsSha256'],
            'reportWritten': True,
            'reportPath': profile['reportPath'],
            'reportSha256': hashlib.sha256(report_bytes).hexdigest(),
            'retryAllowed': False,
            'runnerReceiptPublicKey': receipt['publicKeyBase64'],
            'runnerReceiptPublicKeySha256': receipt['publicKeySha256'],
            'runnerReceiptSha256': GENERATOR._canonical_json_sha256(receipt),
        }
        return {
            'state': 'REPORT_WRITTEN',
            'profile_id': profile['id'],
            'pr': report['prNumber'],
            'tool_name': profile['toolName'],
            'argument_profile': profile['argumentProfile'],
            'expected_arguments_sha256': profile['expectedArgumentsSha256'],
            'registry_sha256': profile['registrySha256'],
            'claim_label_present': True,
            'terminal_label_present': True,
            'disposition': disposition,
        }

    def run_v2_sources(self, report, report_path, profile, harness_status):
        report_path.write_text(json.dumps(report), encoding='utf-8')
        report_bytes = report_path.read_bytes()

        def validate_embedded_report(args, **kwargs):
            payload = json.loads(kwargs['input'])
            embedded = base64.b64decode(payload['reportBytesBase64'])
            return subprocess.CompletedProcess(
                args, 0,
                json.dumps({'passed': True, 'reportSha256': hashlib.sha256(embedded).hexdigest()}),
                '',
            )

        real_subprocess_run = subprocess.run

        def run_git_or_validate_report(args, *positional, **kwargs):
            if isinstance(args, list) and args and args[0] == 'git':
                return real_subprocess_run(args, *positional, **kwargs)
            return validate_embedded_report(args, **kwargs)

        with (
            patch.object(GENERATOR, 'codex_g06_cast_offline_profile_harness_status', return_value=harness_status),
            patch.object(GENERATOR, 'codex_g06_cast_offline_profile_epoch_harness_status', return_value={'fixture': True}),
            patch.object(GENERATOR, 'codex_g06_cast_offline_profile_revision_has_implementation', return_value=True),
            patch.object(GENERATOR, 'codex_g06_cast_offline_profile_report_matches_candidate_revision', return_value=True),
            patch.object(GENERATOR, 'codex_g06_cast_offline_profile_report_candidate_binding_is_current', return_value=True),
            patch.object(GENERATOR, 'codex_g26_candidate_bundle_sha256', return_value='c' * 64),
            patch.object(GENERATOR.subprocess, 'run', side_effect=run_git_or_validate_report),
        ):
            sources = GENERATOR.model_mcp_e2e_sources(json.loads(self.catalog_path.read_text()))
        return sources, report_bytes

    def test_accepts_only_the_synthetic_agent_mcp_matrix_cell_while_G06_remains_partial(self):
        self.assertTrue(GENERATOR.codex_g06_cast_offline_frontier_is_partial())
        self.assertTrue(self.validate_report(self.report))

    def test_v2_report_accepts_bounded_error_items_and_routes_only_after_harness_acceptance(self):
        report, report_path, profile = self.build_v2_report()
        self.assertTrue(GENERATOR.codex_g06_cast_offline_frontier_is_partial(
            profile_id=profile['id'],
        ))
        self.assertTrue(self.validate_report(report))

        accepted_status = self.report_written_harness_status(report, report_path, profile)
        sources, _ = self.run_v2_sources(report, report_path, profile, accepted_status)
        self.assertEqual(
            sources,
            {
                profile['toolName']: {
                    profile['reportPath'],
                },
            },
        )

        inconclusive_status = {'state': 'INCONCLUSIVE'}
        sources, _ = self.run_v2_sources(report, report_path, profile, inconclusive_status)
        self.assertNotIn(profile['toolName'], sources)

    def test_v2_rejects_unbounded_error_counts_and_v1_still_requires_zero(self):
        report, _, _ = self.build_v2_report()
        for invalid_count in (-1, 10_000_001, True):
            with self.subTest(error_item_count=invalid_count):
                invalid = json.loads(json.dumps(report))
                invalid['codexErrorItemCount'] = invalid_count
                self.assertFalse(self.validate_report(invalid))

        v1_with_error = json.loads(json.dumps(self.report))
        v1_with_error['codexErrorItemCount'] = 1
        self.assertFalse(self.validate_report(v1_with_error))

    def test_rejects_scenario_credit_raw_content_and_fixture_expansion(self):
        scenario_credit = json.loads(json.dumps(self.report))
        scenario_credit['scenarioId'] = 'G06'
        self.assertFalse(self.validate_report(scenario_credit))

        raw_rows = json.loads(json.dumps(self.report))
        raw_rows['rawRows'] = [{'name': 'Synthetic Character'}]
        self.assertFalse(self.validate_report(raw_rows))

        expanded_fixture = json.loads(json.dumps(self.report))
        expanded_fixture['offlineFixture']['requestCount'] = 3
        self.assertFalse(self.validate_report(expanded_fixture))

        network_request = json.loads(json.dumps(self.report))
        network_request['networkBoundary']['liveBangumiApiRequestCount'] = 1
        self.assertFalse(self.validate_report(network_request))

    def test_routes_a_valid_report_only_to_get_subject_cast_agent_mcp(self):
        self.report_path.write_text(json.dumps(self.report), encoding='utf-8')
        catalog = json.loads(self.catalog_path.read_text(encoding='utf-8'))
        with (
            patch.object(GENERATOR, 'codex_g06_cast_offline_profile_harness_status', return_value={'fixture': True}),
            patch.object(GENERATOR, 'codex_g06_cast_offline_profile_epoch_harness_status', return_value={'fixture': True}),
            patch.object(GENERATOR, 'codex_g06_cast_offline_profile_report_is_valid', return_value=True),
            patch.object(GENERATOR, 'codex_g06_cast_offline_profile_report_matches_candidate_revision', return_value=True),
        ):
            sources = GENERATOR.model_mcp_e2e_sources(catalog)
        self.assertEqual(
            sources,
            {
                'bangumi.get_subject_cast': {
                    GENERATOR.CODEX_G06_CAST_OFFLINE_REPORT_RELATIVE_PATH,
                },
            },
        )

    def test_v2_accepts_source_catalog_after_unrelated_current_catalog_addition(self):
        report, _, _ = self.build_v2_report()
        current_catalog = json.loads(json.dumps(self.source_catalog))
        current_catalog.append({
            'name': 'bangumi.unrelated_catalog_extension',
            'auth': 'none',
            'risk': 'read',
            'description': 'Unrelated post-report catalog entry.',
            'inputSchema': {'type': 'object', 'properties': {}},
        })
        self.catalog_path.write_text(json.dumps(current_catalog), encoding='utf-8')
        self.assertTrue(self.validate_report(report))

    def test_v2_catalog_digest_hashes_exact_crlf_source_blob_bytes(self):
        subprocess.run(
            ['git', '-C', str(self.root), 'config', 'core.autocrlf', 'false'],
            check=True, capture_output=True,
        )
        lf_catalog_bytes = self.catalog_path.read_bytes()
        crlf_catalog_bytes = lf_catalog_bytes.replace(b'\r\n', b'\n').replace(b'\n', b'\r\n')
        self.catalog_path.write_bytes(crlf_catalog_bytes)
        self.source_revision = _commit_catalog_source_revision(self.root)
        self.report = self.build_report()
        report, _, profile = self.build_v2_report()
        current_catalog = json.loads(crlf_catalog_bytes.decode('utf-8'))
        current_tool = next(
            item for item in current_catalog
            if item['name'] == profile['toolName']
        )

        self.assertEqual(report['catalogSha256'], hashlib.sha256(crlf_catalog_bytes).hexdigest())
        self.assertTrue(GENERATOR._report_catalog_matches_source_revision(
            report, profile['toolName'], current_tool,
        ))

        normalized = json.loads(json.dumps(report))
        normalized['catalogSha256'] = hashlib.sha256(
            crlf_catalog_bytes.replace(b'\r\n', b'\n'),
        ).hexdigest()
        self.assertFalse(GENERATOR._report_catalog_matches_source_revision(
            normalized, profile['toolName'], current_tool,
        ))

    def test_v2_rejects_changed_target_entry_and_source_catalog_binding(self):
        report, _, _ = self.build_v2_report()
        for field, value in (
            ('description', 'Changed current description.'),
            ('inputSchema', {'type': 'object', 'properties': {'changed': {'type': 'boolean'}}}),
            ('auth', 'required'),
            ('risk', 'write'),
        ):
            with self.subTest(field=field):
                current_catalog = json.loads(json.dumps(self.source_catalog))
                current_tool = next(
                    item for item in current_catalog
                    if item['name'] == GENERATOR.CODEX_G06_CAST_OFFLINE_TOOL_NAME
                )
                current_tool[field] = value
                self.catalog_path.write_text(json.dumps(current_catalog), encoding='utf-8')
                self.assertFalse(self.validate_report(report))

        self.catalog_path.write_bytes(json.dumps(self.source_catalog).encode('utf-8'))
        wrong_catalog_hash = json.loads(json.dumps(report))
        wrong_catalog_hash['catalogSha256'] = '0' * 64
        self.assertFalse(self.validate_report(wrong_catalog_hash))

        invalid_source_revision = json.loads(json.dumps(report))
        invalid_source_revision['sourceRevision'] = 'f' * 40
        invalid_source_revision['ciSha'] = 'f' * 40
        self.assertFalse(self.validate_report(invalid_source_revision))


class R04OfflineProfileReportValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix='r04-profile-evidence-test-')
        self.root = Path(self.temp_dir.name)
        self.report_path = self.root / GENERATOR.CODEX_R04_REPORT_RELATIVE_PATH
        self.report_path.parent.mkdir(parents=True)
        selection_path = self.root / GENERATOR.CODEX_R04_SELECTION_EVIDENCE_RELATIVE_PATH
        selection_path.parent.mkdir(parents=True)
        selection_path.write_text('R04 remains UNASSESSED; synthetic fixture only.\n', encoding='utf-8')
        frontier_path = self.root / 'docs/product/frontier-ledger.json'
        frontier_path.parent.mkdir(parents=True)
        frontier_path.write_text(json.dumps({
            'records': [{
                'id': 'R04',
                'status': 'UNASSESSED',
                'source_refs': [
                    GENERATOR.CODEX_R04_SELECTION_EVIDENCE_RELATIVE_PATH,
                    GENERATOR.CODEX_R04_REPORT_RELATIVE_PATH,
                ],
            }],
        }), encoding='utf-8')
        self.catalog_path = self.root / 'docs/tool-catalog.json'
        self.catalog_path.parent.mkdir(parents=True, exist_ok=True)
        self.catalog = [{
            'name': GENERATOR.CODEX_R04_TOOL_NAME,
            'auth': 'none',
            'risk': 'read',
            'description': 'Synthetic watch-order test tool.',
            'inputSchema': {'type': 'object', 'required': ['subjectId']},
        }]
        self.catalog_path.write_text(json.dumps(self.catalog), encoding='utf-8')
        self.report = self.build_report()

    def tearDown(self):
        self.temp_dir.cleanup()

    def test_v2_profile_is_distinct_and_keeps_consumed_v1_arguments_unchanged(self):
        self.assertEqual(
            GENERATOR.CODEX_R04_TERMINAL_V1_PROFILE['id'],
            'r04-series-watch-order-offline-agent-mcp-v1',
        )
        self.assertEqual(
            GENERATOR.CODEX_R04_TERMINAL_V1_PROFILE['calls'][0]['arguments']['subjectId'],
            990801,
        )
        self.assertEqual(GENERATOR.CODEX_R04_PROFILE_ID, 'r04-series-watch-order-offline-agent-mcp-v2')
        self.assertNotEqual(GENERATOR.CODEX_R04_PROFILE_ID, GENERATOR.CODEX_R04_TERMINAL_V1_PROFILE['id'])
        self.assertEqual(
            GENERATOR.CODEX_R04_EXPECTED_CALLS[0]['arguments'],
            {'subjectId': 990817, 'depth': 1, 'maxNodes': 1, 'media': 'anime'},
        )

    def test_v2_implementation_markers_match_the_exact_candidate_without_mocking(self):
        revision = GENERATOR._run_repository_git(
            GENERATOR.ROOT, 'rev-parse', 'HEAD',
        ).stdout.strip()
        self.assertRegex(revision, r'^[0-9a-f]{40}$')
        self.assertTrue(
            GENERATOR.codex_r04_profile_revision_has_implementation(revision),
            'R04 report eligibility markers must match every file in the exact candidate commit',
        )

    def build_report(self):
        catalog_bytes = self.catalog_path.read_bytes()
        selection_bytes = (self.root / GENERATOR.CODEX_R04_SELECTION_EVIDENCE_RELATIVE_PATH).read_bytes()
        tool = self.catalog[0]
        receipt_payload = {field: None for field in GENERATOR.CODEX_R04_RECEIPT_PAYLOAD_FIELDS}
        return {
            'schemaVersion': 1,
            'evidenceKind': GENERATOR.CODEX_R04_EVIDENCE_KIND,
            'runNumber': 95,
            'frontierId': 'R04',
            'scenarioId': None,
            'epochId': GENERATOR.CODEX_R04_EPOCH_ID,
            'profileId': GENERATOR.CODEX_R04_PROFILE_ID,
            'profile': 'codex-luna-max-offline-agent-mcp-matrix-v2',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'reviewerId': 'gpt-6-luna-max-run95-pr222-round1',
            'codexCliVersion': '1.2.14',
            'observedAt': '2026-10-16T05:00:00.000Z',
            'sourceRevision': 'a' * 40,
            'baseSha': 'b' * 40,
            'ciSha': 'a' * 40,
            'ciStatus': 'SUCCESS',
            'ciRunId': '38812509760',
            'ciChecks': [
                {'name': name, 'status': 'COMPLETED', 'conclusion': 'SUCCESS'}
                for name in GENERATOR.CODEX_R04_REQUIRED_CI_CHECKS
            ],
            'prNumber': 222,
            'claimId': 'profile-run-95-pr-222-aaaaaaaaaaaa-1792100000000',
            'mcpBundleSha256': 'c' * 64,
            'registrySha256': GENERATOR.CODEX_R04_PROFILE_REGISTRY_SHA256,
            'selectionEvidenceSha256': hashlib.sha256(selection_bytes).hexdigest(),
            'toolName': GENERATOR.CODEX_R04_TOOL_NAME,
            'argumentProfile': GENERATOR.CODEX_R04_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR.CODEX_R04_EXPECTED_ARGUMENTS_SHA256,
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(tool['description'].encode()).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'serverToolNames': [GENERATOR.CODEX_R04_TOOL_NAME],
            'serverToolCount': 1,
            'networkMode': GENERATOR.CODEX_R04_NETWORK_MODE,
            'mcpServerNames': ['bgk_r04_watch_order_v2'],
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'eventStreamParsed': True,
            'turnCompleted': True,
            'codexMcpToolEventCount': 1,
            'codexErrorItemCount': 0,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'answerCheckMethod': GENERATOR.CODEX_R04_ANSWER_CHECK_METHOD,
            'answerSha256': hashlib.sha256(b'R04_SYNTHETIC_WATCH_ORDER_PREQUEL_CHAIN_READ').hexdigest(),
            'answerUtf8Bytes': len(b'R04_SYNTHETIC_WATCH_ORDER_PREQUEL_CHAIN_READ'),
            'answerChecks': {key: True for key in GENERATOR.CODEX_R04_ANSWER_CHECK_FIELDS},
            'resultSummary': {
                'state': 'complete', 'subjectId': 990817, 'watchOrderCount': 2,
                'watchOrder': [
                    {'id': 990818, 'isRoot': False, 'placement': 'before_root'},
                    {'id': 990817, 'isRoot': True, 'placement': 'root'},
                ],
                'relatedCount': 1, 'relatedIds': [990818], 'relationRequests': 2,
                'relationRowsObserved': 1, 'detailsAttempted': 1,
            },
            'offlineFixture': {
                'profile': GENERATOR.CODEX_R04_NETWORK_MODE,
                'requestCount': 4,
                'subjectRequestCount': 2,
                'relationsRequestCount': 2,
                'duplicateRequestCount': 0,
                'unexpectedRequestCount': 0,
                'authorizationHeaderCount': 0,
                'expectedOperationsComplete': True,
            },
            'networkBoundary': {
                'liveBangumiApiRequestCount': 0,
                'rendererAssetRequestCount': 0,
                'fullCodexHarnessNetworkSandboxed': False,
            },
            'privacy': {
                'authProfile': 'anonymous', 'oauthAttempted': False, 'accountDataRead': False,
                'writesAttempted': False, 'communityRead': False, 'qqPipelineTested': False,
                'timClientTested': False, 'promptStored': False, 'answerStored': False,
                'rawFixtureRowsStored': False, 'rawToolResultStored': False,
                'artifactImageBytesStored': False, 'credentialsStored': False,
            },
            'runnerReceipt': {
                'schemaVersion': 1,
                'kind': 'r04-series-watch-order-offline-v2-runner-receipt-v1',
                'publicKeyBase64': 'AQ==',
                'publicKeySha256': 'd' * 64,
                'payload': receipt_payload,
                'signature': 'AA==',
            },
        }

    def validate_report(self, report):
        self.report_path.write_text(json.dumps(report), encoding='utf-8')
        report_bytes = self.report_path.read_bytes()

        def validate_embedded_report(args, **kwargs):
            payload = json.loads(kwargs['input'])
            embedded = base64.b64decode(payload['reportBytesBase64'])
            return subprocess.CompletedProcess(
                args, 0,
                json.dumps({'passed': True, 'reportSha256': hashlib.sha256(embedded).hexdigest()}),
                '',
            )

        with (
            patch.object(GENERATOR, 'ROOT', self.root),
            patch.object(GENERATOR, 'LIVE_PROBE_DIR', self.root / 'docs/live-probes'),
            patch.object(GENERATOR, 'CATALOG', self.catalog_path),
            patch.object(GENERATOR, 'codex_r04_profile_revision_has_implementation', return_value=True),
            patch.object(GENERATOR, 'codex_g26_candidate_bundle_sha256', return_value='c' * 64),
            patch.object(GENERATOR, 'codex_r04_profile_report_candidate_binding_is_current', return_value=True),
            patch.object(GENERATOR, 'codex_r04_profile_disposition_matches_report', return_value={'state': 'REPORT_WRITTEN'}),
            patch.object(GENERATOR.subprocess, 'run', side_effect=validate_embedded_report),
        ):
            return GENERATOR.codex_r04_profile_report_is_valid(
                report,
                harness_status={'fixture': True},
                report_path=self.report_path,
                epoch_status={'fixture': True},
            )

    def test_accepts_matrix_report_while_R04_remains_unassessed(self):
        self.assertTrue(GENERATOR.codex_r04_frontier_is_unassessed())
        self.assertTrue(self.validate_report(self.report))

    def test_rejects_scenario_credit_expanded_fixture_and_raw_fields(self):
        scenario_credit = json.loads(json.dumps(self.report))
        scenario_credit['scenarioId'] = 'R04'
        self.assertFalse(self.validate_report(scenario_credit))

        expanded_fixture = json.loads(json.dumps(self.report))
        expanded_fixture['offlineFixture']['requestCount'] = 3
        self.assertFalse(self.validate_report(expanded_fixture))

        raw_result = json.loads(json.dumps(self.report))
        raw_result['rawToolResult'] = 'synthetic result'
        self.assertFalse(self.validate_report(raw_result))

    def test_routes_the_report_to_only_series_watch_order_agent_mcp(self):
        self.report_path.write_text(json.dumps(self.report), encoding='utf-8')
        with (
            patch.object(GENERATOR, 'ROOT', self.root),
            patch.object(GENERATOR, 'LIVE_PROBE_DIR', self.root / 'docs/live-probes'),
            patch.object(GENERATOR, 'codex_r04_profile_harness_status', return_value={'fixture': True}),
            patch.object(GENERATOR, 'codex_r04_profile_epoch_harness_status', return_value={'fixture': True}),
            patch.object(GENERATOR, 'codex_r04_profile_report_is_valid', return_value=True),
            patch.object(GENERATOR, 'codex_r04_profile_report_matches_candidate_revision', return_value=True),
        ):
            sources = GENERATOR.model_mcp_e2e_sources(self.catalog)
        self.assertEqual(
            sources,
            {
                GENERATOR.CODEX_R04_TOOL_NAME: {GENERATOR.CODEX_R04_REPORT_RELATIVE_PATH},
            },
        )


class R04RenderSeriesWatchOrderMatrixProfileTests(unittest.TestCase):
    def test_new_renderer_profile_is_distinct_and_keeps_r04_unassessed(self):
        self.assertEqual(
            GENERATOR.CODEX_R04_RENDER_PROFILE_ID,
            'r04-render-series-watch-order-offline-agent-mcp-v1',
        )
        self.assertEqual(
            GENERATOR.CODEX_R04_RENDER_TOOL_NAME,
            'bangumi.render_series_watch_order',
        )
        self.assertNotEqual(
            GENERATOR.CODEX_R04_RENDER_PROFILE_ID,
            GENERATOR.CODEX_R04_PROFILE_ID,
        )
        self.assertNotEqual(
            GENERATOR.CODEX_R04_RENDER_EXPECTED_ARGUMENTS,
            GENERATOR.CODEX_R04_EXPECTED_CALLS[0]['arguments'],
        )
        self.assertTrue(GENERATOR.codex_r04_render_frontier_is_unassessed())

    def test_unbound_or_malformed_render_profile_report_never_earns_matrix_credit(self):
        self.assertFalse(GENERATOR.codex_r04_render_profile_report_is_valid({}))
        self.assertFalse(GENERATOR.codex_r04_render_profile_report_is_valid({
            'evidenceKind': GENERATOR.CODEX_R04_RENDER_EVIDENCE_KIND,
            'profileId': GENERATOR.CODEX_R04_PROFILE_ID,
        }))


class R04RenderSeriesWatchOrderV2MatrixProfileTests(unittest.TestCase):
    def test_v2_is_separately_keyed_and_keeps_the_r04_scenario_unassessed(self):
        self.assertEqual(
            GENERATOR.CODEX_R04_RENDER_V2_PROFILE_ID,
            'r04-render-series-watch-order-offline-agent-mcp-matrix-v2',
        )
        self.assertEqual(
            GENERATOR.CODEX_R04_RENDER_V2_TOOL_NAME,
            'bangumi.render_series_watch_order',
        )
        self.assertEqual(
            GENERATOR.CODEX_R04_RENDER_V2_EXPECTED_ARGUMENTS['subjectId'],
            990803,
        )
        self.assertNotEqual(
            GENERATOR.CODEX_R04_RENDER_V2_PROFILE_ID,
            GENERATOR.CODEX_R04_RENDER_PROFILE_ID,
        )
        self.assertTrue(GENERATOR.codex_r04_render_v2_frontier_is_unassessed())

    def test_v2_implementation_markers_match_the_reviewed_candidate(self):
        head = GENERATOR._run_repository_git(
            GENERATOR.ROOT, 'rev-parse', 'HEAD',
        ).stdout.strip()
        self.assertTrue(GENERATOR.codex_r04_render_v2_profile_revision_has_implementation(head))

    def test_v2_report_refresh_allows_only_report_and_acceptance_reconciliation_paths(self):
        allowed_paths = GENERATOR.CODEX_R04_RENDER_V2_EVIDENCE_REFRESH_PATHS
        self.assertEqual(allowed_paths, {
            GENERATOR.CODEX_R04_RENDER_V2_REPORT_RELATIVE_PATH,
            'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
            'docs/product/frontier-ledger.json',
            'docs/agent/HARNESS.md',
            'docs/research/run95-g14-query-subjects-v2-terminal-disposition-2026-10-19.md',
            'scripts/check-tool-acceptance-table.py',
            'scripts/generate-tool-acceptance-tasks.py',
            'scripts/test_acceptance_evidence.py',
            'scripts/agent-harness.mjs',
            'apps/mcp/codex-one-tool-mcp-server.mjs',
            'scripts/lib/source-revision-tool-catalog.mjs',
            'scripts/acceptance/write-g06-subject-cast-offline-agent-mcp-report.mjs',
            'tests/harness/write-g06-subject-cast-offline-agent-mcp-report.test.mjs',
            'scripts/acceptance/write-r04-render-series-watch-order-offline-agent-mcp-v2-report.mjs',
            'tests/harness/write-r04-render-series-watch-order-offline-agent-mcp-v2-report.test.mjs',
            'tests/harness/agent-harness-cli.test.mjs',
            'tests/harness/g01-public-query-render-evidence.test.mjs',
            'tests/harness/g09-public-watch-order-evidence.test.mjs',
            'tests/harness/g09-public-watch-order-render-evidence.test.mjs',
            'tests/harness/public-probe-coverage.test.mjs',
            'tests/harness/query-subjects-fresh-public-matrix-v2-profile.test.mjs',
            'tests/integration/tool-e2e-acceptance.test.ts',
        })
        self.assertTrue(GENERATOR.codex_r04_render_v2_profile_evidence_refresh_paths_are_valid(
            allowed_paths,
        ))
        self.assertFalse(GENERATOR.codex_r04_render_v2_profile_evidence_refresh_paths_are_valid(
            allowed_paths | {'apps/mcp/codex-auth-start-offline-mcp-server.mjs'},
        ))
        self.assertFalse(GENERATOR.codex_r04_render_v2_profile_evidence_refresh_paths_are_valid(
            allowed_paths - {GENERATOR.CODEX_R04_RENDER_V2_REPORT_RELATIVE_PATH},
        ))

    def test_v2_report_candidate_binding_accepts_pushed_refresh_before_harness_candidate_check(self):
        source_sha = 'a' * 40
        refreshed_sha = 'b' * 40
        base_sha = 'c' * 40
        bundle_sha = 'd' * 64
        branch = 'codex/epoch-run95-r04-render-series-watch-order-offline-matrix-v2-20261018'
        report = {
            'sourceRevision': source_sha,
            'baseSha': base_sha,
            'prNumber': 222,
            'reviewerId': 'gpt-6-luna-max-run95-pr222-round1',
            'mcpBundleSha256': bundle_sha,
        }
        epoch_status = {
            'run': {
                'number': 95,
                'state': {'state': 'EPOCH_ACTIVE', 'active_epoch_pr': 222},
            },
            'epoch': {
                'number': 222,
                'github_state': 'OPEN',
                'pr_head_ref_name': branch,
                'pr_head_sha': refreshed_sha,
                'pr_base_ref_name': 'master',
                'pr_base_sha': base_sha,
                'pr_is_draft': False,
                'state': {
                    'epoch_id': GENERATOR.CODEX_R04_RENDER_V2_EPOCH_ID,
                    'pr_number': 222,
                    'base_branch': 'master',
                    'base_sha': base_sha,
                    'branch': branch,
                    'candidate_sha': source_sha,
                    'state': 'REVIEW_PASSED',
                    'review_history': [
                        {
                            'candidate_sha': source_sha,
                            'reviewed_base_sha': base_sha,
                            'reviewer_id': report['reviewerId'],
                            'verdict': 'PASS',
                        },
                    ],
                },
            },
        }
        paths = GENERATOR.CODEX_R04_RENDER_V2_EVIDENCE_REFRESH_PATHS
        self.assertTrue(GENERATOR.codex_r04_render_v2_profile_candidate_binding_is_valid(
            report, epoch_status, paths, bundle_sha,
        ))

        epoch_status['epoch']['state']['candidate_sha'] = None
        epoch_status['epoch']['state']['state'] = 'FINAL_CORRECTIVE_REQUIRED'
        epoch_status['epoch']['state']['review_history'].append({
            'candidate_sha': refreshed_sha,
            'reviewed_base_sha': base_sha,
            'reviewer_id': report['reviewerId'],
            'verdict': 'CORRECTIVE_REQUIRED',
        })
        self.assertTrue(GENERATOR.codex_r04_render_v2_profile_candidate_binding_is_valid(
            report, epoch_status, paths, bundle_sha,
        ))
        epoch_status['epoch']['state']['review_history'].pop(0)
        self.assertFalse(GENERATOR.codex_r04_render_v2_profile_candidate_binding_is_valid(
            report, epoch_status, paths, bundle_sha,
        ))
        epoch_status['epoch']['state']['review_history'].insert(0, {
            'candidate_sha': source_sha,
            'reviewed_base_sha': 'f' * 40,
            'reviewer_id': report['reviewerId'],
            'verdict': 'PASS',
        })
        self.assertFalse(GENERATOR.codex_r04_render_v2_profile_candidate_binding_is_valid(
            report, epoch_status, paths, bundle_sha,
        ))

        epoch_status['epoch']['state']['candidate_sha'] = refreshed_sha
        self.assertTrue(GENERATOR.codex_r04_render_v2_profile_candidate_binding_is_valid(
            report, epoch_status, paths, bundle_sha,
        ))
        epoch_status['epoch']['state']['candidate_sha'] = 'e' * 40
        self.assertFalse(GENERATOR.codex_r04_render_v2_profile_candidate_binding_is_valid(
            report, epoch_status, paths, bundle_sha,
        ))
        self.assertFalse(GENERATOR.codex_r04_render_v2_profile_candidate_binding_is_valid(
            report, epoch_status, paths | {'packages/tools/src/definitions/render-presentation-tools.ts'}, bundle_sha,
        ))

    def test_v2_report_candidate_paths_use_live_pr_head_before_harness_candidate_check(self):
        source_sha = 'a' * 40
        pr_head_sha = 'b' * 40
        report = {'sourceRevision': source_sha}
        epoch_status = {
            'epoch': {
                'state': {'candidate_sha': source_sha},
                'pr_head_sha': pr_head_sha,
            },
        }
        paths = GENERATOR.CODEX_R04_RENDER_V2_EVIDENCE_REFRESH_PATHS
        bundle_sha = 'c' * 64
        with (
            patch.object(
                GENERATOR, 'codex_r04_render_v2_profile_report_candidate_paths',
                return_value=paths,
            ) as candidate_paths,
            patch.object(
                GENERATOR, 'codex_g26_candidate_bundle_sha256',
                return_value=bundle_sha,
            ) as bundle_digest,
            patch.object(
                GENERATOR, 'codex_r04_render_v2_profile_candidate_binding_is_valid',
                return_value=True,
            ) as validate_binding,
        ):
            self.assertTrue(
                GENERATOR.codex_r04_render_v2_profile_report_candidate_binding_is_current(
                    report, epoch_status,
                ),
            )
        candidate_paths.assert_called_once_with(source_sha, pr_head_sha)
        bundle_digest.assert_called_once_with(pr_head_sha)
        validate_binding.assert_called_once_with(report, epoch_status, paths, bundle_sha)

    def test_report_maps_only_to_the_render_series_watch_order_agent_mcp_cell(self):
        report_path = GENERATOR.ROOT / GENERATOR.CODEX_R04_RENDER_V2_REPORT_RELATIVE_PATH
        report = json.loads(report_path.read_text(encoding='utf-8'))
        self.assertTrue(TABLE_CHECKER.r04_render_v2_agent_mcp_matches(
            GENERATOR.CODEX_R04_RENDER_V2_TOOL_NAME,
            GENERATOR.CODEX_R04_RENDER_V2_REPORT_RELATIVE_PATH,
            report,
        ))
        self.assertFalse(TABLE_CHECKER.r04_render_v2_agent_mcp_matches(
            'bangumi.render_subject_card',
            GENERATOR.CODEX_R04_RENDER_V2_REPORT_RELATIVE_PATH,
            report,
        ))
        changed = json.loads(json.dumps(report))
        changed['privacy']['qqPipelineTested'] = True
        self.assertFalse(TABLE_CHECKER.r04_render_v2_agent_mcp_matches(
            GENERATOR.CODEX_R04_RENDER_V2_TOOL_NAME,
            GENERATOR.CODEX_R04_RENDER_V2_REPORT_RELATIVE_PATH,
            changed,
        ))

    def test_unbound_or_malformed_v2_report_never_earns_matrix_credit(self):
        self.assertFalse(GENERATOR.codex_r04_render_v2_profile_report_is_valid({}))
        self.assertFalse(GENERATOR.codex_r04_render_v2_profile_report_is_valid({
            'evidenceKind': GENERATOR.CODEX_R04_RENDER_V2_EVIDENCE_KIND,
            'profileId': GENERATOR.CODEX_R04_RENDER_V2_PROFILE_ID,
        }))


class R04RenderSeriesWatchOrderV2ProfileReportValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix='r04-render-v2-profile-evidence-test-')
        self.root = Path(self.temp_dir.name)
        self.report_path = self.root / GENERATOR.CODEX_R04_RENDER_V2_REPORT_RELATIVE_PATH
        self.report_path.parent.mkdir(parents=True)
        selection_path = self.root / GENERATOR.CODEX_R04_RENDER_V2_SELECTION_EVIDENCE_RELATIVE_PATH
        selection_path.parent.mkdir(parents=True)
        selection_path.write_text(
            'R04 remains UNASSESSED; synthetic renderer matrix fixture only.\n', encoding='utf-8',
        )
        frontier_path = self.root / 'docs/product/frontier-ledger.json'
        frontier_path.parent.mkdir(parents=True)
        frontier_path.write_text(json.dumps({
            'records': [{
                'id': 'R04',
                'status': 'UNASSESSED',
                'source_refs': [
                    GENERATOR.CODEX_R04_RENDER_V2_SELECTION_EVIDENCE_RELATIVE_PATH,
                    GENERATOR.CODEX_R04_RENDER_V2_REPORT_RELATIVE_PATH,
                ],
            }],
        }), encoding='utf-8')
        self.catalog_path = self.root / 'docs/tool-catalog.json'
        self.catalog_path.parent.mkdir(parents=True, exist_ok=True)
        catalog = json.loads(GENERATOR.CATALOG.read_text(encoding='utf-8'))
        self.tool = next(
            item for item in catalog
            if item.get('name') == GENERATOR.CODEX_R04_RENDER_V2_TOOL_NAME
        )
        self.catalog_path.write_text(json.dumps([self.tool]), encoding='utf-8')
        self.source_catalog = [self.tool]
        self.source_revision = _commit_catalog_source_revision(self.root)
        self.report = self.build_report()

    def tearDown(self):
        self.temp_dir.cleanup()

    def build_report(self):
        catalog_bytes = self.catalog_path.read_bytes()
        selection_bytes = (
            self.root / GENERATOR.CODEX_R04_RENDER_V2_SELECTION_EVIDENCE_RELATIVE_PATH
        ).read_bytes()
        answer = b'R04_RENDER_V2_SYNTHETIC_CARD_READY'
        return {
            'schemaVersion': 1,
            'evidenceKind': GENERATOR.CODEX_R04_RENDER_V2_EVIDENCE_KIND,
            'runNumber': 95,
            'frontierId': 'R04',
            'scenarioId': None,
            'epochId': GENERATOR.CODEX_R04_RENDER_V2_EPOCH_ID,
            'profileId': GENERATOR.CODEX_R04_RENDER_V2_PROFILE_ID,
            'profile': 'codex-luna-max-offline-agent-mcp-matrix-v2',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'reviewerId': 'gpt-6-luna-max-run95-pr222-round1',
            'codexCliVersion': '0.162.0-alpha.17.2',
            'observedAt': '2026-10-18T03:00:00.000Z',
            'sourceRevision': self.source_revision,
            'baseSha': 'b' * 40,
            'ciSha': self.source_revision,
            'ciStatus': 'SUCCESS',
            'ciRunId': '39092463148',
            'ciChecks': [
                {'name': name, 'status': 'COMPLETED', 'conclusion': 'SUCCESS'}
                for name in GENERATOR.CODEX_R04_REQUIRED_CI_CHECKS
            ],
            'prNumber': 222,
            'claimId': f'profile-run-95-pr-222-{self.source_revision[:12]}-1792200000000',
            'mcpBundleSha256': 'c' * 64,
            'registrySha256': GENERATOR.CODEX_R04_RENDER_V2_PROFILE_REGISTRY_SHA256,
            'selectionEvidenceSha256': hashlib.sha256(selection_bytes).hexdigest(),
            'toolName': GENERATOR.CODEX_R04_RENDER_V2_TOOL_NAME,
            'argumentProfile': GENERATOR.CODEX_R04_RENDER_V2_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR.CODEX_R04_RENDER_V2_EXPECTED_ARGUMENTS_SHA256,
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(self.tool['description'].encode('utf-8')).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(self.tool['inputSchema']),
            'serverToolNames': [GENERATOR.CODEX_R04_RENDER_V2_TOOL_NAME],
            'serverToolCount': 1,
            'networkMode': GENERATOR.CODEX_R04_RENDER_V2_NETWORK_MODE,
            'mcpServerNames': ['bgk_r04_render_watch_order_v2'],
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'eventStreamParsed': True,
            'turnCompleted': True,
            'codexMcpToolEventCount': 1,
            'codexErrorItemCount': 0,
            'mcpToolErrorResultCount': 0,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'answerCheckMethod': GENERATOR.CODEX_R04_RENDER_V2_ANSWER_CHECK_METHOD,
            'answerSha256': hashlib.sha256(answer).hexdigest(),
            'answerUtf8Bytes': len(answer),
            'answerChecks': {
                key: True for key in GENERATOR.CODEX_R04_RENDER_V2_ANSWER_CHECK_FIELDS
            },
            'resultSummary': {
                'resultState': 'artifact_returned',
                'artifact': {
                    'returned': True,
                    'persisted': False,
                    'mimeType': 'image/png',
                    'width': 720,
                    'height': 480,
                    'byteLength': 1024,
                    'sha256': 'e' * 64,
                    'pngSignatureValid': True,
                    'decoded': True,
                    'dimensionsMatch': True,
                },
            },
            'offlineFixture': {
                'profile': GENERATOR.CODEX_R04_RENDER_V2_NETWORK_MODE,
                'requestCount': 2,
                'subjectRequestCount': 1,
                'relationsRequestCount': 1,
                'duplicateRequestCount': 0,
                'unexpectedRequestCount': 0,
                'authorizationHeaderCount': 0,
                'expectedOperationsComplete': True,
            },
            'rendererAssetBoundary': {'requestCount': 0},
            'networkBoundary': {
                'liveBangumiApiRequestCount': 0,
                'rendererAssetRequestCount': 0,
                'fullCodexHarnessNetworkSandboxed': False,
            },
            'privacy': {
                'authProfile': 'anonymous', 'oauthAttempted': False, 'accountDataRead': False,
                'writesAttempted': False, 'communityRead': False, 'qqPipelineTested': False,
                'timClientTested': False, 'promptStored': False, 'answerStored': False,
                'rawFixtureRowsStored': False, 'rawToolResultStored': False,
                'artifactImageBytesStored': False, 'credentialsStored': False,
            },
            'runnerReceipt': {
                'schemaVersion': 1,
                'kind': 'r04-render-series-watch-order-offline-agent-mcp-v2-runner-receipt-v1',
                'publicKeyBase64': 'AQ==',
                'publicKeySha256': 'd' * 64,
                'payload': {
                    field: None
                    for field in GENERATOR.CODEX_R04_RENDER_V2_RECEIPT_PAYLOAD_FIELDS
                },
                'signature': 'AA==',
            },
        }

    def validate_report(self, report):
        self.report_path.write_text(json.dumps(report), encoding='utf-8')
        report_bytes = self.report_path.read_bytes()

        def validate_embedded_report(args, **kwargs):
            payload = json.loads(kwargs['input'])
            embedded = base64.b64decode(payload['reportBytesBase64'])
            return subprocess.CompletedProcess(
                args, 0,
                json.dumps({'passed': True, 'reportSha256': hashlib.sha256(embedded).hexdigest()}),
                '',
            )

        real_subprocess_run = subprocess.run

        def run_git_or_validate_report(args, *positional, **kwargs):
            if isinstance(args, list) and args and args[0] == 'git':
                return real_subprocess_run(args, *positional, **kwargs)
            return validate_embedded_report(args, **kwargs)

        with (
            patch.object(GENERATOR, 'ROOT', self.root),
            patch.object(GENERATOR, 'LIVE_PROBE_DIR', self.root / 'docs/live-probes'),
            patch.object(GENERATOR, 'CATALOG', self.catalog_path),
            patch.object(GENERATOR, 'codex_r04_render_v2_profile_revision_has_implementation', return_value=True),
            patch.object(GENERATOR, 'codex_g26_candidate_bundle_sha256', return_value='c' * 64),
            patch.object(GENERATOR, 'codex_r04_render_v2_profile_report_candidate_binding_is_current', return_value=True),
            patch.object(GENERATOR, 'codex_r04_render_v2_profile_disposition_matches_report', return_value={'state': 'REPORT_WRITTEN'}),
            patch.object(GENERATOR.subprocess, 'run', side_effect=run_git_or_validate_report),
        ):
            return GENERATOR.codex_r04_render_v2_profile_report_is_valid(
                report,
                harness_status={'fixture': True},
                report_path=self.report_path,
                epoch_status={'fixture': True},
            )

    def test_accepts_ephemeral_artifact_in_signed_matrix_report(self):
        self.assertTrue(self.validate_report(self.report))

    def test_rejects_report_that_claims_artifact_was_persisted(self):
        persisted_report = json.loads(json.dumps(self.report))
        persisted_report['resultSummary']['artifact']['persisted'] = True
        self.assertFalse(self.validate_report(persisted_report))

    def test_accepts_source_catalog_after_unrelated_current_catalog_addition(self):
        current_catalog = json.loads(json.dumps(self.source_catalog))
        current_catalog.append({
            'name': 'bangumi.unrelated_catalog_extension',
            'auth': 'none',
            'risk': 'read',
            'description': 'Unrelated post-report catalog entry.',
            'inputSchema': {'type': 'object', 'properties': {}},
        })
        self.catalog_path.write_text(json.dumps(current_catalog), encoding='utf-8')
        self.assertTrue(self.validate_report(self.report))

    def test_rejects_changed_target_entry_and_source_catalog_binding(self):
        for field, value in (
            ('description', 'Changed current description.'),
            ('inputSchema', {'type': 'object', 'properties': {'changed': {'type': 'boolean'}}}),
            ('auth', 'required'),
            ('risk', 'write'),
        ):
            with self.subTest(field=field):
                current_catalog = json.loads(json.dumps(self.source_catalog))
                current_catalog[0][field] = value
                self.catalog_path.write_text(json.dumps(current_catalog), encoding='utf-8')
                self.assertFalse(self.validate_report(self.report))

        self.catalog_path.write_text(json.dumps(self.source_catalog), encoding='utf-8')
        wrong_catalog_hash = json.loads(json.dumps(self.report))
        wrong_catalog_hash['catalogSha256'] = '0' * 64
        self.assertFalse(self.validate_report(wrong_catalog_hash))

        invalid_source_revision = json.loads(json.dumps(self.report))
        invalid_source_revision['sourceRevision'] = 'f' * 40
        invalid_source_revision['ciSha'] = 'f' * 40
        self.assertFalse(self.validate_report(invalid_source_revision))


class R01OfflineRelationsProfileReportValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix='r01-offline-profile-evidence-test-')
        self.root = Path(self.temp_dir.name)
        self.report_path = self.root / GENERATOR.CODEX_R01_OFFLINE_REPORT_RELATIVE_PATH
        self.report_path.parent.mkdir(parents=True)
        selection_path = self.root / GENERATOR.CODEX_R01_OFFLINE_SELECTION_EVIDENCE_RELATIVE_PATH
        selection_path.parent.mkdir(parents=True)
        selection_path.write_text('R01 scenario remains PARTIAL; matrix-only fixture.\n', encoding='utf-8')
        frontier_path = self.root / 'docs/product/frontier-ledger.json'
        frontier_path.parent.mkdir(parents=True)
        frontier_path.write_text(json.dumps({
            'records': [{
                'id': 'R01',
                'status': 'PARTIAL',
                'source_refs': [
                    GENERATOR.CODEX_R01_OFFLINE_SELECTION_EVIDENCE_RELATIVE_PATH,
                    GENERATOR.CODEX_R01_OFFLINE_REPORT_RELATIVE_PATH,
                ],
            }],
        }), encoding='utf-8')
        self.catalog_path = self.root / 'docs/tool-catalog.json'
        self.catalog_path.parent.mkdir(parents=True, exist_ok=True)
        self.catalog = [{
            'name': GENERATOR.CODEX_R01_OFFLINE_TOOL_NAME,
            'auth': 'none',
            'risk': 'read',
            'description': 'Synthetic direct relations test tool.',
            'inputSchema': {'type': 'object', 'required': ['subjectId']},
        }]
        self.catalog_path.write_text(json.dumps(self.catalog), encoding='utf-8')
        self.report = self.build_report()

    def tearDown(self):
        self.temp_dir.cleanup()

    def build_report(self):
        catalog_bytes = self.catalog_path.read_bytes()
        selection_bytes = (self.root / GENERATOR.CODEX_R01_OFFLINE_SELECTION_EVIDENCE_RELATIVE_PATH).read_bytes()
        tool = self.catalog[0]
        return {
            'schemaVersion': 1,
            'evidenceKind': GENERATOR.CODEX_R01_OFFLINE_EVIDENCE_KIND,
            'runNumber': 95,
            'frontierId': 'R01',
            'scenarioId': None,
            'acceptanceScope': 'agent-mcp-matrix-only',
            'epochId': GENERATOR.CODEX_R01_OFFLINE_EPOCH_ID,
            'profileId': GENERATOR.CODEX_R01_OFFLINE_PROFILE_ID,
            'profile': 'codex-luna-max-offline-agent-mcp-matrix-v2',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'reviewerId': 'gpt-6-luna-max-run95-pr222-round1',
            'codexCliVersion': '0.162.0',
            'observedAt': '2026-10-16T05:00:00.000Z',
            'sourceRevision': 'a' * 40,
            'baseSha': 'b' * 40,
            'ciSha': 'a' * 40,
            'ciStatus': 'SUCCESS',
            'ciRunId': '38812509760',
            'ciChecks': [
                {'name': name, 'status': 'COMPLETED', 'conclusion': 'SUCCESS'}
                for name in GENERATOR.CODEX_R01_OFFLINE_REQUIRED_CI_CHECKS
            ],
            'prNumber': 222,
            'claimId': 'profile-run-95-pr-222-aaaaaaaaaaaa-1792100000000',
            'mcpBundleSha256': 'c' * 64,
            'registrySha256': GENERATOR.CODEX_R01_OFFLINE_PROFILE_REGISTRY_SHA256,
            'selectionEvidenceSha256': hashlib.sha256(selection_bytes).hexdigest(),
            'toolName': GENERATOR.CODEX_R01_OFFLINE_TOOL_NAME,
            'argumentProfile': GENERATOR.CODEX_R01_OFFLINE_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR.CODEX_R01_OFFLINE_EXPECTED_ARGUMENTS_SHA256,
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(tool['description'].encode()).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'serverToolNames': [GENERATOR.CODEX_R01_OFFLINE_TOOL_NAME],
            'serverToolCount': 1,
            'networkMode': GENERATOR.CODEX_R01_OFFLINE_NETWORK_MODE,
            'mcpServerNames': ['bgk_r01_relations'],
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'eventStreamParsed': True,
            'turnCompleted': True,
            'codexMcpToolEventCount': 1,
            'codexErrorItemCount': 2,
            'blockedWebSearchErrorItemCount': 2,
            'unexpectedCodexErrorItemCount': 0,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'answerCheckMethod': GENERATOR.CODEX_R01_OFFLINE_ANSWER_CHECK_METHOD,
            'answerSha256': 'f' * 64,
            'answerUtf8Bytes': 512,
            'answerChecks': {key: True for key in GENERATOR.CODEX_R01_OFFLINE_ANSWER_CHECK_FIELDS},
            'resultSummary': {
                'sourceRowsObserved': 30,
                'sourceRowsReturned': 30,
                'sourceSchemaDriftRows': 0,
                'sourceTruncated': False,
                'textRowsIncluded': 12,
                'textRowsOmitted': 18,
                'textUtf8Bytes': 2580,
                'structuredContentAvailable': True,
                'textProjectionConsistent': True,
                'firstDisplayedRelationMatched': True,
            },
            'offlineFixture': {
                'profile': GENERATOR.CODEX_R01_OFFLINE_NETWORK_MODE,
                'requestCount': 1,
                'relationRequestCount': 1,
                'duplicateRequestCount': 0,
                'unexpectedRequestCount': 0,
                'authorizationHeaderCount': 0,
                'expectedOperationsComplete': True,
            },
            'networkBoundary': {
                'liveBangumiApiRequestCount': 0,
                'rendererAssetRequestCount': 0,
                'fullCodexHarnessNetworkSandboxed': False,
            },
            'privacy': {
                'authProfile': 'anonymous', 'oauthAttempted': False, 'accountDataRead': False,
                'writesAttempted': False, 'communityRead': False, 'qqPipelineTested': False,
                'timClientTested': False, 'promptStored': False, 'answerStored': False,
                'rawFixtureRowsStored': False, 'rawToolResultStored': False,
                'artifactImageBytesStored': False, 'credentialsStored': False,
            },
            'runnerReceipt': {
                'schemaVersion': 1,
                'kind': 'r01-relations-text-projection-offline-agent-mcp-v2-runner-receipt-v1',
                'publicKeyBase64': 'AQ==',
                'publicKeySha256': 'd' * 64,
                'payload': {field: None for field in GENERATOR.CODEX_R01_OFFLINE_RECEIPT_PAYLOAD_FIELDS},
                'signature': 'AA==',
            },
        }

    def validate_report(self, report):
        self.report_path.write_text(json.dumps(report), encoding='utf-8')
        report_bytes = self.report_path.read_bytes()

        def validate_embedded_report(args, **kwargs):
            payload = json.loads(kwargs['input'])
            embedded = base64.b64decode(payload['reportBytesBase64'])
            return subprocess.CompletedProcess(
                args, 0,
                json.dumps({'passed': True, 'reportSha256': hashlib.sha256(embedded).hexdigest()}),
                '',
            )

        with (
            patch.object(GENERATOR, 'ROOT', self.root),
            patch.object(GENERATOR, 'LIVE_PROBE_DIR', self.root / 'docs/live-probes'),
            patch.object(GENERATOR, 'CATALOG', self.catalog_path),
            patch.object(GENERATOR, 'codex_r01_offline_profile_revision_has_implementation', return_value=True),
            patch.object(GENERATOR, 'codex_g26_candidate_bundle_sha256', return_value='c' * 64),
            patch.object(GENERATOR, 'codex_r01_offline_profile_report_candidate_binding_is_current', return_value=True),
            patch.object(GENERATOR, 'codex_r01_offline_profile_disposition_matches_report', return_value={'state': 'REPORT_WRITTEN'}),
            patch.object(GENERATOR.subprocess, 'run', side_effect=validate_embedded_report),
        ):
            return GENERATOR.codex_r01_offline_profile_report_is_valid(
                report, harness_status={'fixture': True}, report_path=self.report_path,
                epoch_status={'fixture': True},
            )

    def test_accepts_matrix_report_while_R01_remains_partial(self):
        with patch.object(GENERATOR, 'ROOT', self.root):
            self.assertTrue(GENERATOR.codex_r01_offline_frontier_is_partial(require_report_ref=True))
        self.assertTrue(self.validate_report(self.report))

    def test_rejects_scenario_credit_expanded_fixture_and_unclassified_errors(self):
        scenario_credit = json.loads(json.dumps(self.report))
        scenario_credit['scenarioId'] = 'R01'
        self.assertFalse(self.validate_report(scenario_credit))

        expanded_fixture = json.loads(json.dumps(self.report))
        expanded_fixture['offlineFixture']['requestCount'] = 3
        self.assertFalse(self.validate_report(expanded_fixture))

        unexpected_error = json.loads(json.dumps(self.report))
        unexpected_error['unexpectedCodexErrorItemCount'] = 1
        self.assertFalse(self.validate_report(unexpected_error))

    def test_routes_the_report_to_only_subject_relations_agent_mcp(self):
        self.report_path.write_text(json.dumps(self.report), encoding='utf-8')
        with (
            patch.object(GENERATOR, 'ROOT', self.root),
            patch.object(GENERATOR, 'LIVE_PROBE_DIR', self.root / 'docs/live-probes'),
            patch.object(GENERATOR, 'codex_r01_offline_profile_harness_status', return_value={'fixture': True}),
            patch.object(GENERATOR, 'codex_r01_offline_profile_epoch_harness_status', return_value={'fixture': True}),
            patch.object(GENERATOR, 'codex_r01_offline_profile_report_is_valid', return_value=True),
            patch.object(GENERATOR, 'codex_r01_offline_profile_report_matches_candidate_revision', return_value=True),
        ):
            sources = GENERATOR.model_mcp_e2e_sources(self.catalog)
        self.assertEqual(
            sources,
            {
                GENERATOR.CODEX_R01_OFFLINE_TOOL_NAME: {
                    GENERATOR.CODEX_R01_OFFLINE_REPORT_RELATIVE_PATH,
                },
            },
        )


class R03OfflineRelationsProfileReportValidationTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix='r03-offline-profile-evidence-test-')
        self.root = Path(self.temp_dir.name)
        self.report_path = self.root / GENERATOR.CODEX_R03_OFFLINE_REPORT_RELATIVE_PATH
        self.report_path.parent.mkdir(parents=True)
        selection_path = self.root / GENERATOR.CODEX_R03_OFFLINE_SELECTION_EVIDENCE_RELATIVE_PATH
        selection_path.parent.mkdir(parents=True)
        selection_path.write_text('R03 scenario remains UNASSESSED; matrix-only fixture.\n', encoding='utf-8')
        frontier_path = self.root / 'docs/product/frontier-ledger.json'
        frontier_path.parent.mkdir(parents=True)
        frontier_path.write_text(json.dumps({
            'records': [{
                'id': 'R03',
                'status': 'UNASSESSED',
                'source_refs': [
                    GENERATOR.CODEX_R03_OFFLINE_SELECTION_EVIDENCE_RELATIVE_PATH,
                    GENERATOR.CODEX_R03_OFFLINE_REPORT_RELATIVE_PATH,
                ],
            }],
        }), encoding='utf-8')
        self.catalog_path = self.root / 'docs/tool-catalog.json'
        self.catalog_path.parent.mkdir(parents=True, exist_ok=True)
        self.catalog = [{
            'name': GENERATOR.CODEX_R03_OFFLINE_TOOL_NAME,
            'auth': 'none',
            'risk': 'read',
            'description': 'Synthetic direct relations test tool.',
            'inputSchema': {'type': 'object', 'required': ['subjectId']},
        }]
        self.catalog_path.write_text(json.dumps(self.catalog), encoding='utf-8')
        self.report = self.build_report()

    def tearDown(self):
        self.temp_dir.cleanup()

    def build_report(self):
        catalog_bytes = self.catalog_path.read_bytes()
        selection_bytes = (self.root / GENERATOR.CODEX_R03_OFFLINE_SELECTION_EVIDENCE_RELATIVE_PATH).read_bytes()
        tool = self.catalog[0]
        return {
            'schemaVersion': 1,
            'evidenceKind': GENERATOR.CODEX_R03_OFFLINE_EVIDENCE_KIND,
            'runNumber': 95,
            'frontierId': 'R03',
            'scenarioId': None,
            'acceptanceScope': 'agent-mcp-matrix-only',
            'epochId': GENERATOR.CODEX_R03_OFFLINE_EPOCH_ID,
            'profileId': GENERATOR.CODEX_R03_OFFLINE_PROFILE_ID,
            'profile': 'codex-luna-max-offline-agent-mcp-matrix-v2',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'reviewerId': 'gpt-6-luna-max-run95-pr222-round1',
            'codexCliVersion': '0.162.0',
            'observedAt': '2026-10-16T05:00:00.000Z',
            'sourceRevision': 'a' * 40,
            'baseSha': 'b' * 40,
            'ciSha': 'a' * 40,
            'ciStatus': 'SUCCESS',
            'ciRunId': '38812509760',
            'ciChecks': [
                {'name': name, 'status': 'COMPLETED', 'conclusion': 'SUCCESS'}
                for name in GENERATOR.CODEX_R03_OFFLINE_REQUIRED_CI_CHECKS
            ],
            'prNumber': 222,
            'claimId': 'profile-run-95-pr-222-aaaaaaaaaaaa-1792100000000',
            'mcpBundleSha256': 'c' * 64,
            'registrySha256': GENERATOR.CODEX_R03_OFFLINE_PROFILE_REGISTRY_SHA256,
            'selectionEvidenceSha256': hashlib.sha256(selection_bytes).hexdigest(),
            'toolName': GENERATOR.CODEX_R03_OFFLINE_TOOL_NAME,
            'argumentProfile': GENERATOR.CODEX_R03_OFFLINE_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR.CODEX_R03_OFFLINE_EXPECTED_ARGUMENTS_SHA256,
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(tool['description'].encode()).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'serverToolNames': [GENERATOR.CODEX_R03_OFFLINE_TOOL_NAME],
            'serverToolCount': 1,
            'networkMode': GENERATOR.CODEX_R03_OFFLINE_NETWORK_MODE,
            'mcpServerNames': ['bgk_r03_relations_v2'],
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'eventStreamParsed': True,
            'turnCompleted': True,
            'codexMcpToolEventCount': 1,
            'codexErrorItemCount': 2,
            'blockedWebSearchErrorItemCount': 2,
            'unexpectedCodexErrorItemCount': 0,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'allowedCallCount': 1,
            'deniedCallCount': 0,
            'answerCheckMethod': GENERATOR.CODEX_R03_OFFLINE_ANSWER_CHECK_METHOD,
            'answerSha256': hashlib.sha256(b'R03_SYNTHETIC_DIRECT_RELATION_MATRIX_READ').hexdigest(),
            'answerUtf8Bytes': len(b'R03_SYNTHETIC_DIRECT_RELATION_MATRIX_READ'),
            'answerChecks': {key: True for key in GENERATOR.CODEX_R03_OFFLINE_ANSWER_CHECK_FIELDS},
            'resultSummary': [
                {
                    'state': 'observed',
                    'sourceDirection': 'source_subject_to_returned_target',
                    'responseRowsObserved': 1,
                    'rowsReturned': 1,
                    'schemaDriftRows': 0,
                    'truncated': False,
                    'paginationAvailable': False,
                    'totalCountAvailable': False,
                    'completeness': 'not_provided_by_source',
                    'relationLabels': ['续篇'],
                },
            ],
            'offlineFixture': {
                'profile': GENERATOR.CODEX_R03_OFFLINE_NETWORK_MODE,
                'requestCount': 1,
                'relationRequestCount': 1,
                'rootRequestCount': 1,
                'intermediateRequestCount': 0,
                'duplicateRequestCount': 0,
                'unexpectedRequestCount': 0,
                'authorizationHeaderCount': 0,
                'expectedOperationsComplete': True,
            },
            'networkBoundary': {
                'liveBangumiApiRequestCount': 0,
                'rendererAssetRequestCount': 0,
                'fullCodexHarnessNetworkSandboxed': False,
            },
            'privacy': {
                'authProfile': 'anonymous', 'oauthAttempted': False, 'accountDataRead': False,
                'writesAttempted': False, 'communityRead': False, 'qqPipelineTested': False,
                'timClientTested': False, 'promptStored': False, 'answerStored': False,
                'rawFixtureRowsStored': False, 'rawToolResultStored': False,
                'artifactImageBytesStored': False, 'credentialsStored': False,
            },
            'runnerReceipt': {
                'schemaVersion': 1,
                'kind': 'r03-relations-offline-agent-mcp-runner-receipt-v2',
                'publicKeyBase64': 'AQ==',
                'publicKeySha256': 'd' * 64,
                'payload': {field: None for field in GENERATOR.CODEX_R03_OFFLINE_RECEIPT_PAYLOAD_FIELDS},
                'signature': 'AA==',
            },
        }

    def candidate_epoch_status(self, candidate_sha=None):
        branch = 'codex/epoch-run95-r03-direct-relations-offline-agent-mcp-matrix-v2-20261017'
        candidate_sha = candidate_sha or self.report['sourceRevision']
        base_sha = self.report['baseSha']
        reviewer_id = self.report['reviewerId']
        return {
            'run': {
                'number': 95,
                'state': {'state': 'EPOCH_ACTIVE', 'active_epoch_pr': self.report['prNumber']},
            },
            'epoch': {
                'github_state': 'OPEN',
                'pr_base_ref_name': 'master',
                'pr_base_sha': base_sha,
                'pr_head_ref_name': branch,
                'pr_head_sha': candidate_sha,
                'pr_is_draft': False,
                'state': {
                    'epoch_id': GENERATOR.CODEX_R03_OFFLINE_EPOCH_ID,
                    'pr_number': self.report['prNumber'],
                    'base_branch': 'master',
                    'base_sha': base_sha,
                    'candidate_sha': candidate_sha,
                    'branch': branch,
                    'review_history': [{
                        'candidate_sha': self.report['sourceRevision'],
                        'reviewed_base_sha': base_sha,
                        'reviewer_id': reviewer_id,
                        'verdict': 'PASS',
                    }],
                },
            },
        }

    def profile_harness_status(self, report_sha256):
        receipt = self.report['runnerReceipt']
        disposition = {
            'claimId': self.report['claimId'],
            'profileId': GENERATOR.CODEX_R03_OFFLINE_PROFILE_ID,
            'frontierId': 'R03',
            'epochId': GENERATOR.CODEX_R03_OFFLINE_EPOCH_ID,
            'runNumber': 95,
            'prNumber': self.report['prNumber'],
            'state': 'REPORT_WRITTEN',
            'sourceCandidateSha': self.report['sourceRevision'],
            'baseSha': self.report['baseSha'],
            'ciSha': self.report['sourceRevision'],
            'ciStatus': 'SUCCESS',
            'ciRunId': self.report['ciRunId'],
            'ciChecks': self.report['ciChecks'],
            'reviewerId': self.report['reviewerId'],
            'bundleSha256': self.report['mcpBundleSha256'],
            'registrySha256': GENERATOR.CODEX_R03_OFFLINE_PROFILE_REGISTRY_SHA256,
            'toolName': GENERATOR.CODEX_R03_OFFLINE_TOOL_NAME,
            'argumentProfile': GENERATOR.CODEX_R03_OFFLINE_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR.CODEX_R03_OFFLINE_EXPECTED_ARGUMENTS_SHA256,
            'reportWritten': True,
            'reportPath': GENERATOR.CODEX_R03_OFFLINE_REPORT_RELATIVE_PATH,
            'reportSha256': report_sha256,
            'retryAllowed': False,
            'runnerReceiptPublicKey': receipt['publicKeyBase64'],
            'runnerReceiptPublicKeySha256': receipt['publicKeySha256'],
            'runnerReceiptSha256': GENERATOR._canonical_json_sha256(receipt),
        }
        return {
            'state': 'REPORT_WRITTEN',
            'profile_id': GENERATOR.CODEX_R03_OFFLINE_PROFILE_ID,
            'pr': self.report['prNumber'],
            'tool_name': GENERATOR.CODEX_R03_OFFLINE_TOOL_NAME,
            'argument_profile': GENERATOR.CODEX_R03_OFFLINE_ARGUMENT_PROFILE,
            'expected_arguments_sha256': GENERATOR.CODEX_R03_OFFLINE_EXPECTED_ARGUMENTS_SHA256,
            'registry_sha256': GENERATOR.CODEX_R03_OFFLINE_PROFILE_REGISTRY_SHA256,
            'claim_label_present': True,
            'terminal_label_present': True,
            'disposition': disposition,
        }

    def test_candidate_binding_rejects_stale_candidate_base_review_and_scope(self):
        status = self.candidate_epoch_status()
        changed_paths = {GENERATOR.CODEX_R03_OFFLINE_REPORT_RELATIVE_PATH}
        bundle_sha256 = self.report['mcpBundleSha256']
        self.assertTrue(GENERATOR.codex_r03_offline_profile_candidate_binding_is_valid(
            self.report, status, changed_paths, bundle_sha256,
        ))

        wrong_head = json.loads(json.dumps(status))
        wrong_head['epoch']['pr_head_sha'] = 'e' * 40
        self.assertFalse(GENERATOR.codex_r03_offline_profile_candidate_binding_is_valid(
            self.report, wrong_head, changed_paths, bundle_sha256,
        ))

        stale_base = json.loads(json.dumps(status))
        stale_base['epoch']['state']['base_sha'] = 'f' * 40
        self.assertFalse(GENERATOR.codex_r03_offline_profile_candidate_binding_is_valid(
            self.report, stale_base, changed_paths, bundle_sha256,
        ))

        wrong_review = json.loads(json.dumps(status))
        wrong_review['epoch']['state']['review_history'][0]['reviewer_id'] = 'other-reviewer'
        self.assertFalse(GENERATOR.codex_r03_offline_profile_candidate_binding_is_valid(
            self.report, wrong_review, changed_paths, bundle_sha256,
        ))

        unrelated_change = {'apps/mcp/codex-one-tool-mcp-mcp-server.mjs'}
        self.assertFalse(GENERATOR.codex_r03_offline_profile_candidate_binding_is_valid(
            self.report, status, unrelated_change, bundle_sha256,
        ))
        self.assertFalse(GENERATOR.codex_r03_offline_profile_candidate_binding_is_valid(
            self.report, status, changed_paths, '0' * 64,
        ))

    def test_current_candidate_binding_accepts_only_an_evidence_refresh(self):
        candidate_sha = 'e' * 40
        status = self.candidate_epoch_status(candidate_sha)
        source_revision = self.report['sourceRevision']
        allowed_paths = '\n'.join([
            GENERATOR.CODEX_R03_OFFLINE_REPORT_RELATIVE_PATH,
            'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
            'docs/product/frontier-ledger.json',
        ]) + '\n'

        def git_result(*args, stdout='', returncode=0):
            return subprocess.CompletedProcess(args, returncode, stdout, '')

        def run_repository_git(root, *args):
            if args[:2] == ('merge-base', '--is-ancestor'):
                self.assertEqual(args[2:], (source_revision, candidate_sha))
                return git_result(*args)
            if args[:2] == ('diff', '--name-only'):
                return git_result(*args, stdout=allowed_paths)
            if args[:2] == ('status', '--porcelain=v1'):
                return git_result(*args)
            raise AssertionError(f'unexpected git command: {args}')

        with (
            patch.object(GENERATOR, 'ROOT', self.root),
            patch.object(GENERATOR, '_run_repository_git', side_effect=run_repository_git),
            patch.object(GENERATOR, 'codex_g26_candidate_bundle_sha256', return_value=self.report['mcpBundleSha256']),
        ):
            self.assertTrue(
                GENERATOR.codex_r03_offline_profile_report_candidate_binding_is_current(
                    self.report, status,
                ),
            )

            def unrelated_git(root, *args):
                if args[:2] == ('merge-base', '--is-ancestor'):
                    return git_result(*args)
                if args[:2] == ('diff', '--name-only'):
                    return git_result(*args, stdout=allowed_paths + 'apps/mcp/unrelated.mjs\n')
                if args[:2] == ('status', '--porcelain=v1'):
                    return git_result(*args)
                raise AssertionError(f'unexpected git command: {args}')

            with patch.object(GENERATOR, '_run_repository_git', side_effect=unrelated_git):
                self.assertFalse(
                    GENERATOR.codex_r03_offline_profile_report_candidate_binding_is_current(
                        self.report, status,
                    ),
                )

    def test_profile_disposition_binds_candidate_base_ci_and_reviewer(self):
        report_sha256 = 'f' * 64
        status = self.profile_harness_status(report_sha256)
        self.assertIsNotNone(GENERATOR.codex_r03_offline_profile_disposition_matches_report(
            self.report, status, report_sha256,
        ))
        for field, value in [
            ('sourceCandidateSha', 'e' * 40),
            ('baseSha', 'e' * 40),
            ('ciSha', 'e' * 40),
            ('ciStatus', 'FAILED'),
            ('ciRunId', '38812509761'),
            ('ciChecks', []),
            ('reviewerId', 'other-reviewer'),
        ]:
            changed = json.loads(json.dumps(status))
            changed['disposition'][field] = value
            self.assertIsNone(GENERATOR.codex_r03_offline_profile_disposition_matches_report(
                self.report, changed, report_sha256,
            ), field)

    def validate_report(self, report):
        self.report_path.write_text(json.dumps(report), encoding='utf-8')
        report_bytes = self.report_path.read_bytes()

        def validate_embedded_report(args, **kwargs):
            payload = json.loads(kwargs['input'])
            embedded = base64.b64decode(payload['reportBytesBase64'])
            return subprocess.CompletedProcess(
                args, 0,
                json.dumps({'passed': True, 'reportSha256': hashlib.sha256(embedded).hexdigest()}),
                '',
            )

        with (
            patch.object(GENERATOR, 'ROOT', self.root),
            patch.object(GENERATOR, 'LIVE_PROBE_DIR', self.root / 'docs/live-probes'),
            patch.object(GENERATOR, 'CATALOG', self.catalog_path),
            patch.object(GENERATOR, 'codex_r03_offline_profile_revision_has_implementation', return_value=True),
            patch.object(GENERATOR, 'codex_g26_candidate_bundle_sha256', return_value='c' * 64),
            patch.object(GENERATOR, 'codex_r03_offline_profile_report_candidate_binding_is_current', return_value=True),
            patch.object(GENERATOR, 'codex_r03_offline_profile_disposition_matches_report', return_value={'state': 'REPORT_WRITTEN'}),
            patch.object(GENERATOR.subprocess, 'run', side_effect=validate_embedded_report),
        ):
            return GENERATOR.codex_r03_offline_profile_report_is_valid(
                report, harness_status={'fixture': True}, report_path=self.report_path,
                epoch_status={'fixture': True},
            )

    def test_accepts_matrix_report_while_R03_remains_unassessed(self):
        with patch.object(GENERATOR, 'ROOT', self.root):
            self.assertTrue(GENERATOR.codex_r03_offline_frontier_is_unassessed(require_report_ref=True))
        self.assertTrue(self.validate_report(self.report))

    def test_rejects_scenario_credit_expanded_fixture_and_unclassified_errors(self):
        scenario_credit = json.loads(json.dumps(self.report))
        scenario_credit['scenarioId'] = 'R03'
        self.assertFalse(self.validate_report(scenario_credit))

        expanded_fixture = json.loads(json.dumps(self.report))
        expanded_fixture['offlineFixture']['requestCount'] = 3
        self.assertFalse(self.validate_report(expanded_fixture))

        unexpected_error = json.loads(json.dumps(self.report))
        unexpected_error['unexpectedCodexErrorItemCount'] = 1
        self.assertFalse(self.validate_report(unexpected_error))

    def test_routes_the_report_to_only_subject_relations_agent_mcp(self):
        self.report_path.write_text(json.dumps(self.report), encoding='utf-8')
        with (
            patch.object(GENERATOR, 'ROOT', self.root),
            patch.object(GENERATOR, 'LIVE_PROBE_DIR', self.root / 'docs/live-probes'),
            patch.object(GENERATOR, 'codex_r03_offline_profile_harness_status', return_value={'fixture': True}),
            patch.object(GENERATOR, 'codex_r03_offline_profile_epoch_harness_status', return_value={'fixture': True}),
            patch.object(GENERATOR, 'codex_r03_offline_profile_report_is_valid', return_value=True),
            patch.object(GENERATOR, 'codex_r03_offline_profile_report_matches_candidate_revision', return_value=True),
        ):
            sources = GENERATOR.model_mcp_e2e_sources(self.catalog)
        self.assertEqual(
            sources,
            {
                GENERATOR.CODEX_R03_OFFLINE_TOOL_NAME: {
                    GENERATOR.CODEX_R03_OFFLINE_REPORT_RELATIVE_PATH,
                },
            },
        )




class C03PersonSelectionEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.evidence = {
            'schemaVersion': 1,
            'evidenceKind': 'bangumi_official_public_person_selection_v1',
            'observedDate': '2026-10-14',
            'sourceEndpoint': 'https://api.bgm.tv/v0/search/persons',
            'method': 'POST',
            'careerFilter': 'seiyu',
            'requestLimit': 5,
            'requestOffset': 0,
            'responseStatus': 200,
            'responseCount': 5,
            'requestBodySha256': 'a' * 64,
            'responseBodySha256': 'b' * 64,
            'selectionRule': 'first-two-returned-results-with-seiyu-career',
            'selected': [
                {'personId': call['arguments']['personId'], 'resultIndex': index,
                 'careerIncludesSeiyu': True}
                for index, call in enumerate(GENERATOR.CODEX_C03_EXPECTED_CALLS)
            ],
            'authenticationUsed': False,
            'oauthAttempted': False,
            'accountDataRead': False,
            'namesStored': False,
            'rawResponseStored': False,
        }

    def test_accepts_a_current_bounded_voice_actor_lookup(self):
        self.assertTrue(GENERATOR.codex_c03_person_selection_evidence_is_valid(self.evidence))
        self.assertTrue(GENERATOR.codex_c03_person_selection_file_is_valid())

    def test_rejects_a_different_person_or_unverified_career(self):
        changed_id = json.loads(json.dumps(self.evidence))
        changed_id['selected'][0]['personId'] += 1
        self.assertFalse(GENERATOR.codex_c03_person_selection_evidence_is_valid(changed_id))

        unverified_career = json.loads(json.dumps(self.evidence))
        unverified_career['selected'][1]['careerIncludesSeiyu'] = False
        self.assertFalse(GENERATOR.codex_c03_person_selection_evidence_is_valid(unverified_career))

    def test_rejects_authentication_or_raw_person_data(self):
        authenticated = json.loads(json.dumps(self.evidence))
        authenticated['authenticationUsed'] = True
        self.assertFalse(GENERATOR.codex_c03_person_selection_evidence_is_valid(authenticated))

        raw_data = json.loads(json.dumps(self.evidence))
        raw_data['namesStored'] = True
        self.assertFalse(GENERATOR.codex_c03_person_selection_evidence_is_valid(raw_data))


class C03ReportValidationRulesTests(unittest.TestCase):
    def setUp(self):
        candidate = 'a' * 40
        base = 'b' * 40
        self.report = {
            'sourceRevision': candidate,
            'baseSha': base,
            'prNumber': 162,
            'mcpBundleSha256': 'c' * 64,
        }
        self.status = {
            'run': {
                'number': 95,
                'state': {'state': 'EPOCH_ACTIVE', 'active_epoch_pr': 162},
            },
            'epoch': {
                'github_state': 'OPEN',
                'state': {
                    'epoch_id': GENERATOR.CODEX_C03_EPOCH_ID,
                    'pr_number': 162,
                    'base_branch': 'master',
                    'base_sha': base,
                    'candidate_sha': candidate,
                    'branch': 'codex/c03',
                },
                'pr_head_sha': candidate,
                'pr_head_ref_name': 'codex/c03',
                'pr_base_ref_name': 'master',
                'pr_base_sha': base,
                'pr_is_draft': False,
            },
        }
        self.changed_paths = [
            GENERATOR.CODEX_C03_REPORT_RELATIVE_PATH,
            'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
            'docs/product/frontier-ledger.json',
        ]

    def test_accepts_current_candidate_with_evidence_only_refresh(self):
        self.assertTrue(
            GENERATOR.codex_c03_profile_candidate_binding_is_valid(
                self.report, self.status, self.changed_paths, self.report['mcpBundleSha256'],
            ),
        )
        self.assertTrue(
            GENERATOR.codex_c03_profile_evidence_refresh_paths_are_valid(self.changed_paths),
        )

        merged = json.loads(json.dumps(self.status))
        merged['run']['state']['active_epoch_pr'] = 163
        merged['epoch']['github_state'] = 'MERGED'
        merged['epoch']['state']['state'] = 'MERGED'
        merged['epoch']['pr_base_sha'] = 'd' * 40
        merged['epoch']['state']['review_history'] = [{
            'candidate_sha': self.status['epoch']['state']['candidate_sha'],
            'reviewed_base_sha': self.report['baseSha'],
            'verdict': 'PASS',
        }]
        self.assertTrue(
            GENERATOR.codex_c03_profile_candidate_binding_is_valid(
                self.report, merged, self.changed_paths, self.report['mcpBundleSha256'],
            ),
        )

    def test_rejects_runtime_changes_stale_heads_or_changed_bundle(self):
        runtime_paths = [
            GENERATOR.CODEX_C03_REPORT_RELATIVE_PATH,
            'apps/mcp/codex-one-tool-mcp-server.mjs',
        ]
        self.assertFalse(
            GENERATOR.codex_c03_profile_candidate_binding_is_valid(
                self.report, self.status, runtime_paths, self.report['mcpBundleSha256'],
            ),
        )

        stale = json.loads(json.dumps(self.status))
        stale['epoch']['pr_head_sha'] = 'd' * 40
        self.assertFalse(
            GENERATOR.codex_c03_profile_candidate_binding_is_valid(
                self.report, stale, self.changed_paths, self.report['mcpBundleSha256'],
            ),
        )
        self.assertFalse(
            GENERATOR.codex_c03_profile_candidate_binding_is_valid(
                self.report, self.status, self.changed_paths, 'e' * 64,
            ),
        )

    def test_calendar_window_must_be_real_and_exactly_36_calendar_months(self):
        valid = {
            'months': 36,
            'start': '2023-11-01',
            'end': '2026-10-14',
        }
        self.assertTrue(GENERATOR.codex_c03_profile_calendar_window_is_valid(valid, 36))
        self.assertFalse(
            GENERATOR.codex_c03_profile_calendar_window_is_valid(
                {**valid, 'end': '2026-02-30'}, 36,
            ),
        )
        self.assertFalse(
            GENERATOR.codex_c03_profile_calendar_window_is_valid(
                {**valid, 'start': '2023-12-01'}, 36,
            ),
        )

    def test_every_missing_coverage_counter_makes_a_complete_result_partial(self):
        coverage = {
            'relationRowsObserved': 0,
            'relationRowsSelected': 0,
            'relationRowsDroppedAtLimit': 0,
            'subjectDetailsSucceeded': 0,
            'subjectDetailsFailed': 0,
            'rowsEligible': 0,
            'rowsReturned': 0,
            'outputTruncated': False,
            'unknownRoleRows': 0,
            'truncated': False,
        }
        actor = {'state': 'complete', 'coverage': coverage}
        self.assertFalse(GENERATOR.codex_c03_profile_actor_coverage_is_partial(actor))
        for field in coverage:
            partial_actor = {'state': 'complete', 'coverage': {**coverage, field: None}}
            self.assertTrue(
                GENERATOR.codex_c03_profile_actor_coverage_is_partial(partial_actor),
                field,
            )
        self.assertTrue(
            GENERATOR.codex_c03_profile_actor_coverage_is_partial(
                {'state': 'complete', 'coverage': {key: value for key, value in coverage.items() if key != 'relationRowsSelected'}},
            ),
        )


class C03ReportAcceptanceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix='c03-report-acceptance-test-')
        self.root = Path(self.temp_dir.name)
        self.report_path = self.root / GENERATOR.CODEX_C03_REPORT_RELATIVE_PATH
        self.report_path.parent.mkdir(parents=True)
        self.original_root = GENERATOR.ROOT
        GENERATOR.ROOT = self.root

    def tearDown(self):
        GENERATOR.ROOT = self.original_root
        self.temp_dir.cleanup()

    def build_report(self):
        candidate = 'a' * 40
        actors = []
        for call in GENERATOR.CODEX_C03_EXPECTED_CALLS:
            actors.append({
                'personId': call['arguments']['personId'],
                'state': 'complete',
                'window': {
                    'months': 36,
                    'start': '2023-11-01',
                    'end': '2026-10-14',
                    'asOfSemantics': 'calendar_months_ending_on_as_of_date',
                },
                'uniqueSubjects': 0,
                'roleCounts': {'main': 0, 'support': 0, 'unknown': 0},
                'observedRows': [],
                'coverage': {
                    'relationRowsObserved': 0,
                    'relationRowsSelected': 0,
                    'relationRowsDroppedAtLimit': 0,
                    'subjectDetailsSucceeded': 0,
                    'subjectDetailsFailed': 0,
                    'rowsEligible': 0,
                    'rowsReturned': 0,
                    'outputTruncated': False,
                    'unknownRoleRows': 0,
                    'truncated': False,
                },
            })
        actors[0]['coverage']['rowsReturned'] = None
        return {
            'schemaVersion': 1,
            'evidenceKind': GENERATOR.CODEX_C03_EVIDENCE_KIND,
            'runNumber': 95,
            'frontierId': 'C03',
            'scenarioId': 'C03',
            'epochId': GENERATOR.CODEX_C03_EPOCH_ID,
            'profileId': GENERATOR.CODEX_C03_PROFILE_ID,
            'profile': 'codex-luna-max-agent-mcp-profile-v1',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'reviewerId': 'gpt-6-luna-max-run95-pr162-round1',
            'codexCliVersion': '1.2.3',
            'sourceRevision': candidate,
            'baseSha': 'b' * 40,
            'ciSha': candidate,
            'ciStatus': 'SUCCESS',
            'prNumber': 162,
            'claimId': 'c03-claim-fixture',
            'mcpBundleSha256': 'c' * 64,
            'registrySha256': GENERATOR.CODEX_AGENT_MCP_PROFILE_REGISTRY_SHA256,
            'toolName': GENERATOR.CODEX_C03_TOOL_NAME,
            'argumentProfile': GENERATOR.CODEX_C03_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR.CODEX_C03_EXPECTED_ARGUMENTS_SHA256,
            'catalogSha256': 'd' * 64,
            'toolDescriptionSha256': 'e' * 64,
            'inputSchemaSha256': 'f' * 64,
            'serverToolNames': [GENERATOR.CODEX_C03_TOOL_NAME],
            'serverToolCount': 1,
            'mcpServerNames': ['bgk_c03_profile'],
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'eventStreamParsed': True,
            'turnCompleted': True,
            'codexMcpToolEventCount': len(GENERATOR.CODEX_C03_EXPECTED_CALLS),
            'codexErrorItemCount': 0,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'allowedCallCount': len(GENERATOR.CODEX_C03_EXPECTED_CALLS),
            'deniedCallCount': 0,
            'answerCheckMethod': GENERATOR.CODEX_C03_ANSWER_CHECK_METHOD,
            'answerSha256': '1' * 64,
            'answerUtf8Bytes': 1,
            'answerChecks': {field: True for field in GENERATOR.CODEX_C03_ANSWER_CHECK_FIELDS},
            'actors': actors,
            'comparison': {
                'observedSubjectIds': [[], []],
                'sharedSubjectIds': [],
                'observedCommonCount': 0,
                'observedMainRoleShares': [
                    {
                        'personId': actor['personId'],
                        'numerator': 0,
                        'denominator': 0,
                        'ratio': None,
                        'state': 'complete',
                    }
                    for actor in actors
                ],
                'coveragePartial': True,
            },
            'privacy': {field: False for field in GENERATOR.CODEX_C03_PRIVACY_FIELDS},
            'runnerReceipt': {},
        }

    def validate_report(self, report):
        self.report_path.write_text(json.dumps(report), encoding='utf-8')

        def validate_embedded_report(args, **kwargs):
            payload = json.loads(kwargs['input'])
            report_bytes = base64.b64decode(payload['reportBytesBase64'])
            return subprocess.CompletedProcess(
                args,
                0,
                json.dumps({
                    'passed': True,
                    'reportSha256': hashlib.sha256(report_bytes).hexdigest(),
                }),
                '',
            )

        with (
            patch.object(GENERATOR, 'codex_c03_profile_revision_has_implementation', return_value=True),
            patch.object(GENERATOR, 'codex_c03_person_selection_file_is_valid', return_value=True),
            patch.object(GENERATOR, 'codex_c03_profile_report_candidate_binding_is_current', return_value=True),
            patch.object(GENERATOR, 'codex_c03_profile_disposition_matches_report', return_value={'state': 'REPORT_WRITTEN'}),
            patch.object(GENERATOR.subprocess, 'run', side_effect=validate_embedded_report),
        ):
            return GENERATOR.codex_c03_profile_report_is_valid(
                report,
                harness_status={'fixture': True},
                report_path=self.report_path,
                epoch_status={'fixture': True},
            )

    def test_accepts_unknown_rows_returned_as_partial_report_coverage(self):
        report = self.build_report()

        self.assertTrue(report['comparison']['coveragePartial'])
        self.assertTrue(self.validate_report(report))

    def test_rejects_known_rows_returned_count_that_disagrees_with_observed_rows(self):
        report = self.build_report()
        report['actors'][0]['coverage']['rowsReturned'] = 1

        self.assertFalse(self.validate_report(report))


class P07ProfileEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.original_root = GENERATOR.ROOT
        self.temp_dir = tempfile.TemporaryDirectory(prefix='p07-profile-evidence-test-')
        GENERATOR.ROOT = Path(self.temp_dir.name)
        self.frontier_path = GENERATOR.ROOT / 'docs/product/frontier-ledger.json'
        self.frontier_path.parent.mkdir(parents=True, exist_ok=True)
        self.frontier = {
            'records': [{
                'id': 'P07',
                'status': 'PARTIAL',
                'source_refs': [
                    GENERATOR.CODEX_P07_SELECTION_EVIDENCE_RELATIVE_PATH,
                    GENERATOR.CODEX_P07_REPORT_RELATIVE_PATH,
                ],
            }],
        }
        self.frontier_path.write_text(json.dumps(self.frontier), encoding='utf-8')

    def tearDown(self):
        GENERATOR.ROOT = self.original_root
        self.temp_dir.cleanup()

    def test_profile_is_one_fixed_anonymous_public_quarter_sample(self):
        profile = GENERATOR.CODEX_P07_PROFILE

        self.assertEqual(profile['id'], 'p07-person-season-distribution-agent-mcp-v1')
        self.assertEqual(profile['frontierId'], 'P07')
        self.assertEqual(profile['model'], 'gpt-6-luna')
        self.assertEqual(profile['reasoningEffort'], 'max')
        self.assertEqual(len(profile['calls']), 1)
        self.assertEqual(profile['calls'][0]['arguments'], {
            'personId': 3474,
            'kind': 'staff',
            'media': 'anime',
            'windowMonths': 36,
            'maxRelations': 48,
            'maxSubjectDetails': 16,
            'maxRows': 8,
        })

    def test_p07_scenario_credit_requires_partial_status_and_report_reference(self):
        self.assertTrue(GENERATOR.codex_p07_frontier_is_partial(require_report_ref=True))
        self.frontier['records'][0]['status'] = 'UNASSESSED'
        self.frontier_path.write_text(json.dumps(self.frontier), encoding='utf-8')
        self.assertFalse(GENERATOR.codex_p07_frontier_is_partial(require_report_ref=True))
        self.frontier['records'][0]['status'] = 'PARTIAL'
        self.frontier['records'][0]['source_refs'].remove(GENERATOR.CODEX_P07_REPORT_RELATIVE_PATH)
        self.frontier_path.write_text(json.dumps(self.frontier), encoding='utf-8')
        self.assertFalse(GENERATOR.codex_p07_frontier_is_partial(require_report_ref=True))


class S05ProfileEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.original_root = GENERATOR.ROOT
        self.temp_dir = tempfile.TemporaryDirectory(prefix='s05-profile-evidence-test-')
        GENERATOR.ROOT = Path(self.temp_dir.name)
        self.frontier_path = GENERATOR.ROOT / 'docs/product/frontier-ledger.json'
        self.frontier_path.parent.mkdir(parents=True, exist_ok=True)
        self.frontier = {
            'records': [{
                'id': 'S05',
                'status': 'PARTIAL',
                'source_refs': [
                    GENERATOR.CODEX_S05_SELECTION_EVIDENCE_RELATIVE_PATH,
                    GENERATOR.CODEX_S05_REPORT_RELATIVE_PATH,
                ],
            }],
        }
        self.frontier_path.write_text(json.dumps(self.frontier), encoding='utf-8')

    def tearDown(self):
        GENERATOR.ROOT = self.original_root
        self.temp_dir.cleanup()

    def test_s05_profile_is_one_fixed_bounded_voice_activity_call(self):
        profile = GENERATOR.CODEX_S05_PROFILE
        self.assertEqual(profile['id'], 's05-bounded-non-tv-voice-agent-mcp-v1')
        self.assertEqual(profile['frontierId'], 'S05')
        self.assertEqual(profile['model'], 'gpt-6-luna')
        self.assertEqual(profile['reasoningEffort'], 'max')
        self.assertEqual(len(profile['calls']), 1)
        self.assertEqual(profile['calls'][0]['arguments'], {
            'personId': 3474,
            'kind': 'voice',
            'media': 'anime',
            'windowMonths': 6,
            'maxRelations': 48,
            'maxSubjectDetails': 16,
            'maxRows': 8,
        })

    def test_s05_partial_credit_requires_positive_report_reference(self):
        self.assertTrue(GENERATOR.codex_s05_frontier_is_partial(require_report_ref=True))
        self.frontier['records'][0]['status'] = 'UNASSESSED'
        self.frontier_path.write_text(json.dumps(self.frontier), encoding='utf-8')
        self.assertFalse(GENERATOR.codex_s05_frontier_is_partial(require_report_ref=True))
        self.frontier['records'][0]['status'] = 'PARTIAL'
        self.frontier['records'][0]['source_refs'].remove(GENERATOR.CODEX_S05_REPORT_RELATIVE_PATH)
        self.frontier_path.write_text(json.dumps(self.frontier), encoding='utf-8')
        self.assertFalse(GENERATOR.codex_s05_frontier_is_partial(require_report_ref=True))

    def test_s05_report_refresh_paths_are_closed_to_the_exact_evidence_scope(self):
        self.assertTrue(GENERATOR.codex_s05_profile_evidence_refresh_paths_are_valid([
            GENERATOR.CODEX_S05_REPORT_RELATIVE_PATH,
            'docs/product/frontier-ledger.json',
            'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
        ]))
        self.assertFalse(GENERATOR.codex_s05_profile_evidence_refresh_paths_are_valid([
            GENERATOR.CODEX_S05_REPORT_RELATIVE_PATH,
            'README.md',
        ]))


class S01ProfileEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.original_root = GENERATOR.ROOT
        self.temp_dir = tempfile.TemporaryDirectory(prefix='s01-profile-evidence-test-')
        GENERATOR.ROOT = Path(self.temp_dir.name)
        self.frontier_path = GENERATOR.ROOT / 'docs/product/frontier-ledger.json'
        self.frontier_path.parent.mkdir(parents=True, exist_ok=True)
        self.frontier = {
            'records': [{
                'id': 'S01',
                'status': 'PARTIAL',
                'source_refs': [
                    GENERATOR.CODEX_S01_SELECTION_EVIDENCE_RELATIVE_PATH,
                    GENERATOR.CODEX_S01_REPORT_RELATIVE_PATH,
                ],
            }],
        }
        self.frontier_path.write_text(json.dumps(self.frontier), encoding='utf-8')

    def tearDown(self):
        GENERATOR.ROOT = self.original_root
        self.temp_dir.cleanup()

    def test_s01_profile_is_one_fixed_bounded_annual_tv_voice_call(self):
        profile = GENERATOR.CODEX_S01_PROFILE
        self.assertEqual(profile['id'], 's01-annual-tv-voice-agent-mcp-v1')
        self.assertEqual(profile['frontierId'], 'S01')
        self.assertEqual(profile['model'], 'gpt-6-luna')
        self.assertEqual(profile['reasoningEffort'], 'max')
        self.assertEqual(len(profile['calls']), 1)
        self.assertEqual(profile['calls'][0]['arguments'], {
            'personId': 5745,
            'kind': 'voice',
            'media': 'tv',
            'windowMonths': 36,
            'maxRelations': 48,
            'maxSubjectDetails': 16,
            'maxRows': 8,
        })
        self.assertIn('publicRequestScope', GENERATOR.CODEX_S01_REPORT_FIELDS)
        self.assertIn('publicRequestScopeSha256', GENERATOR.CODEX_S01_RECEIPT_PAYLOAD_FIELDS)

    def test_s01_partial_credit_requires_report_reference_and_never_upgrades_status(self):
        self.assertTrue(GENERATOR.codex_s01_frontier_is_partial(require_report_ref=True))
        self.frontier['records'][0]['status'] = 'DELIVERED'
        self.frontier_path.write_text(json.dumps(self.frontier), encoding='utf-8')
        self.assertFalse(GENERATOR.codex_s01_frontier_is_partial(require_report_ref=True))
        self.frontier['records'][0]['status'] = 'PARTIAL'
        self.frontier['records'][0]['source_refs'].remove(GENERATOR.CODEX_S01_REPORT_RELATIVE_PATH)
        self.frontier_path.write_text(json.dumps(self.frontier), encoding='utf-8')
        self.assertFalse(GENERATOR.codex_s01_frontier_is_partial(require_report_ref=True))

    def test_s01_report_refresh_paths_are_closed_to_its_evidence_scope(self):
        self.assertTrue(GENERATOR.codex_s01_profile_evidence_refresh_paths_are_valid([
            GENERATOR.CODEX_S01_REPORT_RELATIVE_PATH,
            'docs/product/frontier-ledger.json',
            'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
        ]))
        self.assertFalse(GENERATOR.codex_s01_profile_evidence_refresh_paths_are_valid([
            GENERATOR.CODEX_S01_REPORT_RELATIVE_PATH,
            'README.md',
        ]))


class R02PositiveDirectRelationsProfileReportValidationTests(unittest.TestCase):
    def setUp(self):
        self.original_root = GENERATOR.ROOT
        self.temp_dir = tempfile.TemporaryDirectory(prefix='r02-positive-profile-evidence-test-')
        GENERATOR.ROOT = Path(self.temp_dir.name)
        self.report_path = GENERATOR.ROOT / GENERATOR.CODEX_R02_REPORT_RELATIVE_PATH
        self.report_path.parent.mkdir(parents=True, exist_ok=True)
        self.selection_path = GENERATOR.ROOT / GENERATOR.CODEX_R02_SELECTION_EVIDENCE_RELATIVE_PATH
        self.selection_path.parent.mkdir(parents=True, exist_ok=True)
        self.selection_path.write_text('R02 remains partial; direct positive sample only.\n', encoding='utf-8')
        self.frontier_path = GENERATOR.ROOT / 'docs/product/frontier-ledger.json'
        self.frontier_path.parent.mkdir(parents=True, exist_ok=True)
        self.frontier_path.write_text(json.dumps({
            'records': [{
                'id': 'R02', 'status': 'PARTIAL',
                'source_refs': [
                    GENERATOR.CODEX_R02_SELECTION_EVIDENCE_RELATIVE_PATH,
                    GENERATOR.CODEX_R02_REPORT_RELATIVE_PATH,
                ],
            }],
        }), encoding='utf-8')
        self.catalog_path = GENERATOR.ROOT / 'docs/tool-catalog.json'
        self.catalog_path.parent.mkdir(parents=True, exist_ok=True)
        self.catalog = [{
            'name': GENERATOR.CODEX_R02_TOOL_NAME,
            'auth': 'none',
            'risk': 'read',
            'description': 'Bounded direct relation sample.',
            'inputSchema': {'type': 'object', 'required': ['subjectId']},
        }]
        self.catalog_path.write_text(json.dumps(self.catalog), encoding='utf-8')
        self.report = self.build_report()

    def tearDown(self):
        GENERATOR.ROOT = self.original_root
        self.temp_dir.cleanup()

    def build_report(self):
        catalog_bytes = self.catalog_path.read_bytes()
        selection_bytes = self.selection_path.read_bytes()
        tool = self.catalog[0]
        return {
            'schemaVersion': 1,
            'evidenceKind': GENERATOR.CODEX_R02_EVIDENCE_KIND,
            'runNumber': 95,
            'frontierId': 'R02',
            'scenarioId': None,
            'acceptanceScope': 'agent-mcp-matrix-only',
            'epochId': GENERATOR.CODEX_R02_EPOCH_ID,
            'profileId': GENERATOR.CODEX_R02_PROFILE_ID,
            'profile': 'codex-luna-max-public-agent-mcp-matrix-v1',
            'model': 'gpt-6-luna',
            'reasoningEffort': 'max',
            'reviewerId': 'gpt-6-luna-max-run95-pr222-round1',
            'codexCliVersion': '0.163.0',
            'observedAt': '2026-10-16T05:00:00.000Z',
            'sourceRevision': 'a' * 40,
            'baseSha': 'b' * 40,
            'ciSha': 'a' * 40,
            'ciStatus': 'SUCCESS',
            'ciRunId': '38812509760',
            'ciChecks': [
                {'name': name, 'status': 'COMPLETED', 'conclusion': 'SUCCESS'}
                for name in GENERATOR.CODEX_R02_REQUIRED_CI_CHECKS
            ],
            'prNumber': 222,
            'claimId': 'profile-run-95-pr-222-aaaaaaaaaaaa-1792100000000',
            'mcpBundleSha256': 'c' * 64,
            'registrySha256': GENERATOR.CODEX_R02_PROFILE_REGISTRY_SHA256,
            'selectionEvidenceSha256': hashlib.sha256(selection_bytes).hexdigest(),
            'toolName': GENERATOR.CODEX_R02_TOOL_NAME,
            'argumentProfile': GENERATOR.CODEX_R02_ARGUMENT_PROFILE,
            'expectedArgumentsSha256': GENERATOR.CODEX_R02_EXPECTED_ARGUMENTS_SHA256,
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
            'toolDescriptionSha256': hashlib.sha256(tool['description'].encode()).hexdigest(),
            'inputSchemaSha256': GENERATOR._canonical_json_sha256(tool['inputSchema']),
            'serverToolNames': [GENERATOR.CODEX_R02_TOOL_NAME],
            'serverToolCount': 1,
            'networkMode': GENERATOR.CODEX_R02_NETWORK_MODE,
            'mcpServerNames': [GENERATOR.CODEX_R02_SERVER_ID],
            'processExitCode': 0,
            'resultStatus': 'SUCCESS',
            'eventStreamParsed': True,
            'turnCompleted': True,
            'codexMcpToolEventCount': 3,
            'codexErrorItemCount': 2,
            'blockedWebSearchErrorItemCount': 2,
            'unexpectedCodexErrorItemCount': 0,
            'nonMcpToolEventCount': 0,
            'nonMcpToolTypes': [],
            'shellToolCallCount': 0,
            'allowedCallCount': 3,
            'deniedCallCount': 0,
            'answerCheckMethod': GENERATOR.CODEX_R02_ANSWER_CHECK_METHOD,
            'answerSha256': hashlib.sha256(b'R02_POSITIVE_DIRECT_RELATIONS_READ').hexdigest(),
            'answerUtf8Bytes': len(b'R02_POSITIVE_DIRECT_RELATIONS_READ'),
            'answerChecks': {key: True for key in GENERATOR.CODEX_R02_ANSWER_CHECK_FIELDS},
            'resultSummary': GENERATOR.CODEX_R02_RESULT_SUMMARIES,
            'publicRequestScope': GENERATOR.CODEX_R02_PUBLIC_REQUEST_SCOPE,
            'networkBoundary': GENERATOR.CODEX_R02_NETWORK_BOUNDARY,
            'privacy': GENERATOR.CODEX_R02_PRIVACY,
            'runnerReceipt': {
                'schemaVersion': 1,
                'kind': 'r02-positive-direct-relations-agent-mcp-runner-receipt-v1',
                'publicKeyBase64': 'AQ==',
                'publicKeySha256': 'd' * 64,
                'payload': {field: None for field in GENERATOR.CODEX_R02_RECEIPT_PAYLOAD_FIELDS},
                'signature': 'AA==',
            },
        }

    def validate_report(self, report):
        self.report_path.write_text(json.dumps(report), encoding='utf-8')
        report_bytes = self.report_path.read_bytes()

        def validate_embedded_report(args, **kwargs):
            payload = json.loads(kwargs['input'])
            embedded = base64.b64decode(payload['reportBytesBase64'])
            return subprocess.CompletedProcess(
                args, 0,
                json.dumps({'passed': True, 'reportSha256': hashlib.sha256(embedded).hexdigest()}),
                '',
            )

        with (
            patch.object(GENERATOR, 'ROOT', Path(self.temp_dir.name)),
            patch.object(GENERATOR, 'LIVE_PROBE_DIR', Path(self.temp_dir.name) / 'docs/live-probes'),
            patch.object(GENERATOR, 'CATALOG', self.catalog_path),
            patch.object(GENERATOR, 'codex_r02_profile_revision_has_implementation', return_value=True),
            patch.object(GENERATOR, 'codex_g26_candidate_bundle_sha256', return_value='c' * 64),
            patch.object(GENERATOR, 'codex_r02_profile_report_candidate_binding_is_current', return_value=True),
            patch.object(GENERATOR, 'codex_r02_profile_disposition_matches_report', return_value={'state': 'REPORT_WRITTEN'}),
            patch.object(GENERATOR.subprocess, 'run', side_effect=validate_embedded_report),
        ):
            return GENERATOR.codex_r02_profile_report_is_valid(
                report, harness_status={'fixture': True}, report_path=self.report_path,
                epoch_status={'fixture': True},
            )

    def test_accepts_exact_three_call_report_for_only_the_agent_mcp_cell(self):
        self.assertTrue(GENERATOR.codex_r02_frontier_is_partial(require_report_ref=True))
        self.assertTrue(self.validate_report(self.report))

    def test_rejects_scenario_credit_bad_request_counters_and_changed_positive_rows(self):
        scenario_credit = json.loads(json.dumps(self.report))
        scenario_credit['scenarioId'] = 'R02'
        self.assertFalse(self.validate_report(scenario_credit))

        credentialed = json.loads(json.dumps(self.report))
        credentialed['publicRequestScope']['credentialHeaderCount'] = 1
        self.assertFalse(self.validate_report(credentialed))

        wrong_label = json.loads(json.dumps(self.report))
        wrong_label['resultSummary'][0]['directRelations'][0]['relationLabel'] = '续集'
        self.assertFalse(self.validate_report(wrong_label))

    def test_routes_a_valid_report_to_only_subject_relations_agent_mcp(self):
        self.report_path.write_text(json.dumps(self.report), encoding='utf-8')
        with (
            patch.object(GENERATOR, 'ROOT', Path(self.temp_dir.name)),
            patch.object(GENERATOR, 'LIVE_PROBE_DIR', Path(self.temp_dir.name) / 'docs/live-probes'),
            patch.object(GENERATOR, 'CATALOG', self.catalog_path),
            patch.object(GENERATOR, 'codex_r02_profile_harness_status', return_value={'fixture': True}),
            patch.object(GENERATOR, 'codex_r02_profile_epoch_harness_status', return_value={'fixture': True}),
            patch.object(GENERATOR, 'codex_r02_profile_report_is_valid', return_value=True),
            patch.object(GENERATOR, 'codex_r02_profile_report_matches_candidate_revision', return_value=True),
        ):
            sources = GENERATOR.model_mcp_e2e_sources(self.catalog)
        self.assertEqual(sources, {
            GENERATOR.CODEX_R02_TOOL_NAME: {GENERATOR.CODEX_R02_REPORT_RELATIVE_PATH},
        })


class FreshQuerySubjectsPublicMatrixProfileTests(unittest.TestCase):
    def setUp(self):
        self.original_root = GENERATOR.ROOT
        self.temp_dir = tempfile.TemporaryDirectory(prefix='fresh-query-subjects-matrix-test-')
        GENERATOR.ROOT = Path(self.temp_dir.name)
        self.frontier_path = GENERATOR.ROOT / 'docs/product/frontier-ledger.json'
        self.frontier_path.parent.mkdir(parents=True, exist_ok=True)
        self.frontier = {
            'records': [{
                'id': 'G14',
                'status': 'PARTIAL',
                'source_refs': [
                    GENERATOR.CODEX_QUERY_SUBJECTS_FRESH_PUBLIC_SELECTION_EVIDENCE_RELATIVE_PATH,
                ],
            }],
        }
        self.frontier_path.write_text(json.dumps(self.frontier), encoding='utf-8')

    def tearDown(self):
        GENERATOR.ROOT = self.original_root
        self.temp_dir.cleanup()

    def test_profile_is_one_fresh_public_matrix_call_and_does_not_close_g14(self):
        profile = GENERATOR.CODEX_QUERY_SUBJECTS_FRESH_PUBLIC_PROFILE
        self.assertEqual(profile['id'], 'query-subjects-fresh-public-matrix-v2')
        self.assertEqual(profile['frontierId'], 'G14')
        self.assertEqual(profile['acceptanceScope'], 'agent-mcp-matrix-only')
        self.assertEqual(profile['model'], 'gpt-6-luna')
        self.assertEqual(profile['reasoningEffort'], 'max')
        self.assertEqual(len(profile['calls']), 1)
        self.assertEqual(profile['calls'][0]['toolName'], 'bangumi.query_subjects')
        self.assertEqual(profile['calls'][0]['arguments']['keyword'], '天空之城')
        self.assertTrue(GENERATOR.codex_query_subjects_fresh_public_frontier_is_partial())
        self.frontier['records'][0]['status'] = 'CLOSED'
        self.frontier_path.write_text(json.dumps(self.frontier), encoding='utf-8')
        self.assertFalse(GENERATOR.codex_query_subjects_fresh_public_frontier_is_partial())

    def test_python_and_node_report_schemas_match_and_registry_markers_are_present(self):
        report_script = (
            self.original_root / 'scripts/acceptance/write-query-subjects-fresh-public-agent-mcp-v2-report.mjs'
        ).read_text(encoding='utf-8')
        keys_match = re.search(r'const REQUIRED_REPORT_KEYS = \[(.*?)\n\];', report_script, re.S)
        self.assertIsNotNone(keys_match)
        node_keys = set(re.findall(r"'([^']+)'", keys_match.group(1)))
        self.assertEqual(node_keys, GENERATOR.CODEX_QUERY_SUBJECTS_FRESH_PUBLIC_REPORT_FIELDS)
        for relative_path, markers in GENERATOR.CODEX_QUERY_SUBJECTS_FRESH_PUBLIC_PROFILE_IMPLEMENTATION_MARKERS.items():
            body = (self.original_root / relative_path).read_text(encoding='utf-8')
            for marker in markers:
                self.assertIn(marker, body, f'{relative_path}: {marker}')

    def test_report_binding_allows_only_the_current_candidate_or_evidence_only_refresh(self):
        source_sha = 'a' * 40
        candidate_sha = 'b' * 40
        base_sha = 'c' * 40
        reviewer_id = 'gpt-6-luna-max-run95-pr241-round1'
        report = {
            'prNumber': 241,
            'sourceRevision': source_sha,
            'baseSha': base_sha,
            'reviewerId': reviewer_id,
            'mcpBundleSha256': 'd' * 64,
        }
        branch = 'codex/epoch-run95-query-subjects-fresh-public-matrix-v2-20261019'
        epoch_status = {
            'run': {
                'number': 95,
                'state': {'state': 'EPOCH_ACTIVE', 'active_epoch_pr': 241},
            },
            'epoch': {
                'github_state': 'OPEN',
                'pr_base_ref_name': 'master',
                'pr_base_sha': base_sha,
                'pr_head_ref_name': branch,
                'pr_head_sha': candidate_sha,
                'pr_is_draft': False,
                'state': {
                    'epoch_id': GENERATOR.CODEX_QUERY_SUBJECTS_FRESH_PUBLIC_EPOCH_ID,
                    'pr_number': 241,
                    'branch': branch,
                    'base_branch': 'master',
                    'base_sha': base_sha,
                    'candidate_sha': candidate_sha,
                    'state': 'REVIEW_PASSED',
                    'advances_frontier_ids': ['G14'],
                    'scope_closure': {'related_work_remaining': False},
                    'adversarial_preflight': {'completed': True},
                    'review_history': [
                        {
                            'candidate_sha': source_sha,
                            'reviewed_base_sha': base_sha,
                            'reviewer_id': reviewer_id,
                            'verdict': 'PASS',
                        },
                        {
                            'candidate_sha': candidate_sha,
                            'reviewed_base_sha': base_sha,
                            'reviewer_id': 'gpt-6-luna-max-run95-pr241-round2',
                            'verdict': 'PASS',
                        },
                    ],
                },
            },
        }
        with (
            patch.object(
                GENERATOR,
                'codex_r02_profile_candidate_paths',
                return_value={GENERATOR.CODEX_QUERY_SUBJECTS_FRESH_PUBLIC_REPORT_RELATIVE_PATH},
            ),
            patch.object(
                GENERATOR,
                'codex_g26_candidate_bundle_sha256',
                return_value=report['mcpBundleSha256'],
            ),
        ):
            self.assertTrue(
                GENERATOR.codex_query_subjects_fresh_public_profile_candidate_binding_is_current(
                    report,
                    epoch_status,
                ),
            )
        with (
            patch.object(
                GENERATOR,
                'codex_r02_profile_candidate_paths',
                return_value={'scripts/agent-harness.mjs'},
            ),
            patch.object(
                GENERATOR,
                'codex_g26_candidate_bundle_sha256',
                return_value=report['mcpBundleSha256'],
            ),
        ):
            self.assertFalse(
                GENERATOR.codex_query_subjects_fresh_public_profile_candidate_binding_is_current(
                    report,
                    epoch_status,
                ),
            )


class A01RenderCohortAggregationMatrixProfileTests(unittest.TestCase):
    def setUp(self):
        self.tool_name = GENERATOR.CODEX_A01_RENDER_AGGREGATION_TOOL_NAME
        self.profile = GENERATOR.CODEX_A01_RENDER_AGGREGATION_PROFILE
        self.current_tool = {
            'name': self.tool_name,
            'auth': 'none',
            'risk': 'read',
            'inputSchema': {'type': 'object'},
        }
        self.report = {
            'toolName': self.tool_name,
            'argumentProfile': GENERATOR.CODEX_A01_RENDER_AGGREGATION_ARGUMENT_PROFILE,
            'profileId': GENERATOR.CODEX_A01_RENDER_AGGREGATION_PROFILE_ID,
            'acceptanceScope': 'agent-mcp-matrix-only',
        }

    def test_frontier_remains_unassessed_with_matrix_only_source_refs(self):
        self.assertTrue(GENERATOR.codex_a01_render_aggregation_frontier_is_unassessed())

    def test_routes_only_the_exact_render_aggregation_matrix_profile(self):
        with patch.object(
            GENERATOR,
            'codex_a01_render_aggregation_profile_report_is_valid',
            return_value=True,
        ):
            self.assertTrue(GENERATOR.codex_mcp_evidence_is_valid(
                self.report,
                {self.tool_name: self.current_tool},
                {self.tool_name: self.current_tool},
            ))

            wrong_tool = dict(self.report, toolName='bangumi.render_subject_cohort_comparison')
            self.assertFalse(GENERATOR.codex_mcp_evidence_is_valid(
                wrong_tool,
                {self.tool_name: self.current_tool},
                {self.tool_name: self.current_tool},
            ))

            scenario_scope = dict(self.report, acceptanceScope='frontier-scenario-only')
            self.assertFalse(GENERATOR.codex_mcp_evidence_is_valid(
                scenario_scope,
                {self.tool_name: self.current_tool},
                {self.tool_name: self.current_tool},
            ))

            wrong_profile = dict(self.report, profileId='consumed-profile')
            self.assertFalse(GENERATOR.codex_mcp_evidence_is_valid(
                wrong_profile,
                {self.tool_name: self.current_tool},
                {self.tool_name: self.current_tool},
            ))

    def test_routes_validated_report_to_only_the_exact_agent_mcp_cell(self):
        catalog = [self.current_tool]
        catalog_bytes = json.dumps(catalog, ensure_ascii=False).encode('utf-8')
        base_report = {
            'evidenceKind': GENERATOR.CODEX_A01_RENDER_AGGREGATION_EVIDENCE_KIND,
            'frontierId': 'A01',
            'scenarioId': None,
            'toolName': self.tool_name,
            'argumentProfile': GENERATOR.CODEX_A01_RENDER_AGGREGATION_ARGUMENT_PROFILE,
            'profileId': GENERATOR.CODEX_A01_RENDER_AGGREGATION_PROFILE_ID,
            'acceptanceScope': 'agent-mcp-matrix-only',
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
        }
        expected_path = GENERATOR.CODEX_A01_RENDER_AGGREGATION_REPORT_RELATIVE_PATH

        def collect_sources(report, report_relative_path=expected_path, current_catalog=catalog):
            with tempfile.TemporaryDirectory(prefix='a01-render-aggregation-report-routing-') as temp:
                root = Path(temp)
                report_path = root / report_relative_path
                live_probe_dir = root / 'docs/live-probes'
                live_probe_dir.mkdir(parents=True)
                report_path.parent.mkdir(parents=True, exist_ok=True)
                report_path.write_text(json.dumps(report), encoding='utf-8')
                catalog_path = root / 'docs/tool-catalog.json'
                catalog_path.parent.mkdir(parents=True, exist_ok=True)
                current_catalog_bytes = json.dumps(
                    current_catalog, ensure_ascii=False,
                ).encode('utf-8')
                catalog_path.write_bytes(current_catalog_bytes)
                frontier_path = root / 'docs/product/frontier-ledger.json'
                frontier_path.parent.mkdir(parents=True, exist_ok=True)
                frontier_path.write_text(json.dumps({
                    'records': [{
                        'id': 'A01',
                        'status': 'UNASSESSED',
                        'source_refs': [
                            GENERATOR.CODEX_A01_RENDER_AGGREGATION_SELECTION_EVIDENCE_RELATIVE_PATH,
                        ],
                    }],
                }), encoding='utf-8')
                with (
                    patch.object(GENERATOR, 'ROOT', root),
                    patch.object(GENERATOR, 'LIVE_PROBE_DIR', live_probe_dir),
                    patch.object(GENERATOR, 'CATALOG', catalog_path),
                    patch.object(
                        GENERATOR,
                        'codex_a01_render_aggregation_profile_report_is_valid',
                        return_value=True,
                    ) as report_validator,
                ):
                    sources = GENERATOR.model_mcp_e2e_sources(current_catalog)
                    frontier_is_unassessed = GENERATOR.codex_a01_render_aggregation_frontier_is_unassessed()
                return sources, report_validator.call_args_list, frontier_is_unassessed

        sources, validation_calls, frontier_is_unassessed = collect_sources(base_report)
        self.assertEqual(sources, {self.tool_name: {expected_path}})
        self.assertNotIn('bangumi.compare_subject_cohorts', sources)
        self.assertTrue(frontier_is_unassessed)
        self.assertEqual(len(validation_calls), 1)
        validated_path = validation_calls[0].kwargs['report_path']
        expected_parts = Path(expected_path).parts
        self.assertEqual(validated_path.parts[-len(expected_parts):], expected_parts)

        rejected_reports = [
            (
                'wrong tool',
                dict(base_report, toolName='bangumi.render_subject_cohort_comparison'),
                expected_path,
                catalog,
            ),
            (
                'scenario scope',
                dict(base_report, acceptanceScope='frontier-scenario-only'),
                expected_path,
                catalog,
            ),
            (
                'wrong profile',
                dict(base_report, profileId='consumed-profile'),
                expected_path,
                catalog,
            ),
            ('scenario report', dict(base_report, scenarioId='A01'), expected_path, catalog),
            (
                'stale catalog',
                dict(base_report, catalogSha256='0' * 64),
                expected_path,
                catalog,
            ),
            (
                'wrong path',
                base_report,
                'docs/live-probes/pariya-agent-a01-e2e-redirect.json',
                catalog,
            ),
        ]
        for label, report, report_path, report_catalog in rejected_reports:
            with self.subTest(route=label):
                sources, validation_calls, frontier_is_unassessed = collect_sources(
                    report, report_path, report_catalog,
                )
                self.assertEqual(sources, {})
                self.assertEqual(validation_calls, [])
                self.assertTrue(frontier_is_unassessed)

    def test_allows_only_a_report_and_generated_table_candidate_refresh(self):
        source_candidate = 'a' * 40
        refreshed_candidate = 'd' * 40
        base_sha = 'b' * 40
        branch = 'codex/epoch-run95-a01-render-cohort-aggregation-agent-mcp-offline-20261016'
        reviewer_id = 'gpt-6-luna-max-run95-pr123-round1'
        report = {
            'prNumber': 123,
            'sourceRevision': source_candidate,
            'baseSha': base_sha,
            'reviewerId': reviewer_id,
            'mcpBundleSha256': 'c' * 64,
        }
        epoch = {
            'epoch_id': GENERATOR.CODEX_A01_RENDER_AGGREGATION_EPOCH_ID,
            'pr_number': 123,
            'state': 'REVIEW_READY',
            'branch': branch,
            'base_branch': 'master',
            'base_sha': base_sha,
            'reviewed_base_sha': base_sha,
            'candidate_sha': refreshed_candidate,
            'review_history': [{
                'candidate_sha': source_candidate,
                'reviewed_base_sha': base_sha,
                'reviewer_id': reviewer_id,
                'verdict': 'PASS',
            }],
        }
        status = {
            'run': {
                'number': 95,
                'state': {'state': 'EPOCH_ACTIVE', 'active_epoch_pr': 123},
            },
            'epoch': {
                'github_state': 'OPEN',
                'pr_base_ref_name': 'master',
                'pr_base_sha': base_sha,
                'pr_head_ref_name': branch,
                'pr_head_sha': refreshed_candidate,
                'pr_is_draft': False,
                'state': epoch,
            },
        }

        def git_results(changed_paths):
            return [
                subprocess.CompletedProcess(
                    ['git'], 0, stdout=changed_paths, stderr='',
                ),
                subprocess.CompletedProcess(['git'], 0, stdout='', stderr=''),
            ]

        valid_paths = '\n'.join([
            GENERATOR.CODEX_A01_RENDER_AGGREGATION_REPORT_RELATIVE_PATH,
            'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
        ]) + '\n'
        with patch.object(GENERATOR, '_run_repository_git', side_effect=git_results(valid_paths)):
            self.assertTrue(
                GENERATOR.codex_a01_render_aggregation_profile_candidate_binding_is_current(
                    report, status, report['mcpBundleSha256'],
                )
            )

        unsafe_paths = valid_paths + 'scripts/unrelated-change.mjs\n'
        with patch.object(GENERATOR, '_run_repository_git', side_effect=git_results(unsafe_paths)):
            self.assertFalse(
                GENERATOR.codex_a01_render_aggregation_profile_candidate_binding_is_current(
                    report, status, report['mcpBundleSha256'],
                )
            )


class A01AggregateCohortOfflineMatrixProfileTests(unittest.TestCase):
    def setUp(self):
        self.assertTrue(GENERATOR._select_codex_a01_aggregate_matrix_profile(
            'a01-aggregate-cohort-offline-agent-mcp-matrix-v1',
        ))
        self.tool_name = GENERATOR.CODEX_A01_AGGREGATE_MATRIX_TOOL_NAME
        self.profile = GENERATOR.CODEX_A01_AGGREGATE_MATRIX_PROFILE
        self.current_tool = {
            'name': self.tool_name,
            'auth': 'none',
            'risk': 'read',
            'inputSchema': {'type': 'object'},
        }
        self.report = {
            'toolName': self.tool_name,
            'argumentProfile': GENERATOR.CODEX_A01_AGGREGATE_MATRIX_ARGUMENT_PROFILE,
            'profileId': GENERATOR.CODEX_A01_AGGREGATE_MATRIX_PROFILE_ID,
            'acceptanceScope': 'agent-mcp-matrix-only',
        }

    def tearDown(self):
        GENERATOR._select_codex_a01_aggregate_matrix_profile(
            'a01-aggregate-cohort-offline-agent-mcp-matrix-v1',
        )

    def test_frontier_remains_unassessed_and_requires_contract_reference(self):
        self.assertEqual(self.profile['toolName'], 'bangumi.aggregate_subject_cohort')
        self.assertEqual(self.profile['acceptanceScope'], 'agent-mcp-matrix-only')
        self.assertTrue(GENERATOR.codex_a01_aggregate_matrix_profile_frontier_is_unassessed())

    def test_each_profile_selects_its_report_server_id(self):
        expected_server_ids = {
            'a01-aggregate-cohort-offline-agent-mcp-matrix-v1': 'bgk_a01_aggregate_cohort_offline',
            'a01-aggregate-cohort-offline-agent-mcp-matrix-v2': 'bgk_a01_aggregate_cohort_offline_v2',
            'a01-aggregate-cohort-offline-agent-mcp-matrix-v3': 'bgk_a01_aggregate_cohort_offline_v3',
        }
        for profile_id, expected_server_id in expected_server_ids.items():
            with self.subTest(profile_id=profile_id):
                self.assertTrue(GENERATOR._select_codex_a01_aggregate_matrix_profile(profile_id))
                self.assertEqual(GENERATOR.CODEX_A01_AGGREGATE_MATRIX_SERVER_ID, expected_server_id)

    def test_routes_only_the_exact_aggregate_matrix_profile(self):
        with patch.object(
            GENERATOR,
            'codex_a01_aggregate_matrix_profile_report_is_valid',
            return_value=True,
        ):
            self.assertTrue(GENERATOR.codex_mcp_evidence_is_valid(
                self.report,
                {self.tool_name: self.current_tool},
                {self.tool_name: self.current_tool},
            ))
            for changed in [
                dict(self.report, toolName='bangumi.render_subject_cohort_aggregation'),
                dict(self.report, profileId='a01-rating-dispersion-1998-spring-v1'),
                dict(self.report, acceptanceScope='agent-mcp-scenario-and-matrix'),
            ]:
                self.assertFalse(GENERATOR.codex_mcp_evidence_is_valid(
                    changed,
                    {self.tool_name: self.current_tool},
                    {self.tool_name: self.current_tool},
                ))

    def test_routes_a_valid_report_only_to_aggregate_subject_cohort(self):
        catalog = [self.current_tool]
        catalog_bytes = json.dumps(catalog, ensure_ascii=False).encode('utf-8')
        base_report = {
            **self.report,
            'evidenceKind': GENERATOR.CODEX_A01_AGGREGATE_MATRIX_EVIDENCE_KIND,
            'frontierId': 'A01',
            'scenarioId': None,
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
        }
        expected_path = GENERATOR.CODEX_A01_AGGREGATE_MATRIX_REPORT_RELATIVE_PATH

        def collect_sources(report, report_relative_path=None, current_catalog=catalog):
            if report_relative_path is None:
                report_relative_path = GENERATOR.CODEX_A01_AGGREGATE_MATRIX_REPORT_RELATIVE_PATH
            with tempfile.TemporaryDirectory(prefix='a01-aggregate-matrix-report-routing-') as temp:
                root = Path(temp)
                live_probe_dir = root / 'docs/live-probes'
                live_probe_dir.mkdir(parents=True)
                report_path = root / report_relative_path
                report_path.parent.mkdir(parents=True, exist_ok=True)
                report_path.write_text(json.dumps(report), encoding='utf-8')
                catalog_path = root / 'docs/tool-catalog.json'
                catalog_path.parent.mkdir(parents=True, exist_ok=True)
                catalog_path.write_bytes(json.dumps(current_catalog, ensure_ascii=False).encode('utf-8'))
                frontier_path = root / 'docs/product/frontier-ledger.json'
                frontier_path.parent.mkdir(parents=True, exist_ok=True)
                frontier_path.write_text(json.dumps({
                    'records': [{
                        'id': 'A01',
                        'status': 'UNASSESSED',
                        'source_refs': [GENERATOR.CODEX_A01_AGGREGATE_MATRIX_SELECTION_EVIDENCE_RELATIVE_PATH],
                    }],
                }), encoding='utf-8')
                with (
                    patch.object(GENERATOR, 'ROOT', root),
                    patch.object(GENERATOR, 'LIVE_PROBE_DIR', live_probe_dir),
                    patch.object(GENERATOR, 'CATALOG', catalog_path),
                    patch.object(
                        GENERATOR,
                        'codex_a01_aggregate_matrix_profile_report_is_valid',
                        return_value=True,
                    ) as report_validator,
                ):
                    sources = GENERATOR.model_mcp_e2e_sources(current_catalog)
                    frontier_is_unassessed = GENERATOR.codex_a01_aggregate_matrix_profile_frontier_is_unassessed()
                return sources, report_validator.call_args_list, frontier_is_unassessed

        sources, calls, frontier_is_unassessed = collect_sources(base_report)
        self.assertEqual(sources, {self.tool_name: {expected_path}})
        self.assertNotIn('bangumi.compare_subject_cohorts', sources)
        self.assertTrue(frontier_is_unassessed)
        self.assertEqual(len(calls), 1)

        invalid = dict(base_report, scenarioId='A01')
        sources, calls, frontier_is_unassessed = collect_sources(invalid)
        self.assertEqual(sources, {})
        self.assertEqual(calls, [])
        self.assertTrue(frontier_is_unassessed)

    def test_v2_uses_its_distinct_profile_and_report_path(self):
        profile_id = 'a01-aggregate-cohort-offline-agent-mcp-matrix-v2'
        self.assertTrue(GENERATOR._select_codex_a01_aggregate_matrix_profile(profile_id))
        profile = GENERATOR.CODEX_A01_AGGREGATE_MATRIX_PROFILE
        self.assertNotEqual(profile['id'], self.profile['id'])
        self.assertNotEqual(profile['reportPath'], self.profile['reportPath'])
        self.assertNotEqual(profile['networkMode'], self.profile['networkMode'])

        catalog = [self.current_tool]
        catalog_bytes = json.dumps(catalog, ensure_ascii=False).encode('utf-8')
        report = {
            **self.report,
            'profileId': profile_id,
            'argumentProfile': profile['argumentProfile'],
            'evidenceKind': profile['evidenceKind'],
            'frontierId': 'A01',
            'scenarioId': None,
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
        }

        def collect_sources(report_relative_path):
            with tempfile.TemporaryDirectory(prefix='a01-aggregate-matrix-v2-routing-') as temp:
                root = Path(temp)
                live_probe_dir = root / 'docs/live-probes'
                live_probe_dir.mkdir(parents=True)
                report_path = root / report_relative_path
                report_path.parent.mkdir(parents=True, exist_ok=True)
                report_path.write_text(json.dumps(report), encoding='utf-8')
                catalog_path = root / 'docs/tool-catalog.json'
                catalog_path.parent.mkdir(parents=True, exist_ok=True)
                catalog_path.write_bytes(catalog_bytes)
                frontier_path = root / 'docs/product/frontier-ledger.json'
                frontier_path.parent.mkdir(parents=True, exist_ok=True)
                frontier_path.write_text(json.dumps({
                    'records': [{
                        'id': 'A01',
                        'status': 'UNASSESSED',
                        'source_refs': [profile['selectionEvidencePath']],
                    }],
                }), encoding='utf-8')
                with (
                    patch.object(GENERATOR, 'ROOT', root),
                    patch.object(GENERATOR, 'LIVE_PROBE_DIR', live_probe_dir),
                    patch.object(GENERATOR, 'CATALOG', catalog_path),
                    patch.object(
                        GENERATOR,
                        'codex_a01_aggregate_matrix_profile_report_is_valid',
                        return_value=True,
                    ),
                ):
                    return GENERATOR.model_mcp_e2e_sources(catalog)

        self.assertEqual(
            collect_sources(profile['reportPath']),
            {self.tool_name: {profile['reportPath']}},
        )
        self.assertEqual(collect_sources(self.profile['reportPath']), {})

    def test_v3_uses_a_fresh_profile_and_only_its_registered_report_path(self):
        profile_id = 'a01-aggregate-cohort-offline-agent-mcp-matrix-v3'
        self.assertTrue(GENERATOR._select_codex_a01_aggregate_matrix_profile(profile_id))
        profile = GENERATOR.CODEX_A01_AGGREGATE_MATRIX_PROFILE
        v2 = GENERATOR.CODEX_A01_AGGREGATE_MATRIX_PROFILES[
            'a01-aggregate-cohort-offline-agent-mcp-matrix-v2'
        ]
        self.assertNotEqual(profile['id'], self.profile['id'])
        self.assertNotEqual(profile['id'], v2['id'])
        self.assertNotEqual(profile['reportPath'], self.profile['reportPath'])
        self.assertNotEqual(profile['reportPath'], v2['reportPath'])
        self.assertEqual(profile['networkMode'], v2['networkMode'])
        self.assertNotEqual(profile['networkMode'], self.profile['networkMode'])
        self.assertNotEqual(profile['calls'][0]['arguments'], v2['calls'][0]['arguments'])

        catalog = [self.current_tool]
        catalog_bytes = json.dumps(catalog, ensure_ascii=False).encode('utf-8')
        report = {
            **self.report,
            'profileId': profile_id,
            'argumentProfile': profile['argumentProfile'],
            'evidenceKind': profile['evidenceKind'],
            'frontierId': 'A01',
            'scenarioId': None,
            'catalogSha256': hashlib.sha256(catalog_bytes).hexdigest(),
        }
        with tempfile.TemporaryDirectory(prefix='a01-aggregate-matrix-v3-routing-') as temp:
            root = Path(temp)
            live_probe_dir = root / 'docs/live-probes'
            live_probe_dir.mkdir(parents=True)
            report_path = root / profile['reportPath']
            report_path.parent.mkdir(parents=True, exist_ok=True)
            report_path.write_text(json.dumps(report), encoding='utf-8')
            catalog_path = root / 'docs/tool-catalog.json'
            catalog_path.parent.mkdir(parents=True, exist_ok=True)
            catalog_path.write_bytes(catalog_bytes)
            frontier_path = root / 'docs/product/frontier-ledger.json'
            frontier_path.parent.mkdir(parents=True, exist_ok=True)
            frontier_path.write_text(json.dumps({
                'records': [{
                    'id': 'A01',
                    'status': 'UNASSESSED',
                    'source_refs': [profile['selectionEvidencePath']],
                }],
            }), encoding='utf-8')
            with (
                patch.object(GENERATOR, 'ROOT', root),
                patch.object(GENERATOR, 'LIVE_PROBE_DIR', live_probe_dir),
                patch.object(GENERATOR, 'CATALOG', catalog_path),
                patch.object(
                    GENERATOR,
                    'codex_a01_aggregate_matrix_profile_report_is_valid',
                    return_value=True,
                ),
            ):
                self.assertEqual(
                    GENERATOR.model_mcp_e2e_sources(catalog),
                    {self.tool_name: {profile['reportPath']}},
                )

    def test_candidate_refresh_is_limited_to_report_matrix_and_frontier(self):
        source_candidate = 'a' * 40
        refreshed_candidate = 'd' * 40
        base_sha = 'b' * 40
        branch = 'codex/epoch-run95-a01-aggregate-matrix-followup-20261018'
        reviewer_id = 'gpt-6-luna-max-run95-pr231-round1'
        report = {
            'profileId': GENERATOR.CODEX_A01_AGGREGATE_MATRIX_PROFILE_ID,
            'prNumber': 231,
            'sourceRevision': source_candidate,
            'baseSha': base_sha,
            'reviewerId': reviewer_id,
            'mcpBundleSha256': 'c' * 64,
        }
        status = {
            'run': {
                'number': 95,
                'state': {'state': 'EPOCH_ACTIVE', 'active_epoch_pr': 231},
            },
            'epoch': {
                'github_state': 'OPEN',
                'pr_base_ref_name': 'master',
                'pr_base_sha': base_sha,
                'pr_head_ref_name': branch,
                'pr_head_sha': refreshed_candidate,
                'pr_is_draft': False,
                'state': {
                    'epoch_id': GENERATOR.CODEX_A01_AGGREGATE_MATRIX_EPOCH_ID,
                    'pr_number': 231,
                    'state': 'REVIEW_READY',
                    'branch': branch,
                    'base_branch': 'master',
                    'base_sha': base_sha,
                    'reviewed_base_sha': base_sha,
                    'candidate_sha': refreshed_candidate,
                    'review_history': [{
                        'candidate_sha': source_candidate,
                        'reviewed_base_sha': base_sha,
                        'reviewer_id': reviewer_id,
                        'verdict': 'PASS',
                    }],
                },
            },
        }
        valid_paths = '\n'.join([
            GENERATOR.CODEX_A01_AGGREGATE_MATRIX_REPORT_RELATIVE_PATH,
            'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md',
            'docs/product/frontier-ledger.json',
        ]) + '\n'
        with patch.object(
            GENERATOR,
            '_run_repository_git',
            side_effect=[
                subprocess.CompletedProcess(['git'], 0, stdout=valid_paths, stderr=''),
                subprocess.CompletedProcess(['git'], 0, stdout='', stderr=''),
            ],
        ):
            self.assertTrue(GENERATOR.codex_a01_aggregate_matrix_profile_candidate_binding_is_current(
                report, status, report['mcpBundleSha256'],
            ))


class LocalToolAuthDenialEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix='local-auth-denial-evidence-test-')
        self.root = Path(self.temp_dir.name)
        self.live_probe_dir = self.root / 'docs/live-probes'
        self.live_probe_dir.mkdir(parents=True)
        self.source_path = self.root / 'tests/unit/manage-index-actions.test.ts'
        self.source_path.parent.mkdir(parents=True)
        self.source_path.write_text(
            "\n".join([
                "externalUserId: 'user-without-account'",
                "it('rejects an unbound principal before issuing any index request', async () => {",
                "  await expect(execute()).rejects.toMatchObject({ code: 'AUTH_REQUIRED' });",
                '  expect(mockFetch).not.toHaveBeenCalled();',
                '  expect(capturedRequests).toHaveLength(0);',
                '});',
            ]) + '\n',
            encoding='utf-8',
        )
        self.catalog = [{
            'name': 'bangumi.manage_index',
            'auth': 'required',
            'risk': 'write',
            'scopes': ['write:indices'],
        }]
        self.catalog_path = self.root / 'docs/tool-catalog.json'
        self.catalog_path.parent.mkdir(parents=True, exist_ok=True)
        self.catalog_path.write_text(json.dumps(self.catalog), encoding='utf-8')
        self.report_path = self.live_probe_dir / 'tool-registry-no-account-auth-denial-manage-index.json'
        self.report = {
            'schemaVersion': 1,
            'evidenceKind': 'tool_registry_no_account_auth_denial_test',
            'profile': 'bangumi-tool-registry-no-account-auth-denial-v1',
            'catalogSha256': hashlib.sha256(self.catalog_path.read_bytes()).hexdigest(),
            'tool': 'bangumi.manage_index',
            'testSourcePath': 'tests/unit/manage-index-actions.test.ts',
            'testSourceSha256': hashlib.sha256(self.source_path.read_bytes()).hexdigest(),
            'testCommand': 'pnpm exec vitest run tests/unit/manage-index-actions.test.ts',
            'testName': 'rejects an unbound principal before issuing any index request',
            'testResult': 'PASS',
            'accountBound': False,
            'observedErrorCode': 'AUTH_REQUIRED',
            'assertions': {
                'authRequiredGateObserved': True,
                'operationExecuted': False,
                'accountDataReturned': False,
                'networkAccessBlocked': True,
                'networkRequestAttempts': 0,
                'externalApiCalled': False,
            },
        }
        self.write_report()
        self.original_generator_root = GENERATOR.ROOT
        self.original_generator_probe_dir = GENERATOR.LIVE_PROBE_DIR
        self.original_generator_catalog = GENERATOR.CATALOG
        self.original_checker_root = TABLE_CHECKER.ROOT
        self.original_checker_catalog = TABLE_CHECKER.CATALOG
        GENERATOR.ROOT = self.root
        GENERATOR.LIVE_PROBE_DIR = self.live_probe_dir
        GENERATOR.CATALOG = self.catalog_path
        TABLE_CHECKER.ROOT = self.root
        TABLE_CHECKER.CATALOG = self.catalog_path

    def tearDown(self):
        GENERATOR.ROOT = self.original_generator_root
        GENERATOR.LIVE_PROBE_DIR = self.original_generator_probe_dir
        GENERATOR.CATALOG = self.original_generator_catalog
        TABLE_CHECKER.ROOT = self.original_checker_root
        TABLE_CHECKER.CATALOG = self.original_checker_catalog
        self.temp_dir.cleanup()

    def write_report(self):
        self.report_path.write_text(json.dumps(self.report), encoding='utf-8')

    def test_accepts_current_catalog_source_bound_no_account_tool_gate(self):
        sources = GENERATOR.auth_gate_denial_sources(self.catalog)
        self.assertEqual(sources, {
            'bangumi.manage_index': {
                'docs/live-probes/tool-registry-no-account-auth-denial-manage-index.json'
            }
        })
        cell = '✅<br>`docs/live-probes/tool-registry-no-account-auth-denial-manage-index.json`'
        self.assertIsNone(TABLE_CHECKER.evidence_reference_error('bangumi.manage_index', cell, 'auth_denial'))
        self.assertIn('bangumi.manage_index', GENERATOR.auth_gate_denial_names(self.catalog))

    def test_accepts_historical_catalog_snapshot_when_tool_descriptor_is_unchanged(self):
        snapshot_dir = self.live_probe_dir / 'catalog-snapshots'
        snapshot_dir.mkdir()
        snapshot_bytes = json.dumps(self.catalog, indent=2).encode('utf-8')
        snapshot_sha256 = hashlib.sha256(snapshot_bytes).hexdigest()
        (snapshot_dir / f'{snapshot_sha256}.json').write_bytes(snapshot_bytes)
        self.report['catalogSha256'] = snapshot_sha256
        self.write_report()

        self.assertIn('bangumi.manage_index', GENERATOR.auth_gate_denial_sources(self.catalog))
        cell = '✅<br>`docs/live-probes/tool-registry-no-account-auth-denial-manage-index.json`'
        self.assertIsNone(TABLE_CHECKER.evidence_reference_error(
            'bangumi.manage_index', cell, 'auth_denial',
        ))

        changed_snapshot = [{**self.catalog[0], 'auth': 'optional'}]
        changed_bytes = json.dumps(changed_snapshot, indent=2).encode('utf-8')
        changed_sha256 = hashlib.sha256(changed_bytes).hexdigest()
        (snapshot_dir / f'{changed_sha256}.json').write_bytes(changed_bytes)
        self.report['catalogSha256'] = changed_sha256
        self.write_report()
        self.assertNotIn('bangumi.manage_index', GENERATOR.auth_gate_denial_sources(self.catalog))
        error = TABLE_CHECKER.evidence_reference_error(
            'bangumi.manage_index', cell, 'auth_denial',
        )
        self.assertIn('does not contain evidence for bangumi.manage_index', error)

    def test_rejects_stale_catalog_or_test_source_hash(self):
        self.report['catalogSha256'] = '0' * 64
        self.write_report()
        self.assertNotIn('bangumi.manage_index', GENERATOR.auth_gate_denial_sources(self.catalog))
        cell = '✅<br>`docs/live-probes/tool-registry-no-account-auth-denial-manage-index.json`'
        error = TABLE_CHECKER.evidence_reference_error('bangumi.manage_index', cell, 'auth_denial')
        self.assertIn('does not contain evidence for bangumi.manage_index', error)

        self.report['catalogSha256'] = hashlib.sha256(self.catalog_path.read_bytes()).hexdigest()
        self.report['testSourceSha256'] = '0' * 64
        self.write_report()
        self.assertNotIn('bangumi.manage_index', GENERATOR.auth_gate_denial_sources(self.catalog))

        self.report['testSourceSha256'] = hashlib.sha256(self.source_path.read_bytes()).hexdigest()
        self.write_report()
        self.source_path.unlink()
        self.assertNotIn('bangumi.manage_index', GENERATOR.auth_gate_denial_sources(self.catalog))

    def test_rejects_any_account_data_or_network_attempt(self):
        self.report['assertions']['networkRequestAttempts'] = 1
        self.write_report()
        self.assertNotIn('bangumi.manage_index', GENERATOR.auth_gate_denial_sources(self.catalog))

        self.report['assertions']['networkRequestAttempts'] = 0
        self.report['assertions']['accountDataReturned'] = True
        self.write_report()
        self.assertNotIn('bangumi.manage_index', GENERATOR.auth_gate_denial_sources(self.catalog))


class CandidateCommitPathIsolationTests(unittest.TestCase):
    def test_profile_refresh_allowlists_ignore_uncommitted_worktree_files(self):
        source_revision = 'a' * 40
        candidate_sha = 'b' * 40
        p03 = GENERATOR.codex_p03_profile_spec(GENERATOR.CODEX_P03_V4_PROFILE_ID)
        g06 = GENERATOR.CODEX_G06_CAST_OFFLINE_V2_PROFILE
        r04 = GENERATOR.CODEX_R04_RENDER_V2_PROFILE
        cases = [
            (
                'P03 v4',
                p03['reportPath'],
                lambda: GENERATOR.codex_p03_profile_report_candidate_paths(
                    source_revision, candidate_sha, GENERATOR.CODEX_P03_V4_PROFILE_ID,
                ),
            ),
            (
                'G06 v2',
                g06['reportPath'],
                lambda: GENERATOR._codex_g06_cast_offline_report_candidate_paths(
                    source_revision, candidate_sha,
                ),
            ),
            (
                'R04 render v2',
                r04['reportPath'],
                lambda: GENERATOR.codex_r04_render_v2_profile_report_candidate_paths(
                    source_revision, candidate_sha,
                ),
            ),
        ]

        for label, expected_path, build_paths in cases:
            with self.subTest(profile=label):
                def repository_git(_root, *arguments, **_kwargs):
                    if arguments[:2] == ('merge-base', '--is-ancestor'):
                        return subprocess.CompletedProcess(arguments, 0, '', '')
                    if arguments[:2] == ('diff', '--name-only'):
                        return subprocess.CompletedProcess(
                            arguments, 0, f'{expected_path}\n', '',
                        )
                    if arguments[:2] == ('status', '--porcelain=v1'):
                        return subprocess.CompletedProcess(
                            arguments, 0, '?? packages/renderer/PersonProfileCard.tsx\n', '',
                        )
                    raise AssertionError(f'unexpected Git command: {arguments}')

                with patch.object(GENERATOR, '_run_repository_git', side_effect=repository_git):
                    self.assertEqual(build_paths(), {expected_path})


if __name__ == '__main__':
    unittest.main()
