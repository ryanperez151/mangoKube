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

```bash
npm install
npm run dev
```

## Testing

```bash
npm run test              # full suite
npm run validate:content   # content-only reachability/fact-library checks
npm run build              # static production build
```
