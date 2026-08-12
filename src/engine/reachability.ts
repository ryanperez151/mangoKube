import type { LogEvent, Stage } from '@/content/types';

interface ReachabilityOptions {
  events?: LogEvent[];
  stageIndex?: number;
}

interface SearchNode {
  facts: Set<string>;
  path: string[];
}

function advanceWhenSatisfied(stage: Stage, facts: ReadonlySet<string>): boolean {
  const required = stage.advanceWhen?.facts;
  if (!required || required.length === 0) return false;
  return required.every((factId) => facts.has(factId));
}

/**
 * Breadth-first search over every way a stage's facts can accumulate —
 * terminal commands and pinnable log events alike — looking for a state
 * that completes the stage. Returns the shortest such sequence, or null
 * if the stage is soft-locked.
 *
 * Path entries are command descriptions, or `pin <eventId>` for evidence.
 */
export function findAdvancePath(stage: Stage, options: ReachabilityOptions = {}): string[] | null {
  const stageIndex = options.stageIndex ?? 0;
  const pinnable = (options.events ?? []).filter(
    (event) => event.revealsFact !== undefined && event.arrivesAtStage <= stageIndex
  );

  const seen = new Set<string>(['']);
  const queue: SearchNode[] = [{ facts: new Set(), path: [] }];

  while (queue.length > 0) {
    const current = queue.shift()!;

    if (advanceWhenSatisfied(stage, current.facts)) return current.path;

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

    for (const event of pinnable) {
      const factId = event.revealsFact!;
      if (current.facts.has(factId)) continue;

      const nextFacts = new Set(current.facts);
      nextFacts.add(factId);
      const key = [...nextFacts].sort().join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ facts: nextFacts, path: [...current.path, `pin ${event.id}`] });
    }
  }

  return null;
}
