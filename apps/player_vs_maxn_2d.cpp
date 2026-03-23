#include <cstdlib>
#include <ctime>
#include <iostream>
#include <vector>

#include "connect4/board.hpp"
#include "connect4/ui/player_game.hpp"
#include "maxnagent.hpp"

int main() {
    const int boardSize = 7;
    Board brd(boardSize, 2);

    const char humanToken = 'X';
    const char agentToken = 'O';
    MaxNAgent agent(agentToken, 2, { humanToken }, 1);

    std::srand(static_cast<unsigned>(std::time(nullptr)));

    std::cout << "Connect 4 (you vs MaxN agent). Four in a row wins.\n";
    std::cout << "You: " << humanToken << ", Agent: " << agentToken << "\n\n";

    int turn = 1;
    int lastMove = -1;
    std::vector<int> lastHumanMoveCoords;

    while (true) {
        printBoard2D(brd, boardSize);

        if (turn % 2 == 0) {
            std::cout << "Your turn (" << humanToken << "), ";
            int col = readColumn(boardSize);
            bool placed = brd.addDrop({ col }, humanToken);

            if (!placed) {
                std::cout << "That column is full. Pick another.\n";
                continue;
            }

            if (brd.checkWin(humanToken)) {
                printBoard2D(brd, boardSize);
                std::cout << "You win!\n";
                break;
            }
            lastMove = col;
            lastHumanMoveCoords = brd.getLastMoveCoords();
        } else {
            std::vector<std::vector<int>> oppLastMoves;
            if (!lastHumanMoveCoords.empty()) {
                oppLastMoves.push_back(lastHumanMoveCoords);
            }
            std::vector<int> move = agent.chooseMove(brd, oppLastMoves, lastHumanMoveCoords.empty());
            brd.addDrop(move, agentToken);
            std::cout << "Agent played column " << move[0] << ".\n";

            if (brd.checkWin(agentToken)) {
                printBoard2D(brd, boardSize);
                std::cout << "Agent wins!\n";
                break;
            }

            lastMove = move[0];
        }

        if (brd.isFull()) {
            printBoard2D(brd, boardSize);
            std::cout << "Board is full: draw.\n";
            break;
        }

        ++turn;
    }

    return 0;
}
