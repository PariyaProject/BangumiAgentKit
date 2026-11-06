"""Read four existing signed reports in their exact original verification context.

This has no Harness control or execution-profile capability. Callers must first
validate current terminal claims, Candidate/Base/CI and implementation/path gates.
A historical context cannot admit a changed tool or a new execution report.
"""
from __future__ import annotations

import base64
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import tempfile

from .real_account_a1_evidence import _read_regular

ROOT = Path(__file__).resolve().parents[2]
MANIFEST = 'scripts/acceptance/signed-report-source-contexts.json'
REGISTRY = 'scripts/acceptance/agent-mcp-profile-registry.json'
CATALOG = 'docs/tool-catalog.json'
GUARD = 'scripts/acceptance/signed-report-readonly-guard.mjs'
MAX_FILE = 1024 * 1024
MAX_CONTEXT = 4 * MAX_FILE
MAX_REPORT = 64 * 1024


def _same(left, right):
    return json.dumps(left, sort_keys=True, separators=(',', ':'), ensure_ascii=False) == json.dumps(right, sort_keys=True, separators=(',', ':'), ensure_ascii=False)


def _hash(raw):
    return hashlib.sha256(raw).hexdigest()


def _safe_path(name):
    p = PurePosixPath(name)
    if (not name or p.is_absolute() or str(p) != name or any(x in ('', '.', '..', '.git') for x in name.split('/'))
            or any(x in name for x in ('\\', '\0', '\r', '\n', ':'))):
        raise ValueError('Noncanonical context path')
    return p


def _git_blob(root, revision, name):
    _safe_path(name)
    if re.fullmatch('[a-f0-9]{40}', revision) is None:
        raise ValueError('Invalid source revision')
    env = {k: v for k, v in os.environ.items() if not k.startswith('GIT_')}
    env.update(GIT_CONFIG_NOSYSTEM='1', GIT_CONFIG_GLOBAL=os.devnull,
               GIT_NO_REPLACE_OBJECTS='1', GIT_NO_LAZY_FETCH='1', GIT_TERMINAL_PROMPT='0')
    command = ['git', '--no-replace-objects', '-c', 'core.fsmonitor=false', '-C', str(root)]
    tree = subprocess.run([*command, 'ls-tree', '-l', revision, '--', name], env=env,
        capture_output=True, check=True, timeout=10).stdout.decode().strip()
    metadata, path = tree.split('\t')
    mode, kind, blob, size = metadata.split()
    if (path != name or mode != '100644' or kind != 'blob' or not 0 < int(size) <= MAX_FILE
            or re.fullmatch('[a-f0-9]{40}', blob) is None):
        raise ValueError('Invalid immutable context file')
    raw = subprocess.run([*command, 'cat-file', 'blob', blob], env=env,
        capture_output=True, check=True, timeout=10).stdout
    if len(raw) != int(size) or hashlib.sha1(b'blob ' + str(len(raw)).encode() + b'\0' + raw).hexdigest() != blob:
        raise ValueError('Context Git blob mismatch')
    return raw


def _spec(root, report):
    contexts = json.loads(_read_regular(ROOT, MANIFEST, MAX_FILE))
    if contexts['schema'] != 'signed-report-source-contexts/v1' or len(contexts['contexts']) != 4:
        raise ValueError('Invalid fixed context manifest')
    matches = [item for item in contexts['contexts'] if all(report.get(k) == item[k]
        for k in ('profileId', 'toolName', 'sourceRevision'))]
    if len(matches) != 1:
        raise ValueError('Not a supported historical report')
    spec = matches[0]
    if len(spec['files']) > 16 or len(spec['files']) < 5:
        raise ValueError('Invalid context closure')
    for name, digest in spec['files'].items():
        _safe_path(name)
        if re.fullmatch('[a-f0-9]{64}', digest) is None:
            raise ValueError('Invalid context file hash')
    report_bytes = _read_regular(root, spec['reportPath'], MAX_REPORT)
    if _hash(report_bytes) != spec['reportSha256'] or not _same(json.loads(report_bytes), report):
        raise ValueError('Not the existing signed report bytes')
    return spec


def _selected_profile(raw, profile_id):
    profiles = [p for p in json.loads(raw)['profiles'] if p.get('id') == profile_id]
    if len(profiles) != 1:
        raise ValueError('Ambiguous selected profile')
    return profiles[0]


def _catalog_for_spec(root, report, spec):
    original = _git_blob(root, spec['sourceRevision'], CATALOG)
    if _hash(original) != spec['files'][CATALOG] or _hash(original) != report['catalogSha256']:
        raise ValueError('Original signed catalog differs')
    current = _read_regular(root, CATALOG, MAX_FILE)
    selected = []
    for raw in (original, current):
        items = json.loads(raw)
        if not isinstance(items, list):
            raise ValueError('Invalid catalog')
        matches = [item for item in items if item.get('name') == spec['toolName']]
        if len(matches) != 1:
            raise ValueError('Ambiguous tool contract')
        selected.append(matches[0])
    if not _same(*selected):
        raise ValueError('Current own tool metadata changed')
    return original


def catalog_bytes_for_signed_report(root, report):
    """Keep existing validation for unchanged catalogs; narrowly scope the fallback."""
    current = _read_regular(root, CATALOG, MAX_FILE)
    if _hash(current) == report.get('catalogSha256'):
        return current
    return _catalog_for_spec(root, report, _spec(root, report))


def needs_original_context(root, report):
    try:
        return _hash(_read_regular(root, CATALOG, MAX_FILE)) != report.get('catalogSha256')
    except (OSError, ValueError):
        return True  # The protected verifier then refuses an unreadable context.


def validate_in_original_context(root, report_bytes, claim):
    """Only immutable read-only signature verification, after real live-claim gates."""
    try:
        if len(report_bytes) > MAX_REPORT or not isinstance(claim, dict):
            return False
        report = json.loads(report_bytes)
        spec = _spec(root, report)
        if _hash(report_bytes) != spec['reportSha256']:
            return False
        receipt = report['runnerReceipt']
        bindings = {
            'state': 'REPORT_WRITTEN', 'reportWritten': True, 'retryAllowed': False,
            'profileId': spec['profileId'], 'toolName': spec['toolName'], 'reportPath': spec['reportPath'],
            'reportSha256': spec['reportSha256'], 'sourceCandidateSha': report['sourceRevision'],
            'runNumber': report['runNumber'], 'prNumber': report['prNumber'], 'claimId': report['claimId'],
            'baseSha': report['baseSha'], 'ciSha': report['ciSha'], 'ciStatus': report['ciStatus'],
            'reviewerId': report['reviewerId'],
            'bundleSha256': report['mcpBundleSha256'], 'registrySha256': report['registrySha256'],
            'expectedArgumentsSha256': report['expectedArgumentsSha256'],
            'runnerReceiptPublicKey': receipt['publicKeyBase64'],
            'runnerReceiptPublicKeySha256': receipt['publicKeySha256'],
            'runnerReceiptSha256': _hash(json.dumps(receipt, sort_keys=True, separators=(',', ':'), ensure_ascii=False).encode()),
        }
        bindings.update({key: report[key] for key in ('ciRunId', 'ciChecks') if key in report})
        if not _same({key: claim.get(key) for key in bindings}, bindings):
            return False
        _catalog_for_spec(root, report, spec)
        files = {name: _git_blob(root, spec['sourceRevision'], name) for name in spec['files']}
        if (sum(map(len, files.values())) > MAX_CONTEXT
                or any(_hash(raw) != spec['files'][name] for name, raw in files.items())):
            return False
        profile = _selected_profile(files[REGISTRY], spec['profileId'])
        current_profile = _selected_profile(_read_regular(root, REGISTRY, MAX_FILE), spec['profileId'])
        if (not _same(profile, current_profile) or profile['toolName'] != spec['toolName']
                or profile['reportPath'] != spec['reportPath'] or profile['selectionEvidencePath'] != spec['selectionEvidencePath']
                or _hash(files[spec['selectionEvidencePath']]) != report['selectionEvidenceSha256']
                or _read_regular(root, spec['selectionEvidencePath'], MAX_FILE) != files[spec['selectionEvidencePath']]):
            return False
        with tempfile.TemporaryDirectory(prefix='bgk-signed-report-readonly-') as temporary:
            context = Path(temporary).resolve()
            for name, raw in files.items():
                target = context / name
                target.parent.mkdir(parents=True, exist_ok=True)
                target.write_bytes(raw)
                target.chmod(0o400)
            guard = context / 'readonly-guard.mjs'
            guard.write_bytes(_read_regular(ROOT, GUARD, MAX_FILE))
            guard.chmod(0o400)
            # Node 22.13+ and 24 support --permission. Unsupported versions
            # refuse; there is deliberately no unprotected fallback.
            result = subprocess.run(['node', '--permission', '--allow-fs-read=' + str(context),
                '--max-old-space-size=64', '--import', str(guard), str(context / spec['validatorPath'])],
                cwd=context, env={'PATH': os.environ.get('PATH', ''), 'HOME': str(context),
                    'TZ': 'UTC', 'NODE_NO_WARNINGS': '1'},
                input=json.dumps({'claim': claim, 'reportBytesBase64': base64.b64encode(report_bytes).decode('ascii'), 'root': str(context)}),
                capture_output=True, text=True, timeout=15, check=False)
            if result.returncode != 0 or len(result.stdout) > 32768 or len(result.stderr) > 32768:
                return False
            value = json.loads(result.stdout)
            return value.get('passed') is True and value.get('reportSha256') == _hash(report_bytes)
    except (OSError, ValueError, KeyError, TypeError, AttributeError, subprocess.SubprocessError):
        return False
