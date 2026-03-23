#pragma once
#include <vector>
#include <unordered_map>
#include <cmath>
#include <iostream>
#include <string>
#include "connect4/agent.hpp"

using namespace std;

class MaxNAgent : public Agent {
private:
    static constexpr bool _debug_thinking = true; // Temporary: set false to silence logs
    static constexpr bool _debug_root_only = true; // Temporary: log only top-level decisions

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

    class Streak {
    private:
        char targetCode;
        int length = 0;
        int sides;
        vector<int> direction;
    public:
        vector<int> startCoords;
        vector<int> endCoords;

        Streak(vector<int> startCoords, char playerToken) {
            this->startCoords = startCoords;
            this->endCoords = startCoords;
            this->length = 1;
            this->targetCode = playerToken;
            this->direction.assign(startCoords.size(), 0);
        }

        char getToken() const { return targetCode; } // Get code
        int getLength() const { return length; } // Get length
        int getSides() const { return sides; } // Get length

        // Returns remaining sides of streak, given oppPos : index of opponent's position in board
        int processOppNode(const Board& board, const int oppPos) {
            if (board.getCell(oppPos) == EMPTY_CHAR || board.getCell(oppPos) == this->targetCode) return this->sides;

            if (this->length < 2) {
                sides = 0;
                return 0;
            }

            this->sides = 0;
            auto coordBefore = BoardUtils::subtractCoords(startCoords, direction);
            auto coordAfter  = BoardUtils::addCoords(endCoords, direction);

            if (board.isInBoard(coordBefore)) {
                if (oppPos != board.coordsToIndex(coordBefore)) {
                    sides += 1;
                }
            }
            if (board.isInBoard(coordAfter)) {
                if (oppPos != board.coordsToIndex(coordAfter)) {
                    sides += 1;
                }
            }

            return sides;
        }

        // Returns true if node is added successfully
        bool addNode(const Board& board, const vector<int>& pos, char target) {
            if (target != targetCode || board.getCell(board.coordsToIndex(pos)) != targetCode) return false;

            if (length == 1) {
                // Just check if it is next to the start node
                vector<int> dir;
                for (int i = 0; i < pos.size(); i++) {
                    dir.push_back(pos[i] - startCoords[i]);
                    if (abs(dir[i]) > 1)
                        return false;
                }
                this->direction = dir;
                this->endCoords = pos;
                this->length = 2;
                return true;
            }
            // Else, just check if new end is one step ahead or behind the start.
            bool equalStart = true;
            bool equalEnd = true;
            for (int i = 0; i < pos.size() && (equalEnd || equalStart); i++) {
                if (equalStart) {
                    equalStart = startCoords[i] == pos[i] + direction[i];
                }
                if (equalEnd) {
                    equalEnd = endCoords[i] + direction[i] == pos[i];
                }
            }
            sides = 2;

            if (equalEnd) {
                endCoords = pos;
            } else if (equalStart) {
                startCoords = pos;
            }
            if (!board.isInBoard(BoardUtils::subtractCoords(startCoords, direction))) sides -= 1;
            if (!board.isInBoard(BoardUtils::addCoords(endCoords, direction))) sides -= 1;

            if (equalStart || equalEnd) {
                length++;
                return true;
            }
            return false;
        }
    };

    // Will evaluate the position for the playerToken and will return a score for each player, using following weights:
    const float _1_streak_weight = 0;
    const float _2_streak_weight = 5;
    const float _3_streak_weight = 15;
    const float _win_score = 100000000;
    unordered_map<char, float> evaluateEndPosition(const Board& board, const std::vector<Streak>& streaks, const std::vector<char>& orderedPlayerCodes, int numPossibleMoves) {
        // Count all streaks for each player
        float score = 0;
        bool win = false;
        std::unordered_map<char, float> scores; // Char = player code
        for (char k : orderedPlayerCodes) {
            scores[k] = 0.0f;
        }

        if (numPossibleMoves == 0) return scores; // It's a draw
        
        for (const Streak& streak : streaks) {
            float temp_score = 0;
            switch (streak.getLength()) {
                case 1 :
                    temp_score += _1_streak_weight * streak.getSides();
                    break;
                case 2 :
                    temp_score += _2_streak_weight * streak.getSides();
                    break;
                case 3 :
                    temp_score += _3_streak_weight * streak.getSides();
                    break;
                case 4 :
                    temp_score = _win_score;
                    win = true;
                    break;
                default:
                    break;
            }

            if (win) {
                for (char k : orderedPlayerCodes) {
                    scores[k] = (k == streak.getToken()) ? temp_score : -temp_score;
                }
                return scores;
            }
            for (char k : orderedPlayerCodes) {
                scores[k] += (k == streak.getToken()) ? temp_score : -temp_score;
            }
        }
        return scores;
    }

    // Simulate each move. nextPlayerCodes should be ordered so that the players in the earlier indices should be playing their turn sooner.
    // Moves will be simulated for orderedPlayerCodes[0]
    unordered_map<char, float> valueMoves(const vector<Streak>& _ogs, const Board& _ogb, const vector<vector<int>>& possibleMoves, const std::vector<char>& orderedPlayerCodes, int depth=5, int* _bestMoveIndex=nullptr, int ply=0) {
        if (!_debug_root_only || ply == 0) {
            logLine(ply, "Depth " + std::to_string(depth) + " | player " + std::string(1, orderedPlayerCodes[0]) +
                " | possible moves " + std::to_string(possibleMoves.size()));
        }

        if (depth == 0 || possibleMoves.empty()) {
            auto leafEval = evaluateEndPosition(_ogb, _ogs, orderedPlayerCodes, possibleMoves.size()); // EDGE END
            if (!_debug_root_only || ply == 0) {
                logLine(ply, "Leaf evaluation for player " + std::string(1, orderedPlayerCodes[0]) +
                    ": " + std::to_string(leafEval[orderedPlayerCodes[0]]));
            }
            return leafEval;
        }

        unordered_map<char, float> bestEval;
        int __bMoveIdx = -1;

        // SIMULATE EACH MOVE IN possibleMoves
        for (int i = 0; i < possibleMoves.size(); i++) {
            if (!_debug_root_only || ply == 0) {
                logLine(ply, "Try move " + moveToString(possibleMoves[i]) + " for player " + std::string(1, orderedPlayerCodes[0]));
            }
            Board virtualBoard = Board(_ogb); // COPY BOARD
            vector<Streak> virtualStreaks = vector<Streak>(_ogs); // COPY STREAKS

            unordered_map<char, float> evaluation; // PREPARE EVALUATION RETURN
            // SIMULATE MOVE:
            bool success = virtualBoard.addDrop(possibleMoves[i], orderedPlayerCodes[0]);
            if (!success) continue;

            // CHECK WIN
            success = virtualBoard.checkWin(orderedPlayerCodes[0]);
            if (success) {
                for (char k : orderedPlayerCodes) {
                    evaluation[k] = (k == orderedPlayerCodes[0]) ? _win_score : -_win_score;
                }
                if (_bestMoveIndex != nullptr) {
                    *_bestMoveIndex = i;
                }
                if (!_debug_root_only || ply == 0) {
                    logLine(ply, "Immediate win found with move " + moveToString(possibleMoves[i]));
                }
                return evaluation; // SECOND EDGE END, A WIN!
            }
            
            // NOW UPDATE STREAKS
            this->updateStreaks(virtualStreaks, virtualBoard, orderedPlayerCodes[0], virtualBoard.getLastMoveIndex(), virtualBoard.getLastMoveCoords());

            // EVALUATE NEW POSITION
            std::vector<char> allPlayerCodes(orderedPlayerCodes.begin()+1, orderedPlayerCodes.end());
            allPlayerCodes.push_back(orderedPlayerCodes[0]);

            // GET NEW EVALUATION FROM RECURSIVE ACTION
            evaluation = valueMoves(virtualStreaks, virtualBoard, virtualBoard.getAvailableMoves(), allPlayerCodes, depth-1, nullptr, ply+1);
            if (!_debug_root_only || ply == 0) {
                logLine(ply, "Move " + moveToString(possibleMoves[i]) + " score for player " + std::string(1, orderedPlayerCodes[0]) +
                    ": " + std::to_string(evaluation[orderedPlayerCodes[0]]));
            }
            
            // Save best evaluation
            if (__bMoveIdx == -1 || evaluation[orderedPlayerCodes[0]] > bestEval[orderedPlayerCodes[0]]) {
                bestEval = evaluation;
                __bMoveIdx = i;
                if (_bestMoveIndex != nullptr) {
                    *_bestMoveIndex = i;
                }
                if (!_debug_root_only || ply == 0) {
                    logLine(ply, "New best move: " + moveToString(possibleMoves[i]) +
                        " (score " + std::to_string(evaluation[orderedPlayerCodes[0]]) + ")");
                }
            }
        }
        return bestEval;
    }

    // UPDATE STREAKS, WILL NOT CHECK IF lastMoveIndex appropriately matches lastMoveCoords!
    // Update a provided streak list with a newly placed token.
    void updateStreaks(
        vector<Streak>& streaks,
        const Board& b,
        char token,
        int lastMoveIndex,
        vector<int> lastMoveCoords
    ) {
        vector<Streak> newStreaks;
        vector<bool> used(streaks.size(), false);
    
        int dims = lastMoveCoords.size();
        auto directions = BoardUtils::getAllDirections(dims);
    
        // Only use "positive" directions to avoid duplicates
        auto isCanonical = [](const vector<int>& dir) {
            for (int d : dir) {
                if (d < 0) return false;
                if (d > 0) return true;
            }
            return false;
        };
    
        for (auto& dir : directions) {
            if (!isCanonical(dir)) continue;
    
            vector<int> start = lastMoveCoords;
            vector<int> end = lastMoveCoords;
    
            // expand backward
            vector<int> cur = lastMoveCoords;
            while (true) {
                cur = BoardUtils::subtractCoords(cur, dir);
                if (!b.isInBoard(cur)) break;
                if (b.getCell(b.coordsToIndex(cur)) != token) break;
                start = cur;
            }
    
            // expand forward
            cur = lastMoveCoords;
            while (true) {
                cur = BoardUtils::addCoords(cur, dir);
                if (!b.isInBoard(cur)) break;
                if (b.getCell(b.coordsToIndex(cur)) != token) break;
                end = cur;
            }
    
            // compute length
            int length = 1;
            cur = start;
            while (cur != end) {
                cur = BoardUtils::addCoords(cur, dir);
                length++;
            }
    
            // compute open sides
            int sides = 0;
    
            auto before = BoardUtils::subtractCoords(start, dir);
            if (b.isInBoard(before) && b.getCell(b.coordsToIndex(before)) == EMPTY_CHAR)
                sides++;
    
            auto after = BoardUtils::addCoords(end, dir);
            if (b.isInBoard(after) && b.getCell(b.coordsToIndex(after)) == EMPTY_CHAR)
                sides++;
    
            // create merged streak
            Streak merged(start, token);
            merged.startCoords = start;
            merged.endCoords = end;
    
            // manually set internals (you may need setters)
            // hack: rebuild by simulating nodes along direction
            vector<int> rebuild = start;
            for (int i = 1; i < length; i++) {
                rebuild = BoardUtils::addCoords(rebuild, dir);
                merged.addNode(b, rebuild, token);
            }
    
            newStreaks.push_back(merged);
        }
    
        // Keep unrelated streaks (different token or not touching this move)
        for (int i = 0; i < streaks.size(); i++) {
            if (streaks[i].getToken() != token) {
                newStreaks.push_back(streaks[i]);
            }
        }
    
        streaks = std::move(newStreaks);
    }

    vector<Streak> streaks;
    unsigned int uniqueCacheBucket;

public:
    MaxNAgent(char playerToken, int playerNumber, vector<char> nextPlayers, int uniqueCacheBucket)
        : Agent(playerToken, playerNumber, nextPlayers), uniqueCacheBucket(uniqueCacheBucket) {
            this->streaks = {};
        }

    unsigned int getCacheBucket() const {
        return uniqueCacheBucket;
    }

    // oppLastMoves are the moves in the order that they were made (most recent move is at the end of the list)
    vector<int> chooseMove(const Board& board, const vector<vector<int>>& oppLastMoves, bool firstMove=false) override {
        logLine(0, "================ MAXN THINK START ================");
        logLine(0, "Agent token: " + std::string(1, this->getToken()));

        // FIRST: use opponents' last moves to update streaks
        for (int i = 0; i < oppLastMoves.size(); i++) {
            updateStreaks(this->streaks, board, this->nextPlayers[i], board.coordsToIndex(oppLastMoves[i]), oppLastMoves[i]);
        }

        // FOR EACH POSSIBLE MOVE, SIMULATE THEN EVALUATE. THEN PICK BEST ONE.
        vector<char> allPlayers = { this->getToken() };
        allPlayers.insert(allPlayers.end(), this->nextPlayers.begin(), this->nextPlayers.end());
        
        int bestMove = 0;
        auto availableMoves = board.getAvailableMoves();
        auto finalEval = valueMoves(this->streaks, board, availableMoves, allPlayers, 7, &bestMove, 0);
        logLine(0, "Selected move: " + moveToString(availableMoves[bestMove]) +
            " | score: " + std::to_string(finalEval[this->getToken()]));
        logLine(0, "================= MAXN THINK END =================");

        return availableMoves[bestMove];
    }
};
