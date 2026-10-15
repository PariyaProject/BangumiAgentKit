# Run #95 R05 candidate-pair preflight — no shared cast ID

**Observed:** 2026-10-15 UTC
**Source:** anonymous Bangumi official v0 API
**Purpose:** verify a fixed pair before registering or claiming any one-shot Agent/MCP profile.

## Requests and bounded observation

Four read-only requests were made with a generic project User-Agent and no credentials:

1. `POST /v0/search/subjects` for `けいおん！`, filtered to anime. The response listed three results; the selected TV entry was ID `1424`, `けいおん！` / `轻音少女`, first aired 2009-04-02.
2. `POST /v0/search/subjects` for `CLANNAD AFTER STORY`, filtered to anime. The response listed five results; the selected TV entry was ID `876`, `CLANNAD 〜AFTER STORY〜`, first aired 2008-10-02.
3. `GET /v0/subjects/1424/characters` returned 38 distinct actor IDs in the received rows.
4. `GET /v0/subjects/876/characters` returned 29 distinct actor IDs in the received rows.

The intersection of the two returned actor-ID sets was empty. These counts describe only the received responses; no completeness, no-connection, reverse-edge, staff, or franchise-wide conclusion follows.

## Disposition

The pair does not meet the precondition for the proposed positive-only shared-voice-actor profile. No Agent/MCP call was made, no claim or permanent latch was created, and no answer/report was accepted. R05 remains `UNASSESSED`; this is not evidence that the two works have no connection through another person, relation, or unobserved row.

Do not reuse this pair for the proposed positive one-shot. A later R05 Epoch must first verify a different pair with a positive shared stable person ID, then freeze and review its exact profile before claiming it. No raw API payloads were saved. No account/OAuth/community/HTML/write/QQ/TIM access occurred.

## Source references

- [Official subject search endpoint](https://api.bgm.tv/v0/search/subjects)
- [Official subject 1424 characters endpoint](https://api.bgm.tv/v0/subjects/1424/characters)
- [Official subject 876 characters endpoint](https://api.bgm.tv/v0/subjects/876/characters)
