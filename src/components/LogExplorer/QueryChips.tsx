'use client';

import type { QuerySuggestion } from '@/content/types';

interface QueryChipsProps {
  suggestions: QuerySuggestion[];
  onSelect: (query: string) => void;
}

/**
 * Chips show the syntax they insert, not just a friendly label — the
 * point is that the player learns the query language by watching it
 * appear in the bar, then editing it.
 */
export function QueryChips({ suggestions, onSelect }: QueryChipsProps) {
  if (suggestions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.query}
          type="button"
          onClick={() => onSelect(suggestion.query)}
          className="group rounded border border-mango-500/25 bg-mango-900/40 px-3 py-1.5 text-left hover:border-mango-500/60"
        >
          <span className="block text-xs text-mango-300">{suggestion.label}</span>
          <span className="block font-mono text-[11px] text-mango-500/70">{suggestion.query}</span>
        </button>
      ))}
    </div>
  );
}
