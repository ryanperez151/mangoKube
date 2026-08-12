# Operation Mango: SIEM Log Explorer & Attack Path Map — Design

## Overview

Chapter 1 ("Privileged Access") currently plays as a scripted terminal on both
sides. This build adds the two surfaces the original vision called for but never
got: a **guided, Splunk-style log exploration interface** and an **illustrated,
progressively-revealed attack path map**, and reworks the **Sentinel (defender)
campaign** around them. It also carries out the visual/cinematic pass on the
mission workspace.

The Infiltrator (attacker) campaign is unchanged in this build — attackers don't
read the defender's SIEM, and one polished defensive chapter is worth more than
two half-built ones.

Everything remains fully simulated client-side: no real Kubernetes cluster, no
backend, no network calls. Builds on the design in
`2026-07-23-mango-k8s-sim-design.md`.

## Motivation

The defender campaign's weakness is that it teaches command recall rather than
investigation. A defender learns by pivoting through evidence: seeing an alert,
finding the process behind it, pivoting to the identity, widening the time range,
and recognizing which line in a wall of benign noise is the one that matters.
A regex-matched terminal cannot teach that. A searchable log corpus can.

## Core Model: Evidence Is Found, Not Typed

The existing engine reveals facts by regex-matching a terminal command string.
That model does not transfer to a SIEM — it would reduce searching to guessing
the one blessed query. Instead:

**The logs are a real, searchable corpus, and progression comes from pinning the
right event.**

1. The player writes or builds a query. It filters a corpus of a few hundred
   structured log events.
2. *Any* query whose result set contains the signal event works. There is no
   phrasing lock-in.
3. The player identifies the anomalous line and **pins it to the case file**.
4. The pin reveals the fact, lights the corresponding attack-map node, and
   advances the objective when the stage's conditions are met.

Step 3 is the pedagogical core. The player does not advance by running a correct
command; they advance by *recognizing which log line is anomalous and saying so*.

### Pinning a benign event

Pinning is a judgment call, so it must be safe to get wrong. Pinning a benign
event adds it to the case file with an in-world analyst note explaining why it is
routine (a scheduled pipeline run, a normal image pull), and it can be unpinned.
There is no penalty, no score, and no lockout — the cost of a wrong pin is only
that it did not advance the investigation. Ruling evidence *out* is part of the
skill being taught.

### Noise is a feature

Most of the corpus is benign: real pipeline runs, healthy pod churn, routine API
traffic, normal image pulls. A test asserts signal events stay under ~5% of the
events visible at any stage. Noise is generated deterministically from a fixed
seed so tests and playthroughs are stable.

**Correction, recorded after implementation:** the ratio bound is necessary but
not sufficient, and this spec originally overclaimed it. A ratio bounds the
*volume* of signal, not its *distinguishability*. As shipped, no noise event
carries `severity: high`, and none carries `sourceIP`, `object`, `binding`,
`role`, or `detection` at all — so those fields act as perfect oracles: a single
`severity=high` returns only signal. Chapter 1 survives this because its guided
track never invites those queries, but the real criterion is **field overlap
between signal and noise**, and a future corpus should be tested for that rather
than for count alone. Treat widening the noise templates (varied pods,
namespaces, users, and benign `severity`/`sourceIP` values) as a prerequisite for
Chapter 2, not a Chapter 1 defect.

### Live incident, live index

Each event carries an `arrivesAtStage` field. The searchable index contains only
events with `arrivesAtStage <= currentStageIndex`, and new events stream in as
stages advance, surfaced by a live "N new events" indicator.

This is realistic — the attacker is still active while the defender hunts — and
it paces the narrative without artificially hiding data the player has earned
access to.

## Query Language

A small but genuine subset of Splunk-style search, chosen so what the player
learns transfers:

- **Field predicates:** `source=k8s-audit user=ci-deploy-bot verb=get`
  — multiple predicates AND together.
- **Quoted values:** `pod="ci-deploy-bot-7f9c4d6b6-x2k1p"`.
- **Negation:** `source=k8s-audit -user=system:kube-scheduler`.
- **Bare terms:** any unqualified token is a case-insensitive substring match
  across all field values.
- **Time range:** selected separately from the query string (presets plus a
  custom range), because widening the time range is itself a taught skill in
  Stage 2.

Aggregation (`| stats count by ...`) is deliberately **out of scope**. The parser
returns a structured AST so it can be added later without a rewrite, but nothing
in Chapter 1 needs it.

Unparseable queries produce an inline, friendly error naming the problem — never
a silent empty result set, which would be indistinguishable from "no matches."

## Guided, Not Hand-Holding

Three escalating layers, so a general-tech audience never dead-ends at an empty
search bar while an experienced player is never nagged:

1. **Suggested query chips** per stage. Clicking one inserts real query syntax
   into the bar rather than executing a hidden action — the player sees the
   syntax it produced and can edit it.
2. **A plain-language objective** always visible: what you are trying to
   establish, in incident-response terms, not command terms.
3. **An escalating hint**, offered only after repeated empty result sets, that
   names the field or source worth pivoting to.

## Architecture

Client-side only, no new dependencies.

### Engine

| Module | Responsibility |
|---|---|
| `src/engine/logQuery.ts` | Parse a query string into an AST; compile to a predicate; execute over the visible corpus |
| `src/engine/reachability.ts` | Extended: BFS over **both** terminal commands and pinnable events, preserving the soft-lock guarantee |
| `src/engine/store.ts` | Adds `pinnedEvidence`, `activeQuery`, `timeRange`, `queryHistory`; a unified `revealFact()` used by both the terminal and evidence pinning |

`revealFact()` becoming the single reveal path is the key refactor: today fact
reveal is inlined in `runCommand`. Both surfaces must converge on one code path
so stage-advance evaluation happens in exactly one place.

### Content types (`src/content/types.ts`)

New: `LogEvent`, `LogSource`, `QuerySuggestion`, `AttackMapNode`, `TimeRange`.
Extended: `Stage` gains `advanceWhen?: { facts: string[] }` and
`suggestedQueries?: QuerySuggestion[]`.

`Stage.advanceWhen` is evaluated after every fact reveal, which lets the SIEM
drive progression. The existing `CommandOutcome.advances` is retained for
terminal **response actions** in Stage 5. A stage may use either mechanism; the
reachability validator covers both.

Log sources modeled: `k8s-audit` (Kubernetes audit log), `edr` (endpoint/process
telemetry on containers, CrowdStrike-style), `apiserver` (API request log), and
`ci-cd` (build pipeline logs, where the supply-chain origin is visible).

### Components

Each is independently testable and consumes engine state via props:

- `src/components/LogExplorer/` — `SearchBar`, `QueryChips`, `Histogram`,
  `ResultsTable`, `EventDetail`, `PinButton`
- `src/components/AttackMap/` — the illustrated kill chain
- `src/components/CaseFile/` — pinned evidence and established facts

The mission workspace composes LogExplorer + AttackMap + CaseFile + Terminal.
`src/app/mission/page.tsx` is already at the edge of doing too much and gains a
layout shell so it stays a composition root rather than growing logic.

## Reworked Sentinel Arc

Four stages hunted in the SIEM, one acted out in the terminal.

**Stage 1 — Triage.** *Confirm the alert and identify the source workload.* EDR
telemetry shows `/bin/sh` spawned under a non-CI parent inside the
`ci-deploy-bot` pod at 02:14 UTC, corroborated by an audit-log `create` on the
`pods/exec` subresource. Teaches: pivoting from an alert to the container behind
it.

**Stage 2 — Identity & Blast Radius.** *Whose identity is this, and what can it
do?* Pivoting from pod to service account surfaces
`system:serviceaccount:build:ci-deploy-bot` acting far outside build scope.
Widening the time range surfaces the binding's creation **fourteen months
earlier**, annotated `jenkins-migration-2024`. Teaches: the misconfiguration long
predates the breach, and time-range discipline is what reveals it.

**Stage 3 — Scope the Damage.** *What did they actually reach?* A `get` on the
`ultra-mango-genome-db` secret at 02:15:12, corroborated by EDR egress to
`203.0.113.44`. Teaches: correlating control-plane access with endpoint egress to
establish that data actually left.

**Stage 4 — Hunt Persistence.** *What did they leave behind?* A rogue
`log-rotator` service account and `log-rotator-admin` cluster-admin binding
created at 02:31 in `kube-system`.

Stage 4 is the load-bearing lesson of the chapter. The briefing deliberately
tempts the player to contain immediately; containing before the persistence is
found does not actually evict the attacker. The stage is structured so the player
feels that pressure and the debrief names it explicitly.

**Stage 5 — Contain & Eradicate.** *Cut both paths and rotate what leaked.*
Terminal response actions: delete both cluster role bindings, delete the rogue
service account, remove the implant pod, rotate the exposed secret. Advances via
the existing `CommandOutcome.advances` mechanism.

The debrief gains a detection-engineering section: what a real alerting rule for
this attack chain looks like, expressed in plain language alongside the audit-log
fields it keys on.

## Visual Direction

The attack map is drawn as a **mango branch**. The trunk is initial access — the
poisoned CI image from the supply-chain compromise — and the kill chain extends
outward limb by limb, tactic by tactic. The fruit at the end of the branch is the
crown jewel: the Ultra Mango cultivar genome.

Node state reads as the health of the tree:

| State | Appearance |
|---|---|
| Undiscovered | Dim silhouette |
| Suspected | Amber outline |
| Confirmed | Lit, with blight creeping along that limb |
| Contained | Limb pruned clean |

Every confirmed node is clickable, showing what happened, the pinned evidence
that proved it, and the real-world lesson with its prevention.

Palette: a deep night-orchard ground under the existing mango amber accents, leaf
green for nominal and contained states, blight red for compromised. Monospace for
logs and terminal; a display face for briefings and stage titles.

Framer Motion carries the cinematic beats: pinned evidence animates from the log
row into the case file, map nodes ignite with a glow as they are proven, and
stage transitions push through the briefing overlay.

Accessibility is not sacrificed to the cinematics: node state is conveyed by
label and shape as well as color, the results table is keyboard-navigable,
evidence can be pinned from the keyboard, and motion respects
`prefers-reduced-motion`.

## Testing

The primary risk remains broken narrative state, now across two surfaces.

- **Soft-lock guarantee (extended).** `findAdvancePath` performs BFS over both
  terminal commands and pinnable events, so every stage is provably completable
  from its starting state. Enforced per stage for all real content.
- **Query parser unit tests.** Field predicates, multi-field AND, quoted values,
  negation, bare-term substring matching, malformed input producing a named
  error.
- **Corpus integrity.** Every `revealsFact` on an event resolves to a
  `factLibrary` entry; every fact in a stage's `advanceWhen` is reachable from
  events visible at that stage's data horizon (`arrivesAtStage <= stageIndex`) or
  from a command available in that stage.
- **Noise ratio.** Signal events stay under 5% of the events visible at each
  stage.
- **Attack map integrity.** Every node's `revealedByFacts` resolves to a real
  fact; every fact maps to a node or is explicitly marked unmapped.
- **Component tests.** The query → results → pin → fact-revealed flow, and the
  attack map rendering each node state.
- **Manual playtest** of the full Sentinel campaign, plus a regression pass on
  Infiltrator to confirm the `revealFact()` refactor left it intact.

## Scope

**In scope:** the log explorer, the attack path map, the reworked Sentinel
campaign, the `revealFact()` engine refactor, and the visual/cinematic pass on
the mission workspace.

**Out of scope:** changes to the Infiltrator campaign beyond what the engine
refactor requires; query aggregation (`| stats`); Chapters 2+; any backend,
save-sync, or scoring.

## Deviations From This Spec, As Shipped

Recorded so this document is not later read as a list of missing features:

- **`queryHistory` was not implemented.** It is named in the architecture table
  above, but nothing needed it. The store persists `activeQuery` only.
- **Time ranges shipped as presets only**, without the custom range this spec
  mentions. The four presets carry the Stage 2 lesson on their own.
- **`PinButton` was folded into `EventDetail`** rather than shipping as its own
  component; pinning is the detail panel's only action.
- **The motion beats shipped as a slide-in and a scale pulse**, rather than the
  literal "flies from the log row into the case file" and "ignites with a glow"
  described above. Both are gated on `prefers-reduced-motion`.
- **`deriveNodeState` lives in `src/engine/attackMap.ts`**, not in the chapter's
  content module, so a component never reaches into one chapter's data for
  shared logic.
