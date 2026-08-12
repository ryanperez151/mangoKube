import type { AttackMapNode, AttackMapNodeState } from '@/content/types';

function satisfied(required: string[], facts: ReadonlySet<string>): boolean {
  return required.length > 0 && required.every((factId) => facts.has(factId));
}

export function deriveNodeState(
  node: AttackMapNode,
  facts: ReadonlySet<string>
): AttackMapNodeState {
  if (satisfied(node.containedByFacts, facts)) return 'contained';
  if (satisfied(node.confirmedByFacts, facts)) return 'confirmed';
  if (satisfied(node.suspectedByFacts, facts)) return 'suspected';
  return 'undiscovered';
}
