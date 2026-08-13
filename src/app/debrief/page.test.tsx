import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { chapter1Campaigns } from '@/content/chapter1';
import { useSimStore } from '@/engine/store';
import DebriefPage from './page';

const push = vi.fn();
const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push, replace }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
  replace.mockReset();
  localStorage.clear();
  useSimStore.getState().resetProgress();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

function complete(role: 'sentinel' | 'infiltrator', optionId: string) {
  const campaign = chapter1Campaigns[role];
  const decision = campaign.stages.find((stage) => stage.decision)?.decision;
  useSimStore.setState({
    campaign,
    campaignId: role,
    stageIndex: campaign.stages.length,
    decisions: decision ? { [decision.id]: optionId } : {},
    collectedFacts: Object.keys(campaign.factLibrary),
    clusterStatus: role === 'sentinel' ? 'contained' : 'compromised',
  });
}

describe('DebriefPage', () => {
  it('resolves the cinematic outcome through the Sentinel decision and established attack chain', () => {
    complete('sentinel', 'hunt-first');
    render(<DebriefPage />);

    expect(screen.getByText(/evidence-first route preserved/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /decision and consequence/i })).toBeInTheDocument();
    expect(screen.getByText('Hunt persistence')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /reconstructed attack chain/i })).toBeInTheDocument();
    expect(screen.getByText('Interactive shell in build pod')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /transferable kubernetes lesson/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /sentinel detection guidance/i })).toBeInTheDocument();
  });

  it('uses campaign findings and cluster outcome for the Infiltrator instead of a defender attack map', () => {
    complete('infiltrator', 'persistence-first');
    render(<DebriefPage />);

    expect(screen.getByText(/planted log-rotator before the theft/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /established findings/i })).toBeInTheDocument();
    expect(screen.getByText(/cluster outcome: compromised/i)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /reconstructed attack chain/i })).not.toBeInTheDocument();
  });

  it.each([
    ['Replay This Role', 'sentinel'],
    ['Play the Other Role', 'infiltrator'],
  ] as const)('confirms and immediately starts the selected campaign via %s', (label, expectedRole) => {
    complete('sentinel', 'hunt-first');
    render(<DebriefPage />);

    fireEvent.click(screen.getByRole('button', { name: label }));

    expect(window.confirm).toHaveBeenCalledWith(expect.stringMatching(/replace.*progress/i));
    expect(useSimStore.getState().campaignId).toBe(expectedRole);
    expect(useSimStore.getState().stageIndex).toBe(0);
    expect(push).toHaveBeenCalledWith('/mission');
  });

  it('redirects nonterminal progress back to the mission', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.sentinel);
    render(<DebriefPage />);
    expect(replace).toHaveBeenCalledWith('/mission');
  });
});
