#!/usr/bin/env python3
"""Validate the generated 96-tool acceptance table without network access."""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CATALOG = ROOT / 'docs/tool-catalog.json'
TABLE = ROOT / 'docs/BANGUMI_TOOL_ACCEPTANCE_TASKS.md'
TOOL_ROW = re.compile(r'^\| `(bangumi\.[a-z0-9_]+)` \|')
VALID_LIVE = {'◐', '—', '⬜'}
VALID_MARK = {'✅', '⬜', '—'}


def main() -> int:
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    expected = {item['name'] for item in catalog}
    rows: dict[str, list[str]] = {}
    for line in TABLE.read_text(encoding='utf-8').splitlines():
        match = TOOL_ROW.match(line)
        if not match:
            continue
        fields = [part.strip() for part in line.strip('|').split('|')]
        if len(fields) != 12:
            raise SystemExit(f'bad acceptance row shape: {line}')
        name = match.group(1)
        if name in rows:
            raise SystemExit(f'duplicate acceptance row: {name}')
        rows[name] = fields

    missing = sorted(expected - set(rows))
    extra = sorted(set(rows) - expected)
    if missing or extra:
        raise SystemExit(f'acceptance table mismatch: missing={missing}, extra={extra}')

    for name, fields in rows.items():
        if fields[3:6] != ['✅', '✅', '✅']:
            raise SystemExit(f'{name}: directory/schema/source/direct execute coverage is incomplete')
        if fields[6] not in VALID_LIVE:
            raise SystemExit(f'{name}: invalid public API status {fields[6]!r}')
        if any(fields[index] not in VALID_MARK for index in (7, 8, 9, 10)):
            raise SystemExit(f'{name}: invalid auth, Agent/MCP, QQ pipeline, or TIM status')

    print(json.dumps({
        'catalog': len(expected),
        'rows': len(rows),
        'direct_execute': sum(fields[5] == '✅' for fields in rows.values()),
        'public_evidence': sum(fields[6] == '◐' for fields in rows.values()),
        'public_not_applicable': sum(fields[6] == '—' for fields in rows.values()),
        'public_pending': sum(fields[6] == '⬜' for fields in rows.values()),
        'auth_pending': sum(fields[7] == '⬜' for fields in rows.values()),
        'agent_mcp_e2e': sum(fields[8] == '✅' for fields in rows.values()),
        'qq_pipeline_e2e': sum(fields[9] == '✅' for fields in rows.values()),
        'tim_client_e2e': sum(fields[10] == '✅' for fields in rows.values()),
        'qq_pipeline_pending': sum(fields[9] == '⬜' for fields in rows.values()),
        'tim_client_pending': sum(fields[10] == '⬜' for fields in rows.values()),
    }, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
