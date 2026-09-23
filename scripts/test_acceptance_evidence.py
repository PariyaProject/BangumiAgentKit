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
        self.original_root = TABLE_CHECKER.ROOT
        TABLE_CHECKER.ROOT = self.root

    def tearDown(self):
        TABLE_CHECKER.ROOT = self.original_root
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
