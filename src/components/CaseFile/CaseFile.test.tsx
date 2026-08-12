import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CaseFile } from './CaseFile';
import type { Fact, LogEvent } from '@/content/types';

const pinnedEvents: LogEvent[] = [
  {
    id: 'e1',
    timestamp: '2026-08-12T02:14:03Z',
    source: 'edr',
    message: 'Interactive shell spawned',
    fields: {},
    arrivesAtStage: 0,
    revealsFact: 'f1',
    analystNote: 'Build agents do not run interactive shells.',
  },
  {
    id: 'e2',
    timestamp: '2026-08-12T02:20:00Z',
    source: 'k8s-audit',
    message: 'get configmaps',
    fields: {},
    arrivesAtStage: 0,
    analystNote: 'A workload reading its own config. Routine.',
  },
];

const facts: Fact[] = [
  { id: 'f1', label: 'Interactive shell in a build pod', detail: 'EDR caught /bin/sh.' },
];

describe('CaseFile', () => {
  it('shows the current objective', () => {
    render(
      <CaseFile objective="Confirm the alert." pinnedEvents={[]} facts={[]} onUnpin={() => {}} />
    );
    expect(screen.getByTestId('objective')).toHaveTextContent('Confirm the alert.');
  });

  it('lists established facts', () => {
    render(
      <CaseFile objective="o" pinnedEvents={pinnedEvents} facts={facts} onUnpin={() => {}} />
    );
    expect(screen.getByText('Interactive shell in a build pod')).toBeInTheDocument();
  });

  it('shows the analyst note for each pinned event', () => {
    render(
      <CaseFile objective="o" pinnedEvents={pinnedEvents} facts={facts} onUnpin={() => {}} />
    );
    expect(screen.getByText('A workload reading its own config. Routine.')).toBeInTheDocument();
  });

  it('unpins an event', () => {
    const onUnpin = vi.fn();
    render(<CaseFile objective="o" pinnedEvents={pinnedEvents} facts={facts} onUnpin={onUnpin} />);
    fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[0]);
    expect(onUnpin).toHaveBeenCalledWith('e1');
  });

  it('invites the player to start pinning when the file is empty', () => {
    render(<CaseFile objective="o" pinnedEvents={[]} facts={[]} onUnpin={() => {}} />);
    expect(screen.getByTestId('empty-case-file')).toBeInTheDocument();
  });
});
