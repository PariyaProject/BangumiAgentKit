import type { DomainSubject, SubjectRelationItem } from './subject.js';
import type { SubjectStaffGroup, SubjectStaffMember } from './person.js';

export type SubjectOverviewSectionState = 'complete' | 'partial' | 'unavailable' | 'not_computable';

export type SubjectOverviewState = 'complete' | 'partial' | 'unavailable' | 'not_found';

export interface SubjectOverviewSectionCoverage {
  state: SubjectOverviewSectionState;
  observed: number;
  returned: number;
  truncated: boolean;
}

export interface SubjectOverviewActorCoverage {
  observed: number;
  returned: number;
  truncated: boolean;
}

export interface SubjectOverviewStats {
  score: number;
  rank: number;
  ratingTotal: number;
  ratingHistogram: Record<string, number>;
  collection: {
    wish: number;
    collect: number;
    doing: number;
    onHold: number;
    dropped: number;
  };
}

export interface SubjectOverviewConflictSource {
  class: string;
  provider: string;
  operation?: string;
  version?: string;
  experimental?: boolean;
}

export interface SubjectOverviewConflictEvidence {
  source: SubjectOverviewConflictSource;
  retrievedAt: string;
  entity?: { type: string; id: string | number };
  fieldPath?: string;
  freshness?: { state: string; expiresAt?: string; sourceAgeMs?: number };
  authScope?: string;
  confidence?: string;
  formula?: string;
}

export interface SubjectOverviewStatsConflictCandidate {
  source: SubjectOverviewConflictSource;
  value: unknown;
  evidence?: SubjectOverviewConflictEvidence[];
}

export interface SubjectOverviewStatsConflict {
  state: 'conflict';
  candidates: SubjectOverviewStatsConflictCandidate[];
  reason: string;
  resolution?: string;
}

export interface SubjectOverviewCastItem {
  character: {
    id: number;
    name: string;
    type: number;
    summary?: string;
    images?: Record<string, string>;
  };
  relation: string;
  actors: Array<{
    id: number;
    name: string;
    career: string[];
    image?: string;
  }>;
  actorCoverage: SubjectOverviewActorCoverage;
}

export interface SubjectOverviewEvidence {
  source: 'official-v0' | 'derived-s7';
  operation: string;
  retrievedAt?: string;
  attemptedAt?: string;
  formulaVersion?: string;
  description?: string;
}

export interface SubjectOverviewWarning {
  code: string;
  state: SubjectOverviewSectionState | SubjectOverviewState;
  message: string;
  section?: 'subject' | 'stats' | 'cast' | 'staff' | 'relations';
}

export interface SubjectOverviewResult {
  state: SubjectOverviewState;
  subjectId: number;
  subject?: DomainSubject;
  stats: {
    state: SubjectOverviewSectionState;
    data?: SubjectOverviewStats;
    conflicts?: SubjectOverviewStatsConflict[];
    coverage: SubjectOverviewSectionCoverage;
  };
  cast: {
    state: SubjectOverviewSectionState;
    items: SubjectOverviewCastItem[];
    coverage: SubjectOverviewSectionCoverage;
    actorCoverage: SubjectOverviewActorCoverage;
  };
  staff: {
    state: SubjectOverviewSectionState;
    items: SubjectStaffMember[];
    groups: SubjectStaffGroup[];
    coverage: SubjectOverviewSectionCoverage;
  };
  relations: {
    state: SubjectOverviewSectionState;
    items: SubjectRelationItem[];
    coverage: SubjectOverviewSectionCoverage;
  };
  coverage: {
    sourceRequestsAttempted: number;
    sourceRequestsSucceeded: number;
    sectionsComplete: number;
    sectionsPartial: number;
    sectionsUnavailable: number;
    sectionsNotComputable: number;
    truncatedSections: string[];
    limits: {
      maxCast: number;
      maxStaff: number;
      maxRelations: number;
    };
    actorLimits: {
      perCharacter: number;
      total: number;
    };
  };
  evidence: SubjectOverviewEvidence[];
  limitations: string[];
  warnings: SubjectOverviewWarning[];
}
