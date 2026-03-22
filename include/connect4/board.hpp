#pragma once
#include <cmath>
#include <string>
#include <vector>
#include <algorithm>
#include <iostream>

const char EMPTY_CHAR = '_';
namespace BoardUtils {
    int ipow(int a, int b) {
        if (b < 0) {
            std::cout << ("Exponent must be an integer greater than or equal to zero.\n");
            exit(1);
        }
        if (b <= 0) return 1;
        return a * ipow(a, b-1);
    }
    std::vector<std::vector<int>> getAllDirections(int dimensions) {
        int total_vectors = (ipow(3, dimensions) - 1) / 2;  // Pre-calculate the exact number of vectors to avoid dynamic reallocation
        std::vector<std::vector<int>> directions;
        directions.reserve(total_vectors);
    
        // Iterate over which axis will hold the FIRST non-zero value
        for (int first_nonzero = 0; first_nonzero < dimensions; ++first_nonzero) {
            
            // The remaining dimensions to the right can be any combination of -1, 0, or 1
            int remaining_dims = dimensions - 1 - first_nonzero;
            int combinations = ipow(3, remaining_dims);
    
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
    // Returns sum of given coordinates
    std::vector<int> addCoords(const std::vector<int>& coord1, const std::vector<int>& coord2) {
        std::vector<int> c3;
        for (int i = 0; i < coord1.size(); i++) {
            c3.push_back(coord1[i] + coord2[i]);
        }
        return c3;
    }
    // Returns coord1 - coord2
    std::vector<int> subtractCoords(const std::vector<int>& coord1, const std::vector<int>& coord2) {
        std::vector<int> c3;
        for (int i = 0; i < coord1.size(); i++) {
            c3.push_back(coord1[i] - coord2[i]);
        }
        return c3;
    }
}

class Board {
private:
    std::vector<char> board;
    int size;
    int dimensions;
    std::vector<std::vector<int>> _directions;

    int lastPlacedIndex;
    std::vector<int> lastPlacedCoords;
    bool _placedYet = false;

public:
    Board(int size, int dimensions=2) {
        if (dimensions < 2) {
            std::cout << "Dimensions must be at least 2\n";
            exit(5);
        }
        this->board = std::vector<char>(BoardUtils::ipow(size, dimensions), EMPTY_CHAR);
        this->size = size;
        this->dimensions = dimensions;
        this->_directions = BoardUtils::getAllDirections(dimensions);

        // for (uint8_t i = 0; i < board.size(); i++) {
        //     board[i] = i;
        // }
    }
    // Ensure that length_of_string is equal to size^dimensions. This constructor will not check.
    Board(const char* str, int size, int dimensions, size_t length_of_string, bool placedYet=true) {
        if (dimensions < 2) {
            std::cout << "Dimensions must be at least 2.\n";
            exit(5);
        }
        this->board = std::vector<char>(str, str + length_of_string);
        this->size = size;
        this->dimensions = dimensions;
        this->_directions = BoardUtils::getAllDirections(dimensions);
        this->_placedYet = placedYet;
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
            std::cout << "Given coordinate size must equal number of dimensions.\n";
            exit(4);
        }

        int index = 0;
        int mul = 1;
        for (int i = 0; i < dimensions; i++) {
            index += coords[i] * mul;
            mul *= this->size;
        }
        return index;
    }

    // last coords MUST match the lastPlacedIndex . This function will not check.
    bool checkWin(char player) const {
        if (!_placedYet) return false;
        for (const std::vector<int>& d : this->_directions) {
            int step = this->coordsToIndex(d);
            int f_steps = this->size, b_steps = size;
            for (int i = 0; i < dimensions; i++) {
                if (d[i] == 1) {
                    f_steps = std::min(f_steps, size - this->lastPlacedCoords[i]);
                }
                else if (d[i] == -1) {
                    b_steps = std::min(b_steps, this->lastPlacedCoords[i] + 1);
                }
            }

            int f = 0, fs = this->lastPlacedIndex;
            while (f < f_steps && this->board[fs]==player) {
                f++;
                fs += step;
            }
            int b = 0, bs = lastPlacedIndex;
            while (b < b_steps && this->board[bs]==player) {
                b++;
                bs -= step;
            }

            // Check streak distance...
            if (f + b - 1 >= 4) {
                return true; // A VICTORY!
            }

        }
        return false;
    }

    // Returns currentIndex if move is valid, -1 if it isn't:
    bool isValid(const std::vector<int>& coords) const {
        if (coords.size() != dimensions-1) {
            std::cout << "Given coordinate size must equal exactly " << dimensions-1 << " dimensions.\n";
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
                return currentIndex;
            }
            currentIndex += this->size; // 2. The jump offset for the 2nd dimension is always 'size'
        }
        return -1;
    }

    // Returns true if given coordinate is in the board.
    bool isInBoard(const std::vector<int>& coord) const {
        if (coord.size() != this->dimensions) return false;
        for (auto d : coord) {
            if (d < 0) return false;
            if (d >= this->size) return false;
        }
        return true;
    }

    // Add drop. Piece falls along 2nd dimension. Returns false if dimension is full.
    bool addDrop(const std::vector<int>& coords, char player) {
        if (coords.size() != dimensions-1) {
            std::cout << "Given coordinate size must equal exactly " << dimensions-1 << " dimensions.\n";
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
                
                // Store this index to make checkWin() faster.
                this->lastPlacedIndex = currentIndex;
                baseCoords[1] = h;
                this->lastPlacedCoords = baseCoords;
                this->_placedYet = true;

                return true;
            }
            currentIndex += this->size; // 2. The jump offset for the 2nd dimension is always 'size'
        }
        return false;
    }
    
    auto getDimensions() const {
        return this->dimensions;
    }
    auto getSize() const {
        return this->size;
    }
    std::vector<char> getBoard() const {
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
