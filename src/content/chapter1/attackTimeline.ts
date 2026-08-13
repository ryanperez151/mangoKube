import type { AttackTimelineEntry } from '@/content/types';

/**
 * The single attack both campaigns describe, told once.
 *
 * The Infiltrator plays the `command` column; the Sentinel hunts the
 * `artifactEventIds` column. Joining them is the point: it is what lets the
 * attacker's debrief show the trail they left, and the defender's debrief
 * show what was never visible in the first place.
 *
 * Timestamps for steps the corpus does not record are placed to fit around
 * the events it does — the fiction's clock, not invented telemetry.
 */
export const chapter1AttackTimeline: AttackTimelineEntry[] = [
  {
    id: 'binding-created',
    timestamp: '2025-06-14T09:22:17Z',
    nodeId: 'privilege-escalation',
    action:
      'A pipeline migration script binds the ci-deploy-bot service account directly to the built-in cluster-admin ClusterRole.',
    artifactEventIds: ['sig-binding-origin'],
    sentinelFacts: ['evidence-binding-origin'],
    observability: 'alerting',
    critical:
      'Fourteen months before anyone was attacked, the cluster was already configured to lose. Every later step is cheap because of this one.',
    detection: {
      query: 'resource=clusterrolebindings verb=create',
      rule: 'Alert at creation time on any ClusterRoleBinding that references cluster-admin, and re-audit existing bindings on a schedule so migration-era shortcuts surface before an attacker finds them.',
    },
  },
  {
    id: 'implant-planted',
    timestamp: '2026-07-29T00:00:00Z',
    nodeId: 'initial-access',
    action:
      'A poisoned build image ships the implant into the cluster. The pod that carries it has been running fourteen days by the time anyone looks.',
    artifactEventIds: [],
    artifactNote:
      'The audit trail begins after the implant was already running. Nothing in this chapter can prove how it arrived — the entry point is inferred, never confirmed.',
    sentinelFacts: [],
    observability: 'invisible',
    critical:
      'This is the step the Sentinel cannot close. An unexplained foothold is itself the finding, and it points upstream at the pipeline.',
    detection: {
      rule: 'Sign and verify images, pin base-image digests, and emit an SBOM per build so a poisoned dependency can be traced after the fact.',
    },
  },
  {
    id: 'exec-into-pod',
    timestamp: '2026-08-12T02:14:01Z',
    nodeId: 'execution',
    action:
      'The operator opens a session into the build pod through the Kubernetes exec API, from an external address, at 02:14 UTC.',
    artifactEventIds: ['sig-exec-create'],
    sentinelFacts: ['evidence-offhours-exec'],
    observability: 'alerting',
    critical:
      'The first move against a live cluster is also the loudest. The control plane recorded it immediately, with the source IP attached.',
    detection: {
      query: 'source=k8s-audit resource=pods/exec',
      rule: 'Alert on create pods/exec against production namespaces. Scheduled CI does not open shells.',
    },
  },
  {
    id: 'shell-spawn',
    timestamp: '2026-08-12T02:14:03Z',
    nodeId: 'execution',
    action: 'An interactive /bin/sh starts inside the deploy-agent container.',
    artifactEventIds: ['sig-shell-spawn'],
    sentinelFacts: ['evidence-interactive-shell'],
    observability: 'alerting',
    detection: {
      query: 'source=edr severity=high',
      rule: 'Alert on interactive shells in workload containers, and build images without a shell so there is nothing to spawn.',
    },
  },
  {
    id: 'enumerate-workloads',
    timestamp: '2026-08-12T02:14:10Z',
    nodeId: 'execution',
    action: 'List the workloads running in the namespace to find where the implant landed.',
    command: 'kubectl get pods',
    infiltratorFacts: ['found-implant-pod'],
    artifactEventIds: [],
    artifactNote:
      'The API server does record this list call. It is also what every controller, dashboard, and readiness probe in the cluster does continuously — one more read changes nothing about the shape of the day.',
    sentinelFacts: [],
    observability: 'buried',
    detection: {
      rule: 'Do not try to alert on reads. Alert on the identity: a build account issuing cluster-wide reads it has never issued before is the anomaly, not the read itself.',
    },
  },
  {
    id: 'enumerate-permissions',
    timestamp: '2026-08-12T02:14:18Z',
    nodeId: 'execution',
    action:
      'Ask the cluster directly what this identity is permitted to do — the highest-value question an attacker can ask, and the cheapest.',
    command: 'kubectl auth can-i --list',
    infiltratorFacts: ['found-sa-permissions'],
    artifactEventIds: [],
    artifactNote:
      'This is a SelfSubjectRulesReview, and it is written to the audit log. It is also issued routinely by tooling, so it sits below the threshold of anything worth paging a human about.',
    sentinelFacts: [],
    observability: 'buried',
    detection: {
      rule: 'Treat a burst of SelfSubjectRulesReview or SubjectAccessReview calls from a workload identity as reconnaissance signal — individually routine, collectively not.',
    },
  },
  {
    id: 'read-token',
    timestamp: '2026-08-12T02:14:25Z',
    nodeId: 'execution',
    action: 'Read the service account token Kubernetes mounted into the pod automatically.',
    command: 'cat /var/run/secrets/kubernetes.io/serviceaccount/token',
    infiltratorFacts: ['captured-ci-token'],
    artifactEventIds: [],
    artifactNote:
      'A file read inside a container. It never touches the API server, so no audit record of it exists anywhere — the identity is stolen in complete silence.',
    sentinelFacts: [],
    observability: 'invisible',
    critical:
      'The whole breach turns here, and it is the one step with no trace at all. Everything after this is the attacker wearing the cluster’s own CI identity.',
    detection: {
      rule: 'Set automountServiceAccountToken: false on workloads that never call the API, and prefer short-lived projected tokens so a stolen one expires on its own.',
    },
  },
  {
    id: 'inspect-service-account',
    timestamp: '2026-08-12T02:14:31Z',
    nodeId: 'privilege-escalation',
    action: 'Inspect the service account object to confirm which identity the token belongs to.',
    command: 'kubectl get serviceaccount ci-deploy-bot -o yaml',
    infiltratorFacts: ['found-sa-object'],
    artifactEventIds: [],
    artifactNote: 'A single-object read, indistinguishable from routine tooling.',
    sentinelFacts: [],
    observability: 'buried',
    detection: {
      rule: 'Reads of RBAC objects are worth logging but not alerting. Their value is retrospective — during an investigation they show you what the attacker was looking at.',
    },
  },
  {
    id: 'list-bindings',
    timestamp: '2026-08-12T02:14:37Z',
    nodeId: 'privilege-escalation',
    action: 'List every ClusterRoleBinding to find which one covers this account.',
    command: 'kubectl get clusterrolebindings',
    infiltratorFacts: ['found-clusteradmin-binding'],
    artifactEventIds: [],
    artifactNote:
      'The attacker is reading the cluster’s own permission map. It is a read, so it is quiet — and the map tells them exactly how far they can go.',
    sentinelFacts: [],
    observability: 'buried',
    detection: {
      rule: 'A workload identity enumerating cluster-scoped RBAC has no legitimate reason to. Rare enough to alert on when the caller is a service account.',
    },
  },
  {
    id: 'describe-cluster-admin',
    timestamp: '2026-08-12T02:14:42Z',
    nodeId: 'privilege-escalation',
    action: 'Confirm what the bound role actually permits: every verb, on every resource.',
    command: 'kubectl describe clusterrole cluster-admin',
    infiltratorFacts: ['confirmed-cluster-admin'],
    artifactEventIds: [],
    artifactNote: 'Reading a built-in role definition. Quiet, and identical to what any operator does.',
    sentinelFacts: [],
    observability: 'buried',
    detection: {
      rule: 'Nothing to detect here. The control is preventive: do not bind workloads to cluster-admin in the first place.',
    },
  },
  {
    id: 'assume-identity',
    timestamp: '2026-08-12T02:14:46Z',
    nodeId: 'privilege-escalation',
    action: 'Configure the stolen token as the credential for every subsequent request.',
    command: 'kubectl config set-credentials attacker --token=<ci-deploy-bot-token>',
    infiltratorFacts: ['using-stolen-token'],
    artifactEventIds: [],
    artifactNote:
      'An edit to a local kubeconfig file on the operator’s own machine. Nothing crosses the network, so the cluster has no idea this happened.',
    sentinelFacts: [],
    observability: 'invisible',
    detection: {
      rule: 'You cannot see the theft, only the use. Bind detection to behaviour: the same service account appearing from a new source IP is the observable event.',
    },
  },
  {
    id: 'list-secrets-everywhere',
    timestamp: '2026-08-12T02:14:48Z',
    nodeId: 'privilege-escalation',
    action: 'Enumerate secrets across every namespace in the cluster.',
    command: 'kubectl get secrets -A',
    infiltratorFacts: ['located-ip-secrets'],
    artifactEventIds: ['sig-sa-out-of-scope'],
    sentinelFacts: ['evidence-sa-identity'],
    observability: 'alerting',
    detection: {
      query: 'source=k8s-audit resource=secrets',
      rule: 'Alert when a namespace-scoped service account reads or lists secrets outside its own namespace.',
    },
  },
  {
    id: 'authorization-allowed',
    timestamp: '2026-08-12T02:14:52Z',
    nodeId: 'privilege-escalation',
    action:
      'The authorizer approves the request and records the rule it used — naming the binding that made all of this legal.',
    artifactEventIds: ['sig-binding-in-effect'],
    sentinelFacts: ['evidence-clusteradmin-binding'],
    observability: 'alerting',
    critical:
      'The single most useful line in the whole corpus: the cluster explains its own decision, and hands the investigator the binding name for free.',
    detection: {
      query: 'source=apiserver decision=allow',
      rule: 'Keep authorization decision logs. They convert "this was allowed" into "this was allowed by this specific rule", which is the difference between suspicion and a fix.',
    },
  },
  {
    id: 'verify-destructive-authority',
    timestamp: '2026-08-12T02:14:58Z',
    nodeId: 'privilege-escalation',
    action: 'Test the ceiling of the stolen identity by checking for node deletion rights.',
    command: 'kubectl auth can-i delete nodes',
    infiltratorFacts: ['verified-cluster-admin'],
    artifactEventIds: [],
    artifactNote:
      'A SubjectAccessReview. Logged, routine in isolation, and never followed by an actual node deletion — so nothing downstream draws attention to it.',
    sentinelFacts: [],
    observability: 'buried',
    detection: {
      rule: 'Permission probes for destructive verbs — delete nodes, create clusterrolebindings — are a strong reconnaissance tell when they come from a workload identity.',
    },
  },
  {
    id: 'read-genome-secret',
    timestamp: '2026-08-12T02:15:12Z',
    nodeId: 'credential-access',
    action: 'Read the Ultra Mango cultivar genome out of the product namespace.',
    command: "kubectl get secret ultra-mango-genome-db -o jsonpath='{.data}' | base64 -d",
    infiltratorFacts: ['exfiltrated-ip'],
    artifactEventIds: ['sig-secret-read'],
    sentinelFacts: ['evidence-secret-read'],
    observability: 'alerting',
    critical:
      'The objective, reached. A build account in the build namespace read a product-namespace secret and succeeded — namespace isolation means nothing once an identity holds cluster-admin.',
    detection: {
      query: 'source=k8s-audit resource=secrets verb=get',
      rule: 'Keep high-value material out of plain Kubernetes Secrets. An external secrets manager with its own authorization and short-lived leases turns one API call into an auditable, revocable lease.',
    },
  },
  {
    id: 'egress-genome',
    timestamp: '2026-08-12T02:16:40Z',
    nodeId: 'exfiltration',
    action:
      '2.8 MB leaves the build pod for the same external address that opened the shell, ninety seconds after the read.',
    artifactEventIds: ['sig-exfil-egress'],
    sentinelFacts: ['evidence-exfil-egress'],
    observability: 'alerting',
    critical:
      'Access became theft here. The audit log proved the secret was read; only this record proves it left the cluster — two different claims, from two different sources.',
    detection: {
      query: 'source=edr remoteIP=203.0.113.44',
      rule: 'Apply default-deny egress NetworkPolicies to build workloads and alert on unrecognized outbound destinations.',
    },
  },
  {
    id: 'plant-rogue-account',
    timestamp: '2026-08-12T02:31:07Z',
    nodeId: 'persistence',
    action:
      'Create a maintenance-sounding service account in kube-system, so the way back in does not depend on the original implant.',
    command: 'kubectl create serviceaccount log-rotator -n kube-system',
    infiltratorFacts: ['persistence-sa-created'],
    artifactEventIds: ['sig-rogue-sa', 'sig-rogue-sa-pivot'],
    sentinelFacts: ['evidence-rogue-sa'],
    observability: 'alerting',
    detection: {
      query: 'source=k8s-audit verb=create namespace=kube-system',
      rule: 'Alert on ServiceAccount creation in kube-system. Legitimate creations there are rare and planned.',
    },
  },
  {
    id: 'plant-rogue-binding',
    timestamp: '2026-08-12T02:31:22Z',
    nodeId: 'persistence',
    action: 'Give the planted account its own independent cluster-admin binding.',
    command:
      'kubectl create clusterrolebinding log-rotator-admin --clusterrole=cluster-admin --serviceaccount=kube-system:log-rotator',
    infiltratorFacts: ['persistence-binding-created'],
    artifactEventIds: ['sig-rogue-binding', 'sig-rogue-binding-pivot'],
    sentinelFacts: ['evidence-rogue-binding'],
    observability: 'alerting',
    critical:
      'The second door. Revoking the original binding closes the path everyone is watching and leaves this one wide open — which is why persistence gets hunted before containment is declared.',
    detection: {
      query: 'resource=clusterrolebindings verb=create',
      rule: 'Require review for any new binding to cluster-admin, and alert on ClusterRoleBinding creation in kube-system regardless of the role.',
    },
  },
  {
    id: 'delete-implant-pod',
    timestamp: '2026-08-12T02:33:10Z',
    nodeId: 'execution',
    action: 'Force-delete the original implant pod, leaving only the quieter backdoor behind.',
    command: 'kubectl delete pod ci-deploy-bot-7f9c4d6b6-x2k1p --grace-period=0 --force',
    infiltratorFacts: ['covered-tracks'],
    artifactEventIds: [],
    artifactNote:
      'A forced delete is a loud audit write — but it lands after 02:31, past the end of the window this investigation captured. The Sentinel never sees it because on their timeline they got there first.',
    sentinelFacts: [],
    observability: 'alerting',
    detection: {
      query: 'source=k8s-audit verb=delete resource=pods',
      rule: 'Alert on force deletes with grace-period=0 in production namespaces — they are rare from humans and near-nonexistent from automation.',
    },
  },
  {
    id: 'handoff',
    timestamp: '2026-08-12T02:34:00Z',
    nodeId: 'exfiltration',
    action: 'Confirm the theft and the standing foothold to the handler, then go dark.',
    command: 'echo "handoff complete"',
    infiltratorFacts: ['handoff-complete'],
    artifactEventIds: [],
    artifactNote: 'Entirely on the operator’s side of the wire. The cluster has nothing to record.',
    sentinelFacts: [],
    observability: 'invisible',
    detection: {
      rule: 'Nothing detects the handoff. What detects the operation is everything they had to touch to get here — which is the argument for alerting on the steps, not the outcome.',
    },
  },
];
