# Task 2 Report: Chapter 1 Content Migration and Consequential Decisions

## Delivered

- Migrated both Chapter 1 campaigns to the Task 1 content contracts:
  - campaign role metadata (fantasy, primary mechanic, learning focus);
  - fact-backed objective steps;
  - exactly three staged guidance tiers per stage;
  - a stage resolution for every stage; and
  - deterministic `advanceWhen` fact completion for every real stage.
- Removed `CommandOutcome.advances` and legacy Sentinel suggested-query/hint content from real campaign content.
- Added Sentinel's `containment-timing` decision after Scope the Damage.
  - `contain-now` applies `revoked-primary-binding`, hides the now-complete primary-binding objective/response command, and exposes a choice-visible rogue-identity pivot.
  - `hunt-first` preserves the evidence-first log-rotator path and the complete original response order.
  - Both branches supply conditional briefing, resolution, and debrief outcomes.
- Added Infiltrator's `operational-order` decision before Escalation.
  - `exfil-first` orders genome theft before persistence.
  - `persistence-first` orders service-account creation and binding before genome theft.
  - Choice-visible commands and fact prerequisites make both paths converge on the same escalation facts.
- Preserved corpus signal ratio checks and attack-map fact integrity. The attack-map persistence summary is route-neutral, and early containment pivot events are attributed to an external session using credentials captured before revocation rather than the revoked CI identity.
- Updated mission integration setup to choose the expected Sentinel content route before pinning route-visible persistence events.

## Strict TDD Evidence

1. Added campaign contract and decision-reachability tests in both campaign reachability suites before content implementation.
2. Focused RED command:

   ```text
   npm test -- src/content/chapter1/sentinel.reachability.test.ts src/content/chapter1/infiltrator.reachability.test.ts
   ```

   Initial RED observed expected failures for missing campaign role metadata, absent Sentinel decision effect, absent choice-visible pivot logs, and Infiltrator's unchanged escalation order/facts. The first run also caught and corrected a test syntax error before behavioral RED verification.
3. Implemented the minimum campaign/log content needed for those contracts; focused GREEN result: 2 files, 10 tests passed.
4. Content validation then exposed the existing global signal-event uniqueness invariant: mutually exclusive branch events intentionally reveal the same facts. Root cause was that the old invariant evaluated all mutually exclusive events together. The test was updated to prove uniqueness on each selected containment route, preserving the per-route corpus guarantee. GREEN result: 5 content files, 32 tests passed.
5. The full suite exposed a Sentinel mission-test fixture that pinned choice-visible rogue logs without choosing a decision. The test now explicitly selects `hunt-first`, which reflects the deferred decision UI contract while exercising the existing store API. Focused GREEN: mission page 10 tests passed.
6. Independent review identified two content defects. Added failing tests, then corrected both:
   - early-containment pivot logs now attribute to `external-operator@203.0.113.44`, an external session with credentials captured before the revoke;
   - the attack-map persistence summary no longer names a route-specific identity.
   Focused GREEN: 2 files, 13 tests passed.

## Final Verification

Executed after the final corrections:

```text
npm run validate:content
# 5 files, 34 tests passed

npm test -- src/engine/reachability.test.ts src/engine/store.test.ts src/engine/terminalParser.test.ts
# 3 files, 45 tests passed

npm test
# 24 files, 185 tests passed

npx tsc --noEmit
# passed

git diff --check
# passed
```

## Self-Review

- Searched real Chapter 1 content for `advances: true`, `suggestedQueries:`, and `hint:`; none remain.
- Verified each campaign stage declares role-adjacent content contracts and a non-empty `advanceWhen` fact list.
- Verified reachability proves both Sentinel choices and both Infiltrator choices, including decision-effect facts and choice-visible events/commands.
- Verified conditional signal facts resolve per decision route, attack-map references remain valid, and corpus signal-ratio tests pass.
- Independent review findings were resolved except the intentionally deferred shared decision UI integration.

## Concern / Cross-Task Dependency

The current mission page does not yet render decision selection or conditional copy. This is intentionally deferred to Task 3 (`DecisionScene`) and Task 4 (mission-mode wiring), per coordinator confirmation. Task 2 proves route accessibility at the content/engine reachability layer by passing explicit decision selections and effect facts; the UI will make those routes selectable in the later tasks.

## Commit

`feat: migrate chapter one cinematic content`
