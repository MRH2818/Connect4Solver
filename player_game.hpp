#pragma once
#include <iostream>
#include <limits>
#include <string>

#include "board.hpp"

// Renders the 2D board; lowest row (gravity bottom) is printed last before the column labels.
inline void printBoard2D(const Board& brd, int size) {
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
inline int readColumn(int size) {
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
