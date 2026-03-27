# Web App Architecture (TypeScript)

## Overview

The web stack is split into independent layers so the same rules engine powers 2D, 3D, and 4D+ views:

- `src/engine/*`: deterministic gameplay rules and state transitions.
- `src/agents/*`: AI policy interface and implementations.
- `src/workers/ai.worker.ts`: off-main-thread move computation + cancellation.
- `src/main.ts`: UI composition and mode renderers.

## Engine package details

- `math.ts`
  - `coordsToIndex`, `indexToCoords`
  - canonical direction generation with symmetry breaking
- `board.ts`
  - flat board storage
  - gravity `addDrop`
  - legal move availability map
  - last-move `checkWin`
- `game.ts`
  - turn management
  - undo/replay
  - state snapshot and restore
- `projection.ts`
  - axis mapping for high-dimensional slicing

## AI + worker contract

Main thread sends:

```ts
{ kind: 'choose', id, agent, snapshot, maxTimeMs }
```

Cancel request:

```ts
{ kind: 'cancel', id }
```

Worker response:

```ts
{ id, move, elapsed, timeout }
```

`AbortController` is used inside the worker to stop long-running searches and avoid rendering stalls.

## Extension guide

1. Add a new agent under `src/agents` implementing `Agent`.
2. Register it in `src/workers/ai.worker.ts`.
3. Add a UI option in `src/main.ts` to expose the new agent.
4. Add deterministic test vectors in `tests/engine.test.ts`.

## Controls

- 2D mode: click column arrows.
- 3D mode: click board plane to drop into `(x,z)` column.
  - Drag: orbit
  - Shift+drag or right-drag: pan
  - Wheel: zoom
- 4D+ mode:
  - Select X/Y display axes
  - Set fixed values for remaining axes
  - Click projected cell to place a move in that slice

## Telemetry

A ring buffer tracks move and AI latency and displays rolling summaries in the UI.
