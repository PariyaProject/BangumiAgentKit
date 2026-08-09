import {
  createEvidenceRef,
  type CapabilityResult,
  type FieldEvidence,
  type SourceDescriptor,
} from './contracts.js';
import {
  CALENDAR_FIELD_POLICY,
  DEFAULT_SOURCE_POLICY,
  selectFallbackSources,
  type SourcePolicy,
} from './source-policy.js';
import type {
  CalendarDayData,
  CalendarSubjectData,
  ProviderSubjectData,
} from './providers.js';

export interface MergedCalendarItem {
  /** S2 membership/name/date facts remain intact and authoritative. */
  membership: CalendarSubjectData;
  /** Optional S1 canonical hydration is retained as a separate object. */
  subject?: ProviderSubjectData;
}

export interface MergedCalendarDay {
  weekday: CalendarDayData['weekday'];
  items: MergedCalendarItem[];
}

export function mergeCalendarWithSubjects(
  calendar: CapabilityResult<CalendarDayData[]>,
  subjectResults: ReadonlyMap<number, CapabilityResult<ProviderSubjectData>>,
  policy: SourcePolicy = DEFAULT_SOURCE_POLICY,
): CapabilityResult<MergedCalendarDay[]> {
  if (!calendar.data) {
    return calendar as unknown as CapabilityResult<MergedCalendarDay[]>;
  }

  const warnings = [...(calendar.warnings ?? [])];
  const evidence: FieldEvidence = {
    ...(calendar.evidence ?? {}),
    membership: [...(calendar.evidence?.membership ?? [])],
    weekday: [...(calendar.evidence?.weekday ?? [])],
  };
  const data = calendar.data.map((day) => ({
    weekday: day.weekday,
    items: day.items.map((membership) => {
      const subjectResult = subjectResults.get(membership.id);
      const subject = subjectResult?.data;
      if (subject) {
        for (const [fieldPath, refs] of Object.entries(subjectResult.evidence ?? {})) {
          const key = `subject.${fieldPath}`;
          evidence[key] = [...(evidence[key] ?? []), ...refs];
        }
      } else if (subjectResult && subjectResult.state !== 'ok') {
        warnings.push(
          ...(subjectResult.warnings ?? []).map((item) => ({
            ...item,
            fieldPath: item.fieldPath ?? `items[${membership.id}].subject`,
          })),
        );
      }

      return { membership, subject };
    }),
  }));

  const hydrationMissing = data.some((day) =>
    day.items.some((item) => item.subject === undefined),
  );
  const state =
    calendar.state === 'ok' && hydrationMissing && subjectResults.size > 0 ? 'partial' : calendar.state;
  const returned = data.reduce((count, day) => count + day.items.length, 0);

  return {
    state,
    data,
    evidence,
    coverage: {
      ...(calendar.coverage ?? { state: 'unknown' }),
      ...(hydrationMissing && subjectResults.size > 0
        ? { state: 'partial' as const, returned, reason: 'some S1 subject hydration was unavailable' }
        : { returned }),
    },
    retrievedAt: calendar.retrievedAt,
    warnings,
  };
}

export interface CalendarFieldPolicyDescription {
  field: keyof typeof CALENDAR_FIELD_POLICY;
  sourceClass: (typeof CALENDAR_FIELD_POLICY)[keyof typeof CALENDAR_FIELD_POLICY];
}

export function calendarFieldPolicy(): CalendarFieldPolicyDescription[] {
  return Object.entries(CALENDAR_FIELD_POLICY).map(([field, sourceClass]) => ({
    field: field as keyof typeof CALENDAR_FIELD_POLICY,
    sourceClass: sourceClass as CalendarFieldPolicyDescription['sourceClass'],
  }));
}

/** A missing value is not permission to invoke an unapproved fallback source. */
export function noImplicitFallbacks(policy: SourcePolicy = DEFAULT_SOURCE_POLICY): boolean {
  return selectFallbackSources('subject', 'official_v0', policy).length === 0;
}

export function mergeEvidenceRefs(
  source: SourceDescriptor,
  retrievedAt: string,
  fieldPath: string,
  ...evidence: FieldEvidence[]
): FieldEvidence {
  const refs = evidence.flatMap((item) => item[fieldPath] ?? []);
  if (refs.length > 0) return { [fieldPath]: refs };
  return {
    [fieldPath]: [
      createEvidenceRef({
        source,
        retrievedAt,
        fieldPath,
        freshness: { state: 'unknown' },
        confidence: 'low',
      }),
    ],
  };
}
