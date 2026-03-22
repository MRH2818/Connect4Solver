#pragma once
#include <cmath>
#include <vector>
#include <algorithm>
#include <string>
#include <iostream>

const char EMPTY_CHAR = '_';

namespace BoardUtils {
    int pow(const int& a, const int& b) {
        if (b < 0) {
            std::cout << ("Exponent must be an integer greater than or equal to zero.\n");
            exit(1);
        }
        if (b <= 0) return 1;
        return a * pow(a, b-1);
    }
    std::vector<std::vector<int>> getAllDirections(int dimensions) {
        int total_vectors = (std::pow(3, dimensions) - 1) / 2;  // Pre-calculate the exact number of vectors to avoid dynamic reallocation
        std::vector<std::vector<int>> directions;
        directions.reserve(total_vectors);
    
        // Iterate over which axis will hold the FIRST non-zero value
        for (int first_nonzero = 0; first_nonzero < dimensions; ++first_nonzero) {
            
            // The remaining dimensions to the right can be any combination of -1, 0, or 1
            int remaining_dims = dimensions - 1 - first_nonzero;
            int combinations = std::pow(3, remaining_dims);
    
            for (int c = 0; c < combinations; ++c) {
                std::vector<int> dir(dimensions, 0); // Initialize with all 0s
                dir[first_nonzero] = 1; // Apply the Symmetry Breaking Rule
                int temp = c;
                for (int r = 0; r < remaining_dims; ++r) {  // Fill the remaining dimensions
                    dir[first_nonzero + 1 + r] = (temp % 3) - 1;  // Map base-3 remainders (0, 1, 2) to direction values (-1, 0, 1)
                    temp /= 3;
                }
                directions.push_back(dir);
            }
        }
        return directions;
    }
}

class Board {
    private:
    std::vector<char> board;
    int size;
    int dimensions;

    public:
    Board(int size, int dimensions=2) {
        if (dimensions < 2) {
            std::cout << "Dimensions must be at least 2\n";
            exit(5);
        }
        
        this->board = std::vector<char>(BoardUtils::pow(size, dimensions), EMPTY_CHAR);
        this->size = size;
        this->dimensions = dimensions;

        // for (uint8_t i = 0; i < board.size(); i++) {
        //     board[i] = i;
        // }
    }
    
    std::vector<int> indexToCoords(int index) const {
        std::vector<int> coords(dimensions);
        for (int i = 0; i < dimensions; i++) {
            coords[i] = index % size;
            index /= size;
        }
        return coords;
    }

    int coordsToIndex(const std::vector<int>& coords) const {
        if (coords.size() != this->dimensions) {
            std::cout << "Given coordinate size must equal number of dimensions";
            exit(4);
        }

        int index = 0;
        int mul = 1;
        for (int i = 0; i < dimensions; i++) {
            index += coords[i] * mul;
            mul *= size;
        }
        return index;
    }

    bool checkWin(char player, int lastPlacedIndex) const {
        
    }

    // Add drop. Piece falls along 2nd dimension. Returns false if dimension is full
    bool addDrop(const std::vector<int>& coords, char player) {
        if (coords.size() != dimensions-1) {
            std::cout << "Given coordinate size must equal number of dimensions-1";
            exit(3);
        }

        // 1. Find the base index of this "stack"
        // For coords = (1, 2), create baseCoords = (1, 0, 2)
        std::vector<int> baseCoords = { coords[0] };
        baseCoords.push_back(0); // gravity axis at index 1 set to 0
        baseCoords.insert(baseCoords.end(), coords.begin() + 1, coords.end());
        int currentIndex = coordsToIndex(baseCoords);

        // 3. Scan "upward" through the gravity axis
        for (int h = 0; h < size; ++h) {
            if (board[currentIndex] == EMPTY_CHAR) {
                this->board[currentIndex] = player;
                
                // Optional: Store this index to make checkWin() much faster!
                // this->lastPlacedIndex = currentIndex;
                
                return true;
            }
            currentIndex += this->size; // 2. The jump offset for the 2nd dimension is always 'size'
        }
        return false;
    }

    
    std::vector<char> getBoard() {
        return board;
    }

    std::string toString() const {
        return std::string(board.begin(), board.end());
    }
    bool isFull() const {
        return std::all_of(board.begin(), board.end(), [](char c) { return c != EMPTY_CHAR; });
    }
    bool isEmpty() const {
        return std::all_of(board.begin(), board.end(), [](char c) { return c == EMPTY_CHAR; });
    }
};


