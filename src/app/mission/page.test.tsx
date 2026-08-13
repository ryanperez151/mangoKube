import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act, waitFor, within } from '@testing-library/react';
import { useSimStore } from '@/engine/store';
import { chapter1Campaigns } from '@/content/chapter1';
import MissionPage from './page';

const router = vi.hoisted(() => ({ push: vi.fn(), replace: vi.fn() }));

vi.mock('next/navigation', () => ({ useRouter: () => router }));

beforeEach(() => {
  useSimStore.getState().resetProgress();
  localStorage.clear();
  router.push.mockClear();
  router.replace.mockClear();
});

afterEach(() => vi.restoreAllMocks());

function renderWorkspace(role: 'sentinel' | 'infiltrator') {
  const campaign = chapter1Campaigns[role];
  useSimStore.getState().startCampaign(campaign);
  useSimStore.getState().markBriefingSeen(campaign.stages[0].id);
  return render(<MissionPage />);
}

function submitTerminal(command: string) {
  const input = screen.getByLabelText('terminal input');
  fireEvent.change(input, { target: { value: command } });
  fireEvent.submit(input.closest('form')!);
}

describe('MissionPage mode order', () => {
  it('prioritizes a pending resolution over an unseen briefing', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.infiltrator);
    useSimStore.setState({ pendingStageResolution: { stageId: 'recon' } });
    render(<MissionPage />);

    expect(screen.getByRole('main', { name: /stage resolution/i })).toBeInTheDocument();
    expect(screen.queryByRole('main', { name: /operation briefing/i })).not.toBeInTheDocument();
  });

  it('shows an unseen briefing before the role workspace and marks it only on Begin', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.infiltrator);
    render(<MissionPage />);

    expect(screen.getByRole('main', { name: /operation briefing/i })).toBeInTheDocument();
    expect(useSimStore.getState().seenBriefingIds).toEqual([]);
    fireEvent.click(screen.getByRole('button', { name: 'Begin' }));

    expect(useSimStore.getState().seenBriefingIds).toEqual(['recon']);
    expect(screen.getByLabelText('terminal input')).toBeInTheDocument();
  });

  it('collects the Infiltrator choice before its briefing so the selected route shapes the copy', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.infiltrator);
    act(() => {
      useSimStore.setState({ stageIndex: 3 });
    });
    render(<MissionPage />);

    expect(screen.getByRole('main', { name: /mission decision/i })).toBeInTheDocument();
    expect(screen.queryByRole('main', { name: /operation briefing/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /plant persistence first/i }));

    expect(screen.getByRole('main', { name: /operation briefing/i })).toBeInTheDocument();
    expect(screen.getByText(/plant the quiet identity first/i)).toBeInTheDocument();
    expect(screen.queryByRole('main', { name: /mission workspace/i })).not.toBeInTheDocument();
  });

  it('surfaces a malformed pending before-stage state as its resolution instead of inert decision actions', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.infiltrator);
    act(() => {
      useSimStore.setState({
        stageIndex: 3,
        decisions: {},
        pendingStageResolution: { stageId: 'escalation' },
      });
    });
    render(<MissionPage />);

    expect(screen.getByRole('main', { name: /stage resolution/i })).toBeInTheDocument();
    expect(screen.queryByRole('main', { name: /mission decision/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue operation/i }));
    expect(useSimStore.getState().stageIndex).toBe(4);
  });

  it('collects the Sentinel choice after Scope completion, then resolves and briefs the consequence', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.sentinel);
    act(() => {
      useSimStore.setState({ stageIndex: 2, seenBriefingIds: ['scope'] });
    });
    render(<MissionPage />);

    expect(screen.getByRole('main', { name: /mission workspace/i })).toBeInTheDocument();
    expect(screen.queryByRole('main', { name: /mission decision/i })).not.toBeInTheDocument();

    act(() => {
      useSimStore.setState({
        collectedFacts: ['evidence-secret-read', 'evidence-exfil-egress'],
        revealedFacts: ['evidence-secret-read', 'evidence-exfil-egress'],
        pendingStageResolution: { stageId: 'scope' },
      });
    });
    expect(screen.getByRole('main', { name: /mission decision/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /contain now/i }));

    expect(screen.getByRole('main', { name: /stage resolution/i })).toBeInTheDocument();
    expect(screen.getByText(/revoke the primary binding/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue operation/i }));
    expect(screen.getByRole('main', { name: /operation briefing/i })).toBeInTheDocument();
    expect(screen.getByText(/attacker pivots/i)).toBeInTheDocument();
  });
});

describe('MissionPage shared workspace shell', () => {
  it('shows role, current stage, locked future markers, fact-backed progress, and fixed-height regions', () => {
    renderWorkspace('sentinel');

    expect(screen.getByText('Sentinel')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Triage' })).toBeInTheDocument();
    expect(screen.getByLabelText('0 of 2 objectives complete')).toBeInTheDocument();
    expect(screen.getByLabelText('Stage 2 locked')).toBeInTheDocument();
    expect(screen.queryByText('Identity & Blast Radius')).not.toBeInTheDocument();
    expect(screen.getByTestId('mission-workspace')).toHaveClass('h-full', 'min-h-0', 'overflow-hidden');
    expect(screen.getByTestId('mission-workspace')).not.toHaveClass('h-[100dvh]');
    expect(screen.getByTestId('primary-workspace')).toHaveClass('min-h-0', 'overflow-hidden');
    expect(screen.getByTestId('context-viewport')).toHaveClass('min-h-0', 'overflow-y-auto');
  });

  it('Exit preserves progress while confirmed Restart clears it and returns to role selection', () => {
    renderWorkspace('infiltrator');
    submitTerminal('kubectl get pods');
    expect(useSimStore.getState().collectedFacts).toContain('found-implant-pod');

    fireEvent.click(screen.getByRole('button', { name: 'Exit' }));
    expect(router.push).toHaveBeenCalledWith('/');
    expect(useSimStore.getState().collectedFacts).toContain('found-implant-pod');

    vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
    expect(useSimStore.getState().campaignId).toBe('infiltrator');
    fireEvent.click(screen.getByRole('button', { name: 'Restart' }));
    expect(useSimStore.getState().campaignId).toBeNull();
    expect(router.push).toHaveBeenCalledWith('/campaign-select');
  });

  it('Help selects and focuses the Guidance tab, and replays without altering progress', async () => {
    renderWorkspace('infiltrator');
    const seenBefore = [...useSimStore.getState().seenBriefingIds];

    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    const guidanceTab = screen.getByRole('tab', { name: /guidance/i });
    expect(guidanceTab).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(document.activeElement).toBe(guidanceTab));
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'context-tab-guidance');

    fireEvent.click(screen.getByRole('button', { name: /replay briefing/i }));
    expect(screen.getByRole('main', { name: /operation briefing/i })).toBeInTheDocument();
    expect(useSimStore.getState().seenBriefingIds).toEqual(seenBefore);
  });

  it('keeps guidance non-modal so the workspace stays usable while a hint is open', () => {
    renderWorkspace('infiltrator');
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByTestId('workspace-content')).not.toHaveAttribute('inert');
    expect(screen.getByLabelText('terminal input')).toBeInTheDocument();
  });

  it('reveals guidance one tier at a time and keeps earlier tiers on screen', () => {
    renderWorkspace('infiltrator');
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.queryByTestId('guidance-tier-1')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reveal a hint/i }));
    expect(screen.getByTestId('guidance-tier-1')).toBeInTheDocument();
    expect(screen.queryByTestId('guidance-tier-2')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reveal the next hint/i }));
    fireEvent.click(screen.getByRole('button', { name: /reveal the next hint/i }));
    expect(screen.getByTestId('guidance-tier-1')).toBeInTheDocument();
    expect(screen.getByTestId('guidance-tier-2')).toBeInTheDocument();
    expect(screen.getByTestId('guidance-tier-3')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /reveal/i })).not.toBeInTheDocument();
  });
});

describe('MissionPage adaptive help', () => {
  it('unrecognized commands escalate to the exact command, which inserts without submitting', () => {
    renderWorkspace('infiltrator');
    for (let attempt = 0; attempt < 6; attempt += 1) submitTerminal('not-a-command');

    expect(useSimStore.getState().failedAttemptsByStage.recon).toBe(6);
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.getByTestId('guidance-tier-3')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /insert into terminal/i }));

    expect(screen.getByLabelText('terminal input')).toHaveValue('kubectl get pods');
    expect(document.activeElement).toBe(screen.getByLabelText('terminal input'));
    expect(useSimStore.getState().terminalHistory).toHaveLength(6);
  });

  it('failed Sentinel searches walk tier 1 at two, tier 2 at four, and tier 3 at six', () => {
    renderWorkspace('sentinel');
    const input = screen.getByLabelText('search query');
    for (let attempt = 0; attempt < 2; attempt += 1) {
      fireEvent.change(input, { target: { value: 'source=nothing' } });
      fireEvent.submit(screen.getByRole('search'));
    }
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    expect(screen.getByTestId('guidance-tier-1')).toBeInTheDocument();
    expect(screen.queryByTestId('guidance-tier-2')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /insert/i })).not.toBeInTheDocument();

    for (let attempt = 0; attempt < 2; attempt += 1) fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByTestId('guidance-tier-2')).toBeInTheDocument();
    expect(screen.queryByTestId('guidance-tier-3')).not.toBeInTheDocument();

    for (let attempt = 0; attempt < 2; attempt += 1) fireEvent.submit(screen.getByRole('search'));
    expect(screen.getByTestId('guidance-tier-3')).toBeInTheDocument();
    const submittedBeforeInsert = useSimStore.getState().activeQuery;
    fireEvent.click(screen.getByRole('button', { name: /insert into search/i }));
    expect(screen.getByLabelText('search query')).toHaveValue('source=edr severity=high');
    expect(useSimStore.getState().activeQuery).toBe(submittedBeforeInsert);
  });

  it('a new fact resets failures without lowering unlocked guidance', () => {
    renderWorkspace('infiltrator');
    submitTerminal('bad');
    submitTerminal('bad');
    submitTerminal('kubectl get pods');

    expect(useSimStore.getState().failedAttemptsByStage.recon).toBe(0);
    expect(useSimStore.getState().guidanceLevelByStage.recon).toBe(1);
  });
});

describe('MissionPage Sentinel workspace', () => {
  beforeEach(() => {
    useSimStore.getState().startCampaign(chapter1Campaigns.sentinel);
    useSimStore.getState().markBriefingSeen('triage');
  });

  it('uses exactly Evidence, Attack Path, and Guidance context tabs and no query chips', () => {
    render(<MissionPage />);
    const tablist = screen.getByRole('tablist', { name: 'Mission context' });
    expect(within(tablist).getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Evidence',
      'Attack Path',
      'Guidance',
    ]);
    expect(screen.getByLabelText('case file')).toBeInTheDocument();
    expect(screen.queryByLabelText('attack path map')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /query/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Attack Path' }));
    expect(screen.getByLabelText('attack path map')).toBeInTheDocument();
  });

  it('uses roving keyboard focus and associated tab panels', async () => {
    render(<MissionPage />);
    const evidence = screen.getByRole('tab', { name: 'Evidence' });
    const attackPath = screen.getByRole('tab', { name: 'Attack Path' });
    expect(evidence).toHaveAttribute('tabindex', '0');
    expect(attackPath).toHaveAttribute('tabindex', '-1');
    evidence.focus();
    fireEvent.keyDown(evidence, { key: 'ArrowRight' });
    await waitFor(() => expect(document.activeElement).toBe(attackPath));
    expect(attackPath).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tabpanel')).toHaveAttribute('aria-labelledby', 'context-tab-attack-path');
  });

  it('combines selected details, pinning, findings, and case history in Evidence with one announcement and badge', () => {
    render(<MissionPage />);
    fireEvent.click(screen.getByRole('button', { name: /Interactive shell \/bin\/sh spawned/i }));
    expect(screen.getByRole('button', { name: /pin to case file/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /pin to case file/i }));

    expect(screen.getByText('Interactive shell in a build pod')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /remove from case file/i })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /Evidence, 1 new finding/i })).toBeInTheDocument();
    expect(screen.getByTestId('discovery-announcement')).toHaveAttribute('aria-live', 'polite');
    expect(screen.getByTestId('discovery-announcement')).toHaveTextContent(/Interactive shell in a build pod established/i);
    expect(screen.getByLabelText('1 of 2 objectives complete')).toBeInTheDocument();
  });

  it('does not count the hidden containment step on the contain-now route', () => {
    act(() => {
      useSimStore.setState({
        stageIndex: 4,
        decisions: { 'containment-timing': 'contain-now' },
        collectedFacts: ['revoked-primary-binding'],
      });
      useSimStore.getState().markBriefingSeen('containment');
    });
    render(<MissionPage />);
    expect(screen.getByLabelText('0 of 4 objectives complete')).toBeInTheDocument();
  });

  it.each([
    ['hunt-first', /hunt persistence/i, 'create serviceaccounts/log-rotator', 'create serviceaccounts/metrics-reconciler'],
    ['contain-now', /contain now/i, 'create serviceaccounts/metrics-reconciler', 'create serviceaccounts/log-rotator'],
  ] as const)(
    'makes the %s decision route events playable through the UI',
    (choice, buttonName, visibleEvent, hiddenEvent) => {
      act(() => {
        useSimStore.setState({
          stageIndex: 2,
          seenBriefingIds: ['triage', 'scope'],
          collectedFacts: ['evidence-secret-read', 'evidence-exfil-egress'],
          revealedFacts: ['evidence-secret-read', 'evidence-exfil-egress'],
          pendingStageResolution: { stageId: 'scope' },
        });
      });
      render(<MissionPage />);
      fireEvent.click(screen.getByRole('button', { name: buttonName }));
      expect(useSimStore.getState().decisions['containment-timing']).toBe(choice);
      fireEvent.click(screen.getByRole('button', { name: /continue operation/i }));
      fireEvent.click(screen.getByRole('button', { name: 'Begin' }));
      expect(screen.getByText(visibleEvent)).toBeInTheDocument();
      expect(screen.queryByText(hiddenEvent)).not.toBeInTheDocument();
    }
  );

  it('clears a tier-3 inserted query when the next stage begins', () => {
    render(<MissionPage />);
    const search = screen.getByRole('search');
    for (let attempt = 0; attempt < 6; attempt += 1) {
      fireEvent.change(screen.getByLabelText('search query'), { target: { value: 'source=nothing' } });
      fireEvent.submit(search);
    }
    fireEvent.click(screen.getByRole('button', { name: 'Help' }));
    fireEvent.click(screen.getByRole('button', { name: /insert into search/i }));
    expect(screen.getByLabelText('search query')).toHaveValue('source=edr severity=high');

    act(() => {
      useSimStore.getState().pinEvent('sig-shell-spawn');
      useSimStore.getState().pinEvent('sig-exec-create');
    });
    fireEvent.click(screen.getByRole('button', { name: /continue operation/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Begin' }));
    expect(screen.getByLabelText('search query')).toHaveValue('');
    expect(useSimStore.getState().activeQuery).toBe('');
  });
});

describe('MissionPage Infiltrator workspace', () => {
  it('uses exactly Objectives, Cluster, and Guidance tabs and never renders an always-visible command list', () => {
    renderWorkspace('infiltrator');
    const tablist = screen.getByRole('tablist', { name: 'Mission context' });
    expect(within(tablist).getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Objectives',
      'Cluster',
      'Guidance',
    ]);
    expect(screen.getByText('Locate the implanted build pod.')).toBeInTheDocument();
    expect(screen.queryByTestId('terminal-hints')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: 'Cluster' }));
    expect(screen.getByRole('img', { name: 'cluster diagram' })).toBeInTheDocument();
  });

  it.each([
    ['exfil-first', /exfiltrate first/i, 'kubectl get se', "kubectl get secret ultra-mango-genome-db -o jsonpath='{.data}' | base64 -d", 'exfiltrated-ip'],
    ['persistence-first', /plant persistence first/i, 'kubectl create s', 'kubectl create serviceaccount log-rotator -n kube-system', 'persistence-sa-created'],
  ] as const)(
    'makes the %s decision route command playable and completion-visible',
    (choice, buttonName, prefix, completed, fact) => {
      useSimStore.getState().startCampaign(chapter1Campaigns.infiltrator);
      act(() => {
        useSimStore.setState({ stageIndex: 3 });
        useSimStore.getState().markBriefingSeen('escalation');
      });
      render(<MissionPage />);
      fireEvent.click(screen.getByRole('button', { name: buttonName }));
      expect(useSimStore.getState().decisions['operational-order']).toBe(choice);

      const input = screen.getByLabelText('terminal input');
      fireEvent.change(input, { target: { value: prefix } });
      fireEvent.keyDown(input, { key: 'Tab' });
      expect(input).toHaveValue(completed);
      fireEvent.submit(input.closest('form')!);
      expect(useSimStore.getState().collectedFacts).toContain(fact);
    }
  );

  it('holds a completed stage for explicit resolution continuation', () => {
    renderWorkspace('infiltrator');
    submitTerminal('kubectl get pods');
    submitTerminal('kubectl auth can-i --list');
    submitTerminal('cat /var/run/secrets/kubernetes.io/serviceaccount/token');

    expect(useSimStore.getState().stageIndex).toBe(0);
    expect(screen.getByRole('main', { name: /stage resolution/i })).toBeInTheDocument();
  });

  it('uses one screen-reader live region for discoveries', () => {
    renderWorkspace('infiltrator');
    expect(document.querySelectorAll('[aria-live]')).toHaveLength(1);
    expect(screen.getByTestId('discovery-announcement')).toHaveAttribute('aria-live', 'polite');
  });
});
