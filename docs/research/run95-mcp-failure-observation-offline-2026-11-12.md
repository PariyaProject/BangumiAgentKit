# Bounded offline Agent/MCP failure observation

The G03 attempt retained one MCP event and booleans but discarded the exact
failure data. Its historical root cause remains unknown. This increment
repairs a reproducible diagnostic loss at a new independent seam; it does
not rerun that workload, change any frozen execution program, or grant credit.

## Reproduction and supported findings

A deterministic replay reaches the executed G03 inspector and existing
allowlisted diagnostic normalizer. Two completed MCP error results differ in
their structured safe error code, but their retained diagnostics are identical.
The byte counts are held equal so accidental payload length does not pretend
to identify an error. The minimal command was run RED twice before adding the
new observer. It needs no Git fixture, model, SDK, network or account.

The regression now characterizes that historical behavior and verifies the
new seam preserves both distinct codes:

```sh
node --test tests/harness/agent-mcp-failure-observation.test.mjs tests/harness/agent-mcp-failure-lifecycle.test.mjs
```

Three findings were tested rather than inferred from the missing real trace:

1. The old result projection omits safe error identity. The new independent
   projection distinguishes `G03_NATIVE_OPERATION_DENIED` and
   `G03_NATIVE_RESULT_INVALID` without retaining message content.
2. The old diagnostic schema rejects additional call fields. It stays frozen;
   the new schema is separate and cannot validate as a signed G03 report.
3. Cleanup can remove the only private summary. Synthetic Node workers now
   exercise error, cancellation, timeout, output limit, summary loss and failed
   acknowledgement; publication precedes cleanup and the sanitized observation
   survives. Spawn and publication failures remain explicit.

No finding identifies why the historical model produced only one event.
The original raw output/summary cannot be reconstructed from these fixtures.

## Interface and privacy contract

`observeAgentMcpFailure` in
`scripts/lib/agent-mcp-failure-observation.mjs` takes trusted public expected
server/tool names and exact expected arguments, a process result, optional
native summary **JSON text**, and a closed execution-stage name. Input process
and summary data are untrusted diagnostic observations.

It emits only:

- catalog-confirmed public tool/field names, ordinal and matching/type booleans;
- counts of unknown fields/events rather than their untrusted names;
- closed allowlisted error codes and process-reason classes;
- lifecycle completion/change/alias-conflict facts;
- bounded process byte counters and reported native phase/counters/closed flag.

Tool names must exist in the checked-in public catalog. Expected field paths
absent from that catalog are replaced with ordinal labels, so even the stdin
configuration cannot introduce private names into a receipt. The fixed local
catalog supplies names only, never execution or authorization authority.

It retains no argument values or value hashes, arbitrary names/codes, content,
answer, message, URL, identifier, private payload or raw stderr. A complete
stream is only a parser observation. `observationOnly=true`,
`acceptanceCredit=false`, `retryAllowed=false`, and all model/source/artifact/
cleanup verification flags are always false. Native values are explicitly
**reported**, not authenticated or independently verified. Missing/invalid
fields remain null; a missing summary never implies zero source activity or
successful cleanup.

Lifecycle items share their id internally; raw ids are not published. Later
metadata can fill an earlier partial item without inventing an identity
change. Actual changes are marked and the latest safe argument shape is
retained; an earlier error cannot be overwritten by a later success. Conflicting
camel/snake aliases are marked conservatively. Unknown strings never become
new enum values. The closed code list can be extended only by reviewed source,
not by a runtime input asking to whitelist its own message.

## Resource and publication boundary

Stdout observation is capped at 8MiB, each JSONL line at 512KiB, nonempty
records at 4096 and distinct/anonymous calls at eight. Expected metadata has
at most 32 field paths per call, four nested object levels, 96-character paths,
256 policy nodes, 16 array items and 256-character scalar strings. Native
summary JSON is capped at 64KiB. Compact diagnostic output is capped at 16KiB
plus its newline. Limits produce an explicit limited/error state and never
acceptance success. Untrusted deep alias structures cannot suppress all
observations through a comparison stack overflow.

A producer output-limit reason or reported byte count beyond the retained
prefix also keeps the stream limited, even when that prefix ends with a valid
`turn.completed` event. Parser success cannot erase reported capture loss.

`publishAgentMcpFailure` accepts only an immutable object produced in-process
by the observer. It writes a fixed filename, create-only and no-follow, in a
current-owner 0700 directory, with regular-file/current-owner/single-link checks,
0600 permissions and file fsync before reporting success. The destination
must be outside the separate execution cleanup root. Existing files, symlinks,
unsafe directories and publication/durability failures fail explicitly; no
first result is replaced. Containment walks directory identities (device/inode)
through the destination's ancestors; a filesystem case alias cannot bypass it.
This regression was reproduced and validated on the local case-insensitive Mac
filesystem; that platform-specific test is explicitly skipped on case-sensitive
CI filesystems, where the ordinary same-root/descendant checks still execute.
The caller owns and must keep both private directories
stable during publication. This is not a lock against another process running
as the same trusted OS user, nor a power-loss guarantee beyond filesystem fsync.

The future caller order is:

```js
// No model dispatch is provided by these APIs.
try {
  const observation = observeAgentMcpFailure({
    expected,
    processResult,
    serverSummary,
    stage,
  });
  publishAgentMcpFailure(observation, { directory, executionDirectory });
  // An acknowledgement failure cannot erase the already published diagnostic.
} finally {
  removeOnlyTheOwnedExecutionDirectory();
}
```

## Offline adapter and adoption limits

`scripts/acceptance/observe-agent-mcp-failure.mjs` reads a bounded JSON envelope
from stdin (12MiB maximum). With no flags it prints the sanitized observation.
Optional `--output-directory` and `--execution-directory` publish it first.
Unknown flags, including `--run`, are rejected. Exit zero means diagnostic
production succeeded, never that a model/tool/PNG succeeded. Error output uses
only fixed codes. The three new production modules import only Node builtins
and each other; they contain no model, process-spawn, GitHub, credential or
service dispatch path.

This adapter cannot recover deleted historical inputs. No frozen runner is
rewired, no profile is added, and no one-shot authority is created. A future,
genuinely different reviewed execution contract must explicitly adopt this
seam before temporary cleanup. Do not create another model batch merely to
test these diagnostics. All present validation uses synthetic Node processes
and filesystem fixtures; no Codex model, Bangumi request, account, OAuth,
community, QQ or TIM operation is performed.

G03 stays PARTIAL. Original direct96/public65/Agent86/account12-of33/QQ0/TIM0
remain independent. Design baselines and delivered PR294/295/296 behavior
remain closed. Exact CI and one comprehensive Product review govern integration.
