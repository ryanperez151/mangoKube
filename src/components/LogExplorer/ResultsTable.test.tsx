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

describe('ResultsTable', () => {
  it('renders a row per event', () => {
    render(<ResultsTable events={events} selectedId={null} pinnedIds={[]} onSelect={() => {}} />);
    expect(screen.getByText('Interactive shell spawned')).toBeInTheDocument();
    expect(screen.getByText('get configmaps')).toBeInTheDocument();
  });

  it('shows each event source', () => {
    render(<ResultsTable events={events} selectedId={null} pinnedIds={[]} onSelect={() => {}} />);
    const edr = screen.getByText('edr');
    expect(edr).toHaveClass('text-slate-300');
    expect(edr.className).not.toContain('blight');
  });

  it('selects an event when its row button is activated', () => {
    const onSelect = vi.fn();
    render(<ResultsTable events={events} selectedId={null} pinnedIds={[]} onSelect={onSelect} />);
    fireEvent.click(screen.getByRole('button', { name: /Interactive shell spawned/ }));
    expect(onSelect).toHaveBeenCalledWith('e1');
  });

  it('marks the selected row', () => {
    render(<ResultsTable events={events} selectedId="e1" pinnedIds={[]} onSelect={() => {}} />);
    expect(screen.getByTestId('row-e1')).toHaveAttribute('data-selected', 'true');
  });

  it('marks pinned rows', () => {
    render(<ResultsTable events={events} selectedId={null} pinnedIds={['e2']} onSelect={() => {}} />);
    expect(screen.getByTestId('row-e2')).toHaveAttribute('data-pinned', 'true');
  });

  it('tells the player when nothing matched', () => {
    render(<ResultsTable events={[]} selectedId={null} pinnedIds={[]} onSelect={() => {}} />);
    expect(screen.getByTestId('empty-results')).toBeInTheDocument();
  });
});
