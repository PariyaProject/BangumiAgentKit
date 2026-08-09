# Freshness / cache / change-detection design

> 下表是候选产品策略，不是 Bangumi SLA，也没有改变当前 runtime。

## 推荐 TTL 起点

| 数据                             | Source            |                         建议 TTL | 变化/失效触发                           |
| -------------------------------- | ----------------- | -------------------------------: | --------------------------------------- |
| v0 subject/person/character core | S1                |                            1–6 h | ETag/Last-Modified 或 explicit refresh  |
| legacy Calendar                  | S2                |            1 h（遵循响应 cache） | 临近放送可显式 refresh；不承诺秒级      |
| v0 episodes/relations            | S1                |                            1–6 h | subject revision / manual refresh       |
| p1 subject/community             | S3                |                         5–30 min | schema probe、HTTP error、parser change |
| p1 calendar/watchers             | S3                |                         5–15 min | no cache headers；只做自有短缓存        |
| old website HTML stats           | S5                |                        15–60 min | DOM fingerprint/selector mismatch       |
| Rakuen/group current counts      | S3/S5             |                         5–15 min | coverage and page freshness             |
| public user profile/collections  | S1/S3/S5          |                        15–60 min | visibility/auth change                  |
| authenticated user data          | S1/S3 auth        | no shared cache; 1–5 min session | token/session boundary                  |
| trend/ranking snapshot           | S6                |                scheduler-defined | fixed query/source/parser version       |
| derived graph/workload           | S7 over input TTL |               shortest input TTL | formula version/input hash              |

## Freshness model

Freshness should be field/capability scoped rather than one record-wide boolean:

```text
fresh        now - retrievedAt <= ttl
stale        cached result exists but now - retrievedAt > ttl
unknown      source provides no usable timestamp/cache hint
conflicted   values are fresh enough but disagree
```

`observedAt` is when the source says the event/data was current; `retrievedAt` is when AgentKit received it. If only one is known, keep the other absent. Never use the request time as an invented publication time.

## Snapshot protocol

For S6 trend/velocity:

1. Freeze query, source class, URL parameters, timezone, pagination and parser version.
2. Save normalized metadata and raw hash, not private text by default.
3. Record success, empty page, partial page and failure separately.
4. Compare only snapshots with compatible coverage; otherwise return `not_computable`.
5. Keep formula version and denominator; reply count growth is not “quality”.

## Change detection

- S1/S2: OpenAPI checksum and operation count probes.
- S3: `openapi.json` checksum, path/operation diff, representative response schema probes; live shape mismatch is a stop signal.
- S5: page fingerprint + selector contract; if changed, stop parser rather than best-effort scrape.
- S6/S7: input hash, formula version and source evidence.

## Rate and ethics guardrails

All future probes use an identifying UA, low concurrency, request timeout, maximum response size and host token bucket. 429/403/5xx/schema mismatch with thresholded backoff triggers provider suspension. No bypass of auth, robots, CAPTCHA or access control; no public cache of authenticated results.
