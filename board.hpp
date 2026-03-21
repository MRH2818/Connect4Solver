#pragma once
#include <cmath>
#include <vector>
#include <algorithm>


const char EMPTY_CHAR = '_';

namespace BoardUtils {
    std::vector<std::vector<int>> getAllDirections(int dimensions) {
        // Pre-calculate the exact number of vectors to avoid dynamic reallocation
        int total_vectors = (std::pow(3, dimensions) - 1) / 2;
        
        std::vector<std::vector<int>> directions;
        directions.reserve(total_vectors);
    
        // Iterate over which axis will hold the FIRST non-zero value
        for (int first_nonzero = 0; first_nonzero < dimensions; ++first_nonzero) {
            
            // The remaining dimensions to the right can be any combination of -1, 0, or 1
            int remaining_dims = dimensions - 1 - first_nonzero;
            int combinations = std::pow(3, remaining_dims);
    
            for (int c = 0; c < combinations; ++c) {
                std::vector<int> dir(dimensions, 0); // Initialize with all 0s
                
                // Apply the Symmetry Breaking Rule
                dir[first_nonzero] = 1; 
    
                // Fill the remaining dimensions using base-3 logic
                int temp = c;
                for (int r = 0; r < remaining_dims; ++r) {
                    // Map base-3 remainders (0, 1, 2) to direction values (-1, 0, 1)
                    dir[first_nonzero + 1 + r] = (temp % 3) - 1;
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
            throw std::invalid_argument("Dimensions must be at least 2");
        }
        
        this->board = std::vector<char>(std::pow(size, dimensions), EMPTY_CHAR);
        this->size = size;
        this->dimensions = dimensions;
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
        int index = 0;
        int mul = 1;
        for (int i = 0; i < dimensions; i++) {
            index += coords[i] * mul;
            mul *= size;
        }
        return index;
    }

    bool checkWin(char player) const {
        
    }
    
    operator const char*() const {
        return board.data();
    }
    bool isFull() const {
        return std::all_of(board.begin(), board.end(), [](char c) { return c != EMPTY_CHAR; });
    }
    bool isEmpty() const {
        return std::all_of(board.begin(), board.end(), [](char c) { return c == EMPTY_CHAR; });
    }
};


