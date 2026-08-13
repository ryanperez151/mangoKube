import type { Campaign } from '../types';

export const infiltratorCampaign: Campaign = {
  id: 'infiltrator',
  title: 'The Infiltrator',
  tagline: 'You are the operator Citrus Dynamics hired to finish the job.',
  role: {
    fantasy: 'A covert operator exploiting an over-privileged Kubernetes foothold.',
    primaryMechanic: 'Chain fact-gated terminal actions while choosing an operational order.',
    learningFocus: 'How excessive RBAC turns one workload identity into theft and durable persistence.',
  },
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
        { level: 1, lines: ['Start with the workloads already running in the cluster.'] },
        { level: 2, lines: ['Once the implant is located, inspect what its identity can do before using it.'] },
        { level: 3, lines: ['Run `kubectl get pods`, `kubectl auth can-i --list`, then read the mounted service account token.'] },
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
        { level: 1, lines: ['The account object identifies the subject; bindings explain its power.'] },
        { level: 2, lines: ['Find the ClusterRoleBinding, then inspect the role it grants.'] },
        { level: 3, lines: ['Run `kubectl get serviceaccount ci-deploy-bot -o yaml`, `kubectl get clusterrolebindings`, and `kubectl describe clusterrole cluster-admin`.'] },
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
        { level: 1, lines: ['Use the token before attempting a sensitive read.'] },
        { level: 2, lines: ['A cluster-admin identity can enumerate secrets across namespaces.'] },
        { level: 3, lines: ['Set credentials with the token, list `kubectl get secrets -A`, then test `kubectl auth can-i delete nodes`.'] },
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
        { level: 1, lines: ['The job requires both theft and a return path.'] },
        { level: 2, lines: ['Your chosen order determines which action unlocks first, but both routes need the same three facts.'] },
        { level: 3, lines: ['Follow the available commands: the selected route gates the alternate operation until the required fact exists.'] },
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
        { level: 1, lines: ['The quiet backdoor remains; remove only the noisy original implant.'] },
        { level: 2, lines: ['Delete ci-deploy-bot, then log the completed handoff.'] },
        { level: 3, lines: ['Run the force-delete command for the pod, then `echo "handoff complete"`.'] },
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
