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
    const vec = new wasm.VectorChar();
    values.forEach((v) => vec.push_back(wasmChar(v)));
    return vec;
}

// Block scope
(async function () {
    /*
        STATUS UPDATE       ---------------------------------------
    */
    statusDiv = document.getElementById("statusUpdate");
    statusDiv.innerHTML = "Loading board...";    


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
    // Agent thinking settings:
    const AGENT_MAX_DEPTH = 15;
    const AGENT_THOUGHT_CAP_MS = 1000;
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
    const wasm = await waitForConnect4Module(); // GET WASM SERVICE
    const wasmBoard = new wasm.Board(_BOARD_SIZE, 2);
    let gameOver = false;

    let playerTokens = [];
    let playerColors = [];
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

    // DEFINE PLAYERS
    const allColors = ["red", "yellow", "orange", "green", "purple", "brown", "black", "maroon", "cyan", "pink", "gray", "magenta", "rgb(106, 84, 12)"]
    // IMPORTANT: build the full token list first so bots can see all opponents.
    for (let i = 0; i < players.length; i++) {
        // Player numbers are 1-based; map them to 'A', 'B', 'C', ...
        const tokenIdx = Math.max(0, (players[i].num ?? (i + 1)) - 1);
        playerTokens.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(tokenIdx));
        playerColors.push(allColors[i % allColors.length]);
    }

    for (let i = 0; i < players.length; i++) {
        players[i].isBot = players[i].type === "KorfBot";
        console.log(players[i]);
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
        await botWorkerCall("reset", { boardSize: _BOARD_SIZE, numDimensions: 2, players: players.map(p => ({ num: p.num, type: p.type })), playerTokens, agentMaxDepth: AGENT_MAX_DEPTH, agentThoughtCapMs: AGENT_THOUGHT_CAP_MS, agentBranching: 4 });
    }

    // DEFINE BOT thinking method:
    const botThink = async () => {
        if (gameOver || !players[turn].isBot) {
            console.error("Function should not have been called.");
            return "";
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
            return;
        }

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
            if (placed) lastMoves.push(move);
            else move.delete?.();
        }
        if (!placed) {
            console.error("Invalid move attempted");
            const availableMoves = wasmBoard.getAvailableMoves();
            statusDiv.innerHTML = "Internal error: bot produced no legal moves.";
            gameOver = true;
            return;
        }

        const col = moveArr[0];

        // VERIFY MOVE
        if (wasmBoard.checkWin(wasmChar(playerTokens[turn]))) {
            statusDiv.innerHTML = `Player ${players[turn].num} wins!`;
            gameOver = true;
        } else if (wasmBoard.isFull()) {
            statusDiv.innerHTML = "Game is a draw!";
            gameOver = true;
        }

        // DRAW MOVE
        const targetDraw = visualBoard.boardCoordsToVisualCoords(col, wasmBoard.getLastMoveHeight());
        visualBoard.addDrop(targetDraw[0], targetDraw[1], playerColors[turn]);
        if (botWorker) {
            try { await botWorkerCall("applyMove", { move: moveArr, token: playerTokens[turn] }); } catch (err) { console.error("Worker sync failed", err); }
        }

        if (!gameOver) {
            turn = (turn + 1) % players.length;
            statusDiv.innerHTML = `Player ${players[turn].num}'s turn: (${players[turn].type.toUpperCase()}).`;

            if (players[turn].isBot) {
                statusDiv.innerHTML += "<br>Thinking...";
                setTimeout(() => { botThink(); }, 0);
            }
        }
        
    }

    // DEFINE onClick function:
    const onClick = (e) => {
        if (gameOver) {
            return "";
        }
        if (players[turn].isBot) {
            statusDiv.innerHTML = `Player ${players[turn].num}'s turn: (${players[turn].type.toUpperCase()}).<br>Wait! The bot is thinking!`;
            return;
        }

        const col = Math.floor(e.offsetX / (PIXEL_SIDE_LENGTH / _BOARD_SIZE));

        const vi = makeVectorInt(wasm, [col]);
        const placed = wasmBoard.addDrop(vi, wasmChar(playerTokens[turn]));
        if (!placed) {
            statusDiv.innerHTML = `Player ${players[turn].num}'s turn: (${players[turn].type.toUpperCase()}).<br>Invalid move! Please pick another column.`;
            return;
        }
        // MAKE SURE THAT IT DRAWS AFTER WIN OR DRAW
        if (wasmBoard.checkWin(wasmChar(playerTokens[turn]))) {
            statusDiv.innerHTML = `Player ${players[turn].num} wins!`;
            gameOver = true;
        } else if (wasmBoard.isFull()) {
            statusDiv.innerHTML = "Game is a draw!";
            gameOver = true;
        }

        // REGISTER LOCATION OF CLICK
        lastMoves.push(vi);
        if (botWorker) {
            botWorkerCall("applyMove", { move: [col], token: playerTokens[turn] }).catch((err) => console.error("Worker sync failed", err));
        }
        const targetDraw = visualBoard.boardCoordsToVisualCoords(col, wasmBoard.getLastMoveHeight());
        
        // DRAW PIECE
        visualBoard.addDrop(targetDraw[0], targetDraw[1], playerColors[turn]);

        if (!gameOver) {
            turn = (turn + 1) % players.length;
            statusDiv.innerHTML = `Player ${players[turn].num}'s turn: (${players[turn].type.toUpperCase()}).`;

            if (players[turn].isBot) {
                statusDiv.innerHTML += "<br>Thinking...";
                setTimeout(() => { botThink(); }, 0);
            }
        }
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

    // TRIGGER GAME NOW
    statusDiv.innerHTML = `Player ${players[turn].num}'s turn: (${players[turn].type.toUpperCase()}).`;

    if (players[turn].isBot) {
        statusDiv.innerHTML += "<br>Thinking...";
        setTimeout(() => { botThink(); }, 0);
    }

    visualBoard.setOnClickHandler((e) => {
        onClick(e);
    });


})();
