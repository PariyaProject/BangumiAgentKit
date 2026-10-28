"""Offline source/receipt adversaries for the spent partial A2 import."""
import json
import importlib.util
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from acceptance import real_account_a1_evidence as legacy
from acceptance import real_account_a2_evidence as evidence

ROOT = Path(__file__).resolve().parents[1]


class RealAccountA2EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='bgk-a2-evidence-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bundle = self.root / evidence.BUNDLE
        shutil.copytree(ROOT / evidence.BUNDLE, self.bundle)
        self.sources = json.loads((self.bundle / 'source-files.json').read_text())
        for name in self.sources:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(subprocess.check_output(
                ['git', '-C', str(ROOT), 'cat-file', 'blob', evidence.SOURCE_REVISION + ':' + name], timeout=10))
        self.catalog = json.loads((self.root / 'docs/tool-catalog.json').read_text())
        self.tree = ''.join(f"100644 blob {v['gitBlob']}\t{k}\n" for k, v in self.sources.items())
        self.git_patch = patch.object(legacy, '_git', side_effect=self.git_result)
        self.git_patch.start()
        self.addCleanup(self.git_patch.stop)

    def git_result(self, root, *args):
        if args[:2] == ('merge-base', '--is-ancestor'):
            return ''
        if args[:2] == ('ls-tree', '-r'):
            return self.tree
        raise AssertionError('Unexpected Git command')

    def result(self):
        return evidence.real_account_collection_sources(self.root, self.catalog)

    def mutate(self, name, fn):
        path = self.bundle / name
        value = json.loads(path.read_text())
        fn(value)
        path.write_text(json.dumps(value))

    def test_only_collection_selection_earns_credit_despite_failed_total_batch(self):
        self.assertEqual(self.result(), {'bangumi.list_collections': {evidence.REFERENCE}})
        result = json.loads((self.bundle / 'a2-result.json').read_text())
        self.assertFalse(result['passed'])
        self.assertEqual(result['batch']['toolCallsSucceeded'], 1)
        self.assertFalse(result['batch']['pngValidated'])
        self.assertEqual(json.loads((self.bundle / 'durable-a2-claim.json').read_text())['state'], 'FAILED_OR_UNCERTAIN')

    def test_current_actual_checkout_accepts_only_the_compatible_list_call(self):
        with patch.object(legacy, '_git', wraps=self.original_git):
            catalog = json.loads((ROOT / 'docs/tool-catalog.json').read_text())
            self.assertEqual(evidence.real_account_collection_sources(ROOT, catalog), {})  # qs patch requires the separate sealed compatibility consumer
            self.assertEqual(legacy.real_account_read_sources(ROOT, catalog), {})

    original_git = staticmethod(legacy._git)

    def test_every_evidence_file_is_byte_pinned(self):
        manifest = json.loads((self.bundle / 'import.json').read_text())
        for name in manifest['evidenceFiles']:
            path = self.bundle / name; raw = path.read_bytes()
            with self.subTest(file=name):
                path.write_bytes(raw + b'\n')
                self.assertEqual(self.result(), {})
                path.write_bytes(raw)
        self.assertEqual(set(self.result()), {'bangumi.list_collections'})

    def test_manifest_cannot_select_new_tools_files_or_digests(self):
        self.mutate('import.json', lambda d: d.update({
            'admittedTools': [{'name': 'bangumi.render_collection_progress', 'input': {}}],
            'evidenceFiles': {'../../outside.json': '0' * 64}}))
        with patch.object(legacy, '_current_sources_match') as sources:
            self.assertEqual(self.result(), {})
            sources.assert_not_called()

    def test_failed_counts_synthetic_mode_and_claim_rewrites_are_rejected(self):
        for file, change in (
            ('a2-result.json', lambda d: d['batch'].update(executionKind='synthetic')),
            ('a2-result.json', lambda d: d['batch'].update(toolCallsSucceeded=0)),
            ('a2-result.json', lambda d: d['batch'].update(toolCallsAttempted=True)),
            ('a2-result.json', lambda d: d['batch'].update(cleanupConfirmed=False)),
            ('a2-result.json', lambda d: d['batch'].update(pngValidated=True)),
            ('durable-a2-claim.json', lambda d: d.update(state='COMPLETE')),
            ('postconditions.json', lambda d: d.update(durableA2ObservationMatches=False)),
            ('postconditions.json', lambda d: d.update(sameJobDefinitions=False)),
            ('postconditions.json', lambda d: d.update(activeBindings=0)),
            ('public-plan.json', lambda d: d['selection'].update(limit=2)),
        ):
            path = self.bundle / file; raw = path.read_bytes()
            with self.subTest(file=file):
                self.mutate(file, change); self.assertEqual(self.result(), {})
                path.write_bytes(raw)

    def test_private_fields_at_any_receipt_layer_cannot_be_exported_or_credited(self):
        for file in ('a2-result.json', 'public-plan.json', 'postconditions.json', 'durable-a2-claim.json', 'operator-provenance.json'):
            path = self.bundle / file; raw = path.read_bytes()
            self.mutate(file, lambda d: d.update(privateAccount='PRIVATE_CANARY'))
            self.assertEqual(self.result(), {})
            path.write_bytes(raw)

    def test_all_tracked_and_on_disk_source_pins_are_enforced(self):
        for name, entry in self.sources.items():
            path = self.root / name; raw = path.read_bytes()
            with self.subTest(path=name, plane='disk'):
                path.write_bytes(raw + b'\n'); self.assertEqual(self.result(), {}); path.write_bytes(raw)
            with self.subTest(path=name, plane='HEAD'):
                tree = self.tree
                self.tree = self.tree.replace(entry['gitBlob'], '0' * 40, 1)
                self.assertEqual(self.result(), {}); self.tree = tree

    def test_added_untracked_or_tracked_sqlite_migration_removes_credit(self):
        path = self.root / legacy.SQLITE_MIGRATIONS / '9999-new.sql'
        path.write_text('-- new migration')
        self.assertEqual(self.result(), {})
        path.unlink()
        self.tree += '100644 blob ' + '0' * 40 + '\t' + str(path.relative_to(self.root)) + '\n'
        self.assertEqual(self.result(), {})

    def test_missing_evidence_symlinks_directories_and_fifo_are_rejected(self):
        path = self.bundle / 'a2-result.json'; raw = path.read_bytes()
        path.unlink(); self.assertEqual(self.result(), {})
        outside = self.root / 'outside.json'; outside.write_bytes(raw)
        path.symlink_to(outside); self.assertEqual(self.result(), {}); path.unlink()
        path.mkdir(); self.assertEqual(self.result(), {}); path.rmdir()
        import os
        os.mkfifo(path); self.assertEqual(self.result(), {}); path.unlink()
        path.write_bytes(raw)
        parent = self.bundle; moved = parent.with_name(parent.name + '-original')
        parent.rename(moved); parent.symlink_to(moved, target_is_directory=True)
        self.assertEqual(self.result(), {})

    def test_source_links_nonblob_tree_and_catalog_drift_fail_closed(self):
        path = self.root / 'apps/mcp/package.json'; raw = path.read_bytes(); path.unlink()
        outside = self.root / 'outside-source'; outside.write_bytes(raw); path.symlink_to(outside)
        self.assertEqual(self.result(), {}); path.unlink(); path.write_bytes(raw)
        self.tree = self.tree.replace('100644 blob ', '120000 blob ', 1)
        self.assertEqual(self.result(), {})

    def test_catalog_argument_and_source_ancestry_are_required(self):
        self.assertEqual(evidence.real_account_collection_sources(self.root, self.catalog[:-1]), {})
        with patch.object(legacy, '_git', side_effect=subprocess.CalledProcessError(1, ['git'])):
            self.assertEqual(self.result(), {})

    def test_generator_changes_only_the_one_account_cell(self):
        spec = importlib.util.spec_from_file_location('a2_matrix_test', ROOT / 'scripts/generate-tool-acceptance-tasks.py')
        generator = importlib.util.module_from_spec(spec); spec.loader.exec_module(generator)
        accepted = self.result()
        for index, tool in enumerate(self.catalog):
            with self.subTest(tool=tool['name']):
                before = generator.status(tool, index, {}, {}, {}, {}, {}, {})
                after = generator.status(tool, index, {}, {}, {}, {}, {}, {}, accepted)
                self.assertEqual(before[:5] + before[6:], after[:5] + after[6:])
                self.assertEqual(after[5].startswith('✅'), tool['name'] == evidence.TOOL)
                if tool['name'] != evidence.TOOL:
                    self.assertEqual(before, after)

    def test_checker_rejects_manual_marks_render_credit_and_substituted_reference(self):
        spec = importlib.util.spec_from_file_location('a2_checker_test', ROOT / 'scripts/check-tool-acceptance-table.py')
        checker = importlib.util.module_from_spec(spec); spec.loader.exec_module(checker)
        accepted = self.result()
        tool = next(t for t in self.catalog if t['name'] == evidence.TOOL)
        correct = f'✅<br>`{evidence.REFERENCE}`'
        self.assertIsNone(checker.account_auth_reference_error(tool, correct, accepted))
        for cell in ('✅', '⬜', '—', '✅<br>`docs/live-probes/other.json`', correct + '<br>`extra`'):
            self.assertIsNotNone(checker.account_auth_reference_error(tool, cell, accepted))
        self.assertIsNotNone(checker.account_auth_reference_error(tool, correct, {}))
        for name in ('bangumi.get_my_profile', 'bangumi.render_collection_progress', 'bangumi.update_collection'):
            other = next(t for t in self.catalog if t['name'] == name)
            self.assertIsNotNone(checker.account_auth_reference_error(other, correct, accepted))

    def test_oversized_import_is_rejected_before_any_source_command(self):
        (self.bundle / 'import.json').write_bytes(b' ' * 65537)
        with patch.object(legacy, '_git') as git:
            self.assertEqual(self.result(), {}); git.assert_not_called()


if __name__ == '__main__':
    unittest.main()
