from __future__ import annotations

import json
import shutil
import subprocess
import tempfile
from pathlib import Path

from .config import HostConfig, HostConfigError
from .session_store import HostSessionStore, HostSessionStoreError


REQUIRED_CLAUDE_FLAGS = (
    '--output-format',
    '--json-schema',
    '--mcp-config',
    '--strict-mcp-config',
    '--tools',
    '--allowedTools',
    '--resume',
)


def _check_claude(config: HostConfig) -> tuple[bool, str]:
    executable = shutil.which(config.claude_bin) or (
        config.claude_bin if Path(config.claude_bin).is_file() else None
    )
    if not executable:
        return False, f'Claude executable not found: {config.claude_bin}'
    try:
        version = subprocess.run(
            [executable, '--version'],
            cwd=config.claude_workdir,
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
        help_result = subprocess.run(
            [executable, '--help'],
            cwd=config.claude_workdir,
            capture_output=True,
            text=True,
            timeout=10,
            check=False,
        )
    except (OSError, subprocess.SubprocessError) as exc:
        return False, f'Claude CLI could not be inspected: {type(exc).__name__}'
    help_text = f'{help_result.stdout}\n{help_result.stderr}'
    missing = [flag for flag in REQUIRED_CLAUDE_FLAGS if flag not in help_text]
    reported_version = (version.stdout or version.stderr).strip().splitlines()
    version_text = reported_version[0] if reported_version else 'version unavailable'
    if missing:
        return False, f'{version_text}; missing required CLI flags: {", ".join(missing)}'
    return True, version_text


def _check_writable(directory: Path) -> tuple[bool, str]:
    try:
        directory.mkdir(parents=True, exist_ok=True, mode=0o700)
        with tempfile.NamedTemporaryFile(prefix='.doctor-', dir=directory, delete=True):
            pass
    except OSError as exc:
        return False, f'{directory} is not writable ({type(exc).__name__})'
    return True, f'{directory} is writable'


def run_doctor() -> int:
    print('=== BangumiAgentKit Claude Host Doctor ===')
    checks: list[tuple[str, bool, str, bool]] = []
    try:
        config = HostConfig.from_env()
        config.ensure_runtime_dirs()
    except HostConfigError as exc:
        print(f'[FAIL] Host configuration: {exc}')
        return 1
    except OSError as exc:
        print(f'[FAIL] Host runtime directories: {type(exc).__name__}')
        return 1

    claude_ok, claude_message = _check_claude(config)
    checks.append(('Claude CLI', claude_ok, claude_message, True))

    for path, label in (
        (config.mcp_entry, 'Built MCP entry'),
        (config.response_schema, 'Response schema'),
        (config.system_prompt, 'Host system prompt'),
    ):
        checks.append((label, path.is_file(), str(path), True))

    schema_ok = False
    try:
        payload = json.loads(config.response_schema.read_text(encoding='utf-8'))
        schema_ok = isinstance(payload, dict) and payload.get('additionalProperties') is False
    except (OSError, ValueError):
        schema_ok = False
    checks.append(('Response schema JSON', schema_ok, 'strict schema parsed', True))

    data_ok, data_message = _check_writable(config.data_dir)
    checks.append(('Host data directory', data_ok, data_message, True))
    artifact_ok, artifact_message = _check_writable(config.artifact_dir)
    checks.append(('Artifact directory', artifact_ok, artifact_message, True))

    try:
        HostSessionStore(config.data_dir / 'host-bridge.sqlite')
        checks.append(('Host session database', True, 'host-bridge.sqlite is usable', True))
    except HostSessionStoreError:
        checks.append(('Host session database', False, 'host-bridge.sqlite is not usable', True))

    if shutil.which('node'):
        checks.append(('Node.js', True, 'node executable found', False))
    else:
        checks.append(('Node.js', False, 'node executable not found', False))

    failures = 0
    for label, passed, message, required in checks:
        status = 'PASS' if passed else ('FAIL' if required else 'WARN')
        print(f'[{status}] {label}: {message}')
        if required and not passed:
            failures += 1
    print('Renderer/Chromium is optional; install it only when image cards are needed.')
    return 1 if failures else 0


if __name__ == '__main__':
    raise SystemExit(run_doctor())
