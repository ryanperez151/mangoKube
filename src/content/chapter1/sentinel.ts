import type { Campaign } from '../types';
import { sentinelAttackMap } from './attackMap';
import { COLUMN_PRESETS, sentinelLogCorpus, TIME_RANGES } from './logs';
import { sentinelPrimer } from './primer';

const IMPLANT_POD = 'ci-deploy-bot-7f9c4d6b6-x2k1p';

export const sentinelCampaign: Campaign = {
  id: 'sentinel',
  title: 'The Sentinel',
  tagline: "You're MangoCorp security, first on the scene of a live incident.",
  role: {
    fantasy: 'Incident commander racing a live Kubernetes intrusion.',
    primaryMechanic: 'Corroborate SIEM evidence, then execute a fact-gated containment runbook.',
    learningFocus: 'Least-privilege RBAC, evidence corroboration, and persistence-aware containment.',
  },
  primer: sentinelPrimer,
  logCorpus: sentinelLogCorpus,
  attackMap: sentinelAttackMap,
  timeRanges: TIME_RANGES,
  columnPresets: COLUMN_PRESETS,
  factLibrary: {
    'evidence-interactive-shell': { id: 'evidence-interactive-shell', label: 'Interactive shell in a build pod', detail: 'EDR caught /bin/sh running inside ci-deploy-bot under the build agent. CI jobs are scripted and non-interactive — this was a person.' },
    'evidence-offhours-exec': { id: 'evidence-offhours-exec', label: 'Off-hours exec from an external IP', detail: 'The audit log shows create pods/exec at 02:14 UTC from 203.0.113.44, using the ci-deploy-bot service account. No pipeline runs in that window.' },
    'evidence-sa-identity': { id: 'evidence-sa-identity', label: 'Build account acting cluster-wide', detail: 'ci-deploy-bot listed secrets across every namespace — far outside anything a build job needs.' },
    'evidence-clusteradmin-binding': { id: 'evidence-clusteradmin-binding', label: 'Bound to cluster-admin', detail: 'The authorizer named ci-deploy-bot-binding as the rule that allowed it: a direct binding to the built-in cluster-admin ClusterRole.' },
    'evidence-binding-origin': { id: 'evidence-binding-origin', label: 'Binding predates the breach by 14 months', detail: 'ci-deploy-bot-binding was created on 2025-06-14 by the jenkins-migration-2024 script and never revisited.' },
    'evidence-secret-read': { id: 'evidence-secret-read', label: 'Cultivar genome secret read', detail: 'A successful get on secrets/ultra-mango-genome-db in the product namespace at 02:15:12, by the build service account.' },
    'evidence-exfil-egress': { id: 'evidence-exfil-egress', label: 'Data left the cluster', detail: '2.8 MB egressed from the build pod to 203.0.113.44 at 02:16:40 — the same address that opened the shell.' },
    'evidence-rogue-sa': { id: 'evidence-rogue-sa', label: 'Rogue service account planted', detail: 'An attacker-created service account appeared in kube-system under a maintenance-sounding name, giving the intrusion a quieter identity.' },
    'evidence-rogue-binding': { id: 'evidence-rogue-binding', label: 'Second cluster-admin binding', detail: 'The planted account received its own cluster-admin binding — a way back in that survives revoking ci-deploy-bot.' },
    'revoked-primary-binding': { id: 'revoked-primary-binding', label: 'Primary binding revoked', detail: 'ci-deploy-bot-binding is deleted. The build account is no longer cluster-admin.' },
    'revoked-persistence-binding': { id: 'revoked-persistence-binding', label: 'Persistence binding revoked', detail: 'The attacker-created cluster-admin binding is deleted. The secondary path is closed.' },
    'removed-rogue-sa': { id: 'removed-rogue-sa', label: 'Rogue account removed', detail: 'The attacker-created service account no longer exists in kube-system.' },
    'removed-implant-pod': { id: 'removed-implant-pod', label: 'Implant pod removed', detail: 'The compromised ci-deploy-bot pod is gone. Its replacement comes from the same image, so the pipeline still needs fixing.' },
    'rotated-secret': { id: 'rotated-secret', label: 'Exposed secret rotated', detail: 'ultra-mango-genome-db has been re-issued. The copy the attacker took no longer opens anything.' },
  },
  stages: [
    {
      id: 'triage', title: 'Triage',
      briefing: ["Ticket #4471, auto-raised 12 minutes ago: 'Anomalous process activity in a build-namespace container.'", 'Overnight tickets are usually a flaky job or a bad deploy. You open the log console to rule it out.'],
      objective: 'Confirm the alert is real and identify the workload behind it.',
      objectiveSteps: [
        { id: 'confirm-shell', label: 'Confirm an interactive shell ran in the workload.', requiresFacts: ['evidence-interactive-shell'] },
        { id: 'corroborate-exec', label: 'Corroborate it with an off-hours exec record.', requiresFacts: ['evidence-offhours-exec'] },
      ],
      guidance: [
        {
          level: 1,
          lines: [
            'Two systems watched this from different angles: one inside the container, one at the cluster API. You want both to agree before calling it an intrusion.',
            'Start with whichever one has already raised its hand.',
          ],
        },
        {
          level: 2,
          lines: [
            'The endpoint source records processes starting inside containers and stamps a severity on the ones it considers dangerous — the fastest route to whatever opened this ticket.',
            'Then corroborate. If someone opened a shell, the cluster API should also hold the exec request that created it: same pod, same minute, different system.',
          ],
        },
        {
          level: 3,
          lines: [
            'Search `source=edr severity=high` to find the shell, then `source=k8s-audit resource=pods/exec` for the API call that asked for it.',
            'Pin both. One is what happened inside the container; the other is who requested it, and from where.',
          ],
          insertText: 'source=edr severity=high',
        },
      ],
      resolution: { title: 'Confirmed intrusion', summary: ['Two independent sources agree: this is an interactive intrusion, not a broken build.'] },
      clusterInitial: { status: 'nominal' }, advanceWhen: { facts: ['evidence-interactive-shell', 'evidence-offhours-exec'] }, commands: [],
    },
    {
      id: 'identity', title: 'Identity & Blast Radius',
      briefing: ["You: Someone opened a shell in a build pod at two in the morning. That's real.", 'You: Before anything else — what identity were they using, and what does that identity let them touch?'],
      objective: 'Establish which account the activity ran as, and how much access it had.',
      objectiveSteps: [
        { id: 'find-identity', label: 'Establish the build account acting outside its scope.', requiresFacts: ['evidence-sa-identity'] },
        { id: 'find-binding', label: 'Identify the cluster-admin binding that empowered it.', requiresFacts: ['evidence-clusteradmin-binding'] },
        { id: 'trace-origin', label: 'Trace when the dangerous binding entered the cluster.', requiresFacts: ['evidence-binding-origin'] },
      ],
      guidance: [
        {
          level: 1,
          lines: [
            'You know something ran. Now establish what it ran as — and then the more important question, which is what that identity was allowed to do.',
            'The account name will look unremarkable. The permissions attached to it are where this stops being routine.',
          ],
        },
        {
          level: 2,
          lines: [
            'Filter on the account you saw in the exec record and watch what it touched. A build account operating across every namespace at once is the anomaly, not the account itself.',
            'Then let the cluster explain its own decision: the authorization source records which RBAC rule permitted a request, and names the binding outright.',
            'One thing you need here is older than the window you are looking at.',
          ],
        },
        {
          level: 3,
          lines: [
            'Search `user=ci-deploy-bot` for what it touched, then `source=apiserver decision=allow` to get the binding by name.',
            'For where that binding came from, switch the time range to All time and search `resource=clusterrolebindings`. It was created fourteen months ago, so the default one-hour window hides it completely — your query is not wrong, your window is.',
          ],
          insertText: 'user=ci-deploy-bot',
        },
      ],
      resolution: { title: 'Blast radius established', summary: ['A migration-era cluster-admin binding turned one build workload into a whole-cluster incident.'] },
      clusterInitial: { status: 'suspicious' }, advanceWhen: { facts: ['evidence-sa-identity', 'evidence-clusteradmin-binding', 'evidence-binding-origin'] }, commands: [],
    },
    {
      id: 'scope', title: 'Scope the Damage',
      briefing: ['You: A build account with cluster-admin. Fourteen months old.', 'You: Before we act, tell me what they reached — and whether it left the cluster.'],
      objective: 'Determine what was accessed, and whether it left the cluster.',
      objectiveSteps: [
        { id: 'prove-secret-read', label: 'Prove the genome secret was read.', requiresFacts: ['evidence-secret-read'] },
        { id: 'prove-egress', label: 'Prove the data crossed the cluster boundary.', requiresFacts: ['evidence-exfil-egress'] },
      ],
      guidance: [
        {
          level: 1,
          lines: [
            'Two separate questions, and answering them as one is the mistake: what did they reach, and did any of it actually leave the cluster?',
          ],
        },
        {
          level: 2,
          lines: [
            'The audit log proves the read — a get against the secret, with a success code on it. That establishes access, and nothing more.',
            'It physically cannot tell you whether the data left. Only the endpoint source sees outbound connections, and it records the destination and how many bytes went to it.',
          ],
        },
        {
          level: 3,
          lines: [
            'Search `source=k8s-audit resource=secrets` for the read, then `source=edr remoteIP=203.0.113.44` for the transfer out.',
            'Note the destination is the same address that opened the shell — that is what turns two events into one story.',
          ],
          insertText: 'source=k8s-audit resource=secrets',
        },
      ],
      decision: {
        id: 'containment-timing', timing: 'after-stage', prompt: 'The account is still active. Contain immediately or hunt the likely persistence first?',
        options: [
          { id: 'contain-now', label: 'Contain now', description: 'Cut ci-deploy-bot off now; accept that the attacker may react.', effects: { revealsFacts: ['revoked-primary-binding'], clusterDelta: { status: 'compromised' } } },
          { id: 'hunt-first', label: 'Hunt persistence', description: 'Preserve the entry path long enough to expose the attacker’s second identity.' },
        ],
      },
      resolution: {
        title: 'Damage scoped', summary: ['The genome was read and then sent to the same external address that opened the shell.'],
        conditionalSummary: [
          { when: { 'containment-timing': 'contain-now' }, lines: ['You revoke the primary binding. The attacker now knows the incident is live.'] },
          { when: { 'containment-timing': 'hunt-first' }, lines: ['You hold the primary binding for one more controlled step to reveal persistence.'] },
        ],
      },
      clusterInitial: { status: 'suspicious' }, advanceWhen: { facts: ['evidence-secret-read', 'evidence-exfil-egress'] }, commands: [],
    },
    {
      id: 'persistence', title: 'Hunt Persistence',
      briefing: ['You: The genome data is gone. The next question is whether they left a way back in.'],
      conditionalBriefing: [
        { when: { 'containment-timing': 'contain-now' }, lines: ['The primary binding disappeared at 02:18. At 02:31 the attacker pivots: a new maintenance-looking identity appears in kube-system.'] },
        { when: { 'containment-timing': 'hunt-first' }, lines: ['You keep watching. With their original access still open, the attacker quietly plants a maintenance-looking identity in kube-system.'] },
      ],
      objective: 'Find what the attacker created before you close every path down.',
      objectiveSteps: [
        { id: 'find-rogue-account', label: 'Find the attacker-created service account.', requiresFacts: ['evidence-rogue-sa'] },
        { id: 'find-rogue-binding', label: 'Find the binding that gives it cluster-admin.', requiresFacts: ['evidence-rogue-binding'] },
      ],
      guidance: [
        {
          level: 1,
          lines: [
            'An intruder holding cluster-admin has no further need of the pod you found them in. They can simply issue themselves a new identity.',
            'Assume they did, and go looking for it before you close anything down.',
          ],
        },
        {
          level: 2,
          lines: [
            'New objects mean create verbs. The namespace worth searching is kube-system, where cluster-wide machinery lives and a maintenance-sounding name draws no attention.',
            'There are two objects to find, not one: the account, and the binding that gives it power. The binding is the half that actually matters — an account with no binding can do nothing.',
          ],
        },
        {
          level: 3,
          lines: [
            'Search `source=k8s-audit verb=create namespace=kube-system` for what they made, then `resource=clusterrolebindings verb=create` for the binding that empowered it.',
          ],
          insertText: 'source=k8s-audit verb=create namespace=kube-system',
        },
      ],
      resolution: { title: 'Persistence located', summary: ['The attacker created a second cluster-admin path. Removing only ci-deploy-bot would not have evicted them.'] },
      clusterInitial: { status: 'compromised' }, advanceWhen: { facts: ['evidence-rogue-sa', 'evidence-rogue-binding'] }, commands: [],
    },
    {
      id: 'containment', title: 'Contain & Eradicate',
      briefing: ['Response console unlocked. Take bindings before accounts, or an account can recreate what you delete.'],
      conditionalBriefing: [
        { when: { 'containment-timing': 'contain-now' }, lines: ['ci-deploy-bot is already powerless. The attacker’s pivot identity is the remaining privilege path.'] },
        { when: { 'containment-timing': 'hunt-first' }, lines: ['Two cluster-admin paths are live: the original and the one the attacker planted. Close both in order.'] },
      ],
      objective: 'Seal every active privilege path and rotate exposed material.',
      objectiveSteps: [
        { id: 'revoke-primary-binding', label: 'Revoke the original ci-deploy-bot binding.', requiresFacts: ['revoked-primary-binding'], visibleWhen: { 'containment-timing': 'hunt-first' } },
        { id: 'revoke-persistence-binding', label: 'Revoke the attacker-created cluster-admin binding.', requiresFacts: ['revoked-persistence-binding'] },
        { id: 'remove-rogue-account', label: 'Remove the now-powerless rogue account.', requiresFacts: ['removed-rogue-sa'] },
        { id: 'remove-implant', label: 'Remove the compromised workload.', requiresFacts: ['removed-implant-pod'] },
        { id: 'rotate-secret', label: 'Rotate the stolen genome secret.', requiresFacts: ['rotated-secret'] },
      ],
      guidance: [
        {
          level: 1,
          lines: [
            'Order matters more than speed here. Anything still holding cluster-admin can recreate whatever you delete, so privilege paths come first and artifacts come last.',
          ],
        },
        {
          level: 2,
          lines: [
            'Delete bindings before the accounts they point at. A binding is what grants the power; an orphaned account is harmless, but an empowered one can rebuild everything you just removed.',
            'Then the account, then the compromised workload, and the exposed secret last — rotating it is the only step that does not depend on the attacker already being gone.',
          ],
        },
        {
          level: 3,
          lines: [
            'Work down the Available list; each command unlocks the next. Start with `kubectl delete clusterrolebinding ci-deploy-bot-binding`, then close the attacker-created binding and its account.',
            'Finish with `kubectl delete secret ultra-mango-genome-db -n product` — the platform re-issues it immediately, which is what makes the stolen copy worthless.',
          ],
          insertText: 'kubectl delete clusterrolebinding ci-deploy-bot-binding',
          visibleWhen: { 'containment-timing': 'hunt-first' },
        },
        {
          level: 3,
          lines: [
            'You already revoked the original binding, so the attacker’s pivot identity is the live privilege path. Start with `kubectl delete clusterrolebinding metrics-reconciler-admin`, then remove the account behind it.',
            'Finish with `kubectl delete secret ultra-mango-genome-db -n product` — the platform re-issues it immediately, which is what makes the stolen copy worthless.',
          ],
          insertText: 'kubectl delete clusterrolebinding metrics-reconciler-admin',
          visibleWhen: { 'containment-timing': 'contain-now' },
        },
      ],
      resolution: {
        title: 'Incident contained', summary: ['Every active cluster-admin path is closed, the implant is gone, and the stolen secret has been replaced.'],
        conditionalSummary: [
          { when: { 'containment-timing': 'contain-now' }, lines: ['Immediate containment forced a visible pivot, but the new identity was found and removed.'] },
          { when: { 'containment-timing': 'hunt-first' }, lines: ['The evidence-first hunt exposed the original persistence path before containment began.'] },
        ],
      },
      clusterInitial: { status: 'compromised' },
      advanceWhen: { facts: ['revoked-persistence-binding', 'removed-rogue-sa', 'removed-implant-pod', 'rotated-secret'] },
      commands: [
        { match: /^kubectl\s+delete\s+clusterrolebinding\s+ci-deploy-bot-binding$/i, description: 'kubectl delete clusterrolebinding ci-deploy-bot-binding', visibleWhen: { 'containment-timing': 'hunt-first' }, outcome: { output: ['clusterrolebinding.rbac.authorization.k8s.io "ci-deploy-bot-binding" deleted', 'ci-deploy-bot drops to its default, near-zero permissions.'], revealsFacts: ['revoked-primary-binding'] } },
        { match: /^kubectl\s+delete\s+clusterrolebinding\s+log-rotator-admin$/i, description: 'kubectl delete clusterrolebinding log-rotator-admin', visibleWhen: { 'containment-timing': 'hunt-first' }, requiresFacts: ['revoked-primary-binding'], outcome: { output: ['clusterrolebinding.rbac.authorization.k8s.io "log-rotator-admin" deleted', 'The original persistence path is closed.'], revealsFacts: ['revoked-persistence-binding'] } },
        { match: /^kubectl\s+delete\s+clusterrolebinding\s+metrics-reconciler-admin$/i, description: 'kubectl delete clusterrolebinding metrics-reconciler-admin', visibleWhen: { 'containment-timing': 'contain-now' }, outcome: { output: ['clusterrolebinding.rbac.authorization.k8s.io "metrics-reconciler-admin" deleted', 'The attacker’s reaction path is closed.'], revealsFacts: ['revoked-persistence-binding'] } },
        { match: /^kubectl\s+delete\s+serviceaccount\s+log-rotator\s+-n\s+kube-system$/i, description: 'kubectl delete serviceaccount log-rotator -n kube-system', visibleWhen: { 'containment-timing': 'hunt-first' }, requiresFacts: ['revoked-persistence-binding'], outcome: { output: ['serviceaccount "log-rotator" deleted', 'The planted identity is gone.'], revealsFacts: ['removed-rogue-sa'] } },
        { match: /^kubectl\s+delete\s+serviceaccount\s+metrics-reconciler\s+-n\s+kube-system$/i, description: 'kubectl delete serviceaccount metrics-reconciler -n kube-system', visibleWhen: { 'containment-timing': 'contain-now' }, requiresFacts: ['revoked-persistence-binding'], outcome: { output: ['serviceaccount "metrics-reconciler" deleted', 'The pivot identity is gone.'], revealsFacts: ['removed-rogue-sa'] } },
        { match: new RegExp(`^kubectl\\s+delete\\s+pod\\s+${IMPLANT_POD}\\s+-n\\s+build$`, 'i'), description: `kubectl delete pod ${IMPLANT_POD} -n build`, requiresFacts: ['removed-rogue-sa'], outcome: { output: [`pod "${IMPLANT_POD}" deleted`, 'The replacement comes from the same image. You evicted the session, not the source of the implant.'], revealsFacts: ['removed-implant-pod'] } },
        { match: /^kubectl\s+delete\s+secret\s+ultra-mango-genome-db\s+-n\s+product$/i, description: 'kubectl delete secret ultra-mango-genome-db -n product', requiresFacts: ['removed-implant-pod'], outcome: { output: ['secret "ultra-mango-genome-db" deleted', 'The secrets operator re-issues it with fresh material within the minute.', 'The copy Citrus Dynamics took is now inert.', '-- INCIDENT CONTAINED --'], revealsFacts: ['rotated-secret'], clusterDelta: { status: 'contained', highlightNodeIds: [], revealEdgeIds: [] } } },
      ],
    },
  ],
  debrief: {
    narrative: ['By 03:40 the bindings are gone, the planted account is gone, and the genome secret has been re-issued. The pod that started it all has been replaced by an identical one, pulled from the same image — which is the part that should keep you up at night.', 'Citrus Dynamics still has a copy of what was taken at 02:16. Containment does not undo exfiltration; it only decides how much more there would have been.', 'What you did buy was the truth: how they got in, how far it reached, and what they left behind.'],
    lesson: 'The breach was made possible by a CI/CD service account bound directly to the built-in cluster-admin ClusterRole — a shortcut taken during a pipeline migration fourteen months earlier and never revisited. Least-privilege RBAC would have confined a compromised build pod to the build namespace instead of the whole cluster. Corroborate across independent sources, then hunt persistence before you declare containment complete.',
    detection: ['Alert on create pods/exec against production namespaces.', 'Alert on any ClusterRoleBinding referencing cluster-admin at creation time and review existing bindings on a schedule.', 'Alert on ServiceAccount or ClusterRoleBinding creation in kube-system.', 'Alert when a namespace-scoped service account reads secrets outside its own namespace.', 'Retain audit logs long enough to answer when a dangerous binding was created.'],
    nextChapterTeaser: 'The replacement pod came from the same image. Next: the supply-chain compromise that put the implant there.',
  },
  conditionalDebrief: [
    { when: { 'containment-timing': 'contain-now' }, lines: ['Your fast revoke forced the attacker to pivot to metrics-reconciler. You contained the reaction, but it proved why early containment changes the evidence trail.'] },
    { when: { 'containment-timing': 'hunt-first' }, lines: ['Your evidence-first route preserved the attacker’s original log-rotator trail long enough to remove both paths with a cleaner containment picture.'] },
  ],
};
