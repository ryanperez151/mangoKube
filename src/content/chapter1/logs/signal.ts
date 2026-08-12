import type { LogEvent } from '@/content/types';

/**
 * The smoking guns. Each reveals exactly one fact when pinned.
 * `arrivesAtStage` paces a live incident: the attacker is still working
 * while the analyst hunts, so later evidence genuinely does not exist yet.
 *
 * Exception: `evidence-binding-origin` arrives at stage 0 but is dated
 * fourteen months ago, so it is hidden by the default time range instead.
 * Widening the range is the Stage 2 lesson.
 */
export const signalEvents: LogEvent[] = [
  {
    id: 'sig-shell-spawn',
    timestamp: '2026-08-12T02:14:03Z',
    source: 'edr',
    message: 'Interactive shell /bin/sh spawned in container',
    fields: {
      pod: 'ci-deploy-bot-7f9c4d6b6-x2k1p',
      namespace: 'build',
      container: 'deploy-agent',
      process: '/bin/sh',
      parent: 'node /opt/agent/entrypoint.js',
      severity: 'high',
      detection: 'interactive-shell-in-workload',
    },
    arrivesAtStage: 0,
    revealsFact: 'evidence-interactive-shell',
    analystNote:
      'Build agents run scripted, non-interactive jobs. An interactive shell inside one is not how CI behaves — this is a human, or something imitating one.',
  },
  {
    id: 'sig-exec-create',
    timestamp: '2026-08-12T02:14:01Z',
    source: 'k8s-audit',
    message: 'create pods/exec',
    fields: {
      user: 'system:serviceaccount:build:ci-deploy-bot',
      verb: 'create',
      resource: 'pods/exec',
      namespace: 'build',
      pod: 'ci-deploy-bot-7f9c4d6b6-x2k1p',
      sourceIP: '203.0.113.44',
      responseCode: '201',
    },
    arrivesAtStage: 0,
    revealsFact: 'evidence-offhours-exec',
    analystNote:
      'An exec into a pod at 02:14 UTC, from an external source IP, using a CI service account. No pipeline run is scheduled in this window.',
  },
  {
    id: 'sig-sa-out-of-scope',
    timestamp: '2026-08-12T02:14:48Z',
    source: 'k8s-audit',
    message: 'list secrets across all namespaces',
    fields: {
      user: 'system:serviceaccount:build:ci-deploy-bot',
      verb: 'list',
      resource: 'secrets',
      namespace: '*',
      sourceIP: '203.0.113.44',
      responseCode: '200',
    },
    arrivesAtStage: 1,
    revealsFact: 'evidence-sa-identity',
    analystNote:
      'A build account listing secrets in every namespace. The account name looks routine; the scope of what it just did is not.',
  },
  {
    id: 'sig-binding-in-effect',
    timestamp: '2026-08-12T02:14:52Z',
    source: 'apiserver',
    message: 'authorization allowed by ClusterRoleBinding ci-deploy-bot-binding',
    fields: {
      user: 'system:serviceaccount:build:ci-deploy-bot',
      decision: 'allow',
      binding: 'ci-deploy-bot-binding',
      role: 'cluster-admin',
      reason: 'RBAC: allowed by ClusterRoleBinding "ci-deploy-bot-binding"',
    },
    arrivesAtStage: 1,
    revealsFact: 'evidence-clusteradmin-binding',
    analystNote:
      'The authorizer names the binding that permitted it: a CI service account is bound to cluster-admin, the built-in role that can do anything to anything.',
  },
  {
    id: 'sig-binding-origin',
    timestamp: '2025-06-14T09:22:17Z',
    source: 'k8s-audit',
    message: 'create clusterrolebindings/ci-deploy-bot-binding',
    fields: {
      user: 'alice.ferreira@mangocorp.example',
      verb: 'create',
      resource: 'clusterrolebindings',
      object: 'ci-deploy-bot-binding',
      role: 'cluster-admin',
      annotation: 'created-by=jenkins-migration-2024',
      responseCode: '201',
    },
    arrivesAtStage: 0,
    revealsFact: 'evidence-binding-origin',
    analystNote:
      'Fourteen months old, created by a migration script, never revisited. The breach is days old; the misconfiguration that made it possible is not.',
  },
  {
    id: 'sig-secret-read',
    timestamp: '2026-08-12T02:15:12Z',
    source: 'k8s-audit',
    message: 'get secrets/ultra-mango-genome-db',
    fields: {
      user: 'system:serviceaccount:build:ci-deploy-bot',
      verb: 'get',
      resource: 'secrets',
      object: 'ultra-mango-genome-db',
      namespace: 'product',
      sourceIP: '203.0.113.44',
      responseCode: '200',
    },
    arrivesAtStage: 2,
    revealsFact: 'evidence-secret-read',
    analystNote:
      'The Ultra Mango cultivar genome. A build account in the build namespace has no reason to read a product-namespace secret, and it succeeded.',
  },
  {
    id: 'sig-exfil-egress',
    timestamp: '2026-08-12T02:16:40Z',
    source: 'edr',
    message: 'Outbound connection to unrecognized external host',
    fields: {
      pod: 'ci-deploy-bot-7f9c4d6b6-x2k1p',
      namespace: 'build',
      process: 'curl',
      remoteIP: '203.0.113.44',
      remotePort: '443',
      bytesOut: '2841160',
      severity: 'high',
    },
    arrivesAtStage: 2,
    revealsFact: 'evidence-exfil-egress',
    analystNote:
      '2.8 MB leaving the cluster to the same IP that opened the shell, ninety seconds after the genome secret was read. Access became exfiltration here.',
  },
  {
    id: 'sig-rogue-sa',
    timestamp: '2026-08-12T02:31:07Z',
    source: 'k8s-audit',
    message: 'create serviceaccounts/log-rotator',
    fields: {
      user: 'system:serviceaccount:build:ci-deploy-bot',
      verb: 'create',
      resource: 'serviceaccounts',
      object: 'log-rotator',
      namespace: 'kube-system',
      sourceIP: '203.0.113.44',
      responseCode: '201',
    },
    arrivesAtStage: 3,
    revealsFact: 'evidence-rogue-sa',
    analystNote:
      'A new service account in kube-system, named to look like routine maintenance. Nothing in MangoCorp created this.',
  },
  {
    id: 'sig-rogue-binding',
    timestamp: '2026-08-12T02:31:22Z',
    source: 'k8s-audit',
    message: 'create clusterrolebindings/log-rotator-admin',
    fields: {
      user: 'system:serviceaccount:build:ci-deploy-bot',
      verb: 'create',
      resource: 'clusterrolebindings',
      object: 'log-rotator-admin',
      role: 'cluster-admin',
      sourceIP: '203.0.113.44',
      responseCode: '201',
    },
    arrivesAtStage: 3,
    revealsFact: 'evidence-rogue-binding',
    analystNote:
      'A second path to cluster-admin, independent of ci-deploy-bot. Revoking only the first binding would have left this one untouched.',
  },
];
