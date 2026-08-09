"""Reusable NoneBot-independent BangumiAgentKit Host Bridge primitives."""

from .config import HostConfig, HostConfigError
from .identity import ExternalIdentity, build_qq_identity
from .response import HostResponse, HostResponseError, parse_claude_output

__all__ = [
    'ExternalIdentity',
    'HostConfig',
    'HostConfigError',
    'HostResponse',
    'HostResponseError',
    'build_qq_identity',
    'parse_claude_output',
]
