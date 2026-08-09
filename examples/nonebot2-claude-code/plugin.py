import os
import re
import json
import asyncio
from typing import Dict, Any, Optional

# Conversation session memory mapping (ConversationID -> Claude SessionID)
SESSION_MAP: Dict[str, str] = {}
CONVERSATION_LOCKS: Dict[str, asyncio.Lock] = {}

def get_conversation_lock(conversation_id: str) -> asyncio.Lock:
    if conversation_id not in CONVERSATION_LOCKS:
        CONVERSATION_LOCKS[conversation_id] = asyncio.Lock()
    return CONVERSATION_LOCKS[conversation_id]

async def invoke_claude_host(
    message: str,
    principal_id: str,
    bot_instance_id: str,
    conversation_id: str,
    claude_bin: str = "claude",
    workdir: Optional[str] = None,
    timeout_seconds: int = 45,
) -> Dict[str, Any]:
    """
    Invokes `claude -p` CLI with identity env vars, resuming existing session if present.
    Executes using argument arrays without shell=True for security.
    """
    lock = get_conversation_lock(conversation_id)
    async with lock:
        env = os.environ.copy()
        env["BANGUMI_MCP_PRINCIPAL_ID"] = principal_id
        env["BANGUMI_MCP_BOT_INSTANCE_ID"] = bot_instance_id
        env["BANGUMI_MCP_CONVERSATION_ID"] = conversation_id
        env["BANGUMI_DB_DRIVER"] = env.get("BANGUMI_DB_DRIVER", "sqlite")

        cmd = [claude_bin, "-p", message, "--output-format", "json"]

        session_id = SESSION_MAP.get(conversation_id)
        if session_id:
            cmd.extend(["--resume", session_id])

        cwd = workdir or os.getcwd()

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                cwd=cwd,
                env=env,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            try:
                stdout_data, stderr_data = await asyncio.wait_for(
                    proc.communicate(), timeout=float(timeout_seconds)
                )
            except asyncio.TimeoutError:
                proc.kill()
                await proc.wait()
                return {
                    "ok": False,
                    "text": "请求处理超时，请重试。",
                    "error": "CLAUDE_TIMEOUT",
                }

            if proc.returncode != 0:
                err_text = stderr_data.decode("utf-8", errors="ignore")
                return {
                    "ok": False,
                    "text": "Bangumi Agent 服务暂时不可用。",
                    "error": f"CLAUDE_PROCESS_ERROR (code {proc.returncode}): {err_text}",
                }

            raw_out = stdout_data.decode("utf-8", errors="ignore").strip()
            if not raw_out:
                return {
                    "ok": False,
                    "text": "模型未返回有效响应。",
                    "error": "EMPTY_OUTPUT",
                }

            parsed = json.loads(raw_out)

            # Capture session_id for future continuation
            if isinstance(parsed, dict) and "session_id" in parsed:
                SESSION_MAP[conversation_id] = parsed["session_id"]

            return {
                "ok": True,
                "data": parsed,
            }
        except Exception as e:
            return {
                "ok": False,
                "text": "系统底层处理出错，请联系管理员。",
                "error": str(e),
            }

def resolve_artifact_path(artifact_id: str, artifact_dir: Optional[str] = None) -> Optional[str]:
    """
    Safely resolves art_xxx to local absolute file path.
    Enforces pattern ^art_[A-Za-z0-9_-]+$ to prevent path traversal.
    """
    if not re.match(r"^art_[A-Za-z0-9_-]+$", artifact_id):
        return None

    base_dir = artifact_dir or os.environ.get(
        "BANGUMI_ARTIFACT_DIR", os.path.expanduser("~/.bangumi-agent-kit/artifacts")
    )
    file_path = os.path.join(base_dir, f"{artifact_id}.png")

    if os.path.exists(file_path):
        return os.path.abspath(file_path)

    return None

async def handle_bangumi_agent_message(
    user_id: str,
    group_id: Optional[str],
    bot_id: str,
    message_text: str,
    claude_bin: str = "claude",
) -> Dict[str, Any]:
    """
    Helper function for NoneBot handlers.
    Derives principal_id, bot_instance_id, conversation_id and executes request.
    """
    principal_id = f"qq:{user_id}"
    bot_instance_id = f"qq:{bot_id}"
    conversation_id = f"qq:group:{group_id}" if group_id else f"qq:private:{user_id}"

    res = await invoke_claude_host(
        message=message_text,
        principal_id=principal_id,
        bot_instance_id=bot_instance_id,
        conversation_id=conversation_id,
        claude_bin=claude_bin,
    )

    return res
