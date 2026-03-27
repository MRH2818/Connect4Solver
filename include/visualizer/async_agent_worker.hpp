#pragma once

#include <chrono>
#include <future>
#include <vector>

#include "agent.hpp"
#include "board.hpp"

namespace visualizer {

class AsyncAgentWorker {
public:
    AsyncAgentWorker() = default;

    void start(Agent& agent, const Board& boardSnapshot, std::vector<std::vector<int>> oppLastMoves, bool firstMove = false) {
        m_moveFuture = std::async(std::launch::async, [&agent, boardSnapshot, oppLastMoves, firstMove] {
            return agent.chooseMove(boardSnapshot, oppLastMoves, firstMove);
        });
    }

    [[nodiscard]] bool running() const {
        if (!m_moveFuture.valid()) {
            return false;
        }
        return m_moveFuture.wait_for(std::chrono::seconds(0)) != std::future_status::ready;
    }

    [[nodiscard]] bool ready() const {
        if (!m_moveFuture.valid()) {
            return false;
        }
        return m_moveFuture.wait_for(std::chrono::seconds(0)) == std::future_status::ready;
    }

    std::vector<int> consumeMove() {
        return m_moveFuture.get();
    }

private:
    std::future<std::vector<int>> m_moveFuture;
};

} // namespace visualizer
