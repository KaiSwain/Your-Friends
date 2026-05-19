import { describe, expect, it } from '@jest/globals';

import { buildMemoryPrompts } from '../memoryPrompts';

describe('buildMemoryPrompts', () => {
  it('starts empty walls with a first-memory prompt', () => {
    const prompts = buildMemoryPrompts({
      subjectName: 'Mina',
      previousMemoryCount: 0,
    });

    expect(prompts[0]).toMatchObject({
      id: 'first-memory',
      body: "I want to start Mina's wall with this memory: ",
    });
  });

  it('uses relationship tags and facts when available', () => {
    const prompts = buildMemoryPrompts({
      subjectName: 'Noah',
      facts: ['Remembers coffee orders'],
      relationshipTags: ['Best Friend'],
      previousMemoryCount: 3,
    });

    expect(prompts.map((prompt) => prompt.id)).toContain('relationship-tag');
    expect(prompts.map((prompt) => prompt.id)).toContain('fact-memory');
  });

  it('falls back safely when the subject name is blank', () => {
    const prompts = buildMemoryPrompts({ subjectName: '   ' });

    expect(prompts[0].body).toContain('them');
  });
});
