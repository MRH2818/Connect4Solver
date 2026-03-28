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

  dropMoveIndex(dropCoords) {
    let index = 0;
    let mul = 1;
    for (let i = 0; i < dropCoords.length; i += 1) {
      index += dropCoords[i] * mul;
      mul *= this.size;
    }
    return index;
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
    return this.availableToPlay.every((value) => value === 0);
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
      streak += this.walkRay(this.lastPlacedIndex, this.lastPlacedCoords, dir.map((value) => -value), player);
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

const PLAYER_STYLES = [
  { token: "X", color: "#ffb703" },
  { token: "O", color: "#4cc9f0" },
  { token: "A", color: "#ff5d8f" },
  { token: "B", color: "#72efdd" },
  { token: "C", color: "#c77dff" },
  { token: "D", color: "#f28482" },
];

const PAGE = {
  gameMode: document.body.dataset.gameMode || "2d",
  modeLabel: document.body.dataset.modeLabel || "Arena",
  modeDescription: document.body.dataset.modeDescription || "",
  defaultSize: Number(document.body.dataset.defaultSize) || 4,
  defaultConnect: Number(document.body.dataset.defaultConnect) || 4,
  defaultGravityAxis: Number(document.body.dataset.defaultGravityAxis) || 1,
  defaultDimensions: Number(document.body.dataset.defaultDimensions) || 2,
  minDimensions: Number(document.body.dataset.minDimensions) || 2,
  maxDimensions: Number(document.body.dataset.maxDimensions) || 6,
  renderMode: document.body.dataset.renderMode || "2d",
  dimensionsEditable: document.body.dataset.dimensionsEditable === "true",
  gravityEditable: document.body.dataset.gravityEditable === "true",
};

const App = {
  board: null,
  currentPlayer: 1,
  gameOver: false,
  players: [],
  worker: null,
  aiRequestId: 0,
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

function clampNumber(value, min, max, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(max, Math.max(min, Math.round(numeric)));
}

function inBounds(coords, size) {
  return coords.every((coord) => coord >= 0 && coord < size);
}

function getAllDirections(dimensions) {
  const directions = [];
  for (let first = 0; first < dimensions; first += 1) {
    const remaining = dimensions - 1 - first;
    const combos = ipow(3, remaining);
    for (let combo = 0; combo < combos; combo += 1) {
      const dir = new Array(dimensions).fill(0);
      dir[first] = 1;
      let temp = combo;
      for (let r = 0; r < remaining; r += 1) {
        dir[first + 1 + r] = (temp % 3) - 1;
        temp = Math.floor(temp / 3);
      }
      directions.push(dir);
    }
  }
  return directions;
}

function buildPlayers(playerCount, player2Type) {
  const players = [];
  for (let i = 0; i < playerCount; i += 1) {
    const style = PLAYER_STYLES[i % PLAYER_STYLES.length];
    players.push({
      name: `Player ${i + 1}`,
      token: style.token,
      color: style.color,
      type: i === 1 && playerCount === 2 ? player2Type : "human",
    });
  }
  return players;
}

function getCurrentPlayer() {
  return App.players[App.currentPlayer - 1] || { name: "Player 1", token: "X", color: "#ffb703", type: "human" };
}

function getPlayerStyle(playerNumber) {
  return App.players[playerNumber - 1] || PLAYER_STYLES[(playerNumber - 1) % PLAYER_STYLES.length];
}

function applyPageDefaults() {
  $("#playerCountInput").val(2);
  $("#sizeInput").val(PAGE.defaultSize);
  $("#dimensionsInput").val(PAGE.defaultDimensions);
  $("#connectInput").val(PAGE.defaultConnect);
  $("#gravityAxisInput").val(PAGE.defaultGravityAxis);
  $("#player2Type").val("human");
  $("#renderMode").val(PAGE.renderMode);
}

function readConfig() {
  const size = clampNumber($("#sizeInput").val(), 4, 8, PAGE.defaultSize);
  const dimensions = clampNumber($("#dimensionsInput").val(), PAGE.minDimensions, PAGE.maxDimensions, PAGE.defaultDimensions);
  const connectN = clampNumber($("#connectInput").val(), 4, size, PAGE.defaultConnect);
  const gravityAxis = clampNumber($("#gravityAxisInput").val(), 0, dimensions - 1, Math.min(PAGE.defaultGravityAxis, dimensions - 1));
  const playerCount = clampNumber($("#playerCountInput").val(), 2, 6, 2);
  const player2Type = playerCount === 2 ? ($("#player2Type").val() || "human") : "human";

  return {
    size,
    dimensions,
    connectN,
    gravityAxis,
    playerCount,
    player2Type,
    renderMode: PAGE.renderMode,
  };
}

function syncInputs(config) {
  $("#playerCountInput").val(config.playerCount);
  $("#sizeInput").val(config.size);
  $("#dimensionsInput").val(config.dimensions);
  $("#connectInput").val(config.connectN);
  $("#gravityAxisInput").val(config.gravityAxis);
  $("#player2Type").val(config.player2Type);
  $("#renderMode").val(PAGE.renderMode);
}

function updatePageMeta(config = readConfig()) {
  const dimensionLabel = config.dimensions >= 4
    ? "4D+ slice explorer"
    : config.dimensions === 3
      ? "3D stack field"
      : "2D classic grid";

  $("#presetSummary").text(`${config.playerCount} players on a ${dimensionLabel}`);

  const notes = [PAGE.modeDescription];
  if (!PAGE.dimensionsEditable) {
    notes.push(`Dimensions are locked to ${PAGE.defaultDimensions} on this page.`);
  } else {
    notes.push(`Dimensions can scale from ${PAGE.minDimensions} to ${PAGE.maxDimensions}.`);
  }
  if (!PAGE.gravityEditable) {
    notes.push(`Gravity axis is locked to ${PAGE.defaultGravityAxis}.`);
  }
  $("#pageModeNote").text(notes.join(" "));

  const isMultiplayer = config.playerCount > 2;
  $("#player2TypeLabel").toggle(!isMultiplayer);
  $("#playerModeHint").text(
    isMultiplayer
      ? "Multiplayer matches are human-only for now. Drop back to 2 players if you want the AI worker."
      : "Set Player 2 to AI if you want a solo duel."
  );

  $("#dimensionsControl").toggle(PAGE.dimensionsEditable);
  $("#gravityControl").toggle(PAGE.gravityEditable);
  $("#sliceSection").toggle(PAGE.gameMode !== "2d");
}

function updateLegend() {
  const legend = $("#legend");
  legend.empty();

  App.players.forEach((player) => {
    const item = $("<span>").addClass("legend-item");
    const chip = $("<span>")
      .addClass("chip")
      .attr("style", `--chip-color: ${player.color}`);

    item.append(chip);
    item.append(`${player.name} (${player.token})`);
    legend.append(item);
  });
}

function setupWorker(enableAI) {
  if (App.worker) {
    App.worker.terminate();
    App.worker = null;
  }

  if (!enableAI) return;

  App.worker = new Worker("../shared/ai-worker.js");
  App.worker.onmessage = (event) => {
    const { type, payload } = event.data;
    if (type !== "moveResult") return;
    if (!payload || payload.requestId !== App.aiRequestId || !payload.move || App.gameOver) return;

    $("#lastAIMove").text(`AI selected [${payload.move.join(", ")}], reason: ${payload.reason}`);
    playMove(payload.move, { fromAI: true });
  };
}

function createDropCoordinateControls() {
  const container = $("#dropCoordinateControls");
  container.empty();

  for (let axis = 0; axis < App.board.dimensions; axis += 1) {
    if (axis === App.board.gravityAxis) continue;
    const idx = axis < App.board.gravityAxis ? axis : axis - 1;
    const label = $("<label>").text(`Drop axis ${axis}`);
    const select = $("<select>").attr("id", `dropCoord_${idx}`);

    for (let value = 0; value < App.board.size; value += 1) {
      select.append($("<option>").attr("value", value).text(value));
    }

    label.append(select);
    container.append(label);
  }
}

function createSliceControls() {
  const container = $("#sliceControls");
  container.off("change", "select");
  container.empty();

  if (PAGE.gameMode === "2d") return;

  const dims = App.board.dimensions;
  App.sliceState.axisX = 0;
  App.sliceState.axisY = Math.min(1, dims - 1);
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
    for (let value = 0; value < App.board.size; value += 1) {
      select.append($("<option>").val(value).text(value));
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
  syncInputs(config);
  updatePageMeta(config);

  App.aiRequestId += 1;
  App.board = new NDBoard(config);
  App.players = buildPlayers(config.playerCount, config.player2Type);
  App.currentPlayer = 1;
  App.gameOver = false;

  setupWorker(config.playerCount === 2 && config.player2Type === "ai");
  $("#lastAIMove").text("");

  createDropCoordinateControls();
  createSliceControls();
  updateLegend();
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
  const player = getCurrentPlayer();
  const base = App.gameOver ? "Game Over" : `Turn: ${player.name} (${player.token})`;
  const extra = message ? ` - ${message}` : "";
  $("#status").text(base + extra);
}

function nextPlayer() {
  App.currentPlayer = (App.currentPlayer % App.players.length) + 1;
}

function playMove(dropCoords, options = {}) {
  if (!App.board || App.gameOver) return;

  const playerMeta = getCurrentPlayer();
  if (playerMeta.type === "ai" && !options.fromAI) return;

  const playerNumber = App.currentPlayer;
  const landing = App.board.addDrop(dropCoords, playerNumber);
  if (!landing) {
    updateStatus("Invalid move (column full or illegal)");
    return;
  }

  drawBoard();

  if (App.board.checkWin(playerNumber)) {
    App.gameOver = true;
    updateStatus(`${playerMeta.name} wins!`);
    return;
  }

  if (App.board.isFull()) {
    App.gameOver = true;
    updateStatus("Draw: board is full");
    return;
  }

  nextPlayer();
  updateStatus();
  maybeAIMove();
}

function maybeAIMove() {
  const player = getCurrentPlayer();
  if (App.gameOver || player.type !== "ai" || !App.worker) return;

  updateStatus("AI is thinking");
  App.worker.postMessage({
    type: "chooseMove",
    payload: {
      requestId: App.aiRequestId,
      state: App.board.serialize(),
      aiPlayer: App.currentPlayer,
      humanPlayer: App.currentPlayer === 1 ? 2 : 1,
    },
  });
}

function drawBoard() {
  if (!App.board) return;

  const canvas = document.getElementById("boardCanvas");
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (PAGE.renderMode === "3d") {
    draw3DIsometric(ctx, canvas);
  } else if (PAGE.renderMode === "slice") {
    drawSliceExplorer(ctx, canvas);
  } else {
    draw2D(ctx, canvas);
  }
}

function draw2D(ctx, canvas) {
  if (App.board.dimensions !== 2) {
    ctx.fillStyle = "#9fb0c7";
    ctx.font = "18px 'Space Grotesk', sans-serif";
    ctx.fillText("2D render mode expects dimensions = 2.", 24, 42);
    return;
  }

  const padding = 24;
  const cell = Math.min((canvas.width - (2 * padding)) / App.board.size, (canvas.height - (2 * padding)) / App.board.size);

  for (let y = App.board.size - 1; y >= 0; y -= 1) {
    for (let x = 0; x < App.board.size; x += 1) {
      const idx = App.board.coordsToIndex([x, y]);
      const value = App.board.cells[idx];
      const drawX = padding + (x * cell);
      const drawY = padding + ((App.board.size - 1 - y) * cell);
      drawCell(ctx, drawX, drawY, cell, value);
    }
  }

  drawAxisText(ctx, "Axes shown: 0 (x), 1 (y)", canvas.height - 16);
}

function get3DProjectionAxes() {
  const nonGravityAxes = [];
  for (let axis = 0; axis < App.board.dimensions; axis += 1) {
    if (axis !== App.board.gravityAxis) {
      nonGravityAxes.push(axis);
    }
  }

  return {
    axisX: nonGravityAxes[0] ?? 0,
    axisZ: nonGravityAxes[1] ?? App.board.gravityAxis,
  };
}

function draw3DIsometric(ctx, canvas) {
  if (App.board.dimensions < 3) {
    ctx.fillStyle = "#9fb0c7";
    ctx.font = "18px 'Space Grotesk', sans-serif";
    ctx.fillText("3D render mode expects dimensions >= 3.", 24, 42);
    return;
  }

  const { axisX, axisZ } = get3DProjectionAxes();
  const size = App.board.size;
  const layerGapX = 26;
  const layerGapY = 18;
  const cell = Math.min(44, Math.floor((canvas.width - 220) / size));
  const baseX = 84;
  const baseY = canvas.height - 82;

  for (let z = 0; z < size; z += 1) {
    const layerOffsetX = z * layerGapX;
    const layerOffsetY = z * layerGapY;

    for (let gy = size - 1; gy >= 0; gy -= 1) {
      for (let x = 0; x < size; x += 1) {
        const coords = new Array(App.board.dimensions).fill(0);
        coords[axisX] = x;
        coords[App.board.gravityAxis] = gy;
        coords[axisZ] = z;

        for (let axis = 0; axis < App.board.dimensions; axis += 1) {
          if (axis === axisX || axis === App.board.gravityAxis || axis === axisZ) continue;
          coords[axis] = Number($(`#fixedAxis_${axis}`).val()) || 0;
        }

        const idx = App.board.coordsToIndex(coords);
        const value = App.board.cells[idx];
        const drawX = baseX + (x * cell) + layerOffsetX;
        const drawY = baseY - ((size - 1 - gy) * cell) - layerOffsetY;
        drawCell(ctx, drawX, drawY, cell, value, 0.84);
      }
    }
  }

  drawAxisText(ctx, `3D projection using axes [${axisX}, ${App.board.gravityAxis}, ${axisZ}]`, 28);
}

function drawSliceExplorer(ctx, canvas) {
  const axisX = Number($("#sliceAxisX").val()) || 0;
  const axisY = Number($("#sliceAxisY").val()) || Math.min(1, App.board.dimensions - 1);

  if (axisX === axisY) {
    ctx.fillStyle = "#ff5d8f";
    ctx.font = "20px 'Space Grotesk', sans-serif";
    ctx.fillText("Slice axes must be different.", 24, 42);
    return;
  }

  const fixed = {};
  for (let axis = 0; axis < App.board.dimensions; axis += 1) {
    fixed[axis] = Number($(`#fixedAxis_${axis}`).val()) || 0;
  }

  const padding = 24;
  const cell = Math.min((canvas.width - (2 * padding)) / App.board.size, (canvas.height - (2 * padding)) / App.board.size);

  for (let y = App.board.size - 1; y >= 0; y -= 1) {
    for (let x = 0; x < App.board.size; x += 1) {
      const coords = new Array(App.board.dimensions).fill(0);
      for (let axis = 0; axis < App.board.dimensions; axis += 1) {
        coords[axis] = fixed[axis];
      }
      coords[axisX] = x;
      coords[axisY] = y;

      const idx = App.board.coordsToIndex(coords);
      const value = App.board.cells[idx];
      const drawX = padding + (x * cell);
      const drawY = padding + ((App.board.size - 1 - y) * cell);
      drawCell(ctx, drawX, drawY, cell, value);
    }
  }

  drawAxisText(ctx, `Slice axes: ${axisX} (x), ${axisY} (y)`, canvas.height - 16);
}

function drawCell(ctx, x, y, size, value, alpha = 1) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = "#102136";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
  ctx.lineWidth = 1;
  ctx.fillRect(x, y, size - 2, size - 2);
  ctx.strokeRect(x, y, size - 2, size - 2);

  if (value !== 0) {
    const player = getPlayerStyle(value);
    ctx.beginPath();
    ctx.arc(x + (size / 2), y + (size / 2), Math.max(8, size * 0.34), 0, Math.PI * 2);
    ctx.fillStyle = player.color;
    ctx.fill();
    ctx.strokeStyle = "#04101d";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#04101d";
    ctx.font = `700 ${Math.max(12, Math.floor(size * 0.26))}px "Space Grotesk", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(player.token, x + (size / 2), y + (size / 2) + 1);
  }

  ctx.globalAlpha = 1;
}

function drawAxisText(ctx, text, y) {
  ctx.fillStyle = "#9fb0c7";
  ctx.font = "14px 'Space Grotesk', sans-serif";
  ctx.textAlign = "left";
  ctx.textBaseline = "alphabetic";
  ctx.fillText(text, 16, y);
}

$(document).ready(() => {
  applyPageDefaults();
  updatePageMeta(readConfig());
  initGame();

  $("#resetDefaultsBtn").on("click", () => {
    applyPageDefaults();
    initGame();
  });

  $("#newGameBtn").on("click", () => {
    initGame();
  });

  $("#playMoveBtn").on("click", () => {
    playMove(getSelectedDropCoords());
  });

  $("#undoBtn").on("click", () => {
    if (!App.board) return;

    App.aiRequestId += 1;
    if (App.gameOver) App.gameOver = false;

    const undone = App.board.undoLastMove();
    if (!undone) {
      updateStatus("Nothing to undo");
      return;
    }

    nextPlayer();
    $("#lastAIMove").text("");
    drawBoard();
    updateStatus("Undid last move");
  });

  $("#playerCountInput, #sizeInput, #dimensionsInput, #connectInput, #gravityAxisInput, #player2Type").on("input change", () => {
    updatePageMeta(readConfig());
  });

  $("#boardCanvas").on("click", (event) => {
    if (!App.board || App.gameOver || PAGE.renderMode !== "2d" || App.board.dimensions !== 2) return;
    if (getCurrentPlayer().type !== "human") return;

    const rect = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const padding = 24;
    const cell = Math.min(
      (event.currentTarget.width - (2 * padding)) / App.board.size,
      (event.currentTarget.height - (2 * padding)) / App.board.size
    );
    const col = Math.floor((x - padding) / cell);
    if (col < 0 || col >= App.board.size) return;

    $("#dropCoord_0").val(col);
    playMove([col]);
  });
});
