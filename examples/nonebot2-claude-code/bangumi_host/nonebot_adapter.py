from __future__ import annotations

from .service import HostResult


def build_nonebot_reply(result: HostResult):
    """Build a OneBot v11 message from trusted text and local artifact handles."""
    from nonebot.adapters.onebot.v11 import Message, MessageSegment

    reply = Message(result.response.text)
    for path in result.artifact_paths:
        reply.append(MessageSegment.image(file=path))
    return reply


__all__ = ['build_nonebot_reply']
