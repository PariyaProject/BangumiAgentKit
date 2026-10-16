# Run #95 R02 — positive direct relations sample

**Observed:** 2026-10-16, using three bounded anonymous `GET` requests to the official Bangumi v0 endpoint. The sample records only source/target IDs, raw relation labels, and coverage counts; no subject names or complete response bodies are retained.

## Source contract

`GET /v0/subjects/{subject_id}/subjects` returns the visible direct rows for one source subject. The v0 schema defines `relation` as a string and provides no pagination, total count, reverse-edge, transitive-edge, or graph-completeness field. `bangumi.get_subject_relations` with `includeEvidence=true` preserves the source direction and raw label and reports those limits. [Official v0 endpoint and schema](https://github.com/bangumi/api/blob/65d29cff2331e08c0110d30d515f7f1b6488f845/open-api/v0.yaml#L452-L482) · [Local tool definition](https://github.com/PariyaProject/BangumiAgentKit/blob/616acc7ce87d7205cacccab4456d2229459ce072/packages/tools/src/definitions/read-tools.ts#L471-L516)

## Bounded positive observations

| Source subject | Response rows observed | Direct target ID | Raw relation label |
| -------------: | ---------------------: | ---------------: | ------------------ |
|           4923 |                     53 |              315 | `动画`             |
|           4923 |                     53 |             1428 | `动画`             |
|            315 |                     33 |             1935 | `续集`             |
|           1428 |                     41 |            10799 | `衍生`             |

These observations support only the four direct source-to-target rows shown above for the three sampled subjects. They do not establish reverse or transitive relations, canonical adaptation-chain semantics, a complete series graph, or absence of unreturned rows. The API provides no pagination or total count, and anonymous visibility may omit sensitive entries. The R02 scenario therefore remains `UNASSESSED`; a valid signed report from the registered three-call Agent/MCP profile may credit only the `bangumi.get_subject_relations` Agent/MCP matrix cell.

The R02 profile is limited to one ordered call each for source IDs `4923`, `315`, and `1428`. It makes no authenticated request and does not read account/community data or perform writes, OAuth, QQ, or TIM actions.

The runtime fetch guard permits only `Accept: application/json` and the fixed project `User-Agent`; it rejects every other header or credential mode and sends the request with `credentials: omit`.
