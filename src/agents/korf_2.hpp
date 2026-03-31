#pragma once
#include <array>
#include <iostream>
#include <string>
#include <unordered_map>
#include <vector>
#include "agent.hpp"
#include <tuple>

/*
BASED ON THE KORF AGENT, BUT WITH MORE MODULAR IMPROVEMENTS
*/

using namespace std;

class Korf2Agent : public Agent {
    private:
    static constexpr bool _debug_thinking = false;
    static constexpr bool _debug_root_only = true;
    
    static constexpr float _sum_bound = 1.0f;
    static constexpr float _heuristic_bound = 0.99f;
    static constexpr float _two_weight = 1.0f;
    static constexpr float _three_weight = 6.0f;
    static constexpr float _win_weight = 1000.0f;
    struct SearchResult {
        unordered_map<char, float> scores;
        int bestMoveIndex;
        int depthSearched;
    };
    
    unordered_map<string, SearchResult> searchCache; // Key: board.toString() --> Value: The result of the search at a specific depth

    int searchDepth;
    int cachedBoardSize = -1;
    int cachedDimensions = -1;
    
    std::string moveToString(const std::vector<int>& move) const {
        std::string out = "[";
        for (size_t i = 0; i < move.size(); i++) {
            out += std::to_string(move[i]);
            if (i + 1 < move.size()) out += ", ";
        }
        out += "]";
        return out;
    }

    std::string indent(int ply) const {
        return std::string(ply * 2, ' ');
    }

    void logLine(int ply, const std::string& msg) const {
        if (_debug_thinking) {
            if (_debug_root_only && ply > 0) return;
            std::cout << indent(ply) << msg << std::endl;
        }
    }

    // OPTIMIZATION 1: Mapping cells to the lines they belong to
    vector<array<int, 4>> winningLines;
    vector<vector<int>> cellToLines; 

    // OPTIMIZATION 2: Transposition Table for board evaluations
    // Key: board.toString(), Value: The calculated score map
    unordered_map<string, unordered_map<char, float>> evalCache;

    void ensureWinningLines(const Board& board) {
        if (cachedBoardSize == board.getSize() && cachedDimensions == board.getDimensions() && !winningLines.empty()) {
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
                    int lineIdx = winningLines.size();
                    winningLines.push_back(line);
                    // Map every cell in this line back to the line index
                    for (int cellIdx : line) {
                        cellToLines[cellIdx].push_back(lineIdx);
                    }
                }
            }
        }
    }

    unordered_map<char, float> evaluateEndPosition( const Board& board, const vector<char>& orderedPlayerCodes, int numPossibleMoves
    ) {
        // OPTIMIZATION 2: Check Transposition Table first
        string boardKey = board.toString();
        if (evalCache.count(boardKey)) {
            return evalCache[boardKey];
        }

        auto scores = zeroScores(orderedPlayerCodes);
        char winner = detectWinner(board);
        
        if (winner != '\0') {
            scores[winner] = _sum_bound;
            evalCache[boardKey] = scores; // Cache result
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
                if (cell == EMPTY_CHAR) continue;

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

            if (blocked || owner == '\0') continue;

            if (ownedCount == 2) rawScores[owner] += _two_weight;
            else if (ownedCount == 3) rawScores[owner] += _three_weight;
            else if (ownedCount == 4) rawScores[owner] += _win_weight;
        }

        float total = 0.0f;
        for (char token : orderedPlayerCodes) total += rawScores[token];

        if (total > 0.0f) {
            for (char token : orderedPlayerCodes) {
                scores[token] = _heuristic_bound * (rawScores[token] / total);
            }
        }

        // Cache the final normalized scores
        evalCache[boardKey] = scores;
        return scores;
    }

    char detectWinner(const Board& board) {
        ensureWinningLines(board);
        for (const auto& line : winningLines) {
            char token = board.getCell(line[0]);
            if (token == EMPTY_CHAR) continue;
            if (board.getCell(line[1]) == token &&
                board.getCell(line[2]) == token &&
                board.getCell(line[3]) == token) {
                return token;
            }
        }
        return '\0';
    }

    unordered_map<char, float> zeroScores(const vector<char>& orderedPlayerCodes) const {
        unordered_map<char, float> scores;
        for (char token : orderedPlayerCodes) {
            scores[token] = 0.0f;
        }
        return scores;
    }

    int findImmediateWinningMove(
        const Board& board,
        const std::vector<std::vector<int>>& possibleMoves,
        char currentPlayer
    ) const {
        for (int i = 0; i < static_cast<int>(possibleMoves.size()); ++i) {
            Board virtualBoard(board);
            if (!virtualBoard.addDrop(possibleMoves[i], currentPlayer)) continue;
            if (virtualBoard.checkWin(currentPlayer)) {
                return i;
            }
        }
        return -1;
    }

    unordered_map<char, float> shallowValueMoves(
        const Board& originalBoard,
        const std::vector<std::vector<int>>& possibleMoves,
        const std::vector<char>& orderedPlayerCodes,
        int depth,
        float bound,
        int* bestMoveIndex = nullptr,
        int ply = 0
    ) {
        if (!_debug_root_only || ply == 0) {
            logLine(ply, "Depth " + std::to_string(depth) +
                " | player " + std::string(1, orderedPlayerCodes[0]) +
                " | possible moves " + std::to_string(possibleMoves.size()) +
                " | bound " + std::to_string(bound));
        }

        // LOOK UP RESULT ON THE TRANSPOSITION TABLE!!!
        string boardKey = originalBoard.toString();
        if (searchCache.count(boardKey)) {
            const auto& entry = searchCache[boardKey];
            // Only use the cached result if it was searched at an equal or greater depth
            if (entry.depthSearched >= depth) {
                if (bestMoveIndex) *bestMoveIndex = entry.bestMoveIndex;
                return entry.scores;
            }
        }

        if (depth == 0 || possibleMoves.empty()) {
            return evaluateEndPosition(originalBoard, orderedPlayerCodes, possibleMoves.size());
        }

        const char currentPlayer = orderedPlayerCodes[0];
        int immediateWinIndex = findImmediateWinningMove(originalBoard, possibleMoves, currentPlayer);
        if (immediateWinIndex != -1) {
            auto evaluation = zeroScores(orderedPlayerCodes);
            evaluation[currentPlayer] = _sum_bound;
            if (bestMoveIndex != nullptr) {
                *bestMoveIndex = immediateWinIndex;
            }
            if (!_debug_root_only || ply == 0) {
                logLine(ply, "Immediate win found with move " + moveToString(possibleMoves[immediateWinIndex]));
            }
            return evaluation;
        }

        unordered_map<char, float> bestEval;
        int _haveBest = -1;

        for (int i = 0; i < possibleMoves.size(); ++i) {
            if (_haveBest != -1 && bestEval[currentPlayer] >= bound) {
                if (!_debug_root_only || ply == 0) {
                    logLine(ply, "Shallow prune before move " + moveToString(possibleMoves[i]) +
                        " because " + std::to_string(bestEval[currentPlayer]) +
                        " >= " + std::to_string(bound));
                }
                break;
            }

            Board virtualBoard(originalBoard);
            if (!virtualBoard.addDrop(possibleMoves[i], currentPlayer)) continue;

            std::vector<char> nextPlayerCodes(orderedPlayerCodes.begin() + 1, orderedPlayerCodes.end());
            nextPlayerCodes.push_back(currentPlayer);

            // EXECUTE RECURSIVE ACTION!!!
            float childBound = _haveBest != -1 ? (_sum_bound - bestEval[currentPlayer]) : _sum_bound;
            auto evaluation = shallowValueMoves( virtualBoard, virtualBoard.getAvailableMoves(), nextPlayerCodes, depth-1, childBound, nullptr, ply+1 );

            if (_haveBest == -1 || evaluation[currentPlayer] > bestEval[currentPlayer]) {
                bestEval = evaluation;
                _haveBest = i;
                if (bestMoveIndex != nullptr) {
                    *bestMoveIndex = i;
                }
                if (!_debug_root_only || ply == 0) {
                    logLine(ply, "New best move: " + moveToString(possibleMoves[i]) +
                        " (score " + std::to_string(evaluation[currentPlayer]) + ")");
                }
            }
        }

        if (_haveBest == -1) {
            return evaluateEndPosition(originalBoard, orderedPlayerCodes, static_cast<int>(possibleMoves.size()));
        }

        // CACHE THE RESULT!!!
        searchCache[boardKey] = { bestEval, _haveBest, depth };
        return bestEval;
    }

public:
    Korf2Agent(char playerToken, int playerNumber, const vector<char>& nextPlayers, int searchDepth = 7)
        : Agent(playerToken, playerNumber, nextPlayers), searchDepth(searchDepth) {}

    std::vector<int> chooseMove(const Board& board, const vector<vector<int>>& oppLastMoves, bool firstMove=false) override {
        (void)oppLastMoves;
        (void)firstMove;

        ensureWinningLines(board);

        logLine(0, "=============== KORF2 THINK START ===============");
        logLine(0, "Agent token: " + std::string(1, this->getToken()));

        auto availableMoves = board.getAvailableMoves();
        if (availableMoves.empty()) {
            return {};
        }

        // CLEAR THE CACHE : won't be needed again, as we're progressing the search tree
        searchCache.clear();
        evalCache.clear();

        vector<char> allPlayers = { this->getToken() };
        allPlayers.insert(allPlayers.end(), this->nextPlayers.begin(), this->nextPlayers.end());

        int bestMove = 0;
        auto finalEval = shallowValueMoves(
            board,
            availableMoves,
            allPlayers,
            searchDepth,
            _sum_bound,
            &bestMove,
            0
        );

        logLine(0, "Selected move: " + moveToString(availableMoves[bestMove]) +
            " | score: " + std::to_string(finalEval[this->getToken()]));
        logLine(0, "================ KORF2 THINK END ================");

        return availableMoves[bestMove];
    }
};
