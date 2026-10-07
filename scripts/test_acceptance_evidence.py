#!/usr/bin/env python3
"""Negative tests for catalog-bound public API acceptance evidence."""

import hashlib
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


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
            {'name': 'bangumi.auth_status', 'auth': 'none'},
        ]
        self.catalog_path.write_text(json.dumps(self.catalog), encoding='utf-8')
        self.probe_path = self.root / 'scripts/smoke-public-tools-online.ts'
        self.probe_path.write_text('// fixture probe source\n', encoding='utf-8')
        self.original_root = GENERATOR.ROOT
        self.original_catalog = GENERATOR.CATALOG
        self.original_probe_dir = GENERATOR.LIVE_PROBE_DIR
        GENERATOR.ROOT = self.root
        GENERATOR.CATALOG = self.catalog_path
        GENERATOR.LIVE_PROBE_DIR = self.root / 'docs/live-probes'
        self.report_path = GENERATOR.LIVE_PROBE_DIR / 'public-tools-fixture.json'

    def tearDown(self):
        GENERATOR.ROOT = self.original_root
        GENERATOR.CATALOG = self.original_catalog
        GENERATOR.LIVE_PROBE_DIR = self.original_probe_dir
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
            {'name': 'bangumi.auth_status', 'auth': 'none', 'risk': 'read'},
        ]
        self.catalog_path = self.root / 'docs/tool-catalog.json'
        self.catalog_path.write_text(json.dumps(self.catalog, ensure_ascii=False), encoding='utf-8')
        self.original_root = GENERATOR.ROOT
        self.source_revision, self.unrelated_source_revision = self._init_probe_source_history()
        self.original_catalog = GENERATOR.CATALOG
        self.original_probe_dir = GENERATOR.LIVE_PROBE_DIR
        GENERATOR.ROOT = self.root
        GENERATOR.CATALOG = self.catalog_path
        GENERATOR.LIVE_PROBE_DIR = self.live_probe_dir
        self.report_path = self.live_probe_dir / 'pariya-agent-codex-luna-e2e-G23.json'

    def _git(self, *args):
        return subprocess.run(
            ['git', *args], cwd=self.root, check=True, capture_output=True, text=True,
        )

    def _init_probe_source_history(self):
        for relative_path in GENERATOR.CODEX_PROBE_IMPLEMENTATION_MARKERS:
            source_path = self.original_root / relative_path
            fixture_path = self.root / relative_path
            fixture_path.parent.mkdir(parents=True, exist_ok=True)
            fixture_path.write_bytes(source_path.read_bytes())
        self._git('init', '-q')
        self._git('config', 'user.name', 'Acceptance Evidence Test')
        self._git('config', 'user.email', 'acceptance-evidence@example.invalid')
        self._git('add', 'apps/mcp/codex-one-tool-mcp-server.mjs',
                  'scripts/lib/codex-one-tool-evidence.mjs')
        self._git('commit', '-qm', 'add one-tool probe implementation fixture')
        implementation_revision = self._git('rev-parse', 'HEAD').stdout.strip()
        server_path = self.root / 'apps/mcp/codex-one-tool-mcp-server.mjs'
        server_path.write_text('export const unrelatedProgram = true;\n', encoding='utf-8')
        self._git('add', 'apps/mcp/codex-one-tool-mcp-server.mjs')
        self._git('commit', '-qm', 'replace probe implementation with unrelated code')
        unrelated_revision = self._git('rev-parse', 'HEAD').stdout.strip()
        return implementation_revision, unrelated_revision

    def tearDown(self):
        GENERATOR.ROOT = self.original_root
        GENERATOR.CATALOG = self.original_catalog
        GENERATOR.LIVE_PROBE_DIR = self.original_probe_dir
        self.temp_dir.cleanup()

    @staticmethod
    def sha256(value):
        return hashlib.sha256(value.encode('utf-8')).hexdigest()

    def write_report(self, tool_name='bangumi.get_subject_stats_intelligence', **overrides):
        tool = next(item for item in self.catalog if item['name'] == tool_name)
        arguments = GENERATOR.CODEX_G23_PROBE_ARGUMENTS[tool_name]
        is_renderer = tool_name.startswith('bangumi.render_')
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
            'argumentProfile': 'fixed-public-subject-218707-v1',
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
            'privacy': {key: False for key in GENERATOR.CODEX_PRIVACY_FLAGS} | {'authProfile': 'anonymous'},
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
        report.update(overrides)
        self.report_path.write_text(json.dumps(report, ensure_ascii=False), encoding='utf-8')

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


if __name__ == '__main__':
    unittest.main()
