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

    // DEFINE PLAYERS
    const allColors = ["red", "yellow", "orange", "green", "purple", "brown", "black", "maroon", "cyan", "pink", "gray", "rgb(106, 84, 12)"]
    // IMPORTANT: build the full token list first so bots can see all opponents.
    for (let i = 0; i < players.length; i++) {
        // Player numbers are 1-based; map them to 'A', 'B', 'C', ...
        const tokenIdx = Math.max(0, (players[i].num ?? (i + 1)) - 1);
        playerTokens.push("ABCDEFGHIJKLMNOPQRSTUVWXYZ".charAt(tokenIdx));
        playerColors.push(allColors[i % allColors.length]);
    }

    for (let i = 0; i < players.length; i++) {
        if (players[i].type === "KorfBot") {
            const nextPlayers = makeVectorChar(wasm, [...playerTokens.slice(i+1), ...playerTokens.slice(0, i)]);

            players[i].agent = new wasm.Korf2IterativeAgent(
                wasmChar(playerTokens[i]),
                players[i].num ?? (i + 1),
                nextPlayers,
                AGENT_MAX_DEPTH,
                AGENT_THOUGHT_CAP_MS,4
            );
            players[i].isBot = true;
        } else {
            players[i].isBot = false;
        }

        console.log(players[i]);
    }

    // DEFINE BOT thinking method:
    const botThink = () => {
        if (gameOver || !players[turn].isBot) {
            console.error("Function should not have been called.");
            return "";
        }

        // MAKE MOVE
        let oppLastMoves = new wasm.VectorVectorInt();
        // Provide only the most recent moves since this bot last played:
        // for N players, that's at most N-1 moves.
        const recentOppMoves = lastMoves.slice(Math.max(0, lastMoves.length - (players.length - 1)));
        recentOppMoves.forEach(val => {
            oppLastMoves.push_back(val);
        });
        let move = players[turn].agent.chooseMove(wasmBoard, oppLastMoves, lastMoves.length === 0);

        // PRINT EVALUATION TO CONSOLE:
        console.log("Depth searched:", players[turn].agent.getLastSearchDepth())
        players.forEach((p, idx) => {
            console.log(`Player ${p.num} eval: ${players[turn].agent.getLastBestResult(wasmChar(playerTokens[idx]))}`);
        });

        // DEFENSIVE: if agent returns an illegal move (shouldn't happen), make a console error
        let placed = false;
        if (move && typeof move.size === "function" && move.size() > 0) {
            placed = wasmBoard.addDrop(move, wasmChar(playerTokens[turn]));
        }
        if (!placed) {
            console.error("Invalid move attempted");
            const availableMoves = wasmBoard.getAvailableMoves();
            statusDiv.innerHTML = "Internal error: bot produced no legal moves.";
            gameOver = true;
            return;
        }

        const col = move.get(0);

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

        if (!gameOver) {
            lastMoves.push(move); // register
            turn = (turn + 1) % players.length;
            statusDiv.innerHTML = `Player ${players[turn].num}'s turn: (${players[turn].type.toUpperCase()}).`;

            if (players[turn].isBot) {
                statusDiv.innerHTML += "<br>Thinking...";
                setTimeout(botThink, 0);
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
        const targetDraw = visualBoard.boardCoordsToVisualCoords(col, wasmBoard.getLastMoveHeight());
        
        // DRAW PIECE
        visualBoard.addDrop(targetDraw[0], targetDraw[1], playerColors[turn]);

        if (!gameOver) {
            turn = (turn + 1) % players.length;
            statusDiv.innerHTML = `Player ${players[turn].num}'s turn: (${players[turn].type.toUpperCase()}).`;

            if (players[turn].isBot) {
                statusDiv.innerHTML += "<br>Thinking...";
                setTimeout(botThink, 0);
            }
        }
    }

    // TRIGGER GAME NOW
    statusDiv.innerHTML = `Player ${players[turn].num}'s turn: (${players[turn].type.toUpperCase()}).`;

    if (players[turn].isBot) {
        statusDiv.innerHTML += "<br>Thinking...";
        setTimeout(botThink, 0);
    }

    visualBoard.setOnClickHandler((e) => {
        onClick(e);
    });


})();
