"""Offline adversaries for the exact twelve-input compiled compatibility anchor."""
import copy
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from source_snapshot_fixture import read_source_snapshot
from acceptance import calendar_account_compatibility as evidence
from acceptance import real_account_a1_evidence as receipts
from acceptance import real_account_a3_evidence as shared
from acceptance import qs55_account_compatibility as qs55

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL_GIT = receipts._git


class CalendarAccountCompatibilityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='calendar-account-import-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bundle = self.root / evidence.BUNDLE
        shutil.copytree(ROOT / evidence.BUNDLE, self.bundle)
        self.proof = json.loads((self.bundle / 'native-proof.json').read_bytes())
        self.sources = self.proof['source']['sources']
        fixed = {**self.proof['protectedFiles'], **self.proof['producerFiles']}
        for name in fixed:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        for name, raw in read_source_snapshot(ROOT, self.sources).items():
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
        self.package = copy.deepcopy(self.proof['source']['rootPackage'])
        self.package['scripts']['acceptance:check'] = 'synthetic test command'
        (self.root / 'package.json').write_text(json.dumps(self.package))
        self.catalog = json.loads((self.root / 'docs/tool-catalog.json').read_bytes())
        self.tree = ORIGINAL_GIT(ROOT, 'ls-tree', '-r', evidence.SOURCE_REVISION, '--', *shared.RUNTIME_PATHS)
        fixed.update({evidence.REFERENCE: evidence.IMPORT_SHA256})
        fixed.update({evidence.BUNDLE + '/' + p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in self.bundle.iterdir()})
        self.fixed_tree = {}
        for name in fixed:
            self.refresh_git_blob(name)
        git = patch.object(receipts, '_git', side_effect=self.git_result)
        git.start(); self.addCleanup(git.stop)

    def refresh_git_blob(self, name):
        raw = (self.root / name).read_bytes()
        blob = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
        self.fixed_tree[name] = f'100644 blob {blob}\t{name}\n'

    def git_result(self, root, *args):
        if args[:2] == ('merge-base', '--is-ancestor'):
            self.assertIn(args[2], (evidence.SOURCE_REVISION, shared.SOURCE_REVISION))
            self.assertEqual(args[3], 'HEAD')
            return ''
        if args[:2] == ('ls-tree', '-r'):
            names = args[4:]
            if names == shared.RUNTIME_PATHS:
                return self.tree
            return ''.join(self.fixed_tree[name] for name in names if name in self.fixed_tree)
        if args == ('show', 'HEAD:package.json'):
            return json.dumps(self.package)
        if args == ('show', evidence.a7.SOURCE_REVISION + ':package.json'):
            return ORIGINAL_GIT(ROOT, *args)
        raise AssertionError('Only bounded local Git reads are permitted')

    def result(self, catalog=None):
        return evidence.calendar_compatible_account_sources(self.root, self.catalog if catalog is None else catalog)

    def test_twelve_original_partial_observations_keep_their_compatibility_chain(self):
        result = self.result()
        self.assertEqual(set(result), evidence.TOOLS)
        for name, original in self.proof['originalReferences'].items():
            expected = {original, evidence.REFERENCE}
            if name in qs55.TOOLS: expected.add(qs55.REFERENCE)
            self.assertEqual(result[name], expected)
        for name in ('bangumi.get_my_profile', 'bangumi.render_collection_progress', 'bangumi.render_calendar'):
            self.assertNotIn(name, result)

    def test_semantics_refuse_a_preparation_or_incomplete_native_proof(self):
        self.assertTrue(evidence._proof_matches(self.proof, self.proof['exactInputs']))
        for change in (
            lambda p: p.update(schema='calendar-account-closed-preparation/v1'),
            lambda p: p.update(passed=False), lambda p: p.update(realDataMounts=1),
            lambda p: p.update(modelCalls=1), lambda p: p.update(clientMessages=1),
            lambda p: p.update(containerNetwork='bridge'), lambda p: p.update(containerReadOnly=False),
            lambda p: p.update(containerRemoved=False), lambda p: p.update(originalParentPreserved=False),
            lambda p: p.update(realDataMounts=False), lambda p: p['exactInputs'].pop(),
            lambda p: p['exactInputs'][0]['input'].update(limit=True),
        ):
            value = copy.deepcopy(self.proof); change(value)
            self.assertFalse(evidence._proof_matches(value, self.proof['exactInputs']))

    def test_semantics_require_exact_compiled_and_actually_loaded_modules(self):
        for change in (
            lambda p: p['projection'].update(parentProjectionExact=False),
            lambda p: p['projection'].update(currentDistExact=False),
            lambda p: p['projection'].update(typescript='other'),
            lambda p: p['projection']['files'][0].update(sourceSha256='f' * 64),
            lambda p: p['projection']['files'][0].update(parentSha256='f' * 64),
            lambda p: p['projection']['files'][0].update(parentPath='/another/module.js'),
            lambda p: p['runs'][0]['server'].update(loadedRuntimeFiles={}),
            lambda p: p['stagedPrograms'].pop(next(iter(p['stagedPrograms']))),
        ):
            value = copy.deepcopy(self.proof); change(value)
            self.assertFalse(evidence._proof_matches(value, self.proof['exactInputs']))

    def test_semantics_require_both_network_guards_and_all_five_negative_controls(self):
        for change in (
            lambda p: p['runs'][0]['controller'].update(networkAttempts=1),
            lambda p: p['runs'][0]['server'].update(networkAttempts=1),
            lambda p: p['runs'][0]['server'].update(initialCached=1),
            lambda p: p['runs'][0]['server'].update(fixtureFetchInstalled=False),
            lambda p: p['runs'].pop(), lambda p: p['runs'][1].update(passed=False),
            lambda p: p['runs'][2]['server'].update(attempts=0),
            lambda p: p['runs'][3]['server'].update(initialCached=0),
            lambda p: p['runs'][4]['controller'].update(networkAttempts=0),
            lambda p: p['runs'][5]['server'].update(networkAttempts=0),
        ):
            value = copy.deepcopy(self.proof); change(value)
            self.assertFalse(evidence._proof_matches(value, self.proof['exactInputs']))

    def test_semantics_require_twelve_calls_five_decodes_selection_and_private_cache_exclusion(self):
        for change in (
            lambda p: p['runs'][0]['native'].update(episodeSelectionValidated=False),
            lambda p: p['runs'][0]['native']['results'].pop(),
            lambda p: p['runs'][0]['native']['results'][2].update(nativePngDecoded=False),
            lambda p: p['runs'][0]['provider'].update(privateCacheDisabled=False),
            lambda p: p['runs'][0]['provider'].update(cacheWrites=1),
            lambda p: p['runs'][0]['provider'].update(assetAttempts=1),
            lambda p: p['runs'][0]['provider']['calls'][-1].update(limit=2),
            lambda p: p['runs'][0]['provider']['calls'].append({'kind':'unknown','step':11}),
        ):
            value = copy.deepcopy(self.proof); change(value)
            self.assertFalse(evidence._proof_matches(value, self.proof['exactInputs']))

    def test_manifest_and_every_native_byte_stay_sealed(self):
        for name in ('import.json', 'native-proof.json', 'failed-first-native-proof.json'):
            path = self.bundle / name; raw = path.read_bytes(); path.write_bytes(raw + b'\n')
            self.assertEqual(self.result(), {}); path.write_bytes(raw)
        self.assertEqual(len(self.result()), 12)

    def test_changed_historical_receipt_consumer_or_current_producer_loses_credit(self):
        for name in (evidence.a7.REFERENCE, next(iter(self.proof['producerFiles'])), evidence.OLD_READERS[0]):
            path = self.root / name; raw = path.read_bytes(); path.write_bytes(raw + b'\n')
            self.assertEqual(self.result(), {}); path.write_bytes(raw)
        self.assertEqual(len(self.result()), 12)

    def test_runtime_disk_tree_mode_and_membership_drift_lose_credit(self):
        path = self.root / 'packages/renderer/src/templates/CalendarCard.tsx'; raw = path.read_bytes()
        path.write_bytes(raw + b'\n'); self.assertEqual(self.result(), {}); path.write_bytes(raw)
        tree = self.tree
        self.tree = tree.replace('100644', '120000', 1); self.assertEqual(self.result(), {})
        self.tree = tree + '\n100644 blob ' + 'f' * 40 + '\tpackages/new.ts'; self.assertEqual(self.result(), {})
        self.tree = tree
        self.assertEqual(len(self.result()), 12)

    def test_dynamic_sql_assets_and_optional_config_refuse_untracked_additions(self):
        for name in (receipts.SQLITE_MIGRATIONS + '/extra.sql', shared.RENDER_ASSETS + '/extra.bin', '.npmrc'):
            path = self.root / name; path.write_bytes(b'synthetic')
            self.assertEqual(self.result(), {}); path.unlink()

    def test_optional_config_all_file_types_and_evidence_directory_aliases_refuse(self):
        path = self.root / '.npmrc'
        outside = self.root / 'outside'; outside.write_text('synthetic')
        for kind in ('symlink', 'dangling', 'directory', 'fifo'):
            if kind == 'symlink': path.symlink_to(outside)
            elif kind == 'dangling': path.symlink_to(self.root / 'absent')
            elif kind == 'directory': path.mkdir()
            else: os.mkfifo(path)
            try: self.assertEqual(self.result(), {})
            finally:
                if kind == 'directory': path.rmdir()
                else: path.unlink()
        relocated = self.root / 'bundle-elsewhere'; self.bundle.rename(relocated); self.bundle.symlink_to(relocated, target_is_directory=True)
        self.assertEqual(self.result(), {})

    def test_root_build_metadata_and_unknown_scripts_refuse_on_disk_and_in_git(self):
        path = self.root / 'package.json'; original = copy.deepcopy(self.package)
        self.package['scripts']['acceptance:check'] = 'a changed acceptance command'
        path.write_text(json.dumps(self.package)); self.assertEqual(len(self.result()), 12)
        for change in (lambda p: p['scripts'].update(build='changed'), lambda p: p.update(version='changed'), lambda p: p['scripts'].update(extra='changed')):
            disk = copy.deepcopy(original); change(disk); path.write_text(json.dumps(disk))
            self.assertEqual(self.result(), {}); path.write_text(json.dumps(original))
            self.package = copy.deepcopy(original); change(self.package)
            self.assertEqual(self.result(), {}); self.package = copy.deepcopy(original)

    def test_changed_catalog_or_public_auth_metadata_cannot_inherit_account_credit(self):
        changed = copy.deepcopy(self.catalog)
        next(t for t in changed if t['name'] == evidence.a7.TOOL)['auth'] = 'none'
        self.assertEqual(self.result(changed), {})
        path = self.root / 'docs/tool-catalog.json'; path.write_text(json.dumps(changed))
        self.assertEqual(self.result(changed), {})


class CurrentCheckoutCalendarCompatibilityTests(unittest.TestCase):
    def test_shared_person_source_change_requires_its_own_successor_witness(self):
        catalog = json.loads((ROOT / 'docs/tool-catalog.json').read_bytes())
        result = evidence.calendar_compatible_account_sources(ROOT, catalog)
        self.assertEqual(result, {})
        self.assertEqual(qs55.qs55_compatible_account_sources(ROOT, catalog), {})


if __name__ == '__main__':
    unittest.main()
