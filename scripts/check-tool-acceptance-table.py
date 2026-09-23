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
SOURCE_REFERENCE = re.compile(r'`(?P<path>tests/[^`|:]+):(?P<line>[1-9][0-9]*)`')
VALID_LIVE = {'◐', '—', '⬜'}
VALID_MARK = {'✅', '⬜', '—'}


def source_reference_error(name: str, cell: str) -> str | None:
    references = list(SOURCE_REFERENCE.finditer(cell))
    parts = cell.split('<br>')
    if not references:
        return f'{name}: missing direct execute test source reference'
    if len(references) != len(parts):
        return f'{name}: malformed direct execute test source reference'
    test_root = (ROOT / 'tests').resolve()
    for reference in references:
        source_path = (ROOT / reference.group('path')).resolve()
        try:
            source_path.relative_to(test_root)
        except ValueError:
            return f'{name}: test source reference escapes tests/'
        if not source_path.is_file():
            return f'{name}: test source {reference.group("path")} does not exist'
        line = int(reference.group('line'))
        line_count = len(source_path.read_text(encoding='utf-8', errors='ignore').splitlines())
        if line > line_count:
            return f'{name}: test source line {line} is out of range'
    return None


def catalog_schema_reference_error(name: str, cell: str, expected_index: int) -> str | None:
    expected = f'`docs/tool-catalog.json#/{expected_index}`'
    if cell != expected:
        return f'{name}: expected {expected} for its registration/schema entry'
    return None


def main() -> int:
    catalog = json.loads(CATALOG.read_text(encoding='utf-8'))
    expected = {item['name'] for item in catalog}
    catalog_index = {item['name']: index for index, item in enumerate(catalog)}
    rows: dict[str, list[str]] = {}
    for line in TABLE.read_text(encoding='utf-8').splitlines():
        match = TOOL_ROW.match(line)
        if not match:
            continue
        fields = [part.strip() for part in line.strip('|').split('|')]
        if len(fields) != 13:
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
        catalog_error = catalog_schema_reference_error(name, fields[3], catalog_index[name])
        if catalog_error:
            raise SystemExit(catalog_error)
        if fields[5] not in VALID_MARK:
            raise SystemExit(f'{name}: directory/schema/direct execute status is invalid')
        if fields[5] == '✅':
            reference_error = source_reference_error(name, fields[4])
            if reference_error:
                raise SystemExit(reference_error)
        elif fields[4] != '⬜':
            raise SystemExit(f'{name}: pending direct execute must not claim source references')
        if fields[6] not in VALID_LIVE:
            raise SystemExit(f'{name}: invalid public API status {fields[6]!r}')
        if any(fields[index] not in VALID_MARK for index in (7, 8, 9, 10, 11)):
            raise SystemExit(f'{name}: invalid auth gate, account auth, Agent/MCP, QQ pipeline, or TIM status')

    print(json.dumps({
        'catalog': len(expected),
        'rows': len(rows),
        'direct_execute': sum(fields[5] == '✅' for fields in rows.values()),
        'public_evidence': sum(fields[6] == '◐' for fields in rows.values()),
        'public_not_applicable': sum(fields[6] == '—' for fields in rows.values()),
        'public_pending': sum(fields[6] == '⬜' for fields in rows.values()),
        'auth_gate_denial': sum(fields[7] == '✅' for fields in rows.values()),
        'auth_gate_pending': sum(fields[7] == '⬜' for fields in rows.values()),
        'auth_pending': sum(fields[8] == '⬜' for fields in rows.values()),
        'agent_mcp_e2e': sum(fields[9] == '✅' for fields in rows.values()),
        'qq_pipeline_e2e': sum(fields[10] == '✅' for fields in rows.values()),
        'tim_client_e2e': sum(fields[11] == '✅' for fields in rows.values()),
        'qq_pipeline_pending': sum(fields[10] == '⬜' for fields in rows.values()),
        'tim_client_pending': sum(fields[11] == '⬜' for fields in rows.values()),
    }, ensure_ascii=False))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
