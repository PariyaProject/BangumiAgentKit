"""Offline adversaries for the source-bound native entity-page successor witness."""
import copy
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile
import unittest
from unittest.mock import patch

from source_snapshot_fixture import read_source_snapshot
from acceptance import entity_page_account_compatibility as evidence
from acceptance import real_account_a1_evidence as receipts
from acceptance import real_account_a3_evidence as shared
from acceptance import real_account_read_evidence as union

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL_GIT = receipts._git


class EntityPageAccountCompatibilityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='entity-page-account-import-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bundle = self.root / evidence.BUNDLE
        shutil.copytree(ROOT / evidence.BUNDLE, self.bundle)
        self.proof = json.loads((self.bundle / evidence.PROOF_FILE).read_bytes())
        self.sources = self.proof['source']['sources']
        fixed = {**self.proof['protectedFiles'], **self.proof['producerFiles']}
        for name in fixed:
            target = self.root / name; target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        for name, raw in read_source_snapshot(ROOT, self.sources).items():
            target = self.root / name; target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(raw)
        self.package = copy.deepcopy(self.proof['source']['rootPackage'])
        self.package['scripts']['acceptance:check'] = 'synthetic test command'
        (self.root / 'package.json').write_text(json.dumps(self.package))
        self.catalog = json.loads((self.root / 'docs/tool-catalog.json').read_bytes())
        self.tree = ORIGINAL_GIT(ROOT, 'ls-tree', '-r', evidence.SOURCE_REVISION, '--', *shared.RUNTIME_PATHS)
        fixed[evidence.REFERENCE] = evidence.IMPORT_SHA256
        fixed.update({evidence.BUNDLE + '/' + p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in self.bundle.iterdir()})
        self.fixed_tree = {}
        for name in fixed:
            raw = (self.root / name).read_bytes()
            blob = hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest()
            self.fixed_tree[name] = f'100644 blob {blob}\t{name}\n'
        git = patch.object(receipts, '_git', side_effect=self.git_result)
        git.start(); self.addCleanup(git.stop)

    def git_result(self, root, *args):
        if args[:2] == ('merge-base', '--is-ancestor'):
            self.assertIn(args[2], (evidence.SOURCE_REVISION, shared.SOURCE_REVISION))
            self.assertEqual(args[3], 'HEAD'); return ''
        if args[:2] == ('ls-tree', '-r'):
            names = args[4:]
            if names == shared.RUNTIME_PATHS: return self.tree
            return ''.join(self.fixed_tree[name] for name in names if name in self.fixed_tree)
        if args == ('show', 'HEAD:package.json'): return json.dumps(self.package)
        if args == ('show', evidence.a7.SOURCE_REVISION + ':package.json'):
            return ORIGINAL_GIT(ROOT, *args)
        raise AssertionError('Only bounded local Git reads are permitted')

    def result(self, catalog=None):
        return evidence.entity_page_compatible_account_sources(self.root, self.catalog if catalog is None else catalog)

    def reject_mutations(self, changes):
        self.assertTrue(evidence._proof_matches(self.proof, self.proof['exactInputs']))
        for index, change in enumerate(changes):
            value = copy.deepcopy(self.proof); change(value)
            with self.subTest(mutation=index):
                self.assertFalse(evidence._proof_matches(value, self.proof['exactInputs']))

    def test_exact_original_twelve_and_no_new_person_or_account_credit(self):
        result = self.result()
        self.assertEqual(set(result), evidence.TOOLS)
        for name, ref in self.proof['originalReferences'].items():
            expected = {ref, evidence.REFERENCE}
            if name in evidence.qs55.TOOLS: expected.add(evidence.qs55.REFERENCE)
            self.assertEqual(result[name], expected)
        for name in (*evidence.PAGE_TOOLS, 'bangumi.get_my_profile', 'bangumi.render_collection_progress'):
            self.assertNotIn(name, result)

    def test_preparation_failure_expanded_input_and_unsafe_container_refuse(self):
        self.reject_mutations((
            lambda p: p.update(schema='entity-page-closed-preparation/v1'),
            lambda p: p.update(passed=False), lambda p: p.update(closedPassed=False),
            lambda p: p.update(pagePassed=False), lambda p: p.update(realAccountActions=1),
            lambda p: p.update(modelCalls=1), lambda p: p.update(clientMessages=1),
            lambda p: p.update(realDataMounts=False), lambda p: p.update(codeMounts=4),
            lambda p: p.update(containerNetwork='bridge'), lambda p: p.update(containerReadOnly=False),
            lambda p: p.update(containerRemoved=False), lambda p: p.update(originalParentPreserved=False),
            lambda p: p.update(originalInputsExpanded=True), lambda p: p['exactInputs'].pop(),
            lambda p: p['exactInputs'][0]['input'].update(limit=True),
        ))

    def test_compiler_inventory_actual_loaded_modules_and_child_preload_refuse_drift(self):
        self.reject_mutations((
            lambda p: p['projection'].update(parentProjectionExact=False),
            lambda p: p['projection'].update(allOtherEmittedJavaScriptUnchanged=False),
            lambda p: p['projection'].update(currentDistExact=False),
            lambda p: p['projection']['emittedFiles'].pop(),
            lambda p: p['projection']['files'].pop(),
            lambda p: p['projection']['files'][0].update(parentPath='/other.js'),
            lambda p: p['projection']['files'][0].update(emittedSha256='f' * 64),
            lambda p: p['projection']['sourceFiles'].update({'packages/bangumi-core/src/models/user.ts': 'f' * 64}),
            lambda p: p['closedCore']['driver'].update(nodeChildrenPreloaded=5),
            lambda p: p['closedCore']['server'].update(loadedRuntimeFiles={}),
            lambda p: p['page']['coreTraces']['controller'].update(nodeChildrenPreloaded=0),
            lambda p: p['page']['coreTraces']['server'].update(loadedRuntimeFiles={}),
            lambda p: p['stagedPrograms'].pop(next(iter(p['stagedPrograms']))),
        ))

    def test_frozen_network_negative_modes_inputs_pngs_and_selection_remain_required(self):
        self.reject_mutations((
            lambda p: p['closedTwelve']['runs'].pop(),
            lambda p: p['closedTwelve']['runs'][0]['controller'].update(networkAttempts=1),
            lambda p: p['closedTwelve']['runs'][0]['server'].update(loadedRuntimeFiles={}),
            lambda p: p['closedTwelve']['runs'][0]['native'].update(episodeSelectionValidated=False),
            lambda p: p['closedTwelve']['runs'][0]['native']['results'][2].update(nativePngDecoded=False),
            lambda p: p['closedTwelve']['runs'][0]['provider']['calls'][-1].update(limit=2),
            lambda p: p['closedTwelve']['runs'][1]['server'].update(attempts=0),
            lambda p: p['closedTwelve']['runs'][2]['server'].update(attempts=0),
            lambda p: p['closedTwelve']['runs'][3]['server'].update(initialCached=0),
            lambda p: p['closedTwelve']['runs'][4]['controller'].update(networkAttempts=0),
            lambda p: p['closedTwelve']['runs'][5]['server'].update(networkAttempts=0),
        ))

    def test_new_page_window_selector_errors_caps_and_exact_requests_refuse_missing_proof(self):
        self.reject_mutations((
            lambda p: p['page']['native']['results'].pop(),
            lambda p: p['page']['native']['results'][6].update(passed=False),
            lambda p: p['page']['native']['results'][0].update(case='empty'),
            lambda p: p['page']['native'].update(mcpClosed=False),
            lambda p: p['page']['native']['results'][0]['page'].update(limit=2),
            lambda p: p['page']['native']['results'][1].update(selectedFromStep=1),
            lambda p: p['page']['native']['results'][1].update(id=21),
            lambda p: p['page']['native']['results'][2]['page'].update(nextOffset=2),
            lambda p: p['page']['native']['results'][3]['page'].update(empty='page_empty'),
            lambda p: p['page']['native']['results'][4]['page'].update(hasMore=False),
            lambda p: p['page']['native']['results'][5].update(errorCode='NOT_FOUND'),
            lambda p: p['page']['provider'].update(offeredBytes=262144),
            lambda p: p['page']['provider'].update(bodyCancelled=False),
            lambda p: p['page']['provider'].update(headerBodyCancelled=0),
            lambda p: p['page']['provider'].update(rejectingCancelAttempts=0),
            lambda p: p['page']['provider']['abortedSteps'].pop(),
            lambda p: p.update(firstCandidateWitnessPreserved=False),
            lambda p: p['page']['provider'].update(assetAttempts=1),
            lambda p: p['page']['provider'].update(renderCalls=1),
            lambda p: p['page']['provider']['calls'].pop(),
            lambda p: p['page']['provider']['calls'].append(p['page']['provider']['calls'][6]),
            lambda p: p['page']['provider']['calls'][0].update(limit='2'),
            lambda p: p['page']['networkTraces']['controller'].update(networkAttempts=1),
            lambda p: p['page']['networkTraces']['server'].update(initialCached=1),
            lambda p: p['projection'].update(newParentModuleAbsent=False),
            lambda p: p['projection']['files'][-1].update(added=True),
            lambda p: p['closedCore']['controller'].update(loadedRuntimeFiles={}),
        ))

    def test_every_manifest_native_historical_and_producer_byte_stays_fixed(self):
        for name in (evidence.REFERENCE, evidence.BUNDLE + '/' + evidence.PROOF_FILE, evidence.a7.REFERENCE,
                'scripts/acceptance/calendar_account_compatibility.py',
                'scripts/acceptance/calendar-account-closed-driver.mjs',
                'scripts/acceptance/person-account-core-guard.mjs',
                'scripts/acceptance/entity-page-source-guard.mjs', evidence.BUNDLE + '/import.json',
                evidence.BUNDLE + '/native-proof.json', evidence.prior.REFERENCE,
                evidence.prior.BUNDLE + '/native-proof.json'):
            path = self.root / name; raw = path.read_bytes(); path.write_bytes(raw + b'\n')
            self.assertEqual(self.result(), {}); path.write_bytes(raw)
        self.assertEqual(len(self.result()), 12)

    def test_runtime_disk_git_membership_mode_and_dynamic_additions_refuse(self):
        path = self.root / 'packages/bangumi-core/src/services/user-service.ts'; raw = path.read_bytes()
        path.write_bytes(raw + b'\n'); self.assertEqual(self.result(), {}); path.write_bytes(raw)
        original = self.tree
        self.tree = original.replace('100644', '120000', 1); self.assertEqual(self.result(), {})
        self.tree = original + '\n100644 blob ' + 'f' * 40 + '\tpackages/new.ts'; self.assertEqual(self.result(), {})
        self.tree = original
        for name in (receipts.SQLITE_MIGRATIONS + '/extra.sql', shared.RENDER_ASSETS + '/extra.bin', '.npmrc'):
            path = self.root / name; path.write_bytes(b'synthetic')
            self.assertEqual(self.result(), {}); path.unlink()
        self.assertEqual(len(self.result()), 12)

    def test_evidence_and_absent_configuration_aliases_all_file_types_refuse(self):
        path = self.root / '.npmrc'; outside = self.root / 'outside'; outside.write_text('synthetic')
        for kind in ('symlink', 'dangling', 'directory', 'fifo'):
            if kind == 'symlink': path.symlink_to(outside)
            elif kind == 'dangling': path.symlink_to(self.root / 'absent')
            elif kind == 'directory': path.mkdir()
            else: os.mkfifo(path)
            try: self.assertEqual(self.result(), {})
            finally:
                if kind == 'directory': path.rmdir()
                else: path.unlink()
        relocated = self.root / 'relocated'; self.bundle.rename(relocated)
        self.bundle.symlink_to(relocated, target_is_directory=True)
        self.assertEqual(self.result(), {})

    def test_root_runtime_metadata_and_catalog_cannot_gain_new_authority(self):
        path = self.root / 'package.json'; original = copy.deepcopy(self.package)
        self.package['scripts']['acceptance:check'] = 'changed acceptance command'
        path.write_text(json.dumps(self.package)); self.assertEqual(len(self.result()), 12)
        for change in (lambda p: p['scripts'].update(build='changed'), lambda p: p.update(version='changed')):
            disk = copy.deepcopy(original); change(disk); path.write_text(json.dumps(disk))
            self.assertEqual(self.result(), {}); path.write_text(json.dumps(original))
            self.package = copy.deepcopy(original); change(self.package)
            self.assertEqual(self.result(), {}); self.package = copy.deepcopy(original)
        changed = copy.deepcopy(self.catalog)
        next(t for t in changed if t['name'] == evidence.a7.TOOL)['auth'] = 'none'
        self.assertEqual(self.result(changed), {})


class CurrentCheckoutEntityPageCompatibilityTests(unittest.TestCase):
    def test_committed_current_graph_has_only_original_twelve_without_runtime_access(self):
        catalog = json.loads((ROOT / 'docs/tool-catalog.json').read_bytes())
        current = evidence.entity_page_compatible_account_sources(ROOT, catalog)
        self.assertEqual(set(current), evidence.TOOLS)
        self.assertEqual(union.real_account_read_sources(ROOT, catalog), current)
        self.assertEqual(evidence.prior.person_compatible_account_sources(ROOT, catalog), {})
        self.assertEqual(evidence.calendar.calendar_compatible_account_sources(ROOT, catalog), {})
        self.assertEqual(evidence.qs55.qs55_compatible_account_sources(ROOT, catalog), {})


if __name__ == '__main__':
    unittest.main()
