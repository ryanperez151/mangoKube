import type { Stage } from '@/content/types';

export function findAdvancePath(stage: Stage): string[] | null {
  const seen = new Set<string>(['']);
  const queue: Array<{ facts: Set<string>; path: string[] }> = [{ facts: new Set(), path: [] }];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const command of stage.commands) {
      const requires = command.requiresFacts ?? [];
      if (!requires.every((factId) => current.facts.has(factId))) continue;

      const path = [...current.path, command.description];
      if (command.outcome.advances) return path;

      const nextFacts = new Set(current.facts);
      (command.outcome.revealsFacts ?? []).forEach((factId) => nextFacts.add(factId));
      const key = [...nextFacts].sort().join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ facts: nextFacts, path });
    }
  }

  return null;
}
