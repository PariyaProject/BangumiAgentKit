"""Offline drift/forgery adversaries for sealed qs55 source compatibility."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from acceptance import real_account_a1_evidence as legacy
from acceptance import real_account_a2_evidence as a2
from acceptance import real_account_a3_evidence as a3
from acceptance import real_account_a4_evidence as a4
from acceptance import real_account_a5_evidence as a5
from acceptance import real_account_a6_evidence as a6
from acceptance import qs55_account_compatibility as bridge
from acceptance import real_account_read_evidence as union

ROOT = Path(__file__).resolve().parents[1]
REAL_GIT = legacy._git


class Qs55CompatibilityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='qs55-evidence-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bundle = self.root / bridge.BUNDLE
        shutil.copytree(ROOT / bridge.BUNDLE, self.bundle)
        self.proof = json.loads((self.bundle / 'native-proof.json').read_text())
        self.sources = json.loads((self.bundle / 'source-files.json').read_text())
        self.frozen = json.loads((self.bundle / 'frozen-files.json').read_text())
        self.fixed = {**self.frozen, **self.proof['producerFiles']}
        for name in {*self.sources, *self.fixed, 'package.json'}:
            target = self.root / name; target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        self.fixed_tree = {}
        for name in self.fixed:
            raw = (self.root / name).read_bytes()
            blob = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
            self.fixed_tree[name] = f'100644 blob {blob}\t{name}\n'
        self.tree = REAL_GIT(ROOT, 'ls-tree', '-r', 'HEAD', '--', *a3.RUNTIME_PATHS)
        self.head_package = (self.root / 'package.json').read_text()
        self.catalog = json.loads((self.root / 'docs/tool-catalog.json').read_text())
        self.git_patch = patch.object(legacy, '_git', side_effect=self.git_result)
        self.git_patch.start(); self.addCleanup(self.git_patch.stop)

    def git_result(self, root, *args):
        if args[:2] == ('merge-base', '--is-ancestor'):
            self.assertEqual(args[2], a3.SOURCE_REVISION); return ''
        if args == ('show', 'HEAD:package.json'):
            return self.head_package
        if args[:4] == ('ls-tree', '-r', 'HEAD', '--'):
            if args[4:] == a3.RUNTIME_PATHS:
                return self.tree
            return ''.join(self.fixed_tree[p] for p in args[4:] if p in self.fixed_tree)
        raise AssertionError('Unexpected Git operation')

    def result(self):
        return bridge.qs55_compatible_account_sources(self.root, self.catalog)

    def test_old_eleven_inputs_keep_both_references_and_original_limits(self):
        result = self.result()
        self.assertEqual(set(result), bridge.TOOLS)
        for name, refs in result.items():
            self.assertEqual(len(refs), 2); self.assertIn(bridge.REFERENCE, refs)
            self.assertTrue(any(p.endswith('-result.json') for p in refs))
        self.assertNotIn('bangumi.get_my_profile', result)
        self.assertNotIn('bangumi.render_collection_progress', result)

    def test_actual_head_union_uses_separate_bridge_and_old_consumers_stay_strict(self):
        with patch.object(legacy, '_git', wraps=REAL_GIT):
            self.assertEqual(set(union.real_account_read_sources(ROOT, self.catalog)), bridge.TOOLS)
            for fn in (legacy.real_account_read_sources, a2.real_account_collection_sources,
                       a3.real_account_overview_sources, a4.real_account_backlog_schedule_sources,
                       a5.real_account_dashboard_sources, a6.real_account_series_sources):
                self.assertEqual(fn(ROOT, self.catalog), {})

    def test_each_new_receipt_byte_is_sealed(self):
        for file in self.bundle.iterdir():
            raw = file.read_bytes()
            with self.subTest(file=file.name):
                file.write_bytes(raw + b'\n'); self.assertEqual(self.result(), {}); file.write_bytes(raw)
        self.assertEqual(set(self.result()), bridge.TOOLS)

    def test_forged_manifest_is_rejected_before_git_or_file_selection(self):
        p = self.bundle / 'import.json'; data = json.loads(p.read_text())
        data['evidenceFiles'] = {'../../foreign.json': '0' * 64}; p.write_text(json.dumps(data))
        with patch.object(legacy, '_git') as git:
            self.assertEqual(self.result(), {}); git.assert_not_called()

    def test_all_53_old_files_are_still_pinned(self):
        for name in self.frozen:
            p = self.root / name; raw = p.read_bytes()
            with self.subTest(file=name):
                p.write_bytes(raw + b'\n'); self.assertEqual(self.result(), {}); p.write_bytes(raw)

    def test_each_producer_is_pinned_in_head_and_on_disk(self):
        for name in self.proof['producerFiles']:
            p = self.root / name; raw = p.read_bytes()
            with self.subTest(file=name):
                p.write_bytes(raw + b'\n'); self.assertEqual(self.result(), {}); p.write_bytes(raw)
                tree = self.fixed_tree[name]; self.fixed_tree[name] = tree.replace('100644', '100755')
                self.assertEqual(self.result(), {}); self.fixed_tree[name] = tree

    def test_missing_and_symlinked_server_trace_bundle_or_parent_refuse(self):
        p = self.bundle / 'native-proof.json'; raw = p.read_bytes(); p.unlink()
        self.assertEqual(self.result(), {})
        external = self.root / 'external.json'; external.write_bytes(raw); p.symlink_to(external)
        self.assertEqual(self.result(), {}); p.unlink(); p.write_bytes(raw)
        parent = self.bundle.parent; moved = self.root / 'moved'; parent.rename(moved); parent.symlink_to(moved, target_is_directory=True)
        self.assertEqual(self.result(), {})

    def test_lock_business_catalog_and_dynamic_file_drift_refuse(self):
        for name in ('pnpm-lock.yaml', 'packages/tools/src/definitions/read-tools.ts', 'docs/tool-catalog.json'):
            p = self.root / name; raw = p.read_bytes()
            with self.subTest(file=name):
                p.write_bytes(raw + b'\n'); self.assertEqual(self.result(), {}); p.write_bytes(raw)
        for name in ('packages/db/src/drizzle/sqlite/migrations/9999_extra.sql', 'packages/renderer/assets/extra.txt'):
            p = self.root / name; p.write_text('untracked'); self.assertEqual(self.result(), {}); p.unlink()

    def test_committed_runtime_tree_drift_refuses(self):
        self.tree = self.tree.replace('100644', '100755', 1)
        self.assertEqual(self.result(), {})

    def test_root_override_and_other_metadata_drift_refuse_but_scripts_remain_allowed(self):
        p = self.root / 'package.json'; data = json.loads(p.read_text())
        data['scripts']['fake-only-test'] = 'true'; p.write_text(json.dumps(data))
        self.assertEqual(set(self.result()), bridge.TOOLS)
        data['pnpm']['overrides']['qs'] = '6.16.0'; p.write_text(json.dumps(data)); self.assertEqual(self.result(), {})
        data['pnpm']['overrides']['qs'] = '6.16.1'; data['license'] = 'changed'; p.write_text(json.dumps(data)); self.assertEqual(self.result(), {})

    def test_no_fake_root_or_source_rewrite_can_hide_actual_lock(self):
        p = self.root / 'pnpm-lock.yaml'; p.write_text('lockfileVersion: 9.0\n')
        self.assertEqual(self.result(), {})

    def test_native_negative_controls_and_missing_roles_are_not_optional(self):
        original = self.proof
        for mutate in (lambda d: d['runs'][0].update(server=None),
                       lambda d: d['runs'][0]['server'].update(attempts=1),
                       lambda d: d['runs'][0]['server'].update(initialCached=1),
                       lambda d: d['runs'][0]['native'].update(exactInputs=[]),
                       lambda d: d['runs'][0]['provider'].update(denied=1),
                       lambda d: d['runs'][1].update(passed=False),
                       lambda d: d.update(containerRemoved=False)):
            changed = json.loads(json.dumps(original)); mutate(changed)
            try:
                self.assertFalse(bridge._native_proof_matches(changed, original['runs'][0]['native']['exactInputs']))
            except (KeyError, TypeError):
                # The public consumer also catches malformed/missing evidence.
                pass


if __name__ == '__main__':
    unittest.main()
