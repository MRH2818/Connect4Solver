#pragma once

#include <array>
#include <chrono>
#include <iostream>
#include <numeric>
#include <string>
#include <unordered_map>
#include <vector>

#include "agent.hpp"

using namespace std;

/*
ITERATIVE VERSION OF THE KORF2 AGENT.
KEEPS THE SAME HEURISTICS AND SHALLOW-PRUNING IDEA, BUT REPLACES
RECURSIVE DFS WITH AN EXPLICIT STACK AND WRAPS IT IN ITERATIVE DEEPENING.
*/

class Korf2IterativeAgent : public Agent {
private:
    struct SearchResult {
        unordered_map<char, float> scores;
        int bestMoveIndex = -1;
        int depthSearched = -1;
    };

    struct SearchIteration {
        SearchResult result;
        bool completed = false;
        bool timedOut = false;
    };

    struct SearchFrame {
        Board board;
        vector<vector<int>> possibleMoves;
        vector<int> moveOrder;
        vector<char> orderedPlayerCodes;
        string boardKey;
        int depthRemaining;
        float bound;
        int ply;
        bool entered = false;
        int nextMoveOrderPos = 0;
        int bestMoveIndex = -1;
        unordered_map<char, float> bestEval;
        int pendingChildMoveIndex = -1;

        SearchFrame(
            const Board& board,
            vector<vector<int>> possibleMoves,
            vector<char> orderedPlayerCodes,
            int depthRemaining,
            float bound,
            int ply
        )
            : board(board),
              possibleMoves(std::move(possibleMoves)),
              orderedPlayerCodes(std::move(orderedPlayerCodes)),
              boardKey(this->board.toString()),
              depthRemaining(depthRemaining),
              bound(bound),
              ply(ply) {}
    };

    static constexpr bool _debug_thinking = false;
    static constexpr bool _debug_root_only = true;

    static constexpr float _sum_bound = 1.0f;
    static constexpr float _heuristic_bound = 0.99f;
    static constexpr float _two_weight = 1.0f;
    static constexpr float _three_weight = 6.0f;
    static constexpr float _win_weight = 1000.0f;

    int searchDepth;
    int timeLimitMs;
    int minDepth;
    int cachedBoardSize = -1;
    int cachedDimensions = -1;

    vector<array<int, 4>> winningLines;
    vector<vector<int>> cellToLines;

    unordered_map<string, SearchResult> searchCache;
    unordered_map<string, unordered_map<char, float>> evalCache;

    std::string moveToString(const std::vector<int>& move) const {
        std::string out = "[";
        for (size_t i = 0; i < move.size(); i++) {
            out += std::to_string(move[i]);
            if (i + 1 < move.size()) {
                out += ", ";
            }
        }
        out += "]";
        return out;
    }

    std::string indent(int ply) const {
        return std::string(ply * 2, ' ');
    }

    void logLine(int ply, const std::string& msg) const {
        if (_debug_thinking) {
            if (_debug_root_only && ply > 0) {
                return;
            }
            std::cout << indent(ply) << msg << std::endl;
        }
    }

    bool timeExpired(const std::chrono::steady_clock::time_point& deadline) const {
        if (timeLimitMs <= 0) {
            return false;
        }
        return std::chrono::steady_clock::now() >= deadline;
    }

    void ensureWinningLines(const Board& board) {
        if (cachedBoardSize == board.getSize() &&
            cachedDimensions == board.getDimensions() &&
            !winningLines.empty()) {
            return;
        }

        cachedBoardSize = board.getSize();
        cachedDimensions = board.getDimensions();
        winningLines.clear();

        const int cellCount = static_cast<int>(board.getBoard().size());
        cellToLines.assign(cellCount, vector<int>());

        auto directions = board.getDirections();

        for (int index = 0; index < cellCount; ++index) {
            auto start = board.indexToCoords(index);
            for (const auto& dir : directions) {
                array<int, 4> line{};
                line[0] = index;

                auto cur = start;
                bool valid = true;
                for (int step = 1; step < 4; ++step) {
                    cur = BoardUtils::addCoords(cur, dir);
                    if (!board.isInBoard(cur)) {
                        valid = false;
                        break;
                    }
                    line[step] = board.coordsToIndex(cur);
                }

                if (valid) {
                    int lineIdx = static_cast<int>(winningLines.size());
                    winningLines.push_back(line);
                    for (int cellIdx : line) {
                        cellToLines[cellIdx].push_back(lineIdx);
                    }
                }
            }
        }
    }

    unordered_map<char, float> zeroScores(const vector<char>& orderedPlayerCodes) const {
        unordered_map<char, float> scores;
        for (char token : orderedPlayerCodes) {
            scores[token] = 0.0f;
        }
        return scores;
    }

    char detectWinner(const Board& board) {
        ensureWinningLines(board);
        for (const auto& line : winningLines) {
            char token = board.getCell(line[0]);
            if (token == EMPTY_CHAR) {
                continue;
            }
            if (board.getCell(line[1]) == token &&
                board.getCell(line[2]) == token &&
                board.getCell(line[3]) == token) {
                return token;
            }
        }
        return '\0';
    }

    unordered_map<char, float> evaluateEndPosition(
        const Board& board,
        const vector<char>& orderedPlayerCodes,
        int numPossibleMoves
    ) {
        string boardKey = board.toString();
        auto evalIt = evalCache.find(boardKey);
        if (evalIt != evalCache.end()) {
            return evalIt->second;
        }

        auto scores = zeroScores(orderedPlayerCodes);
        char winner = detectWinner(board);

        if (winner != '\0') {
            scores[winner] = _sum_bound;
            evalCache[boardKey] = scores;
            return scores;
        }

        if (numPossibleMoves == 0) {
            evalCache[boardKey] = scores;
            return scores;
        }

        auto rawScores = zeroScores(orderedPlayerCodes);
        for (const auto& line : winningLines) {
            char owner = '\0';
            int ownedCount = 0;
            bool blocked = false;

            for (int index : line) {
                char cell = board.getCell(index);
                if (cell == EMPTY_CHAR) {
                    continue;
                }

                if (owner == '\0') {
                    owner = cell;
                    ownedCount = 1;
                } else if (cell == owner) {
                    ownedCount += 1;
                } else {
                    blocked = true;
                    break;
                }
            }

            if (blocked || owner == '\0') {
                continue;
            }

            if (ownedCount == 2) {
                rawScores[owner] += _two_weight;
            } else if (ownedCount == 3) {
                rawScores[owner] += _three_weight;
            } else if (ownedCount == 4) {
                rawScores[owner] += _win_weight;
            }
        }

        float total = 0.0f;
        for (char token : orderedPlayerCodes) {
            total += rawScores[token];
        }

        if (total > 0.0f) {
            for (char token : orderedPlayerCodes) {
                scores[token] = _heuristic_bound * (rawScores[token] / total);
            }
        }

        evalCache[boardKey] = scores;
        return scores;
    }

    int findImmediateWinningMove(
        const Board& board,
        const vector<vector<int>>& possibleMoves,
        char currentPlayer
    ) const {
        for (int i = 0; i < static_cast<int>(possibleMoves.size()); ++i) {
            Board virtualBoard(board);
            if (!virtualBoard.addDrop(possibleMoves[i], currentPlayer)) {
                continue;
            }
            if (virtualBoard.checkWin(currentPlayer)) {
                return i;
            }
        }
        return -1;
    }

    SearchResult resolveLeaf(SearchFrame& frame) {
        SearchResult result;
        result.scores = evaluateEndPosition(
            frame.board,
            frame.orderedPlayerCodes,
            static_cast<int>(frame.possibleMoves.size())
        );
        result.depthSearched = frame.depthRemaining;
        searchCache[frame.boardKey] = result;
        return result;
    }

    SearchResult resolveImmediateWin(SearchFrame& frame) {
        SearchResult result;
        result.scores = zeroScores(frame.orderedPlayerCodes);
        result.scores[frame.orderedPlayerCodes[0]] = _sum_bound;
        result.bestMoveIndex = frame.bestMoveIndex;
        result.depthSearched = frame.depthRemaining;
        searchCache[frame.boardKey] = result;
        return result;
    }

    SearchResult resolveFinishedFrame(SearchFrame& frame) {
        if (frame.bestMoveIndex == -1) {
            return resolveLeaf(frame);
        }

        SearchResult result;
        result.scores = frame.bestEval;
        result.bestMoveIndex = frame.bestMoveIndex;
        result.depthSearched = frame.depthRemaining;
        searchCache[frame.boardKey] = result;
        return result;
    }

    SearchIteration depthLimitedSearchIterative(
        const Board& originalBoard,
        const vector<vector<int>>& possibleMoves,
        const vector<char>& orderedPlayerCodes,
        int depth,
        float bound,
        const std::chrono::steady_clock::time_point& deadline,
        bool enforceTimeLimit
    ) {
        vector<SearchFrame> stack;
        stack.emplace_back(originalBoard, possibleMoves, orderedPlayerCodes, depth, bound, 0);

        SearchResult lastCompleted;
        bool haveLastCompleted = false;

        while (!stack.empty()) {
            if (enforceTimeLimit && timeExpired(deadline)) {
                return { {}, false, true };
            }

            SearchFrame& frame = stack.back();
            const char currentPlayer = frame.orderedPlayerCodes[0];

            if (frame.pendingChildMoveIndex != -1 && haveLastCompleted) {
                const int moveIndex = frame.pendingChildMoveIndex;
                frame.pendingChildMoveIndex = -1;

                if (frame.bestMoveIndex == -1 ||
                    lastCompleted.scores[currentPlayer] > frame.bestEval[currentPlayer]) {
                    frame.bestEval = lastCompleted.scores;
                    frame.bestMoveIndex = moveIndex;
                    if (!_debug_root_only || frame.ply == 0) {
                        logLine(frame.ply, "New best move: " + moveToString(frame.possibleMoves[moveIndex]) +
                            " (score " + std::to_string(lastCompleted.scores[currentPlayer]) + ")");
                    }
                }

                haveLastCompleted = false;

                if (frame.bestMoveIndex != -1 && frame.bestEval[currentPlayer] >= frame.bound) {
                    lastCompleted = resolveFinishedFrame(frame);
                    haveLastCompleted = true;
                    stack.pop_back();
                    continue;
                }
            }

            if (!frame.entered) {
                if (!_debug_root_only || frame.ply == 0) {
                    logLine(frame.ply, "Depth " + std::to_string(frame.depthRemaining) +
                        " | player " + std::string(1, currentPlayer) +
                        " | possible moves " + std::to_string(frame.possibleMoves.size()) +
                        " | bound " + std::to_string(frame.bound));
                }

                auto cachedIt = searchCache.find(frame.boardKey);
                if (cachedIt != searchCache.end() &&
                    cachedIt->second.depthSearched >= frame.depthRemaining) {
                    lastCompleted = cachedIt->second;
                    haveLastCompleted = true;
                    stack.pop_back();
                    continue;
                }

                if (frame.depthRemaining == 0 || frame.possibleMoves.empty()) {
                    lastCompleted = resolveLeaf(frame);
                    haveLastCompleted = true;
                    stack.pop_back();
                    continue;
                }

                int immediateWinIndex = findImmediateWinningMove(
                    frame.board,
                    frame.possibleMoves,
                    currentPlayer
                );
                if (immediateWinIndex != -1) {
                    frame.bestMoveIndex = immediateWinIndex;
                    if (!_debug_root_only || frame.ply == 0) {
                        logLine(frame.ply, "Immediate win found with move " +
                            moveToString(frame.possibleMoves[immediateWinIndex]));
                    }
                    lastCompleted = resolveImmediateWin(frame);
                    haveLastCompleted = true;
                    stack.pop_back();
                    continue;
                }

                frame.moveOrder.resize(frame.possibleMoves.size());
                std::iota(frame.moveOrder.begin(), frame.moveOrder.end(), 0);

                if (cachedIt != searchCache.end()) {
                    int cachedBestMove = cachedIt->second.bestMoveIndex;
                    if (cachedBestMove >= 0 &&
                        cachedBestMove < static_cast<int>(frame.moveOrder.size())) {
                        auto promoted = std::find(
                            frame.moveOrder.begin(),
                            frame.moveOrder.end(),
                            cachedBestMove
                        );
                        if (promoted != frame.moveOrder.end()) {
                            std::iter_swap(frame.moveOrder.begin(), promoted);
                        }
                    }
                }

                frame.entered = true;
            }

            if (frame.nextMoveOrderPos >= static_cast<int>(frame.moveOrder.size())) {
                lastCompleted = resolveFinishedFrame(frame);
                haveLastCompleted = true;
                stack.pop_back();
                continue;
            }

            const int moveIndex = frame.moveOrder[frame.nextMoveOrderPos++];
            Board virtualBoard(frame.board);
            if (!virtualBoard.addDrop(frame.possibleMoves[moveIndex], currentPlayer)) {
                continue;
            }

            vector<char> nextPlayerCodes(
                frame.orderedPlayerCodes.begin() + 1,
                frame.orderedPlayerCodes.end()
            );
            nextPlayerCodes.push_back(currentPlayer);

            float childBound = frame.bestMoveIndex != -1
                ? (_sum_bound - frame.bestEval[currentPlayer])
                : _sum_bound;

            frame.pendingChildMoveIndex = moveIndex;
            stack.emplace_back(
                virtualBoard,
                virtualBoard.getAvailableMoves(),
                nextPlayerCodes,
                frame.depthRemaining - 1,
                childBound,
                frame.ply + 1
            );
        }

        SearchIteration iteration;
        iteration.result = lastCompleted;
        iteration.completed = true;
        return iteration;
    }

    SearchResult lastBestResult;

public:
    Korf2IterativeAgent(
        char playerToken, int playerNumber, const vector<char>& nextPlayers, int searchDepth = 7, int timeLimitMs = 3000, int minDepth = 0)
        : Agent(playerToken, playerNumber, nextPlayers), searchDepth(searchDepth), timeLimitMs(timeLimitMs), minDepth(minDepth) {}

    
    float getLastBestResult(char token) {
        return lastBestResult.scores[token];
    }
    int getLastSearchDepth() const {
        return lastBestResult.depthSearched;
    }

    vector<int> chooseMove(const Board& board, const vector<vector<int>>& oppLastMoves, bool firstMove = false) override {
        (void)oppLastMoves;
        (void)firstMove;

        ensureWinningLines(board);

        logLine(0, "=========== KORF2 ITERATIVE THINK START ==========");
        logLine(0, "Agent token: " + std::string(1, this->getToken()));

        auto availableMoves = board.getAvailableMoves();
        if (availableMoves.empty()) {
            return {};
        }

        searchCache.clear();
        evalCache.clear();

        vector<char> allPlayers = { this->getToken() };
        allPlayers.insert(allPlayers.end(), this->nextPlayers.begin(), this->nextPlayers.end());

        const auto searchStart = std::chrono::steady_clock::now();
        const auto deadline = searchStart + std::chrono::milliseconds(timeLimitMs > 0 ? timeLimitMs : 0);

        SearchResult bestResult;
        bestResult.scores = zeroScores(allPlayers);
        bestResult.bestMoveIndex = 0;
        bestResult.depthSearched = 0;

        for (int depth = 1; depth <= searchDepth; ++depth) {
            const bool enforceTimeLimit =
                timeLimitMs > 0 && depth > minDepth;
            if (enforceTimeLimit && timeExpired(deadline) && bestResult.depthSearched >= minDepth) {
                logLine(0, "Both time cutoff and minimum depth reached before starting depth " + std::to_string(depth));
                break;
            }

            auto iteration = depthLimitedSearchIterative(
                board,
                availableMoves,
                allPlayers,
                depth,
                _sum_bound,
                deadline,
                enforceTimeLimit
            );

            if (!iteration.completed) {
                logLine(0, "Time cutoff reached during depth " + std::to_string(depth));
                break;
            }

            if (iteration.result.bestMoveIndex != -1) {
                bestResult = iteration.result;
            }

            logLine(0, "Completed depth " + std::to_string(depth) +
                " | best move " + moveToString(availableMoves[bestResult.bestMoveIndex]) +
                " | score " + std::to_string(bestResult.scores[this->getToken()]));

            if (bestResult.scores[this->getToken()] >= _sum_bound) {
                break;
            }
        }

        logLine(0, "Selected move: " + moveToString(availableMoves[bestResult.bestMoveIndex]) +
            " | score: " + std::to_string(bestResult.scores[this->getToken()]));
        logLine(0, "============ KORF2 ITERATIVE THINK END ===========");

        
        this->lastBestResult = bestResult;

        return availableMoves[bestResult.bestMoveIndex];
    }
};
