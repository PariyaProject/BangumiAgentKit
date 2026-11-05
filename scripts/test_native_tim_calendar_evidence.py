"""Offline falsification of the sealed real-client calendar import."""
import copy
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from acceptance import native_tim_calendar_evidence as evidence
from acceptance import real_account_a1_evidence as receipts
from acceptance import real_account_a3_evidence as shared
from client_evidence import report_status, tool_client_e2e_sources

ROOT = Path(__file__).resolve().parents[1]
ORIGINAL_GIT = receipts._git


class NativeTimCalendarEvidenceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='bgk-native-tim-calendar-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.report = json.loads((ROOT / evidence.REFERENCE).read_bytes())
        for name in [evidence.REFERENCE, *self.report['evidenceFiles']]:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        self.sources = json.loads((ROOT / evidence.SOURCE_BUNDLE / 'source-files.json').read_bytes())
        for name in self.sources:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        self.package = json.loads(ORIGINAL_GIT(ROOT, 'show', evidence.SOURCE_REVISION + ':package.json'))
        (self.root / 'package.json').write_text(json.dumps(self.package))
        self.catalog = json.loads((self.root / 'docs/tool-catalog.json').read_bytes())
        self.tree = ORIGINAL_GIT(ROOT, 'ls-tree', '-r', evidence.SOURCE_REVISION, '--', *shared.RUNTIME_PATHS)
        git = patch.object(receipts, '_git', side_effect=self.git_result)
        git.start()
        self.addCleanup(git.stop)

    def git_result(self, root, *args):
        if args[:2] == ('merge-base', '--is-ancestor'):
            self.assertIn(args[2], (shared.SOURCE_REVISION, evidence.SOURCE_REVISION))
            self.assertEqual(args[3], 'HEAD')
            return ''
        if args[:2] == ('ls-tree', '-r'):
            return self.tree
        if args == ('show', 'HEAD:package.json'):
            return json.dumps(self.package)
        raise AssertionError('Only bounded source inspection is permitted')

    def result(self):
        return tool_client_e2e_sources(
            self.catalog, catalog_path=self.root / 'docs/tool-catalog.json',
            report_dir=self.root / 'docs/live-probes', root=self.root,
        )

    def test_one_completed_real_client_observation_earns_only_calendar_pair(self):
        expected = {evidence.TOOL: {evidence.REFERENCE}}
        self.assertEqual(self.result(), (expected, expected))
        native = json.loads((self.root / evidence.BUNDLE / 'native-ui-evidence.json').read_bytes())
        self.assertEqual(native['coverageObserved'], 'partial')
        self.assertEqual(native['renderedItemsObserved'], 3)
        self.assertEqual(native['computerUse']['inputMethod'], 'paste+Return')
        self.assertEqual(native['productionSource']['gateway'], '7e3d10a93192fbc986441eccc8145122e5d2a696')
        self.assertEqual(native['productionSource']['plugin'], '7eac647af079a3d895c12da9720f5ef131c0efa8')

    def test_actual_checkout_agrees_without_model_api_or_client_access(self):
        with patch.object(receipts, '_git', wraps=ORIGINAL_GIT):
            catalog = json.loads((ROOT / 'docs/tool-catalog.json').read_bytes())
            expected = {evidence.TOOL: {evidence.REFERENCE}}
            self.assertEqual(tool_client_e2e_sources(
                catalog, catalog_path=ROOT / 'docs/tool-catalog.json',
                report_dir=ROOT / 'docs/live-probes', root=ROOT,
            ), (expected, expected))

    def test_legacy_reader_does_not_admit_or_relabel_native_report(self):
        current = {t['name']: t for t in self.catalog}
        self.assertEqual(report_status(self.report, current[evidence.TOOL],
                                       self.report['catalogSha256'], current), (False, False))
        path = self.root / evidence.REFERENCE
        for change in ({'schemaVersion': 1}, {'profile': 'public-render'}, {'tool': 'bangumi.get_subject'}):
            value = {**self.report, **change}
            path.write_text(json.dumps(value))
            self.assertEqual(self.result(), ({}, {}))

    def test_modified_import_receipt_client_privacy_image_phases_or_counts_rejected(self):
        path = self.root / evidence.BUNDLE / 'native-ui-evidence.json'
        raw = path.read_bytes()
        changes = [
            lambda v: v['computerUse'].update(inputObserved=False),
            lambda v: v['computerUse'].update(imageDisplayed=False),
            lambda v: v['computerUse'].update(recipientIsOriginalBot=False),
            lambda v: v['privacy'].update(messageBodyStored=True),
            lambda v: v['productionSource'].update(nativeImage='pariya-agent/agy-bangumi-poc:m1'),
            lambda v: v['productionSource'].update(nativeUpstream='f' * 40),
            lambda v: v['qqPipeline']['phases'].pop(),
            lambda v: v['qqPipeline'].update(duplicates=True),
            lambda v: v['qqPipeline'].update(uncertain=True),
            lambda v: v.update(toolErrors=1),
            lambda v: v.update(modelsDelta=2),
            lambda v: v['toolCalls'].append({'server': 'bangumi', 'name': 'bangumi.get_subject', 'state': 'DONE'}),
        ]
        for change in changes:
            with self.subTest(change=changes.index(change)):
                value = json.loads(raw)
                change(value)
                path.write_text(json.dumps(value))
                self.assertEqual(self.result(), ({}, {}))
                path.write_bytes(raw)

    def test_renaming_missing_import_and_isolated_report_directory_get_no_credit(self):
        path = self.root / evidence.REFERENCE
        renamed = path.with_name('pariya-agent-production-client-e2e-reissued.json')
        path.rename(renamed)
        self.assertEqual(self.result(), ({}, {}))
        renamed.rename(path)
        elsewhere = self.root / 'isolated-probes'
        elsewhere.mkdir()
        self.assertEqual(tool_client_e2e_sources(
            self.catalog, catalog_path=self.root / 'docs/tool-catalog.json',
            report_dir=elsewhere, root=self.root,
        ), ({}, {}))

    def test_evidence_missing_changed_symlink_directory_and_oversized_fail_closed(self):
        path = self.root / evidence.BUNDLE / 'native-ui-evidence.json'
        raw = path.read_bytes()
        path.unlink()
        self.assertEqual(self.result(), ({}, {}))
        outside = self.root / 'outside.json'
        outside.write_bytes(raw)
        path.symlink_to(outside)
        self.assertEqual(self.result(), ({}, {}))
        path.unlink()
        path.mkdir()
        self.assertEqual(self.result(), ({}, {}))
        path.rmdir()
        path.write_bytes(b' ' * (64 * 1024 + 1))
        self.assertEqual(self.result(), ({}, {}))

    def test_full_runtime_disk_tree_mode_and_membership_drift_remove_credit(self):
        path = self.root / 'apps/mcp/src/main.ts'
        raw = path.read_bytes()
        path.write_bytes(raw + b'\n')
        self.assertEqual(self.result(), ({}, {}))
        path.write_bytes(raw)
        tree = self.tree
        self.tree = tree.replace('100644', '120000', 1)
        self.assertEqual(self.result(), ({}, {}))
        self.tree = tree + '\n100644 blob ' + 'f' * 40 + '\tpackages/new.ts'
        self.assertEqual(self.result(), ({}, {}))

    def test_dynamic_sql_and_assets_cannot_inherit_old_evidence(self):
        for relative in (receipts.SQLITE_MIGRATIONS + '/unexpected.sql', shared.RENDER_ASSETS + '/unexpected.bin'):
            path = self.root / relative
            path.write_bytes(b'synthetic')
            self.assertEqual(self.result(), ({}, {}))
            path.unlink()

    def test_only_governance_scripts_may_evolve_in_head_and_disk_root_package(self):
        self.package['scripts']['test:synthetic'] = 'true'
        path = self.root / 'package.json'
        path.write_text(json.dumps(self.package))
        self.assertIn(evidence.TOOL, self.result()[0])
        disk = copy.deepcopy(self.package)
        disk['pnpm']['overrides']['qs'] = '6.15.0'
        path.write_text(json.dumps(disk))
        self.assertEqual(self.result(), ({}, {}))
        path.write_text(json.dumps(self.package))
        self.package['version'] = 'changed-in-head'
        self.assertEqual(self.result(), ({}, {}))

    def test_catalog_drift_or_private_write_catalog_cannot_earn_public_credit(self):
        self.catalog[0]['description'] = 'changed'
        self.assertEqual(self.result(), ({}, {}))
        path = self.root / 'docs/tool-catalog.json'
        path.write_text(json.dumps(self.catalog))
        self.assertEqual(self.result(), ({}, {}))

    def test_source_history_must_include_actual_executed_revision(self):
        with patch.object(receipts, '_git', side_effect=subprocess.CalledProcessError(1, 'git')):
            self.assertEqual(self.result(), ({}, {}))

    def test_report_and_source_snapshot_hashes_are_fixed(self):
        path = self.root / evidence.REFERENCE
        self.assertEqual(hashlib.sha256(path.read_bytes()).hexdigest(), evidence.IMPORT_SHA256)
        raw = path.read_bytes()
        path.write_bytes(raw + b' ')
        self.assertEqual(self.result(), ({}, {}))
        path.write_bytes(raw)
        path = self.root / evidence.SOURCE_BUNDLE / 'source-files.json'
        path.write_bytes(path.read_bytes() + b' ')
        self.assertEqual(self.result(), ({}, {}))


if __name__ == '__main__':
    unittest.main()
