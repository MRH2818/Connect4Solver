#pragma once
#include <vector>
#include <cmath>
#include "connect4/agent.hpp"

using namespace std;

class MiniMaxAgent : public Agent {
private:
    class Streak {
    private:
        char targetCode;
        int length = 0;
        int sides;
        vector<int> direction;
    public:
        vector<int> startCoords;
        vector<int> endCoords;

        Streak(vector<int> startCoords, char targetCode) {
            this->startCoords = startCoords;
            this->endCoords = startCoords;
            this->length = 1;
            this->targetCode = targetCode;
            this->direction = std::vector(startCoords.size(), 0);
        }

        // Returns remaining sides of streak, given oppPos : index of opponent's position in board
        int processOppNode(const Board& board, const int oppPos) {
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
        bool addNode(const Board& board, const vector<int>& pos) {
            if (length == 1) {
                // Just check if it is next to the start node
                vector<int> dir;
                for (int i = 0; i < pos.size(); i++) {
                    dir.push_back(pos[i] - startCoords[i]);
                    if (abs(dir[i]) > 1)
                        return false;
                }
                this->direction = dir;
                length += 1;
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

            if (equalStart) {
                startCoords = pos;
            } if (equalEnd) {
                endCoords = pos;
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

    // Will evaluate the position for the playerToken and will return a score, using following weights:
    const float _1_streak_weight = 0;
    const float _2_streak_weight = 5;
    const float _3_streak_weight = 15;
    float evaluateEndPosition(const Board& board, std::vector<Streak>& streaks) {
        // Count all streaks for each player in nextPlayers

    }

    unsigned int uniqueCacheBucket;



public:
    MiniMaxAgent(char playerToken, int playerNumber, vector<char> nextPlayers, int uniqueCacheBucket)
        : Agent(playerToken, playerNumber, nextPlayers), uniqueCacheBucket(uniqueCacheBucket) {
        }

    unsigned int getCacheBucket() const {
        return uniqueCacheBucket;
    }

    vector<int> chooseMove(const Board& board, const vector<int>& oppLastMove, bool firstMove=false) override {

    }
};
