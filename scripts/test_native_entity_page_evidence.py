#!/usr/bin/env python3
"""Real signed Git fixture + synthetic control only; no GitHub/model/API traffic."""
import copy
import hashlib
import json
from pathlib import Path
import shutil
import runpy
import subprocess
import unittest
from unittest.mock import patch

from acceptance.native_entity_page_evidence import (
    PROFILE_ID, REPORT, TOOLS, _json_command, native_page_control_matches, native_page_evidence_sources,
)

ROOT = Path(__file__).resolve().parents[1]


class NativePageEvidenceTest(unittest.TestCase):
    def setUp(self):
        program = r"""
import {nativePageReportFixture} from './tests/harness/fixtures/native-page-report.mjs';
import {writeNativePageReport,validateNativePageReportFile} from './scripts/acceptance/native-entity-page-report.mjs';
const f=nativePageReportFixture();writeNativePageReport(f.build(),f.root);
const proof=validateNativePageReportFile(f.claim,f.root);
process.stdout.write(JSON.stringify({root:f.root,claim:{...f.claim,state:'REPORT_WRITTEN',reportWritten:true,
 reportPath:proof.reportPath,reportSha256:proof.reportSha256,runnerReceiptSha256:proof.runnerReceiptSha256}}));
"""
        fixture = json.loads(subprocess.check_output(['node', '--input-type=module', '-e', program], cwd=ROOT, text=True, timeout=10))
        self.root = Path(fixture['root'])
        self.addCleanup(lambda: shutil.rmtree(self.root))
        self.claim = fixture['claim']
        self.report = json.loads((self.root / REPORT).read_text())
        self.catalog = json.loads((self.root / 'docs/tool-catalog.json').read_text())
        source, base, pr = self.claim['sourceCandidateSha'], self.claim['baseSha'], self.claim['prNumber']
        self.status = {'state': 'REPORT_WRITTEN', 'profile_id': PROFILE_ID, 'run': 95, 'pr': pr,
                       'claim_label_present': True, 'terminal_label_present': True, 'disposition': self.claim}
        review = {'verdict': 'PASS', 'candidate_sha': source, 'reviewed_base_sha': base,
                  'reviewer_id': self.claim['reviewerId']}
        self.epoch = {'run': {'number': 95, 'state': {'state': 'EPOCH_ACTIVE', 'active_epoch_pr': pr}},
                      'epoch': {'github_state': 'OPEN', 'pr_is_draft': False, 'pr_base_ref_name': 'master',
                                'pr_base_sha': base, 'pr_head_sha': source, 'pr_head_ref_name': 'codex/synthetic',
                                'state': {'state': 'REVIEW_PASSED', 'epoch_id': self.claim['epochId'],
                                          'pr_number': pr, 'base_branch': 'master', 'base_sha': base,
                                          'candidate_sha': source, 'branch': 'codex/synthetic',
                                          'advances_frontier_ids': ['OP-009'], 'review_history': [review]}}}
        self.ci = {'id': int(self.claim['ciRunId']), 'head_sha': source, 'event': 'pull_request',
                   'status': 'completed', 'conclusion': 'success'}
        self.jobs = {'total_count': 7, 'jobs': [dict(name=c['name'], status='completed', conclusion='success')
                                              for c in self.claim['ciChecks']]}
        self.reads = []

    def reader(self, root, args, payload=None):
        self.reads.append(args)
        if args[0] == 'node' and 'epoch:agent-mcp-profile-status' in args:
            return self.status
        if args[0] == 'node' and 'status' in args:
            return self.epoch
        if args[0] == 'node' and args[1].endswith('validate-native-entity-page-report.mjs'):
            return _json_command(root, args, payload)  # Actual signature/source validator, not mocked.
        if args[0:2] == ['gh', 'api']:
            return self.jobs if '/jobs?' in args[2] else self.ci
        raise AssertionError('unlisted test command')

    def sources(self):
        return native_page_evidence_sources(self.root, self.catalog, read_json=self.reader)

    def test_real_signature_and_source_reader_admits_only_two_native_cells(self):
        self.assertEqual(self.sources(), {name: {REPORT} for name in TOOLS})
        self.assertEqual(len(self.reads), 5)

    def test_control_without_terminal_report_fails_before_more_reads(self):
        self.status['state'] = 'CLAIMED'
        self.assertEqual(self.sources(), {})
        self.assertEqual(len(self.reads), 1)

    def test_terminal_ci_review_and_closed_refresh_predicates_reject_adversaries(self):
        original = (self.report, self.claim['reportSha256'], self.status, self.epoch, set(), self.ci, self.jobs)
        changes = [
            lambda a: a[2].update(terminal_label_present=False),
            lambda a: a[2]['disposition'].update(retryAllowed=True),
            lambda a: a[2]['disposition'].update(reportSha256='f' * 64),
            lambda a: a[3]['epoch']['state']['review_history'][0].update(verdict='CORRECTIVE_REQUIRED'),
            lambda a: a[4].add('packages/tools/src/registry.ts'),
            lambda a: a[5].update(head_sha='f' * 40),
            lambda a: a[5].update(conclusion='failure'),
            lambda a: a[6]['jobs'][0].update(conclusion='skipped'),
            lambda a: a[6].update(total_count=8),
        ]
        for change in changes:
            values = copy.deepcopy(original)
            change(values)
            self.assertIsNone(native_page_control_matches(*values))

    def test_altered_signed_bytes_fail_even_with_matching_fake_control_digest(self):
        self.report['observedAt'] = '2026-11-06T00:00:00.000Z'
        data = (json.dumps(self.report) + '\n').encode()
        (self.root / REPORT).write_bytes(data)
        self.claim['reportSha256'] = hashlib.sha256(data).hexdigest()
        self.assertEqual(self.sources(), {})

    def test_current_program_change_fails_without_new_model_or_source_calls(self):
        with (self.root / 'scripts/lib/native-entity-page-verification.mjs').open('a') as out:
            out.write('\n// changed semantic boundary\n')
        self.assertEqual(self.sources(), {})

    def test_table_checker_accepts_only_externally_admitted_public_and_model_references(self):
        check = runpy.run_path(str(ROOT / 'scripts/check-tool-acceptance-table.py'))['evidence_reference_error']
        def admitted(root, catalog):
            return native_page_evidence_sources(root, catalog, read_json=self.reader)
        with patch.dict(check.__globals__, ROOT=self.root, CATALOG=self.root / 'docs/tool-catalog.json',
                        native_page_evidence_sources=admitted):
            for tool in TOOLS:
                for kind, mark in [('public', '◐'), ('agent_mcp', '✅')]:
                    cell = f'{mark}<br>`{REPORT}`'
                    self.assertIsNone(check(tool, cell, kind))
                    self.status['terminal_label_present'] = False
                    self.assertIsNotNone(check(tool, cell, kind))
                    self.status['terminal_label_present'] = True
                for kind in ['auth_denial', 'qq_pipeline', 'tim_client']:
                    self.assertIsNotNone(check(tool, f'✅<br>`{REPORT}`', kind))
            self.assertIsNotNone(check('bangumi.get_subject', f'◐<br>`{REPORT}`', 'public'))

    def test_other_catalog_changes_and_later_unrelated_merged_work_do_not_erase_this_proof(self):
        subprocess.run(['git', 'add', REPORT], cwd=self.root, check=True, capture_output=True)
        subprocess.run(['git', '-c', 'user.name=Synthetic', '-c', 'user.email=fixture@example.invalid',
                        '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'synthetic evidence import'],
                       cwd=self.root, check=True, capture_output=True)
        candidate = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=self.root, text=True).strip()
        self.epoch['epoch'].update(github_state='MERGED', pr_head_sha=candidate)
        self.epoch['epoch']['state'].update(state='MERGED', candidate_sha=candidate)
        self.epoch['run']['state'].update(state='EPOCH_ACTIVE', active_epoch_pr=300, last_merged_epoch_pr=300)
        (self.root / 'later-unrelated.txt').write_text('synthetic later work')
        subprocess.run(['git', 'add', 'later-unrelated.txt'], cwd=self.root, check=True, capture_output=True)
        subprocess.run(['git', '-c', 'user.name=Synthetic', '-c', 'user.email=fixture@example.invalid',
                        '-c', 'core.hooksPath=/dev/null', 'commit', '-qm', 'synthetic later unrelated work'],
                       cwd=self.root, check=True, capture_output=True)
        next(t for t in self.catalog if t['name'] not in TOOLS)['description'] += ' unrelated'
        (self.root / 'docs/tool-catalog.json').write_text(json.dumps(self.catalog))
        self.assertEqual(self.sources(), {name: {REPORT} for name in TOOLS})


if __name__ == '__main__':
    unittest.main()
