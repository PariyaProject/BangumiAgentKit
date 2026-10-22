# Run #95 P03 v2 fresh public person selection

Observed 2026-10-22 for the separately registered P03 v2 Agent/MCP matrix
profile. The prior P03 v1 claim for person `4765` is terminal and remains
untouched.

## Candidate and bounded source evidence

- An anonymous read of the official public `GET /v0/subjects/218707/persons`
  response returned 157 person rows. Person `19306` appeared with raw relation
  `音乐制作` and was not present in the existing P03/P02 profile records or
  live-probe reports.
- An anonymous read of the official public
  `GET /v0/persons/19306/subjects` response returned 4,749 subject rows.
  Among those rows, 2,854 had a non-empty `name_cn`, 1,895 had an empty value,
  and no row was counted as unavailable in that response.
- These counts establish only the observed response shape. The public source
  does not document relation completeness or a stable total/order contract;
  they do not prove career-wide coverage or that omitted works lack a Chinese
  title.

The registered tool call is fixed to `personId=19306`, `includeCredits=true`,
`maxSubjects=500`, `maxCharacters=1`, and `includeChronology=false`. The MCP
server will return a P03-specific bounded text projection derived from its
validated temporary summary, without `structuredContent`; the whole parsed text
object, including nested keys, must exactly match that summary. The temporary
summary is removed with the run directory. The report may store only
source/review/runtime hashes, bounded counters, boolean checks, and the signed
runner receipt. It must not store the person name, subject names, prompt,
answer, raw rows, or event stream.

## Acceptance boundary

This profile is distinct from P03 v1 by profile ID, person ID, arguments,
claim label, report path, and exact reviewed Epoch. A passing signed report
may advance only the `bangumi.get_person_profile` Agent/MCP matrix cell. P03
stays `PARTIAL`; no career-wide completeness, translation, account, OAuth,
community, write, QQ, or TIM claim follows from this matrix run.

The profile is invoked exactly once and only after the exact Candidate passes
the seven required checks, Harness `candidate:check`, and the same-identity
GPT-6 Luna Max review. Any post-claim failure is terminal INCONCLUSIVE with no
report and no retry.
