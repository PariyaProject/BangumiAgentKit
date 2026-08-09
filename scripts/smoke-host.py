from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
import tempfile
from datetime import datetime, timedelta, timezone
from pathlib import Path


EXAMPLE_DIR = Path(__file__).resolve().parents[1] / 'examples' / 'nonebot2-claude-code'
sys.path.insert(0, str(EXAMPLE_DIR))

from bangumi_host.artifacts import ArtifactResolver  # noqa: E402
from bangumi_host.claude_cli import ClaudeCli  # noqa: E402
from bangumi_host.config import HostConfig  # noqa: E402
from bangumi_host.identity import build_qq_identity  # noqa: E402
from bangumi_host.service import ClaudeHostService  # noqa: E402
from bangumi_host.session_store import HostSessionStore  # noqa: E402


PNG = b'\x89PNG\r\n\x1a\n' + b'host-smoke'
FAKE_CLAUDE = EXAMPLE_DIR / 'tests' / 'fixtures' / 'fake_claude.py'


def make_config(root: Path, fake_claude: Path) -> HostConfig:
    data_dir = root / 'data'
    system_prompt = root / 'system-prompt.md'
    system_prompt.write_text('smoke prompt\n', encoding='utf-8')
    mcp_entry = root / 'mcp-entry.js'
    mcp_entry.write_text('// smoke MCP entry\n', encoding='utf-8')
    return HostConfig(
        claude_bin=str(fake_claude),
        claude_workdir=root / 'workdir',
        timeout_seconds=3,
        max_output_bytes=64 * 1024,
        max_turns=12,
        data_dir=data_dir,
        artifact_dir=data_dir / 'artifacts',
        env_file=None,
        mcp_config=data_dir / 'mcp.generated.json',
        response_schema=EXAMPLE_DIR / 'response-schema.json',
        system_prompt=system_prompt,
        session_ttl_hours=24,
        strict_mcp=True,
        allowed_tools=('mcp__bangumi__*',),
        repo_root=root,
        mcp_entry=mcp_entry,
        builtin_tools=('WebSearch', 'WebFetch'),
        claude_env_allowlist=('FAKE_CLAUDE_LOG', 'FAKE_CLAUDE_SCENARIO'),
    )


def make_artifact(root: Path) -> None:
    artifact_dir = root / 'data' / 'artifacts'
    artifact_dir.mkdir(parents=True, exist_ok=True)
    (artifact_dir / 'art_smoke.png').write_bytes(PNG)
    (artifact_dir / 'art_smoke.json').write_text(
        json.dumps(
            {
                'id': 'art_smoke',
                'mimeType': 'image/png',
                'expiresAt': (datetime.now(timezone.utc) + timedelta(minutes=5)).isoformat(),
                'filePath': '/ignored/metadata/path.png',
            }
        ),
        encoding='utf-8',
    )


async def run_smoke() -> None:
    with tempfile.TemporaryDirectory(prefix='bangumi-host-smoke-') as temporary:
        root = Path(temporary)
        fake_claude = root / 'fake-claude.py'
        shutil.copy2(FAKE_CLAUDE, fake_claude)
        fake_claude.chmod(0o755)
        make_artifact(root)
        log_path = root / 'claude-calls.jsonl'

        environment_backup = os.environ.copy()
        os.environ['FAKE_CLAUDE_LOG'] = str(log_path)
        os.environ['FAKE_CLAUDE_SCENARIO'] = 'success'
        os.environ['BANGUMI_TOKEN_ENCRYPTION_KEY'] = 'SENTINEL'
        os.environ['BANGUMI_OAUTH_CLIENT_SECRET'] = 'SENTINEL'
        os.environ['DATABASE_URL'] = 'SENTINEL'
        os.environ['SOME_OTHER_BOT_SECRET'] = 'SENTINEL'
        os.environ['BANGUMI_ENV_FILE'] = '/secret/.env'
        try:
            config = make_config(root, fake_claude)
            store = HostSessionStore(config.data_dir / 'host-bridge.sqlite', session_ttl_seconds=86400)
            service = ClaudeHostService(
                config=config,
                runner=ClaudeCli(config),
                session_store=store,
                artifact_resolver=ArtifactResolver(config.artifact_dir),
            )
            identity = build_qq_identity('smoke-user', 'smoke-group', 'smoke-bot', 'Smoke User')

            first = await service.handle_message(identity, 'hello')
            assert first.response.text == 'fake response'
            os.environ['FAKE_CLAUDE_SCENARIO'] = 'artifact'
            artifact = await service.handle_message(identity, 'make a card')
            assert artifact.response.artifacts[0].id == 'art_smoke'
            assert artifact.artifact_paths and artifact.artifact_paths[0].read_bytes() == PNG

            os.environ['FAKE_CLAUDE_SCENARIO'] = 'pending-confirmation'
            pending = await service.handle_message(identity, 'perform a write')
            assert pending.response.pending_confirmation is not None

            cancelled = await service.handle_message(identity, '取消')
            assert cancelled.error_code == 'CONFIRMATION_CANCELLED'
            assert len(log_path.read_text(encoding='utf-8').splitlines()) == 3

            os.environ['FAKE_CLAUDE_SCENARIO'] = 'success'
            after_cancel = await service.handle_message(identity, '确认')
            assert after_cancel.response.text == 'fake response'
            assert len(log_path.read_text(encoding='utf-8').splitlines()) == 4

            os.environ['FAKE_CLAUDE_SCENARIO'] = 'pending-confirmation'
            pending_again = await service.handle_message(identity, 'perform a write again')
            assert pending_again.response.pending_confirmation is not None
            os.environ['FAKE_CLAUDE_SCENARIO'] = 'success'
            confirmed = await service.handle_message(identity, '确认')
            assert confirmed.response.pending_confirmation is None
            assert confirmed.response.text == 'fake response'
            service.close()

            calls = [json.loads(line) for line in log_path.read_text(encoding='utf-8').splitlines()]
            assert len(calls) == 6
            assert calls[0]['identity']['BANGUMI_MCP_EXTERNAL_USER_ID'] == 'smoke-user'
            assert 'BANGUMI_MCP_PRINCIPAL_ID' not in calls[0]['identity']
            assert calls[0]['identity']['BANGUMI_MCP_CONFIRMATION_GRANT'] is None
            assert calls[2]['identity']['BANGUMI_MCP_CONFIRMATION_GRANT'] is None
            assert calls[3]['identity']['BANGUMI_MCP_CONFIRMATION_GRANT'] is None
            assert calls[4]['identity']['BANGUMI_MCP_CONFIRMATION_GRANT'] is None
            assert calls[5]['identity']['BANGUMI_MCP_CONFIRMATION_GRANT'] == 'cfm_smoke'
            for call in calls:
                assert all(value is False for value in call['environment_present'].values())
            assert '--resume' not in calls[0]['args']
            assert '--resume' in calls[1]['args']
            assert '--mcp-config' in calls[1]['args']
            assert '--json-schema' in calls[1]['args']
            assert '--tools' in calls[1]['args']
            assert calls[1]['args'][calls[1]['args'].index('--tools') + 1] == 'WebSearch,WebFetch'
            assert '--allowedTools' in calls[1]['args']
            assert '--append-system-prompt-file' in calls[1]['args']
            mcp_config = json.loads(config.mcp_config.read_text(encoding='utf-8'))
            bridge_env = mcp_config['mcpServers']['bangumi']['env']
            assert bridge_env['BANGUMI_MCP_IDENTITY_PROVIDER'] == '${BANGUMI_MCP_IDENTITY_PROVIDER}'
            assert bridge_env['BANGUMI_MCP_CONFIRMATION_GRANT'] == '${BANGUMI_MCP_CONFIRMATION_GRANT:-}'
            print('smoke:host passed')
        finally:
            os.environ.clear()
            os.environ.update(environment_backup)


if __name__ == '__main__':
    asyncio.run(run_smoke())
