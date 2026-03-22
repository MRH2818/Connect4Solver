#include <iostream>
#include "connect4/board.hpp"
#include "connect4/ui/player_game.hpp"

// Runs alternating-drop Connect 4 using Board::addDrop and Board::checkWin.
int main() {
    const int boardSize = 7;
    Board brd(boardSize, 2);

    const char players[2] = { 'X', 'O' };
    int turn = 0;

    std::cout << "Connect 4 (2 players). Four in a row wins.\n";
    std::cout << "Player 1: " << players[0] << ", Player 2: " << players[1] << "\n\n";

    while (true) {
        printBoard2D(brd, boardSize);
        char current = players[turn % 2];
        std::cout << "Player " << (turn % 2 + 1) << " (" << current << "), ";

        int col = readColumn(boardSize);
        bool placed = brd.addDrop({ col }, current);

        if (!placed) {
            std::cout << "That column is full. Pick another.\n";
            continue;
        }

        if (brd.checkWin(current)) {
            printBoard2D(brd, boardSize);
            std::cout << "Player " << (turn % 2 + 1) << " (" << current << ") wins!\n";
            break;
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
