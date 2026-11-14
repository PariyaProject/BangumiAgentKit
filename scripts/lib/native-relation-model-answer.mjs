import { isDeepStrictEqual } from 'node:util';
import { verifyRelationSafetyResult } from './native-relation-safety-contract.mjs';
import { RELATION_MODEL_PROFILE as P } from './native-relation-model-profile.mjs';

/** Normal JSON wire aliases only; conflicting aliases cannot borrow a valid payload. */
export function relationModelWireResult(result) {
  if (!result || typeof result !== 'object' || !Array.isArray(result.content))
    throw new Error('RELATION_MODEL_WIRE_RESULT_INVALID');
  const alias = (camel, snake) => {
    if (
      Object.hasOwn(result, camel) &&
      Object.hasOwn(result, snake) &&
      !isDeepStrictEqual(result[camel], result[snake])
    )
      throw new Error('RELATION_MODEL_WIRE_RESULT_INVALID');
    return result[camel] ?? result[snake];
  };
  const content = result.content;
  const error = alias('isError', 'is_error');
  if (
    content.length !== 1 ||
    content[0]?.type !== 'text' ||
    typeof content[0].text !== 'string' ||
    Buffer.byteLength(content[0].text) > 3600 ||
    (error !== undefined && typeof error !== 'boolean') ||
    error === true
  )
    throw new Error('RELATION_MODEL_WIRE_RESULT_INVALID');
  return JSON.parse(
    JSON.stringify({
      content,
      structuredContent: alias('structuredContent', 'structured_content') ?? null,
      isError: false,
    }),
  );
}

/** Extract only source-observed facts; no answer values are supplied to the model prompt. */
export function projectRelationModelAnswer(results) {
  if (!Array.isArray(results) || results.length !== 2)
    throw new Error('RELATION_MODEL_WIRE_RESULT_INVALID');
  const data = results.map((result, index) => {
    const wire = relationModelWireResult(result);
    const value = wire.structuredContent ?? JSON.parse(wire.content[0].text);
    verifyRelationSafetyResult(index, value);
    return value;
  });
  const [direct, order] = data;
  if (order.watchOrder.some((row, index) => row.position !== index + 1))
    throw new Error('RELATION_MODEL_WIRE_RESULT_INVALID');
  return {
    sourceSubjectId: direct.subjectId,
    directRows: direct.items.map(({ id, type, relation }) => ({ subjectId: id, type, relation })),
    steps: order.watchOrder.map(({ id, position, placement }) => ({
      subjectId: id,
      position,
      placement,
    })),
    exclusions: order.excluded.samples.map(({ id, reason }) => ({ subjectId: id, reason })),
    coverage: {
      directRowsReturned: direct.coverage.rowsReturned,
      relationRequests: order.coverage.relationRequests,
      relationRowsObserved: order.coverage.relationRowsObserved,
      detailsFetched: order.coverage.detailsFetched,
      excludedCount: order.excluded.count,
      truncated: order.coverage.truncated,
    },
    scope: {
      sourceCompleteness: direct.coverage.completeness,
      watchOrderState: order.state,
      orderAuthority: order.capabilityStates.watchOrder,
      canonicalOrderEstablished: false,
      omissionsProveAbsence: false,
    },
  };
}

export function relationModelAnswerMatches(answer, expected) {
  if (typeof answer !== 'string' || Buffer.byteLength(answer) > P.maxAnswerBytes) return false;
  try {
    return isDeepStrictEqual(JSON.parse(answer), expected);
  } catch {
    return false;
  }
}
