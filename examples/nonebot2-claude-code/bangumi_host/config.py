from __future__ import annotations

import json
import os
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Mapping


class HostConfigError(ValueError):
    """Raised when the external Host configuration is unsafe or incomplete."""


_ENV_NAME_PATTERN = re.compile(r'^[A-Za-z_][A-Za-z0-9_]*$')
_MCP_IDENTITY_ENV_NAMES = frozenset(
    {
        'BANGUMI_MCP_IDENTITY_PROVIDER',
        'BANGUMI_MCP_EXTERNAL_USER_ID',
        'BANGUMI_MCP_BOT_INSTANCE_ID',
        'BANGUMI_MCP_CONVERSATION_ID',
        'BANGUMI_MCP_DISPLAY_NAME',
        'BANGUMI_MCP_CONFIRMATION_GRANT',
    }
)
_CLAUDE_BASE_ENV_NAMES = frozenset(
    {
        'PATH',
        'HOME',
        'USER',
        'LOGNAME',
        'SHELL',
        'TMPDIR',
        'TMP',
        'TEMP',
        'LANG',
        'LC_ALL',
        'LC_CTYPE',
        'SSL_CERT_FILE',
        'SSL_CERT_DIR',
        'HTTP_PROXY',
        'HTTPS_PROXY',
        'ALL_PROXY',
        'NO_PROXY',
        'http_proxy',
        'https_proxy',
        'all_proxy',
        'no_proxy',
    }
)
_CLAUDE_AUTH_ENV_NAMES = frozenset(
    {
        'ANTHROPIC_API_KEY',
        'ANTHROPIC_AUTH_TOKEN',
        'ANTHROPIC_BASE_URL',
        'ANTHROPIC_MODEL',
        'ANTHROPIC_SMALL_FAST_MODEL',
        'CLAUDE_CODE_OAUTH_TOKEN',
        'CLAUDE_CODE_USE_BEDROCK',
        'CLAUDE_CODE_USE_FOUNDRY',
        'CLAUDE_CODE_USE_VERTEX',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'AWS_SESSION_TOKEN',
        'AWS_PROFILE',
        'AWS_REGION',
        'AWS_DEFAULT_REGION',
        'AWS_SDK_LOAD_CONFIG',
        'GOOGLE_APPLICATION_CREDENTIALS',
        'GOOGLE_CLOUD_PROJECT',
        'GOOGLE_CLOUD_QUOTA_PROJECT',
        'VERTEXAI_PROJECT',
        'VERTEXAI_REGION',
    }
)


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


def _parse_csv(raw: str) -> tuple[str, ...]:
    return tuple(item.strip() for item in raw.split(',') if item.strip())


def _parse_env_allowlist(raw: str) -> tuple[str, ...]:
    values = _parse_csv(raw)
    for name in values:
        if name == '*' or not _ENV_NAME_PATTERN.fullmatch(name):
            raise HostConfigError(
                'BANGUMI_HOST_CLAUDE_ENV_ALLOWLIST must contain explicit environment names, not wildcards'
            )
        if name.startswith('BANGUMI_'):
            raise HostConfigError(
                'BANGUMI_HOST_CLAUDE_ENV_ALLOWLIST cannot pass BANGUMI_* server variables to Claude'
            )
    return values


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
    builtin_tools: tuple[str, ...] = ('WebSearch', 'WebFetch')
    claude_env_allowlist: tuple[str, ...] = ()

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
        allowed_tools = _parse_csv(allowed_tools_raw)
        if not allowed_tools:
            raise HostConfigError('BANGUMI_HOST_ALLOWED_TOOLS must contain at least one tool pattern')
        builtin_tools = _parse_csv(env.get('BANGUMI_HOST_BUILTIN_TOOLS', 'WebSearch,WebFetch'))
        if any('*' in item for item in builtin_tools):
            raise HostConfigError('BANGUMI_HOST_BUILTIN_TOOLS must name explicit tools, not wildcards')
        claude_env_allowlist = _parse_env_allowlist(
            env.get('BANGUMI_HOST_CLAUDE_ENV_ALLOWLIST', '')
        )

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
            builtin_tools=builtin_tools,
            claude_env_allowlist=claude_env_allowlist,
        )
        config.validate()
        return config

    def validate(self, require_runtime_files: bool = False) -> None:
        if not self.claude_bin.strip():
            raise HostConfigError('CLAUDE_BIN must not be empty')
        if any('*' in item for item in self.builtin_tools):
            raise HostConfigError('BANGUMI_HOST_BUILTIN_TOOLS must name explicit tools, not wildcards')
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
        is_default_config = self.mcp_config == self.data_dir / 'mcp.generated.json'
        if self.mcp_config.exists() and not is_default_config:
            if not self.mcp_config.is_file():
                raise HostConfigError(f'MCP config is not a file: {self.mcp_config}')
            return self.mcp_config

        if not is_default_config:
            raise HostConfigError(f'Configured MCP config does not exist: {self.mcp_config}')
        if not self.mcp_entry.is_file():
            raise HostConfigError(f'Built MCP entry not found: {self.mcp_entry}')

        self.ensure_runtime_dirs()
        server_env: dict[str, str] = {
            'BANGUMI_DATA_DIR': str(self.data_dir),
            'BANGUMI_DB_DRIVER': 'sqlite',
            'BANGUMI_MCP_IDENTITY_PROVIDER': '${BANGUMI_MCP_IDENTITY_PROVIDER}',
            'BANGUMI_MCP_EXTERNAL_USER_ID': '${BANGUMI_MCP_EXTERNAL_USER_ID}',
            'BANGUMI_MCP_BOT_INSTANCE_ID': '${BANGUMI_MCP_BOT_INSTANCE_ID}',
            'BANGUMI_MCP_CONVERSATION_ID': '${BANGUMI_MCP_CONVERSATION_ID}',
            'BANGUMI_MCP_DISPLAY_NAME': '${BANGUMI_MCP_DISPLAY_NAME:-}',
            'BANGUMI_MCP_CONFIRMATION_GRANT': '${BANGUMI_MCP_CONFIRMATION_GRANT:-}',
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
        parent = os.environ
        env: dict[str, str] = {}
        for name in self.claude_env_allowlist:
            if name.startswith('BANGUMI_') or name in {'DATABASE_URL', 'BANGUMI_SQLITE_PATH'}:
                raise HostConfigError(
                    f'Claude environment allowlist cannot pass server-only variable: {name}'
                )
        allowed_names = _CLAUDE_BASE_ENV_NAMES | _CLAUDE_AUTH_ENV_NAMES
        allowed_names |= set(self.claude_env_allowlist)
        for name in allowed_names:
            value = parent.get(name)
            if value is not None:
                env[name] = value
        for name, value in parent.items():
            if name.startswith('LC_'):
                env[name] = value

        for name, value in identity_env.items():
            if name not in _MCP_IDENTITY_ENV_NAMES:
                raise HostConfigError(f'Unsupported Host identity environment variable: {name}')
            if not isinstance(value, str):
                raise HostConfigError(f'Host identity environment variable {name} must be a string')
            if value:
                env[name] = value
        return env
