import type { AttackTimelineEntry, LogEvent } from '@/content/types';
import { isChoiceVisible } from '@/engine/conditions';

/**
 * Pick the corpus events a step actually produced on this playthrough.
 *
 * A step whose artifact differs by decision route lists every variant. The
 * route in play wins; when no recorded decision governs any variant — the
 * Infiltrator never answers the Sentinel's containment question — the first
 * listed variant stands as canonical.
 */
export function resolveArtifacts(
  entry: AttackTimelineEntry,
  corpus: readonly LogEvent[],
  decisions: Readonly<Record<string, string>>
): LogEvent[] {
  const events = entry.artifactEventIds.flatMap((id) => {
    const event = corpus.find((candidate) => candidate.id === id);
    return event ? [event] : [];
  });
  const inPlay = events.filter((event) => isChoiceVisible(event.visibleWhen, decisions));
  return inPlay.length > 0 ? inPlay : events.slice(0, 1);
}

/**
 * Whether the Sentinel proved this step. Steps that carry no provable fact —
 * the silent ones — are never "established", which is the honest answer.
 */
export function isStepEstablished(
  entry: AttackTimelineEntry,
  collectedFacts: readonly string[]
): boolean {
  return (
    entry.sentinelFacts.length > 0 &&
    entry.sentinelFacts.every((factId) => collectedFacts.includes(factId))
  );
}
