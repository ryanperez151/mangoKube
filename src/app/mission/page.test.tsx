import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
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

describe('MissionPage — Infiltrator', () => {
  it('marks the current standalone briefing seen before entering the workspace', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.infiltrator);
    render(<MissionPage />);

    expect(screen.getByRole('main', { name: /operation briefing/i })).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Begin' }));

    expect(useSimStore.getState().seenBriefingIds).toContain('recon');
    expect(screen.getByLabelText('terminal input')).toBeInTheDocument();
  });

  it('can replay an already-seen briefing from the workspace', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.infiltrator);
    useSimStore.getState().markBriefingSeen('recon');
    render(<MissionPage />);

    fireEvent.click(screen.getByRole('button', { name: /replay briefing/i }));

    expect(screen.getByRole('main', { name: /operation briefing/i })).toBeInTheDocument();
  });

  it('shows the stage briefing first, then the terminal after dismissal', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.infiltrator);
    render(<MissionPage />);

    expect(screen.getByText('Recon')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Begin'));

    expect(screen.getByLabelText('terminal input')).toBeInTheDocument();
  });

  it('holds a completed recon sequence for explicit continuation', () => {
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

    expect(useSimStore.getState().stageIndex).toBe(0);
    expect(useSimStore.getState().pendingStageResolution).toEqual({ stageId: 'recon' });
  });

  it('does not show a log explorer for a campaign with no corpus', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.infiltrator);
    render(<MissionPage />);
    fireEvent.click(screen.getByText('Begin'));
    expect(screen.queryByLabelText('log explorer')).toBeNull();
  });

  it('does not show a case file for a campaign with no log explorer', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.infiltrator);
    render(<MissionPage />);
    fireEvent.click(screen.getByText('Begin'));
    expect(screen.queryByLabelText('case file')).toBeNull();
  });

  it('still shows the stage objective without a case file', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.infiltrator);
    render(<MissionPage />);
    fireEvent.click(screen.getByText('Begin'));
    expect(
      screen.getByText('Find where the implant landed and what it can do.')
    ).toBeInTheDocument();
  });
});

describe('MissionPage — Sentinel', () => {
  beforeEach(() => {
    useSimStore.getState().startCampaign(chapter1Campaigns.sentinel);
  });

  it('opens on the log explorer, attack map, and case file', () => {
    render(<MissionPage />);
    fireEvent.click(screen.getByText('Begin'));

    expect(screen.getByLabelText('log explorer')).toBeInTheDocument();
    expect(screen.getByLabelText('attack path map')).toBeInTheDocument();
    expect(screen.getByLabelText('case file')).toBeInTheDocument();
  });

  it('withholds the terminal until a stage has response commands', () => {
    render(<MissionPage />);
    fireEvent.click(screen.getByText('Begin'));
    expect(screen.queryByLabelText('terminal input')).toBeNull();
  });

  it('holds triage completion for explicit continuation when both signal events are pinned', () => {
    render(<MissionPage />);
    fireEvent.click(screen.getByText('Begin'));

    act(() => {
      useSimStore.getState().pinEvent('sig-shell-spawn');
      useSimStore.getState().pinEvent('sig-exec-create');
    });

    expect(useSimStore.getState().stageIndex).toBe(0);
    expect(useSimStore.getState().pendingStageResolution).toEqual({ stageId: 'triage' });
  });

  it('still shows the case file for a campaign with a log explorer', () => {
    render(<MissionPage />);
    fireEvent.click(screen.getByText('Begin'));
    expect(screen.getByLabelText('case file')).toBeInTheDocument();
  });

  it('shows the terminal once the containment stage is reached', () => {
    const store = useSimStore.getState();
    act(() => {
      store.pinEvent('sig-shell-spawn');
      store.pinEvent('sig-exec-create');
      useSimStore.getState().continueFromResolution();
      useSimStore.getState().pinEvent('sig-sa-out-of-scope');
      useSimStore.getState().pinEvent('sig-binding-in-effect');
      useSimStore.getState().pinEvent('sig-binding-origin');
      useSimStore.getState().continueFromResolution();
      useSimStore.getState().chooseDecision('containment-timing', 'hunt-first');
      useSimStore.getState().pinEvent('sig-secret-read');
      useSimStore.getState().pinEvent('sig-exfil-egress');
      useSimStore.getState().continueFromResolution();
      useSimStore.getState().pinEvent('sig-rogue-sa');
      useSimStore.getState().pinEvent('sig-rogue-binding');
      useSimStore.getState().continueFromResolution();
    });

    expect(useSimStore.getState().stageIndex).toBe(4);

    render(<MissionPage />);
    fireEvent.click(screen.getByText('Begin'));
    expect(screen.getByLabelText('terminal input')).toBeInTheDocument();
  });

  it('locks a stage decision to a valid option and focuses its consequence', () => {
    act(() => {
      useSimStore.setState({ stageIndex: 2, pendingStageResolution: null });
      useSimStore.getState().markBriefingSeen('scope');
    });
    render(<MissionPage />);

    expect(screen.queryByRole('button', { name: /continue/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /hunt persistence/i }));

    expect(useSimStore.getState().decisions).toEqual({ 'containment-timing': 'hunt-first' });
    const consequence = screen.getByRole('status');
    expect(consequence).toHaveTextContent(/preserve the entry path/i);
    expect(document.activeElement).toBe(consequence);
  });

  it('continues a pending resolution, resolves conditional copy, and focuses the next scene', async () => {
    act(() => {
      useSimStore.setState({
        stageIndex: 2,
        decisions: { 'containment-timing': 'hunt-first' },
        pendingStageResolution: { stageId: 'scope' },
      });
    });
    render(<MissionPage />);

    expect(screen.getByText(/hold the primary binding/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue operation/i }));

    expect(useSimStore.getState().stageIndex).toBe(3);
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('heading', { name: 'Hunt Persistence' })
      );
    });
  });

  it('renders the briefing without entrance motion when reduced motion is preferred', () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query === '(min-width: 1024px)' || query === '(prefers-reduced-motion: reduce)',
          media: query,
          onchange: null,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          addListener: vi.fn(),
          removeListener: vi.fn(),
          dispatchEvent: vi.fn(),
        }) as MediaQueryList
    );
    render(<MissionPage />);

    expect(screen.getByRole('main', { name: /operation briefing/i })).toHaveAttribute(
      'data-motion',
      'reduced'
    );
  });
});
