# Operation Mango — Chapter 1 ("Privileged Access") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully client-side, cinematic Next.js simulation of Chapter 1 ("Privileged Access") of Operation Mango — a fictional RBAC-misconfiguration/privilege-escalation storyline at "MangoCorp", playable as either the Infiltrator (attacker) or the Sentinel (defender), driven by a reusable data-driven scene engine.

**Architecture:** A generic scene engine (types + terminal parser + reachability validator + Zustand progress store) that is completely content-agnostic, plus Chapter 1 content defined as two data files (`infiltrator.ts`, `sentinel.ts`). Presentational React components (Terminal, ClusterDiagram, BriefingOverlay, DebriefPanel) consume the engine via props/hooks and are wired together by four Next.js app-router pages. No backend; everything persists to `localStorage`.

**Tech Stack:** Next.js (static export) + React + TypeScript (strict) + Zustand (with `persist` middleware) + Framer Motion + Tailwind CSS + Vitest + @testing-library/react.

## Global Constraints

- Fully simulated in-browser only — no real Kubernetes clusters, no backend, no network calls. (Design decision: "Fully simulated in-browser.")
- Scope of this build is Chapter 1 ("Privileged Access") only, both campaigns (Infiltrator and Sentinel). No scoring/grading — debrief is narrative + educational only.
- Content (missions/stages/dialogue/terminal scripts) must be structured data driving a generic engine, not hardcoded per-screen logic, so future chapters are new data files only.
- `output: 'export'` static export — avoid any Next.js server-only APIs (route handlers, server actions, `next/headers`, etc.).
- TypeScript `strict: true`. No `any`.
- Primary risk called out in the spec is broken narrative state (soft-locks), not traditional logic bugs — every stage's command tree must have an automatically-verified path to completion (`findAdvancePath`), and this must be enforced by a test for every real content stage, not just engine unit tests.

---

### Task 1: Project Scaffold & Toolchain

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `next.config.mjs`
- Create: `tailwind.config.ts`
- Create: `postcss.config.mjs`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Create: `src/app/layout.tsx`
- Create: `src/app/globals.css`
- Create: `src/app/page.tsx` (temporary placeholder; replaced in Task 9)
- Create: `src/lib/cn.ts`
- Test: `src/lib/cn.test.ts`

**Interfaces:**
- Produces: `cn(...classes: Array<string | false | null | undefined>): string` — used by later components for conditional class names.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "operation-mango",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "validate:content": "vitest run src/content/**/*.reachability.test.ts"
  },
  "dependencies": {
    "next": "^14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "zustand": "^4.5.4",
    "framer-motion": "^11.3.19"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "@types/node": "^20.14.15",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "tailwindcss": "^3.4.9",
    "postcss": "^8.4.41",
    "autoprefixer": "^10.4.19",
    "vitest": "^2.0.5",
    "@vitejs/plugin-react": "^4.3.1",
    "jsdom": "^24.1.1",
    "@testing-library/react": "^16.0.0",
    "@testing-library/jest-dom": "^6.4.8"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: installs without errors, creates `node_modules/` and `package-lock.json`.

- [ ] **Step 3: Create TypeScript, Next.js, Tailwind, PostCSS and Vitest configs**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "baseUrl": ".",
    "paths": { "@/*": ["src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

`next.config.mjs`:

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
};

export default nextConfig;
```

`tailwind.config.ts`:

```ts
import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        mango: {
          950: '#1a1206',
          900: '#2b1d09',
          500: '#f5a623',
          300: '#ffd27a',
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

`postcss.config.mjs`:

```js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

`vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

`vitest.setup.ts`:

```ts
import '@testing-library/jest-dom';
```

- [ ] **Step 4: Create the app shell**

`src/app/globals.css`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-mango-950 text-mango-300;
}
```

`src/app/layout.tsx`:

```tsx
import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Operation Mango',
  description: 'A cinematic Kubernetes attack/defense simulation.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/page.tsx` (placeholder, replaced in Task 9):

```tsx
export default function HomePlaceholder() {
  return <main className="p-8">Operation Mango — scaffold OK.</main>;
}
```

- [ ] **Step 5: Write the failing test for `cn`**

`src/lib/cn.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { cn } from './cn';

describe('cn', () => {
  it('joins truthy class names with a space', () => {
    expect(cn('a', 'b', 'c')).toBe('a b c');
  });

  it('filters out falsy values', () => {
    expect(cn('a', false, null, undefined, 'b')).toBe('a b');
  });
});
```

- [ ] **Step 6: Run the test and verify it fails**

Run: `npm run test -- src/lib/cn.test.ts`
Expected: FAIL — `cn` is not defined / module not found.

- [ ] **Step 7: Implement `cn`**

`src/lib/cn.ts`:

```ts
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}
```

- [ ] **Step 8: Run the test and verify it passes**

Run: `npm run test -- src/lib/cn.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json tsconfig.json next.config.mjs tailwind.config.ts postcss.config.mjs vitest.config.ts vitest.setup.ts src/app/layout.tsx src/app/globals.css src/app/page.tsx src/lib/cn.ts src/lib/cn.test.ts
git commit -m "chore: scaffold Next.js + TypeScript + Tailwind + Vitest toolchain"
```

---

### Task 2: Content Types, Terminal Parser & Reachability Validator

**Files:**
- Create: `src/content/types.ts`
- Create: `src/engine/terminalParser.ts`
- Test: `src/engine/terminalParser.test.ts`
- Create: `src/engine/reachability.ts`
- Test: `src/engine/reachability.test.ts`

**Interfaces:**
- Produces: `CampaignId`, `Fact`, `ClusterDelta`, `CommandOutcome`, `CommandDefinition`, `Stage`, `CampaignDebrief`, `Campaign`, `TerminalEntry` (all from `src/content/types.ts`); `parseCommand(input: string, stage: Stage, revealedFacts: ReadonlySet<string>): CommandOutcome | null`; `findAdvancePath(stage: Stage): string[] | null`.

- [ ] **Step 1: Define the content types**

`src/content/types.ts`:

```ts
export type CampaignId = 'infiltrator' | 'sentinel';

export interface Fact {
  id: string;
  label: string;
  detail: string;
}

export interface ClusterDelta {
  highlightNodeIds?: string[];
  revealEdgeIds?: string[];
  status?: 'nominal' | 'suspicious' | 'compromised' | 'contained';
}

export interface CommandOutcome {
  output: string[];
  revealsFacts?: string[];
  advances?: boolean;
  clusterDelta?: ClusterDelta;
}

export interface CommandDefinition {
  match: RegExp;
  description: string;
  requiresFacts?: string[];
  outcome: CommandOutcome;
}

export interface Stage {
  id: string;
  title: string;
  briefing: string[];
  objective: string;
  commands: CommandDefinition[];
  clusterInitial: ClusterDelta;
}

export interface CampaignDebrief {
  narrative: string[];
  lesson: string;
  nextChapterTeaser: string;
}

export interface Campaign {
  id: CampaignId;
  title: string;
  tagline: string;
  stages: Stage[];
  factLibrary: Record<string, Fact>;
  debrief: CampaignDebrief;
}

export interface TerminalEntry {
  input: string;
  output: string[];
}
```

- [ ] **Step 2: Write the failing test for the terminal parser**

`src/engine/terminalParser.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { parseCommand } from './terminalParser';
import type { Stage } from '@/content/types';

const stage: Stage = {
  id: 'test-stage',
  title: 'Test Stage',
  briefing: [],
  objective: 'test',
  clusterInitial: {},
  commands: [
    {
      match: /^kubectl get pods$/i,
      description: 'kubectl get pods',
      outcome: { output: ['pod-a', 'pod-b'], revealsFacts: ['found-pods'] },
    },
    {
      match: /^kubectl describe pod pod-a$/i,
      description: 'kubectl describe pod pod-a',
      requiresFacts: ['found-pods'],
      outcome: { output: ['details of pod-a'], advances: true },
    },
  ],
};

describe('parseCommand', () => {
  it('matches a command with no prerequisites', () => {
    const outcome = parseCommand('kubectl get pods', stage, new Set());
    expect(outcome?.output).toEqual(['pod-a', 'pod-b']);
  });

  it('returns null when prerequisites are not met', () => {
    const outcome = parseCommand('kubectl describe pod pod-a', stage, new Set());
    expect(outcome).toBeNull();
  });

  it('matches a gated command once prerequisites are satisfied', () => {
    const outcome = parseCommand('kubectl describe pod pod-a', stage, new Set(['found-pods']));
    expect(outcome?.advances).toBe(true);
  });

  it('returns null for unrecognized input', () => {
    const outcome = parseCommand('rm -rf /', stage, new Set());
    expect(outcome).toBeNull();
  });
});
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `npm run test -- src/engine/terminalParser.test.ts`
Expected: FAIL — cannot find module `./terminalParser`.

- [ ] **Step 4: Implement the terminal parser**

`src/engine/terminalParser.ts`:

```ts
import type { CommandOutcome, Stage } from '@/content/types';

export function parseCommand(
  input: string,
  stage: Stage,
  revealedFacts: ReadonlySet<string>
): CommandOutcome | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  for (const command of stage.commands) {
    if (!command.match.test(trimmed)) continue;
    const requires = command.requiresFacts ?? [];
    if (requires.every((factId) => revealedFacts.has(factId))) {
      return command.outcome;
    }
  }
  return null;
}
```

- [ ] **Step 5: Run the test and verify it passes**

Run: `npm run test -- src/engine/terminalParser.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Write the failing test for the reachability validator**

`src/engine/reachability.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findAdvancePath } from './reachability';
import type { Stage } from '@/content/types';

describe('findAdvancePath', () => {
  it('finds a path when commands must be run in fact order', () => {
    const stage: Stage = {
      id: 's',
      title: 't',
      briefing: [],
      objective: 'o',
      clusterInitial: {},
      commands: [
        { match: /a/, description: 'a', outcome: { output: [], revealsFacts: ['f1'] } },
        {
          match: /b/,
          description: 'b',
          requiresFacts: ['f1'],
          outcome: { output: [], advances: true },
        },
      ],
    };
    expect(findAdvancePath(stage)).toEqual(['a', 'b']);
  });

  it('returns null when no command sequence reaches advances: true', () => {
    const stage: Stage = {
      id: 's',
      title: 't',
      briefing: [],
      objective: 'o',
      clusterInitial: {},
      commands: [
        { match: /a/, description: 'a', outcome: { output: [], revealsFacts: ['f1'] } },
      ],
    };
    expect(findAdvancePath(stage)).toBeNull();
  });

  it('handles a stage with an immediately reachable advance command', () => {
    const stage: Stage = {
      id: 's',
      title: 't',
      briefing: [],
      objective: 'o',
      clusterInitial: {},
      commands: [{ match: /a/, description: 'a', outcome: { output: [], advances: true } }],
    };
    expect(findAdvancePath(stage)).toEqual(['a']);
  });
});
```

- [ ] **Step 7: Run the test and verify it fails**

Run: `npm run test -- src/engine/reachability.test.ts`
Expected: FAIL — cannot find module `./reachability`.

- [ ] **Step 8: Implement the reachability validator**

`src/engine/reachability.ts`:

```ts
import type { Stage } from '@/content/types';

export function findAdvancePath(stage: Stage): string[] | null {
  const seen = new Set<string>(['']);
  const queue: Array<{ facts: Set<string>; path: string[] }> = [{ facts: new Set(), path: [] }];

  while (queue.length > 0) {
    const current = queue.shift()!;

    for (const command of stage.commands) {
      const requires = command.requiresFacts ?? [];
      if (!requires.every((factId) => current.facts.has(factId))) continue;

      const path = [...current.path, command.description];
      if (command.outcome.advances) return path;

      const nextFacts = new Set(current.facts);
      (command.outcome.revealsFacts ?? []).forEach((factId) => nextFacts.add(factId));
      const key = [...nextFacts].sort().join(',');
      if (seen.has(key)) continue;
      seen.add(key);
      queue.push({ facts: nextFacts, path });
    }
  }

  return null;
}
```

- [ ] **Step 9: Run the test and verify it passes**

Run: `npm run test -- src/engine/reachability.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 10: Commit**

```bash
git add src/content/types.ts src/engine/terminalParser.ts src/engine/terminalParser.test.ts src/engine/reachability.ts src/engine/reachability.test.ts
git commit -m "feat: add content types, terminal parser, and reachability validator"
```

---

### Task 3: Progress Store

**Files:**
- Create: `src/engine/store.ts`
- Test: `src/engine/store.test.ts`

**Interfaces:**
- Consumes: `Campaign`, `TerminalEntry` (`src/content/types.ts`); `parseCommand` (`src/engine/terminalParser.ts`).
- Produces: `useSimStore` Zustand hook exposing `{ campaign, stageIndex, revealedFacts, collectedFacts, terminalHistory, clusterStatus, highlightedNodeIds, revealedEdgeIds, startCampaign(campaign), runCommand(input), resetProgress() }`.

- [ ] **Step 1: Write the failing store tests**

`src/engine/store.test.ts`:

```ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useSimStore } from './store';
import type { Campaign } from '@/content/types';

const testCampaign: Campaign = {
  id: 'infiltrator',
  title: 'Test Campaign',
  tagline: '',
  factLibrary: {},
  debrief: { narrative: [], lesson: '', nextChapterTeaser: '' },
  stages: [
    {
      id: 'stage-1',
      title: 'Stage 1',
      briefing: [],
      objective: 'o',
      clusterInitial: { status: 'nominal' },
      commands: [
        {
          match: /^look$/,
          description: 'look',
          outcome: { output: ['you see a pod'], revealsFacts: ['seen-pod'] },
        },
        {
          match: /^act$/,
          description: 'act',
          requiresFacts: ['seen-pod'],
          outcome: { output: ['advancing'], advances: true, clusterDelta: { status: 'suspicious' } },
        },
      ],
    },
    {
      id: 'stage-2',
      title: 'Stage 2',
      briefing: [],
      objective: 'o2',
      clusterInitial: { status: 'suspicious' },
      commands: [],
    },
  ],
};

beforeEach(() => {
  useSimStore.getState().resetProgress();
  localStorage.clear();
});

describe('useSimStore', () => {
  it('starts a campaign at stage 0 with initial cluster status', () => {
    useSimStore.getState().startCampaign(testCampaign);
    const state = useSimStore.getState();
    expect(state.stageIndex).toBe(0);
    expect(state.clusterStatus).toBe('nominal');
  });

  it('reveals facts without advancing when a gated command is not yet unlocked', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().runCommand('look');
    const state = useSimStore.getState();
    expect(state.revealedFacts).toEqual(['seen-pod']);
    expect(state.stageIndex).toBe(0);
  });

  it('advances to the next stage and resets per-stage facts when the advancing command runs', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().runCommand('look');
    useSimStore.getState().runCommand('act');
    const state = useSimStore.getState();
    expect(state.stageIndex).toBe(1);
    expect(state.revealedFacts).toEqual([]);
    expect(state.collectedFacts).toEqual(['seen-pod']);
    expect(state.clusterStatus).toBe('suspicious');
  });

  it('records unrecognized commands without changing stage or facts', () => {
    useSimStore.getState().startCampaign(testCampaign);
    useSimStore.getState().runCommand('nonsense');
    const state = useSimStore.getState();
    expect(state.stageIndex).toBe(0);
    expect(state.terminalHistory[0].output).toEqual(['Command not recognized in this context.']);
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test -- src/engine/store.test.ts`
Expected: FAIL — cannot find module `./store`.

- [ ] **Step 3: Implement the store**

`src/engine/store.ts`:

```ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { parseCommand } from './terminalParser';
import type { Campaign, TerminalEntry } from '@/content/types';

interface SimState {
  campaign: Campaign | null;
  stageIndex: number;
  revealedFacts: string[];
  collectedFacts: string[];
  terminalHistory: TerminalEntry[];
  clusterStatus: 'nominal' | 'suspicious' | 'compromised' | 'contained';
  highlightedNodeIds: string[];
  revealedEdgeIds: string[];
  startCampaign: (campaign: Campaign) => void;
  runCommand: (input: string) => void;
  resetProgress: () => void;
}

const initialTransientState = {
  stageIndex: 0,
  revealedFacts: [] as string[],
  collectedFacts: [] as string[],
  terminalHistory: [] as TerminalEntry[],
  clusterStatus: 'nominal' as const,
  highlightedNodeIds: [] as string[],
  revealedEdgeIds: [] as string[],
};

export const useSimStore = create<SimState>()(
  persist(
    (set, get) => ({
      campaign: null,
      ...initialTransientState,

      startCampaign: (campaign) => {
        const firstStage = campaign.stages[0];
        set({
          campaign,
          ...initialTransientState,
          clusterStatus: firstStage.clusterInitial.status ?? 'nominal',
          highlightedNodeIds: firstStage.clusterInitial.highlightNodeIds ?? [],
          revealedEdgeIds: firstStage.clusterInitial.revealEdgeIds ?? [],
        });
      },

      runCommand: (input) => {
        const { campaign, stageIndex, revealedFacts, collectedFacts, terminalHistory } = get();
        if (!campaign) return;
        const stage = campaign.stages[stageIndex];
        const outcome = parseCommand(input, stage, new Set(revealedFacts));

        if (!outcome) {
          set({
            terminalHistory: [
              ...terminalHistory,
              { input, output: ['Command not recognized in this context.'] },
            ],
          });
          return;
        }

        const nextRevealedFacts = [
          ...new Set([...revealedFacts, ...(outcome.revealsFacts ?? [])]),
        ];
        const nextCollectedFacts = [
          ...new Set([...collectedFacts, ...(outcome.revealsFacts ?? [])]),
        ];
        const nextHistory = [...terminalHistory, { input, output: outcome.output }];

        if (outcome.advances) {
          const nextStageIndex = stageIndex + 1;
          const nextStage = campaign.stages[nextStageIndex];
          set({
            terminalHistory: nextHistory,
            collectedFacts: nextCollectedFacts,
            stageIndex: nextStageIndex,
            revealedFacts: [],
            clusterStatus:
              nextStage?.clusterInitial.status ?? outcome.clusterDelta?.status ?? get().clusterStatus,
            highlightedNodeIds:
              nextStage?.clusterInitial.highlightNodeIds ??
              outcome.clusterDelta?.highlightNodeIds ??
              get().highlightedNodeIds,
            revealedEdgeIds:
              nextStage?.clusterInitial.revealEdgeIds ??
              outcome.clusterDelta?.revealEdgeIds ??
              get().revealedEdgeIds,
          });
          return;
        }

        set({
          terminalHistory: nextHistory,
          revealedFacts: nextRevealedFacts,
          collectedFacts: nextCollectedFacts,
          clusterStatus: outcome.clusterDelta?.status ?? get().clusterStatus,
          highlightedNodeIds: outcome.clusterDelta?.highlightNodeIds
            ? [...new Set([...get().highlightedNodeIds, ...outcome.clusterDelta.highlightNodeIds])]
            : get().highlightedNodeIds,
          revealedEdgeIds: outcome.clusterDelta?.revealEdgeIds
            ? [...new Set([...get().revealedEdgeIds, ...outcome.clusterDelta.revealEdgeIds])]
            : get().revealedEdgeIds,
        });
      },

      resetProgress: () => set({ campaign: null, ...initialTransientState }),
    }),
    { name: 'operation-mango-progress' }
  )
);
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm run test -- src/engine/store.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/engine/store.ts src/engine/store.test.ts
git commit -m "feat: add Zustand progress store with localStorage persistence"
```

---

### Task 4: Chapter 1 Content — Infiltrator Campaign

**Files:**
- Create: `src/content/chapter1/infiltrator.ts`
- Test: `src/content/chapter1/infiltrator.reachability.test.ts`

**Interfaces:**
- Consumes: `Campaign` type; `findAdvancePath` (`src/engine/reachability.ts`).
- Produces: `infiltratorCampaign: Campaign`.

- [ ] **Step 1: Write the failing content test**

`src/content/chapter1/infiltrator.reachability.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findAdvancePath } from '@/engine/reachability';
import { infiltratorCampaign } from './infiltrator';

describe('infiltratorCampaign', () => {
  it('has a reachable advance path in every stage', () => {
    for (const stage of infiltratorCampaign.stages) {
      const path = findAdvancePath(stage);
      expect(path, `stage "${stage.id}" has no reachable advance command`).not.toBeNull();
    }
  });

  it('has a factLibrary entry for every fact referenced by any command', () => {
    const referenced = new Set<string>();
    for (const stage of infiltratorCampaign.stages) {
      for (const command of stage.commands) {
        (command.outcome.revealsFacts ?? []).forEach((f) => referenced.add(f));
        (command.requiresFacts ?? []).forEach((f) => referenced.add(f));
      }
    }
    for (const factId of referenced) {
      expect(
        infiltratorCampaign.factLibrary[factId],
        `missing factLibrary entry for "${factId}"`
      ).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- src/content/chapter1/infiltrator.reachability.test.ts`
Expected: FAIL — cannot find module `./infiltrator`.

- [ ] **Step 3: Implement the Infiltrator campaign content**

`src/content/chapter1/infiltrator.ts`:

```ts
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
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test -- src/content/chapter1/infiltrator.reachability.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/content/chapter1/infiltrator.ts src/content/chapter1/infiltrator.reachability.test.ts
git commit -m "feat: add Chapter 1 Infiltrator campaign content"
```

---

### Task 5: Chapter 1 Content — Sentinel Campaign

**Files:**
- Create: `src/content/chapter1/sentinel.ts`
- Test: `src/content/chapter1/sentinel.reachability.test.ts`

**Interfaces:**
- Consumes: `Campaign` type; `findAdvancePath` (`src/engine/reachability.ts`).
- Produces: `sentinelCampaign: Campaign`.

- [ ] **Step 1: Write the failing content test**

`src/content/chapter1/sentinel.reachability.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { findAdvancePath } from '@/engine/reachability';
import { sentinelCampaign } from './sentinel';

describe('sentinelCampaign', () => {
  it('has a reachable advance path in every stage', () => {
    for (const stage of sentinelCampaign.stages) {
      const path = findAdvancePath(stage);
      expect(path, `stage "${stage.id}" has no reachable advance command`).not.toBeNull();
    }
  });

  it('has a factLibrary entry for every fact referenced by any command', () => {
    const referenced = new Set<string>();
    for (const stage of sentinelCampaign.stages) {
      for (const command of stage.commands) {
        (command.outcome.revealsFacts ?? []).forEach((f) => referenced.add(f));
        (command.requiresFacts ?? []).forEach((f) => referenced.add(f));
      }
    }
    for (const factId of referenced) {
      expect(
        sentinelCampaign.factLibrary[factId],
        `missing factLibrary entry for "${factId}"`
      ).toBeDefined();
    }
  });
});
```

- [ ] **Step 2: Run the test and verify it fails**

Run: `npm run test -- src/content/chapter1/sentinel.reachability.test.ts`
Expected: FAIL — cannot find module `./sentinel`.

- [ ] **Step 3: Implement the Sentinel campaign content**

`src/content/chapter1/sentinel.ts`:

```ts
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
```

- [ ] **Step 4: Run the test and verify it passes**

Run: `npm run test -- src/content/chapter1/sentinel.reachability.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/content/chapter1/sentinel.ts src/content/chapter1/sentinel.reachability.test.ts
git commit -m "feat: add Chapter 1 Sentinel campaign content"
```

---

### Task 6: Terminal UI Component

**Files:**
- Create: `src/components/Terminal/Terminal.tsx`
- Test: `src/components/Terminal/Terminal.test.tsx`

**Interfaces:**
- Consumes: `TerminalEntry` (`src/content/types.ts`).
- Produces: `Terminal({ history, availableCommands, onSubmit }: { history: TerminalEntry[]; availableCommands: Array<{ description: string }>; onSubmit: (input: string) => void })`.

- [ ] **Step 1: Write the failing component tests**

`src/components/Terminal/Terminal.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Terminal } from './Terminal';

describe('Terminal', () => {
  it('renders history entries', () => {
    render(
      <Terminal
        history={[{ input: 'kubectl get pods', output: ['pod-a', 'pod-b'] }]}
        availableCommands={[]}
        onSubmit={() => {}}
      />
    );
    expect(screen.getByText('$ kubectl get pods')).toBeInTheDocument();
    expect(screen.getByText('pod-a')).toBeInTheDocument();
  });

  it('renders hint descriptions for available commands', () => {
    render(
      <Terminal
        history={[]}
        availableCommands={[{ description: 'kubectl get pods' }, { description: 'whoami' }]}
        onSubmit={() => {}}
      />
    );
    expect(screen.getByTestId('terminal-hints').textContent).toContain('kubectl get pods');
    expect(screen.getByTestId('terminal-hints').textContent).toContain('whoami');
  });

  it('calls onSubmit with trimmed input and clears the field', () => {
    const onSubmit = vi.fn();
    render(<Terminal history={[]} availableCommands={[]} onSubmit={onSubmit} />);
    const input = screen.getByLabelText('terminal input') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '  kubectl get pods  ' } });
    fireEvent.submit(input.closest('form')!);
    expect(onSubmit).toHaveBeenCalledWith('kubectl get pods');
    expect(input.value).toBe('');
  });

  it('does not call onSubmit for empty input', () => {
    const onSubmit = vi.fn();
    render(<Terminal history={[]} availableCommands={[]} onSubmit={onSubmit} />);
    const input = screen.getByLabelText('terminal input');
    fireEvent.submit(input.closest('form')!);
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test -- src/components/Terminal/Terminal.test.tsx`
Expected: FAIL — cannot find module `./Terminal`.

- [ ] **Step 3: Implement the Terminal component**

`src/components/Terminal/Terminal.tsx`:

```tsx
'use client';

import { useState, type FormEvent } from 'react';
import type { TerminalEntry } from '@/content/types';

interface TerminalProps {
  history: TerminalEntry[];
  availableCommands: Array<{ description: string }>;
  onSubmit: (input: string) => void;
}

export function Terminal({ history, availableCommands, onSubmit }: TerminalProps) {
  const [value, setValue] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = value.trim();
    if (!trimmed) return;
    onSubmit(trimmed);
    setValue('');
  }

  return (
    <div className="flex flex-col gap-4 rounded-lg bg-black/60 p-4 font-mono text-sm">
      <div className="flex flex-col gap-2" data-testid="terminal-history">
        {history.map((entry, index) => (
          <div key={index}>
            <div className="text-mango-500">$ {entry.input}</div>
            {entry.output.map((line, lineIndex) => (
              <div key={lineIndex} className="text-mango-300">
                {line}
              </div>
            ))}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <span className="text-mango-500">$</span>
        <input
          className="flex-1 bg-transparent outline-none"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          aria-label="terminal input"
          autoComplete="off"
        />
      </form>

      {availableCommands.length > 0 && (
        <div data-testid="terminal-hints" className="text-xs text-mango-500/70">
          Available: {availableCommands.map((command) => command.description).join(' · ')}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm run test -- src/components/Terminal/Terminal.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/Terminal/Terminal.tsx src/components/Terminal/Terminal.test.tsx
git commit -m "feat: add Terminal component with autocomplete hints"
```

---

### Task 7: Cluster Diagram Component

**Files:**
- Create: `src/components/ClusterDiagram/ClusterDiagram.tsx`
- Test: `src/components/ClusterDiagram/ClusterDiagram.test.tsx`

**Interfaces:**
- Produces: `ClusterDiagram({ highlightedNodeIds, revealedEdgeIds, status }: { highlightedNodeIds: string[]; revealedEdgeIds: string[]; status: 'nominal' | 'suspicious' | 'compromised' | 'contained' })`. Fixed node set: `ci-deploy-bot`, `inventory-sync`, `pricing-api`, `cluster-admin-binding`, `log-rotator`. Fixed edge ids: `ci-deploy-bot-to-clusteradmin`, `log-rotator-to-clusteradmin` (must match the ids used in Chapter 1 content's `clusterDelta.revealEdgeIds`).

- [ ] **Step 1: Write the failing component tests**

`src/components/ClusterDiagram/ClusterDiagram.test.tsx`:

```tsx
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ClusterDiagram } from './ClusterDiagram';

describe('ClusterDiagram', () => {
  it('marks highlighted nodes', () => {
    render(<ClusterDiagram highlightedNodeIds={['ci-deploy-bot']} revealedEdgeIds={[]} status="suspicious" />);
    expect(screen.getByTestId('node-ci-deploy-bot').getAttribute('data-highlighted')).toBe('true');
    expect(screen.getByTestId('node-log-rotator').getAttribute('data-highlighted')).toBe('false');
  });

  it('renders only revealed edges', () => {
    render(
      <ClusterDiagram
        highlightedNodeIds={[]}
        revealedEdgeIds={['ci-deploy-bot-to-clusteradmin']}
        status="suspicious"
      />
    );
    expect(screen.getByTestId('edge-ci-deploy-bot-to-clusteradmin')).toBeInTheDocument();
    expect(screen.queryByTestId('edge-log-rotator-to-clusteradmin')).not.toBeInTheDocument();
  });

  it('reflects cluster status on the border', () => {
    render(<ClusterDiagram highlightedNodeIds={[]} revealedEdgeIds={[]} status="compromised" />);
    expect(screen.getByTestId('cluster-status-border').getAttribute('data-status')).toBe('compromised');
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test -- src/components/ClusterDiagram/ClusterDiagram.test.tsx`
Expected: FAIL — cannot find module `./ClusterDiagram`.

- [ ] **Step 3: Implement the ClusterDiagram component**

`src/components/ClusterDiagram/ClusterDiagram.tsx`:

```tsx
'use client';

import { motion } from 'framer-motion';

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
          <motion.line
            key={edgeId}
            data-testid={`edge-${edgeId}`}
            x1={from.x}
            y1={from.y}
            x2={to.x}
            y2={to.y}
            stroke={STATUS_COLORS[status]}
            strokeWidth={1.5}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          />
        );
      })}

      {NODES.map((node) => {
        const isHighlighted = highlightedNodeIds.includes(node.id);
        return (
          <g key={node.id} data-testid={`node-${node.id}`} data-highlighted={isHighlighted}>
            <motion.circle
              cx={node.x}
              cy={node.y}
              r={16}
              fill={isHighlighted ? STATUS_COLORS[status] : '#2b1d09'}
              stroke="#ffd27a"
              strokeWidth={1}
              animate={{ scale: isHighlighted ? 1.15 : 1 }}
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
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm run test -- src/components/ClusterDiagram/ClusterDiagram.test.tsx`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/components/ClusterDiagram/ClusterDiagram.tsx src/components/ClusterDiagram/ClusterDiagram.test.tsx
git commit -m "feat: add animated ClusterDiagram component"
```

---

### Task 8: Briefing Overlay & Debrief Panel Components

**Files:**
- Create: `src/components/BriefingOverlay/BriefingOverlay.tsx`
- Test: `src/components/BriefingOverlay/BriefingOverlay.test.tsx`
- Create: `src/components/DebriefPanel/DebriefPanel.tsx`
- Test: `src/components/DebriefPanel/DebriefPanel.test.tsx`

**Interfaces:**
- Produces: `BriefingOverlay({ title, objective, lines, onDismiss }: { title: string; objective: string; lines: string[]; onDismiss: () => void })`.
- Produces: `DebriefPanel({ narrative, lesson, nextChapterTeaser, onRestart }: { narrative: string[]; lesson: string; nextChapterTeaser: string; onRestart: () => void })`.

- [ ] **Step 1: Write the failing BriefingOverlay tests**

`src/components/BriefingOverlay/BriefingOverlay.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BriefingOverlay } from './BriefingOverlay';

describe('BriefingOverlay', () => {
  it('renders title, lines and objective', () => {
    render(
      <BriefingOverlay title="Recon" objective="Find the pod" lines={['line one', 'line two']} onDismiss={() => {}} />
    );
    expect(screen.getByText('Recon')).toBeInTheDocument();
    expect(screen.getByText('line one')).toBeInTheDocument();
    expect(screen.getByText('Objective: Find the pod')).toBeInTheDocument();
  });

  it('calls onDismiss when Begin is clicked', () => {
    const onDismiss = vi.fn();
    render(<BriefingOverlay title="Recon" objective="o" lines={[]} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByText('Begin'));
    expect(onDismiss).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run: `npm run test -- src/components/BriefingOverlay/BriefingOverlay.test.tsx`
Expected: FAIL — cannot find module `./BriefingOverlay`.

- [ ] **Step 3: Implement BriefingOverlay**

`src/components/BriefingOverlay/BriefingOverlay.tsx`:

```tsx
'use client';

import { motion, AnimatePresence } from 'framer-motion';

interface BriefingOverlayProps {
  title: string;
  objective: string;
  lines: string[];
  onDismiss: () => void;
}

export function BriefingOverlay({ title, objective, lines, onDismiss }: BriefingOverlayProps) {
  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 flex items-center justify-center bg-black/80"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="max-w-lg space-y-4 rounded-lg bg-mango-900 p-6">
          <h2 className="text-xl font-bold text-mango-500">{title}</h2>
          <div className="space-y-2 text-mango-300">
            {lines.map((line, index) => (
              <p key={index}>{line}</p>
            ))}
          </div>
          <p className="text-sm italic text-mango-500/80">Objective: {objective}</p>
          <button onClick={onDismiss} className="rounded bg-mango-500 px-4 py-2 font-semibold text-mango-950">
            Begin
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run: `npm run test -- src/components/BriefingOverlay/BriefingOverlay.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing DebriefPanel tests**

`src/components/DebriefPanel/DebriefPanel.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DebriefPanel } from './DebriefPanel';

describe('DebriefPanel', () => {
  it('renders narrative, lesson and teaser', () => {
    render(
      <DebriefPanel
        narrative={['The breach succeeded.']}
        lesson="Scope RBAC tightly."
        nextChapterTeaser="Next: breakout."
        onRestart={() => {}}
      />
    );
    expect(screen.getByText('The breach succeeded.')).toBeInTheDocument();
    expect(screen.getByText('Scope RBAC tightly.')).toBeInTheDocument();
    expect(screen.getByText('Next: breakout.')).toBeInTheDocument();
  });

  it('calls onRestart when the button is clicked', () => {
    const onRestart = vi.fn();
    render(<DebriefPanel narrative={[]} lesson="l" nextChapterTeaser="t" onRestart={onRestart} />);
    fireEvent.click(screen.getByText('Return to Briefing'));
    expect(onRestart).toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run the tests and verify they fail**

Run: `npm run test -- src/components/DebriefPanel/DebriefPanel.test.tsx`
Expected: FAIL — cannot find module `./DebriefPanel`.

- [ ] **Step 7: Implement DebriefPanel**

`src/components/DebriefPanel/DebriefPanel.tsx`:

```tsx
'use client';

interface DebriefPanelProps {
  narrative: string[];
  lesson: string;
  nextChapterTeaser: string;
  onRestart: () => void;
}

export function DebriefPanel({ narrative, lesson, nextChapterTeaser, onRestart }: DebriefPanelProps) {
  return (
    <div className="mx-auto max-w-2xl space-y-6 p-8">
      <section data-testid="debrief-narrative" className="space-y-2">
        {narrative.map((line, index) => (
          <p key={index}>{line}</p>
        ))}
      </section>

      <section className="rounded-lg border border-mango-500/40 p-4">
        <h3 className="mb-2 font-bold text-mango-500">Real-World Lesson</h3>
        <p>{lesson}</p>
      </section>

      <section className="text-sm italic text-mango-500/70">{nextChapterTeaser}</section>

      <button onClick={onRestart} className="rounded bg-mango-500 px-4 py-2 font-semibold text-mango-950">
        Return to Briefing
      </button>
    </div>
  );
}
```

- [ ] **Step 8: Run the tests and verify they pass**

Run: `npm run test -- src/components/DebriefPanel/DebriefPanel.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 9: Commit**

```bash
git add src/components/BriefingOverlay/BriefingOverlay.tsx src/components/BriefingOverlay/BriefingOverlay.test.tsx src/components/DebriefPanel/DebriefPanel.tsx src/components/DebriefPanel/DebriefPanel.test.tsx
git commit -m "feat: add BriefingOverlay and DebriefPanel components"
```

---

### Task 9: Screens & Routing

**Files:**
- Create: `src/content/chapter1/index.ts`
- Modify: `src/app/page.tsx` (replace scaffold placeholder)
- Create: `src/app/campaign-select/page.tsx`
- Create: `src/app/mission/page.tsx`
- Create: `src/app/debrief/page.tsx`
- Test: `src/app/mission/page.test.tsx`

**Interfaces:**
- Consumes: `useSimStore` (`src/engine/store.ts`); `infiltratorCampaign`, `sentinelCampaign` (`src/content/chapter1/*.ts`); `Terminal`, `ClusterDiagram`, `BriefingOverlay`, `DebriefPanel`.
- Produces: `chapter1Campaigns: Record<CampaignId, Campaign>`.

- [ ] **Step 1: Create the campaign registry**

`src/content/chapter1/index.ts`:

```ts
import type { Campaign, CampaignId } from '../types';
import { infiltratorCampaign } from './infiltrator';
import { sentinelCampaign } from './sentinel';

export const chapter1Campaigns: Record<CampaignId, Campaign> = {
  infiltrator: infiltratorCampaign,
  sentinel: sentinelCampaign,
};
```

- [ ] **Step 2: Write the failing MissionPage integration test**

`src/app/mission/page.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useSimStore } from '@/engine/store';
import { chapter1Campaigns } from '@/content/chapter1';
import MissionPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

beforeEach(() => {
  useSimStore.getState().resetProgress();
  localStorage.clear();
});

describe('MissionPage', () => {
  it('shows the stage briefing first, then the terminal after dismissal', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.infiltrator);
    render(<MissionPage />);

    expect(screen.getByText('Recon')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Begin'));

    expect(screen.getByLabelText('terminal input')).toBeInTheDocument();
  });

  it('advances the stage in the store when the player runs the full recon command sequence', () => {
    useSimStore.getState().startCampaign(chapter1Campaigns.infiltrator);
    render(<MissionPage />);
    fireEvent.click(screen.getByText('Begin'));

    const input = screen.getByLabelText('terminal input');
    fireEvent.change(input, { target: { value: 'kubectl get pods' } });
    fireEvent.submit(input.closest('form')!);
    fireEvent.change(input, { target: { value: 'kubectl auth can-i --list' } });
    fireEvent.submit(input.closest('form')!);
    fireEvent.change(input, {
      target: { value: 'cat /var/run/secrets/kubernetes.io/serviceaccount/token' },
    });
    fireEvent.submit(input.closest('form')!);

    expect(useSimStore.getState().stageIndex).toBe(1);
  });
});
```

- [ ] **Step 3: Run the test and verify it fails**

Run: `npm run test -- src/app/mission/page.test.tsx`
Expected: FAIL — cannot find module `./page`.

- [ ] **Step 4: Implement the Landing page**

`src/app/page.tsx`:

```tsx
'use client';

import Link from 'next/link';

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-bold text-mango-500">Operation Mango</h1>
      <p className="max-w-xl text-mango-300">
        MangoCorp&apos;s global logistics run on Kubernetes. A supply-chain compromise planted an
        implant inside its cluster, and Citrus Dynamics bought the foothold. What happens next is
        up to you.
      </p>
      <Link href="/campaign-select" className="rounded bg-mango-500 px-6 py-3 font-semibold text-mango-950">
        Begin Investigation
      </Link>
    </main>
  );
}
```

- [ ] **Step 5: Implement the Campaign Select page**

`src/app/campaign-select/page.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useSimStore } from '@/engine/store';
import { chapter1Campaigns } from '@/content/chapter1';
import type { CampaignId } from '@/content/types';

export default function CampaignSelectPage() {
  const router = useRouter();
  const startCampaign = useSimStore((state) => state.startCampaign);

  function choose(id: CampaignId) {
    startCampaign(chapter1Campaigns[id]);
    router.push('/mission');
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <h1 className="text-2xl font-bold text-mango-500">Choose Your Side</h1>
      <div className="flex flex-col gap-6 md:flex-row">
        {(Object.keys(chapter1Campaigns) as CampaignId[]).map((id) => {
          const campaign = chapter1Campaigns[id];
          return (
            <button
              key={id}
              onClick={() => choose(id)}
              className="max-w-sm rounded-lg border border-mango-500/40 p-6 text-left hover:bg-mango-900"
            >
              <h2 className="text-xl font-bold text-mango-500">{campaign.title}</h2>
              <p className="mt-2 text-mango-300">{campaign.tagline}</p>
            </button>
          );
        })}
      </div>
    </main>
  );
}
```

- [ ] **Step 6: Implement the Mission workspace page**

`src/app/mission/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSimStore } from '@/engine/store';
import { Terminal } from '@/components/Terminal/Terminal';
import { ClusterDiagram } from '@/components/ClusterDiagram/ClusterDiagram';
import { BriefingOverlay } from '@/components/BriefingOverlay/BriefingOverlay';

export default function MissionPage() {
  const router = useRouter();
  const campaign = useSimStore((state) => state.campaign);
  const stageIndex = useSimStore((state) => state.stageIndex);
  const revealedFacts = useSimStore((state) => state.revealedFacts);
  const terminalHistory = useSimStore((state) => state.terminalHistory);
  const clusterStatus = useSimStore((state) => state.clusterStatus);
  const highlightedNodeIds = useSimStore((state) => state.highlightedNodeIds);
  const revealedEdgeIds = useSimStore((state) => state.revealedEdgeIds);
  const runCommand = useSimStore((state) => state.runCommand);

  const [showBriefing, setShowBriefing] = useState(true);

  useEffect(() => {
    if (!campaign) {
      router.replace('/campaign-select');
    }
  }, [campaign, router]);

  useEffect(() => {
    setShowBriefing(true);
  }, [stageIndex]);

  useEffect(() => {
    if (campaign && stageIndex >= campaign.stages.length) {
      router.push('/debrief');
    }
  }, [campaign, stageIndex, router]);

  if (!campaign || stageIndex >= campaign.stages.length) {
    return null;
  }

  const stage = campaign.stages[stageIndex];
  const revealedSet = new Set(revealedFacts);
  const availableCommands = stage.commands.filter((command) =>
    (command.requiresFacts ?? []).every((factId) => revealedSet.has(factId))
  );

  return (
    <main className="grid min-h-screen grid-cols-1 gap-6 p-6 md:grid-cols-2">
      {showBriefing && (
        <BriefingOverlay
          title={stage.title}
          objective={stage.objective}
          lines={stage.briefing}
          onDismiss={() => setShowBriefing(false)}
        />
      )}

      <section>
        <h2 className="mb-2 text-lg font-bold text-mango-500">{stage.title}</h2>
        <p className="mb-4 text-sm text-mango-300">{stage.objective}</p>
        <Terminal history={terminalHistory} availableCommands={availableCommands} onSubmit={runCommand} />
      </section>

      <section>
        <ClusterDiagram
          highlightedNodeIds={highlightedNodeIds}
          revealedEdgeIds={revealedEdgeIds}
          status={clusterStatus}
        />
      </section>
    </main>
  );
}
```

- [ ] **Step 7: Implement the Debrief page**

`src/app/debrief/page.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useSimStore } from '@/engine/store';
import { DebriefPanel } from '@/components/DebriefPanel/DebriefPanel';

export default function DebriefPage() {
  const router = useRouter();
  const campaign = useSimStore((state) => state.campaign);
  const resetProgress = useSimStore((state) => state.resetProgress);

  if (!campaign) {
    if (typeof window !== 'undefined') {
      router.replace('/campaign-select');
    }
    return null;
  }

  function handleRestart() {
    resetProgress();
    router.push('/campaign-select');
  }

  return (
    <DebriefPanel
      narrative={campaign.debrief.narrative}
      lesson={campaign.debrief.lesson}
      nextChapterTeaser={campaign.debrief.nextChapterTeaser}
      onRestart={handleRestart}
    />
  );
}
```

- [ ] **Step 8: Run the test and verify it passes**

Run: `npm run test -- src/app/mission/page.test.tsx`
Expected: PASS (2 tests).

- [ ] **Step 9: Run the full test suite**

Run: `npm run test`
Expected: PASS — every test file from Tasks 1–9 passes.

- [ ] **Step 10: Commit**

```bash
git add src/content/chapter1/index.ts src/app/page.tsx src/app/campaign-select/page.tsx src/app/mission/page.tsx src/app/debrief/page.tsx src/app/mission/page.test.tsx
git commit -m "feat: wire Landing, Campaign Select, Mission, and Debrief screens"
```

---

### Task 10: Build Verification, Content Validation & Manual Playtest

**Files:**
- Create: `README.md`

No new test file — this task verifies the whole build and exercises it manually, since the spec calls out broken narrative state (soft-locks) as the primary risk, which automated tests can't fully catch across the real UI.

- [ ] **Step 1: Run the full automated test suite**

Run: `npm run test`
Expected: PASS — all test files (engine, content, components, pages) pass.

- [ ] **Step 2: Run the content-only validation script**

Run: `npm run validate:content`
Expected: PASS — both `infiltrator.reachability.test.ts` and `sentinel.reachability.test.ts` pass, confirming every stage in both campaigns has a reachable advance path and a complete fact library.

- [ ] **Step 3: Run a production build**

Run: `npm run build`
Expected: build succeeds and produces a static export in `out/` with no type errors.

- [ ] **Step 4: Create the README**

`README.md`:

```markdown
# Operation Mango

A cinematic, fully-simulated Kubernetes attack/defense learning site. MangoCorp,
a fictional agri-tech company, is mid-breach: play the Infiltrator (the
cybercrime crew Citrus Dynamics hired) or the Sentinel (MangoCorp security)
through Chapter 1, "Privileged Access" — an RBAC-misconfiguration /
privilege-escalation storyline told from both sides.

Everything is simulated client-side: there is no real Kubernetes cluster and
no backend. See `docs/superpowers/specs/2026-07-23-mango-k8s-sim-design.md`
for the full design.

## Development

\`\`\`bash
npm install
npm run dev
\`\`\`

## Testing

\`\`\`bash
npm run test              # full suite
npm run validate:content   # content-only reachability/fact-library checks
npm run build              # static production build
\`\`\`
```

- [ ] **Step 5: Manual playtest — Infiltrator campaign**

Run: `npm run dev`, open the app in a browser.

Checklist:
- Landing page renders; "Begin Investigation" navigates to Campaign Select.
- Choosing "The Infiltrator" navigates to Mission and shows the Recon briefing.
- Dismissing the briefing reveals the terminal and cluster diagram.
- Typing `kubectl get pods`, then `kubectl auth can-i --list`, then
  `cat /var/run/secrets/kubernetes.io/serviceaccount/token` advances to
  Discovery, and the cluster diagram highlights `ci-deploy-bot` with a
  suspicious (amber) border.
- Repeat the equivalent command sequences for Discovery, Exploit, Escalation,
  and Impact (see `src/content/chapter1/infiltrator.ts` for the exact
  commands per stage) — confirm each stage's briefing, hints, and diagram
  update correctly, and that the cluster border turns red at Exploit.
- After Impact's final command, the app navigates to Debrief showing the
  Infiltrator narrative and lesson text.
- "Return to Briefing" clears progress and returns to Campaign Select.

- [ ] **Step 6: Manual playtest — Sentinel campaign**

Checklist:
- Choosing "The Sentinel" from Campaign Select starts at Recon with the
  ticket-alert briefing (distinct from the Infiltrator's handler dialogue).
- Run each stage's command sequence from `src/content/chapter1/sentinel.ts`
  through Recon → Discovery → Detect → Containment → Impact.
- Confirm the cluster diagram shows `contained` (green) status after
  Containment, and that Impact's debrief reveals the IP was already read
  before detection (the intended "detection lag" lesson).

- [ ] **Step 7: Manual playtest — persistence**

Checklist:
- Mid-mission (e.g. partway through Discovery), refresh the browser tab.
- Confirm the app resumes at the same stage with the same terminal history,
  instead of resetting to Landing.

- [ ] **Step 8: Commit**

```bash
git add README.md
git commit -m "docs: add README with dev/test instructions"
```

---

## Self-Review Notes

- **Spec coverage:** narrative/branching campaigns (Tasks 4–5, 9), architecture/stack (Task 1), screen flow (Task 9), content model (Task 2), reachability testing (Tasks 2, 4, 5, 10), manual playtest (Task 10) — all sections of the design spec map to at least one task.
- **Type consistency:** `TerminalEntry`, `Campaign`, `Stage`, `CommandDefinition`, `CommandOutcome`, `ClusterDelta` are defined once in `src/content/types.ts` (Task 2) and reused verbatim (same names, same shapes) by the store (Task 3), both content files (Tasks 4–5), and every component/page (Tasks 6–9). Node/edge ids used in `clusterDelta` (`ci-deploy-bot`, `cluster-admin-binding`, `log-rotator`, `ci-deploy-bot-to-clusteradmin`, `log-rotator-to-clusteradmin`) match exactly between the content files (Tasks 4–5) and `ClusterDiagram`'s fixed node/edge tables (Task 7).
- **No placeholders:** every task has complete, runnable code and exact commands; no `TBD`/`TODO` remain.
