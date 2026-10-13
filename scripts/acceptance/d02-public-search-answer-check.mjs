import { Buffer } from 'node:buffer';

export const D02_EXPECTED_QUERY_ARGUMENTS = Object.freeze({
  query: '末世 旅行',
  type: 'anime',
  sort: 'match',
  nsfw: 'exclude',
  limit: 8,
  offset: 0,
});

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.entries(value).sort(([left], [right]) =>
      left < right ? -1 : left > right ? 1 : 0);
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function displayTitle(candidate) {
  return typeof candidate?.nameCn === 'string' && candidate.nameCn.trim().length > 0
    ? candidate.nameCn
    : candidate?.name;
}

function validCandidates(sourceResult) {
  if (
    !sourceResult ||
    !['exact', 'disambiguation', 'not_found'].includes(sourceResult.status) ||
    sourceResult.query !== D02_EXPECTED_QUERY_ARGUMENTS.query ||
    !Array.isArray(sourceResult.candidates)
  ) {
    return null;
  }
  const rows = sourceResult.candidates.map((item) => ({
    id: item?.id,
    title: displayTitle(item),
  }));
  if (
    rows.length > D02_EXPECTED_QUERY_ARGUMENTS.limit ||
    rows.some((row) => !Number.isSafeInteger(row.id) || row.id <= 0 ||
      typeof row.title !== 'string' || row.title.trim().length === 0) ||
    new Set(rows.map((row) => row.id)).size !== rows.length ||
    (sourceResult.status === 'not_found' && rows.length !== 0) ||
    (sourceResult.status !== 'not_found' && rows.length === 0)
  ) {
    return null;
  }
  return rows;
}

export function projectD02SearchResult(sourceResult) {
  const rows = validCandidates(sourceResult);
  if (!rows) throw new Error('D02 source result does not match the bounded public-search contract.');
  const candidates = sourceResult.candidates.map((candidate) => ({
    id: candidate.id,
    ...(typeof candidate.name === 'string' ? { name: candidate.name } : {}),
    ...(typeof candidate.nameCn === 'string' ? { nameCn: candidate.nameCn } : {}),
  }));
  if (candidates.some((candidate, index) => rows[index]?.id !== candidate.id)) {
    throw new Error('D02 source row identity did not survive its bounded projection.');
  }
  return {
    status: sourceResult.status,
    query: sourceResult.query,
    total: Number.isSafeInteger(sourceResult.total) && sourceResult.total >= 0
      ? sourceResult.total
      : null,
    candidates,
  };
}

function expectedScopeLine(count) {
  return `范围：本次返回 ${count} 条；这只是 Bangumi 实验性关键词搜索结果，不判断低刺激或官方相似度，不保证完整；未返回不代表不存在。`;
}

export function extractD02SearchReadback(toolResult, maxTextUtf8Bytes = 3600) {
  const structured = toolResult?.structuredContent;
  if (structured && typeof structured === 'object' && !Array.isArray(structured)) {
    return { value: structured, mode: 'structuredContent', textUtf8Bytes: null };
  }
  if (!Array.isArray(toolResult?.content)) return null;
  const text = toolResult.content
    .filter((item) => item?.type === 'text' && typeof item.text === 'string')
    .map((item) => item.text)
    .join('\n');
  if (!text || Buffer.byteLength(text, 'utf8') > maxTextUtf8Bytes) return null;
  try {
    const value = JSON.parse(text);
    if (validCandidates(value) === null) return null;
    return { value, mode: 'complete-json-text', textUtf8Bytes: Buffer.byteLength(text, 'utf8') };
  } catch {
    return null;
  }
}

export function checkD02PublicSearchAnswer({ answer, sourceResult, arguments: actualArguments }) {
  const rows = validCandidates(sourceResult);
  const argumentsMatch = canonicalJson(actualArguments) === canonicalJson(D02_EXPECTED_QUERY_ARGUMENTS);
  if (typeof answer !== 'string' || rows === null || !argumentsMatch) {
    return {
      accepted: false,
      argumentsMatch,
      sourceResultValid: rows !== null,
      answerRows: 0,
      matchedRows: 0,
      missingRows: rows?.length ?? 0,
      unsupportedClaims: true,
      scopeLineVerified: false,
    };
  }

  const lines = answer.trim().split(/\r?\n/u);
  const expectedHeader = `Bangumi 关键词检索“${D02_EXPECTED_QUERY_ARGUMENTS.query}”返回的候选：`;
  const answerRows = lines.slice(1, -1);
  const parsedRows = answerRows.map((line) => {
    const match = /^候选 (\d+) — (.+)$/u.exec(line);
    return match ? { id: Number(match[1]), title: match[2] } : null;
  });
  const rowsMatch = parsedRows.length === rows.length &&
    parsedRows.every((row, index) => row?.id === rows[index]?.id && row?.title === rows[index]?.title);
  const scopeLineVerified = lines.at(-1) === expectedScopeLine(rows.length);
  const unsupportedClaimMarkers = /(?:推荐|很适合|适合该偏好|官方相似|低刺激).*(?:推荐|很适合|适合该偏好|官方相似|低刺激)/u;
  const unsupportedClaims =
    lines.length !== rows.length + 2 ||
    lines[0] !== expectedHeader ||
    !rowsMatch ||
    !scopeLineVerified ||
    answer.includes('```') ||
    answer.includes('**') ||
    unsupportedClaimMarkers.test(lines.slice(0, -1).join('\n'));

  return {
    accepted: !unsupportedClaims,
    argumentsMatch,
    sourceResultValid: true,
    answerRows: parsedRows.length,
    matchedRows: rowsMatch ? rows.length : 0,
    missingRows: rowsMatch ? 0 : rows.length,
    unsupportedClaims,
    scopeLineVerified,
  };
}

export function d02SanitizedSourceSummary(sourceResult) {
  const rows = validCandidates(sourceResult);
  if (!rows) return { sourceResultValid: false, responseRows: null, status: null };
  return {
    sourceResultValid: true,
    status: sourceResult.status,
    responseRows: rows.length,
    returnedCandidates: rows.length,
    reportedTotal: Number.isSafeInteger(sourceResult.total) && sourceResult.total >= 0
      ? sourceResult.total
      : null,
  };
}
