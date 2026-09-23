import { describe, expect, it } from 'vitest';
import { GeneratedBangumiOpenApiClient } from '@bangumi-agent-kit/bangumi-openapi';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createRawOperationTools } from '@bangumi-agent-kit/tools';

describe('legacy calendar raw operation', () => {
  it('routes getCalendar through the generated client transport', async () => {
    const requests: Array<{ url: string; method: string }> = [];
    const http = new HttpClient({
      fetchFn: async (input, init) => {
        requests.push({ url: String(input), method: init?.method || 'GET' });
        return new Response('[]', {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    const client = new GeneratedBangumiOpenApiClient(http);
    const [, , callOperation] = createRawOperationTools();

    const result = await callOperation.execute(
      { operationId: 'getCalendar' },
      { principalId: 'public-test', botInstanceId: 'test', conversationId: 'test' },
      { executionSession: { client } },
    );

    expect(result).toEqual([]);
    expect(requests).toEqual([{ url: 'https://api.bgm.tv/calendar', method: 'GET' }]);
  });
});
