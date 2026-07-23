import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BriefingOverlay } from './BriefingOverlay';

describe('BriefingOverlay', () => {
  it('renders title, lines and objective', () => {
    render(
      <BriefingOverlay title="Recon" objective="Find the pod" lines={['line one', 'line two']} onDismiss={() => {}} />
    );
    expect(screen.getByText('Recon')).toBeInTheDocument();
    expect(screen.getByText('line one')).toBeInTheDocument();
    expect(screen.getByText('Objective: Find the pod')).toBeInTheDocument();
  });

  it('calls onDismiss when Begin is clicked', () => {
    const onDismiss = vi.fn();
    render(<BriefingOverlay title="Recon" objective="o" lines={[]} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('Begin'));
    expect(onDismiss).toHaveBeenCalled();
  });

  it('calls onDismiss when Escape key is pressed', () => {
    const onDismiss = vi.fn();
    render(<BriefingOverlay title="Recon" objective="o" lines={[]} onDismiss={onDismiss} />);
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalled();
  });
});
