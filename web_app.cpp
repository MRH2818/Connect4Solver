#include <algorithm>
#include <array>
#include <memory>
#include <sstream>
#include <string>
#include <vector>

#include <SDL.h>
#include <SDL_opengl.h>
#include <emscripten.h>

#include "imgui.h"
#include "backends/imgui_impl_opengl3.h"
#include "backends/imgui_impl_sdl2.h"

#include "board.hpp"
#include "korfagent.hpp"
#include "maxnagent.hpp"
#include "randagent.hpp"

namespace {

constexpr int kMinBoardSize = 4;
constexpr int kMaxBoardSize = 8;
constexpr int kDefaultBoardSize = 7;
constexpr int kDefaultDimensions = 2;
constexpr int kFixedWinLength = 4;

constexpr char kHumanToken = 'X';
constexpr char kAiToken = 'O';

std::string joinCoords(const std::vector<int>& coords) {
    std::ostringstream out;
    out << "(";
    for (std::size_t i = 0; i < coords.size(); ++i) {
        out << coords[i];
        if (i + 1 < coords.size()) {
            out << ", ";
        }
    }
    out << ")";
    return out.str();
}

enum class AgentKind {
    Random = 0,
    MaxN = 1,
    Korf = 2,
};

const char* agentKindLabel(AgentKind kind) {
    switch (kind) {
        case AgentKind::Random:
            return "Random";
        case AgentKind::MaxN:
            return "MaxN";
        case AgentKind::Korf:
            return "Korf";
    }
    return "Unknown";
}

struct PendingSettings {
    int boardSize = kDefaultBoardSize;
    int dimensions = kDefaultDimensions;
    int width = kDefaultBoardSize;
    int height = kDefaultBoardSize;
    int depth = 1;
    int winLength = kFixedWinLength;
    int maxNDepth = 5;
    int korfDepth = 5;
    AgentKind agentKind = AgentKind::Korf;

    void syncDerivedSizes() {
        height = boardSize;
        depth = (dimensions >= 3) ? boardSize : 1;
        winLength = kFixedWinLength;
    }
};

struct GameState {
    Board board{kDefaultBoardSize, kDefaultDimensions};
    PendingSettings settings{};
    int currentSlice = 0;
    bool aiThinking = false;
    bool gameOver = false;
    bool humanTurn = true;
    std::string status = "Your turn.";
    std::vector<int> lastHumanFullCoords;
    std::vector<int> lastAiMove;
    std::vector<int> lastHumanDropCoords;

    GameState() {
        settings.syncDerivedSizes();
    }

    void rebuildBoard() {
        settings.syncDerivedSizes();
        board = Board(settings.boardSize, settings.dimensions);
        currentSlice = 0;
        aiThinking = false;
        gameOver = false;
        humanTurn = true;
        status = "Game reset. Your turn.";
        lastHumanFullCoords.clear();
        lastAiMove.clear();
        lastHumanDropCoords.clear();
    }

    bool aiEnabled() const {
        return true;
    }

    std::vector<int> chooseAiMove() const {
        std::vector<std::vector<int>> opponentMoves;
        if (!lastHumanFullCoords.empty()) {
            opponentMoves.push_back(lastHumanFullCoords);
        }

        switch (settings.agentKind) {
            case AgentKind::Random: {
                RandomAgent agent(kAiToken, 2, {kHumanToken});
                return agent.chooseMove(board, opponentMoves, board.isEmpty());
            }
            case AgentKind::MaxN: {
                MaxNAgent agent(kAiToken, 2, {kHumanToken}, 1);
                return agent.chooseMove(board, opponentMoves, board.isEmpty());
            }
            case AgentKind::Korf: {
                KorfAgent agent(kAiToken, 2, {kHumanToken}, settings.korfDepth);
                return agent.chooseMove(board, opponentMoves, board.isEmpty());
            }
        }
        return {};
    }

    void applyAiMove() {
        if (gameOver || humanTurn || aiThinking) {
            return;
        }

        aiThinking = true;
        status = std::string("Thinking with ") + agentKindLabel(settings.agentKind) + "...";

        std::vector<int> move = chooseAiMove();
        aiThinking = false;
        if (move.empty()) {
            gameOver = true;
            status = "No legal AI move found. Declaring a draw.";
            return;
        }

        board.addDrop(move, kAiToken);
        lastAiMove = move;
        status = std::string("AI played ") + joinCoords(move) + ". Your turn.";

        if (board.checkWin(kAiToken)) {
            gameOver = true;
            status = std::string(agentKindLabel(settings.agentKind)) + " wins.";
            return;
        }

        if (board.isFull()) {
            gameOver = true;
            status = "Board is full. Draw.";
            return;
        }

        humanTurn = true;
    }

    void handleHumanMove(const std::vector<int>& dropCoords) {
        if (gameOver || !humanTurn || aiThinking) {
            return;
        }

        if (!board.addDrop(dropCoords, kHumanToken)) {
            status = "That column is full.";
            return;
        }

        lastHumanDropCoords = dropCoords;
        lastHumanFullCoords = board.getLastMoveCoords();
        status = std::string("You played ") + joinCoords(dropCoords) + ".";

        if (board.checkWin(kHumanToken)) {
            gameOver = true;
            status = "You win.";
            return;
        }

        if (board.isFull()) {
            gameOver = true;
            status = "Board is full. Draw.";
            return;
        }

        humanTurn = false;
    }
};

struct WebApp {
    SDL_Window* window = nullptr;
    SDL_GLContext glContext = nullptr;
    GameState game;
};

WebApp* gApp = nullptr;

int cellIndexForVisibleSlice(const GameState& game, int x, int y) {
    std::vector<int> coords(game.settings.dimensions, 0);
    coords[0] = x;
    coords[1] = y;

    int remainder = game.currentSlice;
    for (int axis = 2; axis < game.settings.dimensions; ++axis) {
        coords[axis] = remainder % game.settings.boardSize;
        remainder /= game.settings.boardSize;
    }

    return game.board.coordsToIndex(coords);
}

std::vector<int> dropCoordsForVisibleColumn(const GameState& game, int x) {
    std::vector<int> dropCoords;
    dropCoords.reserve(static_cast<std::size_t>(game.settings.dimensions - 1));
    dropCoords.push_back(x);

    int remainder = game.currentSlice;
    for (int axis = 2; axis < game.settings.dimensions; ++axis) {
        dropCoords.push_back(remainder % game.settings.boardSize);
        remainder /= game.settings.boardSize;
    }
    return dropCoords;
}

void drawGameSettings(GameState& game) {
    ImGui::Begin("Game Settings");

    ImGui::TextWrapped("The current Board engine is hypercubic and hard-codes Connect-4, so width/height/depth stay synchronized and win-length remains fixed at 4.");

    bool rebuildRequested = false;
    rebuildRequested |= ImGui::SliderInt("Board Side Length", &game.settings.boardSize, kMinBoardSize, kMaxBoardSize);
    rebuildRequested |= ImGui::SliderInt("Dimensions", &game.settings.dimensions, 2, 5);

    game.settings.syncDerivedSizes();
    ImGui::BeginDisabled();
    ImGui::SliderInt("Width", &game.settings.width, kMinBoardSize, kMaxBoardSize);
    ImGui::SliderInt("Height", &game.settings.height, kMinBoardSize, kMaxBoardSize);
    ImGui::SliderInt("Depth", &game.settings.depth, 1, kMaxBoardSize);
    ImGui::SliderInt("Win Length", &game.settings.winLength, kFixedWinLength, kFixedWinLength);
    ImGui::EndDisabled();

    int agentIndex = static_cast<int>(game.settings.agentKind);
    if (ImGui::Combo("Agent", &agentIndex, "Random\0MaxN\0Korf\0")) {
        game.settings.agentKind = static_cast<AgentKind>(agentIndex);
    }

    if (game.settings.agentKind == AgentKind::MaxN) {
        ImGui::SliderInt("MaxN Depth", &game.settings.maxNDepth, 1, 7);
        ImGui::TextUnformatted("Note: MaxN depth is documented for the web build, but the current MaxNAgent keeps an internal fixed search depth of 7.");
    }
    if (game.settings.agentKind == AgentKind::Korf) {
        ImGui::SliderInt("Korf Depth", &game.settings.korfDepth, 1, 8);
    }

    if (ImGui::Button("Apply Settings")) {
        rebuildRequested = true;
    }
    ImGui::SameLine();
    if (ImGui::Button("Reset Game")) {
        game.rebuildBoard();
    }

    if (rebuildRequested) {
        game.rebuildBoard();
    }

    ImGui::Separator();
    ImGui::Text("Current turn: %s", game.humanTurn ? "Human (X)" : "AI (O)");
    ImGui::TextWrapped("Status: %s", game.status.c_str());
    ImGui::End();
}

void drawBoardWindow(GameState& game) {
    ImGui::Begin("Board");

    const int size = game.settings.boardSize;
    const int dimensions = game.settings.dimensions;

    if (dimensions > 2) {
        const int sliceCount = BoardUtils::ipow(size, dimensions - 2);
        ImGui::SliderInt("Slice Index", &game.currentSlice, 0, std::max(0, sliceCount - 1));
        ImGui::TextWrapped("Slice %d maps the extra axes (z, w, v, ...) to a single base-%d index.", game.currentSlice, size);
    }

    ImGui::TextUnformatted("Click any top cell in a column to drop a token.");

    for (int y = size - 1; y >= 0; --y) {
        for (int x = 0; x < size; ++x) {
            const int index = cellIndexForVisibleSlice(game, x, y);
            const char cell = game.board.getCell(index);
            const bool isTopRow = (y == size - 1);

            std::string label = " ";
            if (cell != EMPTY_CHAR) {
                label = std::string(1, cell);
            } else if (isTopRow) {
                label = "v";
            } else {
                label = ".";
            }

            ImGui::PushID(index);
            const bool canDropHere = isTopRow && game.humanTurn && !game.gameOver && !game.aiThinking;
            if (!canDropHere) {
                ImGui::BeginDisabled();
            }
            if (ImGui::Button(label.c_str(), ImVec2(34.0f, 34.0f)) && canDropHere) {
                game.handleHumanMove(dropCoordsForVisibleColumn(game, x));
            }
            if (!canDropHere) {
                ImGui::EndDisabled();
            }
            ImGui::PopID();

            if (x + 1 < size) {
                ImGui::SameLine();
            }
        }
    }

    ImGui::Separator();
    if (!game.lastHumanDropCoords.empty()) {
        ImGui::Text("Last human move: %s", joinCoords(game.lastHumanDropCoords).c_str());
    }
    if (!game.lastAiMove.empty()) {
        ImGui::Text("Last AI move: %s", joinCoords(game.lastAiMove).c_str());
    }

    ImGui::End();
}

void drawVisualizationNotes(GameState& game) {
    ImGui::Begin("Controls & Visualization");

    if (ImGui::Button("Think") && !game.humanTurn && !game.gameOver && !game.aiThinking) {
        game.applyAiMove();
    }
    ImGui::SameLine();
    if (ImGui::Button("Human Skip -> AI") && game.humanTurn && !game.gameOver) {
        game.humanTurn = false;
        game.status = "Handed turn to AI.";
    }

    ImGui::Separator();
    ImGui::TextWrapped("4D/5D UI concept: keep X and Y as the visible board, expose the remaining axes as a slice navigator, and optionally add one ImGui tab bar per extra axis for quick switching.");
    ImGui::BulletText("3D: one slider or tabs for Z slices.");
    ImGui::BulletText("4D: tabs for W, slider for Z within the active W tab.");
    ImGui::BulletText("5D: nested tabs or a compact axis inspector that shows the active slice tuple.");
    ImGui::BulletText("For the first web build, a single flattened slice index is the simplest implementation.");

    ImGui::Separator();
    ImGui::TextWrapped("Non-blocking AI suggestion: keep synchronous depth-limited search in the browser first, then refactor agents to expose an incremental step() API so one search iteration can run per frame.");

    ImGui::End();
}

bool initApp(WebApp& app) {
    if (SDL_Init(SDL_INIT_VIDEO | SDL_INIT_TIMER | SDL_INIT_GAMECONTROLLER) != 0) {
        return false;
    }

    SDL_GL_SetAttribute(SDL_GL_CONTEXT_FLAGS, 0);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_PROFILE_MASK, SDL_GL_CONTEXT_PROFILE_ES);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MAJOR_VERSION, 3);
    SDL_GL_SetAttribute(SDL_GL_CONTEXT_MINOR_VERSION, 0);
    SDL_GL_SetAttribute(SDL_GL_DOUBLEBUFFER, 1);
    SDL_GL_SetAttribute(SDL_GL_DEPTH_SIZE, 24);
    SDL_GL_SetAttribute(SDL_GL_STENCIL_SIZE, 8);

    app.window = SDL_CreateWindow(
        "Multidimensional Connect 4 Solver",
        SDL_WINDOWPOS_CENTERED,
        SDL_WINDOWPOS_CENTERED,
        1400,
        900,
        SDL_WINDOW_OPENGL | SDL_WINDOW_RESIZABLE | SDL_WINDOW_ALLOW_HIGHDPI
    );

    if (app.window == nullptr) {
        return false;
    }

    app.glContext = SDL_GL_CreateContext(app.window);
    if (app.glContext == nullptr) {
        return false;
    }

    SDL_GL_MakeCurrent(app.window, app.glContext);
    SDL_GL_SetSwapInterval(1);

    IMGUI_CHECKVERSION();
    ImGui::CreateContext();
    ImGui::StyleColorsDark();

    if (!ImGui_ImplSDL2_InitForOpenGL(app.window, app.glContext)) {
        return false;
    }
    if (!ImGui_ImplOpenGL3_Init("#version 300 es")) {
        return false;
    }

    return true;
}

void shutdownApp(WebApp& app) {
    ImGui_ImplOpenGL3_Shutdown();
    ImGui_ImplSDL2_Shutdown();
    ImGui::DestroyContext();

    if (app.glContext != nullptr) {
        SDL_GL_DeleteContext(app.glContext);
        app.glContext = nullptr;
    }
    if (app.window != nullptr) {
        SDL_DestroyWindow(app.window);
        app.window = nullptr;
    }
    SDL_Quit();
}

void mainLoop() {
    SDL_Event event;
    while (SDL_PollEvent(&event)) {
        ImGui_ImplSDL2_ProcessEvent(&event);
        if (event.type == SDL_QUIT) {
            emscripten_cancel_main_loop();
            return;
        }
    }

    ImGui_ImplOpenGL3_NewFrame();
    ImGui_ImplSDL2_NewFrame();
    ImGui::NewFrame();

    drawGameSettings(gApp->game);
    drawBoardWindow(gApp->game);
    drawVisualizationNotes(gApp->game);

    if (!gApp->game.humanTurn && !gApp->game.gameOver && !gApp->game.aiThinking) {
        gApp->game.applyAiMove();
    }

    ImGui::Render();
    int displayW = 0;
    int displayH = 0;
    SDL_GL_GetDrawableSize(gApp->window, &displayW, &displayH);
    glViewport(0, 0, displayW, displayH);
    glClearColor(0.08f, 0.08f, 0.10f, 1.0f);
    glClear(GL_COLOR_BUFFER_BIT);
    ImGui_ImplOpenGL3_RenderDrawData(ImGui::GetDrawData());
    SDL_GL_SwapWindow(gApp->window);
}

}  // namespace

int main() {
    static WebApp app;
    if (!initApp(app)) {
        shutdownApp(app);
        return 1;
    }

    gApp = &app;
    gApp->game.rebuildBoard();
    emscripten_set_main_loop(mainLoop, 0, true);
    shutdownApp(app);
    return 0;
}
