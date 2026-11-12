import { isDeepStrictEqual } from 'node:util';
import { readFileSync } from 'node:fs';

// Output names come from checked-in public metadata, never the input envelope.
const PUBLIC_PATHS = new Map(
  JSON.parse(readFileSync(new URL('../../docs/tool-catalog.json', import.meta.url), 'utf8')).map(
    (tool) => {
      const paths = new Set();
      const visit = (schema, prefix = '', depth = 0) => {
        if (!schema || typeof schema !== 'object' || depth > 16) return;
        for (const [key, child] of Object.entries(schema.properties ?? {})) {
          const field = prefix ? `${prefix}.${key}` : key;
          paths.add(field);
          visit(child, field, depth + 1);
        }
        for (const key of ['anyOf', 'oneOf', 'allOf'])
          for (const child of schema[key] ?? []) visit(child, prefix, depth + 1);
      };
      visit(tool.inputSchema);
      return [tool.name, paths];
    },
  ),
);

export const FAILURE_OBSERVATION_LIMITS = Object.freeze({
  inputBytes: 8 * 1024 * 1024,
  lineBytes: 512 * 1024,
  events: 4096,
  calls: 8,
  fields: 32,
  depth: 4,
  outputBytes: 16384,
});

const ERROR_CODES = new Set([
  'INVALID_ARGUMENTS',
  'VALIDATION_ERROR',
  'AUTH_REQUIRED',
  'FORBIDDEN',
  'ABORTED',
  'CANCELLED',
  'TIMEOUT',
  'INTERNAL_ERROR',
  'NOT_FOUND',
  'G03_NATIVE_OPERATION_DENIED',
  'G03_NATIVE_RESULT_INVALID',
  'G03_NATIVE_FIXTURE_REQUEST_INVALID',
  'G03_NATIVE_RENDER_INVALID',
  'G03_NATIVE_CANCELLED',
  'G03_NATIVE_EXECUTION_FAILED',
  'G03_NATIVE_ARTIFACT_INVALID',
  'G03_NATIVE_OBSERVATION_FAILED',
  'G03_MODEL_CONTROL_QUERY_FAILED',
  'G03_MODEL_REVIEW_GATE_FAILED',
  'G03_MODEL_SOURCE_GATE_FAILED',
  'G03_MODEL_CLAIM_READBACK_FAILED',
  'G03_MODEL_NATIVE_CONSTRUCTION_FAILED',
  'G03_MODEL_SERVER_START_FAILED',
]);
const RPC_CODES = new Map([
  [-32700, 'RPC_PARSE_ERROR'],
  [-32600, 'RPC_INVALID_REQUEST'],
  [-32601, 'RPC_METHOD_NOT_FOUND'],
  [-32602, 'RPC_INVALID_PARAMS'],
  [-32603, 'RPC_INTERNAL_ERROR'],
]);
const PHASES = new Set(['READY', 'RUNNING', 'QUERY_VERIFIED', 'COMPLETE', 'FAILED', 'STOPPED']);
const STAGES = new Set([
  'preflight',
  'startup',
  'tool',
  'inspection',
  'publication',
  'acknowledgement',
  'cleanup',
]);
const PROCESS_REASONS = new Map([
  ['AGENT_MCP_PROCESS_TIMED_OUT', 'timeout'],
  ['AGENT_MCP_PROCESS_OUTPUT_LIMIT', 'output_limit'],
  ['AGENT_MCP_PROCESS_SPAWN_FAILED', 'spawn_failed'],
]);
const BRANDED = new WeakSet();
const plain = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const bounded = (n, max = 10000000) => (Number.isSafeInteger(n) && n >= 0 && n <= max ? n : null);
const typeOf = (v) =>
  v === undefined ? 'missing' : v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v;
const safeCode = (v) => RPC_CODES.get(v) ?? (ERROR_CODES.has(v) ? v : null);
const equal = (a, b) => {
  try {
    return isDeepStrictEqual(a, b);
  } catch {
    return false;
  } // Hostile nesting cannot suppress the diagnostic.
};
const freeze = (v) => {
  if (v && typeof v === 'object') {
    Object.values(v).forEach(freeze);
    Object.freeze(v);
  }
  return v;
};

function policyFor(expected) {
  const name = (v) => typeof v === 'string' && /^[a-z][a-z0-9_.-]{0,95}$/u.test(v);
  if (
    !plain(expected) ||
    !name(expected.server) ||
    !Array.isArray(expected.calls) ||
    expected.calls.length < 1 ||
    expected.calls.length > FAILURE_OBSERVATION_LIMITS.calls
  )
    throw new Error('FAILURE_OBSERVATION_POLICY_INVALID');
  const calls = expected.calls.map((call) => {
    if (
      !plain(call) ||
      !name(call.toolName) ||
      !PUBLIC_PATHS.has(call.toolName) ||
      !plain(call.arguments)
    )
      throw new Error('FAILURE_OBSERVATION_POLICY_INVALID');
    let nodes = 0;
    const boundedPolicy = (v, depth = 0) => {
      if (++nodes > 256 || depth > FAILURE_OBSERVATION_LIMITS.depth + 1) return false;
      if (v === null || typeof v === 'boolean') return true;
      if (typeof v === 'number') return Number.isFinite(v);
      if (typeof v === 'string') return v.length <= 256;
      if (Array.isArray(v)) return v.length <= 16 && v.every((x) => boundedPolicy(x, depth + 1));
      return (
        plain(v) &&
        Object.keys(v).length <= FAILURE_OBSERVATION_LIMITS.fields &&
        Object.values(v).every((x) => boundedPolicy(x, depth + 1))
      );
    };
    if (!boundedPolicy(call.arguments)) throw new Error('FAILURE_OBSERVATION_POLICY_INVALID');
    const fields = [];
    const visit = (object, prefix = '', depth = 0) => {
      if (depth > FAILURE_OBSERVATION_LIMITS.depth)
        throw new Error('FAILURE_OBSERVATION_POLICY_INVALID');
      for (const key of Object.keys(object)) {
        if (
          !/^[a-zA-Z][a-zA-Z0-9_]{0,47}$/u.test(key) ||
          ['constructor', 'prototype'].includes(key)
        )
          throw new Error('FAILURE_OBSERVATION_POLICY_INVALID');
        const keys = [...(prefix ? prefix.split('.') : []), key];
        if (keys.join('.').length > 96) throw new Error('FAILURE_OBSERVATION_POLICY_INVALID');
        fields.push({
          keys,
          path: PUBLIC_PATHS.get(call.toolName).has(keys.join('.'))
            ? keys.join('.')
            : `$field${fields.length + 1}`,
          value: object[key],
        });
        if (fields.length > FAILURE_OBSERVATION_LIMITS.fields)
          throw new Error('FAILURE_OBSERVATION_POLICY_INVALID');
        if (plain(object[key])) visit(object[key], keys.join('.'), depth + 1);
      }
    };
    visit(call.arguments);
    return { name: call.toolName, arguments: call.arguments, fields };
  });
  return { server: expected.server, calls };
}

function argumentShape(args, call) {
  if (!call) return null;
  const at = (keys) =>
    keys.reduce((v, k) => (plain(v) && Object.hasOwn(v, k) ? v[k] : undefined), args);
  let unexpectedFields = 0;
  const extras = (actual, expected, depth = 0) => {
    if (!plain(actual) || depth > FAILURE_OBSERVATION_LIMITS.depth) return;
    unexpectedFields += Object.keys(actual).filter((key) => !Object.hasOwn(expected, key)).length;
    for (const key of Object.keys(expected))
      if (plain(expected[key])) extras(actual[key], expected[key], depth + 1);
  };
  extras(args, call.arguments);
  return {
    rootType: typeOf(args),
    matches: equal(args, call.arguments),
    unexpectedFields: Math.min(unexpectedFields, 10000),
    fields: call.fields.map(({ keys, path, value }) => ({
      path,
      type: typeOf(at(keys)),
      matches: equal(at(keys), value),
    })),
  };
}

function alias(object, camel, snake) {
  const c = Object.hasOwn(object, camel),
    s = Object.hasOwn(object, snake);
  return {
    value: c ? object[camel] : object[snake],
    conflict: c && s && !equal(object[camel], object[snake]),
  };
}

function resultFacts(item) {
  const result = plain(item.result) ? item.result : {};
  const error = alias(result, 'isError', 'is_error');
  const structured = alias(result, 'structuredContent', 'structured_content');
  const codes = new Set();
  const add = (v) => {
    const code = safeCode(v);
    if (code) codes.add(code);
  };
  const failed =
    error.conflict ||
    structured.conflict ||
    error.value === true ||
    item.status === 'failed' ||
    item.error != null;
  if (failed) {
    add(item.error?.code);
    if (!structured.conflict) add(structured.value?.errorCode);
    if (Array.isArray(result.content)) {
      for (const part of result.content.slice(0, 4)) {
        if (
          part?.type !== 'text' ||
          typeof part.text !== 'string' ||
          Buffer.byteLength(part.text) > 4096
        )
          continue;
        add(part.text);
        try {
          add(JSON.parse(part.text)?.errorCode);
        } catch {
          /* No raw text leaves this boundary. */
        }
      }
    }
    if (!codes.size) codes.add('UNCLASSIFIED_TOOL_ERROR');
  }
  return {
    failed,
    errorCodes: [...codes].sort(),
    aliasConflict: error.conflict || structured.conflict,
  };
}

function nativeFacts(summary) {
  const empty = {
    status: 'missing',
    reportedPhase: null,
    reportedClosed: null,
    searchRequests: null,
    detailRequests: null,
    denied: null,
  };
  if (summary === undefined || summary === null) return empty;
  if (typeof summary !== 'string') return { ...empty, status: 'invalid' };
  if (Buffer.byteLength(summary) > 65536) return { ...empty, status: 'oversize' };
  try {
    const v = JSON.parse(summary);
    if (!plain(v) || v.schema !== 'native-g03-date-png-server-summary/v1' || !plain(v.observation))
      return { ...empty, status: 'invalid' };
    const o = v.observation;
    return {
      status: 'reported',
      reportedPhase: PHASES.has(o.phase) ? o.phase : null,
      reportedClosed: typeof v.closed === 'boolean' ? v.closed : null,
      searchRequests: bounded(o.searchRequests, 2),
      detailRequests: bounded(o.detailRequests, 12),
      denied: bounded(o.denied),
    };
  } catch {
    return { ...empty, status: 'invalid' };
  }
}

/** Untrusted diagnostic input only. No dispatch, proof, retry or acceptance authority. */
export function observeAgentMcpFailure({
  expected,
  processResult = {},
  serverSummary,
  stage,
} = {}) {
  const policy = policyFor(expected);
  const raw = typeof processResult.stdout === 'string' ? processResult.stdout : '';
  const clipped = raw.slice(0, FAILURE_OBSERVATION_LIMITS.inputBytes);
  const bytes = Buffer.byteLength(clipped);
  const inputLimited =
    raw.length > FAILURE_OBSERVATION_LIMITS.inputBytes ||
    bytes > FAILURE_OBSERVATION_LIMITS.inputBytes;
  const calls = [],
    byId = new Map(),
    identities = new WeakMap();
  let malformed = 0,
    oversizeLines = 0,
    eventCount = 0,
    unknownEvents = 0,
    nonMcpItems = 0,
    errorItems = 0,
    limitReached = false;
  let threadStarted = false,
    turnStarted = false,
    turnCompleted = false,
    turnFailed = false;
  // Truncate before parsing. A boundary cut never becomes a complete stream.
  const input = inputLimited
    ? Buffer.from(clipped).subarray(0, FAILURE_OBSERVATION_LIMITS.inputBytes).toString('utf8')
    : clipped;
  let cursor = 0;
  while (cursor < input.length) {
    const end = input.indexOf('\n', cursor);
    const line = input.slice(cursor, end < 0 ? input.length : end).replace(/\r$/u, '');
    cursor = end < 0 ? input.length : end + 1;
    if (!line.trim()) continue;
    if (eventCount >= FAILURE_OBSERVATION_LIMITS.events) {
      limitReached = true;
      break;
    }
    eventCount++;
    if (Buffer.byteLength(line) > FAILURE_OBSERVATION_LIMITS.lineBytes) {
      oversizeLines++;
      continue;
    }
    let event;
    try {
      event = JSON.parse(line);
    } catch {
      malformed++;
      continue;
    }
    if (!plain(event) || typeof event.type !== 'string') {
      malformed++;
      continue;
    }
    if (event.type === 'thread.started') threadStarted = true;
    else if (event.type === 'turn.started') turnStarted = true;
    else if (event.type === 'turn.completed') turnCompleted = true;
    else if (['turn.failed', 'error'].includes(event.type)) {
      turnFailed = true;
      errorItems++;
    } else if (!['item.started', 'item.updated', 'item.completed'].includes(event.type))
      unknownEvents++;
    const item = event.item;
    if (!plain(item)) continue;
    if (item.type === 'error') {
      errorItems++;
      continue;
    }
    if (
      [
        'agent_message',
        'reasoning',
        'user_message',
        'plan_update',
        'todo_list',
        'context_compaction',
        'entered_review_mode',
        'exited_review_mode',
      ].includes(item.type)
    )
      continue;
    if (item.type !== 'mcp_tool_call') {
      nonMcpItems++;
      continue;
    }
    const id = typeof item.id === 'string' && item.id.length <= 256 ? item.id : null;
    let call = id ? byId.get(id) : null;
    if (!call) {
      if (calls.length >= FAILURE_OBSERVATION_LIMITS.calls) {
        limitReached = true;
        continue;
      }
      const expectedCall = policy.calls[calls.length];
      call = {
        ordinal: calls.length + 1,
        expectedTool: expectedCall?.name ?? null,
        serverMatches: null,
        toolMatches: null,
        arguments: null,
        state: 'started',
        completionEvents: 0,
        identityChanged: false,
        aliasConflict: false,
        errorCodes: [],
      };
      calls.push(call);
      identities.set(call, {});
      if (id) byId.set(id, call);
    }
    const identity = identities.get(call);
    for (const key of ['server', 'tool', 'arguments']) {
      if (!Object.hasOwn(item, key)) continue;
      if (Object.hasOwn(identity, key) && !equal(identity[key], item[key]))
        call.identityChanged = true;
      identity[key] = item[key];
    }
    if (Object.hasOwn(identity, 'server')) call.serverMatches = identity.server === policy.server;
    if (Object.hasOwn(identity, 'tool')) call.toolMatches = identity.tool === call.expectedTool;
    if (Object.hasOwn(identity, 'arguments'))
      call.arguments = argumentShape(identity.arguments, policy.calls[call.ordinal - 1]);
    const facts = resultFacts(item);
    call.aliasConflict ||= facts.aliasConflict;
    call.errorCodes = [...new Set([...call.errorCodes, ...facts.errorCodes])].sort();
    if (event.type === 'item.completed') {
      call.completionEvents++;
      call.state = facts.failed ? 'failed' : 'completed';
    }
    if (call.errorCodes.length) call.state = 'failed';
  }
  const producerLimited =
    processResult.reason === 'AGENT_MCP_PROCESS_OUTPUT_LIMIT' ||
    (Number.isSafeInteger(processResult.stdoutBytes) && processResult.stdoutBytes > bytes);
  const limited = inputLimited || producerLimited || limitReached || oversizeLines > 0;
  const observation = {
    schema: 'agent-mcp-failure-observation/v1',
    observationOnly: true,
    acceptanceCredit: false,
    retryAllowed: false,
    verified: { model: false, source: false, artifact: false, cleanup: false },
    reportedStage: STAGES.has(stage) ? stage : null,
    process: {
      exitCode:
        Number.isSafeInteger(processResult.exitCode) && Math.abs(processResult.exitCode) <= 255
          ? processResult.exitCode
          : null,
      reason:
        PROCESS_REASONS.get(processResult.reason) ??
        (processResult.reason == null ? null : 'unrecognized'),
      retainedStdoutBytes: Math.min(bytes, FAILURE_OBSERVATION_LIMITS.inputBytes),
      reportedStdoutBytes: bounded(processResult.stdoutBytes),
      reportedStderrBytes: bounded(processResult.stderrBytes),
    },
    stream: {
      status: limited
        ? 'limited'
        : malformed
          ? 'malformed'
          : !eventCount
            ? 'missing'
            : threadStarted && turnStarted && turnCompleted && !turnFailed && !unknownEvents
              ? 'complete'
              : 'partial',
      eventCount,
      malformed,
      oversizeLines,
      unknownEvents,
      nonMcpItems,
      errorItems,
    },
    calls,
    native: nativeFacts(serverSummary),
  };
  if (Buffer.byteLength(JSON.stringify(observation)) > FAILURE_OBSERVATION_LIMITS.outputBytes)
    throw new Error('FAILURE_OBSERVATION_OUTPUT_LIMIT');
  freeze(observation);
  BRANDED.add(observation);
  return observation;
}

export function isProducedFailureObservation(value) {
  return BRANDED.has(value);
}
