/*
WASM CONNECTION HELPERS ---------------------------------------
*/

function waitForConnect4Module() {
    const m = globalThis.Module;
    if (!m) {
        return Promise.reject(
            new Error("connect4_utils.js must load before twoPlayerTest.js")
        );
    }
    if (m.calledRun) {
        return Promise.resolve(m);
    }
    return new Promise((resolve) => {
        const prev = m.onRuntimeInitialized;
        m.onRuntimeInitialized = () => {
            if (typeof prev === "function") prev();
            resolve(m);
        };
    });
}

// Embind passes C++ `char` as a JS number (ASCII code), not a one-character string.
function wasmChar(ch) {
    return typeof ch === "string" ? ch.charCodeAt(0) : ch;
}

// Embind creates a special pointer type for vectors
function makeVectorInt(wasm, values) {
    const vec = new wasm.VectorInt();
    values.forEach(v => vec.push_back(v));
    return vec;
}
function makeVectorChar(wasm, values) {
    const vec = new wasmVectorChar();
    values.forEach((v) => vec.push_back(wasmChar(v)));
    return vec;
}

// Block scope
(async function () {
    /*
        STATUS UPDATE       ---------------------------------------
    */
    const statusDiv = document.getElementById("statusUpdate");
    statusDiv.innerHTML = "INITIALIZING BOARD...";    
    statusDiv.innerHTML = "PREPARING GAME FIELD...";    

    const getStatusHTML = (playerIdx, isThinking = false) => {
        const p = players[playerIdx];
        const typeLabel = "";//p.isBot ? "AI" : "HUMAN";
        const action = isThinking ? "is calculating..." : "- WAITING FOR MOVE";
        const prefix = p.isBot ? "[KORFBOT]" : "[USER]";
        return `<small>${prefix}</small> <span style="color: ${playerColors[playerIdx]}; font-weight: bold; text-transform: uppercase;">Player ${p.num}</span>${typeLabel} ${action}`;
    };


    /*
        LOADING PARAMETERS  ---------------------------------------
    */
    // reads parameters
    // {"numDimensions":2,"boardSize":7,"players":[{"num":1,"type":"Human"},{"num":2,"type":"KorfBot"}, ...]}
    // 2dgame/twogame.html?config=eyJudW1EaW1lbnNpb25zIjoyLCJib2FyZFNpemUiOjcsInBsYXllcnMiOlt7Im51bSI6MSwidHlwZSI6Ikh1bWFuIn0seyJudW0iOjIsInR5cGUiOiJLb3JmQm90In1dfQ%3D%3D
    const params = new URLSearchParams(window.location.search);
    const configParam = params.get('config');
    let _NUM_DIMENSIONS;
    let _BOARD_SIZE;
    let _RANDOM_PLAYER_ORDER;
    let players;
    let AGENT_MAX_DEPTH = 15;
    let AGENT_THOUGHT_CAP_MS = 1000;
    let AGENT_MIN_DEPTH = 0;

    // Board UI look:
    const PIXEL_SIDE_LENGTH = 600;

    if (!configParam) {
        console.warn('handle2d: no `config` query parameter');
        // EVENTUALLY ADD VISUAL ERROR HANDLING
        return;
    }
    try {
        const config = decodeBASE64_URLtoOBJ(configParam);
        console.log('Retrieved set up!')
        console.log(config);

        // SET GLOBAL VARS
        _NUM_DIMENSIONS = 2;
        _BOARD_SIZE = config["boardSize"];
        players = config["players"];
        _RANDOM_PLAYER_ORDER = config["randomizePlayerOrder"];

        if (config["agentMaxDepth"]) AGENT_MAX_DEPTH = parseInt(config["agentMaxDepth"]);
        if (config["agentMaxTime"]) AGENT_THOUGHT_CAP_MS = parseFloat(config["agentMaxTime"]) * 1000;
        if (config["agentMinDepth"]) AGENT_MIN_DEPTH = parseInt(config["agentMinDepth"]);
    }
    catch (err) {
        console.error('handle2d: failed to decode config, go back', err);
        // EVENTUALLY ADD VISUAL ERROR HANDLING
        return;
    }
    
    /*
    INITIATING GAME     ---------------------------------------
    */
   
    // DEFINE AND DRAW BOARD
    let visualBoard = new DrawBoard2D(_BOARD_SIZE, PIXEL_SIDE_LENGTH);
    visualBoard.drawAllDots();

    // INITIALIZE LOOP VARIABLES
    let turn = 0; // Player that goes first is players[0]
    let lastMoves = []; // Col of last move, list of wasm vector int
    const moveHistory = []; // Chronological move list, each entry is { move: [col], playerIndex }
    const replayForwardMoves = []; // Replay stack for "Next Move", stores removed history entries.
    const wasm = await waitForConnect4Module(); // GET WASM SERVICE
    let wasmBoard = new wasm.Board(_BOARD_SIZE, 2);
    let gameOver = false;
    let isAnimatingDrop = false;
    let isBotThinking = false;

    let playerTokens = [];
    let playerColors = [];
    let botWorker = null;
    let botWorkerReqId = 1;
    const botWorkerPending = new Map();
    const undoMoveButton = document.getElementById("undoMoveButton");
    const nextMoveButton = document.getElementById("nextMoveButton");

    const botWorkerCall = (type, payload) => {
        if (!botWorker) return Promise.reject(new Error("Bot worker not initialized."));
        const id = botWorkerReqId++;
        return new Promise((resolve, reject) => {
            botWorkerPending.set(id, { resolve, reject });
            botWorker.postMessage({ id, type, ...payload });
        });
    };

    // Updates Undo/Next button availability from current game state.
    const syncActionButtons = () => {
        if (!undoMoveButton && !nextMoveButton) {
            return;
        }
        const hasHumanMoveToUndo = moveHistory.some((entry) => !players[entry.playerIndex].isBot);
        if (undoMoveButton) {
            undoMoveButton.disabled = (
                isAnimatingDrop ||
                isBotThinking ||
                lastMoves.length === 0 ||
                (hasAnyHumanPlayer && !hasHumanMoveToUndo)
            );
        }
        if (nextMoveButton) {
            nextMoveButton.disabled = (
                isAnimatingDrop ||
                // isBotThinking ||
                replayForwardMoves.length === 0
            );
        }
    };

    // DEFINE PLAYERS
    const allColors = ["red", "yellow", "orange", "green", "purple", "brown", "black", "maroon", "cyan", "pink", "gray", "magenta", "rgb(106, 84, 12)"]
    // IMPORTANT: build the full token list first so bots can see all opponents.
    for (let i = 0; i < players.length; i++) {
        // Player numbers are 1-based; map them to 'A', 'B', 'C', ...
        const tokenIdx = Math.max(0, (players[i].num ?? (i + 1)) - 1);
        playerTokens.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(tokenIdx));
        playerColors.push(allColors[i % allColors.length]);
    }

    if (_RANDOM_PLAYER_ORDER) {
        // Randomize player list:
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
            [playerTokens[i], playerTokens[j]] = [playerTokens[j], playerTokens[i]];
            [playerColors[i], playerColors[j]] = [playerColors[j], playerColors[i]];
        }
    }

    for (let i = 0; i < players.length; i++) {
        players[i].isBot = players[i].type === "KorfBot";
        console.log(players[i]);
    }
    const hasAnyHumanPlayer = players.some((player) => !player.isBot);

    if (players.some(p => p.isBot)) {
        botWorker = new Worker("../js/korfbot_worker.js");
        botWorker.onmessage = (e) => {
            const msg = e.data || {};
            const pending = botWorkerPending.get(msg.id);
            if (!pending) return;
            botWorkerPending.delete(msg.id);
            if (msg.ok) pending.resolve(msg.result);
            else pending.reject(new Error(msg.error || "Worker error."));
        };
        botWorker.onerror = (e) => {
            console.error("KorfBot worker crashed", e);
        };
        
        let dots = 0;
        const loadingInterval = setInterval(() => {
            dots = (dots + 1) % 4;
            statusDiv.innerHTML = `AWAKENING KORFBOT AI${'.'.repeat(dots)}`;
        }, 300);

        await botWorkerCall("reset", { boardSize: _BOARD_SIZE, numDimensions: 2, players: players.map(p => ({ num: p.num, type: p.type })), playerTokens, agentMaxDepth: AGENT_MAX_DEPTH, agentThoughtCapMs: AGENT_THOUGHT_CAP_MS, agentMinDepth: AGENT_MIN_DEPTH });
        
        clearInterval(loadingInterval);
    }

    // Finds where the next piece would land in a given column.
    const landingRowForColumn = (col) => {
        if (!Number.isInteger(col) || col < 0 || col >= _BOARD_SIZE) {
            return null;
        }

        const empty = wasmChar("_");
        for (let row = 0; row < _BOARD_SIZE; row++) {
            const coords = makeVectorInt(wasm, [col, row]);
            const idx = wasmBoard.coordsToIndex(coords);
            coords.delete?.();
            if (wasmBoard.getCell(idx) === empty) {
                return row;
            }
        }

        return null;
    };

    // Applies a finalized move and waits for board animation before advancing.
    const finalizeMove = async (col, playerIndex) => {
        const targetDraw = visualBoard.boardCoordsToVisualCoords(col, wasmBoard.getLastMoveHeight());
        isAnimatingDrop = true;
        syncActionButtons();
        try {
            await visualBoard.addDrop(targetDraw[0], targetDraw[1], playerColors[playerIndex], true);
        } finally {
            isAnimatingDrop = false;
            syncActionButtons();
        }
    };

    // Rebuilds bot-worker board state from current move history.
    const rebuildWorkerState = async () => {
        if (!botWorker) {
            return;
        }
        await botWorkerCall("reset", { boardSize: _BOARD_SIZE, numDimensions: 2, players: players.map(p => ({ num: p.num, type: p.type })), playerTokens, agentMaxDepth: AGENT_MAX_DEPTH, agentThoughtCapMs: AGENT_THOUGHT_CAP_MS, agentMinDepth: AGENT_MIN_DEPTH });
        for (let i = 0; i < moveHistory.length; i++) {
            const tokenIndex = moveHistory[i].playerIndex;
            await botWorkerCall("applyMove", { move: moveHistory[i].move, token: playerTokens[tokenIndex] });
        }
    };

    // Recreates wasm and visual boards from current move history.
    const rebuildBoardsFromHistory = async () => {
        const nextBoard = new wasm.Board(_BOARD_SIZE, 2);
        visualBoard.clearPlacedDrops();

        for (let i = 0; i < moveHistory.length; i++) {
            const moveArr = moveHistory[i].move;
            const playerIndex = moveHistory[i].playerIndex;
            const moveVec = makeVectorInt(wasm, moveArr);
            const placed = nextBoard.addDrop(moveVec, wasmChar(playerTokens[playerIndex]));
            moveVec.delete?.();
            if (!placed) {
                throw new Error("Failed to rebuild move history.");
            }

            const [x, y] = visualBoard.boardCoordsToVisualCoords(moveArr[0], nextBoard.getLastMoveHeight());
            await visualBoard.addDrop(x, y, playerColors[playerIndex], false);
        }

        wasmBoard.delete?.();
        wasmBoard = nextBoard;
    };

    // Undoes the previous move and resynchronizes board and bot state.
    const undoLastMove = async () => {
        if (lastMoves.length === 0 || isAnimatingDrop || isBotThinking) {
            return;
        }

        if (hasAnyHumanPlayer && !moveHistory.some((entry) => !players[entry.playerIndex].isBot)) {
            return;
        }

        let removedTargetMove = false;
        while (moveHistory.length > 0 && !removedTargetMove) {
            const undoneMove = lastMoves.pop();
            undoneMove?.delete?.();
            const removedEntry = moveHistory.pop();
            if (gameOver) {
                // turn = (turn - 1) % players.length;
                removedTargetMove = true;
                gameOver = true;
                statusDiv.innerHTML = getStatusHTML(turn);
                syncActionButtons();

                if (removedEntry) {
                    replayForwardMoves.push(removedEntry);
                }
                break;
            }
            else {
                turn = (turn - 1 + players.length) % players.length;
            }
            if (!removedEntry) {
                break;
            }
            
            replayForwardMoves.push(removedEntry);

            if (!hasAnyHumanPlayer || !players[removedEntry.playerIndex].isBot) {
                removedTargetMove = true;
            }
        }

        if (!removedTargetMove) {
            return;
        }

        await rebuildBoardsFromHistory();
        gameOver = false;
        statusDiv.innerHTML = getStatusHTML(turn);

        try {
            await rebuildWorkerState();
        } catch (err) {
            console.error("Worker resync failed after undo", err);
            statusDiv.innerHTML = "Internal error: failed to resync after undo.";
            gameOver = true;
        }

        syncActionButtons();
    };

    // Replays one previously undone move from history.
    const nextReplayMove = async () => {
        if (replayForwardMoves.length === 0 || isAnimatingDrop || isBotThinking) {
            return;
        }

        const replayEntry = replayForwardMoves.pop();
        if (!replayEntry) {
            return;
        }

        turn = replayEntry.playerIndex;
        const moveArr = replayEntry.move;
        const replayVec = makeVectorInt(wasm, moveArr);
        const placed = wasmBoard.addDrop(replayVec, wasmChar(playerTokens[turn]));
        if (!placed) {
            replayVec.delete?.();
            statusDiv.innerHTML = "Internal error: failed to replay move.";
            gameOver = true;
            syncActionButtons();
            return;
        }

        lastMoves.push(replayVec);
        moveHistory.push(replayEntry);
        await finalizeMove(moveArr[0], turn);

        if (wasmBoard.checkWin(wasmChar(playerTokens[turn]))) {
            statusDiv.innerHTML = `<span style="color: ${playerColors[turn]}; font-weight: bold; text-transform: uppercase;">Player ${players[turn].num} WINS!</span>`;
            gameOver = true;
        } else if (wasmBoard.isFull()) {
            statusDiv.innerHTML = "<strong>STALEMATE - IT'S A DRAW!</strong>";
            gameOver = true;
        } else {
            gameOver = false;
            turn = (turn + 1) % players.length;
            statusDiv.innerHTML = getStatusHTML(turn);
        }

        try {
            await rebuildWorkerState();
        } catch (err) {
            console.error("Worker resync failed after next move", err);
            statusDiv.innerHTML = "Internal error: failed to resync after replay move.";
            gameOver = true;
        }
        syncActionButtons();
    };

    // DEFINE BOT thinking method:
    const botThink = async () => {
        if (gameOver || !players[turn].isBot) {
            console.error("Function should not have been called.");
            return "";
        }
        isBotThinking = true;
        syncActionButtons();

        const recentOppMoves = lastMoves.slice(Math.max(0, lastMoves.length - (players.length - 1))).map(v => {
            const out = [];
            for (let i = 0; i < v.size(); i++) out.push(v.get(i));
            return out;
        });

        try {
            const thinkResult = await botWorkerCall("think", { turn, recentOppMoves, isFirstMove: lastMoves.length === 0 });

            if (thinkResult && Number.isInteger(thinkResult.depth)) console.log("Depth searched:", thinkResult.depth);
            if (thinkResult && Array.isArray(thinkResult.evals)) {
                thinkResult.evals.forEach((ev) => {
                    console.log(`Token ${ev.token} eval: ${ev.value}`);
                });
            }

            // DEFENSIVE: if agent returns an illegal move (shouldn't happen), make a console error
            let placed = false;
            const moveArr = thinkResult && Array.isArray(thinkResult.move) ? thinkResult.move : [];
            if (moveArr.length > 0) {
                const move = makeVectorInt(wasm, moveArr);
                placed = wasmBoard.addDrop(move, wasmChar(playerTokens[turn]));
                if (placed) {
                    lastMoves.push(move);
                    moveHistory.push({ move: moveArr.slice(), playerIndex: turn });
                    replayForwardMoves.length = 0;
                } else {
                    move.delete?.();
                }
            }
            if (!placed) {
                console.error("Invalid move attempted");
                statusDiv.innerHTML = "Internal error: bot produced no legal moves.";
                gameOver = true;
                return;
            }

            const col = moveArr[0];

            // VERIFY MOVE
            if (wasmBoard.checkWin(wasmChar(playerTokens[turn]))) {
                statusDiv.innerHTML = `<span style="color: ${playerColors[turn]}; font-weight: bold; text-transform: uppercase;">Player ${players[turn].num} WINS!</span>`;
                gameOver = true;
            } else if (wasmBoard.isFull()) {
                statusDiv.innerHTML = "<strong>STALEMATE - IT'S A DRAW!</strong>";
                gameOver = true;
            }

            // DRAW MOVE
            await finalizeMove(col, turn);
            if (botWorker) {
                try { await botWorkerCall("applyMove", { move: moveArr, token: playerTokens[turn] }); } catch (err) { console.error("AI sync failed", err); }
            }

            if (!gameOver) {
                turn = (turn + 1) % players.length;
                statusDiv.innerHTML = getStatusHTML(turn);

                if (players[turn].isBot) {
                    statusDiv.innerHTML += "<br>Thinking...";
                    setTimeout(() => { botThink(); }, 0);
                }
            }
        } catch (err) {
            console.error("Bot think failed", err);
            statusDiv.innerHTML = "Internal error: bot worker failed.";
            gameOver = true;
        } finally {
            isBotThinking = false;
            syncActionButtons();
        }
    }

    // DEFINE onClick function:
    const onClick = async (e) => {
        if (gameOver) {
            return "";
        }
        if (isAnimatingDrop) {
            return;
        }
        if (players[turn].isBot) {
            statusDiv.innerHTML = `INPUT BLOCKED: ${getStatusHTML(turn, true)}`;
            return;
        }

        const col = Math.floor(e.offsetX / (PIXEL_SIDE_LENGTH / _BOARD_SIZE));

        const vi = makeVectorInt(wasm, [col]);
        const placed = wasmBoard.addDrop(vi, wasmChar(playerTokens[turn]));
        if (!placed) {
            vi.delete?.();
            statusDiv.innerHTML = `INVALID COMMAND: Column full. Pick another.<br>${getStatusHTML(turn)}`;
            return;
        }
        // MAKE SURE THAT IT DRAWS AFTER WIN OR DRAW
        if (wasmBoard.checkWin(wasmChar(playerTokens[turn]))) {
            statusDiv.innerHTML = `<span style="color: ${playerColors[turn]}; font-weight: bold; text-transform: uppercase;">Player ${players[turn].num} WINS!</span>`;
            gameOver = true;
        } else if (wasmBoard.isFull()) {
            statusDiv.innerHTML = "<strong>STALEMATE - IT'S A DRAW!</strong>";
            gameOver = true;
        }

        // REGISTER LOCATION OF CLICK
        lastMoves.push(vi);
        moveHistory.push({ move: [col], playerIndex: turn });
        replayForwardMoves.length = 0;
        if (botWorker) {
            botWorkerCall("applyMove", { move: [col], token: playerTokens[turn] }).catch((err) => console.error("Worker sync failed", err));
        }
        // DRAW PIECE
        try {
            await finalizeMove(col, turn);
        } catch (err) {
            console.error("Drop animation failed", err);
            return;
        }

        if (!gameOver) {
            turn = (turn + 1) % players.length;
            statusDiv.innerHTML = getStatusHTML(turn);

            if (players[turn].isBot) {
                statusDiv.innerHTML += "<br>Thinking...";
                setTimeout(() => { botThink(); }, 0);
            }
        }
        syncActionButtons();
    }

    // TRIGGER GAME NOW
    statusDiv.innerHTML = getStatusHTML(turn);

    if (players[turn].isBot) {
        statusDiv.innerHTML = getStatusHTML(turn, true);
        setTimeout(() => { botThink(); }, 0);
    }
    syncActionButtons();

    if (undoMoveButton) {
        undoMoveButton.addEventListener("click", () => {
            undoLastMove().catch((err) => {
                console.error("Undo failed", err);
                statusDiv.innerHTML = "Internal error: failed to undo move.";
                gameOver = true;
                syncActionButtons();
            });
        });
    }

    if (nextMoveButton) {
        nextMoveButton.addEventListener("click", () => {
            nextReplayMove().catch((err) => {
                console.error("Next move replay failed", err);
                statusDiv.innerHTML = "Internal error: failed to replay move.";
                gameOver = true;
                syncActionButtons();
            });
        });
    }

    visualBoard.setOnClickHandler((e) => {
        onClick(e);
    });

    // Shows a subtle preview piece at the top of the hovered column.
    visualBoard.canvas.addEventListener("mousemove", (e) => {
        if (gameOver || players[turn].isBot) {
            visualBoard.clearHoverPreview();
            return;
        }

        const col = visualBoard.getColumnFromOffsetX(e.offsetX);
        const row = landingRowForColumn(col);
        if (row == null) {
            visualBoard.clearHoverPreview();
            return;
        }

        visualBoard.setHoverPreview(col, row, playerColors[turn]);
    });

    visualBoard.canvas.addEventListener("mouseleave", () => {
        visualBoard.clearHoverPreview();
    });


})();
