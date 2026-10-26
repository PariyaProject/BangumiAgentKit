"""Offline adversarial coverage for the historical, non-replayable A1 import."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from acceptance import real_account_a1_evidence as evidence


ROOT = Path(__file__).resolve().parents[1]


class RealAccountA1EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='bgk-a1-evidence-test-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bundle = self.root / evidence.BUNDLE
        shutil.copytree(ROOT / evidence.BUNDLE, self.bundle)
        self.sources = json.loads((self.bundle / 'source-files.json').read_text())
        for name in self.sources:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        self.catalog = json.loads((self.root / 'docs/tool-catalog.json').read_text())
        # Only repository ancestry/tree metadata is synthetic. Every source and
        # receipt byte is the actual imported input, independently tamperable.
        self.tree = ''.join(f"100644 blob {v['gitBlob']}\t{k}\n"
                            for k, v in self.sources.items())
        self.git = patch.object(evidence, '_git', side_effect=self.git_result).start()
        self.addCleanup(patch.stopall)

    def git_result(self, root, *args):
        if args[:2] == ('merge-base', '--is-ancestor'):
            return ''
        if args[:2] == ('ls-tree', '-r'):
            return self.tree
        raise AssertionError('Unexpected Git command')

    def result(self):
        return evidence.real_account_read_sources(self.root, self.catalog)

    def rewrite_json(self, filename, update):
        path = self.bundle / filename
        data = json.loads(path.read_text())
        update(data)
        path.write_text(json.dumps(data))

    def test_accepts_only_two_observed_account_reads(self):
        self.assertEqual(self.result(), {name: {evidence.REFERENCE} for name in evidence.TOOLS})

    def test_actual_repository_ancestry_and_source_tree(self):
        expected = self.result()
        with patch.object(evidence, '_git', wraps=self.git_original):
            self.assertEqual(evidence.real_account_read_sources(ROOT, self.catalog), expected)

    git_original = staticmethod(evidence._git)

    def test_no_credit_for_mutated_execution_or_private_fields(self):
        path = self.bundle / 'a1-result.json'
        original = path.read_bytes()
        mutations = [('executionKind', 'synthetic'), ('passed', False), ('code', 'A1_BATCH_FAILED'),
                     ('startAttempted', False), ('containerRemoved', False),
                     ('toolCallsAttempted', 3), ('toolCallsSucceeded', 1),
                     ('httpRequests', None), ('collectionRows', 3), ('collectionRows', None),
                     ('modelCalls', 1), ('clientActions', 1), ('privatePayloadSaved', True),
                     ('sourceRevision', '0' * 40), ('imageId', 'sha256:' + '0' * 64),
                     ('planSha256', '0' * 64), ('privateAccount', 'must-not-be-exported')]
        for key, value in mutations:
            with self.subTest(field=key, value=value):
                path.write_bytes(original)
                self.rewrite_json('a1-result.json', lambda d: d.update({key: value}))
                self.assertEqual(self.result(), {})

    def test_no_credit_for_changed_scope_plan_binding_or_completion(self):
        cases = [('public-plan.json', 'maxToolCalls', 3),
                 ('public-plan.json', 'identityRoute', 'gateway-owner'),
                 ('public-plan.json', 'worktreeClean', False),
                 ('postconditions.json', 'durableA1ClaimComplete', False),
                 ('postconditions.json', 'durableClaimMatchesOperatorResult', False),
                 ('postconditions.json', 'currentTrustedBindingCount', 0),
                 ('postconditions.json', 'fenceExists', True),
                 ('oauth-result.json', 'identityValidated', False),
                 ('runtime-restoration.json', 'modelRunsDelta', 1),
                 ('auth-flow-partial.json', 'report_status', 'PASS')]
        for filename, key, value in cases:
            with self.subTest(file=filename, field=key):
                path = self.bundle / filename
                original = path.read_bytes()
                self.rewrite_json(filename, lambda d: d.update({key: value}))
                self.assertEqual(self.result(), {})
                path.write_bytes(original)

    def test_modified_manifest_cannot_expand_tools_paths_or_rebind_hashes(self):
        self.rewrite_json('import.json', lambda d: d.update({
            'tools': [{'name': 'bangumi.update_collection', 'input': {}}],
            'evidenceFiles': {'../../outside.json': '0' * 64},
        }))
        with patch.object(evidence, '_current_sources_match') as source_check:
            self.assertEqual(self.result(), {})
            source_check.assert_not_called()

    def test_missing_receipt_gives_no_credit(self):
        (self.bundle / 'a1-result.json').unlink()
        self.assertEqual(self.result(), {})

    def test_invalid_json_gives_no_credit(self):
        (self.bundle / 'postconditions.json').write_text('{')
        self.assertEqual(self.result(), {})

    def test_oversize_and_nonregular_receipts_are_rejected_before_read(self):
        path = self.bundle / 'a1-result.json'
        path.write_bytes(b' ' * (65536 + 1))
        self.assertEqual(self.result(), {})
        path.unlink()
        os.mkfifo(path)
        self.assertEqual(self.result(), {})

    def test_symlinked_receipt_and_parent_are_rejected(self):
        path = self.bundle / 'a1-result.json'
        path.unlink()
        path.symlink_to(ROOT / evidence.REFERENCE)
        self.assertEqual(self.result(), {})
        shutil.rmtree(self.bundle)
        self.bundle.symlink_to(ROOT / evidence.BUNDLE, target_is_directory=True)
        self.assertEqual(self.result(), {})

    def test_catalog_argument_drift_does_not_borrow_disk_catalog(self):
        for tool in self.catalog:
            if tool['name'] == evidence.TOOLS[1]:
                tool['risk'] = 'write'
        self.assertEqual(self.result(), {})

    def test_uncommitted_source_and_catalog_drift_give_no_credit(self):
        for name in ('packages/tools/src/definitions/read-tools.ts', 'docs/tool-catalog.json'):
            with self.subTest(path=name):
                path = self.root / name
                original = path.read_bytes()
                path.write_bytes(original + b'\n')
                self.assertEqual(self.result(), {})
                path.write_bytes(original)

    def test_committed_source_drift_or_missing_tree_entry_gives_no_credit(self):
        name, entry = next(iter(self.sources.items()))
        original = self.tree
        self.tree = original.replace(entry['gitBlob'], '0' * 40, 1)
        self.assertEqual(self.result(), {})
        self.tree = ''.join(line for line in original.splitlines(keepends=True) if '\t' + name + '\n' not in line)
        self.assertEqual(self.result(), {})

    def test_unknown_or_unrelated_ancestry_fails_closed(self):
        self.git.side_effect = subprocess.CalledProcessError(1, ['git'])
        self.assertEqual(self.result(), {})
        self.git.side_effect = subprocess.TimeoutExpired(['git'], 10)
        self.assertEqual(self.result(), {})

    def test_unrelated_extra_report_is_not_discovered(self):
        extra = self.bundle.parent / 'made-up-a1-success.json'
        extra.write_text(json.dumps({'passed': True, 'tool': 'bangumi.update_collection'}))
        self.assertEqual(set(self.result()), set(evidence.TOOLS))

    def test_generator_changes_only_the_account_cell_for_the_two_tools(self):
        spec = importlib.util.spec_from_file_location('a1_matrix_test', ROOT / 'scripts/generate-tool-acceptance-tasks.py')
        generator = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(generator)
        accepted = self.result()
        for index, tool in enumerate(self.catalog):
            with self.subTest(tool=tool['name']):
                before = generator.status(tool, index, {}, {}, {}, {}, {}, {})
                after = generator.status(tool, index, {}, {}, {}, {}, {}, {}, accepted)
                self.assertEqual(before[:5] + before[6:], after[:5] + after[6:])
                self.assertEqual(after[5].startswith('✅'), tool['name'] in evidence.TOOLS)
                if tool['name'] not in evidence.TOOLS:
                    self.assertEqual(before, after)

    def test_checker_rejects_manual_marks_wrong_row_reference_and_stale_credit(self):
        spec = importlib.util.spec_from_file_location('a1_checker_test', ROOT / 'scripts/check-tool-acceptance-table.py')
        checker = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(checker)
        accepted = self.result()
        tool = next(t for t in self.catalog if t['name'] == evidence.TOOLS[0])
        correct = f'✅<br>`{evidence.REFERENCE}`'
        self.assertIsNone(checker.account_auth_reference_error(tool, correct, accepted))
        for cell in ('✅', '⬜', '—', '✅<br>`docs/live-probes/other.json`', correct + '<br>`extra`'):
            self.assertIsNotNone(checker.account_auth_reference_error(tool, cell, accepted))
        self.assertIsNotNone(checker.account_auth_reference_error(tool, correct, {}))
        unrelated = next(t for t in self.catalog if t['name'] == 'bangumi.update_collection')
        self.assertIsNotNone(checker.account_auth_reference_error(unrelated, correct, accepted))


if __name__ == '__main__':
    unittest.main()
