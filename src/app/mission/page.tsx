'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type RefObject,
} from 'react';
import { useRouter } from 'next/navigation';
import { useSimStore, useHasHydrated } from '@/engine/store';
import { isChoiceVisible } from '@/engine/conditions';
import { chapter1Campaigns } from '@/content/chapter1';
import type { GuidanceStep, LogEvent, ObjectiveStep, Stage } from '@/content/types';
import { Terminal } from '@/components/Terminal/Terminal';
import { ClusterDiagram } from '@/components/ClusterDiagram/ClusterDiagram';
import { LogExplorer } from '@/components/LogExplorer/LogExplorer';
import { EventDetail } from '@/components/LogExplorer/EventDetail';
import { AttackMap } from '@/components/AttackMap/AttackMap';
import { CaseFile } from '@/components/CaseFile/CaseFile';
import {
  ActionButton,
  AppFrame,
  DesktopGate,
  ObjectiveProgress,
  Panel,
  StageRail,
  StatusBadge,
  TabButton,
} from '@/components/Cinematic/Cinematic';
import { BriefingScene, DecisionScene, StageResolutionScene } from '@/components/Cinematic/Scenes';
import { PersistenceStatusNotice } from '@/components/PersistenceStatus/PersistenceStatus';

type ContextTab = 'evidence' | 'attack-path' | 'objectives' | 'cluster';
type InputTarget = 'search' | 'terminal';

function roleLabel(role: 'sentinel' | 'infiltrator') {
  return role === 'sentinel' ? 'Sentinel' : 'Infiltrator';
}

function firstInlineCode(lines: readonly string[]): string | undefined {
  for (const line of lines) {
    const match = line.match(/`([^`]+)`/);
    if (match) return match[1];
  }
}

function ObjectiveList({
  steps,
  facts,
  decisions,
}: {
  steps: readonly ObjectiveStep[];
  facts: readonly string[];
  decisions: Readonly<Record<string, string>>;
}) {
  const visible = steps.filter((step) => isChoiceVisible(step.visibleWhen, decisions));
  return (
    <ul className="mt-4 space-y-3">
      {visible.map((step) => {
        const complete = step.requiresFacts.every((fact) => facts.includes(fact));
        return (
          <li key={step.id} className="flex gap-3 border-b border-white/[0.06] pb-3">
            <span
              aria-hidden="true"
              className={complete ? 'text-leaf-300' : 'text-slate-400'}
            >
              {complete ? '✓' : '○'}
            </span>
            <div>
              <p className={complete ? 'text-leaf-300' : 'text-slate-200'}>{step.label}</p>
              {step.detail && <p className="mt-1 text-xs leading-5 text-slate-400">{step.detail}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function MissionHelp({
  open,
  guidance,
  level,
  insertText,
  inputTarget,
  onClose,
  onInsert,
  onReplay,
  returnFocusRef,
}: {
  open: boolean;
  guidance: GuidanceStep | undefined;
  level: number;
  insertText: string | undefined;
  inputTarget: InputTarget;
  onClose: () => void;
  onInsert: (text: string) => void;
  onReplay: () => void;
  returnFocusRef: RefObject<HTMLButtonElement>;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstActionRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) firstActionRef.current?.focus();
  }, [open]);

  if (!open) return null;

  function close() {
    onClose();
    queueMicrotask(() => returnFocusRef.current?.focus());
  }

  function keepFocusInside(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key !== 'Tab' || !dialogRef.current) return;
    const focusable = Array.from(
      dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable.at(-1)!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/75 p-8">
      <Panel
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="mission-help-title"
        tabIndex={-1}
        onKeyDown={keepFocusInside}
        className="w-full max-w-xl p-6"
      >
        <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
              Guidance tier {level}
            </p>
            <h2 id="mission-help-title" className="mt-1 font-display text-2xl font-bold uppercase tracking-[0.08em] text-slate-100">
              Mission help
            </h2>
          </div>
          <ActionButton ref={firstActionRef} variant="quiet" onClick={close}>Close help</ActionButton>
        </div>
        <div className="mt-5 space-y-3 text-base leading-7 text-slate-300">
          {(guidance?.lines ?? ['Review the current objective and established facts.']).map((line) => (
            <p key={line}>{line}</p>
          ))}
        </div>
        <div className="mt-6 flex flex-wrap gap-3 border-t border-white/10 pt-5">
          {level === 3 && insertText && (
            <ActionButton onClick={() => onInsert(insertText)}>
              Insert into {inputTarget}
            </ActionButton>
          )}
          <ActionButton variant="secondary" onClick={onReplay}>Replay briefing</ActionButton>
        </div>
      </Panel>
    </div>
  );
}

function MissionExperience() {
  const router = useRouter();
  const campaignId = useSimStore((state) => state.campaignId);
  const campaign = useSimStore((state) => state.campaign);
  const hydrateCampaign = useSimStore((state) => state.hydrateCampaign);
  const stageIndex = useSimStore((state) => state.stageIndex);
  const revealedFacts = useSimStore((state) => state.revealedFacts);
  const collectedFacts = useSimStore((state) => state.collectedFacts);
  const terminalHistory = useSimStore((state) => state.terminalHistory);
  const clusterStatus = useSimStore((state) => state.clusterStatus);
  const highlightedNodeIds = useSimStore((state) => state.highlightedNodeIds);
  const revealedEdgeIds = useSimStore((state) => state.revealedEdgeIds);
  const pinnedEvidence = useSimStore((state) => state.pinnedEvidence);
  const activeQuery = useSimStore((state) => state.activeQuery);
  const timeRangeId = useSimStore((state) => state.timeRangeId);
  const decisions = useSimStore((state) => state.decisions);
  const guidanceLevelByStage = useSimStore((state) => state.guidanceLevelByStage);
  const seenBriefingIds = useSimStore((state) => state.seenBriefingIds);
  const pendingStageResolution = useSimStore((state) => state.pendingStageResolution);
  const runCommand = useSimStore((state) => state.runCommand);
  const pinEvent = useSimStore((state) => state.pinEvent);
  const unpinEvent = useSimStore((state) => state.unpinEvent);
  const setQuery = useSimStore((state) => state.setQuery);
  const setTimeRange = useSimStore((state) => state.setTimeRange);
  const requestGuidance = useSimStore((state) => state.requestGuidance);
  const recordAttempt = useSimStore((state) => state.recordAttempt);
  const resetProgress = useSimStore((state) => state.resetProgress);
  const [replayBriefing, setReplayBriefing] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [terminalDraft, setTerminalDraft] = useState('');
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [contextTab, setContextTab] = useState<ContextTab>(
    campaignId === 'sentinel' ? 'evidence' : 'objectives'
  );
  const [newFindingCount, setNewFindingCount] = useState(0);
  const [discoveryMessage, setDiscoveryMessage] = useState('');
  const [queryInsertion, setQueryInsertion] = useState<{ id: number; text: string }>();
  const [focusInputAfterHelp, setFocusInputAfterHelp] = useState<InputTarget | null>(null);
  const [decisionJustResolved, setDecisionJustResolved] = useState(false);
  const helpButtonRef = useRef<HTMLButtonElement>(null);
  const workspaceHeadingRef = useRef<HTMLHeadingElement>(null);
  const workspaceContentRef = useRef<HTMLDivElement>(null);
  const hasHydrated = useHasHydrated();

  useEffect(() => {
    if (hasHydrated && !useSimStore.getState().campaignId) router.replace('/campaign-select');
  }, [hasHydrated, campaignId, router]);

  useEffect(() => {
    if (hasHydrated && campaignId && !campaign) hydrateCampaign(chapter1Campaigns[campaignId]);
  }, [hasHydrated, campaignId, campaign, hydrateCampaign]);

  useEffect(() => {
    setReplayBriefing(false);
    setHelpOpen(false);
    setTerminalDraft('');
    setSelectedEventId(null);
    setNewFindingCount(0);
    setDiscoveryMessage('');
    setQueryInsertion(undefined);
    setDecisionJustResolved(false);
    setContextTab(campaignId === 'sentinel' ? 'evidence' : 'objectives');
  }, [stageIndex, campaignId]);

  useEffect(() => {
    const workspaceContent = workspaceContentRef.current;
    if (!workspaceContent) return;
    if (helpOpen) workspaceContent.setAttribute('inert', '');
    else workspaceContent.removeAttribute('inert');
    return () => workspaceContent.removeAttribute('inert');
  }, [helpOpen]);

  useEffect(() => {
    if (helpOpen || !focusInputAfterHelp) return;
    const inputLabel = focusInputAfterHelp === 'terminal' ? 'terminal input' : 'search query';
    document.querySelector<HTMLInputElement>(`input[aria-label="${inputLabel}"]`)?.focus();
    setFocusInputAfterHelp(null);
  }, [helpOpen, focusInputAfterHelp]);

  useEffect(() => {
    if (campaign && stageIndex >= campaign.stages.length) router.push('/debrief');
  }, [campaign, stageIndex, router]);

  const stage = campaign?.stages[stageIndex];
  const arrivedEvents = useMemo(
    () =>
      (campaign?.logCorpus ?? []).filter(
        (event) => event.arrivesAtStage <= stageIndex && isChoiceVisible(event.visibleWhen, decisions)
      ),
    [campaign, stageIndex, decisions]
  );
  const pinnedEvents = useMemo(
    () => (campaign?.logCorpus ?? []).filter((event) => pinnedEvidence.includes(event.id)),
    [campaign, pinnedEvidence]
  );
  const establishedFacts = useMemo(
    () =>
      collectedFacts
        .map((factId) => campaign?.factLibrary[factId])
        .filter((fact): fact is NonNullable<typeof fact> => fact !== undefined),
    [collectedFacts, campaign]
  );
  const availableCommands = useMemo(() => {
    if (!stage) return [];
    const revealedSet = new Set(revealedFacts);
    return stage.commands.filter(
      (command) =>
        isChoiceVisible(command.visibleWhen, decisions) &&
        (command.requiresFacts ?? []).every((factId) => revealedSet.has(factId))
    );
  }, [stage, revealedFacts, decisions]);
  const selectedEvent = arrivedEvents.find((event) => event.id === selectedEventId) ?? null;
  const objectiveSteps = stage?.objectiveSteps ?? [];
  const isSentinel = campaignId === 'sentinel';
  const usesTerminal = !isSentinel || Boolean(stage?.commands.length);
  const inputTarget: InputTarget = usesTerminal ? 'terminal' : 'search';
  const guidanceLevel = stage ? guidanceLevelByStage[stage.id] ?? 0 : 0;
  const highestGuidance = stage?.guidance?.find(
    (step) => step.level === guidanceLevel && isChoiceVisible(step.visibleWhen, decisions)
  );
  const insertText =
    highestGuidance?.insertText ??
    (inputTarget === 'terminal'
      ? availableCommands[0]?.description
      : firstInlineCode(highestGuidance?.lines ?? []));
  const resolvedDecision = campaign?.stages
    .flatMap((candidate) =>
      candidate.decision
        ? candidate.decision.options
            .filter((option) => decisions[candidate.decision!.id] === option.id)
            .map((option) => ({ decision: candidate.decision!, option }))
        : []
    )
    .at(-1);

  useEffect(() => {
    if (!campaign || !stage || pendingStageResolution || replayBriefing) return;
    const unresolvedDecision = stage.decision && !decisions[stage.decision.id];
    if (unresolvedDecision || !seenBriefingIds.includes(stage.id)) return;
    queueMicrotask(() => {
      if (document.activeElement === document.body) workspaceHeadingRef.current?.focus();
    });
  }, [campaign, stage, pendingStageResolution, replayBriefing, decisions, seenBriefingIds]);

  if (!hasHydrated || !campaignId || !campaign || !stage) {
    return <AppFrame message="Loading active operation" />;
  }

  if (pendingStageResolution) return <StageResolutionScene />;
  if (replayBriefing || !seenBriefingIds.includes(stage.id)) {
    return <BriefingScene onBegin={() => setReplayBriefing(false)} />;
  }
  if (stage.decision && !decisions[stage.decision.id]) {
    return <DecisionScene onSelected={() => setDecisionJustResolved(true)} />;
  }

  function announceFact(factId: string) {
    const fact = campaign?.factLibrary[factId];
    if (!fact) return;
    setDiscoveryMessage(`${fact.label} established.`);
    setNewFindingCount((count) => count + 1);
  }

  function handleCommand(input: string) {
    const before = new Set(useSimStore.getState().collectedFacts);
    runCommand(input);
    const found = useSimStore.getState().collectedFacts.find((factId) => !before.has(factId));
    if (found) announceFact(found);
  }

  function handlePin(event: LogEvent) {
    const isNewFact = event.revealsFact && !collectedFacts.includes(event.revealsFact);
    pinEvent(event.id);
    if (isNewFact && event.revealsFact) announceFact(event.revealsFact);
  }

  function openHelp() {
    requestGuidance();
    setHelpOpen(true);
  }

  function replayFromHelp() {
    setHelpOpen(false);
    setReplayBriefing(true);
  }

  function insertGuidance(text: string) {
    if (inputTarget === 'terminal') setTerminalDraft(text);
    else setQueryInsertion((current) => ({ id: (current?.id ?? 0) + 1, text }));
    setFocusInputAfterHelp(inputTarget);
    setHelpOpen(false);
  }

  function selectContext(tab: ContextTab) {
    setContextTab(tab);
    if ((isSentinel && tab === 'evidence') || (!isSentinel && tab === 'objectives')) {
      setNewFindingCount(0);
    }
  }

  function moveContextTab(event: KeyboardEvent<HTMLDivElement>) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs: readonly ContextTab[] = isSentinel
      ? ['evidence', 'attack-path']
      : ['objectives', 'cluster'];
    const currentIndex = tabs.indexOf(contextTab);
    const nextIndex =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? tabs.length - 1
          : (currentIndex + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    event.preventDefault();
    const next = tabs[nextIndex];
    selectContext(next);
    queueMicrotask(() => document.getElementById(`context-tab-${next}`)?.focus());
  }

  return (
    <main
      data-testid="mission-workspace"
      className="h-[100dvh] min-h-0 overflow-hidden bg-scene-ink p-4"
      aria-label="Mission workspace"
    >
      <div ref={workspaceContentRef} data-testid="workspace-content" className="mx-auto flex h-full min-h-0 max-w-[1600px] flex-col gap-3">
        <header className="grid shrink-0 grid-cols-[minmax(0,1fr)_minmax(18rem,0.8fr)_auto] items-center gap-5 border-b border-white/10 pb-3">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
              <span>{roleLabel(campaignId)}</span>
              <span> · Stage {stageIndex + 1} of {campaign.stages.length}</span>
            </p>
            <h1
              ref={workspaceHeadingRef}
              tabIndex={-1}
              className="truncate font-display text-2xl font-bold uppercase tracking-[0.1em] text-slate-100"
            >
              {stage.title}
            </h1>
            {resolvedDecision && (
              <p className="mt-1 truncate text-xs text-leaf-300">
                <span className={decisionJustResolved ? 'context-pulse inline-block' : undefined}>
                  Decision: {resolvedDecision.option.label} — {resolvedDecision.option.description}
                </span>
              </p>
            )}
          </div>
          <div className="space-y-2">
            <StageRail stages={campaign.stages} activeIndex={stageIndex} />
            <ObjectiveProgress steps={objectiveSteps} facts={collectedFacts} decisions={decisions} />
          </div>
          <nav aria-label="Mission actions" className="flex gap-2">
            <ActionButton ref={helpButtonRef} variant="secondary" className="min-h-9 px-3 text-xs" onClick={openHelp}>Help</ActionButton>
            <ActionButton variant="quiet" className="min-h-9 px-3 text-xs" onClick={() => router.push('/')}>Exit</ActionButton>
            <ActionButton
              variant="danger"
              className="min-h-9 px-3 text-xs"
              onClick={() => {
                if (!window.confirm('Restart this operation? Current progress will be cleared.')) return;
                resetProgress();
                router.push('/campaign-select');
              }}
            >
              Restart
            </ActionButton>
          </nav>
        </header>

        <div className="grid min-h-0 flex-1 gap-3 grid-cols-[minmax(0,2.2fr)_minmax(20rem,0.9fr)]">
          <Panel data-testid="primary-workspace" className="min-h-0 overflow-hidden p-3">
            {usesTerminal ? (
              <Terminal
                history={terminalHistory}
                availableCommands={availableCommands}
                value={terminalDraft}
                onChange={setTerminalDraft}
                onSubmit={handleCommand}
              />
            ) : (
              <LogExplorer
                key={stage.id}
                events={arrivedEvents}
                ranges={campaign.timeRanges ?? []}
                timeRangeId={timeRangeId}
                query={activeQuery}
                pinnedIds={pinnedEvidence}
                selectedId={selectedEventId}
                insertion={queryInsertion}
                onQueryChange={setQuery}
                onTimeRangeChange={setTimeRange}
                onSelect={setSelectedEventId}
                onFailedAttempt={() => recordAttempt(false)}
              />
            )}
          </Panel>

          <Panel className="flex min-h-0 flex-col overflow-hidden">
            <div role="tablist" aria-label="Mission context" onKeyDown={moveContextTab} className="flex shrink-0 border-b border-white/10">
              {isSentinel ? (
                <>
                  <TabButton id="context-tab-evidence" aria-controls="context-panel" active={contextTab === 'evidence'} onClick={() => selectContext('evidence')} aria-label={newFindingCount ? `Evidence, ${newFindingCount} new ${newFindingCount === 1 ? 'finding' : 'findings'}` : 'Evidence'}>
                    Evidence
                    {newFindingCount > 0 && <span key={newFindingCount} className="context-pulse ml-2 inline-block text-leaf-300">{newFindingCount}</span>}
                  </TabButton>
                  <TabButton id="context-tab-attack-path" aria-controls="context-panel" active={contextTab === 'attack-path'} onClick={() => selectContext('attack-path')}>Attack Path</TabButton>
                </>
              ) : (
                <>
                  <TabButton id="context-tab-objectives" aria-controls="context-panel" active={contextTab === 'objectives'} onClick={() => selectContext('objectives')} aria-label={newFindingCount ? `Objectives, ${newFindingCount} new ${newFindingCount === 1 ? 'finding' : 'findings'}` : 'Objectives'}>
                    Objectives
                    {newFindingCount > 0 && <span key={newFindingCount} className="context-pulse ml-2 inline-block text-leaf-300">{newFindingCount}</span>}
                  </TabButton>
                  <TabButton id="context-tab-cluster" aria-controls="context-panel" active={contextTab === 'cluster'} onClick={() => selectContext('cluster')}>Cluster</TabButton>
                </>
              )}
            </div>
            <div id="context-panel" role="tabpanel" aria-labelledby={`context-tab-${contextTab}`} data-testid="context-viewport" className="min-h-0 flex-1 overflow-y-auto p-4">
              {contextTab === 'evidence' && (
                <div className="space-y-6">
                  <section aria-label="Selected event">
                    <h2 className="mb-2 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">Selected event</h2>
                    <div className="border border-white/10 bg-black/25">
                      <EventDetail
                        event={selectedEvent}
                        isPinned={selectedEvent ? pinnedEvidence.includes(selectedEvent.id) : false}
                        onPin={(eventId) => {
                          const event = arrivedEvents.find((candidate) => candidate.id === eventId);
                          if (event) handlePin(event);
                        }}
                        onUnpin={unpinEvent}
                      />
                    </div>
                  </section>
                  <CaseFile
                    objective={stage.objective}
                    pinnedEvents={pinnedEvents}
                    facts={establishedFacts}
                    onUnpin={unpinEvent}
                  />
                </div>
              )}
              {contextTab === 'attack-path' && (
                <AttackMap nodes={campaign.attackMap ?? []} facts={collectedFacts} />
              )}
              {contextTab === 'objectives' && (
                <section aria-label="Stage objectives">
                  <StatusBadge>Current objective</StatusBadge>
                  <p className="mt-3 text-sm leading-6 text-slate-100">{stage.objective}</p>
                  <div className="mt-5">
                    <ObjectiveProgress steps={objectiveSteps} facts={collectedFacts} decisions={decisions} />
                  </div>
                  <ObjectiveList steps={objectiveSteps} facts={collectedFacts} decisions={decisions} />
                </section>
              )}
              {contextTab === 'cluster' && (
                <ClusterDiagram
                  highlightedNodeIds={highlightedNodeIds}
                  revealedEdgeIds={revealedEdgeIds}
                  status={clusterStatus}
                />
              )}
            </div>
          </Panel>
        </div>
      </div>

      <div
        data-testid="discovery-announcement"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {discoveryMessage}
      </div>

      <MissionHelp
        open={helpOpen}
        guidance={highestGuidance}
        level={guidanceLevel}
        insertText={insertText}
        inputTarget={inputTarget}
        onClose={() => setHelpOpen(false)}
        onInsert={insertGuidance}
        onReplay={replayFromHelp}
        returnFocusRef={helpButtonRef}
      />
    </main>
  );
}

export default function MissionPage() {
  return (
    <DesktopGate>
      <div className="app-shell flex min-h-0 flex-col bg-scene-ink">
        <PersistenceStatusNotice placement="inline" className="mx-4 mt-2" />
        <div className="status-page-content min-h-0 flex-1">
          <MissionExperience />
        </div>
      </div>
    </DesktopGate>
  );
}
