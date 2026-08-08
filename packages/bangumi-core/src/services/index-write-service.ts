import { GeneratedBangumiOpenApiClient, OperationBody } from '@bangumi-agent-kit/bangumi-openapi';

export interface CreateIndexResult {
  id: number;
  title: string;
  desc: string;
  partialSuccess?: boolean;
  warning?: string;
}

export class IndexWriteService {
  constructor(private client: GeneratedBangumiOpenApiClient) {}

  async createIndex(title?: string, desc?: string): Promise<CreateIndexResult> {
    const raw = await this.client.newIndex();
    const indexId = raw.id;

    if (title || desc) {
      try {
        await this.client.editIndexById(indexId, {
          title: title || `目录 ${indexId}`,
          desc: desc || '',
        } as OperationBody<'editIndexById'>);
      } catch (err: unknown) {
        return {
          id: indexId,
          title: `目录 ${indexId}`,
          desc: '',
          partialSuccess: true,
          warning: `Index ${indexId} was created, but updating title/desc failed: ${err instanceof Error ? err.message : String(err)}`,
        };
      }
    }

    return {
      id: indexId,
      title: title || `目录 ${indexId}`,
      desc: desc || '',
    };
  }

  async editIndex(indexId: number, title?: string, desc?: string): Promise<void> {
    const body: OperationBody<'editIndexById'> = {};
    if (title !== undefined) body.title = title;
    if (desc !== undefined) body.description = desc;

    await this.client.editIndexById(indexId, body);
  }

  async addSubjectToIndex(indexId: number, subjectId: number, comment?: string): Promise<void> {
    await this.client.addSubjectToIndexByIndexId(indexId, {
      subject_id: subjectId,
      comment,
    } as OperationBody<'addSubjectToIndexByIndexId'>);
  }

  async removeSubjectFromIndex(indexId: number, subjectId: number): Promise<void> {
    await this.client.delelteSubjectFromIndexByIndexIdAndSubjectID(indexId, subjectId);
  }

  async collectIndex(indexId: number): Promise<void> {
    await this.client.collectIndexByIndexIdAndUserId(indexId);
  }

  async uncollectIndex(indexId: number): Promise<void> {
    await this.client.uncollectIndexByIndexIdAndUserId(indexId);
  }
}
