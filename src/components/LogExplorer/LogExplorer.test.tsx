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
    onQueryChange: vi.fn(),
    onTimeRangeChange: vi.fn(),
    onPin: vi.fn(),
    onUnpin: vi.fn(),
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

  it('submits the typed query', () => {
    const props = renderExplorer();
    fireEvent.change(screen.getByLabelText('search query'), { target: { value: 'severity=low' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(props.onQueryChange).toHaveBeenCalledWith('severity=low');
  });

  it('runs a suggestion chip immediately', () => {
    const props = renderExplorer();
    fireEvent.click(screen.getByRole('button', { name: /High severity/ }));
    expect(props.onQueryChange).toHaveBeenCalledWith('severity=high');
  });

  it('shows an event detail once a row is selected', () => {
    renderExplorer();
    fireEvent.click(screen.getByRole('button', { name: /Interactive shell spawned/ }));
    expect(screen.getByRole('button', { name: /pin to case file/i })).toBeInTheDocument();
  });

  it('withholds the hint until two consecutive searches return nothing', () => {
    renderExplorer();
    const input = screen.getByLabelText('search query');

    fireEvent.change(input, { target: { value: 'severity=nonexistent' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.queryByTestId('hint')).toBeNull();

    fireEvent.change(input, { target: { value: 'severity=alsonothing' } });
    fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByTestId('hint')).toHaveTextContent('Try narrowing by severity.');
  });
});
