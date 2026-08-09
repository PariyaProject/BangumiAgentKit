from __future__ import annotations

import asyncio
import os
import signal
from dataclasses import dataclass
from pathlib import Path
from typing import Callable

from .config import HostConfig, HostConfigError


@dataclass(frozen=True)
class ClaudeRunResult:
    returncode: int
    stdout: str
    stderr: str
    timed_out: bool = False
    output_limited: bool = False


class ClaudeInvocationError(RuntimeError):
    """Raised when Claude cannot be started or its command cannot be built."""


def _terminate_process_group(process: asyncio.subprocess.Process) -> None:
    if process.returncode is not None:
        return
    if os.name == 'posix':
        try:
            os.killpg(process.pid, signal.SIGTERM)
            return
        except ProcessLookupError:
            return
    process.terminate()


def _kill_process_group(process: asyncio.subprocess.Process) -> None:
    if process.returncode is not None:
        return
    if os.name == 'posix':
        try:
            os.killpg(process.pid, signal.SIGKILL)
            return
        except ProcessLookupError:
            return
    process.kill()


async def _read_bounded(
    stream: asyncio.StreamReader,
    limit: int,
    on_exceeded: Callable[[], None],
) -> tuple[str, bool]:
    buffer = bytearray()
    exceeded = False
    while True:
        chunk = await stream.read(min(64 * 1024, limit - len(buffer) + 1))
        if not chunk:
            break
        remaining = limit - len(buffer)
        if len(chunk) > remaining:
            buffer.extend(chunk[:remaining])
            exceeded = True
            on_exceeded()
            break
        buffer.extend(chunk)
    return buffer.decode('utf-8', errors='replace'), exceeded


class ClaudeCommandBuilder:
    def __init__(self, config: HostConfig):
        self.config = config

    def build(self, message: str, session_id: str | None = None) -> list[str]:
        if not isinstance(message, str) or not message:
            raise ClaudeInvocationError('Claude message must be a non-empty string')
        try:
            schema = self.config.response_schema.read_text(encoding='utf-8')
        except OSError as exc:
            raise HostConfigError(f'Unable to read response schema: {self.config.response_schema}') from exc
        args = [
            self.config.claude_bin,
            '-p',
            message,
            '--output-format',
            'json',
            '--json-schema',
            schema,
            '--mcp-config',
            str(self.config.mcp_config),
            '--allowedTools',
            *self.config.allowed_tools,
            '--append-system-prompt-file',
            str(self.config.system_prompt),
            '--max-turns',
            str(self.config.max_turns),
        ]
        if self.config.strict_mcp:
            args.append('--strict-mcp-config')
        if session_id is not None:
            args.extend(['--resume', session_id])
        return args


class ClaudeCli:
    def __init__(self, config: HostConfig):
        self.config = config
        self.command_builder = ClaudeCommandBuilder(config)

    async def run(
        self,
        message: str,
        identity_env: dict[str, str],
        session_id: str | None = None,
    ) -> ClaudeRunResult:
        self.config.ensure_runtime_dirs()
        self.config.ensure_mcp_config()
        command = self.command_builder.build(message, session_id)
        env = self.config.process_environment(identity_env)
        process: asyncio.subprocess.Process
        try:
            process = await asyncio.create_subprocess_exec(
                *command,
                cwd=str(self.config.claude_workdir),
                env=env,
                stdin=asyncio.subprocess.DEVNULL,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                start_new_session=os.name == 'posix',
            )
        except OSError as exc:
            raise ClaudeInvocationError('Unable to start Claude executable') from exc

        terminate_requested = False

        def request_terminate() -> None:
            nonlocal terminate_requested
            if not terminate_requested:
                terminate_requested = True
                _terminate_process_group(process)

        stdout_task = asyncio.create_task(
            _read_bounded(process.stdout, self.config.max_output_bytes, request_terminate)
        )
        stderr_task = asyncio.create_task(
            _read_bounded(process.stderr, self.config.max_output_bytes, request_terminate)
        )
        timed_out = False
        try:
            try:
                await asyncio.wait_for(process.wait(), timeout=self.config.timeout_seconds)
            except asyncio.TimeoutError:
                timed_out = True
                request_terminate()
                try:
                    await asyncio.wait_for(process.wait(), timeout=1.5)
                except asyncio.TimeoutError:
                    _kill_process_group(process)
                    await process.wait()
        finally:
            stdout, stdout_limited = await stdout_task
            stderr, stderr_limited = await stderr_task
            # Bounded readers intentionally stop early after a limit breach.
            # Close the underlying pipe transports explicitly so asyncio does
            # not try to schedule cleanup on a loop that the caller has closed.
            for stream in (process.stdout, process.stderr):
                transport = getattr(stream, '_transport', None)
                if transport is not None:
                    transport.close()

        return ClaudeRunResult(
            returncode=process.returncode if process.returncode is not None else -1,
            stdout=stdout,
            stderr=stderr,
            timed_out=timed_out,
            output_limited=stdout_limited or stderr_limited,
        )
