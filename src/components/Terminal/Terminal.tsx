'use client';

import { useState, type FormEvent } from 'react';
import type { TerminalEntry } from '@/content/types';

interface TerminalProps {
  history: TerminalEntry[];
  availableCommands: Array<{ description: string }>;
  onSubmit: (input: string) => void;
}

export function Terminal({ history, availableCommands, onSubmit }: TerminalProps) {
  const [value, setValue] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-black/60 p-4 font-mono text-sm">
      <div className="flex flex-col gap-2" data-testid="terminal-history">
        {history.map((entry, index) => (
          <div key={index}>
            <div className="text-mango-500">$ {entry.input}</div>
            {entry.output.map((line, lineIndex) => (
              <div key={lineIndex} className="text-mango-300">
                {line}
              </div>
            ))}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <span className="text-mango-500">$</span>
        <input
          className="flex-1 bg-transparent outline-none"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label="terminal input"
          autoComplete="off"
        />
      </form>

      {availableCommands.length > 0 && (
        <div data-testid="terminal-hints" className="text-xs text-mango-500/70">
          Available: {availableCommands.map((command) => command.description).join(' · ')}
        </div>
      )}
    </div>
  );
}
