import os
from pydantic import BaseModel

class Config(BaseModel):
    claude_bin: str = os.getenv("CLAUDE_BIN", "claude")
    claude_workdir: str = os.getenv("CLAUDE_WORKDIR", "/tmp/bangumi-claude-workdir")
    claude_timeout_seconds: int = int(os.getenv("CLAUDE_TIMEOUT_SECONDS", "45"))
    mcp_server_script: str = os.getenv(
        "BANGUMI_MCP_SCRIPT",
        os.path.abspath(os.path.join(os.path.dirname(__file__), "../../apps/mcp/dist/main.js")),
    )
    bangumi_data_dir: str = os.getenv(
        "BANGUMI_DATA_DIR", os.path.expanduser("~/.bangumi-agent-kit")
    )
    bangumi_artifact_dir: str = os.getenv(
        "BANGUMI_ARTIFACT_DIR", os.path.expanduser("~/.bangumi-agent-kit/artifacts")
    )
