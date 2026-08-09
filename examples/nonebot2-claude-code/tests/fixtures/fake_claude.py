#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
import time


def main() -> int:
    args = sys.argv[1:]
    if '--version' in args:
        print('fake-claude 0.1')
        return 0
    if '--help' in args:
        print(' --output-format --json-schema --mcp-config --strict-mcp-config --allowedTools --resume')
        return 0
    scenario = os.environ.get('FAKE_CLAUDE_SCENARIO', 'success')
    if scenario == 'timeout':
        time.sleep(10)
        return 0
    if scenario == 'nonzero':
        print('private diagnostic', file=sys.stderr)
        return 7
    if scenario == 'invalid-json':
        print('not json')
        return 0
    if scenario == 'missing-structured-output':
        print(json.dumps({'session_id': 'fake-session'}))
        return 0
    if scenario == 'oversized':
        print('x' * (1024 * 1024))
        return 0
    if '--resume' in args:
        index = args.index('--resume')
        session_id = args[index + 1] if index + 1 < len(args) else 'missing'
    else:
        session_id = 'fake-session-1'
    if scenario == 'resume-not-found':
        print('No conversation found for session', file=sys.stderr)
        return 1
    if os.environ.get('FAKE_CLAUDE_LOG'):
        with open(os.environ['FAKE_CLAUDE_LOG'], 'a', encoding='utf-8') as log_file:
            log_file.write(
                json.dumps(
                    {
                        'args': args,
                        'identity': {
                            key: os.environ.get(key)
                            for key in (
                                'BANGUMI_MCP_IDENTITY_PROVIDER',
                                'BANGUMI_MCP_EXTERNAL_USER_ID',
                                'BANGUMI_MCP_BOT_INSTANCE_ID',
                                'BANGUMI_MCP_CONVERSATION_ID',
                            )
                        },
                    }
                )
                + '\n'
            )
    if scenario == 'artifact':
        structured_output = {
            'text': 'fake card response',
            'artifacts': [{'id': 'art_smoke', 'mimeType': 'image/png', 'alt': 'smoke card'}],
            'pendingConfirmation': None,
        }
    elif scenario == 'pending-confirmation':
        structured_output = {
            'text': '请确认这个写入操作',
            'artifacts': [],
            'pendingConfirmation': {
                'confirmationId': 'cfm_smoke',
                'summary': 'smoke write operation',
            },
        }
    else:
        structured_output = {
            'text': 'fake response',
            'artifacts': [],
            'pendingConfirmation': None,
        }
    print(
        json.dumps(
            {
                'session_id': session_id,
                'result': 'raw prose ignored by host',
                'structured_output': structured_output,
            }
        )
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
