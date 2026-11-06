"""Historical metadata is verification input, never current execution authority."""
import copy
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from acceptance import signed_report_source_context as evidence

ROOT = Path(__file__).resolve().parents[1]
SPECS = json.loads((ROOT / evidence.MANIFEST).read_bytes())['contexts']
CLAIMS = json.loads((ROOT / 'tests/fixtures/acceptance/signed-report-context-test-claims.json').read_bytes())['claims']


class SignedReportSourceContextTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.blobs = {(spec['sourceRevision'], name): evidence._git_blob(ROOT, spec['sourceRevision'], name)
                     for spec in SPECS for name in spec['files']}

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='signed-context-unit-')
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        names = {evidence.CATALOG, evidence.REGISTRY}
        for spec in SPECS:
            names.update((spec['reportPath'], spec['selectionEvidencePath']))
        for name in names:
            target = self.root / name
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / name, target)
        self.catalog = json.loads((self.root / evidence.CATALOG).read_bytes())
        mock = patch.object(evidence, '_git_blob', side_effect=lambda root, revision, name: self.blobs[(revision, name)])
        mock.start(); self.addCleanup(mock.stop)

    def validate(self, index, claim=None):
        return evidence.validate_in_original_context(self.root, (self.root / SPECS[index]['reportPath']).read_bytes(),
            CLAIMS[index] if claim is None else claim)

    def test_four_exact_original_signed_reports_accept_an_unrelated_catalog_change(self):
        for i, spec in enumerate(SPECS):
            report = json.loads((self.root / spec['reportPath']).read_bytes())
            self.assertTrue(evidence.needs_original_context(self.root, report))
            self.assertEqual(evidence._hash(evidence.catalog_bytes_for_signed_report(self.root, report)), report['catalogSha256'])
            self.assertTrue(self.validate(i))
        changed = copy.deepcopy(self.catalog)
        next(t for t in changed if t['name'] == 'bangumi.list_person_collections')['description'] += 'different native list contract'
        (self.root / evidence.CATALOG).write_text(json.dumps(changed))
        self.assertTrue(self.validate(0))

    def test_current_own_metadata_including_schema_auth_risk_and_extra_fields_must_equal(self):
        for field, value in [('description', 'changed'), ('inputSchema', {}), ('auth', 'required'), ('risk', 'write'), ('newMetadata', True)]:
            changed = copy.deepcopy(self.catalog)
            next(t for t in changed if t['name'] == SPECS[0]['toolName'])[field] = value
            (self.root / evidence.CATALOG).write_text(json.dumps(changed))
            self.assertFalse(self.validate(0), field)
        (self.root / evidence.CATALOG).write_text(json.dumps(self.catalog + [next(t for t in self.catalog if t['name'] == SPECS[0]['toolName'])]))
        self.assertFalse(self.validate(0))

    def test_original_report_bytes_identity_and_native_changed_tools_cannot_gain_credit(self):
        path = self.root / SPECS[0]['reportPath']; original = path.read_bytes()
        for field, value in [('toolName', 'bangumi.list_person_collections'), ('toolName', 'bangumi.list_character_collections'),
                             ('profileId', 'unknown'), ('sourceRevision', 'f' * 40), ('catalogSha256', 'f' * 64), ('model', 'other')]:
            report = json.loads(original); report[field] = value; path.write_text(json.dumps(report))
            self.assertFalse(self.validate(0), field)
        path.write_bytes(original + b'\n'); self.assertFalse(self.validate(0))
        path.unlink(); path.symlink_to(ROOT / SPECS[0]['reportPath']); self.assertFalse(self.validate(0))

    def test_original_crypto_validator_still_requires_exact_terminal_claim_and_public_key(self):
        for i in range(4):
            for key, value in [('state', 'CLAIMED'), ('reportSha256', 'f' * 64), ('runnerReceiptPublicKeyBase64', 'wrong'),
                               ('runnerReceiptPublicKeySha256', 'f' * 64), ('sourceCandidateSha', 'f' * 40)]:
                claim = copy.deepcopy(CLAIMS[i]); claim[key] = value
                # Some validators use the existing runnerReceiptPublicKey field.
                if key == 'runnerReceiptPublicKeyBase64': claim['runnerReceiptPublicKey'] = value
                self.assertFalse(self.validate(i, claim), (i, key))

    def test_selected_profile_selection_and_source_closure_hashes_cannot_drift(self):
        path = self.root / evidence.REGISTRY; original = path.read_bytes()
        registry = json.loads(original)
        next(p for p in registry['profiles'] if p['id'] == SPECS[0]['profileId'])['toolName'] = 'other'
        path.write_text(json.dumps(registry)); self.assertFalse(self.validate(0)); path.write_bytes(original)
        path = self.root / SPECS[0]['selectionEvidencePath']; original = path.read_bytes()
        path.write_bytes(original + b'\n'); self.assertFalse(self.validate(0)); path.write_bytes(original)
        for name in SPECS[0]['files']:
            original = self.blobs[(SPECS[0]['sourceRevision'], name)]
            with patch.object(evidence, '_git_blob', side_effect=lambda root, revision, target: original + b'\n' if target == name else self.blobs[(revision, target)]):
                self.assertFalse(self.validate(0), name)

    def test_read_aliases_missing_data_and_unsupported_node_refuse(self):
        path = self.root / evidence.CATALOG; original = path.read_bytes()
        path.unlink(); path.symlink_to(ROOT / evidence.CATALOG); self.assertFalse(self.validate(0))
        path.unlink(); path.write_bytes(original)
        original_run = evidence.subprocess.run
        def unsupported(args, **kwargs):
            if args[0] == 'node':
                return subprocess.CompletedProcess(args, 9, '', 'bad option: --permission')
            return original_run(args, **kwargs)
        with patch.object(evidence.subprocess, 'run', side_effect=unsupported):
            self.assertFalse(self.validate(0))


class ReadOnlyPermissionTests(unittest.TestCase):
    def test_actual_node_permissions_deny_outside_reads_writes_children_and_network_surfaces(self):
        with tempfile.TemporaryDirectory(prefix='signed-context-permissions-') as temporary:
            root = Path(temporary).resolve(); guard = root / 'guard.mjs'
            guard.write_bytes((ROOT / evidence.GUARD).read_bytes())
            source = r'''import fs from 'node:fs'; import cp from 'node:child_process';
import http from 'node:http'; import https from 'node:https'; import net from 'node:net';
import tls from 'node:tls'; import dns from 'node:dns'; import dp from 'node:dns/promises'; import dgram from 'node:dgram';
const denied = (f, code) => {try {f(); throw Error('UNEXPECTED_ALLOW')} catch(e) {if(e.code !== code && e.message !== code) throw e}};
denied(() => fs.readFileSync(process.argv[1]), 'ERR_ACCESS_DENIED');
denied(() => fs.writeFileSync('blocked-write','x'), 'ERR_ACCESS_DENIED');
denied(() => cp.spawnSync(process.execPath,['-e','process.exit(0)']), 'ERR_ACCESS_DENIED');
for (const f of [() => fetch('https://example.invalid'), () => http.get('http://example.invalid'),
  () => https.request('https://example.invalid'), () => net.connect(1), () => tls.connect(1),
  () => dns.lookup('example.invalid'), () => dp.resolve('example.invalid'), () => dgram.createSocket('udp4')])
  denied(f, 'SIGNED_REPORT_CONTEXT_NETWORK_DENIED');
console.log('ALL_DENIED');'''
            result = subprocess.run(['node','--permission','--allow-fs-read='+str(root),'--import',str(guard),
                '--input-type=module','-e',source,str(ROOT / 'package.json')], cwd=root,
                env={'PATH':os.environ['PATH'],'NODE_NO_WARNINGS':'1'},capture_output=True,text=True,timeout=15)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual(result.stdout.strip(), 'ALL_DENIED')
            self.assertFalse((root / 'blocked-write').exists())


if __name__ == '__main__':
    unittest.main()
