#!/usr/bin/env python3
"""Validate the secret-free Bangumi OAuth acceptance report template/report."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_REPORT = ROOT / 'docs/auth-acceptance-report.template.json'
STATUSES = {'NOT_STARTED', 'UNVERIFIED', 'PASS', 'FAIL', 'DEFERRED_EXTERNAL'}
REQUIRED_FLOW = {
    'auth_start', 'browser_authorization', 'oauth_callback', 'auth_status',
    'list_accounts', 'switch_account', 'private_read', 'write_confirmation',
    'destructive_safety',
}
FORBIDDEN = {
    'access_token', 'refresh_token', 'authorization_code', 'client_secret',
    'password', 'cookie', 'authorization',
}


def walk(value: Any, path: str = '$'):
    if isinstance(value, dict):
        for key, child in value.items():
            yield path, key, child
            yield from walk(child, f'{path}.{key}')
    elif isinstance(value, list):
        for index, child in enumerate(value):
            yield from walk(child, f'{path}[{index}]')


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--report', type=Path, default=DEFAULT_REPORT)
    args = parser.parse_args()
    try:
        report = json.loads(args.report.read_text(encoding='utf-8'))
    except (OSError, json.JSONDecodeError) as exc:
        print(f'auth report invalid: {exc}', file=sys.stderr)
        return 2
    errors: list[str] = []
    if not isinstance(report, dict):
        errors.append('top-level value must be an object')
    else:
        if report.get('schema_version') != 1:
            errors.append('schema_version must be 1')
        if report.get('report_status') not in STATUSES:
            errors.append(f'report_status must be one of {sorted(STATUSES)}')
        flow = report.get('flow')
        if not isinstance(flow, list):
            errors.append('flow must be a list')
        else:
            flow_by_id = {
                item.get('id'): item for item in flow
                if isinstance(item, dict) and isinstance(item.get('id'), str)
            }
            ids = set(flow_by_id)
            missing = REQUIRED_FLOW - ids
            if missing:
                errors.append(f'missing flow steps: {", ".join(sorted(missing))}')
            for index, item in enumerate(flow):
                if not isinstance(item, dict):
                    errors.append(f'flow[{index}] must be an object')
                    continue
                if item.get('status') not in STATUSES:
                    errors.append(f'flow[{index}].status is invalid')
                if not isinstance(item.get('evidence'), list):
                    errors.append(f'flow[{index}].evidence must be a list')
                elif item.get('status') == 'PASS' and not item['evidence']:
                    errors.append(f'flow[{index}] marked PASS must include evidence')
            if report.get('report_status') == 'PASS':
                incomplete = sorted(
                    flow_id for flow_id in REQUIRED_FLOW
                    if flow_by_id.get(flow_id, {}).get('status') != 'PASS'
                )
                if incomplete:
                    errors.append(
                        'report_status PASS requires all flow steps to pass: '
                        + ', '.join(incomplete)
                    )
        for path, key, value in walk(report):
            normalized = str(key).lower()
            if normalized in FORBIDDEN:
                errors.append(f'forbidden credential field at {path}.{key}')
            if isinstance(value, str) and any(term in value.lower() for term in ('bearer ', 'ghp_', 'sk-', 'oauth_code=')):
                errors.append(f'possible credential material at {path}.{key}')
    if errors:
        print('auth report invalid:')
        for error in errors:
            print(f'- {error}')
        return 1
    print(f'auth report valid: {args.report}; secret fields absent; {len(report["flow"])} flow steps')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
