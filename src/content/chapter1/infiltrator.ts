import type { Campaign, CommandDefinition } from '../types';
import { infiltratorPrimer } from './primer';

const mangoTree = [
  '              _\\/_',
  '               /\\',
  '          .-""""""-.',
  `        .'   MANGO   '.`,
  '       /  o   o   o    \\',
  '      / o   o   o   o   \\',
  '             ||',
  '          ___||___',
  '',
  'Not every shell grows on a tree. This one apparently does.',
];

const infiltratorAmbientCommands: CommandDefinition[] = [
  {
    match: /^(?:help|\?)$/i,
    description: 'help',
    outcome: {
      output: [
        'MANGOCORP BUILD RUNNER // LOCAL HELP',
        '',
        'Orientation   whoami, id, hostname, uname -a, pwd',
        'Filesystem    ls [-la], find . -maxdepth 2, cat /workspace/README.md',
        'Runtime       printenv, ps aux, ip addr (or ifconfig)',
        'Tooling       which kubectl, kubectl version --client',
        'Morale        mango',
        '',
        'Mission commands are deliberately omitted from this local menu.',
        'If this shell starts feeling fruitless, the Guidance tab is ripe with the next nudge.',
      ],
    },
  },
  {
    match: /^whoami$/i,
    description: 'whoami',
    outcome: {
      output: [
        'root',
        "Linux user only — Kubernetes requests still use the pod's service account.",
      ],
    },
  },
  {
    match: /^id$/i,
    description: 'id',
    outcome: { output: ['uid=0(root) gid=0(root) groups=0(root)'] },
  },
  {
    match: /^hostname$/i,
    description: 'hostname',
    outcome: { output: ['ci-deploy-bot-7f9c4d6b6-x2k1p'] },
  },
  {
    match: /^uname$/i,
    description: 'uname',
    outcome: { output: ['Linux'] },
  },
  {
    match: /^uname\s+-a$/i,
    description: 'uname -a',
    outcome: {
      output: [
        'Linux ci-deploy-bot-7f9c4d6b6-x2k1p 6.8.0-mango #1 SMP x86_64 GNU/Linux',
      ],
    },
  },
  {
    match: /^pwd$/i,
    description: 'pwd',
    outcome: { output: ['/workspace'] },
  },
  {
    match: /^ls(?:\s+(?:\.|\/workspace)\/?)?$/i,
    description: 'ls',
    outcome: { output: ['README.md  runner.log  runner.sh'] },
  },
  {
    match: /^ls\s+-(?:la|al)(?:\s+(?:\.|\/workspace)\/?)?$/i,
    description: 'ls -la',
    outcome: {
      output: [
        'total 24',
        'drwxr-xr-x 1 root root 4096 Aug 20 02:11 .',
        'drwxr-xr-x 1 root root 4096 Aug 20 02:11 ..',
        '-rw-r--r-- 1 root root   47 Aug 20 02:11 .mango',
        '-rw-r--r-- 1 root root  184 Aug 20 02:11 README.md',
        '-rw-r--r-- 1 root root  112 Aug 20 02:11 runner.log',
        '-rwxr-xr-x 1 root root   52 Aug 20 02:11 runner.sh',
      ],
    },
  },
  {
    match: /^find\s+\.(?:\s+-maxdepth\s+2)?$/i,
    description: 'find . -maxdepth 2',
    outcome: {
      output: ['.', './.mango', './README.md', './runner.log', './runner.sh'],
    },
  },
  {
    match: /^find\s+\/workspace\/?(?:\s+-maxdepth\s+2)?$/i,
    description: 'find /workspace -maxdepth 2',
    outcome: {
      output: [
        '/workspace',
        '/workspace/.mango',
        '/workspace/README.md',
        '/workspace/runner.log',
        '/workspace/runner.sh',
      ],
    },
  },
  {
    match: /^cat\s+(?:\.\/)?(?:\/workspace\/)?README\.md$/i,
    description: 'cat /workspace/README.md',
    outcome: {
      output: [
        '# MangoCorp Build Runner',
        'Ephemeral CI worker for deployment jobs in the build namespace.',
        'kubectl is bundled for pipeline use. Local inspection is expected; cluster changes are not.',
      ],
    },
  },
  {
    match: /^cat\s+(?:\.\/)?(?:\/workspace\/)?\.mango$/i,
    description: 'cat /workspace/.mango',
    outcome: {
      output: ['MANGO_BUILD_VARIETY=kent', '# Tommy Atkins was rejected in code review.'],
    },
  },
  {
    match: /^cat\s+(?:\.\/)?(?:\/workspace\/)?runner\.log$/i,
    description: 'cat /workspace/runner.log',
    outcome: {
      output: [
        '2026-08-20T02:11:04Z INFO runner online',
        '2026-08-20T02:11:05Z INFO waiting for pipeline work',
      ],
    },
  },
  {
    match: /^cat\s+(?:\.\/)?(?:\/workspace\/)?runner\.sh$/i,
    description: 'cat /workspace/runner.sh',
    outcome: { output: ['#!/bin/sh', 'exec /usr/local/bin/mango-runner'] },
  },
  {
    match: /^cat\s+\/etc\/os-release$/i,
    description: 'cat /etc/os-release',
    outcome: {
      output: [
        'NAME="Alpine Linux"',
        'ID=alpine',
        'VERSION_ID=3.20.2',
        'PRETTY_NAME="Alpine Linux v3.20"',
      ],
    },
  },
  {
    match: /^cat\s+\/etc\/hostname$/i,
    description: 'cat /etc/hostname',
    outcome: { output: ['ci-deploy-bot-7f9c4d6b6-x2k1p'] },
  },
  {
    match: /^cat\s+\/var\/run\/secrets\/kubernetes\.io\/serviceaccount\/namespace$/i,
    description: 'cat /var/run/secrets/kubernetes.io/serviceaccount/namespace',
    outcome: { output: ['build'] },
  },
  {
    match: /^(?:env|printenv)$/i,
    description: 'printenv',
    outcome: {
      output: [
        'HOSTNAME=ci-deploy-bot-7f9c4d6b6-x2k1p',
        'HOME=/root',
        'PWD=/workspace',
        'KUBERNETES_SERVICE_HOST=10.43.0.1',
        'KUBERNETES_SERVICE_PORT=443',
        'MANGO_ENV=production',
        'MANGO_VARIETY=kent',
        'PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin',
      ],
    },
  },
  {
    match: /^ip\s+(?:addr|a)$/i,
    description: 'ip addr',
    outcome: {
      output: [
        '1: lo: <LOOPBACK,UP,LOWER_UP> mtu 65536 state UNKNOWN',
        '    inet 127.0.0.1/8 scope host lo',
        '2: eth0@if42: <BROADCAST,MULTICAST,UP,LOWER_UP> mtu 1450 state UP',
        '    inet 10.42.7.23/24 brd 10.42.7.255 scope global eth0',
      ],
    },
  },
  {
    match: /^ifconfig(?:\s+-a)?$/i,
    description: 'ifconfig',
    outcome: {
      output: [
        'eth0      Link encap:Ethernet  HWaddr 02:42:0A:2A:07:17',
        '          inet addr:10.42.7.23  Bcast:10.42.7.255  Mask:255.255.255.0',
        'lo        Link encap:Local Loopback',
        '          inet addr:127.0.0.1  Mask:255.0.0.0',
      ],
    },
  },
  {
    match: /^ps(?:\s+(?:aux|-ef))?$/i,
    description: 'ps aux',
    outcome: {
      output: [
        'PID   USER     TIME  COMMAND',
        '1     root      0:02 /usr/local/bin/mango-runner',
        '17    root      0:00 /bin/sh',
        '31    root      0:00 ps aux',
      ],
    },
  },
  {
    match: /^(?:which\s+kubectl|command\s+-v\s+kubectl)$/i,
    description: 'which kubectl',
    outcome: { output: ['/usr/local/bin/kubectl'] },
  },
  {
    match: /^kubectl\s+version\s+--client(?:=true)?$/i,
    description: 'kubectl version --client',
    outcome: {
      output: ['Client Version: v1.31.4', 'Kustomize Version: v5.4.2'],
    },
  },
  {
    match: /^(?:mango|cat\s+\/etc\/motd)$/i,
    description: 'mango',
    outcome: { output: mangoTree },
  },
];

export const infiltratorCampaign: Campaign = {
  id: 'infiltrator',
  title: 'The Infiltrator',
  tagline: 'You are the operator Citrus Dynamics hired to finish the job.',
  role: {
    fantasy: 'A covert operator exploiting an over-privileged Kubernetes foothold.',
    primaryMechanic: 'Chain fact-gated terminal actions while choosing an operational order.',
    learningFocus: 'How excessive RBAC turns one workload identity into theft and durable persistence.',
  },
  terminalProfile: {
    prompt: 'root@build-runner:/workspace$',
    banner: [
      'MangoCorp Build Runner 4.7.1 // recovery shell',
      'Session restored inside the build namespace. Type `help` for prepared local commands.',
    ],
    ambientCommands: infiltratorAmbientCommands,
  },
  primer: infiltratorPrimer,
  factLibrary: {
    'found-implant-pod': { id: 'found-implant-pod', label: 'Implant pod located', detail: "The dormant implant survived inside 'ci-deploy-bot', a CI/CD pod nobody's watching closely." },
    'found-sa-permissions': { id: 'found-sa-permissions', label: 'Service account permissions enumerated', detail: 'ci-deploy-bot can impersonate service accounts, read secrets, exec into pods, and deploy — far beyond a build job’s needs.' },
    'captured-ci-token': { id: 'captured-ci-token', label: 'CI service account token captured', detail: 'The running build pod exposes a token for ci-deploy-bot, the identity the implant will abuse.' },
    'found-sa-object': { id: 'found-sa-object', label: 'Service account identity confirmed', detail: 'ci-deploy-bot lives in the build namespace, created for an old CI pipeline.' },
    'found-clusteradmin-binding': { id: 'found-clusteradmin-binding', label: 'cluster-admin binding found', detail: 'A ClusterRoleBinding ties ci-deploy-bot directly to the built-in cluster-admin ClusterRole.' },
    'confirmed-cluster-admin': { id: 'confirmed-cluster-admin', label: 'cluster-admin privilege confirmed', detail: 'The built-in cluster-admin role grants unrestricted control; the CI account has it directly.' },
    'using-stolen-token': { id: 'using-stolen-token', label: 'Authenticated as ci-deploy-bot', detail: "The stolen token now authenticates every request as MangoCorp's own CI pipeline." },
    'located-ip-secrets': { id: 'located-ip-secrets', label: 'IP secrets located', detail: "The ultra-mango-genome-db and ultra-mango-formula-src secrets sit in the 'product' namespace." },
    'verified-cluster-admin': { id: 'verified-cluster-admin', label: 'Destructive authority verified', detail: 'The stolen CI identity can delete cluster nodes, confirming full cluster-admin control.' },
    'exfiltrated-ip': { id: 'exfiltrated-ip', label: 'Cultivar genome exfiltrated', detail: "MangoCorp's proprietary Ultra Mango genome data is in the exfil buffer." },
    'persistence-sa-created': { id: 'persistence-sa-created', label: 'Backdoor service account planted', detail: "A new service account, 'log-rotator', was created in kube-system to blend in with routine maintenance." },
    'persistence-binding-created': { id: 'persistence-binding-created', label: 'Backdoor cluster-admin binding created', detail: 'log-rotator-admin gives the planted identity its own independent cluster-admin path.' },
    'covered-tracks': { id: 'covered-tracks', label: 'Original implant pod removed', detail: 'The compromised ci-deploy-bot pod is gone, leaving the quieter backdoor in place.' },
    'handoff-complete': { id: 'handoff-complete', label: 'Criminal handoff completed', detail: 'Citrus Dynamics received the genome data and confirmation of a standing foothold.' },
  },
  stages: [
    {
      id: 'recon', title: 'Recon',
      briefing: ["Handler: You're in. Our broker's implant from the build-pipeline compromise is still alive inside MangoCorp's cluster.", "Handler: Don't touch anything sensitive yet — get your bearings first."],
      objective: 'Find where the implant landed and what it can do.',
      objectiveSteps: [
        { id: 'locate-implant', label: 'Locate the implanted build pod.', requiresFacts: ['found-implant-pod'] },
        { id: 'enumerate-permissions', label: 'Enumerate the build account’s permissions.', requiresFacts: ['found-sa-permissions'] },
        { id: 'capture-token', label: 'Capture the service account token from the pod.', requiresFacts: ['captured-ci-token'] },
      ],
      guidance: [
        {
          level: 1,
          lines: [
            'You have a shell in a container and nothing else. Before touching anything sensitive, work out where you are standing and what this identity is permitted to do.',
          ],
        },
        {
          level: 2,
          lines: [
            'List the workloads in the namespace first — you need to know which pod you actually landed in.',
            'Then ask the cluster what your identity may do. Kubernetes will enumerate your own permissions honestly if you ask it, which is faster and far quieter than probing for them one at a time.',
            'Last, take the credential itself. Every pod has its service account token mounted at a fixed path on disk.',
          ],
        },
        {
          level: 3,
          lines: [
            'Run `kubectl get pods`, then `kubectl auth can-i --list`.',
            'Then read the token with `cat /var/run/secrets/kubernetes.io/serviceaccount/token` — the same path in every pod, in every cluster.',
          ],
          insertText: 'kubectl get pods',
        },
      ],
      resolution: { title: 'Foothold assessed', summary: ['The implant runs as a CI account with reach no build pod should possess.'] },
      clusterInitial: { status: 'nominal' }, advanceWhen: { facts: ['found-implant-pod', 'found-sa-permissions', 'captured-ci-token'] },
      commands: [
        { match: /^kubectl\s+get\s+pods$/i, description: 'kubectl get pods', outcome: { output: ['NAME                            READY   STATUS    RESTARTS   AGE', 'ci-deploy-bot-7f9c4d6b6-x2k1p   1/1     Running   0          14d', 'inventory-sync-5d8f9c7-p9j2m    1/1     Running   0          21d', 'pricing-api-6b7c8d9-q3n4r       1/1     Running   0          8d'], revealsFacts: ['found-implant-pod'] } },
        { match: /^kubectl\s+auth\s+can-i\s+--list$/i, description: 'kubectl auth can-i --list', requiresFacts: ['found-implant-pod'], outcome: { output: ['Resources                     Verbs', 'serviceaccounts/token          [impersonate]', 'secrets                        [get list]', 'pods/exec                      [create]', '*.mangocorp.internal/deploy    [create update]'], revealsFacts: ['found-sa-permissions'] } },
        { match: /^cat\s+\/var\/run\/secrets\/kubernetes\.io\/serviceaccount\/token$/i, description: 'cat /var/run/secrets/kubernetes.io/serviceaccount/token', requiresFacts: ['found-implant-pod', 'found-sa-permissions'], outcome: { output: ['eyJhbGciOiJSUzI1NiIs... (truncated)', "You're running as 'ci-deploy-bot' — a CI/CD account with far more reach than a build pod should ever need."], revealsFacts: ['captured-ci-token'], clusterDelta: { highlightNodeIds: ['ci-deploy-bot'], status: 'suspicious' } } },
      ],
    },
    {
      id: 'discovery', title: 'Discovery',
      briefing: ["Handler: ci-deploy-bot — that's your way in. Find out exactly what it's bound to."],
      objective: 'Confirm the RBAC binding that makes ci-deploy-bot dangerous.',
      objectiveSteps: [
        { id: 'inspect-account', label: 'Inspect the CI service account object.', requiresFacts: ['found-sa-object'] },
        { id: 'find-binding', label: 'Find its ClusterRoleBinding.', requiresFacts: ['found-clusteradmin-binding'] },
        { id: 'confirm-role', label: 'Confirm what the bound cluster-admin role permits.', requiresFacts: ['confirmed-cluster-admin'] },
      ],
      guidance: [
        {
          level: 1,
          lines: [
            'You are holding a token for an account called ci-deploy-bot. The name tells you nothing useful — what matters is which role has been bound to it.',
          ],
        },
        {
          level: 2,
          lines: [
            'Inspect the service account object first, to confirm the identity and the namespace it belongs to.',
            'Then list the cluster-wide bindings. A binding is the object that actually grants power, and it names both the account and the role on one line.',
            'When you see which role it points at, read that role to find out what it permits.',
          ],
        },
        {
          level: 3,
          lines: [
            'Run `kubectl get serviceaccount ci-deploy-bot -o yaml`, then `kubectl get clusterrolebindings`, then `kubectl describe clusterrole cluster-admin`.',
          ],
          insertText: 'kubectl get serviceaccount ci-deploy-bot -o yaml',
        },
      ],
      resolution: { title: 'Privilege shortcut exposed', summary: ['A migration-era CI account is bound directly to unrestricted cluster-admin.'] },
      clusterInitial: { highlightNodeIds: ['ci-deploy-bot'], status: 'suspicious' }, advanceWhen: { facts: ['found-sa-object', 'found-clusteradmin-binding', 'confirmed-cluster-admin'] },
      commands: [
        { match: /^kubectl\s+get\s+serviceaccount\s+ci-deploy-bot(\s+-o\s+yaml)?$/i, description: 'kubectl get serviceaccount ci-deploy-bot -o yaml', outcome: { output: ['apiVersion: v1', 'kind: ServiceAccount', 'metadata:', '  name: ci-deploy-bot', '  namespace: build'], revealsFacts: ['found-sa-object'] } },
        { match: /^kubectl\s+get\s+clusterrolebindings?$/i, description: 'kubectl get clusterrolebindings', requiresFacts: ['found-sa-object'], outcome: { output: ['NAME                    ROLE                       SUBJECT', 'ci-deploy-bot-binding   ClusterRole/cluster-admin  ServiceAccount/ci-deploy-bot'], revealsFacts: ['found-clusteradmin-binding'] } },
        { match: /^kubectl\s+describe\s+clusterrole\s+cluster-admin$/i, description: 'kubectl describe clusterrole cluster-admin', requiresFacts: ['found-sa-object', 'found-clusteradmin-binding'], outcome: { output: ['PolicyRule:', '  Resources   Verbs', '  *.*         [*]', '', 'Someone bound a one-off CI deploy account to cluster-admin. Nobody ever tightened it.'], revealsFacts: ['confirmed-cluster-admin'], clusterDelta: { highlightNodeIds: ['ci-deploy-bot', 'cluster-admin-binding'], revealEdgeIds: ['ci-deploy-bot-to-clusteradmin'], status: 'suspicious' } } },
      ],
    },
    {
      id: 'exploit', title: 'Exploit',
      briefing: ['Handler: cluster-admin, through a build bot. Take the token and prove it works.'],
      objective: 'Use the ci-deploy-bot token to authenticate as cluster-admin.',
      objectiveSteps: [
        { id: 'authenticate', label: 'Authenticate with the stolen CI token.', requiresFacts: ['using-stolen-token'] },
        { id: 'locate-secrets', label: 'Locate MangoCorp’s protected genome secrets.', requiresFacts: ['located-ip-secrets'] },
        { id: 'verify-authority', label: 'Verify the identity can make destructive cluster changes.', requiresFacts: ['verified-cluster-admin'] },
      ],
      guidance: [
        {
          level: 1,
          lines: [
            'Knowing the account is cluster-admin is not the same as using it. Put the stolen token to work, then find out what it really reaches.',
          ],
        },
        {
          level: 2,
          lines: [
            'Register the token as your credential. This is an edit to a local config file — the cluster never sees it happen, so it costs you nothing.',
            'Then use it: list secrets across every namespace at once to find what is worth taking.',
            'Confirm the ceiling of what you hold by testing a destructive permission you have no intention of using.',
          ],
        },
        {
          level: 3,
          lines: [
            'Run `kubectl config set-credentials attacker --token=<ci-deploy-bot-token>`, then `kubectl get secrets -A`, then `kubectl auth can-i delete nodes`.',
          ],
          insertText: 'kubectl config set-credentials attacker --token=<ci-deploy-bot-token>',
        },
      ],
      resolution: { title: 'Cluster control verified', summary: ['The stolen CI identity can read protected data and delete cluster nodes.'] },
      clusterInitial: { highlightNodeIds: ['ci-deploy-bot', 'cluster-admin-binding'], revealEdgeIds: ['ci-deploy-bot-to-clusteradmin'], status: 'suspicious' }, advanceWhen: { facts: ['using-stolen-token', 'located-ip-secrets', 'verified-cluster-admin'] },
      commands: [
        { match: /^kubectl\s+config\s+set-credentials\s+\S+\s+--token=.+$/i, description: 'kubectl config set-credentials attacker --token=<ci-deploy-bot-token>', outcome: { output: ["User 'attacker' set.", 'Now authenticating with the stolen ci-deploy-bot token.'], revealsFacts: ['using-stolen-token'] } },
        { match: /^kubectl\s+get\s+secrets\s+(-A|--all-namespaces)$/i, description: 'kubectl get secrets -A', requiresFacts: ['using-stolen-token'], outcome: { output: ['NAMESPACE   NAME                       TYPE', 'product     ultra-mango-formula-src    Opaque', 'product     ultra-mango-genome-db      Opaque', 'build       ci-deploy-bot-token-9kd2p   Opaque'], revealsFacts: ['located-ip-secrets'] } },
        { match: /^kubectl\s+auth\s+can-i\s+delete\s+nodes$/i, description: 'kubectl auth can-i delete nodes', requiresFacts: ['using-stolen-token', 'located-ip-secrets'], outcome: { output: ['yes', 'Confirmed: full cluster-admin, via a token meant for a build pipeline.'], revealsFacts: ['verified-cluster-admin'], clusterDelta: { status: 'compromised' } } },
      ],
    },
    {
      id: 'escalation', title: 'Escalation',
      briefing: ['Handler: Good. Grab the IP, and make sure we can get back in even if they notice ci-deploy-bot.'],
      conditionalBriefing: [
        { when: { 'operational-order': 'exfil-first' }, lines: ['Handler: The genome comes first. Leave the quiet access path after the buffer is full.'] },
        { when: { 'operational-order': 'persistence-first' }, lines: ['Handler: Plant the quiet identity first. The theft can wait until the return path is safe.'] },
      ],
      objective: 'Exfiltrate the IP and plant a quieter form of persistence.',
      objectiveSteps: [
        { id: 'exfiltrate-genome', label: 'Copy the genome into the exfiltration buffer.', requiresFacts: ['exfiltrated-ip'] },
        { id: 'create-backdoor-account', label: 'Create a maintenance-looking backdoor account.', requiresFacts: ['persistence-sa-created'] },
        { id: 'bind-backdoor-account', label: 'Bind the backdoor account to cluster-admin.', requiresFacts: ['persistence-binding-created'] },
      ],
      guidance: [
        {
          level: 1,
          lines: [
            'Two jobs remain: take the genome, and make sure you can come back after they notice the pod you are sitting in.',
            'The order you chose decides which unlocks first. Both still have to be done.',
          ],
        },
        {
          level: 2,
          lines: [
            'You chose the theft first. Read the genome straight out of the product namespace — cluster-admin ignores namespace boundaries entirely.',
            'Then build the return path: a new service account, and a binding that gives it cluster-admin of its own. Name it after something routine.',
          ],
          visibleWhen: { 'operational-order': 'exfil-first' },
        },
        {
          level: 2,
          lines: [
            'You chose the return path first. Create the service account, then bind it to cluster-admin — a binding without an account to attach is useless, so the order is fixed.',
            'Once the second identity exists and is empowered, go back for the genome.',
          ],
          visibleWhen: { 'operational-order': 'persistence-first' },
        },
        {
          level: 3,
          lines: [
            "Run `kubectl get secret ultra-mango-genome-db -o jsonpath='{.data}' | base64 -d` first.",
            'Then `kubectl create serviceaccount log-rotator -n kube-system`, then bind it with `kubectl create clusterrolebinding log-rotator-admin --clusterrole=cluster-admin --serviceaccount=kube-system:log-rotator`.',
          ],
          insertText: "kubectl get secret ultra-mango-genome-db -o jsonpath='{.data}' | base64 -d",
          visibleWhen: { 'operational-order': 'exfil-first' },
        },
        {
          level: 3,
          lines: [
            'Run `kubectl create serviceaccount log-rotator -n kube-system` first, then `kubectl create clusterrolebinding log-rotator-admin --clusterrole=cluster-admin --serviceaccount=kube-system:log-rotator`.',
            "With the way back in secured, take the genome: `kubectl get secret ultra-mango-genome-db -o jsonpath='{.data}' | base64 -d`.",
          ],
          insertText: 'kubectl create serviceaccount log-rotator -n kube-system',
          visibleWhen: { 'operational-order': 'persistence-first' },
        },
      ],
      decision: {
        id: 'operational-order', timing: 'before-stage', prompt: 'Which risk do you accept first: exposure during theft or exposure before persistence is planted?',
        options: [
          { id: 'exfil-first', label: 'Exfiltrate first', description: 'Take the genome before investing in a quieter foothold.' },
          { id: 'persistence-first', label: 'Plant persistence first', description: 'Secure the return path before touching the target secret.' },
        ],
      },
      resolution: {
        title: 'Theft and persistence complete', summary: ['The genome is in Citrus Dynamics’ buffer and a second cluster-admin identity now survives the original implant.'],
        conditionalSummary: [
          { when: { 'operational-order': 'exfil-first' }, lines: ['You stole the genome before the cluster could close. The persistence work followed under more pressure.'] },
          { when: { 'operational-order': 'persistence-first' }, lines: ['You secured a return path before touching the genome, trading speed for continuity.'] },
        ],
      },
      clusterInitial: { status: 'compromised' }, advanceWhen: { facts: ['exfiltrated-ip', 'persistence-sa-created', 'persistence-binding-created'] },
      commands: [
        { match: /^kubectl\s+get\s+secret\s+ultra-mango-genome-db\s+-o\s+jsonpath=.+$/i, description: "kubectl get secret ultra-mango-genome-db -o jsonpath='{.data}' | base64 -d", visibleWhen: { 'operational-order': 'exfil-first' }, outcome: { output: ['-- ULTRA MANGO CULTIVAR GENOME (proprietary) --', 'Saved to the exfil buffer.'], revealsFacts: ['exfiltrated-ip'] } },
        { match: /^kubectl\s+create\s+serviceaccount\s+log-rotator\s+-n\s+kube-system$/i, description: 'kubectl create serviceaccount log-rotator -n kube-system', visibleWhen: { 'operational-order': 'exfil-first' }, requiresFacts: ['exfiltrated-ip'], outcome: { output: ['serviceaccount/log-rotator created', 'Named to blend in with routine maintenance jobs.'], revealsFacts: ['persistence-sa-created'] } },
        { match: /^kubectl\s+create\s+clusterrolebinding\s+log-rotator-admin\s+--clusterrole=cluster-admin\s+--serviceaccount=kube-system:log-rotator$/i, description: 'kubectl create clusterrolebinding log-rotator-admin --clusterrole=cluster-admin --serviceaccount=kube-system:log-rotator', visibleWhen: { 'operational-order': 'exfil-first' }, requiresFacts: ['persistence-sa-created'], outcome: { output: ['clusterrolebinding.rbac.authorization.k8s.io/log-rotator-admin created', 'A second, quieter cluster-admin binding exists. Citrus Dynamics has a way back in.'], revealsFacts: ['persistence-binding-created'], clusterDelta: { highlightNodeIds: ['log-rotator'], revealEdgeIds: ['log-rotator-to-clusteradmin'], status: 'compromised' } } },
        { match: /^kubectl\s+create\s+serviceaccount\s+log-rotator\s+-n\s+kube-system$/i, description: 'kubectl create serviceaccount log-rotator -n kube-system', visibleWhen: { 'operational-order': 'persistence-first' }, outcome: { output: ['serviceaccount/log-rotator created', 'Named to blend in with routine maintenance jobs.'], revealsFacts: ['persistence-sa-created'] } },
        { match: /^kubectl\s+create\s+clusterrolebinding\s+log-rotator-admin\s+--clusterrole=cluster-admin\s+--serviceaccount=kube-system:log-rotator$/i, description: 'kubectl create clusterrolebinding log-rotator-admin --clusterrole=cluster-admin --serviceaccount=kube-system:log-rotator', visibleWhen: { 'operational-order': 'persistence-first' }, requiresFacts: ['persistence-sa-created'], outcome: { output: ['clusterrolebinding.rbac.authorization.k8s.io/log-rotator-admin created', 'A second, quieter cluster-admin binding exists. Citrus Dynamics has a way back in.'], revealsFacts: ['persistence-binding-created'], clusterDelta: { highlightNodeIds: ['log-rotator'], revealEdgeIds: ['log-rotator-to-clusteradmin'], status: 'compromised' } } },
        { match: /^kubectl\s+get\s+secret\s+ultra-mango-genome-db\s+-o\s+jsonpath=.+$/i, description: "kubectl get secret ultra-mango-genome-db -o jsonpath='{.data}' | base64 -d", visibleWhen: { 'operational-order': 'persistence-first' }, requiresFacts: ['persistence-binding-created'], outcome: { output: ['-- ULTRA MANGO CULTIVAR GENOME (proprietary) --', 'Saved to the exfil buffer.'], revealsFacts: ['exfiltrated-ip'] } },
      ],
    },
    {
      id: 'impact', title: 'Impact',
      briefing: ["Handler: Formula's confirmed genuine. Citrus Dynamics is thrilled. Wrap up and go dark."],
      objective: 'Cover your tracks and complete the handoff.',
      objectiveSteps: [
        { id: 'remove-implant', label: 'Remove the original implanted pod.', requiresFacts: ['covered-tracks'] },
        { id: 'complete-handoff', label: 'Confirm the theft and foothold to the handler.', requiresFacts: ['handoff-complete'] },
      ],
      guidance: [
        {
          level: 1,
          lines: [
            'The loud implant has done its job and the quiet one is already in place. Remove what you no longer need, then close out.',
          ],
        },
        {
          level: 2,
          lines: [
            'Delete the original build pod — the one whose shell started all this. The backdoor account in kube-system is a separate object and is untouched by that.',
            'A forced pod delete is the single loudest action in the operation, which is exactly why it goes last.',
          ],
        },
        {
          level: 3,
          lines: [
            'Run `kubectl delete pod ci-deploy-bot-7f9c4d6b6-x2k1p --grace-period=0 --force`, then `echo "handoff complete"`.',
          ],
          insertText: 'kubectl delete pod ci-deploy-bot-7f9c4d6b6-x2k1p --grace-period=0 --force',
        },
      ],
      resolution: { title: 'Operation complete', summary: ['The original implant is gone, the backdoor persists, and Citrus Dynamics has the genome.'] },
      clusterInitial: { highlightNodeIds: ['log-rotator'], revealEdgeIds: ['log-rotator-to-clusteradmin'], status: 'compromised' }, advanceWhen: { facts: ['covered-tracks', 'handoff-complete'] },
      commands: [
        { match: /^kubectl\s+delete\s+pod\s+ci-deploy-bot-7f9c4d6b6-x2k1p(\s+--grace-period=0\s+--force)?$/i, description: 'kubectl delete pod ci-deploy-bot-7f9c4d6b6-x2k1p --grace-period=0 --force', outcome: { output: ['pod "ci-deploy-bot-7f9c4d6b6-x2k1p" force deleted', 'The original implant is gone. The quieter backdoor remains.'], revealsFacts: ['covered-tracks'] } },
        { match: /^echo\s+"?handoff complete"?$/i, description: 'echo "handoff complete"', requiresFacts: ['covered-tracks'], outcome: { output: ['Handler: Handoff logged. Citrus Dynamics has the genome data and a standing foothold. Ghost out.', '-- MISSION COMPLETE --'], revealsFacts: ['handoff-complete'], clusterDelta: { status: 'compromised' } } },
      ],
    },
  ],
  debrief: {
    narrative: ["The Ultra Mango genome data reaches Citrus Dynamics within the hour. Nobody at MangoCorp notices ci-deploy-bot go quiet — they're too busy congratulating themselves on a clean CI/CD migration.", "Somewhere in kube-system, 'log-rotator' waits."],
    lesson: 'This entire breach was possible because a CI/CD service account was bound directly to the built-in cluster-admin ClusterRole. Least-privilege RBAC — scoping service accounts to only the verbs and resources they need — would have limited the compromised build pod to one namespace instead of the whole cluster.',
    nextChapterTeaser: 'Next: the supply-chain compromise itself — how the implant got in before any of this ever happened.',
  },
  conditionalDebrief: [
    { when: { 'operational-order': 'exfil-first' }, lines: ['You put the genome in Citrus Dynamics’ hands before securing the quieter foothold: maximum immediate payoff, maximum exposure during the follow-on work.'] },
    { when: { 'operational-order': 'persistence-first' }, lines: ['You planted log-rotator before the theft: a slower route to the genome, but one built around keeping a way back in.'] },
  ],
};
