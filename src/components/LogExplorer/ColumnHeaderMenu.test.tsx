import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ColumnHeaderMenu } from './ColumnHeaderMenu';

function renderMenu(overrides: Partial<React.ComponentProps<typeof ColumnHeaderMenu>> = {}) {
  const props = {
    field: 'user',
    index: 1,
    total: 3,
    onMove: vi.fn(),
    onRemove: vi.fn(),
    ...overrides,
  };
  render(<ColumnHeaderMenu {...props} />);
  return props;
}

function openMenu() {
  const trigger = screen.getByRole('button', { name: /column options for user/i });
  fireEvent.click(trigger);
  return trigger;
}

// The popover has no accessible role of its own (deliberately — see the component
// comment), so tests locate it by the id the trigger's aria-controls points at.
function getPopover(trigger: HTMLElement) {
  const id = trigger.getAttribute('aria-controls');
  if (!id) {
    throw new Error('trigger has no aria-controls');
  }
  return document.getElementById(id);
}

describe('ColumnHeaderMenu', () => {
  it('keeps the menu closed until asked', () => {
    renderMenu();
    const trigger = screen.getByRole('button', { name: /column options for user/i });
    expect(getPopover(trigger)).toBeNull();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the menu', () => {
    renderMenu();
    const trigger = openMenu();
    expect(getPopover(trigger)).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });

  it('does not claim menu semantics it does not implement', () => {
    renderMenu();
    const trigger = openMenu();
    expect(trigger).not.toHaveAttribute('aria-haspopup');
    expect(getPopover(trigger)).not.toHaveAttribute('role');
    expect(screen.getByRole('button', { name: /move left/i })).not.toHaveAttribute('role');
  });

  it('moves the column left', () => {
    const props = renderMenu();
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: /move left/i }));
    expect(props.onMove).toHaveBeenCalledWith('user', -1);
  });

  it('moves the column right', () => {
    const props = renderMenu();
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: /move right/i }));
    expect(props.onMove).toHaveBeenCalledWith('user', 1);
  });

  it('removes the column', () => {
    const props = renderMenu();
    openMenu();
    fireEvent.click(screen.getByRole('button', { name: /remove column/i }));
    expect(props.onRemove).toHaveBeenCalledWith('user');
  });

  it('disables moving past either edge', () => {
    renderMenu({ index: 0, total: 1 });
    openMenu();
    expect(screen.getByRole('button', { name: /move left/i })).toBeDisabled();
    expect(screen.getByRole('button', { name: /move right/i })).toBeDisabled();
  });

  it('closes after an action', () => {
    renderMenu();
    const trigger = openMenu();
    fireEvent.click(screen.getByRole('button', { name: /move left/i }));
    expect(getPopover(trigger)).toBeNull();
  });

  it('closes on Escape pressed on the trigger, and returns focus to the trigger', () => {
    renderMenu();
    const trigger = openMenu();
    // The realistic focus position: opening the popover never moves focus off the
    // trigger, so this is where Escape actually has to be handled to do anything.
    trigger.focus();
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(getPopover(trigger)).toBeNull();
    expect(trigger).toHaveFocus();
  });

  it('closes on a click outside the component', () => {
    renderMenu();
    const trigger = openMenu();
    fireEvent.mouseDown(document.body);
    expect(getPopover(trigger)).toBeNull();
  });

  it('does not close on a click inside the popover', () => {
    renderMenu();
    const trigger = openMenu();
    const popover = getPopover(trigger);
    fireEvent.mouseDown(popover as HTMLElement);
    expect(getPopover(trigger)).toBeInTheDocument();
  });

  it('removes the outside-click listener once the popover closes', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    renderMenu();
    const trigger = openMenu();

    const addedHandler = addSpy.mock.calls.find(([type]) => type === 'mousedown')?.[1];
    expect(addedHandler).toBeDefined();

    fireEvent.mouseDown(document.body);
    expect(getPopover(trigger)).toBeNull();
    expect(removeSpy).toHaveBeenCalledWith('mousedown', addedHandler);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });

  it('removes the outside-click listener on unmount', () => {
    const addSpy = vi.spyOn(document, 'addEventListener');
    const removeSpy = vi.spyOn(document, 'removeEventListener');
    const { unmount } = render(
      <ColumnHeaderMenu field="user" index={1} total={3} onMove={vi.fn()} onRemove={vi.fn()} />
    );
    fireEvent.click(screen.getByRole('button', { name: /column options for user/i }));

    const addedHandler = addSpy.mock.calls.find(([type]) => type === 'mousedown')?.[1];
    expect(addedHandler).toBeDefined();

    unmount();
    expect(removeSpy).toHaveBeenCalledWith('mousedown', addedHandler);

    addSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
