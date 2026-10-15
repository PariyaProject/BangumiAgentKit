import { describe, expect, it } from 'vitest';
import {
  projectPublicPersonProfileSummary,
  publicPersonProfileSummaryIsConsistent,
  selectPublicProbeNames,
} from '../../scripts/public-probe-selection.js';

describe('selectPublicProbeNames', () => {
  const available = [
    'bangumi.get_user',
    'bangumi.get_collection',
    'bangumi.get_subject',
    'bangumi.get_subject_relations',
  ];

  it('isolates the R01 relation probe to its exact public read tool', () => {
    expect(selectPublicProbeNames([
      '--live', '--', '--tool', 'bangumi.get_subject_relations',
    ], available)).toEqual(['bangumi.get_subject_relations']);
  });

  it('accepts the pnpm argument separator and only returns selected tools', () => {
    expect(selectPublicProbeNames([
      '--live', '--', '--tool', 'bangumi.get_subject', '--tool', 'bangumi.get_user',
    ], available)).toEqual(['bangumi.get_user', 'bangumi.get_subject']);
  });

  it('defaults to the full allowlisted probe set', () => {
    expect(selectPublicProbeNames(['--live'], available)).toEqual(available);
  });

  it('rejects duplicate and unknown tool selections', () => {
    expect(() => selectPublicProbeNames(
      ['--tool', 'bangumi.get_user', '--tool', 'bangumi.get_user'], available,
    )).toThrow('A tool may be selected only once per probe run.');
    expect(() => selectPublicProbeNames(['--tool', 'bangumi.manage_index'], available))
      .toThrow('Unknown or unsafe public probe tool: bangumi.manage_index');
  });

  it('rejects unsupported flags and missing tool names', () => {
    expect(() => selectPublicProbeNames(['--unsupported', 'value'], available))
      .toThrow('Only --live and repeated --tool <exact-tool-name> options are supported.');
    expect(() => selectPublicProbeNames(['--tool'], available))
      .toThrow('Only --live and repeated --tool <exact-tool-name> options are supported.');
  });
});

describe('public person profile probe summary', () => {
  const source = {
    state: 'partial',
    person: { id: 3474, name: 'Private source name', images: { large: 'private-image-url' } },
    summary: {
      subjectCredits: 3,
      uniqueSubjects: 2,
      subjectMedia: [
        { key: 'anime', label: 'anime', count: 2, uniqueSubjects: 1, rawCodes: [2], title: 'private title' },
        { key: 'music', label: 'music', count: 1, uniqueSubjects: 1, rawCodes: [3], name: 'private name' },
      ],
    },
    coverage: { subjects: { observed: 4, returned: 3, truncated: true, sourceCompleteness: 'undocumented' } },
    credits: { subjects: [{ id: 100, name: 'private relation title' }] },
  };

  it('projects only aggregate subject type counts and local coverage', () => {
    const summary = projectPublicPersonProfileSummary(source);
    expect(summary).toEqual({
      state: 'partial', personId: 3474, subjectCredits: 3, uniqueSubjects: 2,
      subjectRowsObserved: 4, subjectRowsReturned: 3, subjectRowsTruncated: true,
      sourceCompleteness: 'undocumented',
      subjectMedia: [
        { key: 'anime', label: 'anime', count: 2, uniqueSubjects: 1, rawCodes: [2] },
        { key: 'music', label: 'music', count: 1, uniqueSubjects: 1, rawCodes: [3] },
      ],
    });
    expect(JSON.stringify(summary)).not.toMatch(/private source name|private-image-url|private title|private name|private relation title/u);
    expect(publicPersonProfileSummaryIsConsistent(summary!, 3474, 500)).toBe(true);
  });

  it('rejects inconsistent totals, completeness claims, and missing type buckets', () => {
    const summary = projectPublicPersonProfileSummary(source)!;
    expect(publicPersonProfileSummaryIsConsistent({ ...summary, subjectCredits: 4 }, 3474, 500)).toBe(false);
    expect(publicPersonProfileSummaryIsConsistent({ ...summary, sourceCompleteness: 'complete' }, 3474, 500)).toBe(false);
    expect(publicPersonProfileSummaryIsConsistent({ ...summary, subjectMedia: [] }, 3474, 500)).toBe(false);
    expect(projectPublicPersonProfileSummary({ person: {}, summary: {}, coverage: {} })).toBeNull();
  });
});
