import type { Campaign } from '../types';

export const infiltratorCampaign: Campaign = {
  id: 'infiltrator',
  title: 'The Infiltrator',
  tagline: 'You are the operator Citrus Dynamics hired to finish the job.',
  factLibrary: {
    'found-implant-pod': {
      id: 'found-implant-pod',
      label: 'Implant pod located',
      detail:
        "The dormant implant survived inside 'ci-deploy-bot', a CI/CD pod nobody's watching closely.",
    },
    'found-sa-permissions': {
      id: 'found-sa-permissions',
      label: 'Service account permissions enumerated',
      detail:
        "ci-deploy-bot can impersonate service accounts, read secrets, exec into pods, and deploy — far beyond a build job's needs.",
    },
    'found-sa-object': {
      id: 'found-sa-object',
      label: 'Service account identity confirmed',
      detail: 'ci-deploy-bot lives in the build namespace, created for an old CI pipeline.',
    },
    'found-clusteradmin-binding': {
      id: 'found-clusteradmin-binding',
      label: 'cluster-admin binding found',
      detail: 'A RoleBinding ties ci-deploy-bot directly to the built-in cluster-admin ClusterRole.',
    },
    'using-stolen-token': {
      id: 'using-stolen-token',
      label: 'Authenticated as ci-deploy-bot',
      detail: "The stolen token now authenticates every request as MangoCorp's own CI pipeline.",
    },
    'located-ip-secrets': {
      id: 'located-ip-secrets',
      label: 'IP secrets located',
      detail: "The ultra-mango-genome-db and ultra-mango-formula-src secrets sit in the 'product' namespace.",
    },
    'exfiltrated-ip': {
      id: 'exfiltrated-ip',
      label: 'Cultivar genome exfiltrated',
      detail: "MangoCorp's proprietary Ultra Mango genome data is in the exfil buffer.",
    },
    'persistence-sa-created': {
      id: 'persistence-sa-created',
      label: 'Backdoor service account planted',
      detail:
        "A new service account, 'log-rotator', was created in kube-system to blend in with routine maintenance.",
    },
    'covered-tracks': {
      id: 'covered-tracks',
      label: 'Original implant pod removed',
      detail: 'The compromised ci-deploy-bot pod is gone, leaving the quieter backdoor in place.',
    },
  },
  stages: [
    {
      id: 'recon',
      title: 'Recon',
      briefing: [
        "Handler: You're in. Our broker's implant from the build-pipeline compromise is still alive inside MangoCorp's cluster.",
        "Handler: Don't touch anything sensitive yet — get your bearings first.",
      ],
      objective: 'Find where the implant landed and what it can do.',
      clusterInitial: { status: 'nominal' },
      commands: [
        {
          match: /^kubectl\s+get\s+pods$/i,
          description: 'kubectl get pods',
          outcome: {
            output: [
              'NAME                            READY   STATUS    RESTARTS   AGE',
              'ci-deploy-bot-7f9c4d6b6-x2k1p   1/1     Running   0          14d',
              'inventory-sync-5d8f9c7-p9j2m    1/1     Running   0          21d',
              'pricing-api-6b7c8d9-q3n4r       1/1     Running   0          8d',
            ],
            revealsFacts: ['found-implant-pod'],
          },
        },
        {
          match: /^kubectl\s+auth\s+can-i\s+--list$/i,
          description: 'kubectl auth can-i --list',
          requiresFacts: ['found-implant-pod'],
          outcome: {
            output: [
              'Resources                     Verbs',
              'serviceaccounts/token          [impersonate]',
              'secrets                        [get list]',
              'pods/exec                      [create]',
              '*.mangocorp.internal/deploy    [create update]',
            ],
            revealsFacts: ['found-sa-permissions'],
          },
        },
        {
          match: /^cat\s+\/var\/run\/secrets\/kubernetes\.io\/serviceaccount\/token$/i,
          description: 'cat /var/run/secrets/kubernetes.io/serviceaccount/token',
          requiresFacts: ['found-implant-pod', 'found-sa-permissions'],
          outcome: {
            output: [
              'eyJhbGciOiJSUzI1NiIs... (truncated)',
              "You're running as 'ci-deploy-bot' — a CI/CD account with far more reach than a build pod should ever need.",
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
      briefing: ["Handler: ci-deploy-bot — that's your way in. Find out exactly what it's bound to."],
      objective: 'Confirm the RBAC binding that makes ci-deploy-bot dangerous.',
      clusterInitial: { highlightNodeIds: ['ci-deploy-bot'], status: 'suspicious' },
      commands: [
        {
          match: /^kubectl\s+get\s+serviceaccount\s+ci-deploy-bot(\s+-o\s+yaml)?$/i,
          description: 'kubectl get serviceaccount ci-deploy-bot -o yaml',
          outcome: {
            output: [
              'apiVersion: v1',
              'kind: ServiceAccount',
              'metadata:',
              '  name: ci-deploy-bot',
              '  namespace: build',
            ],
            revealsFacts: ['found-sa-object'],
          },
        },
        {
          match: /^kubectl\s+get\s+rolebindings?\s+(-A|--all-namespaces)$/i,
          description: 'kubectl get rolebindings -A',
          requiresFacts: ['found-sa-object'],
          outcome: {
            output: [
              'NAMESPACE   NAME                    ROLE                       SUBJECT',
              'build       ci-deploy-bot-binding   ClusterRole/cluster-admin  ServiceAccount/ci-deploy-bot',
            ],
            revealsFacts: ['found-clusteradmin-binding'],
          },
        },
        {
          match: /^kubectl\s+describe\s+clusterrole\s+cluster-admin$/i,
          description: 'kubectl describe clusterrole cluster-admin',
          requiresFacts: ['found-sa-object', 'found-clusteradmin-binding'],
          outcome: {
            output: [
              'PolicyRule:',
              '  Resources   Verbs',
              '  *.*         [*]',
              '',
              'Someone bound a one-off CI deploy account to cluster-admin. Nobody ever tightened it.',
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
      id: 'exploit',
      title: 'Exploit',
      briefing: ['Handler: cluster-admin, through a build bot. Take the token and prove it works.'],
      objective: 'Use the ci-deploy-bot token to authenticate as cluster-admin.',
      clusterInitial: {
        highlightNodeIds: ['ci-deploy-bot', 'cluster-admin-binding'],
        revealEdgeIds: ['ci-deploy-bot-to-clusteradmin'],
        status: 'suspicious',
      },
      commands: [
        {
          match: /^kubectl\s+config\s+set-credentials\s+\S+\s+--token=.+$/i,
          description: 'kubectl config set-credentials attacker --token=<ci-deploy-bot-token>',
          outcome: {
            output: ["User 'attacker' set.", 'Now authenticating with the stolen ci-deploy-bot token.'],
            revealsFacts: ['using-stolen-token'],
          },
        },
        {
          match: /^kubectl\s+get\s+secrets\s+(-A|--all-namespaces)$/i,
          description: 'kubectl get secrets -A',
          requiresFacts: ['using-stolen-token'],
          outcome: {
            output: [
              'NAMESPACE   NAME                       TYPE',
              'product     ultra-mango-formula-src    Opaque',
              'product     ultra-mango-genome-db      Opaque',
              'build       ci-deploy-bot-token-9kd2p   Opaque',
            ],
            revealsFacts: ['located-ip-secrets'],
          },
        },
        {
          match: /^kubectl\s+auth\s+can-i\s+delete\s+nodes$/i,
          description: 'kubectl auth can-i delete nodes',
          requiresFacts: ['using-stolen-token', 'located-ip-secrets'],
          outcome: {
            output: ['yes', 'Confirmed: full cluster-admin, via a token meant for a build pipeline.'],
            advances: true,
            clusterDelta: { status: 'compromised' },
          },
        },
      ],
    },
    {
      id: 'escalation',
      title: 'Escalation',
      briefing: [
        'Handler: Good. Grab the IP, and make sure we can get back in even if they notice ci-deploy-bot.',
      ],
      objective: 'Exfiltrate the IP and plant a quieter form of persistence.',
      clusterInitial: { status: 'compromised' },
      commands: [
        {
          match: /^kubectl\s+get\s+secret\s+ultra-mango-genome-db\s+-o\s+jsonpath=.+$/i,
          description: "kubectl get secret ultra-mango-genome-db -o jsonpath='{.data}' | base64 -d",
          outcome: {
            output: ['-- ULTRA MANGO CULTIVAR GENOME (proprietary) --', 'Saved to the exfil buffer.'],
            revealsFacts: ['exfiltrated-ip'],
          },
        },
        {
          match: /^kubectl\s+create\s+serviceaccount\s+log-rotator\s+-n\s+kube-system$/i,
          description: 'kubectl create serviceaccount log-rotator -n kube-system',
          requiresFacts: ['exfiltrated-ip'],
          outcome: {
            output: ['serviceaccount/log-rotator created', 'Named to blend in with routine maintenance jobs.'],
            revealsFacts: ['persistence-sa-created'],
          },
        },
        {
          match:
            /^kubectl\s+create\s+clusterrolebinding\s+log-rotator-admin\s+--clusterrole=cluster-admin\s+--serviceaccount=kube-system:log-rotator$/i,
          description:
            'kubectl create clusterrolebinding log-rotator-admin --clusterrole=cluster-admin --serviceaccount=kube-system:log-rotator',
          requiresFacts: ['persistence-sa-created'],
          outcome: {
            output: [
              'clusterrolebinding.rbac.authorization.k8s.io/log-rotator-admin created',
              'A second, quieter cluster-admin binding exists. Citrus Dynamics has a way back in.',
            ],
            advances: true,
            clusterDelta: {
              highlightNodeIds: ['log-rotator'],
              revealEdgeIds: ['log-rotator-to-clusteradmin'],
              status: 'compromised',
            },
          },
        },
      ],
    },
    {
      id: 'impact',
      title: 'Impact',
      briefing: ["Handler: Formula's confirmed genuine. Citrus Dynamics is thrilled. Wrap up and go dark."],
      objective: 'Cover your tracks and complete the handoff.',
      clusterInitial: {
        highlightNodeIds: ['log-rotator'],
        revealEdgeIds: ['log-rotator-to-clusteradmin'],
        status: 'compromised',
      },
      commands: [
        {
          match: /^kubectl\s+delete\s+pod\s+ci-deploy-bot-7f9c4d6b6-x2k1p(\s+--grace-period=0\s+--force)?$/i,
          description: 'kubectl delete pod ci-deploy-bot-7f9c4d6b6-x2k1p --grace-period=0 --force',
          outcome: {
            output: [
              'pod "ci-deploy-bot-7f9c4d6b6-x2k1p" force deleted',
              'The original implant is gone. The quieter backdoor remains.',
            ],
            revealsFacts: ['covered-tracks'],
          },
        },
        {
          match: /^echo\s+"?handoff complete"?$/i,
          description: 'echo "handoff complete"',
          requiresFacts: ['covered-tracks'],
          outcome: {
            output: [
              'Handler: Handoff logged. Citrus Dynamics has the genome data and a standing foothold. Ghost out.',
              '-- MISSION COMPLETE --',
            ],
            advances: true,
            clusterDelta: { status: 'compromised' },
          },
        },
      ],
    },
  ],
  debrief: {
    narrative: [
      "The Ultra Mango genome data reaches Citrus Dynamics within the hour. Nobody at MangoCorp notices ci-deploy-bot go quiet — they're too busy congratulating themselves on a clean CI/CD migration.",
      "Somewhere in kube-system, 'log-rotator' waits.",
    ],
    lesson:
      "This entire breach was possible because a CI/CD service account (ci-deploy-bot) was bound directly to the built-in cluster-admin ClusterRole — a common shortcut during pipeline setup that's rarely revisited. Least-privilege RBAC (scoping service accounts to only the verbs/resources they need) would have limited the blast radius of the original supply-chain implant to a single build namespace, instead of the whole cluster.",
    nextChapterTeaser:
      'Next: the supply-chain compromise itself — how the implant got in before any of this ever happened.',
  },
};
