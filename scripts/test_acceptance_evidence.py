#!/usr/bin/env python3
"""Negative tests for catalog-bound public API acceptance evidence."""

import hashlib
import importlib.util
import json
import os
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
        GENERATOR.urllib.request.urlopen = self._fake_s03_control_urlopen

    def _fake_s03_control_urlopen(self, request, timeout=10):
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
            *GENERATOR.CODEX_A01_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_G26_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_S02_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_S03_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_D05_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_D04_PROBE_IMPLEMENTATION_MARKERS,
            *GENERATOR.CODEX_G02_PROBE_IMPLEMENTATION_MARKERS,
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
        self._git('config', 'user.name', 'Acceptance Evidence Test')
        self._git('config', 'user.email', 'acceptance-evidence@example.invalid')
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

    def write_report(self, tool_name='bangumi.get_subject_stats_intelligence', **overrides):
        tool = next(item for item in self.catalog if item['name'] == tool_name)
        is_g20 = tool_name in GENERATOR.CODEX_G20_PROBE_ARGUMENTS
        is_d04 = tool_name == 'bangumi.query_subjects'
        is_renderer = tool_name.startswith('bangumi.render_')
        arguments = (GENERATOR.CODEX_D04_PROBE_ARGUMENTS[tool_name] if is_d04
                     else GENERATOR.CODEX_PROBE_ARGUMENTS[tool_name])
        if is_g20:
            answer_checks = {key: True for key in GENERATOR.CODEX_G20_ANSWER_CHECK_FIELDS}
            result = {
                'toolName': tool_name,
                'resultState': 'observed',
                'resultByteLength': 1024,
                'resultSha256': 'd' * 64,
                'sourceOperations': [],
                'artifact': {'returned': False, 'persisted': False},
                'sourceSubjectId': 227245,
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
            'argumentProfile': GENERATOR.CODEX_ARGUMENT_PROFILES[tool_name],
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
    def _g20_result_fixture():
        return {
            'toolName': 'bangumi.get_subject_relations',
            'resultState': 'observed',
            'resultByteLength': 1024,
            'resultSha256': 'd' * 64,
            'sourceOperations': [],
            'artifact': {'returned': False, 'persisted': False},
            'sourceSubjectId': 227245,
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
            query_coverage_state = 'partial'
            query_state = 'partial'
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
