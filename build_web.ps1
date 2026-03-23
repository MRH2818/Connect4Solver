$ErrorActionPreference = 'Stop'

$EMXX = if ($env:EMXX) { $env:EMXX } else { 'em++' }
$OutDir = if ($env:OUT_DIR) { $env:OUT_DIR } else { 'dist' }
$ImGuiDir = if ($env:IMGUI_DIR) { $env:IMGUI_DIR } else { 'third_party/imgui' }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

$args = @(
  '-std=c++17',
  '-O3',
  '-Iinclude',
  '-Isrc/agents',
  "-I$ImGuiDir",
  "-I$ImGuiDir/backends",
  'web_app.cpp',
  "$ImGuiDir/imgui.cpp",
  "$ImGuiDir/imgui_draw.cpp",
  "$ImGuiDir/imgui_tables.cpp",
  "$ImGuiDir/imgui_widgets.cpp",
  "$ImGuiDir/backends/imgui_impl_sdl2.cpp",
  "$ImGuiDir/backends/imgui_impl_opengl3.cpp",
  '-s', 'USE_SDL=2',
  '-s', 'WASM=1',
  '-s', 'FULL_ES3=1',
  '-s', 'USE_WEBGL2=1',
  '-s', 'ALLOW_MEMORY_GROWTH=1',
  '-s', 'EXPORTED_RUNTIME_METHODS=["ccall","cwrap"]',
  '--shell-file', "$ImGuiDir/examples/example_emscripten_opengl3/shell_minimal.html",
  '-o', "$OutDir/connect4_web.html"
)

& $EMXX @args
