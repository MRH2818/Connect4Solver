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


/** Embind passes C++ `char` as a JS number (ASCII code), not a one-character string. */
function wasmChar(ch) {
  return typeof ch === "string" ? ch.charCodeAt(0) : ch;
}

function printBoard2D(board, size) {
  const cells = board.toString();
  let out = "\n";

  for (let row = size - 1; row >= 0; row--) {
    let line = "|";
    for (let col = 0; col < size; col++) {
      const idx = col + row * size;
      line += ` ${cells[idx]} |`;
    }
    out += line + "\n";
  }

  out += "+" + "---+".repeat(size) + "\n";
  out += Array.from({ length: size }, (_, i) => `  ${i}${((i > 9) ? '' : ' ')}`).join("") + "\n";
  console.log(out);
}

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

async function runGame() {
  const wasm = await waitForConnect4Module();

  const boardSize = 12;
  const humanToken = 'X';
  const agentToken = 'O';

  const board = new wasm.Board(boardSize, 2);

  const nextPlayers = makeVectorChar(wasm, [humanToken]);
  const agent = new wasm.Korf2IterativeAgent(
    wasmChar(agentToken),
    2,
    nextPlayers,
    6,
    3000
  );

  let turn = Math.floor(Math.random() * 2);
  let lastHumanMove = [];

  console.log("Connect 4 (you vs Korf2 agent). Four in a row wins.");
  console.log(`You: ${humanToken}, Agent: ${agentToken}`);

  while (true) {
    printBoard2D(board, boardSize);

    if (turn % 2 === 0) {
      const input = prompt(`Your turn (${humanToken}) - column (0-${boardSize - 1}):`);
      const col = Number(input);

      if (!Number.isInteger(col) || col < 0 || col >= boardSize) {
        console.log("Invalid column.");
        continue;
      }

      const moveVec = makeVectorInt(wasm, [col]);
      const placed = board.addDrop(moveVec, wasmChar(humanToken));

      if (!placed) {
        console.log("That column is full. Pick another.");
        continue;
      }

      if (board.checkWin(wasmChar(humanToken))) {
        printBoard2D(board, boardSize);
        console.log("You win!");
        break;
      }

      lastHumanMove = [col];
    } else {
      const oppLastMoves = new wasm.VectorVectorInt();
      if (lastHumanMove.length > 0) {
        oppLastMoves.push_back(makeVectorInt(wasm, lastHumanMove));
      }

      const move = agent.chooseMove(
        board,
        oppLastMoves,
        lastHumanMove.length === 0
      );

      board.addDrop(move, wasmChar(agentToken));
      console.log(`Agent played column ${move.get(0)}.`);

      if (board.checkWin(wasmChar(agentToken))) {
        printBoard2D(board, boardSize);
        console.log("Agent wins!");
        break;
      }
    }

    if (board.isFull()) {
      printBoard2D(board, boardSize);
      console.log("Board is full: draw.");
      break;
    }

    turn++;
  }
}

runGame();
