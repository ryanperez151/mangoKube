import type { Campaign } from '../types';
import { sentinelAttackMap } from './attackMap';
import { sentinelLogCorpus, TIME_RANGES } from './logs';

const IMPLANT_POD = 'ci-deploy-bot-7f9c4d6b6-x2k1p';

export const sentinelCampaign: Campaign = {
  id: 'sentinel',
  title: 'The Sentinel',
  tagline: "You're MangoCorp security, first on the scene of a live incident.",
  logCorpus: sentinelLogCorpus,
  attackMap: sentinelAttackMap,
  timeRanges: TIME_RANGES,
  factLibrary: {
    'evidence-interactive-shell': {
      id: 'evidence-interactive-shell',
      label: 'Interactive shell in a build pod',
      detail:
        'EDR caught /bin/sh running inside ci-deploy-bot under the build agent. CI jobs are scripted and non-interactive — this was a person.',
    },
    'evidence-offhours-exec': {
      id: 'evidence-offhours-exec',
      label: 'Off-hours exec from an external IP',
      detail:
        'The audit log shows create pods/exec at 02:14 UTC from 203.0.113.44, using the ci-deploy-bot service account. No pipeline runs in that window.',
    },
    'evidence-sa-identity': {
      id: 'evidence-sa-identity',
      label: 'Build account acting cluster-wide',
      detail:
        'ci-deploy-bot listed secrets across every namespace — far outside anything a build job needs.',
    },
    'evidence-clusteradmin-binding': {
      id: 'evidence-clusteradmin-binding',
      label: 'Bound to cluster-admin',
      detail:
        'The authorizer named ci-deploy-bot-binding as the rule that allowed it: a direct binding to the built-in cluster-admin ClusterRole.',
    },
    'evidence-binding-origin': {
      id: 'evidence-binding-origin',
      label: 'Binding predates the breach by 14 months',
      detail:
        'ci-deploy-bot-binding was created on 2025-06-14 by the jenkins-migration-2024 script and never revisited.',
    },
    'evidence-secret-read': {
      id: 'evidence-secret-read',
      label: 'Cultivar genome secret read',
      detail:
        'A successful get on secrets/ultra-mango-genome-db in the product namespace at 02:15:12, by the build service account.',
    },
    'evidence-exfil-egress': {
      id: 'evidence-exfil-egress',
      label: 'Data left the cluster',
      detail:
        '2.8 MB egressed from the build pod to 203.0.113.44 at 02:16:40 — the same address that opened the shell.',
    },
    'evidence-rogue-sa': {
      id: 'evidence-rogue-sa',
      label: 'Rogue service account planted',
      detail:
        "A service account named 'log-rotator' was created in kube-system at 02:31:07 to look like routine maintenance.",
    },
    'evidence-rogue-binding': {
      id: 'evidence-rogue-binding',
      label: 'Second cluster-admin binding',
      detail:
        'log-rotator-admin binds the planted account to cluster-admin — a way back in that survives revoking ci-deploy-bot.',
    },
    'revoked-primary-binding': {
      id: 'revoked-primary-binding',
      label: 'Primary binding revoked',
      detail: 'ci-deploy-bot-binding is deleted. The build account is no longer cluster-admin.',
    },
    'revoked-persistence-binding': {
      id: 'revoked-persistence-binding',
      label: 'Persistence binding revoked',
      detail: 'log-rotator-admin is deleted. The attacker-created path to cluster-admin is closed.',
    },
    'removed-rogue-sa': {
      id: 'removed-rogue-sa',
      label: 'Rogue account removed',
      detail: 'The log-rotator service account no longer exists in kube-system.',
    },
    'removed-implant-pod': {
      id: 'removed-implant-pod',
      label: 'Implant pod removed',
      detail:
        'The compromised ci-deploy-bot pod is gone. Its replacement comes from the same image, so the pipeline still needs fixing.',
    },
    'rotated-secret': {
      id: 'rotated-secret',
      label: 'Exposed secret rotated',
      detail:
        'ultra-mango-genome-db has been re-issued. The copy the attacker took no longer opens anything.',
    },
  },
  stages: [
    {
      id: 'triage',
      title: 'Triage',
      briefing: [
        "Ticket #4471, auto-raised 12 minutes ago: 'Anomalous process activity in a build-namespace container.'",
        'Overnight tickets are usually a flaky job or a bad deploy. You open the log console to rule it out.',
      ],
      objective: 'Confirm the alert is real and identify the workload behind it.',
      clusterInitial: { status: 'nominal' },
      advanceWhen: { facts: ['evidence-interactive-shell', 'evidence-offhours-exec'] },
      suggestedQueries: [
        { label: 'High-severity endpoint alerts', query: 'source=edr severity=high' },
        { label: 'Exec calls in the audit log', query: 'source=k8s-audit resource=pods/exec' },
      ],
      hint: 'The alert came from a container, so start in the endpoint data: source=edr, then narrow by severity. Once you have a pod name, confirm it against the audit log — two sources agreeing is what turns a hunch into a finding.',
      commands: [],
    },
    {
      id: 'identity',
      title: 'Identity & Blast Radius',
      briefing: [
        "You: Someone opened a shell in a build pod at two in the morning. That's real.",
        'You: Before anything else — what identity were they using, and what does that identity let them touch?',
      ],
      objective: 'Establish which account the activity ran as, and how much access it had.',
      clusterInitial: { status: 'suspicious' },
      advanceWhen: {
        facts: ['evidence-sa-identity', 'evidence-clusteradmin-binding', 'evidence-binding-origin'],
      },
      suggestedQueries: [
        { label: 'Everything from this account', query: 'user=ci-deploy-bot' },
        { label: 'Authorization decisions', query: 'source=apiserver decision=allow' },
        { label: 'ClusterRoleBinding changes', query: 'resource=clusterrolebindings' },
      ],
      hint: 'Searching the account name alone returns a lot of perfectly normal build traffic — the name is not the anomaly, the scope is. And the binding that granted this access was not created during the breach: widen the time range to All time to find when it appeared.',
      commands: [],
    },
    {
      id: 'scope',
      title: 'Scope the Damage',
      briefing: [
        'You: A build account with cluster-admin. Fourteen months old.',
        'You: Containment can wait ninety seconds. First — what did they actually reach?',
      ],
      objective: 'Determine what was accessed, and whether it left the cluster.',
      clusterInitial: { status: 'suspicious' },
      advanceWhen: { facts: ['evidence-secret-read', 'evidence-exfil-egress'] },
      suggestedQueries: [
        { label: 'Secret access', query: 'source=k8s-audit resource=secrets' },
        { label: 'Outbound connections', query: 'source=edr remoteIP=203.0.113.44' },
      ],
      hint: 'Reading a secret and stealing it are two different claims, proven by two different sources. The audit log shows the read; only the endpoint egress record shows the data leaving.',
      commands: [],
    },
    {
      id: 'persistence',
      title: 'Hunt Persistence',
      briefing: [
        'You: The genome data is gone. Every instinct says cut the account off right now.',
        'You: But they had cluster-admin for seventeen minutes. If they made themselves a second way in and you revoke only the first, you have not evicted anyone — you have told them you are awake.',
      ],
      objective: 'Find what the attacker created before you close anything down.',
      clusterInitial: { status: 'compromised' },
      advanceWhen: { facts: ['evidence-rogue-sa', 'evidence-rogue-binding'] },
      suggestedQueries: [
        {
          label: 'Creations in kube-system',
          query: 'source=k8s-audit verb=create namespace=kube-system',
        },
        { label: 'New bindings', query: 'resource=clusterrolebindings verb=create' },
      ],
      hint: 'Ask what an attacker with cluster-admin would make with it. New identities and new bindings both leave create records in the audit log — look in kube-system, where a maintenance-sounding name would not get a second glance.',
      commands: [],
    },
    {
      id: 'containment',
      title: 'Contain & Eradicate',
      briefing: [
        'You: Two paths to cluster-admin, one of them theirs. Now you can move.',
        'Response console unlocked. Order matters: take the bindings before the accounts, or you are deleting an account that can still recreate itself.',
      ],
      objective: 'Revoke both privilege paths, remove what they planted, and rotate what leaked.',
      clusterInitial: { status: 'compromised' },
      commands: [
        {
          match: /^kubectl\s+delete\s+clusterrolebinding\s+ci-deploy-bot-binding$/i,
          description: 'kubectl delete clusterrolebinding ci-deploy-bot-binding',
          outcome: {
            output: [
              'clusterrolebinding.rbac.authorization.k8s.io "ci-deploy-bot-binding" deleted',
              'ci-deploy-bot drops to its default, near-zero permissions.',
            ],
            revealsFacts: ['revoked-primary-binding'],
          },
        },
        {
          match: /^kubectl\s+delete\s+clusterrolebinding\s+log-rotator-admin$/i,
          description: 'kubectl delete clusterrolebinding log-rotator-admin',
          requiresFacts: ['revoked-primary-binding'],
          outcome: {
            output: [
              'clusterrolebinding.rbac.authorization.k8s.io "log-rotator-admin" deleted',
              'The path you would have missed is closed.',
            ],
            revealsFacts: ['revoked-persistence-binding'],
          },
        },
        {
          match: /^kubectl\s+delete\s+serviceaccount\s+log-rotator\s+-n\s+kube-system$/i,
          description: 'kubectl delete serviceaccount log-rotator -n kube-system',
          requiresFacts: ['revoked-persistence-binding'],
          outcome: {
            output: [
              'serviceaccount "log-rotator" deleted',
              'The planted identity is gone, and it was powerless the moment its binding went.',
            ],
            revealsFacts: ['removed-rogue-sa'],
          },
        },
        {
          match: new RegExp(`^kubectl\\s+delete\\s+pod\\s+${IMPLANT_POD}\\s+-n\\s+build$`, 'i'),
          description: `kubectl delete pod ${IMPLANT_POD} -n build`,
          requiresFacts: ['removed-rogue-sa'],
          outcome: {
            output: [
              `pod "${IMPLANT_POD}" deleted`,
              'The deployment schedules a replacement — from the same image. You have evicted the session, not the implant.',
            ],
            revealsFacts: ['removed-implant-pod'],
          },
        },
        {
          match: /^kubectl\s+delete\s+secret\s+ultra-mango-genome-db\s+-n\s+product$/i,
          description: 'kubectl delete secret ultra-mango-genome-db -n product',
          requiresFacts: ['removed-implant-pod'],
          outcome: {
            output: [
              'secret "ultra-mango-genome-db" deleted',
              'The secrets operator re-issues it with fresh material within the minute.',
              'The copy Citrus Dynamics took is now inert.',
              '-- INCIDENT CONTAINED --',
            ],
            revealsFacts: ['rotated-secret'],
            advances: true,
            clusterDelta: { status: 'contained', highlightNodeIds: [], revealEdgeIds: [] },
          },
        },
      ],
    },
  ],
  debrief: {
    narrative: [
      'By 03:40 the bindings are gone, the planted account is gone, and the genome secret has been re-issued. The pod that started it all has been replaced by an identical one, pulled from the same image — which is the part that should keep you up at night.',
      'Citrus Dynamics still has a copy of what was taken at 02:16. Containment does not undo exfiltration; it only decides how much more there would have been.',
      'What you did buy was the truth: how they got in, how far it reached, and what they left behind.',
    ],
    lesson:
      'The breach was made possible by a CI/CD service account bound directly to the built-in cluster-admin ClusterRole — a shortcut taken during a pipeline migration fourteen months earlier and never revisited. Least-privilege RBAC would have confined a compromised build pod to the build namespace instead of the whole cluster. The investigation itself turned on two habits: corroborating a finding across independent sources (endpoint telemetry proved the shell, the audit log proved the exec), and hunting persistence before containing, because an attacker with cluster-admin creates their own way back in.',
    detection: [
      'Alert on create pods/exec against production namespaces — legitimate automation rarely execs into running pods, and attackers almost always do.',
      'Alert on any ClusterRoleBinding referencing cluster-admin at creation time, and review existing ones on a schedule so migration-era bindings surface before an incident does.',
      'Alert on ServiceAccount or ClusterRoleBinding creation in kube-system; a maintenance-sounding name is exactly what persistence looks like.',
      'Alert when a namespace-scoped service account reads secrets outside its own namespace — the field to key on is the identity, not the resource.',
      'Retain audit logs long enough to answer "when was this created?" A fourteen-month-old binding is invisible to a thirty-day retention window.',
    ],
    nextChapterTeaser:
      'The replacement pod came from the same image. Next: the supply-chain compromise that put the implant there — and the admission controls that would have stopped it at the gate.',
  },
};
