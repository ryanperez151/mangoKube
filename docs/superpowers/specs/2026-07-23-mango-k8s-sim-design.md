# Operation Mango: Cinematic Kubernetes Attack/Defense Simulation — Design

## Overview

A cinematic, fictional website simulation for learning Kubernetes attack and
defense concepts. The player experiences a corporate-espionage thriller set
at **MangoCorp**, a fictional agri-tech company running its logistics on
Kubernetes, and either infiltrates or defends its cluster during a
supply-chain-driven breach.

This spec covers **Chapter 1: "Privileged Access"** — an RBAC
misconfiguration / privilege-escalation storyline — built on an engine
designed to support future chapters without rework.

Fidelity: **fully simulated in-browser.** No real Kubernetes clusters, no
backend. Terminal, cluster diagrams, and outcomes are all scripted/mocked
client-side. Audience is a mixed/general tech audience (concepts introduced
as they come up, not assuming deep prior K8s knowledge).

## Narrative

**World:** MangoCorp, a fictional agri-tech company, runs its global
distribution logistics on Kubernetes. Its rival, **Citrus Dynamics**, wants
MangoCorp's intellectual property (the "Ultra Mango" cultivar
genome/proprietary blend formula) and a foothold for future operations.

**Initial access (backstory, not played):** A supply-chain compromise — a
poisoned dependency or base image in MangoCorp's CI/CD pipeline — planted a
dormant implant in the cluster. An Initial Access Broker sold that foothold
to Citrus Dynamics, who contracted a cybercrime crew to run the actual
operation. The player picks up **mid-breach**, from the already-dropped
shell.

**Branching campaigns**, same incident, opposite sides:

- **Infiltrator** — the hired cybercrime operator. Objectives: locate and
  exfiltrate MangoCorp's IP, and establish persistence (rogue service
  account, hidden CronJob, backdoor) for Citrus Dynamics' future ops.
- **Sentinel** — MangoCorp's security engineer, alerted to anomalous
  activity from a pod tied to the compromised image. Objectives: trace the
  activity back to the implant, contain the misused RBAC permissions, find
  and remove any persistence, and protect the IP before exfiltration.

Both campaigns share the same five-stage arc, told from opposite
perspectives:

1. **Recon** — dropped into a shell (attacker) or an alert/ticket
   (defender); gather intel on the cluster.
2. **Discovery** — find the over-permissioned service account/token.
3. **Exploit / Detect** — attacker uses the misconfig; defender catches it.
4. **Escalation** — attacker climbs toward cluster-admin; defender races to
   lock it down.
5. **Impact/Consequence** — cinematic payoff tied to what the player did
   (breach succeeds, is contained, IP stolen or protected, persistence
   planted or removed).

**Debrief** after the chapter: narrative wrap-up, a plain-language "Real-World
Lesson" panel explaining the actual Kubernetes security concept, and a
teaser for the next chapter (locked/"coming soon").

**Future chapters** (later builds, same engine): breakout/lateral movement,
supply-chain compromise (playing out the initial access itself) and
policy/admission-control defense, and detection/incident-response. Citrus
Dynamics and the cybercrime crew are recurring antagonists across chapters.

## Architecture & Tech Stack

Pure client-side, data-driven — no backend required:

- **Next.js (static export) + React + TypeScript.**
- **State/progress:** Zustand, persisted to `localStorage` (campaign
  choice, current stage, discovered facts, terminal history) so a session
  can resume.
- **Cinematics:** Framer Motion for scene transitions, briefing overlays,
  and animated SVG-based cluster diagrams that update live as the story
  progresses (e.g., a pod highlights once compromised, an RBAC edge appears
  once discovered).
- **Terminal engine:** custom component, not a real shell. Parses a
  constrained command grammar (e.g. `kubectl get pods`,
  `kubectl describe sa ...`) with autocomplete/hints, mapping recognized
  commands to scripted, story-relevant output. Plausible-but-unrecognized
  commands get in-world flavor responses rather than hard errors.
- **Content model:** missions/stages/dialogue/terminal-scripts are
  structured TypeScript/JSON data driving a generic scene engine, so future
  chapters are new data files, not engine changes.

Rejected alternatives: a real backend (save-sync/leaderboards/multiplayer —
unnecessary for a single-player simulated experience, can bolt on later);
a canvas/WebGL game-engine renderer (higher build cost for marginal
cinematic gain over well-animated SVG/DOM).

## Screen Flow

1. **Landing/briefing** — MangoCorp world intro, stakes, "Continue
   investigation" if a save exists.
2. **Campaign select** — Infiltrator vs Sentinel (locked in per
   playthrough; restart to try the other side).
3. **Stage briefing overlays** — short cinematic dialogue/cutscene before
   each of the 5 stages (handler dialogue for Infiltrator, alert/ticket for
   Sentinel).
4. **Mission workspace** — core screen: hybrid terminal (main) + animated
   cluster diagram (side/top) that updates live as commands reveal or
   change cluster state.
5. **Debrief** — narrative wrap-up + "Real-World Lesson" panel + next-
   chapter teaser (locked).

## Content Model

Drives the scene engine so future chapters require no engine changes:

- `campaign` → ordered list of `stages`.
- `stage` → briefing dialogue, objectives, cluster-diagram state deltas,
  and a `commandTree` (valid commands/flags → output + side effects, e.g.
  "reveals a fact" or "advances stage").
- `facts` — discovered intel (e.g. "found over-permissioned SA
  `ci-deploy-bot`") that gate later commands and populate the debrief.
- Persistence keyed to campaign + stage index in `localStorage`.

## Testing/Validation Approach

Primary risk is broken narrative state (soft-locks), not traditional logic
bugs:

- Lightweight tests validating every stage's `commandTree` has a valid path
  to completion/advancement.
- Manual playtesting of both campaigns end-to-end in the browser before
  calling Chapter 1 done.

## Scope of This Build

In scope: Chapter 1 ("Privileged Access") only, both campaigns, full engine
per above. Out of scope (future work): Chapters 2+ (breakout, supply-chain,
detection/IR), any backend/save-sync, multiplayer, or scoring/grading
(debrief is narrative + educational only, no scores).
