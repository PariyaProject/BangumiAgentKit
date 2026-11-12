"""Two source-bound synthetic Agent/MCP observations; never public/account/client credit."""
from __future__ import annotations

import base64
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
from typing import Callable

PROFILE_ID = 'native-g03-date-png-model-v1'
REPORT = 'docs/live-probes/native-g03-date-png-model-run95-v1.json'
TOOLS = ('bangumi.query_subjects', 'bangumi.render_query_subjects')
REFRESH_PATHS = {
    REPORT, 'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md', 'docs/product/frontier-ledger.json',
    'docs/research/run95-native-g03-date-png-model-result-2026-11-12.md',
}

SHA = re.compile(r'[0-9a-f]{40}')


def _environment(root: Path) -> dict[str, str]:
    env = dict(os.environ)
    for key in list(env):
        if key.startswith('GIT_CONFIG_') or key in {
            'GIT_DIR', 'GIT_WORK_TREE', 'GIT_COMMON_DIR', 'GIT_INDEX_FILE',
            'GIT_OBJECT_DIRECTORY', 'GIT_ALTERNATE_OBJECT_DIRECTORIES',
            'GIT_CEILING_DIRECTORIES', 'GIT_DISCOVERY_ACROSS_FILESYSTEM', 'GIT_NAMESPACE', 'GIT_PREFIX',
            'GIT_CONFIG',
            'NODE_OPTIONS', 'NODE_PATH', 'LD_PRELOAD',
        } or key.startswith('DYLD_'):
            del env[key]
    env['PARIYA_BANGUMI_AGENT_KIT_SOURCE'] = str(root)
    env['GIT_CONFIG_GLOBAL'] = os.devnull
    env['GIT_CONFIG_SYSTEM'] = os.devnull
    env['GIT_CONFIG_NOSYSTEM'] = '1'
    return env


def _json_command(root: Path, args: list[str], payload: dict | None = None) -> object:
    env = _environment(root)
    result = subprocess.run(args, cwd=root, env=env, capture_output=True, text=True,
                            input=None if payload is None else json.dumps(payload),
                            timeout=30, check=False)
    if result.returncode != 0 or len(result.stdout.encode()) > 4 * 1024 * 1024:
        raise ValueError('native evidence read failed')
    return json.loads(result.stdout)


def native_g03_control_matches(report: dict, digest: str, status: object, epoch_status: object,
                                changed_paths: set[str], ci_run: object, ci_jobs: object) -> dict | None:
    """Pure admission predicate; external readers are supplied separately."""
    if not all(isinstance(v, dict) for v in [status, epoch_status, ci_run, ci_jobs]):
        return None
    if not isinstance(report, dict):
        return None
    gate = report.get('gate', {})
    disposition = status.get('disposition')
    run_view, epoch_view = epoch_status.get('run', {}), epoch_status.get('epoch', {})
    if not all(isinstance(v, dict) for v in [gate, disposition, run_view, epoch_view]):
        return None
    run, epoch = run_view.get('state', {}), epoch_view.get('state', {})
    if not all(isinstance(v, dict) for v in [run, epoch]):
        return None
    candidate, source = epoch.get('candidate_sha'), gate.get('sourceCandidateSha')
    active = (run.get('state') == 'EPOCH_ACTIVE' and run.get('active_epoch_pr') == gate.get('prNumber')
              and epoch_view.get('github_state') == 'OPEN')
    merged = epoch.get('state') == 'MERGED' and epoch_view.get('github_state') == 'MERGED'
    reviews = epoch.get('review_history')
    source_pass = isinstance(reviews, list) and any(
        isinstance(r, dict) and r.get('verdict') == 'PASS'
        and r.get('candidate_sha') == source and r.get('reviewed_base_sha') == gate.get('baseSha')
        and r.get('reviewer_id') == gate.get('reviewerId') for r in reviews)
    if (
        report.get('profileId') != PROFILE_ID or report.get('evidenceKind') != 'native_g03_date_png_agent_mcp_v1'
        or gate.get('runNumber') != 95 or type(gate.get('prNumber')) is not int
        or run_view.get('number') != 95 or not (active or merged) or not source_pass
        or not isinstance(candidate, str) or SHA.fullmatch(candidate) is None
        or epoch.get('epoch_id') != 'run95-native-g03-date-png-model-20261112'
        or epoch.get('pr_number') != gate.get('prNumber') or epoch.get('base_branch') != 'master'
        or epoch.get('base_sha') != gate.get('baseSha') or epoch.get('advances_frontier_ids') != ['G03']
        or epoch_view.get('pr_is_draft') is not False or epoch_view.get('pr_base_ref_name') != 'master'
        or epoch_view.get('pr_head_ref_name') != epoch.get('branch')
        or (active and epoch_view.get('pr_base_sha') != gate.get('baseSha'))
        or not isinstance(changed_paths, set) or not changed_paths <= REFRESH_PATHS
        or (merged and REPORT not in changed_paths)
        or status.get('state') != 'REPORT_WRITTEN' or status.get('profile_id') != PROFILE_ID
        or status.get('run') != 95 or status.get('pr') != gate.get('prNumber')
        or status.get('claim_label_present') is not True or status.get('terminal_label_present') is not True
        or disposition.get('state') != 'REPORT_WRITTEN' or disposition.get('retryAllowed') is not False
        or disposition.get('reportWritten') is not True or disposition.get('reportPath') != REPORT
        or disposition.get('reportSha256') != digest
        or any(disposition.get(key) != value for key, value in gate.items())
        or ci_run.get('head_sha') != source or str(ci_run.get('id')) != gate.get('ciRunId')
        or ci_run.get('event') != 'pull_request' or ci_run.get('status') != 'completed'
        or ci_run.get('conclusion') != 'success'
    ):
        return None
    required = gate.get('ciChecks')
    jobs = ci_jobs.get('jobs')
    if not isinstance(required, list) or len(required) != 7 or not isinstance(jobs, list) or ci_jobs.get('total_count') != len(jobs) or len(jobs) > 100:
        return None
    for check in required:
        if not isinstance(check, dict) or check.get('status') != 'COMPLETED' or check.get('conclusion') != 'SUCCESS':
            return None
        matching = [job for job in jobs if isinstance(job, dict) and job.get('name') == check.get('name')]
        if len(matching) != 1 or matching[0].get('status') != 'completed' or matching[0].get('conclusion') != 'success':
            return None
    return disposition


def native_g03_evidence_sources(root: Path, catalog: list[dict], *,
                                 report_dir: Path | None = None,
                                 read_json: Callable = _json_command) -> dict[str, set[str]]:
    """Read actual terminal/labels/CI and strict signature/source context, else no credit."""
    root = Path(root).resolve()
    # The report has one canonical namespace. Synthetic/alternate probe roots
    # must not borrow this checkout's real report or query its control plane.
    if report_dir is not None and Path(report_dir).resolve() != (root / 'docs/live-probes').resolve():
        return {}
    target = root / REPORT
    if not target.is_file() or target.is_symlink() or os.environ.get('HARNESS_MOCK_STATE'):
        return {}
    try:
        data = target.read_bytes()
        if len(data) > 65536:
            return {}
        report = json.loads(data)
        if not isinstance(report, dict):
            return {}
        gate = report.get('gate')
        if not isinstance(gate, dict) or type(gate.get('prNumber')) is not int or not 0 < gate['prNumber'] < 2**31:
            return {}
        source, ci = gate.get('sourceCandidateSha'), gate.get('ciRunId')
        if not isinstance(source, str) or SHA.fullmatch(source) is None or not isinstance(ci, str) or not re.fullmatch(r'[1-9]\d{3,17}', ci):
            return {}
        pr = str(gate['prNumber'])
        harness = ['node', str(root / 'scripts/agent-harness.mjs')]
        status = read_json(root, harness + ['epoch:agent-mcp-profile-status', '--run', '95', '--pr', pr, '--profile-id', PROFILE_ID])
        if not isinstance(status, dict) or status.get('state') != 'REPORT_WRITTEN':
            return {}
        epoch_status = read_json(root, harness + ['status', '--run', '95', '--pr', pr])
        epoch = epoch_status.get('epoch', {}).get('state', {})
        candidate = epoch.get('candidate_sha')
        head = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=root, env=_environment(root), text=True, timeout=5).strip()
        if not isinstance(candidate, str) or SHA.fullmatch(candidate) is None:
            return {}
        # During the initial evidence-only commit the control Candidate can
        # still name source. Inspect the actual PR head in that one transition.
        cut = epoch_status.get('epoch', {}).get('pr_head_sha') if epoch.get('state') != 'MERGED' else candidate
        if not isinstance(cut, str) or SHA.fullmatch(cut) is None:
            return {}
        for ancestor, descendant in [(source, cut), (cut, head)]:
            check = subprocess.run(['git', 'merge-base', '--is-ancestor', ancestor, descendant], cwd=root,
                                   env=_environment(root), capture_output=True, timeout=5, check=False)
            if check.returncode != 0:
                return {}
        paths = set(subprocess.check_output(['git', 'diff', '--name-only', source, cut], cwd=root,
                                            env=_environment(root), text=True, timeout=5).splitlines())
        ci_run = read_json(root, ['gh', 'api', f'repos/PariyaProject/BangumiAgentKit/actions/runs/{ci}'])
        ci_jobs = read_json(root, ['gh', 'api', f'repos/PariyaProject/BangumiAgentKit/actions/runs/{ci}/jobs?per_page=100'])
        digest = hashlib.sha256(data).hexdigest()
        claim = native_g03_control_matches(report, digest, status, epoch_status, paths, ci_run, ci_jobs)
        if claim is None:
            return {}
        result = read_json(root, ['node', str(root / 'scripts/acceptance/validate-native-g03-date-png-report.mjs')],
                           {'claim': claim, 'reportBytesBase64': base64.b64encode(data).decode('ascii')})
        if result.get('passed') is not True or result.get('reportSha256') != digest or result.get('runnerReceiptSha256') != claim.get('runnerReceiptSha256'):
            return {}
        own = report.get('source', {}).get('descriptors')
        current = [next((tool for tool in catalog if tool.get('name') == name), None) for name in TOOLS]
        if own != current or any(tool is None for tool in current):
            return {}
        return {name: {REPORT} for name in TOOLS}
    except (OSError, ValueError, KeyError, TypeError, AttributeError, subprocess.SubprocessError):
        return {}
