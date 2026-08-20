'use client';

import { useEffect, useId, useRef, useState } from 'react';
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
 *
 * This is three buttons behind a toggle, not an application menu: it claims no
 * `menu`/`menuitem` roles because it doesn't implement the arrow-key/roving-focus
 * contract those roles promise. Escape and outside-click still close it, since
 * both are ordinary popover behaviour rather than menu-specific semantics.
 */
export function ColumnHeaderMenu({ field, index, total, onMove, onRemove }: ColumnHeaderMenuProps) {
  const [open, setOpen] = useState(false);
  const popoverId = useId();
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function act(run: () => void) {
    run();
    setOpen(false);
  }

  function close() {
    setOpen(false);
  }

  // Focus sits on the trigger when the popover is open — it's never moved into the
  // popover — so Escape has to be caught here, not on the popover, to actually fire.
  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      close();
      triggerRef.current?.focus();
    }
  }

  // Outside click closes the popover; only attach the listener while it's open so a
  // closed, unmounted, or never-opened instance never carries a stray document handler.
  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        close();
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  return (
    <span ref={wrapperRef} className="relative inline-block">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Column options for ${field}`}
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={handleTriggerKeyDown}
        className={cn(
          'px-1 text-mango-300/60 hover:text-mango-300',
          open && 'text-mango-300'
        )}
      >
        <span aria-hidden="true">⋮</span>
      </button>

      {open && (
        <span
          id={popoverId}
          className="absolute right-0 top-full z-20 mt-1 block w-40 border border-white/15 bg-scene-focal py-1 shadow-panel"
        >
          <button
            type="button"
            disabled={index === 0}
            onClick={() => act(() => onMove(field, -1))}
            className={ITEM_CLASS}
          >
            Move left
          </button>
          <button
            type="button"
            disabled={index >= total - 1}
            onClick={() => act(() => onMove(field, 1))}
            className={ITEM_CLASS}
          >
            Move right
          </button>
          <button
            type="button"
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
