'use client';

import type { FormEvent } from 'react';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  error?: string | null;
  resultCount?: number;
}

export function SearchBar({ value, onChange, onSubmit, error, resultCount }: SearchBarProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form role="search" onSubmit={handleSubmit} className="flex flex-col gap-2">
      <div className="flex items-center gap-2 rounded border border-mango-500/30 bg-black/50 px-3 py-2">
        <span aria-hidden="true" className="font-mono text-mango-500">
          &gt;
        </span>
        <input
          aria-label="search query"
          className="flex-1 bg-transparent font-mono text-sm text-mango-100 outline-none placeholder:text-mango-300/30"
          placeholder="Search fields or terms"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="submit"
          className="rounded bg-mango-500/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-mango-300 hover:bg-mango-500/30"
        >
          Search
        </button>
      </div>

      {error ? (
        <p role="alert" className="font-mono text-xs text-blight-400">
          {error}
        </p>
      ) : (
        resultCount !== undefined && (
          <p data-testid="result-count" className="font-mono text-xs text-mango-300/80">
            {resultCount} events
          </p>
        )
      )}
    </form>
  );
}
