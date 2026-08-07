import { SubjectService } from '../services/subject-service.js';
import { DomainSubject } from '../models/subject.js';

export interface ResolveSubjectResult {
  status: 'exact' | 'disambiguation' | 'not_found';
  exact?: DomainSubject;
  candidates?: DomainSubject[];
}

export async function resolveSubject(
  subjectService: SubjectService,
  keyword: string,
  type?: number
): Promise<ResolveSubjectResult> {
  const isNumericId = /^\d+$/.test(keyword.trim());
  if (isNumericId) {
    try {
      const subject = await subjectService.getSubjectById(parseInt(keyword.trim(), 10));
      return { status: 'exact', exact: subject };
    } catch {
      // Fallback to keyword search
    }
  }

  const searchRes = await subjectService.searchSubjects(keyword, { limit: 5, type });
  if (!searchRes.items || searchRes.items.length === 0) {
    return { status: 'not_found' };
  }

  if (searchRes.items.length === 1) {
    return { status: 'exact', exact: searchRes.items[0] };
  }

  // Exact match check on name or nameCn
  const trimmed = keyword.trim().toLowerCase();
  const exactMatch = searchRes.items.find(
    (item) => item.name.toLowerCase() === trimmed || item.nameCn.toLowerCase() === trimmed
  );

  if (exactMatch) {
    return { status: 'exact', exact: exactMatch };
  }

  return {
    status: 'disambiguation',
    candidates: searchRes.items,
  };
}
