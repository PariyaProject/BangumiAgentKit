import crypto from 'node:crypto';
import { Storage, AuditEventRecord } from '@bangumi-agent-kit/db';

export interface AuditRecordOptions {
  principalId: string;
  bangumiAccountId?: string;
  operationId: string;
  riskLevel: 'read' | 'write' | 'destructive';
  resourceType: string;
  resourceId: string;
  changeSummary: unknown;
  confirmationId?: string;
  result: 'success' | 'failed' | 'cancelled' | 'unknown';
  requestId?: string;
}

export class AuditService {
  constructor(private storage: Storage) {}

  async recordWrite(options: AuditRecordOptions): Promise<AuditEventRecord> {
    const record: AuditEventRecord = {
      id: `aud_${crypto.randomUUID()}`,
      principalId: options.principalId,
      bangumiAccountId: options.bangumiAccountId,
      operationId: options.operationId,
      riskLevel: options.riskLevel,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      changeSummaryJson: JSON.stringify(options.changeSummary || {}),
      confirmationId: options.confirmationId,
      result: options.result,
      requestId: options.requestId,
      createdAt: new Date(),
    };

    await this.storage.appendAuditEvent(record);
    return record;
  }
}
