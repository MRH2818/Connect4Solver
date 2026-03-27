class NDBoard {
  constructor({ size, dimensions, connectN, gravityAxis }) {
    if (dimensions < 2) {
      throw new Error("dimensions must be >= 2");
    }
    if (gravityAxis < 0 || gravityAxis >= dimensions) {
      throw new Error("gravity axis out of bounds");
    }

    this.size = size;
    this.dimensions = dimensions;
    this.connectN = connectN;
    this.gravityAxis = gravityAxis;

    this.totalCells = ipow(size, dimensions);
    this.cells = new Int8Array(this.totalCells);

    this.totalDropMoves = ipow(size, dimensions - 1);
    this.availableToPlay = new Uint8Array(this.totalDropMoves);
    this.availableToPlay.fill(1);

    this.lastPlacedIndex = null;
    this.lastPlacedCoords = null;
    this.history = [];
    this.directions = getAllDirections(dimensions);
  }

  coordsToIndex(coords) {
    let index = 0;
    let mul = 1;
    for (let i = 0; i < this.dimensions; i += 1) {
      index += coords[i] * mul;
      mul *= this.size;
    }
    return index;
  }

  indexToCoords(index) {
    const coords = new Array(this.dimensions).fill(0);
    let temp = index;
    for (let i = 0; i < this.dimensions; i += 1) {
      coords[i] = temp % this.size;
      temp = Math.floor(temp / this.size);
    }
    return coords;
  }

  dropMoveIndex(dropCoords) {
    let index = 0;
    let mul = 1;
    for (let i = 0; i < dropCoords.length; i += 1) {
      index += dropCoords[i] * mul;
      mul *= this.size;
    }
    return index;
  }

  dropMoveCoords(index) {
    const coords = new Array(this.dimensions - 1).fill(0);
    let temp = index;
    for (let i = 0; i < this.dimensions - 1; i += 1) {
      coords[i] = temp % this.size;
      temp = Math.floor(temp / this.size);
    }
    return coords;
  }

  dropToFullCoords(dropCoords, gravLevel) {
    const full = new Array(this.dimensions);
    let src = 0;
    for (let axis = 0; axis < this.dimensions; axis += 1) {
      if (axis === this.gravityAxis) {
        full[axis] = gravLevel;
      } else {
        full[axis] = dropCoords[src];
        src += 1;
      }
    }
    return full;
  }

  findLanding(dropCoords) {
    for (let grav = 0; grav < this.size; grav += 1) {
      const fullCoords = this.dropToFullCoords(dropCoords, grav);
      const index = this.coordsToIndex(fullCoords);
      if (this.cells[index] === 0) {
        return { index, coords: fullCoords };
      }
    }
    return null;
  }

  addDrop(dropCoords, player) {
    if (dropCoords.length !== this.dimensions - 1) return null;

    const dropIndex = this.dropMoveIndex(dropCoords);
    if (dropIndex < 0 || dropIndex >= this.availableToPlay.length || this.availableToPlay[dropIndex] === 0) {
      return null;
    }

    const landing = this.findLanding(dropCoords);
    if (!landing) {
      this.availableToPlay[dropIndex] = 0;
      return null;
    }

    this.cells[landing.index] = player;
    this.lastPlacedIndex = landing.index;
    this.lastPlacedCoords = landing.coords.slice();
    this.history.push({
      player,
      dropCoords: dropCoords.slice(),
      landingIndex: landing.index,
      landingCoords: landing.coords.slice(),
      dropIndex,
    });

    const topCoords = this.dropToFullCoords(dropCoords, this.size - 1);
    const topIdx = this.coordsToIndex(topCoords);
    if (this.cells[topIdx] !== 0) {
      this.availableToPlay[dropIndex] = 0;
    }

    return landing;
  }

  undoLastMove() {
    const last = this.history.pop();
    if (!last) return false;

    this.cells[last.landingIndex] = 0;
    this.availableToPlay[last.dropIndex] = 1;

    if (this.history.length) {
      const prev = this.history[this.history.length - 1];
      this.lastPlacedIndex = prev.landingIndex;
      this.lastPlacedCoords = prev.landingCoords.slice();
    } else {
      this.lastPlacedIndex = null;
      this.lastPlacedCoords = null;
    }
    return true;
  }

  isFull() {
    return this.availableToPlay.every((v) => v === 0);
  }

  getAvailableMoves() {
    const moves = [];
    for (let i = 0; i < this.totalDropMoves; i += 1) {
      if (this.availableToPlay[i] === 1) {
        moves.push(this.dropMoveCoords(i));
      }
    }
    return moves;
  }

  walkRay(startIndex, startCoords, dir, player) {
    const step = this.coordsToIndex(dir);
    let count = 0;
    let idx = startIndex + step;
    const coords = startCoords.slice();
    for (let d = 0; d < this.dimensions; d += 1) coords[d] += dir[d];

    while (inBounds(coords, this.size) && this.cells[idx] === player) {
      count += 1;
      for (let d = 0; d < this.dimensions; d += 1) coords[d] += dir[d];
      idx += step;
    }
    return count;
  }

  checkWin(player) {
    if (this.lastPlacedIndex === null || !this.lastPlacedCoords) return false;
    for (const dir of this.directions) {
      let streak = 1;
      streak += this.walkRay(this.lastPlacedIndex, this.lastPlacedCoords, dir, player);
      streak += this.walkRay(this.lastPlacedIndex, this.lastPlacedCoords, dir.map((v) => -v), player);
      if (streak >= this.connectN) return true;
    }
    return false;
  }

  serialize() {
    return {
      size: this.size,
      dimensions: this.dimensions,
      gravityAxis: this.gravityAxis,
      connectN: this.connectN,
      cells: Array.from(this.cells),
      availableToPlay: Array.from(this.availableToPlay),
    };
  }
}

const App = {
  board: null,
  currentPlayer: 1,
  gameOver: false,
  players: [
    { token: "X", type: "human" },
    { token: "O", type: "human" },
  ],
  worker: null,
  sliceState: {
    axisX: 0,
    axisY: 1,
    fixed: {},
  },
};

function ipow(base, exp) {
  let result = 1;
  for (let i = 0; i < exp; i += 1) result *= base;
  return result;
}

function inBounds(coords, size) {
  for (const c of coords) {
    if (c < 0 || c >= size) return false;
  }
  return true;
}

function getAllDirections(dimensions) {
  const directions = [];
  for (let first = 0; first < dimensions; first += 1) {
    const remaining = dimensions - 1 - first;
    const combos = ipow(3, remaining);
    for (let c = 0; c < combos; c += 1) {
      const dir = new Array(dimensions).fill(0);
      dir[first] = 1;
      let temp = c;
      for (let r = 0; r < remaining; r += 1) {
        dir[first + 1 + r] = (temp % 3) - 1;
        temp = Math.floor(temp / 3);
      }
      directions.push(dir);
    }
  }
  return directions;
}

function setupWorker() {
  if (App.worker) {
    App.worker.terminate();
    App.worker = null;
  }
  App.worker = new Worker("ai-worker.js");
  App.worker.onmessage = (event) => {
    const { type, payload } = event.data;
    if (type !== "moveResult") return;
    if (!payload || !payload.move || App.gameOver) return;

    $("#lastAIMove").text(`AI selected [${payload.move.join(", ")}], reason: ${payload.reason}`);
    playMove(payload.move);
  };
}

function readConfig() {
  const size = Math.max(4, Number($("#sizeInput").val()) || 6);
  const dimensions = Math.max(2, Number($("#dimensionsInput").val()) || 2);
  const connectN = Math.max(4, Number($("#connectInput").val()) || 4);
  const gravityAxisRaw = Number($("#gravityAxisInput").val());
  const gravityAxis = Number.isFinite(gravityAxisRaw)
    ? Math.min(Math.max(0, gravityAxisRaw), dimensions - 1)
    : Math.min(1, dimensions - 1);

  return { size, dimensions, connectN, gravityAxis };
}

function createDropCoordinateControls() {
  const container = $("#dropCoordinateControls");
  container.empty();
  const dims = App.board.dimensions;

  for (let axis = 0; axis < dims; axis += 1) {
    if (axis === App.board.gravityAxis) continue;
    const idx = axis < App.board.gravityAxis ? axis : axis - 1;
    const label = $("<label>").text(`Drop axis ${axis}`);
    const select = $("<select>")
      .attr("id", `dropCoord_${idx}`)
      .addClass("drop-select");

    for (let v = 0; v < App.board.size; v += 1) {
      select.append($("<option>").attr("value", v).text(v));
    }

    label.append(select);
    container.append(label);
  }
}

function createSliceControls() {
  const container = $("#sliceControls");
  container.empty();

  const dims = App.board.dimensions;
  App.sliceState.axisX = 0;
  App.sliceState.axisY = dims > 1 ? 1 : 0;
  App.sliceState.fixed = {};

  const axisXSel = $("<select id='sliceAxisX'></select>");
  const axisYSel = $("<select id='sliceAxisY'></select>");

  for (let axis = 0; axis < dims; axis += 1) {
    axisXSel.append($("<option>").val(axis).text(`Axis ${axis}`));
    axisYSel.append($("<option>").val(axis).text(`Axis ${axis}`));
  }
  axisYSel.val(String(App.sliceState.axisY));

  container.append($("<label>").text("Slice X axis").append(axisXSel));
  container.append($("<label>").text("Slice Y axis").append(axisYSel));

  for (let axis = 0; axis < dims; axis += 1) {
    const select = $("<select>").attr("id", `fixedAxis_${axis}`);
    for (let v = 0; v < App.board.size; v += 1) {
      select.append($("<option>").val(v).text(v));
    }
    container.append($("<label>").text(`Fixed axis ${axis}`).append(select));
    App.sliceState.fixed[axis] = 0;
  }

  container.on("change", "select", () => {
    App.sliceState.axisX = Number($("#sliceAxisX").val());
    App.sliceState.axisY = Number($("#sliceAxisY").val());
    for (let axis = 0; axis < dims; axis += 1) {
      App.sliceState.fixed[axis] = Number($(`#fixedAxis_${axis}`).val());
    }
    drawBoard();
  });
}

function initGame() {
  const config = readConfig();
  $("#gravityAxisInput").val(config.gravityAxis);

  App.board = new NDBoard(config);
  App.currentPlayer = 1;
  App.gameOver = false;
  App.players[1].type = $("#player2Type").val();

  setupWorker();
  createDropCoordinateControls();
  createSliceControls();
  drawBoard();
  updateStatus();
  maybeAIMove();
}

function getSelectedDropCoords() {
  const coords = [];
  const total = App.board.dimensions - 1;
  for (let i = 0; i < total; i += 1) {
    const value = Number($(`#dropCoord_${i}`).val());
    coords.push(Number.isFinite(value) ? value : 0);
  }
  return coords;
}

function updateStatus(message = "") {
  const token = App.players[App.currentPlayer - 1].token;
  const base = App.gameOver
    ? "Game Over"
    : `Turn: Player ${App.currentPlayer} (${token})`;
  const extra = message ? ` — ${message}` : "";
  $("#status").text(base + extra);
}

function nextPlayer() {
  App.currentPlayer = App.currentPlayer === 1 ? 2 : 1;
}

function playMove(dropCoords) {
  if (App.gameOver) return;
  const player = App.currentPlayer;
  const landing = App.board.addDrop(dropCoords, player);
  if (!landing) {
    updateStatus("Invalid move (column full or illegal)");
    return;
  }

  if (App.board.checkWin(player)) {
    App.gameOver = true;
    drawBoard();
    updateStatus(`Player ${player} wins!`);
    return;
  }

  if (App.board.isFull()) {
    App.gameOver = true;
    drawBoard();
    updateStatus("Draw: board is full");
    return;
  }

  nextPlayer();
  drawBoard();
  updateStatus();
  maybeAIMove();
}

function maybeAIMove() {
  const p = App.players[App.currentPlayer - 1];
  if (App.gameOver || p.type !== "ai") return;

  App.worker.postMessage({
    type: "chooseMove",
    payload: {
      state: App.board.serialize(),
      aiPlayer: App.currentPlayer,
      humanPlayer: App.currentPlayer === 1 ? 2 : 1,
    },
  });
}

function drawBoard() {
  const canvas = document.getElementById("boardCanvas");
  const ctx = canvas.getContext("2d");

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const mode = $("#renderMode").val();
  if (mode === "3d") {
    draw3DIsometric(ctx, canvas);
  } else if (mode === "slice") {
    drawSliceExplorer(ctx, canvas);
  } else {
    draw2D(ctx, canvas);
  }
}

function draw2D(ctx, canvas) {
  const size = App.board.size;
  const dims = App.board.dimensions;

  if (dims !== 2) {
    ctx.fillStyle = "#9ca3af";
    ctx.font = "18px sans-serif";
    ctx.fillText("2D render mode expects dimensions = 2. Switch to Slice/3D mode.", 20, 40);
    return;
  }

  const padding = 24;
  const cell = Math.min((canvas.width - 2 * padding) / size, (canvas.height - 2 * padding) / size);

  for (let y = size - 1; y >= 0; y -= 1) {
    for (let x = 0; x < size; x += 1) {
      const idx = App.board.coordsToIndex([x, y]);
      const value = App.board.cells[idx];
      const drawX = padding + x * cell;
      const drawY = padding + (size - 1 - y) * cell;
      drawCell(ctx, drawX, drawY, cell, value);
    }
  }

  drawAxisText(ctx, `Axes shown: 0 (x), 1 (y)`, canvas.height - 14);
}

function draw3DIsometric(ctx, canvas) {
  const dims = App.board.dimensions;
  if (dims < 3) {
    ctx.fillStyle = "#9ca3af";
    ctx.font = "18px sans-serif";
    ctx.fillText("3D render mode expects dimensions >= 3.", 20, 40);
    return;
  }

  const size = App.board.size;
  const layerGapX = 24;
  const layerGapY = 16;
  const cell = Math.min(44, Math.floor((canvas.width - 220) / size));
  const baseX = 80;
  const baseY = canvas.height - 80;

  const zAxis = 2;
  for (let z = 0; z < size; z += 1) {
    const layerOffsetX = z * layerGapX;
    const layerOffsetY = z * layerGapY;

    for (let gy = size - 1; gy >= 0; gy -= 1) {
      for (let x = 0; x < size; x += 1) {
        const coords = new Array(dims).fill(0);
        coords[0] = x;
        coords[App.board.gravityAxis] = gy;
        coords[zAxis] = z;
        for (let axis = 0; axis < dims; axis += 1) {
          if (axis !== 0 && axis !== App.board.gravityAxis && axis !== zAxis) {
            coords[axis] = Number($(`#fixedAxis_${axis}`).val()) || 0;
          }
        }

        const idx = App.board.coordsToIndex(coords);
        const value = App.board.cells[idx];

        const drawX = baseX + x * cell + layerOffsetX;
        const drawY = baseY - (size - 1 - gy) * cell - layerOffsetY;
        drawCell(ctx, drawX, drawY, cell, value, 0.82);
      }
    }
  }

  drawAxisText(ctx, `3D projection using axes [0, ${App.board.gravityAxis}, 2]`, 24);
}

function drawSliceExplorer(ctx, canvas) {
  const size = App.board.size;
  const dims = App.board.dimensions;

  const axisX = Number($("#sliceAxisX").val()) || 0;
  const axisY = Number($("#sliceAxisY").val()) || Math.min(1, dims - 1);
  if (axisX === axisY) {
    ctx.fillStyle = "#ef4444";
    ctx.font = "20px sans-serif";
    ctx.fillText("Slice axes must be different.", 24, 40);
    return;
  }

  const fixed = {};
  for (let axis = 0; axis < dims; axis += 1) {
    fixed[axis] = Number($(`#fixedAxis_${axis}`).val()) || 0;
  }

  const padding = 24;
  const cell = Math.min((canvas.width - 2 * padding) / size, (canvas.height - 2 * padding) / size);

  for (let y = size - 1; y >= 0; y -= 1) {
    for (let x = 0; x < size; x += 1) {
      const coords = new Array(dims).fill(0);
      for (let axis = 0; axis < dims; axis += 1) {
        coords[axis] = fixed[axis];
      }
      coords[axisX] = x;
      coords[axisY] = y;

      const idx = App.board.coordsToIndex(coords);
      const value = App.board.cells[idx];
      const drawX = padding + x * cell;
      const drawY = padding + (size - 1 - y) * cell;
      drawCell(ctx, drawX, drawY, cell, value);
    }
  }

  drawAxisText(ctx, `Slice axes: ${axisX} (x), ${axisY} (y)`, canvas.height - 14);
}

function drawCell(ctx, x, y, size, value, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#1f2937";
  ctx.strokeStyle = "#4b5563";
  ctx.lineWidth = 1;
  ctx.fillRect(x, y, size - 2, size - 2);
  ctx.strokeRect(x, y, size - 2, size - 2);

  if (value !== 0) {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, Math.max(6, size * 0.33), 0, Math.PI * 2);
    ctx.fillStyle = value === 1 ? "#f59e0b" : "#3b82f6";
    ctx.fill();
    ctx.strokeStyle = "#111827";
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawAxisText(ctx, text, y) {
  ctx.fillStyle = "#9ca3af";
  ctx.font = "14px sans-serif";
  ctx.fillText(text, 16, y);
}

$(document).ready(() => {
  $("#newGameBtn").on("click", initGame);

  $("#playMoveBtn").on("click", () => {
    const dropCoords = getSelectedDropCoords();
    playMove(dropCoords);
  });

  $("#undoBtn").on("click", () => {
    if (App.gameOver) App.gameOver = false;
    const undone = App.board.undoLastMove();
    if (!undone) {
      updateStatus("Nothing to undo");
      return;
    }
    nextPlayer();
    drawBoard();
    updateStatus("Undid last move");
  });

  $("#renderMode").on("change", drawBoard);

  // Quick mouse input for 2D mode.
  $("#boardCanvas").on("click", (event) => {
    const mode = $("#renderMode").val();
    if (mode !== "2d" || App.board.dimensions !== 2 || App.gameOver) return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const padding = 24;
    const cell = Math.min((event.currentTarget.width - 2 * padding) / App.board.size, (event.currentTarget.height - 2 * padding) / App.board.size);
    const col = Math.floor((x - padding) / cell);
    if (col < 0 || col >= App.board.size) return;

    $("#dropCoord_0").val(col);
    playMove([col]);
  });

  initGame();
});
