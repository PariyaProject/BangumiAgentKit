from __future__ import annotations

from .identity import build_qq_identity
from .service import ClaudeHostService, HostResult


async def handle_bangumi_agent_message(
    user_id: str,
    group_id: str | None,
    bot_self_id: str,
    display_name: str | None,
    message_text: str,
    service: ClaudeHostService,
) -> HostResult:
    """Reusable entry point for an existing NoneBot matcher or router."""
    identity = build_qq_identity(
        user_id=user_id,
        group_id=group_id,
        bot_self_id=bot_self_id,
        display_name=display_name,
    )
    return await service.handle_message(identity, message_text)


__all__ = ['handle_bangumi_agent_message']
