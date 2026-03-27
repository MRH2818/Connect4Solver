#pragma once

#include <array>
#include <string>
#include <vector>

#include "board.hpp"

namespace visualizer {

struct TokenInstance {
    std::array<float, 3> position { 0.0f, 0.0f, 0.0f };
    int state = 0;         // 0 empty, 1 player1, 2 player2
    int isWinningCell = 0; // 0/1
    float animT = 1.0f;    // [0,1], where 1 means settled
};

// Minimal phase-1 wrapper that maps Board cells to renderable token instances.
// This header intentionally avoids OpenGL/GLM includes so the current repo
// remains dependency-free; renderer code can adapt position[] into glm::vec3.
class ViewManager {
public:
    ViewManager(int boardSize, int dimensions)
        : m_boardSize(boardSize)
        , m_dimensions(dimensions)
        , m_instances(static_cast<size_t>(powInt(boardSize, dimensions))) {
    }

    [[nodiscard]] int boardSize() const { return m_boardSize; }
    [[nodiscard]] int dimensions() const { return m_dimensions; }

    // Rebuild all instance states from Board's flat string representation.
    void syncFromBoard(const Board& board) {
        const std::string cells = board.toString();
        const int cellCount = static_cast<int>(cells.size());
        for (int idx = 0; idx < cellCount; ++idx) {
            m_instances[static_cast<size_t>(idx)].position = indexToWorld(idx);
            m_instances[static_cast<size_t>(idx)].state = tokenToState(cells[static_cast<size_t>(idx)]);
            m_instances[static_cast<size_t>(idx)].isWinningCell = 0;
        }
    }

    // Marks winning positions for shader glow.
    void setWinningIndices(const std::vector<int>& indices) {
        for (TokenInstance& instance : m_instances) {
            instance.isWinningCell = 0;
        }
        for (int idx : indices) {
            if (idx >= 0 && idx < static_cast<int>(m_instances.size())) {
                m_instances[static_cast<size_t>(idx)].isWinningCell = 1;
            }
        }
    }

    [[nodiscard]] const std::vector<TokenInstance>& instances() const { return m_instances; }

private:
    static int powInt(int base, int exp) {
        int value = 1;
        for (int i = 0; i < exp; ++i) {
            value *= base;
        }
        return value;
    }

    // Converts flattened board index into centered world coordinates.
    // For 2D boards, z remains 0.
    [[nodiscard]] std::array<float, 3> indexToWorld(int index) const {
        std::array<int, 3> coord { 0, 0, 0 };
        int rem = index;
        for (int axis = 0; axis < m_dimensions && axis < 3; ++axis) {
            coord[axis] = rem % m_boardSize;
            rem /= m_boardSize;
        }

        const float center = static_cast<float>(m_boardSize - 1) * 0.5f;
        return {
            static_cast<float>(coord[0]) - center,
            static_cast<float>(coord[1]),
            static_cast<float>(coord[2]) - center,
        };
    }

    static int tokenToState(char token) {
        if (token == 'X') {
            return 1;
        }
        if (token == 'O') {
            return 2;
        }
        return 0;
    }

    int m_boardSize;
    int m_dimensions;
    std::vector<TokenInstance> m_instances;
};

} // namespace visualizer
