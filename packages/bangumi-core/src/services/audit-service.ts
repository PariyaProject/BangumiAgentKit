import { DatabaseStore, AuditEventRecord } from '@bangumi-agent-kit/db';

export interface AuditRecordOptions {
  principalId: string;
  bangumiAccountId?: string;
  operationId: string;
  riskLevel: 'read' | 'write' | 'destructive';
  resourceType: string;
  resourceId: string;
  changeSummary: unknown;
  confirmationId?: string;
  result: 'success' | 'failed' | 'cancelled';
  requestId?: string;
}

export class AuditService {
  constructor(private db: DatabaseStore) {}

  async recordWrite(options: AuditRecordOptions): Promise<AuditEventRecord> {
    const record: AuditEventRecord = {
      id: `aud_${Math.random().toString(36).slice(2, 10)}`,
      principalId: options.principalId,
      bangumiAccountId: options.bangumiAccountId,
      operationId: options.operationId,
      riskLevel: options.riskLevel,
      resourceType: options.resourceType,
      resourceId: options.resourceId,
      changeSummaryJson: JSON.stringify(options.changeSummary),
      confirmationId: options.confirmationId,
      result: options.result,
      requestId: options.requestId,
      createdAt: new Date(),
    };

    this.db.auditEvents.push(record);
    return record;
  }
}
