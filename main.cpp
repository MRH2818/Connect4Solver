#include <iostream>
#include "board.hpp"

using namespace std;

int main() {
    // Write a function that tests the getAllDirections function
    std::vector<std::vector<int>> directions = BoardUtils::getAllDirections(4);
    for (const auto& direction : directions) {
        std::cout << "( ";
        for (const auto& value : direction) {
            std::cout << value << " ";
        }
        std::cout << ")" << std::endl;
    }


    return 0;
}

