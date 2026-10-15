#!/usr/bin/env python3
"""Negative tests for catalog-bound public API acceptance evidence."""

import base64
import hashlib
import importlib.util
import json
import os
from pathlib import Path
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


if __name__ == '__main__':
    unittest.main()
