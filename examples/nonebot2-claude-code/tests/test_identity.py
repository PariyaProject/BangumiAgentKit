from __future__ import annotations

import unittest

from bangumi_host.identity import build_qq_identity


class IdentityTests(unittest.TestCase):
    def test_private_mapping(self) -> None:
        identity = build_qq_identity('30001', None, '10001', 'Alice')
        self.assertEqual(identity.provider, 'qq')
        self.assertEqual(identity.bot_instance_id, 'qq:10001')
        self.assertEqual(identity.external_user_id, '30001')
        self.assertEqual(identity.conversation_id, 'qq:10001:private:30001')
        self.assertNotIn('principal', identity.to_mcp_environment())

    def test_group_mapping_contains_user(self) -> None:
        identity = build_qq_identity('30001', '20001', '10001')
        self.assertEqual(identity.conversation_id, 'qq:10001:group:20001:user:30001')

    def test_same_group_different_users_are_isolated(self) -> None:
        first = build_qq_identity('30001', '20001', '10001')
        second = build_qq_identity('30002', '20001', '10001')
        self.assertNotEqual(first.external_user_id, second.external_user_id)
        self.assertNotEqual(first.conversation_id, second.conversation_id)

    def test_same_user_different_groups_have_different_conversations(self) -> None:
        first = build_qq_identity('30001', '20001', '10001')
        second = build_qq_identity('30001', '20002', '10001')
        self.assertEqual(first.external_user_id, second.external_user_id)
        self.assertNotEqual(first.conversation_id, second.conversation_id)

    def test_different_bot_instances_are_scoped(self) -> None:
        first = build_qq_identity('30001', None, '10001')
        second = build_qq_identity('30001', None, '10002')
        self.assertNotEqual(first.bot_instance_id, second.bot_instance_id)

    def test_rejects_unreasonable_values(self) -> None:
        with self.assertRaises(ValueError):
            build_qq_identity('', None, '10001')
        with self.assertRaises(ValueError):
            build_qq_identity('30001', None, '10001', 'x' * 129)


if __name__ == '__main__':
    unittest.main()
