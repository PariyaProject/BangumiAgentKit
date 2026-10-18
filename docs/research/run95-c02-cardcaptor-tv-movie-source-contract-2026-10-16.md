# Run #95 C02: bounded TV and theatrical comparison source contract

Status as prepared on 2026-10-16: source-only preparation for the C02 Agent/MCP scenario. At that time no Bangumi API, ToolRegistry, Agent/MCP, account, OAuth, community, QQ, or TIM call had been made, and no claim had been created. The later live Run #95 profile disposition is recorded in [the 2026-10-18 terminal-disposition report](run95-c02-profile-terminal-disposition-2026-10-18.md); this source contract is historical preparation, not current claim status.

## Fixed pair and relationship evidence

- Bangumi subject 1940 is the TV entry for Cardcaptor Sakura. Its Bangumi page lists 70 reported episodes and CLAMP as the original work: <https://bgm.tv/subject/1940>.
- Bangumi subject 1941 is the theatrical film Cardcaptor Sakura. Its Bangumi page lists one reported episode and CLAMP as the original work. The page’s structured relationship section links subject 1940 as the main story: <https://bgm.tv/subject/1941>.
- These page fields support a bounded pair selection for C02. They are Bangumi-maintained catalog fields, not a claim that every adaptation or theatrical work in the franchise has been identified.

## Tool contract

The current generated tool catalog describes `bangumi.get_subject_comparison` as `auth: none`, `risk: read`. Its fixed C02 arguments will be:

```json
{
  "subjectIds": [1940, 1941],
  "maxCast": 1,
  "maxStaff": 1,
  "maxRelations": 1
}
```

The comparison contract returns an ordered two-subject snapshot with metrics including `episodesReported`, `score`, and `collectionTotal`; each metric carries values, a second-minus-first delta, and a complete/unknown/conflict state. The response also carries request coverage, source operations, warnings, and limitations. The bounded official-v0 operation set is subject detail, rating/collection fields, subject characters, subject persons, and subject relations. The tool does not prove that a pair is related; the pair-selection evidence above is separate from the comparison result.

## Acceptance limits

- `episodesReported` is the reported episode count on each subject. It is not the number already aired, watched, or remaining.
- `score` and `collectionTotal` are current public observations. A successful response is one snapshot, not a historical trend or quality judgment.
- A metric that is unknown, conflicted, or missing must remain unknown in the model answer and report. The checker must bind all returned values and deltas to the structured tool result.
- Any accepted result supports only this exact pair and the bounded C02 question. It does not establish complete adaptation coverage, population completeness, causality, statistical significance, preference, or which work is better.
- `get_subject_comparison` already has generic Agent/MCP matrix credit. This profile can advance C02 scenario evidence but must not increase the Agent/MCP tool count.
- The intended profile is one fixed anonymous read-only call after exact Candidate/Base/CI and same-identity GPT-6 Luna Max PASS. Its claim is permanent; an inconclusive result must not be retried.
