'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ColumnPreset, LogEvent } from '@/content/types';
import {
  summarizeFieldValues,
  type FieldCatalogGroup,
  type ValueFilterMode,
} from '@/engine/logFields';
import { cn } from '@/lib/cn';
import { FieldValueList } from './FieldValueList';

interface FieldPanelProps {
  open: boolean;
  pinned: boolean;
  groups: FieldCatalogGroup[];
  /** The current result set — what the counts and value lists describe. */
  resultEvents: LogEvent[];
  selectedFields: string[];
  presets: ColumnPreset[];
  onToggleField: (field: string) => void;
  onMoveField: (field: string, direction: -1 | 1) => void;
  onApplyPreset: (preset: ColumnPreset) => void;
  onFilter: (field: string, value: string, mode: ValueFilterMode) => void;
  onTogglePinned: () => void;
  onClose: () => void;
}

const SECTION_HEADING_CLASS =
  'px-3 pt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400';

export function FieldPanel({
  open,
  pinned,
  groups,
  resultEvents,
  selectedFields,
  presets,
  onToggleField,
  onMoveField,
  onApplyPreset,
  onFilter,
  onTogglePinned,
  onClose,
}: FieldPanelProps) {
  const [filterText, setFilterText] = useState('');
  const [expandedField, setExpandedField] = useState<string | null>(null);
  const panelRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (open) panelRef.current?.focus();
  }, [open]);

  const expandedValues = useMemo(
    () => (expandedField ? summarizeFieldValues(expandedField, resultEvents) : []),
    [expandedField, resultEvents]
  );

  if (!open) return null;

  const needle = filterText.trim().toLowerCase();

  return (
    <section
      ref={panelRef}
      tabIndex={-1}
      data-testid="field-panel"
      aria-label="Field browser"
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !pinned) onClose();
      }}
      className={cn(
        'flex w-[17rem] shrink-0 flex-col overflow-y-auto border border-white/10 bg-scene-focal outline-none',
        !pinned && 'absolute inset-y-0 left-0 z-10 shadow-panel'
      )}
    >
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <h2 className="font-display text-sm font-bold uppercase tracking-[0.14em] text-slate-100">
          Fields
        </h2>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label={pinned ? 'Unpin field browser' : 'Pin field browser'}
            aria-pressed={pinned}
            onClick={onTogglePinned}
            className={cn(
              'flex h-6 w-6 items-center justify-center text-xs',
              pinned ? 'text-mango-300' : 'text-mango-300/50 hover:text-mango-300'
            )}
          >
            <span aria-hidden="true">📌</span>
          </button>
          <button
            type="button"
            aria-label="Close field browser"
            onClick={onClose}
            className="flex h-6 w-6 items-center justify-center text-xs text-mango-300/50 hover:text-mango-300"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      </div>

      <div className="px-3 py-2">
        <input
          aria-label="filter fields"
          value={filterText}
          onChange={(event) => setFilterText(event.target.value)}
          placeholder="Filter fields"
          autoComplete="off"
          spellCheck={false}
          className="w-full border border-mango-500/25 bg-black/40 px-2 py-1 font-mono text-xs text-mango-100 outline-none placeholder:text-mango-300/30"
        />
      </div>

      <h3 className={SECTION_HEADING_CLASS}>Selected fields</h3>
      <ul data-testid="selected-fields" className="px-3 py-1">
        {selectedFields.length === 0 && (
          <li className="py-1 text-[11px] text-slate-400">Time only.</li>
        )}
        {selectedFields.map((field, index) => (
          <li key={field} className="flex items-center gap-1 py-0.5">
            <span className="min-w-0 flex-1 truncate font-mono text-xs text-mango-100">{field}</span>
            <button
              type="button"
              aria-label={`Move ${field} up`}
              disabled={index === 0}
              onClick={() => onMoveField(field, -1)}
              className="flex h-6 w-6 shrink-0 items-center justify-center text-xs text-mango-300/60 hover:text-mango-300 disabled:text-slate-600"
            >
              <span aria-hidden="true">▲</span>
            </button>
            <button
              type="button"
              aria-label={`Move ${field} down`}
              disabled={index === selectedFields.length - 1}
              onClick={() => onMoveField(field, 1)}
              className="flex h-6 w-6 shrink-0 items-center justify-center text-xs text-mango-300/60 hover:text-mango-300 disabled:text-slate-600"
            >
              <span aria-hidden="true">▼</span>
            </button>
            <button
              type="button"
              aria-label={`Remove ${field} column`}
              onClick={() => onToggleField(field)}
              className="flex h-6 w-6 shrink-0 items-center justify-center text-xs text-mango-300/60 hover:text-mango-300"
            >
              <span aria-hidden="true">✕</span>
            </button>
          </li>
        ))}
      </ul>

      {presets.length > 0 && (
        <>
          <h3 className={SECTION_HEADING_CLASS}>Presets</h3>
          <div className="flex flex-wrap gap-1 px-3 py-1">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => onApplyPreset(preset)}
                className="border border-mango-500/25 bg-mango-900/40 px-2 py-1 text-[11px] text-mango-300 hover:border-mango-500/60"
              >
                {preset.label}
              </button>
            ))}
          </div>
        </>
      )}

      <h3 className={SECTION_HEADING_CLASS}>Available fields</h3>
      {groups.map((group) => {
        const visible = group.fields.filter((entry) => entry.field.toLowerCase().includes(needle));
        if (visible.length === 0) return null;

        return (
          <div key={group.id} className="px-3 py-1">
            <h4 className="py-1 font-mono text-[11px] text-slate-400">{group.label}</h4>
            <ul>
              {visible.map((entry) => (
                <li key={entry.field} data-testid={`field-${entry.field}`} className="py-0.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      aria-label={`Toggle column ${entry.field}`}
                      aria-pressed={selectedFields.includes(entry.field)}
                      disabled={entry.count === 0}
                      onClick={() => onToggleField(entry.field)}
                      className={cn(
                        'flex min-h-6 min-w-0 flex-1 items-center truncate text-left font-mono text-xs',
                        entry.count === 0
                          ? 'cursor-not-allowed text-slate-600'
                          : selectedFields.includes(entry.field)
                            ? 'text-mango-300'
                            : 'text-slate-200 hover:text-mango-300'
                      )}
                    >
                      {entry.field}
                    </button>
                    <span className="font-mono text-[10px] text-slate-400">
                      {entry.count} · {Math.round(entry.coverage * 100)}%
                    </span>
                    <button
                      type="button"
                      aria-label={`Show values for ${entry.field}`}
                      aria-expanded={expandedField === entry.field}
                      onClick={() =>
                        setExpandedField((current) => (current === entry.field ? null : entry.field))
                      }
                      className="flex h-6 w-6 shrink-0 items-center justify-center text-[10px] text-mango-300/60 hover:text-mango-300"
                    >
                      <span aria-hidden="true">{expandedField === entry.field ? '▾' : '▸'}</span>
                    </button>
                  </div>
                  {expandedField === entry.field && (
                    <FieldValueList
                      field={entry.field}
                      values={expandedValues}
                      onFilter={onFilter}
                    />
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
