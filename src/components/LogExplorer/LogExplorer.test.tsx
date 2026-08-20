import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LogExplorer } from './LogExplorer';
import type { LogEvent, TimeRange } from '@/content/types';

const events: LogEvent[] = [
  {
    id: 'e1',
    timestamp: '2026-08-12T02:14:03Z',
    source: 'edr',
    message: 'Interactive shell spawned',
    fields: { severity: 'high' },
    arrivesAtStage: 0,
    revealsFact: 'f1',
    analystNote: 'note',
  },
  {
    id: 'e2',
    timestamp: '2026-08-12T02:20:00Z',
    source: 'k8s-audit',
    message: 'get configmaps',
    fields: { severity: 'low' },
    arrivesAtStage: 0,
    analystNote: 'routine',
  },
];

const ranges: TimeRange[] = [
  {
    id: 'last-1h',
    label: 'Last hour',
    startIso: '2026-08-12T02:00:00Z',
    endIso: '2026-08-12T03:00:00Z',
  },
];

function renderExplorer(overrides: Partial<React.ComponentProps<typeof LogExplorer>> = {}) {
  const props = {
    events,
    ranges,
    timeRangeId: 'last-1h',
    query: '',
    columnFields: ['source', 'message'],
    columnSort: { field: 'time', direction: 'desc' as const },
    fieldPanelPinned: false,
    presets: [{ id: 'audit-triage', label: 'Audit triage', fields: ['severity'] }],
    suggestions: [{ label: 'High severity', query: 'severity=high' }],
    hint: 'Try narrowing by severity.',
    pinnedIds: [] as string[],
    selectedId: null as string | null,
    onQueryChange: vi.fn(),
    onTimeRangeChange: vi.fn(),
    onColumnFieldsChange: vi.fn(),
    onColumnSortChange: vi.fn(),
    onFieldPanelPinnedChange: vi.fn(),
    onPin: vi.fn(),
    onUnpin: vi.fn(),
    onSelect: vi.fn(),
    onFailedAttempt: vi.fn(),
    ...overrides,
  };
  const view = render(<LogExplorer {...props} />);
  return { ...props, rerender: view.rerender };
}

describe('LogExplorer', () => {
  it('shows every event for an empty query', () => {
    renderExplorer();
    expect(screen.getByText('Interactive shell spawned')).toBeInTheDocument();
    expect(screen.getByText('get configmaps')).toBeInTheDocument();
  });

  it('filters results by the submitted query', () => {
    renderExplorer({ query: 'severity=high' });
    expect(screen.getByText('Interactive shell spawned')).toBeInTheDocument();
    expect(screen.queryByText('get configmaps')).toBeNull();
  });

  it('surfaces a parse error instead of an empty result set', () => {
    renderExplorer({ query: 'severity=' });
    expect(screen.getByRole('alert')).toHaveTextContent('Missing value for field "severity".');
  });

  it('warns about a field no event carries', () => {
    renderExplorer({ query: 'svrty=high' });
    expect(screen.getByTestId('unknown-fields')).toHaveTextContent('svrty');
  });

  it('submits the typed query and clears context selection', () => {
    const props = renderExplorer({ selectedId: 'e1' });
    fireEvent.change(screen.getByLabelText('search query'), { target: { value: 'severity=low' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(props.onQueryChange).toHaveBeenCalledWith('severity=low');
    expect(props.onSelect).toHaveBeenCalledWith(null);
  });

  it('does not expose exact-query chips or inline exact hints', () => {
    renderExplorer();
    expect(screen.queryByRole('button', { name: /high severity/i })).not.toBeInTheDocument();
    expect(screen.queryByTestId('hint')).not.toBeInTheDocument();
  });

  it('reports row selection to the shared evidence context', () => {
    const props = renderExplorer();
    fireEvent.click(screen.getByRole('button', { name: /Interactive shell spawned/ }));
    expect(props.onSelect).toHaveBeenCalledWith('e1');
  });

  it('records empty, malformed, and unknown-field submissions as failed attempts', () => {
    const props = renderExplorer();
    const input = screen.getByLabelText('search query');

    fireEvent.change(input, { target: { value: 'severity=nonexistent' } });
    fireEvent.submit(screen.getByRole('search'));
    fireEvent.change(input, { target: { value: 'severity=' } });
    fireEvent.submit(screen.getByRole('search'));
    fireEvent.change(input, { target: { value: 'svrty=high' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(props.onFailedAttempt).toHaveBeenCalledTimes(3);
  });

  it('keeps results in a fixed-height owned scroll viewport', () => {
    renderExplorer();
    expect(screen.getByTestId('result-viewport')).toHaveClass('overflow-y-auto');
    expect(screen.getByLabelText('log explorer')).toHaveClass('min-h-0');
  });

  it('opens the field browser from the edge tab', () => {
    renderExplorer();
    expect(screen.queryByTestId('field-panel')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /open field browser/i }));
    expect(screen.getByTestId('field-panel')).toBeInTheDocument();
  });

  it('keeps the field browser open when it is pinned', () => {
    renderExplorer({ fieldPanelPinned: true });
    expect(screen.getByTestId('field-panel')).toBeInTheDocument();
  });

  it('rewrites and runs the query when a value is filtered', () => {
    const props = renderExplorer({ query: 'source=edr' });
    fireEvent.click(screen.getByRole('button', { name: /open field browser/i }));
    fireEvent.click(screen.getByRole('button', { name: /show values for severity/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Filter to severity=high' }));
    expect(props.onQueryChange).toHaveBeenCalledWith('source=edr severity=high');
  });

  it('does not count a value click as a failed attempt', () => {
    const props = renderExplorer({ query: 'severity=low' });
    fireEvent.click(screen.getByRole('button', { name: /open field browser/i }));
    fireEvent.click(screen.getByRole('button', { name: /show values for severity/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Exclude severity=low' }));
    expect(props.onFailedAttempt).not.toHaveBeenCalled();
  });

  it('applies a preset to the columns', () => {
    const props = renderExplorer();
    fireEvent.click(screen.getByRole('button', { name: /open field browser/i }));
    fireEvent.click(screen.getByRole('button', { name: /audit triage/i }));
    expect(props.onColumnFieldsChange).toHaveBeenCalledWith(['severity']);
  });

  it('sorts the rendered rows by the chosen column', () => {
    renderExplorer({ columnSort: { field: 'time', direction: 'asc' } });
    const rows = screen.getAllByRole('row').slice(1);
    expect(rows[0]).toHaveAttribute('data-testid', 'row-e1');
  });

  it('leaves the field browser open as an overlay when unpinning', () => {
    // A mock onFieldPanelPinnedChange does not, by itself, change the
    // `fieldPanelPinned` prop — a real parent (the store, from Task 10)
    // would re-render with the new value, so simulate that here with
    // `rerender`. Without it this test cannot distinguish the fixed
    // handler from the buggy one described in the brief, since the panel
    // would still read as open purely from the stale `pinned` prop.
    const props = renderExplorer({ fieldPanelPinned: true });
    fireEvent.click(screen.getByRole('button', { name: /unpin field browser/i }));
    expect(props.onFieldPanelPinnedChange).toHaveBeenCalledWith(false);
    props.rerender(<LogExplorer {...props} fieldPanelPinned={false} />);
    expect(screen.getByTestId('field-panel')).toBeInTheDocument();
  });
});
