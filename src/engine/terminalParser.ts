import type { CommandOutcome, Stage } from '@/content/types';
import { isChoiceVisible } from './conditions';

export function parseCommand(
  input: string,
  stage: Stage,
  revealedFacts: ReadonlySet<string>,
  decisions: Readonly<Record<string, string>> = {}
): CommandOutcome | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  for (const command of stage.commands) {
    if (!isChoiceVisible(command.visibleWhen, decisions)) continue;
    if (!command.match.test(trimmed)) continue;
    const requires = command.requiresFacts ?? [];
    if (requires.every((factId) => revealedFacts.has(factId))) {
      return command.outcome;
    }
  }
  return null;
}
