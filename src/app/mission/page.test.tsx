import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useSimStore } from '@/engine/store';
import { chapter1Campaigns } from '@/content/chapter1';
import MissionPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

beforeEach(() => {
  useSimStore.getState().resetProgress();
  localStorage.clear();
});

describe('MissionPage', () => {
  it('shows the stage briefing first, then the terminal after dismissal', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.infiltrator);
    render(<MissionPage />);

    expect(screen.getByText('Recon')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Begin'));

    expect(screen.getByLabelText('terminal input')).toBeInTheDocument();
  });

  it('advances the stage in the store when the player runs the full recon command sequence', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.infiltrator);
    render(<MissionPage />);
    fireEvent.click(screen.getByText('Begin'));

    const input = screen.getByLabelText('terminal input');
    fireEvent.change(input, { target: { value: 'kubectl get pods' } });
    fireEvent.submit(input.closest('form')!);
    fireEvent.change(input, { target: { value: 'kubectl auth can-i --list' } });
    fireEvent.submit(input.closest('form')!);
    fireEvent.change(input, {
      target: { value: 'cat /var/run/secrets/kubernetes.io/serviceaccount/token' },
    });
    fireEvent.submit(input.closest('form')!);

    expect(useSimStore.getState().stageIndex).toBe(1);
  });
});
