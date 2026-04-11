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

    try {
        const config = decodeBASE64_URLtoOBJ(configParam);
        boardSize = config.boardSize;
        players = config.players;

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
    visualBoard.drawAllDots();

    let turn = 0;
    let gameOver = false;
    const lastMoves = [];

    const allColors = ["red", "yellow", "orange", "green", "purple", "brown", "black", "maroon", "cyan", "pink", "gray", "rgb(106, 84, 12)"];
    const playerTokens = [];
    const playerColors = [];

    for (let i = 0; i < players.length; i++) {
        const tokenIdx = Math.max(0, (players[i].num ?? (i + 1)) - 1);
        playerTokens.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(tokenIdx));
        playerColors.push(allColors[i % allColors.length]);
    }

    // Keep helper in active use to mirror 2D shape and embind type expectation.
    makeVectorChar(wasm, playerTokens).delete?.();

    const updateTurnStatus = () => {
        statusDiv.innerHTML = `Player ${players[turn].num}'s turn: (${(players[turn].type || "Human").toUpperCase()}).`;
    };

    const handleMoveAt = (x, z) => {
        if (gameOver) {
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

        if (wasmBoard.checkWin(wasmChar(playerTokens[turn]))) {
            statusDiv.innerHTML = `Player ${players[turn].num} wins!`;
            gameOver = true;
            return;
        }

        if (wasmBoard.isFull()) {
            statusDiv.innerHTML = "Game is a draw!";
            gameOver = true;
            return;
        }

        turn = (turn + 1) % players.length;
        updateTurnStatus();
    };

    visualBoard.setOnClickHandler(({ dropCoords }) => {
        if (!dropCoords) {
            return;
        }

        const [x, z] = dropCoords;
        handleMoveAt(x, z);
    });

    updateTurnStatus();
})();

