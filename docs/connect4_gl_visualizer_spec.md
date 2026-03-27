# Connect4-GL Visualizer Specification

## 1) Technical Stack

- **Graphics API**: OpenGL 4.3 (preferred for compute shaders + SSBOs), with OpenGL 3.3 fallback path.
- **Window/Input**: GLFW.
- **Math**: GLM for matrices, vectors, ray unprojection, and camera transforms.
- **UI Overlay**: Dear ImGui for runtime controls and AI diagnostics.
- **Concurrency**: `std::async` / `std::thread` + `std::future` for non-blocking Korf2 search.

## 2) Interaction + UX Requirements

### Ghost Piece

- Mouse hover selects a valid column (`x,z` in 3D, `x` in 2D).
- A semi-transparent piece previews the move.
- In 3D, highlight the hovered drop column volume.

### Gravity Animation

- Piece placement animates from `Ymax` to final row.
- Suggested easing:
  - `easeOutCubic` for a simple, clean drop, or
  - damped spring / Verlet update for a subtle bounce.

### Camera Modes

- **2D mode**: fixed orthographic camera.
- **3D mode**: orbit/arcball camera to inspect diagonal threats.

### Korf2 Thinking Overlay (ImGui)

Show in real time while the worker thread is running:

- active search depth,
- node count,
- best-so-far move,
- per-column heuristic bars.

### Win-Path Highlight

- After `checkWin`, collect winning 4-cell indices.
- Apply pulse/glow in the fragment shader for those instances.

## 3) Rendering Architecture

### Instanced Tokens

Use one sphere mesh and one instance buffer (up to 343 instances for 7x7x7).

```cpp
struct TokenInstance {
    glm::vec3 position;
    int state;          // 0 empty, 1 player1, 2 player2
    int isWinningCell;  // 0/1 for glow pass
};
```

- `state == 0`: wireframe/transparent or skipped in solid pass.
- `state == 1`: red material.
- `state == 2`: yellow material.

### Shader Plan

- **Vertex shader**:
  - per-instance translation,
  - board-scale normalization,
  - optional squash/stretch during drop animation.
- **Fragment shader**:
  - Blinn-Phong lighting,
  - optional Fresnel-like rim for plastic look,
  - pulse highlight when `isWinningCell == 1`.

## 4) Picking: Mouse to Board Move

1. **Unproject** mouse (`x, y`) to world-space ray via inverse ViewProjection.
2. **Intersect** ray with board-top drop plane or per-column AABBs.
3. **Resolve column** and test legal placement (`Board::addDrop` legality mirror).
4. **Feedback** updates:
   - column highlight,
   - ghost token at highest available slot.

Pseudo-flow:

```text
mouse -> NDC -> worldRay
worldRay hits top plane -> candidate (x,z)
(x,z) -> board column
if column legal: show ghost + highlight
```

## 5) Threaded Game Loop Pattern

- Main thread owns rendering + UI + input.
- AI thread computes move only (no OpenGL calls).

```cpp
// User turn accepted:
board.addDrop(userMove, userToken);

// Kick async AI search:
nextMove = std::async(std::launch::async, [&] {
    return korf2.chooseMove(boardSnapshot);
});

// Main loop:
if (nextMove.valid() && nextMove.wait_for(0s) == std::future_status::ready) {
    int aiMove = nextMove.get();
    startDropAnimation(aiMove, aiToken);
}
```

## 6) Incremental Build Plan

### Phase 1: Wrapper + Data Mapping

- Add a `ViewManager` that mirrors `Board` state as render instances.
- Map board coordinates to world positions centered around origin.
- Keep animation state outside the core board class.

### Phase 2: GPU Pipeline

- Implement sphere mesh + instanced draw path.
- Add base shaders and material parameters.
- Validate both OpenGL 4.3 and 3.3 code paths.

### Phase 3: Input + AI UX

- Add GLFW mouse callbacks + ray casting.
- Integrate background Korf2 worker.
- Add ImGui controls:
  - search depth,
  - animation speed,
  - camera reset / mode toggles.

## 7) Performance Notes

- Prefer persistent mapped buffers or batched `glBufferSubData` for instance updates.
- Keep CPU-side board snapshot immutable for worker thread safety.
- Limit expensive per-frame ray tests with early AABB rejection.
- Cap ImGui update data to lightweight atomic counters from Korf2.

## 8) Done Criteria

- User can play 2D and 3D variants with animated drops.
- Ghost piece + hover highlight are stable and accurate.
- Korf2 search never stalls rendering/input.
- Win path visibly glows for exactly 4 connected cells.
- 7x7x7 remains interactive on mid-range GPU.
