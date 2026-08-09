from __future__ import annotations

import shutil
import tempfile
import unittest
from pathlib import Path

from bangumi_host.session_store import HostSessionStore


class HostSessionStoreTests(unittest.TestCase):
    def setUp(self) -> None:
        self.root = Path(tempfile.mkdtemp(prefix='bangumi-host-session-test-'))
        self.database = self.root / 'host-bridge.sqlite'

    def tearDown(self) -> None:
        shutil.rmtree(self.root, ignore_errors=True)

    def test_session_survives_store_restart_and_expiry_is_local(self) -> None:
        first = HostSessionStore(self.database, session_ttl_seconds=100)
        first.upsert_session('qq:conversation:a', 'session-a', now=1000)
        first.set_pending('qq:conversation:a', 'cfm_a', 'mark episodes', now=1001)

        restarted = HostSessionStore(self.database, session_ttl_seconds=100)
        session = restarted.get('qq:conversation:a', now=1050)
        self.assertIsNotNone(session)
        assert session is not None
        self.assertEqual(session.claude_session_id, 'session-a')
        self.assertEqual(session.pending_confirmation_id, 'cfm_a')
        self.assertIsNone(restarted.get('qq:conversation:a', now=1101))
        self.assertTrue(self.database.exists())

    def test_leases_are_atomic_and_conversation_scoped(self) -> None:
        store = HostSessionStore(self.database)
        self.assertTrue(store.acquire_lease('conversation-a', 'worker-a', ttl_seconds=20, now=100))
        self.assertFalse(store.acquire_lease('conversation-a', 'worker-b', ttl_seconds=20, now=101))
        self.assertTrue(store.acquire_lease('conversation-b', 'worker-b', ttl_seconds=20, now=101))
        self.assertTrue(store.acquire_lease('conversation-a', 'worker-b', ttl_seconds=20, now=121))
        store.release_lease('conversation-a', 'worker-b')
        self.assertTrue(store.acquire_lease('conversation-a', 'worker-c', ttl_seconds=20, now=122))

    def test_pending_can_be_cleared_without_deleting_session(self) -> None:
        store = HostSessionStore(self.database)
        store.upsert_session('conversation', 'session', pending_confirmation_id='cfm_x', pending_confirmation_summary='x')
        cleared = store.clear_pending('conversation')
        self.assertIsNotNone(cleared)
        assert cleared is not None
        self.assertEqual(cleared.claude_session_id, 'session')
        self.assertIsNone(cleared.pending_confirmation_id)
        self.assertIsNone(cleared.pending_confirmation_summary)


if __name__ == '__main__':
    unittest.main()
