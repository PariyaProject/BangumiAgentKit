"""Reusable NoneBot-independent BangumiAgentKit Host Bridge primitives."""

from .config import HostConfig, HostConfigError
from .identity import ExternalIdentity, build_qq_identity
from .response import HostResponse, HostResponseError, parse_claude_output
from .service import ClaudeHostService, HostResult
from .session_store import HostSession, HostSessionStore
from .artifacts import ArtifactResolver

__all__ = [
    'ExternalIdentity',
    'ArtifactResolver',
    'ClaudeHostService',
    'HostConfig',
    'HostConfigError',
    'HostResponse',
    'HostResponseError',
    'HostResult',
    'HostSession',
    'HostSessionStore',
    'build_qq_identity',
    'parse_claude_output',
]
