# Review Known Issues & Technical Debt

This document tracks known architectural technical debt deferred from the foundational baseline repairs.

## P0 NEXT Priority Items

- **remove accessToken from ToolContext**: `ToolContext.accessToken` mixes credential propagation into context parameter objects rather than resolving credentials via a centralized TokenBroker.
- **integrate TokenBroker into execution services**: High-level services and tool execution should delegate token retrieval, refresh, and scope validation to a unified TokenBroker service.
- **shared persistent Storage**: Persistent storage (OAuth tokens, user bindings, session state) needs a unified storage abstraction across standard file/SQLite providers.
- **protect raw operation writes**: Raw operation execution tools (`bangumi.call_operation`) must enforce write/destructive approval gates before executing state-modifying requests.
- **fix PendingAction lifecycle**: Pending interactive actions and confirmation flows require proper expiration, cancellation, and execution lifecycle state tracking.
