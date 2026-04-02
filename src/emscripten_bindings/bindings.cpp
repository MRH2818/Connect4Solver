#pragma once

#include "board.hpp"
#include "agent.hpp"
#include "korf2_iterative.hpp"
#include <emscripten/bind.h>

using namespace emscripten;

EMSCRIPTEN_BINDINGS(connect4_module) {
    // ===============================
    // VECTOR BINDINGS
    // ===============================
    register_vector<int>("VectorInt");
    register_vector<char>("VectorChar");
    register_vector<std::vector<int>>("VectorVectorInt");

    // ===============================
    // ABSTRACT BASE CLASS
    // ===============================
    class_<Agent>("Agent")
        .function("getToken", &Agent::getToken)
        .function("getPlayerNumber", &Agent::getPlayerNumber);

    // ===============================
    // BOARD
    // ===============================
    class_<Board>("Board")
        .constructor<int, int>()
        .function("indexToCoords", &Board::indexToCoords)
        .function("coordsToIndex", &Board::coordsToIndex)
        .function("dropMoveIndex", &Board::dropMoveIndex)
        .function("dropMoveCoords", &Board::dropMoveCoords)
        .function("checkWin", &Board::checkWin)
        .function("isInBoard", &Board::isInBoard)
        .function("addDrop", &Board::addDrop)
        .function("getAvailableMoves", &Board::getAvailableMoves)
        .function("getDimensions", &Board::getDimensions)
        .function("getSize", &Board::getSize)
        .function("getBoard", &Board::getBoard)
        .function("getCell", &Board::getCell)
        .function("getLastMoveIndex", &Board::getLastMoveIndex)
        .function("getLastMoveCoords", &Board::getLastMoveCoords)
        .function("getDirections", &Board::getDirections)
        .function("toString", &Board::toString)
        .function("isFull", &Board::isFull)
        .function("isEmpty", &Board::isEmpty);

    // ===============================
    // AI AGENT
    // ===============================
    class_<Korf2IterativeAgent, base<Agent>>("Korf2IterativeAgent")
        .constructor<char, int, const std::vector<char>&, int, int>()
        .function("chooseMove", &Korf2IterativeAgent::chooseMove);
}
