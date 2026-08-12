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
  let frontier: SearchNode[] = [{ facts: new Set(), path: [] }];

  while (frontier.length > 0) {
    // Every goal reachable at this depth is checked before any goal one
    // step deeper, so the returned path is genuinely the shortest.
    for (const node of frontier) {
      if (advanceWhenSatisfied(stage, node.facts)) return node.path;
    }

    const next: SearchNode[] = [];

    for (const node of frontier) {
      for (const command of stage.commands) {
        const requires = command.requiresFacts ?? [];
        if (!requires.every((factId) => node.facts.has(factId))) continue;

        const path = [...node.path, command.description];
        if (command.outcome.advances) return path;

        const nextFacts = new Set(node.facts);
        (command.outcome.revealsFacts ?? []).forEach((factId) => nextFacts.add(factId));
        const key = [...nextFacts].sort().join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ facts: nextFacts, path });
      }

      for (const event of pinnable) {
        const factId = event.revealsFact!;
        if (node.facts.has(factId)) continue;

        const nextFacts = new Set(node.facts);
        nextFacts.add(factId);
        const key = [...nextFacts].sort().join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        next.push({ facts: nextFacts, path: [...node.path, `pin ${event.id}`] });
      }
    }

    frontier = next;
  }

  return null;
}
