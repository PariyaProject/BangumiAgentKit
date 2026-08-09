# PR-7A2.1 Stats source correction research

> Research date: 2026-08-09. Base: da363ad0dba4e9a9c4a977435f7bf30ce4f1069d. Read-only primary-source audit; no production changes.

## 1. Official v0 Subject schema

**FACT**：The current official server component Subject declares:

- rating.rank, rating.total, rating.score
- rating.count["1"] through rating.count["10"]
- collection.wish, collect, doing, on_hold, dropped

**EVIDENCE**：The owning schema is [bangumi/server/openapi/components/subject_v0.yaml](https://raw.githubusercontent.com/bangumi/server/master/openapi/components/subject_v0.yaml). The current [bangumi/server/openapi/v0.yaml](https://raw.githubusercontent.com/bangumi/server/master/openapi/v0.yaml) maps the 200 response of GET /v0/subjects/{subject_id} to #/components/schemas/Subject, and maps that component to ./components/subject_v0.yaml.

The implementation path is also explicit: [web/handler/subject/get.go](https://github.com/bangumi/server/blob/master/web/handler/subject/get.go) calls res.ToSubjectV0; [web/res/subject.go](https://github.com/bangumi/server/blob/master/web/res/subject.go) defines SubjectV0, Rating, Count, SubjectCollectionStat, and copies all ten count fields and all five collection buckets into the JSON response.

**REASONING**：The full Subject response, not only a SlimSubject search result, is a sufficient S1 raw source for overall rating histogram and collection-state buckets.

**CONFIDENCE**：HIGH. This is current first-party OpenAPI and server source.

**ALTERNATIVES**：A future server revision may add or rename fields; the provider must pin/check the schema rather than infer fields from website output.

**IMPLEMENTATION IMPLICATION**：Core Stats should consume S1 GET /v0/subjects/{id}; it must not require the HTML stats page for the ten-bin histogram or five collection buckets.

## 2. Official legacy equivalent

**FACT**：Current [bangumi/api/open-api/api.yml](https://raw.githubusercontent.com/bangumi/api/master/open-api/api.yml) defines Legacy_SubjectSmall.rating.total, rating.count["1"]…rating.count["10"], rating.score, rank, and collection.wish, collect, doing, on_hold, dropped.

**EVIDENCE**：The current Legacy_SubjectSmall component is referenced by the documented GET /calendar response. The legacy names and response shape are separate from S1 Subject, although the rating and collection raw inputs are equivalent for these fields.

**REASONING**：Calendar consumers may obtain the same core summary fields from S2, but S2 does not change the canonical v0 Subject source or add website-specific cross-tab statistics.

**CONFIDENCE**：HIGH.

**IMPLEMENTATION IMPLICATION**：A Calendar adapter may expose legacy raw stats with S2 provenance; merge logic must retain S1/S2 source identity.

## 3. Completion formula

**FACT**：For five read-only subject samples, the website stats page values match:

```
completion = collect / (wish + collect + doing + on_hold + dropped)
```

| Subject | S1 bucket sum | S1 collect | Website completion |
| ------: | ------------: | ---------: | -----------------: |
|   41529 |          9118 |       6706 |              73.5% |
|       1 |           199 |        128 |              64.3% |
|       8 |         32656 |      29176 |              89.3% |
|      89 |            64 |         53 |              82.8% |
|     202 |            12 |          5 |              41.7% |

**EVIDENCE**：S1 responses were obtained from [api.bgm.tv/v0/subjects/41529](https://api.bgm.tv/v0/subjects/41529) and the same v0 subject endpoint for IDs 1, 8, 89, and 202. Website observations were obtained from [41529/stats](https://bgm.tv/subject/41529/stats), [1/stats](https://bgm.tv/subject/1/stats), [8/stats](https://bgm.tv/subject/8/stats), [89/stats](https://bgm.tv/subject/89/stats), and [202/stats](https://bgm.tv/subject/202/stats), using an identifying read-only User-Agent on 2026-08-09.

**REASONING**：Each displayed percentage rounds collect / sum(all five buckets) to one decimal. This is stronger than a single-page coincidence, but the public website source inspected here does not expose a documented formula function.

**CONFIDENCE**：HIGH for the current observed implementation; MEDIUM for an undocumented future invariant.

**ALTERNATIVES**：The website could later change population filters or formula. A runtime implementation should version the formula and retain S5 definition evidence; a mismatch should become conflict, not a silent overwrite.

**IMPLEMENTATION IMPLICATION**：Classify core completion as S1 + S7. Preserve the stats page as S5 formula/definition evidence, not as the required raw source.

## 4. Standard deviation

**FACT**：For each sample, the website displayed SD matches population, not sample, standard deviation over the S1 ten-bin histogram:

```
N        = Σ count_i
mean     = Σ(i × count_i) / N
variance = Σ(count_i × (i - mean)^2) / N
SD       = sqrt(variance)
```

| Subject | S1 population SD | Website SD |
| ------: | ---------------: | ---------: |
|   41529 |          1.20134 |       1.20 |
|       1 |          1.35768 |       1.36 |
|       8 |          1.25874 |       1.26 |
|      89 |          1.10701 |       1.11 |
|     202 |          1.60000 |       1.60 |

**EVIDENCE**：The five corresponding stats URLs are listed in the completion evidence above. All website values match the population calculation rounded to two decimals.

**REASONING**：Using denominator N - 1 does not produce the displayed values for these samples; denominator N does. The page displays two decimal places.

**CONFIDENCE**：HIGH for the five-sample observation; MEDIUM for an undocumented source-code invariant.

**ALTERNATIVES**：A hidden filter could change the population in a future page. Provider diagnostics should retain the histogram, denominator, formula version, and page evidence.

**IMPLEMENTATION IMPLICATION**：Classify core SD as S1 + S7; no HTML request is required to calculate it from the official histogram.

## 5. Actual website-specific stats fields

The 41529 page embeds a CHART_SETS object containing interest_type, airdate, total_collects, regdate, relative_regdate, and vib, plus explanatory labels such as collection type, registration-age buckets, and Beta/VIB definitions.

These fields are not present in the S1 Subject schema and were not verified as stable S3 fields:

- rating by collection state (interest_type)
- users' total collection-volume distribution (total_collects)
- user registration-time distribution (regdate)
- rating time relative to registration (relative_regdate)
- VIB rating distribution
- rating by broadcast-time status (airdate)
- stats-page explanatory definitions and Beta labels

**Conclusion**：These remain S4 embedded/S5 page-specific capabilities. They do not justify classifying the overall histogram, collection buckets, completion, or population SD as HTML-required.
