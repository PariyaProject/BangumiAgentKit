import { describe, it, expect } from 'vitest';
import {
  mapSubject,
  mapSubjectType,
  mapCharacter,
  mapPerson,
  mapEpisode,
  mapEpisodeCategory,
  mapCollectionStatus,
  getCollectionStatusLabel,
} from '@bangumi-agent-kit/bangumi-core';

describe('Domain Mappers Unit Tests', () => {
  it('maps Subject with name_cn fallback and score undefined when rating missing', () => {
    const rawNoCn = {
      id: 101,
      name: 'Original Title',
      type: 2,
    };
    const mappedNoCn = mapSubject(rawNoCn);
    expect(mappedNoCn.nameCn).toBe('Original Title');
    expect(mappedNoCn.score).toBeUndefined();
    expect(mappedNoCn.rank).toBeUndefined();
    expect(mappedNoCn.type).toBe('anime');

    const rawZeroScore = {
      id: 102,
      name: 'Test',
      name_cn: '测试',
      type: 1,
      rating: { score: 0, rank: 0, total: 0 },
    };
    const mappedZeroScore = mapSubject(rawZeroScore);
    expect(mappedZeroScore.nameCn).toBe('测试');
    expect(mappedZeroScore.score).toBeUndefined();
    expect(mappedZeroScore.rank).toBeUndefined();
    expect(mapSubjectType(1)).toBe('book');
    expect(mapSubjectType(2)).toBe('anime');
    expect(mapSubjectType(3)).toBe('music');
    expect(mapSubjectType(4)).toBe('game');
    expect(mapSubjectType(6)).toBe('real');
    expect(mapSubjectType(99)).toBe('other');
  });

  it('maps Character and Person correctly', () => {
    const char = mapCharacter({ id: 10, name: 'Hitori Gotou', role_name: 'Main', type: 1 });
    expect(char.id).toBe(10);
    expect(char.name).toBe('Hitori Gotou');
    expect(char.roleName).toBe('Main');

    const person = mapPerson({ id: 20, name: 'Yoshino Aoyama', career: ['seiyu'] });
    expect(person.id).toBe(20);
    expect(person.career).toEqual(['seiyu']);
  });

  it('maps unknown episode type to "other"', () => {
    expect(mapEpisodeCategory(0)).toBe('main');
    expect(mapEpisodeCategory(1)).toBe('sp');
    expect(mapEpisodeCategory(2)).toBe('op');
    expect(mapEpisodeCategory(3)).toBe('ed');
    expect(mapEpisodeCategory(99)).toBe('other');

    const ep = mapEpisode({ id: 50, type: 99, name: 'Bonus Track' });
    expect(ep.category).toBe('other');
  });

  it('maps unknown collection status to "unknown" and NEVER silently defaults to "doing"', () => {
    expect(mapCollectionStatus(1)).toBe('wish');
    expect(mapCollectionStatus(2)).toBe('done');
    expect(mapCollectionStatus(3)).toBe('doing');
    expect(mapCollectionStatus(4)).toBe('on_hold');
    expect(mapCollectionStatus(5)).toBe('dropped');

    // Unknown status should map to "unknown", not "doing"
    expect(mapCollectionStatus(999)).toBe('unknown');
    expect(mapCollectionStatus('invalid_status')).toBe('unknown');
  });

  it('returns localized collection status labels for different subject types', () => {
    expect(getCollectionStatusLabel('anime', 'done')).toBe('看过');
    expect(getCollectionStatusLabel('real', 'done')).toBe('看过');
    expect(getCollectionStatusLabel('book', 'done')).toBe('读过');
    expect(getCollectionStatusLabel('music', 'done')).toBe('听过');
    expect(getCollectionStatusLabel('game', 'done')).toBe('玩过');

    expect(getCollectionStatusLabel('anime', 'doing')).toBe('在看');
    expect(getCollectionStatusLabel('book', 'doing')).toBe('在读');
    expect(getCollectionStatusLabel('music', 'doing')).toBe('在听');
    expect(getCollectionStatusLabel('game', 'doing')).toBe('在玩');
  });
});
