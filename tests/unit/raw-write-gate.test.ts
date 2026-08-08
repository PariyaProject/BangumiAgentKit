import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createRawOperationTools } from '@bangumi-agent-kit/tools';

describe('Raw Write Operation Gate Tests (BANGUMI_ALLOW_RAW_WRITES)', () => {
  let originalEnv: string | undefined;

  beforeEach(() => {
    originalEnv = process.env.BANGUMI_ALLOW_RAW_WRITES;
    delete process.env.BANGUMI_ALLOW_RAW_WRITES;
  });

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.BANGUMI_ALLOW_RAW_WRITES = originalEnv;
    } else {
      delete process.env.BANGUMI_ALLOW_RAW_WRITES;
    }
  });

  it('blocks non-read operations via call_operation when BANGUMI_ALLOW_RAW_WRITES is default/false', () => {
    const rawTools = createRawOperationTools();
    const callOp = rawTools.find((t) => t.name === 'bangumi.call_operation')!;

    expect(() => {
      (callOp.resolvePolicy as any)?.(
        {
          operationId: 'patchUserCollection',
          pathParams: { subject_id: 123 },
        },
        { principalId: 'p', botInstanceId: 'b', conversationId: 'c' },
      );
    }).toThrow('RAW_WRITE_OPERATION_DISABLED');
  });

  it('allows non-read operations via call_operation when BANGUMI_ALLOW_RAW_WRITES=true', () => {
    process.env.BANGUMI_ALLOW_RAW_WRITES = 'true';
    const rawTools = createRawOperationTools();
    const callOp = rawTools.find((t) => t.name === 'bangumi.call_operation')!;

    const policy = (callOp.resolvePolicy as any)?.(
      {
        operationId: 'patchUserCollection',
        pathParams: { subject_id: 123 },
      },
      { principalId: 'p', botInstanceId: 'b', conversationId: 'c' },
    );

    expect(policy?.risk).toBe('write');
    expect(policy?.actionType).toBe('call_operation_patchUserCollection');
  });
});
