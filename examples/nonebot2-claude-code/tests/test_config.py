from __future__ import annotations

import json
import os
import shutil
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from bangumi_host.config import HostConfig, HostConfigError


class HostConfigTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(tempfile.mkdtemp(prefix='bangumi-host-config-test-'))

    def tearDown(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)

    def make_config(self, **kwargs: object) -> HostConfig:
        return HostConfig(
            claude_bin='claude',
            claude_workdir=self.root / 'workdir',
            timeout_seconds=2,
            max_output_bytes=16 * 1024,
            max_turns=12,
            data_dir=self.root / 'data',
            artifact_dir=self.root / 'data' / 'artifacts',
            env_file=self.root / '.env.local',
            mcp_config=self.root / 'data' / 'mcp.generated.json',
            response_schema=self.root / 'response-schema.json',
            system_prompt=self.root / 'system-prompt.md',
            session_ttl_hours=24,
            strict_mcp=True,
            allowed_tools=('mcp__bangumi__*',),
            repo_root=self.root,
            mcp_entry=self.root / 'main.js',
            **kwargs,
        )

    def test_process_environment_is_allowlisted_and_grant_is_per_invocation(self) -> None:
        config = self.make_config(claude_env_allowlist=('AWS_REGION',))
        parent = {
            'PATH': '/bin',
            'HOME': '/tmp/host-home',
            'AWS_REGION': 'us-test-1',
            'BANGUMI_TOKEN_ENCRYPTION_KEY': 'SENTINEL',
            'BANGUMI_OAUTH_CLIENT_SECRET': 'SENTINEL',
            'DATABASE_URL': 'SENTINEL',
            'SOME_OTHER_BOT_SECRET': 'SENTINEL',
            'BANGUMI_ENV_FILE': '/secret/.env',
            'BANGUMI_MCP_CONFIRMATION_GRANT': 'SENTINEL',
        }
        with patch.dict(os.environ, parent, clear=True):
            ordinary = config.process_environment(
                {
                    'BANGUMI_MCP_IDENTITY_PROVIDER': 'qq',
                    'BANGUMI_MCP_EXTERNAL_USER_ID': 'user-a',
                    'BANGUMI_MCP_BOT_INSTANCE_ID': 'qq:bot',
                    'BANGUMI_MCP_CONVERSATION_ID': 'qq:bot:private:user-a',
                }
            )
            confirmed = config.process_environment(
                {
                    'BANGUMI_MCP_IDENTITY_PROVIDER': 'qq',
                    'BANGUMI_MCP_EXTERNAL_USER_ID': 'user-a',
                    'BANGUMI_MCP_BOT_INSTANCE_ID': 'qq:bot',
                    'BANGUMI_MCP_CONVERSATION_ID': 'qq:bot:private:user-a',
                    'BANGUMI_MCP_CONFIRMATION_GRANT': 'cfm_one',
                }
            )

        for environment in (ordinary, confirmed):
            self.assertEqual(environment['PATH'], '/bin')
            self.assertEqual(environment['HOME'], '/tmp/host-home')
            self.assertEqual(environment['AWS_REGION'], 'us-test-1')
            for secret_name in (
                'BANGUMI_TOKEN_ENCRYPTION_KEY',
                'BANGUMI_OAUTH_CLIENT_SECRET',
                'DATABASE_URL',
                'SOME_OTHER_BOT_SECRET',
                'BANGUMI_ENV_FILE',
                'BANGUMI_DATA_DIR',
                'BANGUMI_DB_DRIVER',
            ):
                self.assertNotIn(secret_name, environment)

        self.assertNotIn('BANGUMI_MCP_CONFIRMATION_GRANT', ordinary)
        self.assertEqual(confirmed['BANGUMI_MCP_CONFIRMATION_GRANT'], 'cfm_one')

    def test_generated_mcp_config_bridges_identity_and_grant_explicitly(self) -> None:
        config = self.make_config()
        config.mcp_entry.parent.mkdir(parents=True, exist_ok=True)
        config.mcp_entry.write_text('// built MCP\n', encoding='utf-8')
        generated = config.ensure_mcp_config()
        payload = json.loads(generated.read_text(encoding='utf-8'))
        server_env = payload['mcpServers']['bangumi']['env']
        self.assertEqual(server_env['BANGUMI_MCP_EXTERNAL_USER_ID'], '${BANGUMI_MCP_EXTERNAL_USER_ID}')
        self.assertEqual(server_env['BANGUMI_MCP_CONFIRMATION_GRANT'], '${BANGUMI_MCP_CONFIRMATION_GRANT:-}')
        self.assertEqual(server_env['BANGUMI_DATA_DIR'], str(config.data_dir))
        self.assertEqual(server_env['BANGUMI_ENV_FILE'], str(config.env_file))

    def test_environment_allowlist_rejects_wildcards_and_server_variables(self) -> None:
        with self.assertRaises(HostConfigError):
            HostConfig.from_env(
                {
                    'BANGUMI_HOST_CLAUDE_ENV_ALLOWLIST': '*',
                },
                repo_root=self.root,
            )
        with self.assertRaises(HostConfigError):
            HostConfig.from_env(
                {
                    'BANGUMI_HOST_CLAUDE_ENV_ALLOWLIST': 'BANGUMI_TOKEN_ENCRYPTION_KEY',
                },
                repo_root=self.root,
            )


if __name__ == '__main__':
    unittest.main()
