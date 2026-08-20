import type { CampaignPrimer, PrimerSection } from '@/content/types';

/**
 * Familiarization material, written for someone comfortable with a shell and
 * general IT but new to Kubernetes security. Shell basics are assumed;
 * Kubernetes concepts are not.
 *
 * Both roles need the same mental model of the cluster, so they share one
 * section and diverge after it — the attacker learns the toolkit, the
 * defender learns the telemetry.
 */
const kubernetesInOnePage: PrimerSection = {
  id: 'kubernetes-in-one-page',
  title: 'Kubernetes in one page',
  body: [
    'A Kubernetes cluster runs containers on your behalf. You do not talk to the machines; you talk to one HTTP service called the API server, and it makes the cluster match whatever you asked for.',
    'That single front door is why this chapter works the way it does. Every meaningful action is an API call, every API call is authenticated as some identity, and every call can be written down.',
  ],
  entries: [
    {
      term: 'pod',
      meaning: 'One or more containers scheduled together — the smallest thing the cluster runs.',
      note: 'The compromised workload here is a single pod running a CI build agent.',
    },
    {
      term: 'namespace',
      meaning: 'A named partition of the cluster used to group and separate workloads.',
      note: 'It looks like a security boundary. It only is one if permissions are scoped to it.',
    },
    {
      term: 'service account',
      meaning: 'A non-human identity that a pod uses to call the API server.',
      note: 'By default its token is mounted into the container filesystem — so anything that can read files in the pod can become that identity.',
    },
    {
      term: 'RBAC',
      meaning: 'Role-Based Access Control: the rules deciding which identity may perform which verb on which resource.',
      note: 'Verbs are the operations — get, list, create, delete. Resources are the object types — pods, secrets, nodes.',
    },
    {
      term: 'Role / ClusterRole',
      meaning: 'A named set of permissions. A Role applies inside one namespace; a ClusterRole applies across the whole cluster.',
    },
    {
      term: 'RoleBinding / ClusterRoleBinding',
      meaning: 'The object that actually grants a role to an identity. Without a binding, a role does nothing.',
      note: 'Bindings are where privilege really lives — and where this incident was decided fourteen months early.',
    },
    {
      term: 'cluster-admin',
      meaning: 'A built-in ClusterRole permitting every verb on every resource, everywhere.',
      note: 'There is nothing above it. Binding a workload to it means the workload can do anything.',
    },
  ],
};

export const sentinelPrimer: CampaignPrimer = {
  title: 'Your data sources',
  tagline: 'What each log source knows, and what it cannot tell you.',
  intro: [
    'You are an analyst, not an operator. You do not have the cluster — you have what the cluster wrote down about itself, and a search box.',
    'The skill this chapter teaches is corroboration: no single source proves an intrusion, but two independent sources agreeing is very hard to argue with.',
  ],
  sections: [
    kubernetesInOnePage,
    {
      id: 'the-four-sources',
      title: 'The four sources',
      body: [
        'Every event in your index carries a source field. Knowing what each one can and cannot witness is most of the job — it turns "search everything" into "ask the source that would know".',
        'The pairing that matters most in this incident: the audit log can prove a secret was read, and only the endpoint data can prove it left the building. Access and exfiltration are two different claims, and you need two different sources to make them.',
      ],
      entries: [
        {
          term: 'k8s-audit',
          meaning: 'The Kubernetes audit log: every request the API server accepted, with the identity, verb, resource, namespace, and source IP.',
          note: 'Your spine. It proves what was asked for and whether it succeeded — but it stops at the API. It cannot see inside a container.',
        },
        {
          term: 'apiserver',
          meaning: 'Authorization decision records: not just that a request was allowed, but which RBAC rule allowed it.',
          note: 'The highest-value source in the chapter. It names the offending binding outright, turning "how did this happen" into a specific object you can delete.',
        },
        {
          term: 'edr',
          meaning: 'Endpoint detection inside the container: processes that started, and network connections they opened.',
          note: 'Sees what the API server never will — a shell spawning, bytes leaving. Carries a severity field the audit sources do not.',
        },
        {
          term: 'ci-cd',
          meaning: 'Pipeline activity: builds, deploys, and the schedule they were supposed to run on.',
          note: 'Mostly useful as a negative. If the audit log shows CI activity and this source shows no run scheduled, something else is using the CI identity.',
        },
      ],
    },
    {
      id: 'reading-a-line',
      title: 'Reading a log line',
      body: [
        'Click any result to see its full field list. Most of what you need lives in five of them.',
        'Kubernetes writes service account identities in a fixed shape: system:serviceaccount:<namespace>:<name>. So system:serviceaccount:build:ci-deploy-bot is the account named ci-deploy-bot living in the build namespace — the name tells you where it belongs, which is how you notice it acting somewhere it does not.',
      ],
      entries: [
        { term: 'user', meaning: 'The identity that made the request.', note: 'A human email address, or a system:serviceaccount: path.' },
        { term: 'verb', meaning: 'The operation: get, list, create, delete.', note: 'Reads are quiet and common. Writes — create, delete — are rare and worth your attention.' },
        { term: 'resource', meaning: 'The object type acted on: pods, secrets, clusterrolebindings.' },
        { term: 'namespace', meaning: 'Where the action happened. A * means it spanned every namespace at once.' },
        { term: 'sourceIP', meaning: 'Where the request came from.', note: 'An external address on a service account request is not normal. In-cluster workloads call from cluster addresses.' },
        { term: 'responseCode', meaning: 'The HTTP status. 200 and 201 mean it worked.', note: 'A successful dangerous request is an incident; a failed one is a warning.' },
      ],
    },
    {
      id: 'query-syntax',
      title: 'How to search',
      body: [
        'The search bar filters events. Terms combine with AND — every condition you add narrows the result set, it never widens it. There is no aggregation and no statistics; this is about finding specific lines, not counting them.',
        'If you filter on a field name no visible event carries, the console warns you rather than silently returning nothing. That warning usually means a typo, or that the events you want have not arrived yet.',
      ],
      entries: [
        { term: 'source=edr', meaning: 'Match events whose source field contains edr.', note: 'The basic form: field=value. Matching is case-insensitive and partial.' },
        { term: 'user=ci-deploy-bot', meaning: 'Match on any field, not just source.', note: 'Partial matching means you need not type the full system:serviceaccount: path.' },
        { term: '-verb=get', meaning: 'Negation: exclude events where verb contains get.', note: 'Useful for stripping routine reads out of a noisy result set.' },
        { term: 'genome', meaning: 'A bare word searches every field for that substring.', note: 'Good when you know what you are looking for but not which field holds it.' },
        { term: '"create pods/exec"', meaning: 'Quote a value containing spaces or slashes.' },
        { term: 'source=k8s-audit verb=create', meaning: 'Several filters together, joined by AND.', note: 'The workhorse pattern: pick the source that would know, then narrow by what it recorded.' },
      ],
    },
    {
      id: 'building-a-table',
      title: 'Building a table',
      body: [
        'The results table opens on three columns because that is a safe default, not because it is the right view. The Fields panel down the left of the results lists every field your sources produce, grouped by the source that writes it — a field every source shares gets its own "All sources" group — and turns any field carrying at least one result into a column.',
        'Each field carries a count: how many events in your current results actually have it. A field sitting at zero is not empty — that source never recorded it. Knowing which source can answer a question is faster than asking every source in turn.',
        'Tabling the right two or three fields is the whole trick. An outlier stops being a sentence you have to read and becomes a value that looks wrong in a column you are already scanning.',
      ],
      entries: [
        {
          term: 'Fields panel',
          meaning: 'Opens from the left edge of the results.',
          note: 'Pin it if you are going to be working in one source for a while.',
        },
        {
          term: 'user 312 · 74%',
          meaning: 'The field, how many current results carry it, and what share that is.',
          note: 'Low coverage usually means the field belongs to a source your search has mostly filtered out.',
        },
        {
          term: 'Expanding a field',
          meaning: 'Lists its most common values with counts.',
          note: 'The fastest way to notice that one value in a column is not like the others.',
        },
        {
          term: '+ and −',
          meaning: 'Add that value to your search, or exclude it.',
          note: 'The search bar shows the syntax it wrote for you — edit it from there.',
        },
        {
          term: 'Presets',
          meaning: 'Ready-made column sets: Default, Audit triage, EDR triage, and API authorization.',
        },
        {
          term: 'Column headers',
          meaning: 'Click to sort; the ⋮ menu moves or removes the column.',
          note: 'Time sorts newest-first, which is where an incident feed wants to be.',
        },
      ],
    },
    {
      id: 'time-is-a-filter',
      title: 'Time is a filter too',
      body: [
        'The console opens on the last hour, because that is where a live incident is. It is also the fastest way to miss the thing that caused it.',
        'A breach can be hours old while the misconfiguration that permitted it is a year old. The default window hides that completely — the events exist, your search is correct, and you still get nothing back.',
        'When a search that should work returns nothing, widen the range before you conclude the evidence is absent.',
      ],
      entries: [
        { term: 'Last hour', meaning: 'The default. The live incident.' },
        { term: 'Last 24 hours', meaning: 'Yesterday’s context — the deploy or job that preceded the alert.' },
        { term: 'Last 30 days', meaning: 'Recent change history.' },
        { term: 'All time', meaning: 'Everything the index holds.', note: 'Where the origin of a long-standing misconfiguration will be, and nowhere else.' },
      ],
    },
  ],
};

export const infiltratorPrimer: CampaignPrimer = {
  title: 'Your toolkit',
  tagline: 'What you can ask the cluster, and what it writes down when you do.',
  intro: [
    'You have a shell inside a container and whatever identity that container was given. That is the entire starting position. Everything else is enumeration.',
    'Kubernetes is unusually cooperative with an attacker: it will tell you exactly what you are allowed to do, if you ask it politely. Most of this chapter is asking.',
  ],
  sections: [
    kubernetesInOnePage,
    {
      id: 'where-credentials-live',
      title: 'Where the credentials are',
      body: [
        'When a pod is created, Kubernetes mounts its service account token into the container filesystem at a fixed, predictable path. No exploit is involved — this is the documented default, and it is on unless someone turned it off.',
        'That single default is the hinge of this entire operation. Code execution in a pod is therefore also possession of that pod’s cluster identity, and reading the file leaves no trace at the API server.',
      ],
      entries: [
        {
          term: '/var/run/secrets/kubernetes.io/serviceaccount/token',
          meaning: 'The mounted bearer token for the pod’s service account.',
          note: 'Same path in every pod, in every cluster. Read it and you are that identity.',
        },
        {
          term: '/var/run/secrets/kubernetes.io/serviceaccount/namespace',
          meaning: 'Which namespace you are standing in.',
          note: 'Useful for orientation before you make any request.',
        },
      ],
    },
    {
      id: 'command-families',
      title: 'The command families',
      body: [
        'Almost everything is kubectl, and it falls into a few families. Reads tell you where you are; writes change the cluster and are what a defender is watching for.',
        'The most valuable command in the set is auth can-i. Rather than guessing at your permissions, you ask the cluster to enumerate them, and it answers honestly.',
      ],
      entries: [
        { term: 'kubectl get <resource>', meaning: 'List objects of a type.', note: 'Add -A or --all-namespaces to sweep the whole cluster instead of one namespace.' },
        { term: 'kubectl describe <resource> <name>', meaning: 'Human-readable detail for one object.', note: 'How you find out what a role actually permits.' },
        { term: 'kubectl auth can-i --list', meaning: 'Ask the cluster to enumerate everything your identity may do.', note: 'The single highest-value recon command. No guessing, no noise, an authoritative answer.' },
        { term: 'kubectl auth can-i <verb> <resource>', meaning: 'Test one specific permission.', note: 'Probing for destructive verbs tells you the ceiling of what you hold.' },
        { term: 'kubectl config set-credentials', meaning: 'Register a token in your local kubeconfig and start using it.', note: 'Purely local. This is where a stolen token becomes your identity.' },
        { term: 'kubectl create <resource>', meaning: 'Make a new object.', note: 'How persistence is planted — a new account, and a binding that empowers it.' },
        { term: 'kubectl delete <resource>', meaning: 'Remove an object.', note: 'Impact and cleanup. Also the loudest thing you can do.' },
      ],
    },
    {
      id: 'what-actions-cost',
      title: 'What each action costs you',
      body: [
        'The API server can write down every request it accepts. That does not mean every request is dangerous to you — it means the cost of an action depends on how far it stands out from the cluster’s ordinary traffic.',
        'Reads disappear into the noise. A cluster is generating list and get calls constantly from controllers and probes; yours look the same. Writes do not have that cover. Creating a binding in kube-system at half past two in the morning has no routine equivalent to hide behind.',
        'Some of what you do is genuinely invisible: reading the token file, editing your own kubeconfig. Keep the loud steps few and deliberate — your debrief at the end of this operation will show you exactly which ones were which.',
      ],
      entries: [
        { term: 'Reads (get, list, describe)', meaning: 'Recorded, but indistinguishable from routine automation.', note: 'Enumerate freely. This is the cheap part.' },
        { term: 'Local actions (reading the token, kubeconfig edits)', meaning: 'Never reach the API server at all.', note: 'No record exists anywhere. Free.' },
        { term: 'Writes (create, delete)', meaning: 'Rare, distinctive, and exactly what alerting is built around.', note: 'Expensive. Each one is a line an analyst can find.' },
        { term: 'Egress', meaning: 'Moving data out is visible to endpoint monitoring even when the API server sees nothing.', note: 'Reading a secret and stealing a secret are recorded by different systems.' },
      ],
    },
    {
      id: 'how-the-terminal-works',
      title: 'How this terminal works',
      body: [
        'Type a command and press Enter. The console understands the commands that make sense for your current position in the operation, so an action becomes available once you have learned the thing it depends on.',
        'Run `help` for harmless local orientation commands. Tab completes a unique command prefix without putting mission answers on screen before you ask for them.',
        'The Guidance tab on the right escalates on demand — a nudge first, then the specific direction, then the exact command with a button to insert it. Nothing is scored, and reaching for it costs you nothing.',
      ],
    },
  ],
};
