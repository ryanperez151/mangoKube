import type { ChoiceCondition, ConditionalCopy } from '@/content/types';

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
