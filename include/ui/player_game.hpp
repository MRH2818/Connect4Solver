#pragma once
#include <iostream>
#include <limits>
#include <string>
#include <utility>

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

// Prints 3D board as layers along axis 1 (gravity); each layer is axis 0 (rows) by axis 2 (columns).
inline void printBoard3D(const Board& brd, int size) {
    const std::string cells = brd.toString();
    for (int layer = size - 1; layer >= 0; --layer) {
        std::cout << "--- Axis 1 = " << layer << " ---\n";
        for (int row = size - 1; row >= 0; --row) {
            std::cout << '|';
            for (int col = 0; col < size; ++col) {
                int idx = row + layer * size + col * size * size;
                char c = cells[static_cast<size_t>(idx)];
                std::cout << ' ' << c << " |";
            }
            std::cout << " " << row << '\n';
        }
        std::cout << '+';
        for (int col = 0; col < size; ++col) {
            std::cout << "---+";
        }
        std::cout << '\n';
        for (int col = 0; col < size; ++col) {
            std::cout << "  " << col << ' ';
        }
        std::cout << "  (axis 2)\n";
    }
    std::cout << "Rows: axis 0 (bottom row of each layer = 0).\n";
}

// Prompts until the user enters two coordinates in [0, size) for axes 0 and 2 (drop stacks along axis 1).
inline std::pair<int, int> readDropPlane(int size) {
    int axis0 = 0;
    int axis2 = 0;
    while (true) {
        std::cout << "Axis 0 (0-" << (size - 1) << "): ";
        if (!(std::cin >> axis0) || axis0 < 0 || axis0 >= size) {
            std::cin.clear();
            std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
            std::cout << "Invalid input. Enter an integer in range.\n";
            continue;
        }
        std::cout << "Axis 2 (0-" << (size - 1) << "): ";
        if (!(std::cin >> axis2) || axis2 < 0 || axis2 >= size) {
            std::cin.clear();
            std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
            std::cout << "Invalid input. Enter an integer in range.\n";
            continue;
        }
        return { axis0, axis2 };
    }
}
