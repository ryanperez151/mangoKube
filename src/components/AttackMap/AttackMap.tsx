'use client';

import { useState } from 'react';
import type { AttackMapNode, AttackMapNodeState } from '@/content/types';
import { deriveNodeState } from '@/content/chapter1/attackMap';

interface AttackMapProps {
  nodes: AttackMapNode[];
  facts: string[];
}

const STATE_STYLE: Record<
  AttackMapNodeState,
  { fill: string; stroke: string; dash?: string; glyph: string; radius: number }
> = {
  undiscovered: { fill: '#141d16', stroke: '#3b4a3d', dash: '2 3', glyph: '·', radius: 3.2 },
  suspected: { fill: '#2b1d09', stroke: '#f5a623', dash: '3 2', glyph: '?', radius: 4 },
  confirmed: { fill: '#c2372b', stroke: '#e86a5c', glyph: '!', radius: 4.6 },
  contained: { fill: '#1c3a25', stroke: '#4a9d5f', glyph: '✓', radius: 4.2 },
};

/**
 * The kill chain drawn as a branch: limbs grow outward from the trunk,
 * and each node's state is carried by shape and glyph as well as colour
 * so the map stays readable without relying on hue.
 */
export function AttackMap({ nodes, facts }: AttackMapProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const factSet = new Set(facts);
  const stateById = new Map(nodes.map((node) => [node.id, deriveNodeState(node, factSet)]));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));

  const selected = selectedId ? nodeById.get(selectedId) : undefined;
  const selectedState = selectedId ? stateById.get(selectedId) : undefined;

  return (
    <section aria-label="attack path map" className="flex h-full flex-col gap-3">
      <svg viewBox="0 0 100 100" className="w-full" role="presentation">
        {nodes.map((node) => {
          if (!node.parentId) return null;
          const parent = nodeById.get(node.parentId);
          if (!parent) return null;
          const state = stateById.get(node.id) ?? 'undiscovered';
          const style = STATE_STYLE[state];
          const midX = (parent.x + node.x) / 2;
          const midY = Math.min(parent.y, node.y) - 6;

          return (
            <path
              key={node.id}
              data-testid={`map-limb-${node.id}`}
              d={`M ${parent.x} ${parent.y} Q ${midX} ${midY} ${node.x} ${node.y}`}
              fill="none"
              stroke={style.stroke}
              strokeWidth={state === 'undiscovered' ? 0.5 : 1.1}
              strokeDasharray={style.dash}
              opacity={state === 'undiscovered' ? 0.45 : 1}
            />
          );
        })}

        {nodes.map((node) => {
          const state = stateById.get(node.id) ?? 'undiscovered';
          const style = STATE_STYLE[state];
          const isDiscovered = state !== 'undiscovered';

          return (
            <g
              key={node.id}
              data-testid={`map-node-${node.id}`}
              data-state={state}
              role="button"
              tabIndex={isDiscovered ? 0 : -1}
              aria-label={`${isDiscovered ? node.label : 'Undiscovered step'} — ${state}`}
              className={isDiscovered ? 'cursor-pointer' : 'cursor-default'}
              onClick={() => isDiscovered && setSelectedId(node.id)}
              onKeyDown={(event) => {
                if (!isDiscovered) return;
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setSelectedId(node.id);
                }
              }}
            >
              <circle
                cx={node.x}
                cy={node.y}
                r={style.radius}
                fill={style.fill}
                stroke={style.stroke}
                strokeWidth={0.7}
                strokeDasharray={style.dash}
              />
              <text
                x={node.x}
                y={node.y + 1.4}
                fontSize={4}
                fill={style.stroke}
                textAnchor="middle"
                aria-hidden="true"
              >
                {style.glyph}
              </text>
              {isDiscovered && (
                <text
                  x={node.x}
                  y={node.y + style.radius + 4}
                  fontSize={2.8}
                  fill="#ffd27a"
                  textAnchor="middle"
                >
                  {node.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      {selected && selectedState && (
        <div
          data-testid="map-detail"
          className="space-y-2 rounded border border-mango-500/30 bg-orchard-900/70 p-3 text-xs leading-relaxed"
        >
          <p className="text-[10px] uppercase tracking-widest text-mango-500">
            {selected.tactic} — {selectedState}
          </p>
          <p className="text-sm text-mango-100">{selected.label}</p>
          <p className="text-mango-300/80">{selected.summary}</p>
          <p className="border-l-2 border-mango-500/50 pl-3 text-mango-300">{selected.lesson}</p>
          <p className="border-l-2 border-leaf-500/60 pl-3 text-leaf-300">{selected.prevention}</p>
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="text-mango-300/60 underline hover:text-mango-300"
          >
            Close
          </button>
        </div>
      )}
    </section>
  );
}
