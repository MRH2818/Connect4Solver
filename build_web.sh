#!/usr/bin/env bash
set -euo pipefail

EMCC=${EMCC:-emcc}
OUT_DIR=${OUT_DIR:-dist}
IMGUI_DIR=${IMGUI_DIR:-third_party/imgui}

mkdir -p "$OUT_DIR"

"$EMCC" \
  -std=c++17 \
  -O3 \
  -Iinclude \
  -Isrc/agents \
  -I"$IMGUI_DIR" \
  -I"$IMGUI_DIR/backends" \
  web_app.cpp \
  "$IMGUI_DIR/imgui.cpp" \
  "$IMGUI_DIR/imgui_draw.cpp" \
  "$IMGUI_DIR/imgui_tables.cpp" \
  "$IMGUI_DIR/imgui_widgets.cpp" \
  "$IMGUI_DIR/backends/imgui_impl_sdl2.cpp" \
  "$IMGUI_DIR/backends/imgui_impl_opengl3.cpp" \
  -s USE_SDL=2 \
  -s WASM=1 \
  -s FULL_ES3=1 \
  -s USE_WEBGL2=1 \
  -s ALLOW_MEMORY_GROWTH=1 \
  -s EXPORTED_RUNTIME_METHODS='["ccall","cwrap"]' \
  --shell-file "$IMGUI_DIR/examples/example_emscripten_opengl3/shell_minimal.html" \
  -o "$OUT_DIR/connect4_web.html"
