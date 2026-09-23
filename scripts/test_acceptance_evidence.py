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


class PublicApiEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory(prefix='acceptance-evidence-test-')
        self.root = Path(self.temp_dir.name)
        (self.root / 'docs/live-probes').mkdir(parents=True)
        (self.root / 'scripts').mkdir()
        self.catalog_path = self.root / 'docs/tool-catalog.json'
        self.catalog = [
            {'name': 'bangumi.get_subject', 'auth': 'none'},
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
