'use client';

import { useEffect, useMemo, useRef } from 'react';
import { resolveConditionalCopy } from '@/engine/conditions';
import { useSimStore } from '@/engine/store';
import {
  ActionButton,
  LiveFeedback,
  Notice,
  Panel,
  SceneShell,
  StatusBadge,
} from './Cinematic';

export function BriefingScene({ onBegin }: { onBegin?: () => void }) {
  const campaign = useSimStore((state) => state.campaign);
  const stageIndex = useSimStore((state) => state.stageIndex);
  const decisions = useSimStore((state) => state.decisions);
  const markBriefingSeen = useSimStore((state) => state.markBriefingSeen);
  const stage = campaign?.stages[stageIndex];

  const lines = useMemo(
    () => [
      ...(stage?.briefing ?? []),
      ...resolveConditionalCopy(stage?.conditionalBriefing, decisions),
    ],
    [stage, decisions]
  );

  if (!campaign || !stage) {
    return (
      <SceneShell label="Operation briefing" eyebrow="Briefing" title="Briefing unavailable">
        <Notice title="Mission data unavailable" tone="error">
          Return to role selection and begin the operation again.
        </Notice>
      </SceneShell>
    );
  }

  function begin() {
    if (!stage) return;
    markBriefingSeen(stage.id);
    onBegin?.();
  }

  return (
    <SceneShell
      label="Operation briefing"
      eyebrow={`Stage ${stageIndex + 1} / ${campaign.stages.length}`}
      title={stage.title}
      footer={<ActionButton onClick={begin}>Begin</ActionButton>}
    >
      <div className="grid gap-8 lg:grid-cols-[1.45fr_0.75fr]">
        <div className="space-y-4 text-lg leading-8 text-slate-300">
          {lines.map((line, index) => (
            <p key={`${stage.id}-${index}`}>{line}</p>
          ))}
        </div>
        <Panel className="self-start bg-white/[0.025] p-5">
          <StatusBadge>Active objective</StatusBadge>
          <p className="mt-4 text-base leading-7 text-slate-100">{stage.objective}</p>
        </Panel>
      </div>
    </SceneShell>
  );
}

export function BriefingReplayButton({ onReplay }: { onReplay: () => void }) {
  return (
    <ActionButton variant="quiet" onClick={onReplay}>
      Replay briefing
    </ActionButton>
  );
}

export function DecisionScene({
  onSelected,
  onAcknowledge,
}: {
  onSelected?: () => void;
  onAcknowledge?: () => void;
}) {
  const campaign = useSimStore((state) => state.campaign);
  const stageIndex = useSimStore((state) => state.stageIndex);
  const decisions = useSimStore((state) => state.decisions);
  const chooseDecision = useSimStore((state) => state.chooseDecision);
  const decision = campaign?.stages[stageIndex]?.decision;
  const selectedId = decision ? decisions[decision.id] : undefined;
  const selected = decision?.options.find((option) => option.id === selectedId);
  const consequenceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selected) consequenceRef.current?.focus();
  }, [selected]);

  if (!campaign || !decision) {
    return (
      <SceneShell label="Mission decision" eyebrow="Decision" title="No active decision">
        <Notice title="No decision required">Return to the active workspace.</Notice>
      </SceneShell>
    );
  }

  function select(optionId: string) {
    chooseDecision(decision!.id, optionId);
    onSelected?.();
  }

  return (
    <SceneShell
      label="Mission decision"
      eyebrow={`Stage ${stageIndex + 1} / ${campaign.stages.length}`}
      title="Command decision"
      footer={
        selected && onAcknowledge ? (
          <ActionButton onClick={onAcknowledge}>Enter workspace</ActionButton>
        ) : undefined
      }
    >
      <p className="max-w-3xl text-xl leading-8 text-slate-200">{decision.prompt}</p>
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {decision.options.map((option, index) => (
          <button
            key={option.id}
            type="button"
            disabled={Boolean(selected)}
            aria-pressed={selectedId === option.id}
            onClick={() => select(option.id)}
            className="group border border-white/[0.12] bg-white/[0.025] p-5 text-left transition-colors hover:border-mango-500/50 hover:bg-mango-500/[0.06] disabled:cursor-default disabled:opacity-55 aria-pressed:border-leaf-500/50 aria-pressed:bg-leaf-500/[0.07]"
          >
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-mango-300">
              Option {String.fromCharCode(65 + index)}
            </span>
            <span className="mt-3 block font-display text-2xl font-bold uppercase tracking-[0.06em] text-slate-100">
              {option.label}
            </span>
            <span className="mt-3 block text-sm leading-6 text-slate-400">{option.description}</span>
          </button>
        ))}
      </div>
      {selected && (
        <div
          ref={consequenceRef}
          role="status"
          tabIndex={-1}
          className="mt-6 border border-leaf-500/40 bg-leaf-500/[0.07] p-5 text-leaf-300"
        >
          <StatusBadge tone="established">Decision locked</StatusBadge>
          <p className="mt-3 font-display text-xl font-bold uppercase tracking-[0.05em]">
            {selected.label}
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-300">{selected.description}</p>
        </div>
      )}
      <LiveFeedback>{selected ? `${selected.label} selected. ${selected.description}` : ''}</LiveFeedback>
    </SceneShell>
  );
}

export function StageResolutionScene() {
  const campaign = useSimStore((state) => state.campaign);
  const stageIndex = useSimStore((state) => state.stageIndex);
  const pending = useSimStore((state) => state.pendingStageResolution);
  const decisions = useSimStore((state) => state.decisions);
  const continueFromResolution = useSimStore((state) => state.continueFromResolution);
  const stage = campaign?.stages[stageIndex];
  const resolution = stage?.resolution;
  const conditional = resolveConditionalCopy(resolution?.conditionalSummary, decisions);

  if (!campaign || !stage || !pending || pending.stageId !== stage.id) {
    return (
      <SceneShell label="Stage resolution" eyebrow="Resolution" title="Resolution unavailable">
        <Notice title="Stage state unavailable" tone="error">
          Return to the active operation and complete the current objective.
        </Notice>
      </SceneShell>
    );
  }

  function continueOperation() {
    continueFromResolution();
    queueMicrotask(() => document.querySelector<HTMLElement>('[data-scene-focus]')?.focus());
  }

  return (
    <SceneShell
      label="Stage resolution"
      eyebrow={`Stage ${stageIndex + 1} complete`}
      title={resolution?.title ?? `${stage.title} complete`}
      footer={<ActionButton onClick={continueOperation}>Continue operation</ActionButton>}
    >
      <StatusBadge tone="established">Objective established</StatusBadge>
      <div className="mt-6 max-w-3xl space-y-4 text-lg leading-8 text-slate-300">
        {(resolution?.summary ?? ['Stage objectives complete.']).map((line, index) => (
          <p key={`summary-${index}`}>{line}</p>
        ))}
        {conditional.map((line, index) => (
          <p key={`conditional-${index}`} className="border-l-2 border-leaf-500/50 pl-4 text-slate-100">
            {line}
          </p>
        ))}
      </div>
    </SceneShell>
  );
}
