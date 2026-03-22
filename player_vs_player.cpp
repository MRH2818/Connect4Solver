#include <iostream>
#include <limits>
#include "board.hpp"

// Renders the 2D board; lowest row (gravity bottom) is printed last before the column labels.
void printBoard(const Board& brd, int size) {
    const std::string cells = brd.toString();
    for (int row = size - 1; row >= 0; --row) {
        std::cout << '|';
        for (int col = 0; col < size; ++col) {
            char c = cells[static_cast<size_t>(col + row * size)];
            std::cout << ' ' << c << " |";
        }
        std::cout << '\n';
    }
    std::cout << '+';
    for (int col = 0; col < size; ++col) {
        std::cout << "---+";
    }
    std::cout << '\n';
    for (int col = 0; col < size; ++col) {
        std::cout << "  " << col << ' ';
    }
    std::cout << '\n';
}

// Prompts until the user enters an integer column in [0, size).
int readColumn(int size) {
    int col = 0;
    while (true) {
        std::cout << "Column (0-" << (size - 1) << "): ";
        if (std::cin >> col && col >= 0 && col < size) {
            return col;
        }
        std::cin.clear();
        std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
        std::cout << "Invalid input. Enter an integer column.\n";
    }
}

// Runs alternating-drop Connect 4 using Board::addDrop and Board::checkWin.
int main() {
    const int boardSize = 7;
    Board brd(boardSize, 2);

    const char players[2] = { 'X', 'O' };
    int turn = 0;

    std::cout << "Connect 4 (2 players). Four in a row wins.\n";
    std::cout << "Player 1: " << players[0] << ", Player 2: " << players[1] << "\n\n";

    while (true) {
        printBoard(brd, boardSize);
        char current = players[turn % 2];
        std::cout << "Player " << (turn % 2 + 1) << " (" << current << "), ";

        int col = readColumn(boardSize);
        bool placed = brd.addDrop({ col }, current);

        if (!placed) {
            std::cout << "That column is full. Pick another.\n";
            continue;
        }

        if (brd.checkWin(current)) {
            printBoard(brd, boardSize);
            std::cout << "Player " << (turn % 2 + 1) << " (" << current << ") wins!\n";
            break;
        }

        if (brd.isFull()) {
            printBoard(brd, boardSize);
            std::cout << "Board is full: draw.\n";
            break;
        }

        ++turn;
    }

    return 0;
}
