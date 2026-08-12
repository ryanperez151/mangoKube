import type { LogEvent, LogSource } from '@/content/types';

/**
 * Mulberry32 — a tiny seeded PRNG. Determinism matters more than
 * statistical quality here: the same seed must always produce the same
 * corpus so tests and playthroughs are stable.
 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface NoiseTemplate {
  source: LogSource;
  message: string;
  fields: Record<string, string>;
  analystNote: string;
}

const NOISE_TEMPLATES: NoiseTemplate[] = [
  {
    source: 'k8s-audit',
    message: 'get configmaps/logistics-routing',
    fields: {
      user: 'system:serviceaccount:logistics:route-planner',
      verb: 'get',
      resource: 'configmaps',
      namespace: 'logistics',
      responseCode: '200',
    },
    analystNote: 'A workload reading its own config in its own namespace. Routine.',
  },
  {
    source: 'k8s-audit',
    message: 'watch leases/kube-scheduler',
    fields: {
      user: 'system:kube-scheduler',
      verb: 'watch',
      resource: 'leases',
      namespace: 'kube-system',
      responseCode: '200',
    },
    analystNote: 'Control-plane leader election. This never stops.',
  },
  {
    source: 'k8s-audit',
    message: 'create pods/inventory-sync',
    fields: {
      user: 'system:serviceaccount:kube-system:deployment-controller',
      verb: 'create',
      resource: 'pods',
      namespace: 'logistics',
      responseCode: '201',
    },
    analystNote: 'The deployment controller replacing a pod. Normal cluster churn.',
  },
  {
    source: 'k8s-audit',
    message: 'update deployments/pricing-api',
    fields: {
      user: 'system:serviceaccount:build:ci-deploy-bot',
      verb: 'update',
      resource: 'deployments',
      namespace: 'build',
      responseCode: '200',
    },
    analystNote:
      'ci-deploy-bot deploying inside the build namespace — exactly what a CI account is supposed to do. The account is not the anomaly; scope is.',
  },
  {
    source: 'k8s-audit',
    message: 'get pods/ci-deploy-bot-7f9c4d6b6-x2k1p',
    fields: {
      user: 'system:serviceaccount:build:ci-deploy-bot',
      verb: 'get',
      resource: 'pods',
      namespace: 'build',
      responseCode: '200',
    },
    analystNote: 'A build job checking its own pod status. Routine.',
  },
  {
    source: 'edr',
    message: 'Process node spawned in container',
    fields: {
      pod: 'pricing-api-6b7c8d9-q3n4r',
      namespace: 'product',
      process: 'node',
      parent: 'containerd-shim',
      severity: 'informational',
    },
    analystNote: 'A Node.js service starting up. Expected at container start.',
  },
  {
    source: 'edr',
    message: 'Process npm spawned in container',
    fields: {
      pod: 'ci-deploy-bot-7f9c4d6b6-x2k1p',
      namespace: 'build',
      process: 'npm',
      parent: 'node /opt/agent/entrypoint.js',
      severity: 'informational',
    },
    analystNote:
      'The build agent running npm as a child of its own entrypoint — a scripted, non-interactive job. Compare this parent chain to an interactive shell.',
  },
  {
    source: 'edr',
    message: 'Outbound connection to registry.mangocorp.internal',
    fields: {
      pod: 'ci-deploy-bot-7f9c4d6b6-x2k1p',
      namespace: 'build',
      process: 'containerd',
      remoteIP: '10.42.0.19',
      remotePort: '443',
      severity: 'informational',
    },
    analystNote: 'An image pull from the internal registry. Internal IP, expected port.',
  },
  {
    source: 'apiserver',
    message: 'GET /api/v1/namespaces/logistics/pods',
    fields: {
      user: 'system:serviceaccount:monitoring:prometheus',
      decision: 'allow',
      status: '200',
      latencyMs: '12',
    },
    analystNote: 'Prometheus scraping pod metadata on its usual interval.',
  },
  {
    source: 'apiserver',
    message: 'GET /healthz',
    fields: {
      user: 'system:anonymous',
      decision: 'allow',
      status: '200',
      latencyMs: '1',
    },
    analystNote: 'A load-balancer health probe. Anonymous by design on this endpoint.',
  },
  {
    source: 'ci-cd',
    message: 'pipeline stage completed: build',
    fields: {
      pipeline: 'mangocorp/logistics-api',
      stage: 'build',
      result: 'success',
      actor: 'ci-deploy-bot',
      durationSec: '94',
    },
    analystNote: 'A green build during working hours. Nothing to see.',
  },
  {
    source: 'ci-cd',
    message: 'pipeline stage completed: push-image',
    fields: {
      pipeline: 'mangocorp/pricing-api',
      stage: 'push-image',
      result: 'success',
      actor: 'ci-deploy-bot',
      durationSec: '31',
    },
    analystNote: 'An image push to the internal registry at the end of a successful build.',
  },
];

export interface NoiseOptions {
  count: number;
  startIso: string;
  endIso: string;
  seed: number;
  idPrefix: string;
}

export function generateNoiseEvents(options: NoiseOptions): LogEvent[] {
  const random = createRandom(options.seed);
  const start = Date.parse(options.startIso);
  const span = Date.parse(options.endIso) - start;

  return Array.from({ length: options.count }, (_unused, index) => {
    const template = NOISE_TEMPLATES[Math.floor(random() * NOISE_TEMPLATES.length)];
    const at = new Date(start + Math.floor(random() * span));

    return {
      id: `${options.idPrefix}-${index}`,
      timestamp: at.toISOString().replace(/\.\d{3}Z$/, 'Z'),
      source: template.source,
      message: template.message,
      fields: { ...template.fields },
      arrivesAtStage: 0,
      analystNote: template.analystNote,
    } satisfies LogEvent;
  });
}
