# Connect4Solver

A header-only C++ playground for gravity-driven Connect Four variants, including classic 2D games, a 3D board, and two search agents that explore the same move generator through very different evaluation strategies.

## What's currently in the repo?

- **CLI 2D play**: human vs human, human vs random, human vs MaxN, and human vs Korf command-line programs.
- **CLI 3D play**: a two-player 7x7x7 variant where pieces still fall along a gravity axis.
- **Webapp**: GUI implementation of generalized 2d+3d game. Allows for multiplayer and 2d or 3d game, and bot parameter tuning.

Demo the **Webapp** here: *https://mrh2818.github.io/Connect4Solver/webapp/v1/*

## Agent architecture

`include/agent.hpp` abstract `Agent` interface focused on `chooseMove` function. The CLI apps create a concrete agent and pass in the latest opponent move data when needed.

- `src/agents/randagent.hpp`: samples uniformly from `Board::getAvailableMoves`.
- `src/agents/maxnagent.hpp`: runs a recursive MaxN-style search
- `src/agents/korfagent.hpp`: runs MaxN algorithm but implements shallow pruning as described by *Richard Korf's [Multi-player alpha beta pruning](https://www.sciencedirect.com/science/article/pii/000437029190082U)*
- `src/agents/korf_2.hpp`: runs KorfAgent algorithm with cache that saves board states
- `src/agents/korf2_iterative.hpp`: reimplements MaxN algorithm with shallow pruning and caching, but with an iterative depth-first search rather than recursive. Allows time limits and dynamic depth search. This agent is implemented in the Webapp.

## Webapp Requirements

- Browser with WebAssembly support.

## Building with Emscripten

Webapp V1 compiles the function of Korf2 Iterative into a JS WebAssembly handler through emscripten:
em++ src/emscripten_bindings/bindings.cpp -Iinclude -Isrc/agents -Isrc/emscripten_bindings -o webapp/v1/js/connect4_utils.js --bind -sALLOW_MEMORY_GROWTH
