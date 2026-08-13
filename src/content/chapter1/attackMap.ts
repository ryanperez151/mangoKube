import type { AttackMapNode } from '@/content/types';

/**
 * The kill chain, drawn as a branch: the trunk is how they got in, and
 * each limb is a tactic. `initial-access` is deliberately never
 * confirmable in Chapter 1 — the supply-chain compromise is Chapter 2.
 */
export const sentinelAttackMap: AttackMapNode[] = [
  {
    id: 'initial-access',
    label: 'Poisoned build image',
    tactic: 'Initial Access',
    summary:
      'Something was already inside the CI image before this incident began. The audit trail starts after the implant was planted, so the entry point is inferred, not proven.',
    lesson:
      'Not every incident yields a confirmed patient zero. An unexplained foothold in a build workload is itself a finding — it points upstream, at the pipeline that produced the image.',
    prevention:
      'Sign and verify images, pin base-image digests, and generate an SBOM per build so a poisoned dependency can be traced after the fact.',
    suspectedByFacts: ['evidence-interactive-shell'],
    confirmedByFacts: [],
    containedByFacts: [],
    x: 10,
    y: 78,
  },
  {
    id: 'execution',
    label: 'Interactive shell in build pod',
    tactic: 'Execution',
    summary:
      'An interactive /bin/sh ran inside ci-deploy-bot at 02:14 UTC, opened via the Kubernetes exec API from an external address.',
    lesson:
      'Build agents run scripted, non-interactive work. An interactive shell in one is a high-signal anomaly, and the exec API call leaves a matching record in the audit log.',
    prevention:
      'Alert on create pods/exec in production namespaces, and drop shells from workload images so there is nothing interactive to spawn.',
    suspectedByFacts: ['evidence-offhours-exec'],
    confirmedByFacts: ['evidence-interactive-shell', 'evidence-offhours-exec'],
    containedByFacts: ['removed-implant-pod'],
    x: 30,
    y: 62,
    parentId: 'initial-access',
  },
  {
    id: 'privilege-escalation',
    label: 'CI account bound to cluster-admin',
    tactic: 'Privilege Escalation',
    summary:
      'ci-deploy-bot was bound directly to the built-in cluster-admin ClusterRole by a migration script fourteen months before the breach.',
    lesson:
      'The attacker did not escalate privileges — the cluster handed them over. A shortcut taken during a pipeline migration turned a single compromised build pod into full cluster control.',
    prevention:
      'Scope service accounts to the verbs and resources they actually need, and audit ClusterRoleBindings to cluster-admin on a schedule so migration-era shortcuts get found.',
    suspectedByFacts: ['evidence-sa-identity'],
    confirmedByFacts: ['evidence-clusteradmin-binding', 'evidence-binding-origin'],
    containedByFacts: ['revoked-primary-binding'],
    x: 50,
    y: 44,
    parentId: 'execution',
  },
  {
    id: 'credential-access',
    label: 'Cultivar genome secret read',
    tactic: 'Credential & Data Access',
    summary:
      'The ultra-mango-genome-db secret in the product namespace was read at 02:15:12 by the build service account.',
    lesson:
      'Cluster-admin flattens namespace boundaries. Isolation that exists only as a namespace is not isolation once an account can read across all of them.',
    prevention:
      'Keep high-value material out of plain Kubernetes Secrets — use an external secrets manager with its own authorization and short-lived leases.',
    suspectedByFacts: [],
    confirmedByFacts: ['evidence-secret-read'],
    containedByFacts: ['rotated-secret'],
    x: 72,
    y: 28,
    parentId: 'privilege-escalation',
  },
  {
    id: 'exfiltration',
    label: 'Genome data egress',
    tactic: 'Exfiltration',
    summary:
      '2.8 MB left the build pod for 203.0.113.44 at 02:16:40, ninety seconds after the secret was read — the same address that opened the shell.',
    lesson:
      'Control-plane access and endpoint telemetry answer different questions. The audit log proves the secret was read; only the egress record proves it left.',
    prevention:
      'Apply default-deny egress NetworkPolicies to build workloads and alert on unrecognized outbound destinations from cluster nodes.',
    suspectedByFacts: [],
    confirmedByFacts: ['evidence-exfil-egress'],
    containedByFacts: [],
    x: 90,
    y: 14,
    parentId: 'credential-access',
  },
  {
    id: 'persistence',
    label: 'Rogue cluster-admin account',
    tactic: 'Persistence',
    summary:
      'A maintenance-looking service account and a matching cluster-admin binding were created in kube-system at 02:31, creating a second way in independent of ci-deploy-bot.',
    lesson:
      'Containment that stops at the entry point is not eradication. An attacker with cluster-admin creates their own identities, so hunting persistence has to precede revocation.',
    prevention:
      'Alert on ClusterRoleBinding and ServiceAccount creation in kube-system, and require review for any new binding to cluster-admin.',
    suspectedByFacts: ['evidence-rogue-sa'],
    confirmedByFacts: ['evidence-rogue-sa', 'evidence-rogue-binding'],
    containedByFacts: ['revoked-persistence-binding', 'removed-rogue-sa'],
    x: 66,
    y: 66,
    parentId: 'privilege-escalation',
  },
];
