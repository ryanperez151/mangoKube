import type { Campaign } from '../types';

export const sentinelCampaign: Campaign = {
  id: 'sentinel',
  title: 'The Sentinel',
  tagline: "You're MangoCorp security, first on the scene of a live incident.",
  factLibrary: {
    'confirmed-pod': {
      id: 'confirmed-pod',
      label: 'Source pod confirmed',
      detail: "The alert traces back to 'ci-deploy-bot', a CI/CD pod in the build namespace.",
    },
    'found-suspicious-activity': {
      id: 'found-suspicious-activity',
      label: 'Off-hours activity confirmed',
      detail: "ci-deploy-bot's account was used well outside normal pipeline run windows.",
    },
    'found-binding': {
      id: 'found-binding',
      label: 'cluster-admin binding found',
      detail: 'ci-deploy-bot is bound directly to the built-in cluster-admin ClusterRole.',
    },
    'found-binding-origin': {
      id: 'found-binding-origin',
      label: 'Binding origin traced',
      detail: "The binding was created during 'jenkins-migration-2024' and never revisited.",
    },
    'found-active-use': {
      id: 'found-active-use',
      label: 'Active exec sessions found',
      detail: 'Logs show exec sessions into ci-deploy-bot that no legitimate pipeline run created.',
    },
    'confirmed-ip-access': {
      id: 'confirmed-ip-access',
      label: 'Secret access confirmed',
      detail: 'Audit logs show a GET on the ultra-mango-genome-db secret from this account.',
    },
    'found-persistence-binding': {
      id: 'found-persistence-binding',
      label: 'Second binding found',
      detail: "An unfamiliar clusterrolebinding, 'log-rotator-admin', also grants cluster-admin.",
    },
    'revoked-primary-binding': {
      id: 'revoked-primary-binding',
      label: 'Primary binding revoked',
      detail: 'The ci-deploy-bot-binding clusterrolebinding has been deleted.',
    },
    'revoked-persistence-binding': {
      id: 'revoked-persistence-binding',
      label: 'Persistence binding revoked',
      detail: 'The log-rotator-admin clusterrolebinding has been deleted.',
    },
    'confirmed-ip-exposure': {
      id: 'confirmed-ip-exposure',
      label: 'IP exposure confirmed',
      detail: 'The audit trail confirms the genome secret was read before containment began.',
    },
  },
  stages: [
    {
      id: 'recon',
      title: 'Recon',
      briefing: [
        "Ticket #4471: 'Anomalous kubectl activity from a pod in the build namespace — authenticated as a CI service account outside normal pipeline windows.'",
        'You pull up the cluster to see what triggered the alert.',
      ],
      objective: 'Confirm the alert and identify the source pod and account.',
      clusterInitial: { status: 'nominal' },
      commands: [
        {
          match: /^kubectl\s+get\s+pods\s+-n\s+build$/i,
          description: 'kubectl get pods -n build',
          outcome: {
            output: [
              'NAME                            READY   STATUS    RESTARTS   AGE',
              'ci-deploy-bot-7f9c4d6b6-x2k1p   1/1     Running   0          14d',
            ],
            revealsFacts: ['confirmed-pod'],
          },
        },
        {
          match: /^kubectl\s+get\s+events\s+-n\s+build(\s+--sort-by=\.lastTimestamp)?$/i,
          description: 'kubectl get events -n build --sort-by=.lastTimestamp',
          requiresFacts: ['confirmed-pod'],
          outcome: {
            output: [
              'LAST SEEN   TYPE      REASON        OBJECT                              MESSAGE',
              '3m          Normal    ExecCreated   pod/ci-deploy-bot-7f9c4d6b6-x2k1p   exec session started at 02:14 UTC',
            ],
            revealsFacts: ['found-suspicious-activity'],
          },
        },
        {
          match: /^kubectl\s+auth\s+can-i\s+--list\s+--as=system:serviceaccount:build:ci-deploy-bot$/i,
          description: 'kubectl auth can-i --list --as=system:serviceaccount:build:ci-deploy-bot',
          requiresFacts: ['confirmed-pod', 'found-suspicious-activity'],
          outcome: {
            output: [
              'Resources                     Verbs',
              'serviceaccounts/token          [impersonate]',
              'secrets                        [get list]',
              'pods/exec                      [create]',
              '*.mangocorp.internal/deploy    [create update]',
              '',
              'This is far more access than a CI deploy account should have.',
            ],
            advances: true,
            clusterDelta: { highlightNodeIds: ['ci-deploy-bot'], status: 'suspicious' },
          },
        },
      ],
    },
    {
      id: 'discovery',
      title: 'Discovery',
      briefing: ["You: That permission list is way too broad for a CI bot. Find out why."],
      objective: 'Find the RBAC binding responsible for the excess access.',
      clusterInitial: { highlightNodeIds: ['ci-deploy-bot'], status: 'suspicious' },
      commands: [
        {
          match: /^kubectl\s+get\s+rolebindings?\s+(-A|--all-namespaces)$/i,
          description: 'kubectl get rolebindings -A',
          outcome: {
            output: [
              'NAMESPACE   NAME                    ROLE                       SUBJECT',
              'build       ci-deploy-bot-binding   ClusterRole/cluster-admin  ServiceAccount/ci-deploy-bot',
            ],
            revealsFacts: ['found-binding'],
          },
        },
        {
          match: /^kubectl\s+get\s+clusterrolebinding\s+ci-deploy-bot-binding\s+-o\s+yaml$/i,
          description: 'kubectl get clusterrolebinding ci-deploy-bot-binding -o yaml',
          requiresFacts: ['found-binding'],
          outcome: {
            output: [
              'metadata:',
              '  name: ci-deploy-bot-binding',
              '  annotations:',
              '    created-by: jenkins-migration-2024',
              '  creationTimestamp: <14 months ago>',
            ],
            revealsFacts: ['found-binding-origin'],
          },
        },
        {
          match: /^kubectl\s+describe\s+clusterrole\s+cluster-admin$/i,
          description: 'kubectl describe clusterrole cluster-admin',
          requiresFacts: ['found-binding', 'found-binding-origin'],
          outcome: {
            output: [
              'PolicyRule:',
              '  Resources   Verbs',
              '  *.*         [*]',
              '',
              "A migration script bound this account to cluster-admin fourteen months ago and it was never revisited.",
            ],
            advances: true,
            clusterDelta: {
              highlightNodeIds: ['ci-deploy-bot', 'cluster-admin-binding'],
              revealEdgeIds: ['ci-deploy-bot-to-clusteradmin'],
              status: 'suspicious',
            },
          },
        },
      ],
    },
    {
      id: 'detect',
      title: 'Detect',
      briefing: ["You: Someone's actively using this. Check for a live session before you touch anything."],
      objective: 'Determine whether the excess access has actually been used.',
      clusterInitial: {
        highlightNodeIds: ['ci-deploy-bot', 'cluster-admin-binding'],
        revealEdgeIds: ['ci-deploy-bot-to-clusteradmin'],
        status: 'suspicious',
      },
      commands: [
        {
          match: /^kubectl\s+logs\s+ci-deploy-bot-7f9c4d6b6-x2k1p\s+-n\s+build\s+--previous$/i,
          description: 'kubectl logs ci-deploy-bot-7f9c4d6b6-x2k1p -n build --previous',
          outcome: {
            output: [
              '02:14:03 exec session opened from 203.0.113.44',
              '02:14:57 token exchange requested',
            ],
            revealsFacts: ['found-active-use'],
          },
        },
        {
          match: /^cat\s+\/var\/log\/kubernetes\/audit\.log\s*\|\s*grep\s+ci-deploy-bot$/i,
          description: 'cat /var/log/kubernetes/audit.log | grep ci-deploy-bot',
          requiresFacts: ['found-active-use'],
          outcome: {
            output: [
              '02:15:12 GET secrets/ultra-mango-genome-db user=system:serviceaccount:build:ci-deploy-bot',
            ],
            revealsFacts: ['confirmed-ip-access'],
          },
        },
        {
          match: /^kubectl\s+get\s+clusterrolebindings?$/i,
          description: 'kubectl get clusterrolebindings',
          requiresFacts: ['found-active-use', 'confirmed-ip-access'],
          outcome: {
            output: [
              'NAME                    ROLE                       SUBJECT',
              'ci-deploy-bot-binding   ClusterRole/cluster-admin  ServiceAccount/ci-deploy-bot',
              'log-rotator-admin       ClusterRole/cluster-admin  ServiceAccount/log-rotator',
              '',
              "'log-rotator-admin' isn't yours. This is an active, ongoing compromise.",
            ],
            advances: true,
            revealsFacts: ['found-persistence-binding'],
            clusterDelta: {
              highlightNodeIds: ['ci-deploy-bot', 'cluster-admin-binding', 'log-rotator'],
              revealEdgeIds: ['ci-deploy-bot-to-clusteradmin', 'log-rotator-to-clusteradmin'],
              status: 'compromised',
            },
          },
        },
      ],
    },
    {
      id: 'containment',
      title: 'Containment',
      briefing: [
        "You: This is live, and it's not just ci-deploy-bot. Cut off both bindings before they notice you're onto them.",
      ],
      objective: 'Revoke the dangerous bindings and remove the planted service account.',
      clusterInitial: {
        highlightNodeIds: ['ci-deploy-bot', 'cluster-admin-binding', 'log-rotator'],
        revealEdgeIds: ['ci-deploy-bot-to-clusteradmin', 'log-rotator-to-clusteradmin'],
        status: 'compromised',
      },
      commands: [
        {
          match: /^kubectl\s+delete\s+clusterrolebinding\s+ci-deploy-bot-binding$/i,
          description: 'kubectl delete clusterrolebinding ci-deploy-bot-binding',
          outcome: {
            output: ['clusterrolebinding.rbac.authorization.k8s.io "ci-deploy-bot-binding" deleted'],
            revealsFacts: ['revoked-primary-binding'],
          },
        },
        {
          match: /^kubectl\s+delete\s+clusterrolebinding\s+log-rotator-admin$/i,
          description: 'kubectl delete clusterrolebinding log-rotator-admin',
          requiresFacts: ['revoked-primary-binding'],
          outcome: {
            output: ['clusterrolebinding.rbac.authorization.k8s.io "log-rotator-admin" deleted'],
            revealsFacts: ['revoked-persistence-binding'],
          },
        },
        {
          match: /^kubectl\s+delete\s+serviceaccount\s+log-rotator\s+-n\s+kube-system$/i,
          description: 'kubectl delete serviceaccount log-rotator -n kube-system',
          requiresFacts: ['revoked-primary-binding', 'revoked-persistence-binding'],
          outcome: {
            output: [
              'serviceaccount "log-rotator" deleted',
              'Both privilege-escalation paths are closed.',
            ],
            advances: true,
            clusterDelta: { highlightNodeIds: [], revealEdgeIds: [], status: 'contained' },
          },
        },
      ],
    },
    {
      id: 'impact',
      title: 'Impact',
      briefing: ["You: Access is cut. Now find out what they actually got to before you close this out."],
      objective: 'Assess the damage and fix the root cause.',
      clusterInitial: { highlightNodeIds: [], revealEdgeIds: [], status: 'contained' },
      commands: [
        {
          match: /^cat\s+\/var\/log\/kubernetes\/audit\.log\s*\|\s*grep\s+ultra-mango-genome-db$/i,
          description: 'cat /var/log/kubernetes/audit.log | grep ultra-mango-genome-db',
          outcome: {
            output: [
              '02:15:12 GET secrets/ultra-mango-genome-db user=system:serviceaccount:build:ci-deploy-bot',
              '',
              'The genome secret was read before you ever got the alert. Containment stopped further damage, not this.',
            ],
            revealsFacts: ['confirmed-ip-exposure'],
          },
        },
        {
          match: /^kubectl\s+apply\s+-f\s+rbac\/ci-deploy-bot-role\.yaml$/i,
          description: 'kubectl apply -f rbac/ci-deploy-bot-role.yaml',
          requiresFacts: ['confirmed-ip-exposure'],
          outcome: {
            output: [
              'role.rbac.authorization.k8s.io/ci-deploy-bot-role created',
              'rolebinding.rbac.authorization.k8s.io/ci-deploy-bot-role-binding created',
              'ci-deploy-bot is now scoped to only what the build pipeline actually needs.',
              '-- INCIDENT CONTAINED --',
            ],
            advances: true,
            clusterDelta: { status: 'contained' },
          },
        },
      ],
    },
  ],
  debrief: {
    narrative: [
      'The bindings are gone and ci-deploy-bot is scoped down, but the audit trail is clear: the Ultra Mango genome data left the building before you ever got the alert.',
      "Containment worked. Prevention would have worked better.",
    ],
    lesson:
      "The root cause was a CI/CD service account (ci-deploy-bot) bound directly to the built-in cluster-admin ClusterRole fourteen months ago during a migration, and never revisited. Detection caught the live exec activity and a second, hidden persistence binding — but by the time RBAC audit logs were checked, the sensitive secret had already been read. Least-privilege RBAC from the start, plus routine audits of ClusterRoleBindings, would have prevented this rather than just contained it.",
    nextChapterTeaser:
      'Next: the supply-chain compromise itself — how the implant got into the build pipeline before any of this ever happened.',
  },
};
