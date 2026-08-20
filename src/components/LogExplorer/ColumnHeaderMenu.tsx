'use client';

import { useState } from 'react';
import { cn } from '@/lib/cn';

interface ColumnHeaderMenuProps {
  field: string;
  index: number;
  total: number;
  onMove: (field: string, direction: -1 | 1) => void;
  onRemove: (field: string) => void;
}

const ITEM_CLASS =
  'block w-full px-3 py-1.5 text-left text-xs text-slate-200 hover:bg-mango-500/15 disabled:cursor-not-allowed disabled:text-slate-500 disabled:hover:bg-transparent';

/**
 * Layout adjustments without a trip back to the field panel — the flyout is for
 * choosing what to look at, this is for arranging what you already chose.
 */
export function ColumnHeaderMenu({ field, index, total, onMove, onRemove }: ColumnHeaderMenuProps) {
  const [open, setOpen] = useState(false);

  function act(run: () => void) {
    run();
    setOpen(false);
  }

  return (
    <span className="relative inline-block">
      <button
        type="button"
        aria-label={`Column options for ${field}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          'px-1 text-mango-300/60 hover:text-mango-300',
          open && 'text-mango-300'
        )}
      >
        <span aria-hidden="true">⋮</span>
      </button>

      {open && (
        <span
          role="menu"
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.stopPropagation();
              setOpen(false);
            }
          }}
          className="absolute right-0 top-full z-20 mt-1 block w-40 border border-white/15 bg-scene-focal py-1 shadow-panel"
        >
          <button
            type="button"
            role="menuitem"
            disabled={index === 0}
            onClick={() => act(() => onMove(field, -1))}
            className={ITEM_CLASS}
          >
            Move left
          </button>
          <button
            type="button"
            role="menuitem"
            disabled={index >= total - 1}
            onClick={() => act(() => onMove(field, 1))}
            className={ITEM_CLASS}
          >
            Move right
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => act(() => onRemove(field))}
            className={ITEM_CLASS}
          >
            Remove column
          </button>
        </span>
      )}
    </span>
  );
}
