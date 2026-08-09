from __future__ import annotations

import sqlite3
import time
from dataclasses import dataclass
from pathlib import Path


class HostSessionStoreError(RuntimeError):
    """Raised when the host's private session store cannot be used safely."""


@dataclass(frozen=True)
class HostSession:
    conversation_key: str
    claude_session_id: str
    pending_confirmation_id: str | None
    pending_confirmation_summary: str | None
    updated_at: int
    expires_at: int
    last_error_code: str | None = None


class HostSessionStore:
    """Persistent host-only state, deliberately separate from the domain DB."""

    def __init__(self, database_path: Path, session_ttl_seconds: int = 7 * 24 * 60 * 60):
        if session_ttl_seconds < 1:
            raise ValueError('session_ttl_seconds must be positive')
        self.database_path = Path(database_path).expanduser().resolve()
        self.database_path.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
        try:
            self.database_path.parent.chmod(0o700)
        except OSError:
            pass
        self.session_ttl_seconds = session_ttl_seconds
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        try:
            connection = sqlite3.connect(
                self.database_path,
                timeout=5.0,
                isolation_level=None,
                check_same_thread=False,
            )
            connection.row_factory = sqlite3.Row
            connection.execute('PRAGMA busy_timeout = 5000')
            connection.execute('PRAGMA foreign_keys = ON')
            connection.execute('PRAGMA journal_mode = WAL')
            return connection
        except sqlite3.Error as exc:
            raise HostSessionStoreError('Unable to open host session store') from exc

    def _initialize(self) -> None:
        connection = self._connect()
        try:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS host_sessions (
                    conversation_key TEXT PRIMARY KEY,
                    claude_session_id TEXT NOT NULL,
                    pending_confirmation_id TEXT,
                    pending_confirmation_summary TEXT,
                    updated_at INTEGER NOT NULL,
                    expires_at INTEGER NOT NULL,
                    last_error_code TEXT
                );

                CREATE TABLE IF NOT EXISTS host_conversation_leases (
                    conversation_key TEXT PRIMARY KEY,
                    owner_id TEXT NOT NULL,
                    expires_at INTEGER NOT NULL
                );
                """
            )
            try:
                self.database_path.chmod(0o600)
            except OSError:
                pass
        except sqlite3.Error as exc:
            raise HostSessionStoreError('Unable to initialize host session store') from exc
        finally:
            connection.close()

    @staticmethod
    def _now(now: int | None = None) -> int:
        return int(time.time()) if now is None else int(now)

    @staticmethod
    def _require_key(value: str, label: str) -> str:
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f'{label} must not be empty')
        return value

    def get(self, conversation_key: str, now: int | None = None) -> HostSession | None:
        key = self._require_key(conversation_key, 'conversation_key')
        current_time = self._now(now)
        connection = self._connect()
        try:
            row = connection.execute(
                'SELECT * FROM host_sessions WHERE conversation_key = ?',
                (key,),
            ).fetchone()
            if row is None:
                return None
            if row['expires_at'] <= current_time:
                connection.execute(
                    'DELETE FROM host_sessions WHERE conversation_key = ? AND expires_at <= ?',
                    (key, current_time),
                )
                return None
            return HostSession(
                conversation_key=row['conversation_key'],
                claude_session_id=row['claude_session_id'],
                pending_confirmation_id=row['pending_confirmation_id'],
                pending_confirmation_summary=row['pending_confirmation_summary'],
                updated_at=row['updated_at'],
                expires_at=row['expires_at'],
                last_error_code=row['last_error_code'],
            )
        except sqlite3.Error as exc:
            raise HostSessionStoreError('Unable to read host session store') from exc
        finally:
            connection.close()

    def upsert_session(
        self,
        conversation_key: str,
        claude_session_id: str,
        pending_confirmation_id: str | None = None,
        pending_confirmation_summary: str | None = None,
        last_error_code: str | None = None,
        now: int | None = None,
    ) -> HostSession:
        key = self._require_key(conversation_key, 'conversation_key')
        if not isinstance(claude_session_id, str) or not claude_session_id.strip():
            raise ValueError('claude_session_id must not be empty')
        current_time = self._now(now)
        expires_at = current_time + self.session_ttl_seconds
        connection = self._connect()
        try:
            connection.execute(
                """
                INSERT INTO host_sessions (
                    conversation_key,
                    claude_session_id,
                    pending_confirmation_id,
                    pending_confirmation_summary,
                    updated_at,
                    expires_at,
                    last_error_code
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(conversation_key) DO UPDATE SET
                    claude_session_id = excluded.claude_session_id,
                    pending_confirmation_id = excluded.pending_confirmation_id,
                    pending_confirmation_summary = excluded.pending_confirmation_summary,
                    updated_at = excluded.updated_at,
                    expires_at = excluded.expires_at,
                    last_error_code = excluded.last_error_code
                """,
                (
                    key,
                    claude_session_id,
                    pending_confirmation_id,
                    pending_confirmation_summary,
                    current_time,
                    expires_at,
                    last_error_code,
                ),
            )
        except sqlite3.Error as exc:
            raise HostSessionStoreError('Unable to write host session store') from exc
        finally:
            connection.close()
        return self.get(key, now=current_time)  # type: ignore[return-value]

    def set_pending(
        self,
        conversation_key: str,
        confirmation_id: str,
        summary: str,
        now: int | None = None,
    ) -> HostSession | None:
        key = self._require_key(conversation_key, 'conversation_key')
        if not confirmation_id or not summary:
            raise ValueError('pending confirmation fields must not be empty')
        current_time = self._now(now)
        connection = self._connect()
        try:
            connection.execute(
                """
                UPDATE host_sessions
                SET pending_confirmation_id = ?,
                    pending_confirmation_summary = ?,
                    updated_at = ?,
                    expires_at = ?
                WHERE conversation_key = ?
                """,
                (
                    confirmation_id,
                    summary,
                    current_time,
                    current_time + self.session_ttl_seconds,
                    key,
                ),
            )
        except sqlite3.Error as exc:
            raise HostSessionStoreError('Unable to persist pending confirmation') from exc
        finally:
            connection.close()
        return self.get(key, now=current_time)

    def clear_pending(self, conversation_key: str, now: int | None = None) -> HostSession | None:
        key = self._require_key(conversation_key, 'conversation_key')
        current_time = self._now(now)
        connection = self._connect()
        try:
            connection.execute(
                """
                UPDATE host_sessions
                SET pending_confirmation_id = NULL,
                    pending_confirmation_summary = NULL,
                    updated_at = ?,
                    expires_at = ?
                WHERE conversation_key = ?
                """,
                (current_time, current_time + self.session_ttl_seconds, key),
            )
        except sqlite3.Error as exc:
            raise HostSessionStoreError('Unable to clear pending confirmation') from exc
        finally:
            connection.close()
        return self.get(key, now=current_time)

    def clear_session(self, conversation_key: str) -> None:
        key = self._require_key(conversation_key, 'conversation_key')
        connection = self._connect()
        try:
            connection.execute('DELETE FROM host_sessions WHERE conversation_key = ?', (key,))
        except sqlite3.Error as exc:
            raise HostSessionStoreError('Unable to clear host session') from exc
        finally:
            connection.close()

    def record_error(
        self,
        conversation_key: str,
        error_code: str,
        now: int | None = None,
    ) -> HostSession | None:
        key = self._require_key(conversation_key, 'conversation_key')
        current_time = self._now(now)
        connection = self._connect()
        try:
            connection.execute(
                """
                UPDATE host_sessions
                SET last_error_code = ?, updated_at = ?, expires_at = ?
                WHERE conversation_key = ?
                """,
                (error_code, current_time, current_time + self.session_ttl_seconds, key),
            )
        except sqlite3.Error as exc:
            raise HostSessionStoreError('Unable to record host session error') from exc
        finally:
            connection.close()
        return self.get(key, now=current_time)

    def acquire_lease(
        self,
        conversation_key: str,
        owner_id: str,
        ttl_seconds: int = 120,
        now: int | None = None,
    ) -> bool:
        key = self._require_key(conversation_key, 'conversation_key')
        owner = self._require_key(owner_id, 'owner_id')
        if ttl_seconds < 1:
            raise ValueError('ttl_seconds must be positive')
        current_time = self._now(now)
        expires_at = current_time + ttl_seconds
        connection = self._connect()
        acquired = False
        try:
            connection.execute('BEGIN IMMEDIATE')
            row = connection.execute(
                'SELECT owner_id, expires_at FROM host_conversation_leases WHERE conversation_key = ?',
                (key,),
            ).fetchone()
            if row is None:
                connection.execute(
                    "INSERT INTO host_conversation_leases (conversation_key, owner_id, expires_at) VALUES (?, ?, ?)",
                    (key, owner, expires_at),
                )
                acquired = True
            elif row['owner_id'] == owner or row['expires_at'] <= current_time:
                connection.execute(
                    "UPDATE host_conversation_leases SET owner_id = ?, expires_at = ? WHERE conversation_key = ?",
                    (owner, expires_at, key),
                )
                acquired = True
            connection.execute('COMMIT')
            return acquired
        except sqlite3.Error as exc:
            try:
                connection.execute('ROLLBACK')
            except sqlite3.Error:
                pass
            raise HostSessionStoreError('Unable to acquire host conversation lease') from exc
        finally:
            connection.close()

    def release_lease(self, conversation_key: str, owner_id: str) -> None:
        key = self._require_key(conversation_key, 'conversation_key')
        owner = self._require_key(owner_id, 'owner_id')
        connection = self._connect()
        try:
            connection.execute(
                'DELETE FROM host_conversation_leases WHERE conversation_key = ? AND owner_id = ?',
                (key, owner),
            )
        except sqlite3.Error as exc:
            raise HostSessionStoreError('Unable to release host conversation lease') from exc
        finally:
            connection.close()

    def close(self) -> None:
        """Kept for adapter symmetry; this store intentionally opens short-lived connections."""


__all__ = ['HostSession', 'HostSessionStore', 'HostSessionStoreError']
