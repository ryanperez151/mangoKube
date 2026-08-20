import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ResultsTable } from './ResultsTable';
import type { LogEvent } from '@/content/types';

const events: LogEvent[] = [
  {
    id: 'e1',
    timestamp: '2026-08-12T02:14:03Z',
    source: 'edr',
    message: 'Interactive shell spawned',
    fields: { pod: 'ci-deploy-bot-7f9c4d6b6-x2k1p', severity: 'high' },
    arrivesAtStage: 0,
  },
  {
    id: 'e2',
    timestamp: '2026-08-12T02:20:00Z',
    source: 'k8s-audit',
    message: 'get configmaps',
    fields: { user: 'system:kube-scheduler' },
    arrivesAtStage: 0,
  },
];

function renderTable(overrides: Partial<React.ComponentProps<typeof ResultsTable>> = {}) {
  const props = {
    events,
    columnFields: ['source', 'message'],
    sort: { field: 'time', direction: 'desc' } as const,
    selectedId: null as string | null,
    pinnedIds: [] as string[],
    onSelect: vi.fn(),
    onSortChange: vi.fn(),
    onColumnFieldsChange: vi.fn(),
    ...overrides,
  };
  const view = render(<ResultsTable {...props} />);
  return { ...props, rerender: view.rerender };
}

describe('ResultsTable', () => {
  it('renders a row per event', () => {
    renderTable();
    expect(screen.getByText('Interactive shell spawned')).toBeInTheDocument();
    expect(screen.getByText('get configmaps')).toBeInTheDocument();
  });

  it('shows each event source', () => {
    renderTable();
    const edr = screen.getByText('edr');
    expect(edr).toHaveClass('text-slate-300');
    expect(edr.className).not.toContain('blight');
  });

  it('selects an event when its row button is activated', () => {
    const props = renderTable();
    fireEvent.click(screen.getByRole('button', { name: /Interactive shell spawned/ }));
    expect(props.onSelect).toHaveBeenCalledWith('e1');
  });

  it('selects an event when the row itself is clicked', () => {
    const props = renderTable();
    fireEvent.click(screen.getByTestId('row-e2'));
    expect(props.onSelect).toHaveBeenCalledWith('e2');
  });

  it('marks the selected row', () => {
    renderTable({ selectedId: 'e1' });
    expect(screen.getByTestId('row-e1')).toHaveAttribute('data-selected', 'true');
  });

  it('marks pinned rows', () => {
    renderTable({ pinnedIds: ['e2'] });
    expect(screen.getByTestId('row-e2')).toHaveAttribute('data-pinned', 'true');
  });

  it('tells the player when nothing matched', () => {
    renderTable({ events: [] });
    expect(screen.getByTestId('empty-results')).toBeInTheDocument();
  });

  it('renders a column per selected field', () => {
    renderTable({ columnFields: ['user', 'severity'] });
    expect(screen.getByRole('columnheader', { name: /user/i })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: /severity/i })).toBeInTheDocument();
    expect(screen.queryByText('Interactive shell spawned')).toBeNull();
  });

  it('stays selectable when the message column is removed', () => {
    const props = renderTable({ columnFields: ['user'] });
    fireEvent.click(screen.getByRole('button', { name: /Interactive shell spawned/ }));
    expect(props.onSelect).toHaveBeenCalledWith('e1');
  });

  it('shows a dash where an event does not carry the field', () => {
    renderTable({ columnFields: ['severity'] });
    expect(screen.getByTestId('row-e2')).toHaveTextContent('—');
  });

  it('always keeps the pinned time column', () => {
    renderTable({ columnFields: [] });
    expect(screen.getByRole('columnheader', { name: /time/i })).toBeInTheDocument();
  });

  it('reports the current sort to assistive technology', () => {
    renderTable({ sort: { field: 'time', direction: 'desc' } });
    expect(screen.getByRole('columnheader', { name: /time/i })).toHaveAttribute(
      'aria-sort',
      'descending'
    );
    expect(screen.getByRole('columnheader', { name: /source/i })).toHaveAttribute(
      'aria-sort',
      'none'
    );
  });

  it('sorts a newly chosen column ascending', () => {
    const props = renderTable();
    fireEvent.click(screen.getByRole('button', { name: /sort by source/i }));
    expect(props.onSortChange).toHaveBeenCalledWith({ field: 'source', direction: 'asc' });
  });

  it('flips the direction of the active column', () => {
    const props = renderTable({ sort: { field: 'source', direction: 'asc' } });
    fireEvent.click(screen.getByRole('button', { name: /sort by source/i }));
    expect(props.onSortChange).toHaveBeenCalledWith({ field: 'source', direction: 'desc' });
  });

  it('opens time descending, the way an incident feed reads', () => {
    const props = renderTable({ sort: { field: 'source', direction: 'asc' } });
    fireEvent.click(screen.getByRole('button', { name: /sort by time/i }));
    expect(props.onSortChange).toHaveBeenCalledWith({ field: 'time', direction: 'desc' });
  });

  it('removes a column from its header menu', () => {
    const props = renderTable();
    fireEvent.click(screen.getByRole('button', { name: /column options for source/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove column/i }));
    expect(props.onColumnFieldsChange).toHaveBeenCalledWith(['message']);
  });

  it('moves a column from its header menu', () => {
    const props = renderTable();
    fireEvent.click(screen.getByRole('button', { name: /column options for message/i }));
    fireEvent.click(screen.getByRole('button', { name: /move left/i }));
    expect(props.onColumnFieldsChange).toHaveBeenCalledWith(['message', 'source']);
  });

  // `onColumnFieldsChange` here is a mock, so it does not itself update
  // `columnFields` — the same pattern LogExplorer.test.tsx uses for its
  // pin/unpin test — so `rerender` stands in for the real parent (the
  // store) re-rendering with the field already gone.
  it('focuses the neighbouring trigger after removing a column', () => {
    const props = renderTable({ columnFields: ['source', 'message', 'user'] });
    fireEvent.click(screen.getByRole('button', { name: /column options for message/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove column/i }));
    props.rerender(<ResultsTable {...props} columnFields={['source', 'user']} />);
    expect(screen.getByRole('button', { name: /column options for user/i })).toHaveFocus();
  });

  it('focuses the left neighbour when the last column is removed', () => {
    const props = renderTable({ columnFields: ['source', 'message'] });
    fireEvent.click(screen.getByRole('button', { name: /column options for message/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove column/i }));
    props.rerender(<ResultsTable {...props} columnFields={['source']} />);
    expect(screen.getByRole('button', { name: /column options for source/i })).toHaveFocus();
  });

  it('focuses the Time sort button when the only column is removed', () => {
    const props = renderTable({ columnFields: ['source'] });
    fireEvent.click(screen.getByRole('button', { name: /column options for source/i }));
    fireEvent.click(screen.getByRole('button', { name: /remove column/i }));
    props.rerender(<ResultsTable {...props} columnFields={[]} />);
    expect(screen.getByRole('button', { name: /sort by time/i })).toHaveFocus();
  });
});
