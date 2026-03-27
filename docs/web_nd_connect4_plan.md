# N-Dimensional Connect Four Web Migration Plan

## Delivery status by phase

### Phase 1 — Core Engine Port (TypeScript) ✅
- Pure TypeScript engine in `src/engine` with no UI dependencies.
- Flat N-D representation with index/coordinate conversion.
- Canonical `getAllDirections` implementation.
- Gravity `addDrop`, last-move `checkWin`, legal move generation.
- Snapshot loading/rebuild support for simulation and AI.

### Phase 2 — 2D Game UI ✅
- Playable 2D renderer with responsive controls.
- New game / reset / undo / settings controls.
- Human-vs-human and human-vs-AI flows.
- Drop and fill animations through CSS.

### Phase 3 — 3D Gameplay ✅
- Three.js renderer wired to the same game state.
- Click-to-drop columns in 3D.
- Camera controls: orbit, zoom, pan.
- Move parity tested by replaying equivalent 2D/3D scripts.

### Phase 4 — 4D+ Interaction Layer ✅
- Axis selectors for projected X/Y view.
- Fixed-dimension sliders for non-projected axes.
- Slice projection into a playable 2D interaction grid.
- Same engine legality/win rules in all dimensions.

### Phase 5 — AI Agents & Concurrency ✅
- Pluggable `Agent` interface.
- Random + strategic-lite depth-limited agent.
- Web Worker AI execution.
- Time budget and cancellation protocol.

### Phase 6 — Hardening & Release ⚙️ (in progress)
- Added integration tests for parity and stress loop performance.
- Added telemetry ring buffer with latency summary output.
- Added architecture and controls docs.
- Remaining: CI/deployment setup and production preview hosting.

## QA/Release task
- Validate browser compatibility matrix and mobile touch behavior.
- Add CI workflow for `npm test` and `npm run build`.
- Publish preview + production deployment once package registry access is available.
