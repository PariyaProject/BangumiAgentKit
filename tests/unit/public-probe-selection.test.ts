import { describe, expect, it } from 'vitest';
import { selectPublicProbeNames } from '../../scripts/public-probe-selection.js';

describe('selectPublicProbeNames', () => {
  const available = ['bangumi.get_user', 'bangumi.get_collection', 'bangumi.get_subject'];

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
