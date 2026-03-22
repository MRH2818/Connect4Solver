#pragma once
#include "board.hpp"

using namespace std;

// Represents a human-style player: token identity and stdin column choice (see main.cpp loop).
class Agent {
private:
    char token;
    int player_number;

public:
    char getToken() const;
    int getPlayerNumber() const;
    Agent(char yourToken, int playerNumber, vector<char> nextPlayers);
    vector<int> chooseMove(const Board& board, int boardSize) const;
};
