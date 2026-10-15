export function selectPublicProbeNames(args: string[], availableNames: readonly string[]): string[] {
  const requested: string[] = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === '--live' || args[index] === '--') continue;
    const toolName = args[index + 1];
    if (args[index] !== '--tool' || typeof toolName !== 'string' || toolName.length === 0) {
      throw new Error('Only --live and repeated --tool <exact-tool-name> options are supported.');
    }
    requested.push(toolName);
    index += 1;
  }
  if (requested.length === 0) return [...availableNames];
  if (new Set(requested).size !== requested.length) {
    throw new Error('A tool may be selected only once per probe run.');
  }
  const known = new Set(availableNames);
  const unknown = requested.filter((name) => !known.has(name));
  if (unknown.length > 0) {
    throw new Error(`Unknown or unsafe public probe tool: ${unknown.join(', ')}`);
  }
  const selected = new Set(requested);
  return availableNames.filter((name) => selected.has(name));
}

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as RecordValue)
    : null;
}

export function projectPublicPersonProfileSummary(value: unknown): RecordValue | null {
  const profile = asRecord(value);
  const person = asRecord(profile?.person);
  const sourceSummary = asRecord(profile?.summary);
  const coverage = asRecord(profile?.coverage);
  const subjects = asRecord(coverage?.subjects);
  const subjectMedia = sourceSummary?.subjectMedia;
  if (!person || !sourceSummary || !subjects || !Array.isArray(subjectMedia)) return null;

  return {
    state: profile?.state,
    personId: person.id,
    subjectCredits: sourceSummary.subjectCredits,
    uniqueSubjects: sourceSummary.uniqueSubjects,
    subjectRowsObserved: subjects.observed,
    subjectRowsReturned: subjects.returned,
    subjectRowsTruncated: subjects.truncated,
    sourceCompleteness: subjects.sourceCompleteness,
    subjectMedia: subjectMedia.map((item) => {
      const bucket = asRecord(item);
      return {
        key: bucket?.key,
        label: bucket?.label,
        count: bucket?.count,
        uniqueSubjects: bucket?.uniqueSubjects,
        rawCodes: Array.isArray(bucket?.rawCodes) ? bucket.rawCodes : [],
      };
    }),
  };
}

export function publicPersonProfileSummaryIsConsistent(
  summary: RecordValue,
  expectedPersonId: unknown,
  expectedMaxSubjects: unknown,
): boolean {
  const media = summary.subjectMedia;
  if (
    !['partial', 'complete'].includes(String(summary.state)) ||
    summary.personId !== expectedPersonId ||
    !Number.isSafeInteger(expectedMaxSubjects) ||
    (expectedMaxSubjects as number) < 1 ||
    !Number.isSafeInteger(summary.subjectCredits) ||
    !Number.isSafeInteger(summary.uniqueSubjects) ||
    !Number.isSafeInteger(summary.subjectRowsObserved) ||
    !Number.isSafeInteger(summary.subjectRowsReturned) ||
    typeof summary.subjectRowsTruncated !== 'boolean' ||
    summary.sourceCompleteness !== 'undocumented' ||
    !Array.isArray(media) ||
    media.length === 0
  ) {
    return false;
  }

  const allowedKeys = new Set(['book', 'anime', 'music', 'game', 'real', 'other']);
  const seenKeys = new Set<string>();
  let countTotal = 0;
  let uniqueSubjectTotal = 0;
  for (const item of media) {
    const bucket = asRecord(item);
    if (
      !bucket ||
      Object.keys(bucket).sort().join(',') !== 'count,key,label,rawCodes,uniqueSubjects' ||
      typeof bucket.key !== 'string' ||
      !allowedKeys.has(bucket.key) ||
      seenKeys.has(bucket.key) ||
      typeof bucket.label !== 'string' ||
      !bucket.label.trim() ||
      !Number.isSafeInteger(bucket.count) ||
      (bucket.count as number) < 1 ||
      !Number.isSafeInteger(bucket.uniqueSubjects) ||
      (bucket.uniqueSubjects as number) < 0 ||
      (bucket.uniqueSubjects as number) > (bucket.count as number) ||
      !Array.isArray(bucket.rawCodes) ||
      bucket.rawCodes.some((code) => !Number.isSafeInteger(code) || (code as number) < 1)
    ) {
      return false;
    }
    seenKeys.add(bucket.key);
    countTotal += bucket.count as number;
    uniqueSubjectTotal += bucket.uniqueSubjects as number;
  }

  const observed = summary.subjectRowsObserved as number;
  const returned = summary.subjectRowsReturned as number;
  const subjectCredits = summary.subjectCredits as number;
  const uniqueSubjects = summary.uniqueSubjects as number;
  return (
    returned <= observed &&
    returned <= (expectedMaxSubjects as number) &&
    summary.subjectRowsTruncated === (observed > returned) &&
    subjectCredits === returned &&
    uniqueSubjects <= subjectCredits &&
    countTotal === subjectCredits &&
    uniqueSubjectTotal >= uniqueSubjects &&
    uniqueSubjectTotal <= subjectCredits
  );
}
