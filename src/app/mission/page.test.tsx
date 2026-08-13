import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
});
