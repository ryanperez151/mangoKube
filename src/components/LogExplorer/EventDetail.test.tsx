import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventDetail } from './EventDetail';
import type { LogEvent } from '@/content/types';

const event: LogEvent = {
  id: 'e1',
  timestamp: '2026-08-12T02:14:03Z',
  source: 'edr',
  message: 'Interactive shell spawned',
  fields: { pod: 'ci-deploy-bot-7f9c4d6b6-x2k1p', severity: 'high' },
  arrivesAtStage: 0,
  revealsFact: 'evidence-interactive-shell',
  analystNote: 'Build agents do not run interactive shells.',
};

describe('EventDetail', () => {
  it('prompts the player to select an event when none is selected', () => {
    render(<EventDetail event={null} isPinned={false} onPin={() => {}} onUnpin={() => {}} />);
    expect(screen.getByTestId('no-selection')).toBeInTheDocument();
  });

  it('lists every field of the selected event', () => {
    render(<EventDetail event={event} isPinned={false} onPin={() => {}} onUnpin={() => {}} />);
    expect(screen.getByText('pod')).toBeInTheDocument();
    expect(screen.getByText('ci-deploy-bot-7f9c4d6b6-x2k1p')).toBeInTheDocument();
  });

  it('hides the analyst note until the event is pinned', () => {
    render(<EventDetail event={event} isPinned={false} onPin={() => {}} onUnpin={() => {}} />);
    expect(screen.queryByTestId('analyst-note')).toBeNull();
  });

  it('shows the analyst note once pinned', () => {
    render(<EventDetail event={event} isPinned onPin={() => {}} onUnpin={() => {}} />);
    expect(screen.getByTestId('analyst-note')).toHaveTextContent(
      'Build agents do not run interactive shells.'
    );
  });

  it('pins the event', () => {
    const onPin = vi.fn();
    render(<EventDetail event={event} isPinned={false} onPin={onPin} onUnpin={() => {}} />);
    fireEvent.click(screen.getByRole('button', { name: /pin to case file/i }));
    expect(onPin).toHaveBeenCalledWith('e1');
  });

  it('unpins the event', () => {
    const onUnpin = vi.fn();
    render(<EventDetail event={event} isPinned onPin={() => {}} onUnpin={onUnpin} />);
    fireEvent.click(screen.getByRole('button', { name: /remove from case file/i }));
    expect(onUnpin).toHaveBeenCalledWith('e1');
  });

  it('never labels an event as correct or incorrect', () => {
    const { container } = render(
      <EventDetail event={event} isPinned onPin={() => {}} onUnpin={() => {}} />
    );
    expect(container.textContent?.toLowerCase()).not.toMatch(/correct|wrong|right answer/);
  });
});
