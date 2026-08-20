import type { CommandDefinition, CommandOutcome, Stage } from '@/content/types';
import { isChoiceVisible } from './conditions';

function matchCommands(
  input: string,
  commands: readonly CommandDefinition[],
  revealedFacts: ReadonlySet<string>,
  decisions: Readonly<Record<string, string>>
): { matched: boolean; outcome: CommandOutcome | null } {
  let matched = false;

  for (const command of commands) {
    if (!isChoiceVisible(command.visibleWhen, decisions)) continue;
    if (!command.match.test(input)) continue;
    matched = true;
    const requires = command.requiresFacts ?? [];
    if (requires.every((factId) => revealedFacts.has(factId))) {
      return { matched: true, outcome: command.outcome };
    }
  }

  return { matched, outcome: null };
}

export function parseCommand(
  input: string,
  stage: Stage,
  revealedFacts: ReadonlySet<string>,
  decisions: Readonly<Record<string, string>> = {},
  ambientCommands: readonly CommandDefinition[] = []
): CommandOutcome | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const stageMatch = matchCommands(trimmed, stage.commands, revealedFacts, decisions);
  if (stageMatch.matched) return stageMatch.outcome;

  return matchCommands(trimmed, ambientCommands, revealedFacts, decisions).outcome;
}
