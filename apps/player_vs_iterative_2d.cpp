#include <cstdlib>
#include <ctime>
#include <iostream>
#include <vector>

#include "board.hpp"
#include "ui/player_game.hpp"
#include "korf2_iterative.hpp"

int main() {
    const int boardSize = 12;
    Board brd(boardSize, 2);

    const char humanToken = 'X';
    const char agentToken = 'O';
    Korf2IterativeAgent agent(agentToken, 2, { humanToken }, 12, 5000);

    std::srand(static_cast<unsigned>(std::time(nullptr)));

    std::cout << "Connect 4 (you vs Korf2 agent). Four in a row wins.\n";
    std::cout << "You: " << humanToken << ", Agent: " << agentToken << "\n\n";

    int turn = std::rand() % 2;
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
