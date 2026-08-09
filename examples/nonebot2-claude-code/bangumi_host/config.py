from __future__ import annotations

import json
import os
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping


class HostConfigError(ValueError):
    """Raised when the external Host configuration is unsafe or incomplete."""


def _env_bool(environ: Mapping[str, str], name: str, default: bool) -> bool:
    value = environ.get(name)
    if value is None:
        return default
    if value.lower() in {'1', 'true', 'yes', 'on'}:
        return True
    if value.lower() in {'0', 'false', 'no', 'off'}:
        return False
    raise HostConfigError(f'{name} must be a boolean value')


def _env_int(
    environ: Mapping[str, str],
    name: str,
    default: int,
    minimum: int,
    maximum: int,
) -> int:
    raw = environ.get(name)
    try:
        value = default if raw is None else int(raw)
    except ValueError as exc:
        raise HostConfigError(f'{name} must be an integer') from exc
    if not minimum <= value <= maximum:
        raise HostConfigError(f'{name} must be between {minimum} and {maximum}')
    return value


def _resolve_path(raw: str | None, default: Path) -> Path:
    return Path(raw).expanduser().resolve() if raw else default.expanduser().resolve()


@dataclass(frozen=True)
class HostConfig:
    claude_bin: str
    claude_workdir: Path
    timeout_seconds: int
    max_output_bytes: int
    max_turns: int
    data_dir: Path
    artifact_dir: Path
    env_file: Path | None
    mcp_config: Path
    response_schema: Path
    system_prompt: Path
    session_ttl_hours: int
    strict_mcp: bool
    allowed_tools: tuple[str, ...]
    repo_root: Path
    mcp_entry: Path

    @classmethod
    def from_env(
        cls,
        environ: Mapping[str, str] | None = None,
        repo_root: Path | None = None,
    ) -> 'HostConfig':
        env = os.environ if environ is None else environ
        root = (repo_root or Path(__file__).resolve().parents[3]).resolve()
        examples_dir = root / 'examples' / 'nonebot2-claude-code'

        data_dir = _resolve_path(env.get('BANGUMI_DATA_DIR'), Path.home() / '.bangumi-agent-kit')
        artifact_dir = _resolve_path(env.get('BANGUMI_ARTIFACT_DIR'), data_dir / 'artifacts')
        workdir = _resolve_path(env.get('CLAUDE_WORKDIR'), data_dir / 'claude-workdir')

        env_file_raw = env.get('BANGUMI_ENV_FILE')
        if env_file_raw:
            env_file = _resolve_path(env_file_raw, data_dir / '.env.local')
        else:
            env_file = None
            for candidate in (Path.cwd() / '.env.local', Path.cwd() / '.env'):
                if candidate.exists():
                    env_file = candidate.resolve()
                    break

        mcp_entry = _resolve_path(
            env.get('BANGUMI_MCP_ENTRY'), root / 'apps' / 'mcp' / 'dist' / 'main.js'
        )
        mcp_config = _resolve_path(env.get('BANGUMI_MCP_CONFIG'), data_dir / 'mcp.generated.json')
        response_schema = _resolve_path(
            env.get('BANGUMI_RESPONSE_SCHEMA'), examples_dir / 'response-schema.json'
        )
        system_prompt = _resolve_path(
            env.get('BANGUMI_HOST_SYSTEM_PROMPT'), examples_dir / 'system-prompt.md'
        )

        allowed_tools_raw = env.get('BANGUMI_HOST_ALLOWED_TOOLS', 'mcp__bangumi__*')
        allowed_tools = tuple(item.strip() for item in allowed_tools_raw.split(',') if item.strip())
        if not allowed_tools:
            raise HostConfigError('BANGUMI_HOST_ALLOWED_TOOLS must contain at least one tool pattern')

        config = cls(
            claude_bin=env.get('CLAUDE_BIN', 'claude'),
            claude_workdir=workdir,
            timeout_seconds=_env_int(env, 'CLAUDE_TIMEOUT_SECONDS', 75, 1, 600),
            max_output_bytes=_env_int(env, 'CLAUDE_MAX_OUTPUT_BYTES', 2 * 1024 * 1024, 1024, 32 * 1024 * 1024),
            max_turns=_env_int(env, 'CLAUDE_MAX_TURNS', 16, 1, 64),
            data_dir=data_dir,
            artifact_dir=artifact_dir,
            env_file=env_file,
            mcp_config=mcp_config,
            response_schema=response_schema,
            system_prompt=system_prompt,
            session_ttl_hours=_env_int(env, 'BANGUMI_HOST_SESSION_TTL_HOURS', 7 * 24, 1, 24 * 365),
            strict_mcp=_env_bool(env, 'BANGUMI_HOST_STRICT_MCP', True),
            allowed_tools=allowed_tools,
            repo_root=root,
            mcp_entry=mcp_entry,
        )
        config.validate()
        return config

    def validate(self, require_runtime_files: bool = False) -> None:
        if not self.claude_bin.strip():
            raise HostConfigError('CLAUDE_BIN must not be empty')
        if self.env_file is not None and not self.env_file.is_absolute():
            raise HostConfigError('BANGUMI_ENV_FILE must resolve to an absolute path')
        if require_runtime_files:
            if shutil.which(self.claude_bin) is None and not Path(self.claude_bin).exists():
                raise HostConfigError(f'Claude executable not found: {self.claude_bin}')
            for path, label in (
                (self.mcp_entry, 'MCP entry'),
                (self.response_schema, 'response schema'),
                (self.system_prompt, 'Host system prompt'),
            ):
                if not path.is_file():
                    raise HostConfigError(f'{label} not found: {path}')
            if self.env_file is not None and not self.env_file.is_file():
                raise HostConfigError(f'BANGUMI_ENV_FILE not found: {self.env_file}')

    def ensure_runtime_dirs(self) -> None:
        for directory in (self.data_dir, self.artifact_dir, self.claude_workdir):
            directory.mkdir(parents=True, exist_ok=True, mode=0o700)
            try:
                directory.chmod(0o700)
            except OSError:
                pass

    def ensure_mcp_config(self) -> Path:
        """Create the default absolute MCP config, or validate an explicit one."""
        if self.mcp_config.exists():
            if not self.mcp_config.is_file():
                raise HostConfigError(f'MCP config is not a file: {self.mcp_config}')
            return self.mcp_config

        if self.mcp_config != self.data_dir / 'mcp.generated.json':
            raise HostConfigError(f'Configured MCP config does not exist: {self.mcp_config}')
        if not self.mcp_entry.is_file():
            raise HostConfigError(f'Built MCP entry not found: {self.mcp_entry}')

        self.ensure_runtime_dirs()
        server_env: dict[str, str] = {
            'BANGUMI_DATA_DIR': str(self.data_dir),
            'BANGUMI_DB_DRIVER': 'sqlite',
        }
        if self.env_file is not None:
            server_env['BANGUMI_ENV_FILE'] = str(self.env_file)

        payload = {
            'mcpServers': {
                'bangumi': {
                    'command': 'node',
                    'args': [str(self.mcp_entry)],
                    'env': server_env,
                }
            }
        }
        self.mcp_config.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + '\n')
        try:
            self.mcp_config.chmod(0o600)
        except OSError:
            pass
        return self.mcp_config

    def process_environment(self, identity_env: Mapping[str, str]) -> dict[str, str]:
        env = dict(os.environ)
        env.update(identity_env)
        env.setdefault('BANGUMI_DATA_DIR', str(self.data_dir))
        env.setdefault('BANGUMI_DB_DRIVER', 'sqlite')
        if self.env_file is not None:
            env['BANGUMI_ENV_FILE'] = str(self.env_file)
        return env
