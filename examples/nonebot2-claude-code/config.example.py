"""Environment-oriented configuration example for the Host Bridge.

The bridge deliberately uses Python stdlib only.  Set these values in the
NoneBot process environment (or in an explicit BANGUMI_ENV_FILE) and let
``HostConfig.from_env()`` validate and resolve them.
"""

from __future__ import annotations

import os


HOST_ENVIRONMENT = {
    'CLAUDE_BIN': os.environ.get('CLAUDE_BIN', 'claude'),
    'CLAUDE_WORKDIR': os.environ.get('CLAUDE_WORKDIR', ''),
    'CLAUDE_TIMEOUT_SECONDS': os.environ.get('CLAUDE_TIMEOUT_SECONDS', '75'),
    'CLAUDE_MAX_OUTPUT_BYTES': os.environ.get('CLAUDE_MAX_OUTPUT_BYTES', str(2 * 1024 * 1024)),
    'CLAUDE_MAX_TURNS': os.environ.get('CLAUDE_MAX_TURNS', '16'),
    'BANGUMI_DATA_DIR': os.environ.get('BANGUMI_DATA_DIR', ''),
    'BANGUMI_ARTIFACT_DIR': os.environ.get('BANGUMI_ARTIFACT_DIR', ''),
    'BANGUMI_ENV_FILE': os.environ.get('BANGUMI_ENV_FILE', ''),
    'BANGUMI_HOST_SESSION_TTL_HOURS': os.environ.get(
        'BANGUMI_HOST_SESSION_TTL_HOURS',
        '168',
    ),
    'BANGUMI_HOST_STRICT_MCP': os.environ.get('BANGUMI_HOST_STRICT_MCP', 'true'),
    'BANGUMI_HOST_ALLOWED_TOOLS': os.environ.get(
        'BANGUMI_HOST_ALLOWED_TOOLS',
        'mcp__bangumi__*',
    ),
    'BANGUMI_HOST_BUILTIN_TOOLS': os.environ.get(
        'BANGUMI_HOST_BUILTIN_TOOLS',
        'WebSearch,WebFetch',
    ),
    'BANGUMI_HOST_CLAUDE_ENV_ALLOWLIST': os.environ.get(
        'BANGUMI_HOST_CLAUDE_ENV_ALLOWLIST',
        '',
    ),
}
