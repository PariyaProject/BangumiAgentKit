# G02 current-catalog evidence refresh rationale

## Verified state

- The current `docs/tool-catalog.json` hashes to `963b571873c1fbcab423ea3ca464588a683c46409183421462838b6d66b6798d`.
- The Run 66 G02 Agent/MCP and renderer reports both bind to catalog hash `3b140a83270c06e71eb7a470035a5259fc1e65d421020d03c5344f86178b3831`. They remain historical evidence and do not establish current-catalog acceptance.
- The current G02 scenario is a bounded anonymous read of anime from the half-open interval 2024-01-01 through 2025-01-01, exact concept `异世界`, sorted by current collection count. Its coverage remains unknown/partial with estimated totals and an experimental-source warning.
- The current-catalog refresh implementation adds a create-once Run 95 runner, source-row and renderer-answer checks, sanitized reports, and regression tests. No live G02 query or render was invoked while preparing this Candidate.

## Acceptance boundary

The two current-catalog calls must run in separate GPT-6 Luna Max Codex sessions after the exact Candidate passes the Harness Candidate gate, exact-SHA CI, and a sequential GPT-6 Luna Max review. Each session exposes only its single anonymous read-only target and the fixed G02 arguments. Reports retain hashes, bounded coverage counters, and non-persisted PNG metadata; they omit raw answers, source rows, titles, and image bytes.

Even if both calls pass, G02 stays `PARTIAL`: one experimental bounded result with an estimated total does not establish a Bangumi-wide top ten, discussion heat, or a historical trend. OAuth/account access, community content, QQ, and TIM remain outside this evidence refresh.
