import type {
  ChoiceCondition,
  ConditionalCopy,
  MissionDecision,
  PendingStageResolution,
} from '@/content/types';

export function canChooseDecision(
  decision: MissionDecision | undefined,
  stageId: string | undefined,
  pendingStageResolution: PendingStageResolution | null,
  decisions: Readonly<Record<string, string>>
): boolean {
  if (!decision || !stageId || decisions[decision.id]) return false;
  if (decision.timing === 'before-stage') return pendingStageResolution === null;
  return pendingStageResolution?.stageId === stageId;
}

/**
 * Conditions are intentionally data-only so content and engine callers can
 * use them without React or a store dependency.
 */
export function isChoiceVisible(
  condition: ChoiceCondition | undefined,
  decisions: Readonly<Record<string, string>>
): boolean {
  return Object.entries(condition ?? {}).every(
    ([decisionId, optionId]) => decisions[decisionId] === optionId
  );
}

export function resolveConditionalCopy(
  copy: readonly ConditionalCopy[] | undefined,
  decisions: Readonly<Record<string, string>>
): string[] {
  return (copy ?? [])
    .filter((entry) => isChoiceVisible(entry.when, decisions))
    .flatMap((entry) => entry.lines);
}
