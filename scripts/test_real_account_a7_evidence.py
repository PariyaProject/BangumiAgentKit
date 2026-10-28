"""Offline adversaries for one fixed completed, partial native episode read."""
import copy
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from acceptance import real_account_a1_evidence as receipts
from acceptance import real_account_a3_evidence as shared
from acceptance import real_account_a7_evidence as evidence
from acceptance import real_account_read_evidence as union
from acceptance import qs55_account_compatibility as compatibility

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL_GIT = receipts._git


class RealAccountA7EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='bgk-a7-fixed-receipt-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bundle = self.root / evidence.BUNDLE
        shutil.copytree(ROOT / evidence.BUNDLE, self.bundle)
        self.sources = json.loads((self.bundle / 'source-files.json').read_bytes())
        for name in self.sources:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        self.package = json.loads(subprocess.check_output([
            'git', '-C', str(ROOT), 'show', evidence.SOURCE_REVISION + ':package.json'], timeout=10))
        (self.root / 'package.json').write_text(json.dumps(self.package))
        self.catalog = json.loads((self.root / 'docs/tool-catalog.json').read_bytes())
        self.tree = ORIGINAL_GIT(ROOT, 'ls-tree', '-r', evidence.SOURCE_REVISION, '--', *evidence.RUNTIME_PATHS)
        git = patch.object(receipts, '_git', side_effect=self.git_result)
        git.start(); self.addCleanup(git.stop)

    def git_result(self, root, *args):
        if args[:2] == ('merge-base', '--is-ancestor'):
            self.assertIn(args[2], (shared.SOURCE_REVISION, evidence.SOURCE_REVISION))
            self.assertEqual(args[3], 'HEAD')
            return ''
        if args[:2] == ('ls-tree', '-r'):
            return self.tree
        if args == ('show', 'HEAD:package.json'):
            return json.dumps(self.package)
        raise AssertionError('Unexpected source-only Git command')

    def result(self):
        return evidence.real_account_episode_sources(self.root, self.catalog)

    def mutate(self, name, change):
        path = self.bundle / name
        value = json.loads(path.read_bytes()); change(value)
        path.write_text(json.dumps(value))

    def test_completed_native_partial_page_earns_only_episode_tool(self):
        self.assertEqual(self.result(), {evidence.TOOL: {evidence.REFERENCE}})
        result = json.loads((self.bundle / 'a7-result.json').read_bytes())
        batch = result['batch']; diagnostic = batch['diagnostic']
        self.assertTrue(result['passed']); self.assertEqual(result['phase'], 'COMPLETE')
        self.assertEqual([batch[k] for k in ('toolCallsAttempted', 'toolCallsSucceeded', 'apiRequests', 'selectionRows', 'episodeRows')], [2, 2, 2, 1, 1])
        self.assertEqual([batch[k] for k in ('coverRequests', 'imageCalls', 'modelCalls', 'clientActions')], [0, 0, 0, 0])
        self.assertTrue(batch['targetReadValidated']); self.assertTrue(batch['claimFinalized']); self.assertTrue(batch['cleanupConfirmed'])
        self.assertEqual(diagnostic['targetState'], 'partial')
        self.assertEqual((diagnostic['knownStatusRows'], diagnostic['unknownStatusRows']), (1, 0))
        self.assertTrue(diagnostic['rowSubjectBinding'])
        self.assertTrue(diagnostic['mcpClosed']); self.assertTrue(diagnostic['bootstrapRemoved'])
        manifest = json.loads((self.bundle / 'import.json').read_bytes())
        self.assertEqual(manifest['admittedTools'], [{'name': evidence.TOOL, 'input': {
            'subjectId': 'sole-validated-selection-in-memory', 'episodeType': 0, 'limit': 1, 'offset': 0}}])
        self.assertFalse(manifest['selectionOnly']['additionalCredit'])
        claim = json.loads((self.bundle / 'durable-a7-claim.json').read_bytes())
        self.assertEqual(claim['state'], 'COMPLETE'); self.assertEqual(claim['observation']['apiRequests'], 2)
        post = json.loads((self.bundle / 'postconditions.json').read_bytes())
        self.assertTrue(post['protectedA1A2A3A4A5A6ClaimBytesPreserved'])
        self.assertEqual(post['a7ClaimSha256'], hashlib.sha256((self.bundle / 'durable-a7-claim.json').read_bytes()).hexdigest())

    def test_actual_union_adds_one_to_the_exact_eleven_compatible_cells(self):
        with patch.object(receipts, '_git', wraps=ORIGINAL_GIT):
            catalog = json.loads((ROOT / 'docs/tool-catalog.json').read_bytes())
            before = compatibility.qs55_compatible_account_sources(ROOT, catalog)
            after = union.real_account_read_sources(ROOT, catalog)
            self.assertEqual(len(before), 11); self.assertEqual(len(after), 12)
            self.assertEqual(set(after) - set(before), {evidence.TOOL})
            self.assertEqual({k: after[k] for k in before}, before)
            self.assertEqual(after[evidence.TOOL], {evidence.REFERENCE})
            self.assertNotIn('bangumi.get_my_profile', after)
            self.assertNotIn('bangumi.render_collection_progress', after)

    def test_all_fifty_three_old_frozen_bytes_are_unchanged(self):
        frozen = json.loads((ROOT / compatibility.BUNDLE / 'frozen-files.json').read_bytes())
        self.assertEqual(len(frozen), 53)
        for name, expected in frozen.items():
            with self.subTest(file=name):
                self.assertEqual(hashlib.sha256((ROOT / name).read_bytes()).hexdigest(), expected)
                raw = subprocess.check_output(['git', '-C', str(ROOT), 'show', 'HEAD:' + name], timeout=10)
                self.assertEqual(hashlib.sha256(raw).hexdigest(), expected)

    def test_every_fixed_evidence_byte_is_pinned(self):
        manifest = json.loads((self.bundle / 'import.json').read_bytes())
        self.assertEqual(len(manifest['evidenceFiles']), 7)
        for name in manifest['evidenceFiles']:
            with self.subTest(file=name):
                path = self.bundle / name; raw = path.read_bytes()
                path.write_bytes(raw + b'\n'); self.assertEqual(self.result(), {}); path.write_bytes(raw)
        self.assertEqual(set(self.result()), {evidence.TOOL})

    def test_manifest_cannot_choose_another_tool_input_file_or_digest(self):
        path = self.bundle / 'import.json'; raw = path.read_bytes()
        for change in (lambda v: v['admittedTools'][0].update(name='bangumi.get_my_profile'),
                       lambda v: v['admittedTools'][0]['input'].update(limit=2),
                       lambda v: v['selectionOnly'].update(additionalCredit=True),
                       lambda v: v['evidenceFiles'].update({'../../outside.json': '0' * 64}),
                       lambda v: v.update(executedSourceRevision='f' * 40)):
            value = json.loads(raw); change(value); path.write_text(json.dumps(value))
            self.assertEqual(self.result(), {}); path.write_bytes(raw)

    def test_failed_synthetic_extra_requests_or_changed_semantics_never_inherit_credit(self):
        path = self.bundle / 'a7-result.json'; raw = path.read_bytes()
        for change in (lambda v: v.update(passed=False), lambda v: v.update(servicesRestored=False),
                       lambda v: v['batch'].update(executionKind='synthetic'),
                       lambda v: v['batch'].update(apiRequests=1), lambda v: v['batch'].update(apiRequests=3),
                       lambda v: v['batch'].update(toolCallsSucceeded=True),
                       lambda v: v['batch'].update(targetReadValidated=False),
                       lambda v: v['batch'].update(coverRequests=1),
                       lambda v: v['batch']['diagnostic'].update(targetState='complete'),
                       lambda v: v['batch']['diagnostic'].update(knownStatusRows=0, unknownStatusRows=1),
                       lambda v: v['batch']['diagnostic'].update(rowSubjectBinding=False)):
            value = json.loads(raw); change(value); path.write_text(json.dumps(value))
            self.assertEqual(self.result(), {}); path.write_bytes(raw)

    def test_private_or_unknown_fields_in_any_fixed_json_remove_credit(self):
        for name in ('a7-result.json', 'durable-a7-claim.json', 'public-plan.json', 'postconditions.json', 'operator-provenance.json'):
            with self.subTest(file=name):
                path = self.bundle / name; raw = path.read_bytes()
                self.mutate(name, lambda v: v.update(privateIdentifier='PRIVATE_SENTINEL'))
                self.assertEqual(self.result(), {}); path.write_bytes(raw)

    def test_claim_state_and_plan_drift_remove_credit(self):
        path = self.bundle / 'durable-a7-claim.json'; raw = path.read_bytes()
        for change in (lambda v: v.update(state='STARTED'), lambda v: v.update(planSha256='f' * 64),
                       lambda v: v['observation'].update(episodeRows=0)):
            value = json.loads(raw); change(value); path.write_text(json.dumps(value))
            self.assertEqual(self.result(), {}); path.write_bytes(raw)

    def test_changed_disk_source_and_git_mode_or_membership_remove_credit(self):
        path = self.root / 'apps/mcp/src/main.ts'; raw = path.read_bytes()
        path.write_bytes(raw + b'\n'); self.assertEqual(self.result(), {}); path.write_bytes(raw)
        old_tree = self.tree
        self.tree = self.tree.replace('100644', '120000', 1); self.assertEqual(self.result(), {})
        self.tree = old_tree + '\n100644 blob ' + 'f' * 40 + '\tpackages/new.ts'; self.assertEqual(self.result(), {})
        self.tree = old_tree; self.assertEqual(set(self.result()), {evidence.TOOL})

    def test_untracked_dynamic_sql_asset_and_source_links_remove_credit(self):
        for relative in (receipts.SQLITE_MIGRATIONS + '/new.sql', 'packages/renderer/assets/new.bin'):
            path = self.root / relative; path.write_bytes(b'synthetic'); self.assertEqual(self.result(), {}); path.unlink()
        path = self.root / 'apps/mcp/src/main.ts'; raw = path.read_bytes(); path.unlink()
        outside = self.root / 'outside-source'; outside.write_bytes(raw); path.symlink_to(outside)
        self.assertEqual(self.result(), {})

    def test_only_root_scripts_can_evolve_in_both_head_and_disk(self):
        self.package['scripts']['test:a7-fixture'] = 'true'
        (self.root / 'package.json').write_text(json.dumps(self.package)); self.assertEqual(set(self.result()), {evidence.TOOL})
        self.package['version'] = 'changed'; self.assertEqual(self.result(), {})
        self.package['version'] = json.loads((ROOT / 'package.json').read_bytes())['version']
        disk = copy.deepcopy(self.package); disk['pnpm']['overrides']['qs'] = '6.15.0'
        (self.root / 'package.json').write_text(json.dumps(disk)); self.assertEqual(self.result(), {})

    def test_missing_symlink_directory_fifo_and_parent_links_refuse(self):
        path = self.bundle / 'a7-result.json'; raw = path.read_bytes(); path.unlink(); self.assertEqual(self.result(), {})
        target = self.root / 'outside.json'; target.write_bytes(raw); path.symlink_to(target)
        self.assertEqual(self.result(), {}); path.unlink(); path.mkdir(); self.assertEqual(self.result(), {})
        path.rmdir(); os.mkfifo(path); self.assertEqual(self.result(), {}); path.unlink(); path.write_bytes(raw)
        moved = self.bundle.with_name(self.bundle.name + '-original'); self.bundle.rename(moved)
        self.bundle.symlink_to(moved, target_is_directory=True); self.assertEqual(self.result(), {})

    def test_oversized_manifest_refuses_before_git(self):
        (self.bundle / 'import.json').write_bytes(b' ' * 65537)
        with patch.object(receipts, '_git') as git:self.assertEqual(self.result(), {}); git.assert_not_called()

    def test_oversized_source_and_wrong_catalog_or_ancestry_refuse(self):
        self.assertEqual(evidence.real_account_episode_sources(self.root, self.catalog[:-1]), {})
        with patch.object(receipts, '_git', side_effect=subprocess.CalledProcessError(1, ['git'])):
            self.assertEqual(self.result(), {})
        path = self.root / 'apps/mcp/src/main.ts'
        with path.open('wb') as stream:stream.truncate(evidence.MAX_SOURCE_BYTES + 1)
        self.assertEqual(self.result(), {})

    def test_generator_changes_only_one_account_cell(self):
        spec = importlib.util.spec_from_file_location('a7_matrix_fixture', ROOT / 'scripts/generate-tool-acceptance-tasks.py')
        generator = importlib.util.module_from_spec(spec); spec.loader.exec_module(generator)
        accepted = self.result()
        for index, tool in enumerate(self.catalog):
            before = generator.status(tool, index, {}, {}, {}, {}, {}, {})
            after = generator.status(tool, index, {}, {}, {}, {}, {}, {}, accepted)
            self.assertEqual(before[:5] + before[6:], after[:5] + after[6:])
            self.assertEqual(after[5].startswith('✅'), tool['name'] == evidence.TOOL)
            if tool['name'] != evidence.TOOL:self.assertEqual(before, after)

    def test_checker_rejects_manual_marks_extra_or_other_references(self):
        spec = importlib.util.spec_from_file_location('a7_checker_fixture', ROOT / 'scripts/check-tool-acceptance-table.py')
        checker = importlib.util.module_from_spec(spec); spec.loader.exec_module(checker)
        accepted = self.result(); correct = f'✅<br>`{evidence.REFERENCE}`'
        for tool in self.catalog:
            if tool['name'] == evidence.TOOL:
                self.assertIsNone(checker.account_auth_reference_error(tool, correct, accepted))
                for cell in ('✅', '⬜', '—', correct + '<br>`extra`', '✅<br>`other.json`'):
                    self.assertIsNotNone(checker.account_auth_reference_error(tool, cell, accepted))
            else:self.assertIsNotNone(checker.account_auth_reference_error(tool, correct, accepted))


if __name__ == '__main__':
    unittest.main()
