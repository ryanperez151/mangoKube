'use client';

import { forwardRef, useEffect, useId, useImperativeHandle, useRef, useState } from 'react';
import { cn } from '@/lib/cn';

interface ColumnHeaderMenuProps {
  field: string;
  index: number;
  total: number;
  onMove: (field: string, direction: -1 | 1) => void;
  onRemove: (field: string) => void;
}

export interface ColumnHeaderMenuHandle {
  /**
   * Lets `ResultsTable` refocus this trigger from outside after a sibling
   * column's Remove action. This component's own `closeAndRestoreFocus`
   * cannot be the one to land focus in that case — see the comment there —
   * so the parent, which is the thing that actually knows which `<th>`
   * survives a removal, drives focus through this instead.
   */
  focusTrigger: () => void;
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
export const ColumnHeaderMenu = forwardRef<ColumnHeaderMenuHandle, ColumnHeaderMenuProps>(
  function ColumnHeaderMenu({ field, index, total, onMove, onRemove }, forwardedRef) {
    const [open, setOpen] = useState(false);
    const popoverId = useId();
    const wrapperRef = useRef<HTMLSpanElement>(null);
    const triggerRef = useRef<HTMLButtonElement>(null);

    useImperativeHandle(forwardedRef, () => ({
      focusTrigger: () => triggerRef.current?.focus(),
    }));

    function close() {
      setOpen(false);
    }

    // Tab-then-Enter on an action is the primary keyboard path through this component,
    // not an edge case, so losing focus here would be the common case rather than a rare
    // one — mirrors the restoration Escape already does below.
    //
    // Move actions leave this `<th>` in place, so refocusing the trigger here is the
    // whole story for them. Remove is different: `run()` (`onRemove`) and this call are
    // both synchronous, so this line executes and focuses the trigger *before* React
    // processes the batched state update that removes the field and unmounts this
    // `<th>` — the focus lands, then is immediately pulled out from under it, falling
    // through to `<body>`. That transient, wrong focus is why `ResultsTable` owns a
    // second, later pass: it removes the field via its own handler, and once the
    // resulting re-render has committed, focuses the neighbouring column's trigger (via
    // `ColumnHeaderMenuHandle`) or the Time sort button. That effect runs after this
    // synchronous call, so its focus is the one that actually sticks — this call does
    // not need to special-case Remove to get a correct end state.
    function closeAndRestoreFocus() {
      close();
      triggerRef.current?.focus();
    }

    function act(run: () => void) {
      run();
      closeAndRestoreFocus();
    }

    // Focus sits on the trigger when the popover is open — it's never moved into the
    // popover — so Escape has to be caught here, not on the popover, to actually fire.
    function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
      if (event.key === 'Escape' && open) {
        event.stopPropagation();
        closeAndRestoreFocus();
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

    // Mousedown alone misses keyboard users: Tabbing straight from this popover into
    // another instance's trigger fires no mousedown anywhere, so without this a keyboard
    // user could leave two popovers open at once — the same orphaned-popover symptom the
    // outside-click listener exists to prevent, just via a different input method. This
    // does not restore focus on close (unlike closeAndRestoreFocus): focus already moved
    // somewhere on purpose here, and stealing it back would fight that navigation. A null
    // relatedTarget (focus leaving the document entirely) is treated as "outside" too,
    // since there's no evidence it stayed inside.
    useEffect(() => {
      if (!open) {
        return;
      }

      const wrapper = wrapperRef.current;
      if (!wrapper) {
        return;
      }

      // An arrow function expression (not a nested function declaration) so TypeScript
      // carries the non-null narrowing of `wrapper` from the guard above into the closure.
      const handleFocusOut = (event: FocusEvent) => {
        const next = event.relatedTarget as Node | null;
        if (!next || !wrapper.contains(next)) {
          close();
        }
      };

      wrapper.addEventListener('focusout', handleFocusOut);
      return () => wrapper.removeEventListener('focusout', handleFocusOut);
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
            'flex h-6 w-6 items-center justify-center text-mango-300/60 hover:text-mango-300',
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
);
