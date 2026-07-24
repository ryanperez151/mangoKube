import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DebriefPanel } from './DebriefPanel';

describe('DebriefPanel', () => {
  it('renders narrative, lesson and teaser', () => {
    render(
      <DebriefPanel
        narrative={['The breach succeeded.']}
        lesson="Scope RBAC tightly."
        nextChapterTeaser="Next: breakout."
        onRestart={() => {}}
      />
    );
    expect(screen.getByText('The breach succeeded.')).toBeInTheDocument();
    expect(screen.getByText('Scope RBAC tightly.')).toBeInTheDocument();
    expect(screen.getByText('Next: breakout.')).toBeInTheDocument();
  });

  it('calls onRestart when the button is clicked', () => {
    const onRestart = vi.fn();
    render(<DebriefPanel narrative={[]} lesson="l" nextChapterTeaser="t" onRestart={onRestart} />);
    fireEvent.click(screen.getByText('Return to Briefing'));
    expect(onRestart).toHaveBeenCalled();
  });
});
