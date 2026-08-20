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

describe('ColumnHeaderMenu', () => {
  it('keeps the menu closed until asked', () => {
    renderMenu();
    expect(screen.queryByRole('menu')).toBeNull();
    expect(screen.getByRole('button', { name: /column options for user/i })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('opens the menu', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /column options for user/i }));
    expect(screen.getByRole('menu')).toBeInTheDocument();
  });

  it('moves the column left', () => {
    const props = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /column options for user/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /move left/i }));
    expect(props.onMove).toHaveBeenCalledWith('user', -1);
  });

  it('moves the column right', () => {
    const props = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /column options for user/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /move right/i }));
    expect(props.onMove).toHaveBeenCalledWith('user', 1);
  });

  it('removes the column', () => {
    const props = renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /column options for user/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /remove column/i }));
    expect(props.onRemove).toHaveBeenCalledWith('user');
  });

  it('disables moving past either edge', () => {
    renderMenu({ index: 0, total: 1 });
    fireEvent.click(screen.getByRole('button', { name: /column options for user/i }));
    expect(screen.getByRole('menuitem', { name: /move left/i })).toBeDisabled();
    expect(screen.getByRole('menuitem', { name: /move right/i })).toBeDisabled();
  });

  it('closes after an action', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /column options for user/i }));
    fireEvent.click(screen.getByRole('menuitem', { name: /move left/i }));
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('closes on Escape', () => {
    renderMenu();
    fireEvent.click(screen.getByRole('button', { name: /column options for user/i }));
    fireEvent.keyDown(screen.getByRole('menu'), { key: 'Escape' });
    expect(screen.queryByRole('menu')).toBeNull();
  });
});
