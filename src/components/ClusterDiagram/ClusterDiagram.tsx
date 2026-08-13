'use client';

type ClusterStatus = 'nominal' | 'suspicious' | 'compromised' | 'contained';

interface ClusterDiagramProps {
  highlightedNodeIds: string[];
  revealedEdgeIds: string[];
  status: ClusterStatus;
}

const NODES = [
  { id: 'ci-deploy-bot', label: 'ci-deploy-bot', x: 60, y: 60 },
  { id: 'inventory-sync', label: 'inventory-sync', x: 220, y: 40 },
  { id: 'pricing-api', label: 'pricing-api', x: 220, y: 120 },
  { id: 'cluster-admin-binding', label: 'cluster-admin', x: 60, y: 180 },
  { id: 'log-rotator', label: 'log-rotator', x: 220, y: 200 },
] as const;

const EDGES: Record<string, { from: string; to: string }> = {
  'ci-deploy-bot-to-clusteradmin': { from: 'ci-deploy-bot', to: 'cluster-admin-binding' },
  'log-rotator-to-clusteradmin': { from: 'log-rotator', to: 'cluster-admin-binding' },
};

const STATUS_COLORS: Record<ClusterStatus, string> = {
  nominal: '#3f9142',
  suspicious: '#f5a623',
  compromised: '#d1453b',
  contained: '#3f9142',
};

export function ClusterDiagram({ highlightedNodeIds, revealedEdgeIds, status }: ClusterDiagramProps) {
  const nodeById = Object.fromEntries(NODES.map((node) => [node.id, node]));

  return (
    <svg viewBox="0 0 300 260" className="w-full" role="img" aria-label="cluster diagram">
      <rect
        x={2}
        y={2}
        width={296}
        height={256}
        fill="none"
        stroke={STATUS_COLORS[status]}
        strokeWidth={2}
        data-testid="cluster-status-border"
        data-status={status}
      />

      {revealedEdgeIds.map((edgeId) => {
        const edge = EDGES[edgeId];
        if (!edge) return null;
        const from = nodeById[edge.from];
        const to = nodeById[edge.to];
        if (!from || !to) return null;
        return (
          <line
            key={edgeId}
            data-testid={`edge-${edgeId}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={STATUS_COLORS[status]}
            strokeWidth={1.5}
          />
        );
      })}

      {NODES.map((node) => {
        const isHighlighted = highlightedNodeIds.includes(node.id);
        return (
          <g key={node.id} data-testid={`node-${node.id}`} data-highlighted={isHighlighted}>
            <circle
              cx={node.x}
              cy={node.y}
              r={16}
              fill={isHighlighted ? STATUS_COLORS[status] : '#2b1d09'}
              stroke="#ffd27a"
              strokeWidth={1}
            />
            <text x={node.x} y={node.y + 30} fontSize={9} fill="#ffd27a" textAnchor="middle">
              {node.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
