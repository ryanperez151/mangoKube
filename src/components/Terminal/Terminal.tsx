'use client';

import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import type { TerminalEntry } from '@/content/types';

interface TerminalProps {
  history: TerminalEntry[];
  availableCommands: Array<{ description: string }>;
  value: string;
  onChange: (value: string) => void;
  onSubmit: (input: string) => void;
}

export function Terminal({ history, availableCommands, value, onChange, onSubmit }: TerminalProps) {
  const [historyIndex, setHistoryIndex] = useState<number | null>(null);
  const savedDraft = useRef('');
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [history]);

  function submitCurrentCommand() {
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    onChange('');
    savedDraft.current = '';
    setHistoryIndex(null);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    submitCurrentCommand();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      submitCurrentCommand();
      return;
    }

    if (event.key === 'Tab') {
      const prefix = value.trim();
      if (!prefix) return;
      const matches = availableCommands.filter((command) =>
        command.description.toLocaleLowerCase().startsWith(prefix.toLocaleLowerCase())
      );
      if (matches.length !== 1) return;
      event.preventDefault();
      onChange(matches[0].description);
      return;
    }

    if (event.key === 'ArrowUp') {
      if (history.length === 0) return;
      event.preventDefault();
      if (historyIndex === null) savedDraft.current = value;
      const nextIndex = historyIndex === null ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIndex);
      onChange(history[nextIndex].input);
      return;
    }

    if (event.key === 'ArrowDown' && historyIndex !== null) {
      event.preventDefault();
      if (historyIndex < history.length - 1) {
        const nextIndex = historyIndex + 1;
        setHistoryIndex(nextIndex);
        onChange(history[nextIndex].input);
      } else {
        setHistoryIndex(null);
        onChange(savedDraft.current);
      }
    }
  }

  return (
    <section
      className="flex h-full min-h-0 flex-col overflow-hidden border border-white/10 bg-black/55 font-mono text-sm"
      aria-label="Command console"
    >
      <div className="border-b border-white/10 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-slate-500">
        Command transcript
      </div>
      <div
        ref={transcriptRef}
        className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4"
        data-testid="terminal-history"
      >
        {history.length === 0 && (
          <p className="text-xs leading-5 text-slate-500">Console ready. Type a command to begin.</p>
        )}
        {history.map((entry, index) => (
          <div
            key={`${entry.input}-${index}`}
            role="group"
            aria-label={`Command ${index + 1}: ${entry.input}`}
            className="border-l border-white/15 pl-3"
          >
            <div className="break-words text-mango-300">$ {entry.input}</div>
            <div className="mt-1 space-y-1 text-slate-300">
              {entry.output.map((line, lineIndex) => (
                <div key={lineIndex} className="whitespace-pre-wrap break-words">
                  {line}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-white/10 bg-black/40 px-4 py-3">
        <span className="text-mango-500" aria-hidden="true">$</span>
        <input
          className="min-w-0 flex-1 bg-transparent text-slate-100 outline-none placeholder:text-slate-600"
          value={value}
          onChange={(event) => {
            savedDraft.current = event.target.value;
            setHistoryIndex(null);
            onChange(event.target.value);
          }}
          onKeyDown={handleKeyDown}
          aria-label="terminal input"
          autoComplete="off"
          spellCheck={false}
          placeholder="Type a command"
        />
      </form>
    </section>
  );
}
