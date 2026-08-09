from __future__ import annotations

import asyncio
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
    )
    return config


class ClaudeCliTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = Path(tempfile.mkdtemp(prefix='bangumi-host-test-'))
        self.fake_claude = self.temp_dir / 'fake-claude.py'
        shutil.copy2(FAKE_CLAUDE, self.fake_claude)
        os.chmod(self.fake_claude, 0o755)
        self.original_scenario = os.environ.get('FAKE_CLAUDE_SCENARIO')

    def tearDown(self) -> None:
        if self.original_scenario is None:
            os.environ.pop('FAKE_CLAUDE_SCENARIO', None)
        else:
            os.environ['FAKE_CLAUDE_SCENARIO'] = self.original_scenario
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_command_contains_full_isolated_contract(self) -> None:
        config = make_config(self.temp_dir, claude_bin=self.fake_claude)
        args = ClaudeCommandBuilder(config).build('user message', 'session-1')
        self.assertEqual(args[0], str(self.fake_claude))
        self.assertIn('--output-format', args)
        self.assertIn('--json-schema', args)
        self.assertIn('--mcp-config', args)
        self.assertIn('--strict-mcp-config', args)
        self.assertIn('--allowedTools', args)
        self.assertIn('mcp__bangumi__*', args)
        self.assertIn('--append-system-prompt-file', args)
        self.assertIn('--resume', args)
        self.assertIn('session-1', args)
        self.assertIn('user message', args)

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
