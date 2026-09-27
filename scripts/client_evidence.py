"""Hash-bound per-tool evidence from the PariyaAgent QQ/TIM consumer pipeline."""

from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path


REPORT_GLOB = 'pariya-agent-production-client-e2e-*.json'
EVIDENCE_KIND = 'pariya_agent_tool_client_e2e'
PROFILE = 'public-render'
IMAGE = 'pariya-agent/agy-bangumi-poc:m1'
EVENT_ID = re.compile(r'[0-9a-f]{16}\Z')
PHASES = ['candidate', 'received', 'submitted', 'result', 'rendering', 'sending', 'sent']
MAX_TOOL_CALLS = 9  # One membership check plus up to eight supplied index reads.


def _tool_call_sequence_valid(tool: dict, gateway: object, catalog_by_name: dict[str, dict]) -> bool:
    if not isinstance(gateway, dict) or gateway.get('image') != IMAGE or gateway.get('status') != 'OK':
        return False
    calls = gateway.get('toolCalls')
    if not isinstance(calls, list) or not 1 <= len(calls) <= MAX_TOOL_CALLS:
        return False
    name = tool.get('name')
    states: list[str] = []
    names: list[str] = []
    has_renderer = False
    for call in calls:
        if not isinstance(call, dict) or call.get('server') != 'bangumi':
            return False
        call_name = call.get('name')
        call_tool = catalog_by_name.get(call_name) if isinstance(call_name, str) else None
        if (call_tool is None or call_tool.get('auth') != 'none'
                or call_tool.get('risk') != 'read' or call_name == 'bangumi.call_operation'
                or call.get('state') not in {'DONE', 'ERROR'}):
            return False
        names.append(call_name)
        states.append(call['state'])
        has_renderer = has_renderer or call_name.startswith('bangumi.render_')
    target_states = [state for call_name, state in zip(names, states) if call_name == name]
    if not target_states:
        return False
    error_count = states.count('ERROR')
    if error_count:
        # Preserve the existing same-tool retry case. Companion calls must all
        # succeed, and no mixed-target retry can be attributed safely.
        if names != [name, name] or states != ['ERROR', 'DONE']:
            return False
    elif any(state != 'DONE' for state in states):
        return False
    if type(gateway.get('toolErrors')) is not int or gateway['toolErrors'] != error_count:
        return False
    return gateway.get('artifactReturned') is has_renderer


def _qq_pipeline_valid(value: object) -> bool:
    return (
        isinstance(value, dict)
        and isinstance(value.get('eventId'), str)
        and EVENT_ID.fullmatch(value['eventId']) is not None
        and value.get('phases') == PHASES
        and value.get('resultCode') == 'OK'
        and value.get('sendFailed') is False
        and value.get('uncertain') is False
        and value.get('incomplete') is False
        and value.get('duplicate') is False
        and value.get('orderingViolations') == 0
    )


def report_status(
    report: object, tool: dict, catalog_sha256: str, catalog_by_name: dict[str, dict],
) -> tuple[bool, bool]:
    """Return (QQ pipeline, TIM client) only for a safe, exact current tool report."""
    if (not isinstance(report, dict) or report.get('schemaVersion') != 1
            or report.get('evidenceKind') != EVIDENCE_KIND
            or report.get('catalogSha256') != catalog_sha256
            or report.get('profile') != PROFILE
            or report.get('tool') != tool.get('name')
            or tool.get('risk') != 'read' or tool.get('auth') != 'none'
            or tool.get('name') == 'bangumi.call_operation'
            or not _tool_call_sequence_valid(tool, report.get('gateway'), catalog_by_name)
            or not _qq_pipeline_valid(report.get('qqPipeline'))):
        return False, False

    privacy = report.get('privacy')
    if (not isinstance(privacy, dict)
            or any(privacy.get(key) is not False for key in (
                'messageBodyStored', 'replyBodyStored', 'qqIdStored', 'screenshotStored',
            ))):
        return False, False

    tim_client = report.get('timClient')
    if not isinstance(tim_client, dict):
        return True, False
    calls = report['gateway']['toolCalls']
    has_renderer = any(
        isinstance(call, dict) and isinstance(call.get('name'), str)
        and call['name'].startswith('bangumi.render_')
        for call in calls
    )
    displayed_image = tim_client.get('displayedImage')
    image_origin = tim_client.get('imageOrigin')
    image_display_valid = (
        type(displayed_image) is bool
        and (not has_renderer or displayed_image is True)
        and (not displayed_image or image_origin in {'bangumi_artifact', 'astrbot_presentation'})
        and (not has_renderer or image_origin == 'bangumi_artifact')
    )
    tim_passed = (
        tim_client.get('observed') is True
        and tim_client.get('inputObserved') is True
        and tim_client.get('textDisplayed') is True
        and image_display_valid
        and tim_client.get('evidenceSource') == 'computer_use_observed'
        and tim_client.get('scope') in {'private_dm', 'group_5450494'}
        and tim_client.get('recipientIsBot') is True
        and tim_client.get('onlyAuthorizedConversation') is True
    )
    return True, tim_passed


def tool_client_e2e_sources(
    catalog: list[dict], *, catalog_path: Path, report_dir: Path, root: Path,
) -> tuple[dict[str, set[str]], dict[str, set[str]]]:
    """Read sanitized client reports and bind them to the current tool catalog."""
    catalog_sha256 = hashlib.sha256(Path(catalog_path).read_bytes()).hexdigest()
    current = {tool.get('name'): tool for tool in catalog if isinstance(tool, dict)}
    qq_sources: dict[str, set[str]] = {}
    tim_sources: dict[str, set[str]] = {}
    for path in Path(report_dir).glob(REPORT_GLOB):
        try:
            report = json.loads(path.read_text(encoding='utf-8'))
        except (OSError, ValueError):
            continue
        name = report.get('tool') if isinstance(report, dict) else None
        tool = current.get(name)
        if tool is None:
            continue
        qq_passed, tim_passed = report_status(report, tool, catalog_sha256, current)
        if not qq_passed:
            continue
        try:
            relative = path.resolve().relative_to(Path(root).resolve()).as_posix()
        except (OSError, ValueError):
            continue
        qq_sources.setdefault(name, set()).add(relative)
        if tim_passed:
            tim_sources.setdefault(name, set()).add(relative)
    return qq_sources, tim_sources
