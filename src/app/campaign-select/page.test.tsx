import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { chapter1Campaigns } from '@/content/chapter1';
import { useSimStore } from '@/engine/store';
import CampaignSelectPage from './page';

const push = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}));

beforeEach(() => {
  vi.restoreAllMocks();
  push.mockReset();
  useSimStore.getState().resetProgress();
  localStorage.clear();
});

describe('CampaignSelectPage', () => {
  it('presents two complete five-stage role dossiers', () => {
    render(<CampaignSelectPage />);

    const dossiers = screen.getAllByRole('article');
    expect(dossiers).toHaveLength(2);
    const roleAssignment = screen.getByText('Role assignment');
    expect(roleAssignment).toHaveClass('text-slate-400');
    expect(roleAssignment.className).not.toMatch(/text-(mango|leaf)/);

    expect(within(dossiers[0]).getByText(/Kubernetes foothold/i)).toBeInTheDocument();
    expect(within(dossiers[0]).getByText(/fact-gated terminal actions/i)).toBeInTheDocument();
    expect(within(dossiers[0]).getByText(/excessive RBAC/i)).toBeInTheDocument();
    expect(within(dossiers[0]).getAllByRole('listitem')).toHaveLength(5);

    expect(within(dossiers[1]).getByText(/incident commander/i)).toBeInTheDocument();
    expect(within(dossiers[1]).getByText(/SIEM evidence/i)).toBeInTheDocument();
    expect(within(dossiers[1]).getByText(/Least-privilege RBAC/i)).toBeInTheDocument();
    expect(within(dossiers[1]).getAllByRole('listitem')).toHaveLength(5);
    const sentinelIdentity = within(dossiers[1]).getByText('sentinel');
    expect(sentinelIdentity).toHaveClass('text-slate-400');
    expect(sentinelIdentity.className).not.toMatch(/text-(mango|leaf)/);
  });

  it('starts the selected campaign and enters the mission', () => {
    const confirm = vi.spyOn(window, 'confirm');
    render(<CampaignSelectPage />);

    fireEvent.click(screen.getByRole('button', { name: /deploy as the sentinel/i }));

    expect(useSimStore.getState().campaignId).toBe('sentinel');
    expect(push).toHaveBeenCalledWith('/mission');
    expect(confirm).not.toHaveBeenCalled();
  });

  it.each([0, chapter1Campaigns.sentinel.stages.length])(
    'preserves a hydrated save at stage %i when direct replacement is cancelled',
    (stageIndex) => {
      useSimStore.getState().startCampaign(chapter1Campaigns.sentinel);
      useSimStore.setState({ stageIndex });
      const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false);
      render(<CampaignSelectPage />);

      fireEvent.click(screen.getByRole('button', { name: /deploy as the infiltrator/i }));

      expect(confirm).toHaveBeenCalledWith(expect.stringMatching(/replace.*progress/i));
      expect(useSimStore.getState().campaignId).toBe('sentinel');
      expect(useSimStore.getState().stageIndex).toBe(stageIndex);
      expect(push).not.toHaveBeenCalled();
    }
  );

  it('replaces a hydrated save after direct-route confirmation', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.sentinel);
    useSimStore.setState({ stageIndex: 2 });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(<CampaignSelectPage />);

    fireEvent.click(screen.getByRole('button', { name: /deploy as the infiltrator/i }));

    expect(useSimStore.getState().campaignId).toBe('infiltrator');
    expect(useSimStore.getState().stageIndex).toBe(0);
    expect(push).toHaveBeenCalledWith('/mission');
  });

  it('offers safe recovery when corrupt progress arrives directly on this route', async () => {
    localStorage.setItem(
      'operation-mango-progress',
      JSON.stringify({ state: { campaignId: 'unknown-role', stageIndex: 2 }, version: 2 })
    );
    await useSimStore.persist.rehydrate();

    render(<CampaignSelectPage />);

    expect(screen.getByRole('status')).toHaveTextContent(/could not be read/i);
    expect(screen.getByRole('button', { name: /reset progress/i })).toBeInTheDocument();
  });
});
