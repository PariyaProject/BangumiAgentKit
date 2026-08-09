from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
import tempfile
import unittest
from pathlib import Path

from bangumi_host.claude_cli import ClaudeCli, ClaudeCommandBuilder
from bangumi_host.config import HostConfig


EXAMPLE_DIR = Path(__file__).resolve().parents[1]
FAKE_CLAUDE = Path(__file__).resolve().parent / 'fixtures' / 'fake_claude.py'


def make_config(
    root: Path,
    timeout_seconds: int = 2,
    max_output_bytes: int = 16 * 1024,
    claude_bin: Path = FAKE_CLAUDE,
) -> HostConfig:
    data_dir = root / 'data'
    response_schema = EXAMPLE_DIR / 'response-schema.json'
    system_prompt = root / 'system-prompt.md'
    system_prompt.write_text('test system prompt\n', encoding='utf-8')
    mcp_entry = root / 'main.js'
    mcp_entry.write_text('// fake MCP entry\n', encoding='utf-8')
    config = HostConfig(
        claude_bin=str(claude_bin),
        claude_workdir=root / 'workdir',
        timeout_seconds=timeout_seconds,
        max_output_bytes=max_output_bytes,
        max_turns=12,
        data_dir=data_dir,
        artifact_dir=data_dir / 'artifacts',
        env_file=None,
        mcp_config=data_dir / 'mcp.generated.json',
        response_schema=response_schema,
        system_prompt=system_prompt,
        session_ttl_hours=24,
        strict_mcp=True,
        allowed_tools=('mcp__bangumi__*',),
        repo_root=root,
        mcp_entry=mcp_entry,
        builtin_tools=('WebSearch', 'WebFetch'),
        claude_env_allowlist=('FAKE_CLAUDE_LOG', 'FAKE_CLAUDE_SCENARIO'),
    )
    return config


class ClaudeCliTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix='bangumi-host-test-'))
        self.fake_claude = self.temp_dir / 'fake-claude.py'
        shutil.copy2(FAKE_CLAUDE, self.fake_claude)
        os.chmod(self.fake_claude, 0o755)
        self.original_scenario = os.environ.get('FAKE_CLAUDE_SCENARIO')
        self.original_log = os.environ.get('FAKE_CLAUDE_LOG')

    def tearDown(self) -> None:
        if self.original_scenario is None:
            os.environ.pop('FAKE_CLAUDE_SCENARIO', None)
        else:
            os.environ['FAKE_CLAUDE_SCENARIO'] = self.original_scenario
        if self.original_log is None:
            os.environ.pop('FAKE_CLAUDE_LOG', None)
        else:
            os.environ['FAKE_CLAUDE_LOG'] = self.original_log
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_command_contains_full_isolated_contract(self) -> None:
        config = make_config(self.temp_dir, claude_bin=self.fake_claude)
        for args in (
            ClaudeCommandBuilder(config).build('user message'),
            ClaudeCommandBuilder(config).build('user message', 'session-1'),
        ):
            self.assertEqual(args[0], str(self.fake_claude))
            self.assertIn('--output-format', args)
            self.assertIn('--json-schema', args)
            self.assertIn('--mcp-config', args)
            self.assertIn('--tools', args)
            self.assertEqual(args[args.index('--tools') + 1], 'WebSearch,WebFetch')
            self.assertIn('--strict-mcp-config', args)
            self.assertIn('--allowedTools', args)
            self.assertIn('mcp__bangumi__*', args)
            self.assertIn('--append-system-prompt-file', args)
            self.assertNotIn('--dangerously-skip-permissions', args)
            self.assertNotIn('bypassPermissions', args)
        self.assertIn('--resume', ClaudeCommandBuilder(config).build('user message', 'session-1'))
        self.assertIn('session-1', ClaudeCommandBuilder(config).build('user message', 'session-1'))
        self.assertIn('user message', ClaudeCommandBuilder(config).build('user message'))

    def test_success_and_resume(self) -> None:
        config = make_config(self.temp_dir, claude_bin=self.fake_claude)
        result = asyncio.run(
            ClaudeCli(config).run(
                'hello',
                {'BANGUMI_MCP_IDENTITY_PROVIDER': 'qq'},
                session_id='session-1',
            )
        )
        self.assertEqual(result.returncode, 0)
        self.assertIn('session-1', result.stdout)
        self.assertFalse(result.timed_out)
        self.assertFalse(result.output_limited)

    def test_subprocess_environment_contains_identity_and_grant_but_not_server_secrets(self) -> None:
        config = make_config(self.temp_dir, claude_bin=self.fake_claude)
        log_path = self.temp_dir / 'environment.jsonl'
        os.environ['FAKE_CLAUDE_LOG'] = str(log_path)
        os.environ['BANGUMI_TOKEN_ENCRYPTION_KEY'] = 'SENTINEL'
        os.environ['BANGUMI_OAUTH_CLIENT_SECRET'] = 'SENTINEL'
        os.environ['DATABASE_URL'] = 'SENTINEL'
        os.environ['SOME_OTHER_BOT_SECRET'] = 'SENTINEL'
        os.environ['BANGUMI_ENV_FILE'] = '/secret/.env'
        try:
            asyncio.run(
                ClaudeCli(config).run(
                    'confirm',
                    {
                        'BANGUMI_MCP_IDENTITY_PROVIDER': 'qq',
                        'BANGUMI_MCP_EXTERNAL_USER_ID': 'user-a',
                        'BANGUMI_MCP_BOT_INSTANCE_ID': 'qq:bot',
                        'BANGUMI_MCP_CONVERSATION_ID': 'qq:bot:private:user-a',
                        'BANGUMI_MCP_CONFIRMATION_GRANT': 'cfm_test',
                    },
                )
            )
            entry = json.loads(log_path.read_text(encoding='utf-8').splitlines()[0])
            self.assertEqual(entry['identity']['BANGUMI_MCP_EXTERNAL_USER_ID'], 'user-a')
            self.assertEqual(entry['identity']['BANGUMI_MCP_CONFIRMATION_GRANT'], 'cfm_test')
            self.assertTrue(all(value is False for value in entry['environment_present'].values()))
        finally:
            for key in (
                'BANGUMI_TOKEN_ENCRYPTION_KEY',
                'BANGUMI_OAUTH_CLIENT_SECRET',
                'DATABASE_URL',
                'SOME_OTHER_BOT_SECRET',
                'BANGUMI_ENV_FILE',
            ):
                os.environ.pop(key, None)

    def test_timeout_and_output_limit_are_bounded(self) -> None:
        config = make_config(
            self.temp_dir,
            timeout_seconds=1,
            max_output_bytes=1024,
            claude_bin=self.fake_claude,
        )

        os.environ['FAKE_CLAUDE_SCENARIO'] = 'timeout'
        timeout_result = asyncio.run(ClaudeCli(config).run('hello', {}))
        self.assertTrue(timeout_result.timed_out)

        os.environ['FAKE_CLAUDE_SCENARIO'] = 'oversized'
        oversized_result = asyncio.run(ClaudeCli(config).run('hello', {}))
        self.assertTrue(oversized_result.output_limited)

    def test_invalid_and_nonzero_results_remain_bounded(self) -> None:
        config = make_config(self.temp_dir, claude_bin=self.fake_claude)

        os.environ['FAKE_CLAUDE_SCENARIO'] = 'invalid-json'
        invalid_result = asyncio.run(ClaudeCli(config).run('hello', {}))
        self.assertEqual(invalid_result.returncode, 0)
        self.assertNotIn('secret', invalid_result.stdout)

        os.environ['FAKE_CLAUDE_SCENARIO'] = 'nonzero'
        nonzero_result = asyncio.run(ClaudeCli(config).run('hello', {}))
        self.assertEqual(nonzero_result.returncode, 7)
        self.assertIn('private diagnostic', nonzero_result.stderr)

        os.environ['FAKE_CLAUDE_SCENARIO'] = 'mcp-startup-failure'
        mcp_failure_result = asyncio.run(ClaudeCli(config).run('hello', {}))
        self.assertEqual(mcp_failure_result.returncode, 12)
        self.assertIn('MCP server failed to start', mcp_failure_result.stderr)


if __name__ == '__main__':
    unittest.main()
