from __future__ import annotations

from dataclasses import dataclass


class IdentityValidationError(ValueError):
    """Raised when a host-provided external identity is invalid."""


def _validate(field: str, value: str, max_code_points: int) -> str:
    if not value or not value.strip():
        raise IdentityValidationError(f'{field} must not be empty')
    if len(list(value)) > max_code_points:
        raise IdentityValidationError(f'{field} exceeds {max_code_points} Unicode code points')
    return value


@dataclass(frozen=True)
class ExternalIdentity:
    provider: str
    bot_instance_id: str
    external_user_id: str
    conversation_id: str
    display_name: str | None = None

    def __post_init__(self) -> None:
        _validate('provider', self.provider, 32)
        _validate('bot_instance_id', self.bot_instance_id, 128)
        _validate('external_user_id', self.external_user_id, 128)
        _validate('conversation_id', self.conversation_id, 256)
        if self.display_name is not None:
            _validate('display_name', self.display_name, 128)

    def to_mcp_environment(self) -> dict[str, str]:
        values = {
            'BANGUMI_MCP_IDENTITY_PROVIDER': self.provider,
            'BANGUMI_MCP_EXTERNAL_USER_ID': self.external_user_id,
            'BANGUMI_MCP_BOT_INSTANCE_ID': self.bot_instance_id,
            'BANGUMI_MCP_CONVERSATION_ID': self.conversation_id,
        }
        if self.display_name is not None:
            values['BANGUMI_MCP_DISPLAY_NAME'] = self.display_name
        return values

    @property
    def artifact_principal_key(self) -> str:
        """Stable trusted key matching the MCP private artifact scope."""
        return '\x00'.join((self.provider, self.bot_instance_id, self.external_user_id))


def build_qq_identity(
    user_id: str,
    group_id: str | None,
    bot_self_id: str,
    display_name: str | None = None,
) -> ExternalIdentity:
    user = _validate('user_id', str(user_id), 128)
    bot = _validate('bot_self_id', str(bot_self_id), 128)
    bot_instance_id = f'qq:{bot}'
    if group_id is None:
        conversation_id = f'{bot_instance_id}:private:{user}'
    else:
        group = _validate('group_id', str(group_id), 128)
        conversation_id = f'{bot_instance_id}:group:{group}:user:{user}'
    return ExternalIdentity(
        provider='qq',
        bot_instance_id=bot_instance_id,
        external_user_id=user,
        conversation_id=conversation_id,
        display_name=display_name,
    )
