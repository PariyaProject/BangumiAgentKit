# Run #95 — D02 bounded public keyword-search source contract

**Checked:** 2026-10-13 against BangumiAgentKit master `5de65c5316884333e2df1590ae8676424ee0e9f4` and the official public v0 OpenAPI.
**Frontier:** D02, “适合喜欢《少女终末旅行》的低刺激末世旅行动画有哪些？”

## Bounded supported slice

`bangumi.search_subjects` can return a bounded list of public subject candidates for a fixed keyword query. Its current catalog marks the tool `auth=optional`, `risk=read`; the selected Runner can exercise it in anonymous mode by clearing OAuth/token environment variables, using isolated `MemoryStorage`, and sending no bearer token.

The one-call profile proposed for this Epoch is:

```json
{"query":"末世 旅行","type":"anime","sort":"match","nsfw":"exclude","limit":8,"offset":0}
```

The product code passes this nonnumeric keyword to `resolveSubject`, which makes one `searchSubjects` call and returns a resolution status plus the visible candidate rows. The search API returns matches to a keyword request; it does not define “low stimulation,” user preference similarity, or a canonical recommendation score. A bounded answer may repeat only returned titles as *keyword-search candidates* and must say that suitability is not established.

## Official source boundary

Bangumi's official [`POST /v0/search/subjects` OpenAPI operation](https://github.com/bangumi/server/blob/master/openapi/v0.yaml) marks the endpoint experimental and documents a required keyword plus filters such as type, tags, air date, rating, rating count, rank, and NSFW. It does not define a low-stimulation or similarity field. Experimental behavior and search coverage can change; the returned page cannot prove that no other suitable works exist.

## Acceptance and safety boundary

- Exactly one current-source `bangumi.search_subjects` MCP call is allowed, with the fixed arguments above, after exact Candidate, current master, mandatory CI, and assigned GPT-6 Luna Max PASS gates.
- The answer checker must validate the complete structured result, row order/identity, and a clear boundary: keyword candidates only; no claim of low-stimulation content, official similarity, complete results, or absence.
- The MCP server may expose `auth=optional` only through a D02-specific anonymous mode for `bangumi.search_subjects`; it clears credential variables before runtime construction and uses empty in-memory account storage. No bearer token, consent, private read, or write is permitted.
- Harness must acquire the repository-wide create-only D02 label and read back the exact active-PR claim before dispatch; a local Git-metadata claim file mirrors that durable state for recovery. The root PariyaAgent checkpoint mirror is optional and cannot block the Harness-owned route. Any failed or inconclusive call stays spent; no retry and no Agent/MCP coverage credit.
- No live request has been made while writing this source contract. D02 remains UNASSESSED until the governed one-shot succeeds; even a passing result supports at most a bounded keyword-candidate observation, not a low-stimulation recommendation.
- Community/review/HTML sources, OAuth/account paths, and real QQ/TIM actions remain outside this Epoch.
