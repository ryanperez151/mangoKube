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
    suggestions: [{ label: 'High severity', query: 'severity=high' }],
    hint: 'Try narrowing by severity.',
    pinnedIds: [] as string[],
    selectedId: null as string | null,
    onQueryChange: vi.fn(),
    onTimeRangeChange: vi.fn(),
    onPin: vi.fn(),
    onUnpin: vi.fn(),
    onSelect: vi.fn(),
    onFailedAttempt: vi.fn(),
    ...overrides,
  };
  render(<LogExplorer {...props} />);
  return props;
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
});
