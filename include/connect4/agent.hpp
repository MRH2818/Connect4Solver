#pragma once

#include <vector>
#include "connect4/board.hpp"

using namespace std;

// Represents a human-style player: token identity and stdin column choice (see main.cpp loop).
class Agent {
private:
    char token;
    int playerNumber;
    
protected:
    vector<char> nextPlayers;

public:
    char getToken() const {
        return token;
    }
    int getPlayerNumber() const {
        return playerNumber;
    }
    Agent(char playerToken, int playerNumber, vector<char> nextPlayers) : token(playerToken), playerNumber(playerNumber), nextPlayers(nextPlayers) {}

    virtual vector<int> chooseMove(const Board& board, const vector<vector<int>>& oppLastMoves, bool firstMove=false) = 0; // Must be overridden
};

