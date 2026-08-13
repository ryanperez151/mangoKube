'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSimStore, useHasHydrated } from '@/engine/store';
import { chapter1Campaigns } from '@/content/chapter1';
import { Terminal } from '@/components/Terminal/Terminal';
import { ClusterDiagram } from '@/components/ClusterDiagram/ClusterDiagram';
import { LogExplorer } from '@/components/LogExplorer/LogExplorer';
import { AttackMap } from '@/components/AttackMap/AttackMap';
import { CaseFile } from '@/components/CaseFile/CaseFile';
import {
  AppFrame,
  DesktopGate,
  ObjectiveProgress,
  Panel,
  StageRail,
} from '@/components/Cinematic/Cinematic';
import {
  BriefingReplayButton,
  BriefingScene,
  DecisionScene,
  StageResolutionScene,
} from '@/components/Cinematic/Scenes';

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
  const seenBriefingIds = useSimStore((state) => state.seenBriefingIds);
  const pendingStageResolution = useSimStore((state) => state.pendingStageResolution);
  const runCommand = useSimStore((state) => state.runCommand);
  const pinEvent = useSimStore((state) => state.pinEvent);
  const unpinEvent = useSimStore((state) => state.unpinEvent);
  const setQuery = useSimStore((state) => state.setQuery);
  const setTimeRange = useSimStore((state) => state.setTimeRange);
  const [replayBriefing, setReplayBriefing] = useState(false);
  const [decisionSceneId, setDecisionSceneId] = useState<string | null>(null);
  const hasHydrated = useHasHydrated();

  useEffect(() => {
    if (hasHydrated && !useSimStore.getState().campaignId) {
      router.replace('/campaign-select');
    }
  }, [hasHydrated, campaignId, router]);

  useEffect(() => {
    if (hasHydrated && campaignId && !campaign) {
      hydrateCampaign(chapter1Campaigns[campaignId]);
    }
  }, [hasHydrated, campaignId, campaign, hydrateCampaign]);

  useEffect(() => {
    setReplayBriefing(false);
  }, [stageIndex]);

  useEffect(() => {
    if (campaign && stageIndex >= campaign.stages.length) {
      router.push('/debrief');
    }
  }, [campaign, stageIndex, router]);

  const stage = campaign?.stages[stageIndex];

  const arrivedEvents = useMemo(
    () => (campaign?.logCorpus ?? []).filter((event) => event.arrivesAtStage <= stageIndex),
    [campaign, stageIndex]
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

  if (!hasHydrated || !campaignId || !campaign || !stage) {
    return <AppFrame message="Loading active operation" />;
  }

  if (pendingStageResolution) return <StageResolutionScene />;

  if (replayBriefing || !seenBriefingIds.includes(stage.id)) {
    return <BriefingScene onBegin={() => setReplayBriefing(false)} />;
  }

  const decision = stage.decision;
  const decisionUnselected = Boolean(decision && !decisions[decision.id]);
  if (decision && (decisionUnselected || decisionSceneId === decision.id)) {
    return (
      <DecisionScene
        onSelected={() => setDecisionSceneId(decision.id)}
        onAcknowledge={() => setDecisionSceneId(null)}
      />
    );
  }

  const revealedSet = new Set(revealedFacts);
  const availableCommands = stage.commands.filter((command) =>
    (command.requiresFacts ?? []).every((factId) => revealedSet.has(factId))
  );

  const hasLogExplorer = (campaign.logCorpus?.length ?? 0) > 0;
  const hasAttackMap = (campaign.attackMap?.length ?? 0) > 0;
  const showTerminal = stage.commands.length > 0;

  return (
    <main className="app-shell flex flex-col gap-4 overflow-hidden p-5" aria-label="Mission workspace">
      <header className="grid grid-cols-[1fr_auto] items-center gap-6 border-b border-white/10 pb-4">
        <div>
          <h1 className="font-display text-xl font-bold uppercase tracking-[0.12em] text-slate-100">
            {campaign.title} <span className="text-mango-500">/</span> {stage.title}
          </h1>
          <div className="mt-3 max-w-2xl">
            <StageRail stages={campaign.stages} activeIndex={stageIndex} />
          </div>
        </div>
        <BriefingReplayButton onReplay={() => setReplayBriefing(true)} />
      </header>

      <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[3fr_1.35fr]">
        <div className="flex min-h-0 flex-col gap-4">
          {hasLogExplorer && (
            <Panel className="min-h-[26rem] flex-1 overflow-hidden p-3">
              <LogExplorer
                key={stage.id}
                events={arrivedEvents}
                ranges={campaign.timeRanges ?? []}
                timeRangeId={timeRangeId}
                query={activeQuery}
                suggestions={stage.suggestedQueries ?? []}
                hint={stage.hint}
                pinnedIds={pinnedEvidence}
                onQueryChange={setQuery}
                onTimeRangeChange={setTimeRange}
                onPin={pinEvent}
                onUnpin={unpinEvent}
              />
            </Panel>
          )}

          {showTerminal && (
            <Terminal
              history={terminalHistory}
              availableCommands={availableCommands}
              onSubmit={runCommand}
            />
          )}
        </div>

        <aside className="flex min-h-0 flex-col gap-4">
          <Panel className="p-3">
            {hasAttackMap ? (
              <AttackMap nodes={campaign.attackMap ?? []} facts={collectedFacts} />
            ) : (
              <ClusterDiagram
                highlightedNodeIds={highlightedNodeIds}
                revealedEdgeIds={revealedEdgeIds}
                status={clusterStatus}
              />
            )}
          </Panel>

          <Panel className="min-h-0 flex-1 overflow-y-auto p-4">
            {stage.objectiveSteps && (
              <div className="mb-5">
                <ObjectiveProgress
                  steps={stage.objectiveSteps}
                  facts={collectedFacts}
                  decisions={decisions}
                />
              </div>
            )}
            {hasLogExplorer ? (
              <CaseFile
                objective={stage.objective}
                pinnedEvents={pinnedEvents}
                facts={establishedFacts}
                onUnpin={unpinEvent}
              />
            ) : (
              <div>
                <h2 className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">Objective</h2>
                <p className="mt-2 text-sm leading-6 text-slate-100">{stage.objective}</p>
              </div>
            )}
          </Panel>
        </aside>
      </div>
    </main>
  );
}

export default function MissionPage() {
  return (
    <DesktopGate>
      <MissionExperience />
    </DesktopGate>
  );
}
