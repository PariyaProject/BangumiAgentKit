import { D02_EXPECTED_QUERY_ARGUMENTS } from '../acceptance/d02-public-search-answer-check.mjs';

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0);
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function checkD02AnonymousSourceRequest({ url, method, authorizationHeaderPresent, body, requestCount }) {
  if (!(url instanceof URL) || url.origin !== 'https://api.bgm.tv' ||
      url.pathname !== '/v0/search/subjects' || method !== 'POST') {
    return { allowed: false, reasonCode: 'SOURCE_OPERATION_NOT_ALLOWLISTED' };
  }
  if (requestCount !== 1) return { allowed: false, reasonCode: 'SOURCE_REQUEST_LIMIT_REACHED' };
  if (authorizationHeaderPresent === true) {
    return { allowed: false, reasonCode: 'AUTHORIZATION_HEADER_PROHIBITED' };
  }
  const queryParameters = [...url.searchParams.entries()].sort(([left], [right]) => left.localeCompare(right));
  const allowedQuery = [
    ['limit', String(D02_EXPECTED_QUERY_ARGUMENTS.limit)],
    ['offset', String(D02_EXPECTED_QUERY_ARGUMENTS.offset)],
  ].sort(([left], [right]) => left.localeCompare(right));
  const expectedBody = {
    keyword: D02_EXPECTED_QUERY_ARGUMENTS.query,
    sort: D02_EXPECTED_QUERY_ARGUMENTS.sort,
    filter: { type: [2], nsfw: false },
  };
  if (canonicalJson(queryParameters) !== canonicalJson(allowedQuery) ||
      canonicalJson(body) !== canonicalJson(expectedBody)) {
    return { allowed: false, reasonCode: 'SOURCE_REQUEST_PROFILE_MISMATCH' };
  }
  return { allowed: true, reasonCode: 'ALLOWLISTED_ANONYMOUS_PUBLIC_SEARCH' };
}
