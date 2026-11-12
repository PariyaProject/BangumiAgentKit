# Native discovery dates and stored PNG verification

The reusable G03 verification path exercises the actual discovery provider,
ToolRegistry, MCP descriptors, result presenter, Chromium renderer and local
artifact store. It checks the date-hydration correction delivered by PR #294
without changing that source or its visual design. A future model runner can
use this same server factory instead of reconstructing or mocking tool results.

## Finite observation contract

`scripts/acceptance/g03-native-discovery-mcp.mjs` exports a construction-only
factory. It exposes `bangumi.query_subjects` followed by
`bangumi.render_query_subjects`, each once, with exactly:

```json
{
  "media": "anime",
  "from": "2024-01-01",
  "to": "2024-05-01",
  "rating": { "min": 8 },
  "ratingCount": { "min": 5001 },
  "sort": "date",
  "order": "asc"
}
```

Each call receives one synthetic search page and six unique detail responses.
Search rows deliberately lack the score so that the real engine must hydrate
them. The injected transport has no network fetch fallback. It rejects changed
URLs, pagination, filters, methods, credentials, repeated reads and extra
request options. Both calls together allow two fixture POSTs and twelve fixture
GETs. Account, OAuth, audit and asset-resolution services are disabled.

| Synthetic ID | Search date | Detail date | Expected result                                             |
| ------------ | ----------- | ----------- | ----------------------------------------------------------- |
| 9631001      | 2024-05-01  | 2024-02-30  | Excluded: usable search date is at the exclusive end        |
| 9631002      | 2024-04-01  | empty       | Included using the search date                              |
| 9631003      | 2024-05-01  | 2024-04-04  | Included using the usable detail date                       |
| 9631004      | 2024-04-02  | 2024-05-01  | Excluded using the usable detail date                       |
| 9631005      | 2024-04-03  | 2024-04     | Included using the search date                              |
| 9631006      | absent      | 2024-00-00  | Included with unknown date and an upstream-dependent caveat |

The expected order is 9631002, 9631005, 9631003, 9631006. The verifier checks
their dates, scores, rating counts, source, coverage, estimated total,
experimental warning and explicit-window caveat. Six rows are scanned, four
match, two are rejected and all six existing hydrations succeed. This narrower
fixed window tests date semantics; it does not replace historical G03's
five-year and original-work-tag scenario.

## Native render and lifecycle

The normal renderer receives the actual discovery ViewModel. Before rendering,
the verifier admits only the four expected rows, matching coverage and caveat,
and no remote images. Chat rendering uses 360 CSS px, DPR 2, light theme and the
existing `warm-editorial` pack. It decodes and validates the returned PNG,
dimensions, CRC/chunk structure and bounded nonblank pixel signal. The artifact
writer admits only that buffer once. The verifier independently reads the
stored regular file and requires its byte hash and dimensions to match.

This establishes the rendered data and stored bytes. Pixel checks do not prove
text readability or user aesthetic approval. The local native replay produced
the same 720 × 1926, 204,626-byte PNG as the retained hydrated-date fixture,
SHA-256 `96a115da52eb66f1e6a60ef4279f49c85f8c3b00f1cc2fda82657227ac913652`.
CI requires consistency within its own render/store pair, not identical font
rasterization across operating systems.

Each tool observation has a maximum 20-second deadline. Wrong inputs,
overlapping calls, cancellation, timeouts, failed source validation, invalid
results or invalid images permanently terminate the instance. Later source,
render and artifact-write admissions fail. Shutdown drains underlying admitted
work, closes the renderer, removes only owned artifact files in its temporary
directory and removes that directory. Repeated close is idempotent.

## Reproduction and scope

After installing dependencies, building the workspace and installing Chromium:

```sh
node --test tests/integration/g03-native-discovery.test.mjs
```

The integration checks use real compiled modules and SDK in-memory and child
stdio transports. They cover the normal journey, result tampering, corrupt or
unobserved PNGs, wrong arguments, source admission, overlap, cancellation,
deadline, closure during rendering and temporary artifact cleanup. CI runs the
checks in `sqlite-default` after the workspace build and Chromium installation;
they remain outside the dependency-free Harness test wildcard.

This increment does not register a model profile, dispatch a model, create a
claim or generate accepted evidence. Every snapshot explicitly reports
`syntheticSource: true`, `modelEvidence: false`, `liveEvidence: false`.
G03 stays PARTIAL and all acceptance counts remain unchanged.

The next execution contract must bind actual native model events, this finite
tool journey, a create-once latch, signed sanitized report, exact source/CI and
reviewer provenance. It must independently validate the model's interpretation
and artifact evidence. All seven older query/render model profiles retain
their terminal dispositions. Changing a profile name cannot authorize a retry
of those old workloads.
