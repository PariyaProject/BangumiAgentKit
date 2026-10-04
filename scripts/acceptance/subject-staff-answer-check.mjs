import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export function countExplicitSubjectStaffPairs(answer, pairs) {
  if (typeof answer !== 'string' || !Array.isArray(pairs)) return 0;
  const uniquePairs = new Map();
  for (const pair of pairs) {
    if (
      pair &&
      typeof pair.role === 'string' &&
      pair.role.trim() &&
      typeof pair.name === 'string' &&
      pair.name.trim()
    ) {
      uniquePairs.set(`${pair.role}\u0000${pair.name}`, pair);
    }
  }
  return [...uniquePairs.values()].filter(({ role, name }) => {
    const escapedRole = escapeRegExp(role.trim());
    const escapedName = escapeRegExp(name.trim());
    for (const sentence of answer.split(/(?<=[。！？\n])/u)) {
      if (!sentence || SENTENCE_LEVEL_DISAVOWAL.test(sentence)) continue;

      const forward = new RegExp(
        `(^|${TOKEN_BOUNDARY})(${escapedRole}) *([:：]|是|为|包括|有|由) *(${escapedName})(?=$|${TOKEN_BOUNDARY})`,
        'gu',
      );
      const reverse = new RegExp(
        `(^|${TOKEN_BOUNDARY})(${escapedName}) *(担任|负责|是) *(${escapedRole})(?=$|${TOKEN_BOUNDARY})`,
        'gu',
      );

      for (const match of sentence.matchAll(forward)) {
        const assertionStart = match.index + match[1].length;
        const assertionEnd = match.index + match[0].length;
        if (hasPositiveStatementScope(sentence, assertionStart, assertionEnd)) return true;
      }
      for (const match of sentence.matchAll(reverse)) {
        const assertionStart = match.index + match[1].length;
        const assertionEnd = match.index + match[0].length;
        if (hasPositiveStatementScope(sentence, assertionStart, assertionEnd)) return true;
      }
    }
    return false;
  }).length;
}

// This is deliberately a small declarative grammar. A matching role/name phrase
// counts only when neither its local clause nor its enclosing sentence disavows it.
const TOKEN_BOUNDARY = '[\\s,，;；。！？:：、()（）]';
const CLAUSE_BOUNDARY = /[,，;；]/gu;
const PREFIX_NEGATION = /(?:不是由|并非由|不由|未由|并不是|不是|并非|没有|不曾|未曾|并未|不再|不确定|未证实|未经证实|无法确认|不能确认|尚不清楚|否认|非|未|不)/u;
const LOCAL_DISAVOWAL = /(?:错误|错(?:误|的)?|不正确|不对|不成立|不实|不属实|不是事实|并非事实|不确定|未证实|未经证实|无法确认|不能确认|尚不清楚)/u;
const PARENTHETICAL_DISAVOWAL = /[（(][^（）()]{0,64}(?:错误|错(?:误|的)?|不正确|不对|不成立|不实|不属实|不是事实|并非事实|未证实|未经证实|无法确认|不能确认)[^（）()]{0,64}[）)]/u;
const SENTENCE_LEVEL_DISAVOWAL = /(?:(?:这两项|两项|上述(?:两项)?|前述(?:两项)?|以上(?:两项)?|这些)?(?:说法|说辞|对应关系|关系|映射|断言)(?:全都|都|均)?(?:是)?(?:不正确|错误|不对|不成立|不实|错的)|(?:这两项|上述两项|前述两项|以上两项)(?:说法|关系|映射|断言)?都(?:不正确|错误|不对|不成立|不实))/u;

function hasPositiveStatementScope(sentence, assertionStart, assertionEnd) {
  const prefix = sentence.slice(findClauseStart(sentence, assertionStart), assertionStart).trim();
  const suffix = sentence.slice(assertionEnd, findClauseEnd(sentence, assertionEnd));
  return (
    !PREFIX_NEGATION.test(prefix) &&
    !LOCAL_DISAVOWAL.test(suffix) &&
    !PARENTHETICAL_DISAVOWAL.test(suffix)
  );
}

function findClauseStart(sentence, index) {
  CLAUSE_BOUNDARY.lastIndex = 0;
  let clauseStart = 0;
  for (const match of sentence.matchAll(CLAUSE_BOUNDARY)) {
    const boundaryEnd = match.index + match[0].length;
    if (boundaryEnd > index) break;
    clauseStart = boundaryEnd;
  }
  return clauseStart;
}

function findClauseEnd(sentence, index) {
  CLAUSE_BOUNDARY.lastIndex = 0;
  for (const match of sentence.matchAll(CLAUSE_BOUNDARY)) {
    if (match.index >= index) return match.index;
  }
  return sentence.length;
}

function escapeRegExp(value) {
  const escapeCharacter = String.fromCharCode(92);
  const specialCharacters = new Set([
    escapeCharacter,
    '^',
    '$',
    '.',
    '|',
    '?',
    '*',
    '+',
    '(',
    ')',
    '[',
    ']',
    '{',
    '}',
  ]);
  return Array.from(value, (character) =>
    specialCharacters.has(character) ? escapeCharacter + character : character,
  ).join('');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const input = JSON.parse(readFileSync(0, 'utf8'));
  const roleNamePairsMatchedCount = countExplicitSubjectStaffPairs(input.answer, input.pairs);
  process.stdout.write(JSON.stringify({ roleNamePairsMatchedCount }));
}
