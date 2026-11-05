/** Exact bounded A7 page semantics, independent of orchestration. */
export function validSelectedEpisodePage(body, selectedSubject) {
  return (
    Number.isSafeInteger(selectedSubject) &&
    selectedSubject > 0 &&
    Array.isArray(body?.items) &&
    body.items.length === 1 &&
    body.items[0]?.episode?.subjectId === selectedSubject &&
    body.items[0].type === 1 &&
    body.items[0].status === 'wish' &&
    body.items[0].episode.rawType === 0 &&
    body.items[0].episode.category === 'main' &&
    body.offset === 0 &&
    body.limit === 1 &&
    body.coverage?.observed === 1 &&
    body.coverage.returned === 1 &&
    body.coverage.requestedLimit === 1 &&
    body.coverage.effectiveLimit === 1 &&
    body.coverage.offset === 0 &&
    body.coverage.truncated === true &&
    body.source?.authScope === 'account' &&
    body.source.operation === 'GET /v0/users/-/collections/{subject_id}/episodes'
  );
}
