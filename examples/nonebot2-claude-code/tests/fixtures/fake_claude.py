#!/usr/bin/env python3
from __future__ import annotations

import json
import os
import sys
import time


def main() -> int:
    args = sys.argv[1:]
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
    print(
        json.dumps(
            {
                'session_id': session_id,
                'result': 'raw prose ignored by host',
                'structured_output': {
                    'text': 'fake response',
                    'artifacts': [],
                    'pendingConfirmation': None,
                },
            }
        )
    )
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
