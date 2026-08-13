import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { GuidancePanel } from './GuidancePanel';
import { sentinelPrimer } from '@/content/chapter1/primer';
import type { GuidanceStep } from '@/content/types';

const guidance: GuidanceStep[] = [
  { level: 1, lines: ['Orient yourself first.'] },
  { level: 2, lines: ['Narrow to the right source.'] },
  { level: 3, lines: ['Search `source=edr severity=high`.'], insertText: 'source=edr severity=high' },
];

function renderPanel(overrides: Partial<Parameters<typeof GuidancePanel>[0]> = {}) {
  const props = {
    objective: 'Confirm the alert is real.',
    guidance,
    level: 0,
    inputTarget: 'search' as const,
    primer: sentinelPrimer,
    onReveal: vi.fn(),
    onInsert: vi.fn(),
    onReplayBriefing: vi.fn(),
    ...overrides,
  };
  render(<GuidancePanel {...props} />);
  return props;
}

describe('GuidancePanel', () => {
  it('shows the objective and hides every tier until one is revealed', () => {
    renderPanel();

    expect(screen.getByText('Confirm the alert is real.')).toBeInTheDocument();
    expect(screen.queryByTestId('guidance-tier-1')).not.toBeInTheDocument();
    expect(screen.getByText(/nothing revealed yet/i)).toBeInTheDocument();
  });

  it('stacks revealed tiers so earlier reasoning stays visible', () => {
    renderPanel({ level: 2 });

    expect(screen.getByTestId('guidance-tier-1')).toBeInTheDocument();
    expect(screen.getByTestId('guidance-tier-2')).toBeInTheDocument();
    expect(screen.queryByTestId('guidance-tier-3')).not.toBeInTheDocument();
  });

  it('requests the next tier without revealing it itself', () => {
    const { onReveal } = renderPanel({ level: 1 });

    fireEvent.click(screen.getByRole('button', { name: /reveal the next hint/i }));
    expect(onReveal).toHaveBeenCalledTimes(1);
    // The panel is controlled: the store decides what is visible.
    expect(screen.queryByTestId('guidance-tier-2')).not.toBeInTheDocument();
  });

  it('stops offering reveals once the exact answer is showing', () => {
    renderPanel({ level: 3 });

    expect(screen.getByTestId('guidance-tier-3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reveal/i })).not.toBeInTheDocument();
    expect(screen.getByText(/that is every hint for this stage/i)).toBeInTheDocument();
  });

  it('inserts the exact answer into the surface currently in play', () => {
    const { onInsert } = renderPanel({ level: 3, inputTarget: 'terminal' });

    fireEvent.click(screen.getByRole('button', { name: /insert into terminal/i }));
    expect(onInsert).toHaveBeenCalledWith('source=edr severity=high');
  });

  it('renders backticked syntax as code so exact queries stay legible', () => {
    renderPanel({ level: 3 });

    const code = screen.getByText('source=edr severity=high', { selector: 'code' });
    expect(code).toBeInTheDocument();
  });

  it('keeps the primer available as collapsed reference', () => {
    renderPanel();

    for (const section of sentinelPrimer.sections) {
      expect(screen.getByText(section.title)).toBeInTheDocument();
    }
    // Collapsed by default so guidance stays the focus of the panel.
    expect(document.querySelectorAll('details[open]')).toHaveLength(0);
  });

  it('replays the briefing on request', () => {
    const { onReplayBriefing } = renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /replay briefing/i }));
    expect(onReplayBriefing).toHaveBeenCalledTimes(1);
  });
});
