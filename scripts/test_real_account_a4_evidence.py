"""Offline adversaries for the fixed, completed A4 conflict/partial two-PNG receipt."""
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from acceptance import real_account_a1_evidence as legacy
from acceptance import real_account_a2_evidence as a2
from acceptance import real_account_a4_evidence as evidence
from acceptance import real_account_a3_evidence as a3
from acceptance import real_account_read_evidence as union

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL_GIT = legacy._git


class RealAccountA4EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='bgk-a4-evidence-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.bundle = self.root / evidence.BUNDLE
        shutil.copytree(ROOT / evidence.BUNDLE, self.bundle)
        self.sources = json.loads((self.bundle / 'source-files.json').read_text())
        for name in self.sources:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        shutil.copyfile(ROOT / 'package.json', self.root / 'package.json')
        self.catalog = json.loads((self.root / 'docs/tool-catalog.json').read_text())
        self.tree = ORIGINAL_GIT(ROOT, 'ls-tree', '-r', evidence.SOURCE_REVISION, '--', *evidence.RUNTIME_PATHS)
        self.head_package = json.loads((self.root / 'package.json').read_text())
        self.git_patch = patch.object(legacy, '_git', side_effect=self.git_result)
        self.git_patch.start()
        self.addCleanup(self.git_patch.stop)

    def git_result(self, root, *args):
        if args[:2] == ('merge-base', '--is-ancestor'):
            self.assertEqual(args[2], evidence.SOURCE_REVISION)
            return ''
        if args[:2] == ('ls-tree', '-r'):
            return self.tree
        if args == ('show', 'HEAD:package.json'):
            return json.dumps(self.head_package)
        raise AssertionError('Unexpected Git command')

    def result(self):
        return evidence.real_account_backlog_schedule_sources(self.root, self.catalog)

    def mutate(self, name, fn):
        path = self.bundle / name
        value = json.loads(path.read_text()); fn(value)
        path.write_text(json.dumps(value))

    def test_exact_four_tools_actual_conflict_partial_and_two_private_pngs(self):
        self.assertEqual(self.result(), {name: {evidence.REFERENCE} for name in evidence.TOOLS})
        result = json.loads((self.bundle / 'a4-result.json').read_text())
        self.assertTrue(result['passed']); self.assertTrue(result['batch']['pngValidated'])
        self.assertEqual(result['batch']['apiRequests'], 10)
        self.assertEqual(result['batch']['diagnostic']['pngsValidated'], 2)
        self.assertEqual(result['batch']['diagnostic']['collectionRequests'], 4)
        self.assertEqual(result['batch']['diagnostic']['episodeRequests'], 2)
        self.assertEqual(result['batch']['diagnostic']['calendarRequests'], 4)
        self.assertEqual(result['batch']['coverRequests'], 0)
        self.assertEqual(result['batch']['diagnostic']['backlogReadState'], 'conflict')
        self.assertEqual(result['batch']['diagnostic']['backlogRenderState'], 'conflict')
        self.assertEqual(result['batch']['diagnostic']['scheduleReadState'], 'partial')
        self.assertEqual(result['batch']['diagnostic']['scheduleRenderState'], 'partial')
        self.assertEqual(json.loads((self.bundle / 'durable-a4-claim.json').read_text())['state'], 'COMPLETE')

    def test_actual_current_checkout_union_preserves_existing_list_and_old_a1_limits(self):
        with patch.object(legacy, '_git', wraps=ORIGINAL_GIT):
            catalog = json.loads((ROOT / 'docs/tool-catalog.json').read_text())
            self.assertEqual(set(union.real_account_read_sources(ROOT, catalog)), {*evidence.TOOLS, *a3.TOOLS, a2.TOOL})
            self.assertEqual(legacy.real_account_read_sources(ROOT, catalog), {})
            self.assertEqual(a2.real_account_collection_sources(ROOT, catalog), {a2.TOOL: {a2.REFERENCE}})

    def test_every_evidence_file_is_pinned(self):
        for name in json.loads((self.bundle / 'import.json').read_text())['evidenceFiles']:
            path = self.bundle / name; raw = path.read_bytes()
            with self.subTest(file=name):
                path.write_bytes(raw + b'\n'); self.assertEqual(self.result(), {}); path.write_bytes(raw)
        self.assertEqual(set(self.result()), set(evidence.TOOLS))

    def test_manifest_cannot_choose_other_files_digests_or_tools(self):
        self.mutate('import.json', lambda d: d.update(admittedTools=[{'name': 'bangumi.get_my_profile'}], evidenceFiles={'../../outside.json': '0' * 64}))
        with patch.object(legacy, '_git') as git:
            self.assertEqual(self.result(), {}); git.assert_not_called()

    def test_synthetic_failed_scope_or_claim_changes_cannot_inherit_success(self):
        for file, change in (
            ('a4-result.json', lambda d: d['batch'].update(executionKind='synthetic')),
            ('a4-result.json', lambda d: d['batch'].update(toolCallsSucceeded=1)),
            ('a4-result.json', lambda d: d['batch'].update(toolCallsAttempted=True)),
            ('a4-result.json', lambda d: d['batch'].update(pngValidated=False)),
            ('a4-result.json', lambda d: d['batch'].update(coverRequests=1)),
            ('a4-result.json', lambda d: d['batch']['diagnostic'].update(backlogReadState='complete')),
            ('durable-a4-claim.json', lambda d: d.update(state='STARTED')),
            ('postconditions.json', lambda d: d.update(protectedA1A2A3ClaimBytesPreserved=False)),
            ('postconditions.json', lambda d: d['jobs']['com.pariyaagent.runner'].update(loadedStateMatch=False)),
            ('public-plan.json', lambda d: d['tools'][0]['arguments'].update(maxItems=3)),
        ):
            path = self.bundle / file; raw = path.read_bytes()
            with self.subTest(file=file):
                self.mutate(file, change); self.assertEqual(self.result(), {}); path.write_bytes(raw)

    def test_private_fields_cannot_be_appended_at_any_receipt_layer(self):
        for name in ('a4-result.json', 'public-plan.json', 'postconditions.json', 'durable-a4-claim.json', 'operator-provenance.json'):
            path = self.bundle / name; raw = path.read_bytes()
            self.mutate(name, lambda d: d.update(privateAccount='PRIVATE_CANARY'))
            self.assertEqual(self.result(), {}); path.write_bytes(raw)

    def test_disk_source_drift_across_domains_including_the_loaded_font(self):
        selected = ['pnpm-lock.yaml', 'apps/mcp/src/main.ts', 'packages/auth/src/token-broker.ts',
            'packages/db/src/sqlite-storage.ts', 'packages/bangumi-core/src/services/collection-backlog-service.ts',
            'packages/tools/src/definitions/render-presentation-tools.ts', 'packages/renderer/src/view-model-builders/index.ts',
            'packages/renderer/src/templates/CollectionBacklogCard.tsx',
            'packages/renderer/assets/fonts/GenSenRounded2TW-R.woff2', 'docs/tool-catalog.json', 'tsconfig.base.json']
        for name in selected:
            path = self.root / name; raw = path.read_bytes()
            with self.subTest(path=name):
                path.write_bytes(raw + b'\n'); self.assertEqual(self.result(), {}); path.write_bytes(raw)
        self.assertEqual(len(self.sources), 285)
        self.assertEqual(set(self.result()), set(evidence.TOOLS))

    def test_committed_blob_membership_and_file_modes_must_match(self):
        original = self.tree
        for tree in (original.replace(next(iter(self.sources.values()))['gitBlob'], '0' * 40, 1),
                     original.replace('100644 blob ', '120000 blob ', 1),
                     '\n'.join(original.splitlines()[1:]) + '\n',
                     original + '100644 blob ' + '0' * 40 + '\tpackages/renderer/src/unexpected.ts\n'):
            self.tree = tree; self.assertEqual(self.result(), {})
        self.tree = original

    def test_untracked_sql_migration_and_renderer_asset_invalidate_credit(self):
        for relative in (legacy.SQLITE_MIGRATIONS + '/9999-untracked.sql', evidence.RENDER_ASSETS + '/untracked.woff2'):
            path = self.root / relative; path.write_bytes(b'new dynamic member')
            self.assertEqual(self.result(), {}); path.unlink()

    def test_root_scripts_are_independent_but_all_other_package_metadata_is_pinned(self):
        path = self.root / 'package.json'; disk = json.loads(path.read_text())
        self.head_package['scripts']['acceptance:extra'] = 'echo committed-test-only'
        disk['scripts']['acceptance:local-extra'] = 'echo local-test-only'; path.write_text(json.dumps(disk))
        self.assertEqual(set(self.result()), set(evidence.TOOLS))
        self.head_package['version'] = 'unreviewed-version'; self.assertEqual(self.result(), {})
        self.head_package['version'] = disk['version']; disk['license'] = 'unreviewed-license'
        path.write_text(json.dumps(disk)); self.assertEqual(self.result(), {})

    def test_source_font_size_cap_and_source_symlinks_reject_without_blocking(self):
        path = self.root / 'packages/renderer/assets/fonts/GenSenRounded2TW-R.woff2'
        self.assertGreater(path.stat().st_size, 4 * 1024 * 1024)
        with path.open('wb') as stream: stream.truncate(evidence.MAX_SOURCE_BYTES + 1)
        self.assertEqual(self.result(), {})
        path = self.root / 'apps/mcp/src/main.ts'; raw = path.read_bytes(); path.unlink()
        outside = self.root / 'outside-source'; outside.write_bytes(raw); path.symlink_to(outside)
        self.assertEqual(self.result(), {})

    def test_missing_receipt_links_directory_fifo_and_parent_links_are_rejected(self):
        path = self.bundle / 'a4-result.json'; raw = path.read_bytes(); path.unlink()
        self.assertEqual(self.result(), {})
        outside = self.root / 'outside.json'; outside.write_bytes(raw); path.symlink_to(outside)
        self.assertEqual(self.result(), {}); path.unlink(); path.mkdir()
        self.assertEqual(self.result(), {}); path.rmdir(); os.mkfifo(path)
        self.assertEqual(self.result(), {}); path.unlink(); path.write_bytes(raw)
        parent = self.bundle; moved = parent.with_name(parent.name + '-original'); parent.rename(moved)
        parent.symlink_to(moved, target_is_directory=True); self.assertEqual(self.result(), {})

    def test_catalog_ancestry_and_root_metadata_shapes_fail_closed(self):
        self.assertEqual(evidence.real_account_backlog_schedule_sources(self.root, self.catalog[:-1]), {})
        with patch.object(legacy, '_git', side_effect=subprocess.CalledProcessError(1, ['git'])):
            self.assertEqual(self.result(), {})
        (self.root / 'package.json').write_text('[]'); self.assertEqual(self.result(), {})

    def test_generator_changes_only_the_four_account_cells(self):
        spec = importlib.util.spec_from_file_location('a4_matrix_test', ROOT / 'scripts/generate-tool-acceptance-tasks.py')
        generator = importlib.util.module_from_spec(spec); spec.loader.exec_module(generator)
        accepted = self.result()
        for index, tool in enumerate(self.catalog):
            with self.subTest(tool=tool['name']):
                before = generator.status(tool, index, {}, {}, {}, {}, {}, {})
                after = generator.status(tool, index, {}, {}, {}, {}, {}, {}, accepted)
                self.assertEqual(before[:5] + before[6:], after[:5] + after[6:])
                self.assertEqual(after[5].startswith('✅'), tool['name'] in evidence.TOOLS)
                if tool['name'] not in evidence.TOOLS: self.assertEqual(before, after)

    def test_checker_rejects_manual_marks_or_other_tool_references(self):
        spec = importlib.util.spec_from_file_location('a4_checker_test', ROOT / 'scripts/check-tool-acceptance-table.py')
        checker = importlib.util.module_from_spec(spec); spec.loader.exec_module(checker)
        accepted = self.result(); correct = f'✅<br>`{evidence.REFERENCE}`'
        for tool in self.catalog:
            if tool['name'] in evidence.TOOLS:
                self.assertIsNone(checker.account_auth_reference_error(tool, correct, accepted))
                for cell in ('✅', '⬜', '—', correct + '<br>`extra`', '✅<br>`other.json`'):
                    self.assertIsNotNone(checker.account_auth_reference_error(tool, cell, accepted))
            else:
                self.assertIsNotNone(checker.account_auth_reference_error(tool, correct, accepted))

    def test_oversized_import_rejects_before_any_git_access(self):
        (self.bundle / 'import.json').write_bytes(b' ' * 65537)
        with patch.object(legacy, '_git') as git:
            self.assertEqual(self.result(), {}); git.assert_not_called()


if __name__ == '__main__':
    unittest.main()
