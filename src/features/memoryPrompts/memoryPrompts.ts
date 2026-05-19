export interface MemoryPromptInput {
  subjectName: string;
  facts?: string[];
  relationshipTags?: string[];
  previousMemoryCount?: number;
}

export interface MemoryPrompt {
  id: string;
  label: string;
  body: string;
}

export function buildMemoryPrompts(input: MemoryPromptInput): MemoryPrompt[] {
  const subjectName = input.subjectName.trim() || 'them';
  const facts = (input.facts ?? []).map((fact) => fact.trim()).filter(Boolean);
  const relationshipTags = (input.relationshipTags ?? []).map((tag) => tag.trim()).filter(Boolean);
  const isEmptyWall = (input.previousMemoryCount ?? 0) === 0;
  const prompts: MemoryPrompt[] = [
    {
      id: 'never-forget',
      label: 'Never forget',
      body: `One thing I never want to forget about ${subjectName} is `,
    },
    {
      id: 'small-thing',
      label: 'Tiny detail',
      body: `A tiny thing about ${subjectName} that always makes me smile is `,
    },
    {
      id: 'favorite-memory',
      label: 'Favorite memory',
      body: `One of my favorite memories with ${subjectName} is `,
    },
  ];

  if (isEmptyWall) {
    prompts.unshift({
      id: 'first-memory',
      label: 'First memory',
      body: `I want to start ${subjectName}'s wall with this memory: `,
    });
  }

  if (relationshipTags[0]) {
    prompts.push({
      id: 'relationship-tag',
      label: relationshipTags[0],
      body: `The thing that makes ${subjectName} such a good ${relationshipTags[0].toLowerCase()} is `,
    });
  }

  if (facts[0]) {
    prompts.push({
      id: 'fact-memory',
      label: 'Use a fact',
      body: `${subjectName} ${facts[0].charAt(0).toLowerCase()}${facts[0].slice(1)}. It reminds me of `,
    });
  }

  return dedupePrompts(prompts).slice(0, 6);
}

function dedupePrompts(prompts: MemoryPrompt[]) {
  const seen = new Set<string>();
  return prompts.filter((prompt) => {
    if (seen.has(prompt.id)) return false;
    seen.add(prompt.id);
    return true;
  });
}
