/* Shared KorfBot Web Worker for 2D + 3D games. */

function waitForConnect4Module() {
    const m = globalThis.Module;
    if (!m) return Promise.reject(new Error("connect4_utils.js must load before korfbot_worker.js"));
    if (m.calledRun) return Promise.resolve(m);
    return new Promise((resolve) => {
        const prev = m.onRuntimeInitialized;
        m.onRuntimeInitialized = () => {
            if (typeof prev === "function") prev();
            resolve(m);
        };
    });
}

function wasmChar(ch) {
    return typeof ch === "string" ? ch.charCodeAt(0) : ch;
}

function makeVectorInt(wasm, values) {
    const vec = new wasm.VectorInt();
    for (let i = 0; i < values.length; i++) vec.push_back(values[i]);
    return vec;
}

function makeVectorChar(wasm, values) {
    const vec = new wasm.VectorChar();
    for (let i = 0; i < values.length; i++) vec.push_back(wasmChar(values[i]));
    return vec;
}

function makeVectorVectorInt(wasm, moves) {
    const vec = new wasm.VectorVectorInt();
    for (let i = 0; i < moves.length; i++) vec.push_back(makeVectorInt(wasm, moves[i]));
    return vec;
}

let wasm = null;
let wasmBoard = null;
let players = null;
let playerTokens = null;
let moveCount = 0;

let initPromise = null;

async function ensureInit() {
    if (initPromise) return initPromise;
    initPromise = (async () => {
        globalThis.Module = globalThis.Module || {};
        importScripts("../js/connect4_utils.js");
        wasm = await waitForConnect4Module();
        return wasm;
    })();
    return initPromise;
}

async function handleReset(msg) {
    await ensureInit();

    const boardSize = msg.boardSize;
    const numDimensions = msg.numDimensions;
    const agentMaxDepth = msg.agentMaxDepth;
    const agentThoughtCapMs = msg.agentThoughtCapMs;
    const agentBranching = msg.agentBranching;
    const cfgPlayers = msg.players;
    const cfgTokens = msg.playerTokens;

    if (!Number.isInteger(boardSize) || boardSize <= 0) throw new Error("Invalid boardSize.");
    if (numDimensions !== 2 && numDimensions !== 3) throw new Error("Invalid numDimensions.");
    if (!Array.isArray(cfgPlayers) || cfgPlayers.length === 0) throw new Error("Invalid players.");
    if (!Array.isArray(cfgTokens) || cfgTokens.length !== cfgPlayers.length) throw new Error("Invalid playerTokens.");

    if (wasmBoard && wasmBoard.delete) wasmBoard.delete();
    wasmBoard = new wasm.Board(boardSize, numDimensions);
    moveCount = 0;

    playerTokens = cfgTokens.slice();
    players = cfgPlayers.map((p) => ({ num: p.num, type: p.type, isBot: p.type === "KorfBot", agent: null }));

    for (let i = 0; i < players.length; i++) {
        if (!players[i].isBot) continue;
        const nextPlayers = makeVectorChar(wasm, [...playerTokens.slice(i + 1), ...playerTokens.slice(0, i)]);
        players[i].agent = new wasm.Korf2IterativeAgent(wasmChar(playerTokens[i]), players[i].num ?? (i + 1), nextPlayers, agentMaxDepth, agentThoughtCapMs, agentBranching);
    }

    return { ok: true };
}

async function handleApplyMove(msg) {
    if (!wasmBoard) throw new Error("Worker not initialized. Call reset first.");
    const move = msg.move;
    const token = msg.token;
    if (!Array.isArray(move) || move.length === 0) throw new Error("Invalid move.");
    if (typeof token !== "string" || token.length !== 1) throw new Error("Invalid token.");

    const vi = makeVectorInt(wasm, move);
    const placed = wasmBoard.addDrop(vi, wasmChar(token));
    if (!placed) {
        vi.delete?.();
        throw new Error("Illegal move applied to worker board.");
    }
    moveCount++;
    return { ok: true };
}

async function handleThink(msg) {
    if (!wasmBoard || !players || !playerTokens) throw new Error("Worker not initialized. Call reset first.");
    const turn = msg.turn;
    const recentOppMoves = Array.isArray(msg.recentOppMoves) ? msg.recentOppMoves : [];
    const isFirstMove = !!msg.isFirstMove;
    if (!Number.isInteger(turn) || turn < 0 || turn >= players.length) throw new Error("Invalid turn.");
    if (!players[turn].isBot || !players[turn].agent) throw new Error("Not a bot turn.");

    const oppLastMoves = makeVectorVectorInt(wasm, recentOppMoves);
    const moveVec = players[turn].agent.chooseMove(wasmBoard, oppLastMoves, isFirstMove);

    const move = [];
    if (moveVec && typeof moveVec.size === "function") {
        for (let i = 0; i < moveVec.size(); i++) move.push(moveVec.get(i));
    }

    const depth = players[turn].agent.getLastSearchDepth();
    const evals = [];
    for (let i = 0; i < playerTokens.length; i++) {
        evals.push({ token: playerTokens[i], value: players[turn].agent.getLastBestResult(wasmChar(playerTokens[i])) });
    }

    return { move, depth, evals, moveCount };
}

self.onmessage = async (e) => {
    const msg = e.data || {};
    const id = msg.id;
    const type = msg.type;
    try {
        let result = null;
        if (type === "reset") result = await handleReset(msg);
        else if (type === "applyMove") result = await handleApplyMove(msg);
        else if (type === "think") result = await handleThink(msg);
        else throw new Error("Unknown message type.");
        self.postMessage({ id, ok: true, result });
    } catch (err) {
        self.postMessage({ id, ok: false, error: String(err && err.message ? err.message : err) });
    }
};

