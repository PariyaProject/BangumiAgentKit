"""Optional NoneBot2 adapter for an existing bot application.

The generic bridge lives in ``bangumi_host`` and has no NoneBot dependency.
This file exposes an explicit ``/bangumi`` matcher only when NoneBot2 and its
OneBot v11 adapter are installed; it never registers a catch-all matcher.
"""

from __future__ import annotations

from bangumi_host.adapter import handle_bangumi_agent_message as _handle_message
from bangumi_host.nonebot_adapter import build_nonebot_reply
from bangumi_host.service import ClaudeHostService, HostResult


_SERVICE: ClaudeHostService | None = None


def get_host_service() -> ClaudeHostService:
    global _SERVICE
    if _SERVICE is None:
        _SERVICE = ClaudeHostService.from_env()
    return _SERVICE


async def handle_bangumi_agent_message(
    user_id: str,
    group_id: str | None,
    bot_self_id: str,
    display_name: str | None,
    message_text: str,
    service: ClaudeHostService | None = None,
) -> HostResult:
    """Call this from an existing matcher/router at the integration point of choice."""
    return await _handle_message(
        user_id=user_id,
        group_id=group_id,
        bot_self_id=bot_self_id,
        display_name=display_name,
        message_text=message_text,
        service=service or get_host_service(),
    )


try:
    from nonebot import on_command
    from nonebot.adapters.onebot.v11 import Bot, Message, MessageEvent

    bangumi_command = on_command('bangumi', aliases={'bgm', '邦奇'}, priority=10, block=False)

    @bangumi_command.handle()
    async def _handle_explicit_command(bot: Bot, event: MessageEvent, args: Message) -> None:
        text = args.extract_plain_text().strip()
        if not text:
            await bangumi_command.finish('请在 /bangumi 后输入问题。')

        sender = getattr(event, 'sender', None)
        display_name = None
        if sender is not None:
            display_name = getattr(sender, 'card', None) or getattr(sender, 'nickname', None)
            if isinstance(sender, dict):
                display_name = sender.get('card') or sender.get('nickname')

        group_id = getattr(event, 'group_id', None)
        result = await handle_bangumi_agent_message(
            user_id=str(event.get_user_id()),
            group_id=str(group_id) if group_id is not None else None,
            bot_self_id=str(bot.self_id),
            display_name=str(display_name) if display_name else None,
            message_text=text,
        )
        reply = build_nonebot_reply(result)
        await bangumi_command.finish(reply)
except ImportError:
    # The reusable bridge remains usable in environments that do not install
    # NoneBot; deployment environments can install the adapter separately.
    bangumi_command = None


__all__ = [
    'build_nonebot_reply',
    'get_host_service',
    'handle_bangumi_agent_message',
    'bangumi_command',
]
