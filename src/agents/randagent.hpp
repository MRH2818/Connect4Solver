#pragma once
#include <cstdlib>
#include <vector>

#include "agent.hpp"

// Picks a legal drop by random trial
class RandomAgent : public Agent {
public:
    RandomAgent(char playerToken, int playerNumber, const std::vector<char>& nextPlayers)
        : Agent(playerToken, playerNumber, nextPlayers) {}

    std::vector<int> chooseMove(const Board& board, const vector<vector<int>>& oppLastMoves, bool firstMove=false) override {
        (void)oppLastMoves;
        (void)firstMove;
        auto availableMoves = board.getAvailableMoves();
        return availableMoves[rand() % availableMoves.size()];
    }
};
