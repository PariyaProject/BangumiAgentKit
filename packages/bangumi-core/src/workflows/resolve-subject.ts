import { SubjectService } from '../services/subject-service.js';
import { DomainSubject } from '../models/subject.js';
import { SubjectCandidate } from '../results/result.js';

export function normalizeSearchText(text: string): string {
  if (!text) return '';
  return text.normalize('NFKC').trim().toLowerCase().replace(/\s+/g, ' ');
}

export type ResolveSubjectStatus = 'exact' | 'disambiguation' | 'not_found';

export interface ResolveSubjectResult {
  status: ResolveSubjectStatus;
  query: string;
  total: number;
  exact?: DomainSubject;
  candidates: SubjectCandidate[];
}

export async function resolveSubject(
  subjectService: SubjectService,
  query: string,
  options: {
    type?: number;
    limit?: number;
    offset?: number;
    sort?: 'match' | 'heat' | 'rank' | 'score';
    nsfw?: 'exclude' | 'include' | 'only';
  } = {},
): Promise<ResolveSubjectResult> {
  const trimmedQuery = query.trim();
  const normalizedQuery = normalizeSearchText(query);

  // Rule A: Numeric query -> try direct subject ID lookup
  if (/^\d+$/.test(trimmedQuery)) {
    const subjectId = parseInt(trimmedQuery, 10);
    try {
      const subject = await subjectService.getSubjectById(subjectId);
      const candidate: SubjectCandidate = {
        id: subject.id,
        name: subject.name,
        nameCn: subject.nameCn,
        type: subject.type,
        date: subject.date,
        image:
          subject.images?.medium ||
          subject.images?.common ||
          subject.images?.small ||
          subject.images?.grid,
        score: subject.score,
        rank: subject.rank,
        nsfw: subject.nsfw,
      };
      return {
        status: 'exact',
        query,
        total: 1,
        exact: subject,
        candidates: [candidate],
      };
    } catch {
      // Direct ID lookup failed (404), fallback to keyword search below
    }
  }

  // Rule B: Keyword search - single search call
  const limit = options.limit ?? 10;
  const searchRes = await subjectService.searchSubjects(query, {
    limit,
    offset: options.offset,
    type: options.type,
    sort: options.sort,
    nsfw: options.nsfw,
  });

  if (!searchRes.items || searchRes.items.length === 0) {
    return {
      status: 'not_found',
      query,
      total: 0,
      candidates: [],
    };
  }

  const candidateList: SubjectCandidate[] = searchRes.items.map((item) => ({
    id: item.id,
    name: item.name,
    nameCn: item.nameCn,
    type: item.type,
    date: item.date,
    image: item.images?.medium || item.images?.common || item.images?.small || item.images?.grid,
    score: item.score,
    rank: item.rank,
    nsfw: item.nsfw,
  }));

  // Rule C: Normalized exact comparison on name or nameCn
  const exactMatches = searchRes.items.filter((item) => {
    const normName = normalizeSearchText(item.name);
    const normNameCn = normalizeSearchText(item.nameCn);
    return normName === normalizedQuery || normNameCn === normalizedQuery;
  });

  if (exactMatches.length === 1) {
    const matched = exactMatches[0]!;
    return {
      status: 'exact',
      query,
      total: searchRes.total,
      exact: matched,
      candidates: candidateList,
    };
  }

  if (exactMatches.length > 1) {
    return {
      status: 'disambiguation',
      query,
      total: searchRes.total,
      candidates: candidateList,
    };
  }

  // Rule D: Single candidate from search
  if (searchRes.items.length === 1) {
    return {
      status: 'exact',
      query,
      total: searchRes.total,
      exact: searchRes.items[0],
      candidates: candidateList,
    };
  }

  // Rule E: Multiple candidates without single exact match
  return {
    status: 'disambiguation',
    query,
    total: searchRes.total,
    candidates: candidateList,
  };
}
