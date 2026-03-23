#include <iostream>

#include "board.hpp"
#include "ui/player_game.hpp"

// Runs alternating-drop 3D Connect 4 using Board(boardSize, 3), addDrop({axis0, axis2}), checkWin.
int main() {
    const int boardSize = 7;
    Board brd(boardSize, 3);

    const char players[2] = { 'X', 'O' };
    int turn = 0;

    std::cout << "Connect 4 in 3D (2 players). Four in a row in any straight line wins.\n";
    std::cout << "Pieces stack along axis 1. Choose axis 0 and axis 2 for each drop.\n";
    std::cout << "Player 1: " << players[0] << ", Player 2: " << players[1] << "\n\n";

    while (true) {
        printBoard3D(brd, boardSize);
        char current = players[turn % 2];
        std::cout << "Player " << (turn % 2 + 1) << " (" << current << "), ";

        std::pair<int, int> plane = readDropPlane(boardSize);
        bool placed = brd.addDrop({ plane.first, plane.second }, current);

        if (!placed) {
            std::cout << "That column is full. Pick another axis 0 / axis 2 pair.\n";
            continue;
        }

        if (brd.checkWin(current)) {
            printBoard3D(brd, boardSize);
            std::cout << "Player " << (turn % 2 + 1) << " (" << current << ") wins!\n";
            break;
        }

        if (brd.isFull()) {
            printBoard3D(brd, boardSize);
            std::cout << "Board is full: draw.\n";
            break;
        }

        ++turn;
    }

    return 0;
}
