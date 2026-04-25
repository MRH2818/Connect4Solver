/*
WASM CONNECTION HELPERS ---------------------------------------
*/

function waitForConnect4Module() {
    const m = globalThis.Module;
    if (!m) {
        return Promise.reject(
            new Error("connect4_utils.js must load before handle3d.js")
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
    values.forEach((v) => vec.push_back(v));
    return vec;
}

function makeVectorChar(wasm, values) {
    const vec = new wasm.VectorChar();
    values.forEach((v) => vec.push_back(wasmChar(v)));
    return vec;
}

(async function () {
    const statusDiv = document.getElementById("statusUpdate");
    statusDiv.innerHTML = "Loading 3D board...";

    const params = new URLSearchParams(window.location.search);
    const configParam = params.get("config");

    if (!configParam) {
        statusDiv.innerHTML = "Missing game config. Please go back and start a game.";
        console.warn("handle3d: no `config` query parameter");
        return;
    }

    let boardSize;
    let players;
    let _RANDOM_PLAYER_ORDER;

    try {
        const config = decodeBASE64_URLtoOBJ(configParam);
        boardSize = config.boardSize;
        players = config.players;
        _RANDOM_PLAYER_ORDER = config.randomizePlayerOrder;

        if (!Number.isInteger(boardSize) || boardSize <= 0 || !Array.isArray(players) || players.length === 0) {
            throw new Error("Invalid config values.");
        }
    } catch (err) {
        console.error("handle3d: failed to decode config", err);
        statusDiv.innerHTML = "Invalid game config. Please go back and try again.";
        return;
    }

    if (typeof window.ensureThreeLoaded !== "function") {
        statusDiv.innerHTML = "3D renderer failed to load.";
        console.error("handle3d: ensureThreeLoaded is not available");
        return;
    }

    await window.ensureThreeLoaded();

    const wasm = await waitForConnect4Module();
    const wasmBoard = new wasm.Board(boardSize, 3);

    const visualBoard = new DrawBoard3D(boardSize);
    window.visualBoard = visualBoard; /* FOR DEBUGGING THROUGH CONSOLE */

    visualBoard.drawAllDots();

    const landingYForColumn = (x, z) => {
        const empty = wasmChar("_");
        const size = wasmBoard.getSize();
        for (let y = 0; y < size; y++) {
            const coords = makeVectorInt(wasm, [x, y, z]);
            const idx = wasmBoard.coordsToIndex(coords);
            coords.delete?.();
            if (wasmBoard.getCell(idx) === empty) {
                return y;
            }
        }
        return null;
    };
    visualBoard.setLandingHeightResolver(landingYForColumn);

    // Agent thinking settings:
    const AGENT_MAX_DEPTH = 15;
    const AGENT_THOUGHT_CAP_MS = 1000;

    let turn = 0;
    let gameOver = false;
    const lastMoves = [];

    let botWorker = null;
    let botWorkerReqId = 1;
    const botWorkerPending = new Map();

    const botWorkerCall = (type, payload) => {
        if (!botWorker) return Promise.reject(new Error("Bot worker not initialized."));
        const id = botWorkerReqId++;
        return new Promise((resolve, reject) => {
            botWorkerPending.set(id, { resolve, reject });
            botWorker.postMessage({ id, type, ...payload });
        });
    };

    const allColors = ["red", "yellow", "orange", "green", "purple", "brown", "black", "maroon", "cyan", "pink", "gray", "magenta", "rgb(106, 84, 12)"];
    const playerTokens = [];
    const playerColors = [];

    for (let i = 0; i < players.length; i++) {
        const tokenIdx = Math.max(0, (players[i].num ?? (i + 1)) - 1);
        playerTokens.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(tokenIdx));
        playerColors.push(allColors[i % allColors.length]);
    }

    for (let i = 0; i < players.length; i++) {
        players[i].isBot = players[i].type === "KorfBot";
    }

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
        await botWorkerCall("reset", { boardSize, numDimensions: 3, players: players.map(p => ({ num: p.num, type: p.type })), playerTokens, agentMaxDepth: AGENT_MAX_DEPTH, agentThoughtCapMs: AGENT_THOUGHT_CAP_MS, agentBranching: 4 });
    }

    visualBoard.enableHover = false;
    players.forEach(p => {
        if (!visualBoard.enableHover && !p.isBot) {
            visualBoard.enableHover = true;
        }
    })

    const updateTurnStatus = () => {
        statusDiv.innerHTML = `Player ${players[turn].num}'s turn: (${(players[turn].type || "Human").toUpperCase()}).`;
    };

    const finishTurnOrEnd = () => {
        if (wasmBoard.checkWin(wasmChar(playerTokens[turn]))) {
            statusDiv.innerHTML = `Player ${players[turn].num} wins!`;
            gameOver = true;
            visualBoard.enableHover = false;
            return;
        }

        if (wasmBoard.isFull()) {
            statusDiv.innerHTML = "Game is a draw!";
            gameOver = true;
            visualBoard.enableHover = false;
            return;
        }

        turn = (turn + 1) % players.length;
        updateTurnStatus();
        if (players[turn].isBot) {
            statusDiv.innerHTML += "<br>Thinking...";
            setTimeout(() => { botThink(); }, 0);
        }
    };

    const botThink = async () => {
        if (gameOver || !players[turn].isBot) {
            return;
        }

        const recentOppMoves = lastMoves.slice(Math.max(0, lastMoves.length - (players.length - 1))).map(v => {
            const out = [];
            for (let i = 0; i < v.size(); i++) out.push(v.get(i));
            return out;
        });

        let thinkResult = null;
        try {
            thinkResult = await botWorkerCall("think", { turn, recentOppMoves, isFirstMove: lastMoves.length === 0 });
        } catch (err) {
            console.error("Bot think failed", err);
            statusDiv.innerHTML = "Internal error: bot worker failed.";
            gameOver = true;
            visualBoard.enableHover = false;
            return;
        }

        if (thinkResult && Number.isInteger(thinkResult.depth)) console.log("Depth searched:", thinkResult.depth);
        if (thinkResult && Array.isArray(thinkResult.evals)) {
            thinkResult.evals.forEach((ev) => {
                console.log(`Token ${ev.token} eval: ${ev.value}`);
            });
        }

        let placed = false;
        const moveArr = thinkResult && Array.isArray(thinkResult.move) ? thinkResult.move : [];
        if (moveArr.length > 0) {
            const move = makeVectorInt(wasm, moveArr);
            placed = wasmBoard.addDrop(move, wasmChar(playerTokens[turn]));
            if (placed) lastMoves.push(move);
            else move.delete?.();
        }
        if (!placed) {
            statusDiv.innerHTML = "Internal error: bot produced no legal moves.";
            gameOver = true;
            visualBoard.enableHover = false;
            return;
        }

        const x = moveArr[0];
        const z = moveArr[1];
        const y = wasmBoard.getLastMoveHeight();
        visualBoard.addDrop(x, y, z, playerColors[turn]);
        if (botWorker) {
            try { await botWorkerCall("applyMove", { move: moveArr, token: playerTokens[turn] }); } catch (err) { console.error("Worker sync failed", err); }
        }

        finishTurnOrEnd();
    };

    const handleMoveAt = (x, z) => {
        if (gameOver) {
            visualBoard.enableHover = false;
            return;
        }
        if (players[turn].isBot) {
            statusDiv.innerHTML = `Player ${players[turn].num}'s turn: (${players[turn].type.toUpperCase()}).<br>Wait! The bot is thinking!`;
            return;
        }

        const move = makeVectorInt(wasm, [x, z]);
        const placed = wasmBoard.addDrop(move, wasmChar(playerTokens[turn]));

        if (!placed) {
            move.delete?.();
            statusDiv.innerHTML = `Player ${players[turn].num}'s turn: (${(players[turn].type || "Human").toUpperCase()}).<br>Invalid move: that stack is full.`;
            return;
        }

        const y = wasmBoard.getLastMoveHeight();
        visualBoard.addDrop(x, y, z, playerColors[turn]);
        lastMoves.push(move);
        if (botWorker) {
            botWorkerCall("applyMove", { move: [x, z], token: playerTokens[turn] }).catch((err) => console.error("Worker sync failed", err));
        }
        finishTurnOrEnd();
    };

    if (_RANDOM_PLAYER_ORDER) {
        // Randomize player list:
        for (let i = players.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [players[i], players[j]] = [players[j], players[i]];
            [playerTokens[i], playerTokens[j]] = [playerTokens[j], playerTokens[i]];
            [playerColors[i], playerColors[j]] = [playerColors[j], playerColors[i]];
        }
    }
    
    visualBoard.setOnHoverHandler(() => {});

    visualBoard.setOnClickHandler(({ dropCoords }) => {
        if (!dropCoords) {
            return;
        }

        const [x, z] = dropCoords;
        handleMoveAt(x, z);
    });

    updateTurnStatus();
    if (players[turn].isBot) {
        statusDiv.innerHTML += "<br>Thinking...";
        setTimeout(() => { botThink(); }, 0);
    }
})();
