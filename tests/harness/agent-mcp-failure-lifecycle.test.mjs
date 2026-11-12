import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { runNativePageProcess } from '../../scripts/acceptance/run-native-entity-page-model.mjs';
import { main as observeStdin } from '../../scripts/acceptance/observe-agent-mcp-failure.mjs';
import {
  G03_MODEL_PROFILE as P,
  G03_MODEL_SERVER_ID as SERVER,
} from '../../scripts/lib/native-g03-date-png-profile.mjs';

// A Node fixture, never Codex, a model, MCP server, or external service.
const WORKER = `
import fs from 'node:fs';
import path from 'node:path';
const [directory,mode,server,tool,args]=process.argv.slice(1);
const secret='PRIVATE_SYNTHETIC_CONTENT_NEVER_PUBLISH';
const errorCode=mode==='cancel'?'G03_NATIVE_CANCELLED':'G03_NATIVE_RESULT_INVALID';
if(mode!=='summary-loss') fs.writeFileSync(path.join(directory,'summary.json'),JSON.stringify({
 schema:'native-g03-date-png-server-summary/v1',closed:!['timeout','output'].includes(mode),
 observation:{phase:['timeout','output'].includes(mode)?'RUNNING':'FAILED',searchRequests:1,detailRequests:0,denied:1},private:secret
}));
const events=[{type:'thread.started'},{type:'turn.started'},
 {type:'item.completed',item:{type:'mcp_tool_call',id:'call',server,tool,arguments:JSON.parse(args),status:'completed',result:{isError:true,structuredContent:{errorCode,private:secret},content:[{type:'text',text:secret}]}}},
 {type:'item.completed',item:{type:'agent_message',text:secret}}];
if(!['timeout','output'].includes(mode))events.push({type:'turn.completed'});
process.stderr.write(secret);
process.stdout.write(events.map(x=>JSON.stringify(x)).join('\\n')+'\\n',()=>{
 if(mode==='output') process.stdout.write('x'.repeat(65536));
 if(['timeout','output'].includes(mode))setInterval(()=>{},1000);
});
`;

function environment() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bgk-failure-lifecycle-'));
  const executionDirectory = path.join(root, 'execution'),
    directory = path.join(root, 'retained');
  fs.mkdirSync(executionDirectory, { mode: 0o700 });
  fs.mkdirSync(directory, { mode: 0o700 });
  return {
    root,
    executionDirectory,
    directory,
    close: () => fs.rmSync(root, { recursive: true, force: true }),
  };
}

for (const mode of ['tool-error', 'cancel', 'timeout', 'output', 'summary-loss', 'ack-failure']) {
  test(
    `offline owned-process ${mode} publishes safe diagnostics before cleanup`,
    { timeout: 10000 },
    async () => {
      const d = environment();
      let observation,
        acknowledged = false;
      try {
        const processResult = await runNativePageProcess(
          process.execPath,
          [
            '--input-type=module',
            '-e',
            WORKER,
            d.executionDirectory,
            mode,
            SERVER,
            P.toolName,
            JSON.stringify(P.calls[0].arguments),
          ],
          { timeoutMs: mode === 'timeout' ? 3000 : 5000, maxStdout: 8192 },
        );
        const summaryFile = path.join(d.executionDirectory, 'summary.json');
        const serverSummary = fs.existsSync(summaryFile)
          ? fs.readFileSync(summaryFile, 'utf8')
          : null;
        try {
          observation = await observeStdin(
            ['--output-directory', d.directory, '--execution-directory', d.executionDirectory],
            Readable.from([
              JSON.stringify({
                expected: { server: SERVER, calls: P.calls },
                processResult,
                serverSummary,
                stage: mode === 'ack-failure' ? 'acknowledgement' : 'tool',
              }),
            ]),
          );
          if (mode === 'ack-failure') throw new Error('SYNTHETIC_ACK_FAILED');
          acknowledged = true;
        } catch (error) {
          assert.equal(mode, 'ack-failure');
          assert.equal(error.message, 'SYNTHETIC_ACK_FAILED');
        } finally {
          fs.rmSync(d.executionDirectory, { recursive: true });
        }
        const bytes = fs.readFileSync(
          path.join(d.directory, 'agent-mcp-failure-observation.json'),
          'utf8',
        );
        const retained = JSON.parse(bytes);
        assert.deepEqual(retained, observation);
        assert.equal(bytes.includes('PRIVATE_SYNTHETIC'), false);
        assert.equal(fs.existsSync(d.executionDirectory), false);
        assert.equal(retained.acceptanceCredit, false);
        assert.equal(retained.retryAllowed, false);
        assert.equal(retained.verified.cleanup, false);
        assert.equal(retained.verified.artifact, false);
        assert.deepEqual(retained.calls[0].errorCodes, [
          mode === 'cancel' ? 'G03_NATIVE_CANCELLED' : 'G03_NATIVE_RESULT_INVALID',
        ]);
        assert.equal(acknowledged, mode !== 'ack-failure');
        if (mode === 'timeout') assert.equal(retained.process.reason, 'timeout');
        if (mode === 'output') assert.equal(retained.process.reason, 'output_limit');
        if (mode === 'summary-loss') assert.equal(retained.native.status, 'missing');
        if (['timeout', 'output'].includes(mode)) {
          assert.equal(retained.native.reportedPhase, 'RUNNING');
          assert.equal(retained.native.reportedClosed, false);
          assert.notEqual(retained.stream.status, 'complete');
        }
      } finally {
        d.close();
      }
    },
  );
}

test('spawn failure remains observable without inventing a tool call or native cleanup', async () => {
  const d = environment();
  try {
    const processResult = await runNativePageProcess(
      path.join(d.executionDirectory, 'no-such-executable'),
      [],
      { timeoutMs: 1000, maxStdout: 8192 },
    );
    const o = await observeStdin(
      [],
      Readable.from([
        JSON.stringify({
          expected: { server: SERVER, calls: P.calls },
          processResult,
          stage: 'startup',
        }),
      ]),
    );
    assert.equal(o.process.reason, 'spawn_failed');
    assert.equal(o.process.exitCode, null);
    assert.deepEqual(o.calls, []);
    assert.equal(o.native.status, 'missing');
    assert.equal(o.verified.cleanup, false);
    assert.equal(o.retryAllowed, false);
  } finally {
    d.close();
  }
});

test('publication failure is explicit and leaves the first receipt unchanged through cleanup', async () => {
  const d = environment();
  try {
    const target = path.join(d.directory, 'agent-mcp-failure-observation.json');
    fs.writeFileSync(target, 'FIRST_RESULT_DO_NOT_REPLACE', { mode: 0o600 });
    const input = JSON.stringify({
      expected: { server: SERVER, calls: P.calls },
      processResult: {},
      stage: 'publication',
    });
    try {
      await assert.rejects(
        observeStdin(
          ['--output-directory', d.directory, '--execution-directory', d.executionDirectory],
          Readable.from([input]),
        ),
        /PUBLICATION_FAILED/u,
      );
    } finally {
      fs.rmSync(d.executionDirectory, { recursive: true });
    }
    assert.equal(fs.readFileSync(target, 'utf8'), 'FIRST_RESULT_DO_NOT_REPLACE');
  } finally {
    d.close();
  }
});
