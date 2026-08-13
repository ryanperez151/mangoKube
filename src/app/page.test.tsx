import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { useSimStore } from '@/engine/store';
import { chapter1Campaigns } from '@/content/chapter1';
import LandingPage from './page';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
  useSimStore.getState().resetProgress();
  localStorage.clear();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

describe('LandingPage', () => {
  it('does not mount operation actions below the desktop breakpoint', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: false,
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList
    );

    render(<LandingPage />);

    expect(screen.getByText(/larger screen/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /new operation/i })).not.toBeInTheDocument();
  });

  it('offers a new operation when there is no save', () => {
    render(<LandingPage />);

    fireEvent.click(screen.getByRole('button', { name: /new operation/i }));

    expect(push).toHaveBeenCalledWith('/campaign-select');
  });

  it('offers continue and confirms before replacing in-progress progress', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.infiltrator);
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<LandingPage />);

    fireEvent.click(screen.getByRole('button', { name: /continue operation/i }));
    expect(push).toHaveBeenCalledWith('/mission');

    push.mockReset();
    fireEvent.click(screen.getByRole('button', { name: /new operation/i }));
    expect(confirm).toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
    expect(useSimStore.getState().campaignId).toBe('infiltrator');
  });

  it('recognizes a completed persisted campaign before its campaign object rehydrates', () => {
    useSimStore.setState({
      campaign: null,
      campaignId: 'sentinel',
      stageIndex: chapter1Campaigns.sentinel.stages.length,
    });
    render(<LandingPage />);

    fireEvent.click(screen.getByRole('button', { name: /view debrief/i }));

    expect(push).toHaveBeenCalledWith('/debrief');
    expect(screen.getByRole('button', { name: /new operation/i })).toBeInTheDocument();
  });
});
