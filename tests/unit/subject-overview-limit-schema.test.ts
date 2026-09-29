import { describe, expect, it } from 'vitest';
import { HttpClient } from '@bangumi-agent-kit/bangumi-transport';
import { createReadTools } from '@bangumi-agent-kit/tools';
import { createRenderPresentationTools } from '../../packages/tools/src/definitions/render-presentation-tools.js';

function inputFor(toolName: string) {
  const readTool = createReadTools(new HttpClient()).find((tool) => tool.name === toolName);
  const renderTool = createRenderPresentationTools({} as any, {} as any).find(
    (tool) => tool.name === toolName,
  );
  const tool = readTool || renderTool;
  if (!tool) throw new Error(`Tool ${toolName} was not registered`);
  return tool.input;
}

describe('subject overview staff cap schemas', () => {
  it.each(['bangumi.get_subject_overview', 'bangumi.render_subject_overview'])(
    '%s accepts up to 100 staff rows and rejects larger unbounded requests',
    (toolName) => {
      const input = inputFor(toolName);

      expect(input.safeParse({ subjectId: 41529, maxStaff: 100 }).success).toBe(true);
      expect(input.safeParse({ subjectId: 41529, maxStaff: 101 }).success).toBe(false);
    },
  );
});
