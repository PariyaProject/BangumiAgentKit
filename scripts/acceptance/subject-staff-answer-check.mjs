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
    const tokenBoundary = '[ ,，;；。！？:：、()（）]';
    const forward = new RegExp(
      `(?:^|${tokenBoundary})${escapedRole} *(?:[:：]|是|为|包括|有|由) *${escapedName}(?=$|${tokenBoundary})`,
      'u',
    );
    const reverse = new RegExp(
      `(?:^|${tokenBoundary})${escapedName} *(?:担任|负责|是) *${escapedRole}(?=$|${tokenBoundary})`,
      'gu',
    );

    if (forward.test(answer)) return true;
    for (const match of answer.matchAll(reverse)) {
      const precedingText = answer.slice(Math.max(0, match.index - 8), match.index);
      const normalizedPrefix = precedingText.trimEnd();
      if (
        !/(?:不是由|并非由|不由|未由|不是|并非|不曾|未曾|并未|不再|非|未|不)$/.test(
          normalizedPrefix,
        )
      ) {
        return true;
      }
    }
    return false;
  }).length;
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
