# Web GUI Setup Guide

This project can be wrapped in a browser UI by combining the existing header-only game logic with Dear ImGui, SDL2, OpenGL ES 3, and Emscripten.

## 1. Clone Dear ImGui into the project

From the repository root:

```bash
git clone https://github.com/ocornut/imgui.git third_party/imgui
```

That layout matches the include paths used by `web_app.cpp` and `build_web.sh`.

## 2. Directory layout

After cloning ImGui, the relevant files should look like this:

```text
Connect4Solver/
├── include/
├── src/agents/
├── third_party/imgui/
│   ├── imgui.h
│   ├── imgui.cpp
│   ├── imgui_draw.cpp
│   ├── imgui_tables.cpp
│   ├── imgui_widgets.cpp
│   └── backends/
│       ├── imgui_impl_sdl2.cpp
│       ├── imgui_impl_sdl2.h
│       ├── imgui_impl_opengl3.cpp
│       └── imgui_impl_opengl3.h
├── web_app.cpp
├── build_web.sh
└── Makefile
```

The key backend files are:

- `third_party/imgui/backends/imgui_impl_sdl2.cpp`
- `third_party/imgui/backends/imgui_impl_opengl3.cpp`

## 3. Build with Emscripten

After activating your Emscripten SDK environment (`source /path/to/emsdk/emsdk_env.sh`), run:

```bash
./build_web.sh
```

Equivalent direct `emcc` command:

```bash
emcc -std=c++17 -O3 \
  -Iinclude -Isrc/agents -Ithird_party/imgui -Ithird_party/imgui/backends \
  web_app.cpp \
  third_party/imgui/imgui.cpp \
  third_party/imgui/imgui_draw.cpp \
  third_party/imgui/imgui_tables.cpp \
  third_party/imgui/imgui_widgets.cpp \
  third_party/imgui/backends/imgui_impl_sdl2.cpp \
  third_party/imgui/backends/imgui_impl_opengl3.cpp \
  -s USE_SDL=2 -s WASM=1 -s FULL_ES3=1 -s USE_WEBGL2=1 -s ALLOW_MEMORY_GROWTH=1 \
  --shell-file third_party/imgui/examples/example_emscripten_opengl3/shell_minimal.html \
  -o dist/connect4_web.html
```

## 4. Serve locally

From the repository root:

```bash
python3 -m http.server 8000 --directory dist
```

Then open:

- <http://localhost:8000/connect4_web.html>

## 5. UI behavior in `web_app.cpp`

The entry point provides:

- A persistent `GameState` that owns the `Board` and selected AI type.
- An Emscripten browser loop via `emscripten_set_main_loop`.
- A settings panel for board size, dimensionality, and AI selection.
- A 2D board view plus a generalized slice viewer for 3D+ boards.
- `Reset Game` and `Think` controls.
- Human column clicks that call `Board::addDrop`, then trigger an AI move on the next frame.

## 6. Non-blocking AI recommendation

Because the WebAssembly build runs on the main browser thread, a long synchronous search can freeze rendering.

### Good first step

Use a shallower search depth in the web build.

- Keep Korf around depth 4-6.
- Keep MaxN shallow until you add incremental search support.
- Optionally auto-reduce depth for 4D+ boards where the branching factor grows quickly.

### Better long-term design

Refactor each AI into a small search state machine:

- `beginSearch(board)` initializes frontier state.
- `stepSearch(nodeBudget)` expands only a limited amount of work.
- `isSearchComplete()` reports completion.
- `bestMoveSoFar()` exposes the current principal variation.

That lets the main loop spend a fixed amount of work per frame and keeps the UI responsive.

## 7. Visualizing 4D and 5D boards

A practical ImGui concept is:

### 3D

- Keep **X/Y** as the visible board.
- Add a **Z slice slider** or **tab bar**.

### 4D

- Keep **X/Y** visible.
- Use **tabs for W**.
- Inside each tab, use a **slider for Z**.

### 5D

- Keep **X/Y** visible.
- Use nested tabs or compact selectors for **V** and **W**.
- Use a slider for **Z** inside the active higher-dimensional slice.

### Minimal implementation for the first version

Flatten all extra dimensions `(z, w, v, ...)` into a single slice index and show one slider.

That is exactly what `web_app.cpp` does today, and it keeps the UX simple while still supporting arbitrary dimensions from the existing `Board` API.

## 8. Current engine limitations to know about

The existing core engine currently exposes:

- A single side length for every axis (`Board(size, dimensions)`).
- A fixed connect-four win check inside `Board::checkWin`.

So the web UI keeps Width/Height/Depth synchronized and treats win-length as fixed at `4` until the underlying board representation is generalized further.
