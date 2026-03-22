#pragma once
#include <cstdlib>
#include <vector>

#include "agent.hpp"

// Picks a legal drop by random trial
class RandomAgent : public Agent {
public:
    RandomAgent(char playerToken, int playerNumber, std::vector<char> nextPlayers)
        : Agent(playerToken, playerNumber, nextPlayers) {}

    std::vector<int> chooseMove(const Board& board, int boardSize) override {
        (void)boardSize;
        const int dims = board.getDimensions() - 1;
        while (true) {
            std::vector<int> move;
            move.reserve(static_cast<size_t>(dims));
            for (int i = 0; i < dims; ++i) {
                move.push_back(std::rand() % board.getSize());
            }
            Board trial = board;
            if (trial.addDrop(move, getToken())) {
                return move;
            }
        }
    }
};

