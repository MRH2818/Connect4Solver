/* eslint-disable no-restricted-globals */

class WorkerBoard {
  constructor(state) {
    this.size = state.size;
    this.dimensions = state.dimensions;
    this.gravityAxis = state.gravityAxis;
    this.connectN = state.connectN;
    this.cells = Int8Array.from(state.cells);
    this.availableToPlay = Uint8Array.from(state.availableToPlay);
    this.directions = getAllDirections(this.dimensions);
  }

  ipow(base, exp) {
    let result = 1;
    for (let i = 0; i < exp; i += 1) result *= base;
    return result;
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

  isDropLegal(dropCoords) {
    const moveIndex = this.dropMoveIndex(dropCoords);
    if (moveIndex < 0 || moveIndex >= this.availableToPlay.length) return false;
    return this.availableToPlay[moveIndex] === 1;
  }

  addDrop(dropCoords, player) {
    if (!this.isDropLegal(dropCoords)) return null;
    const landing = this.findLanding(dropCoords);
    if (!landing) return null;

    this.cells[landing.index] = player;

    const moveIndex = this.dropMoveIndex(dropCoords);
    const topCoords = this.dropToFullCoords(dropCoords, this.size - 1);
    const topIndex = this.coordsToIndex(topCoords);
    if (this.cells[topIndex] !== 0) {
      this.availableToPlay[moveIndex] = 0;
    }

    return landing;
  }

  checkWinAt(player, lastIndex, lastCoords) {
    for (const dir of this.directions) {
      let streak = 1;
      streak += this.walkRay(lastIndex, lastCoords, dir, player);
      streak += this.walkRay(lastIndex, lastCoords, dir.map((v) => -v), player);
      if (streak >= this.connectN) return true;
    }
    return false;
  }

  walkRay(startIndex, startCoords, dir, player) {
    const step = this.coordsToIndex(dir);
    let count = 0;
    let index = startIndex + step;
    const coords = startCoords.slice();
    for (let i = 0; i < this.dimensions; i += 1) coords[i] += dir[i];

    while (inBounds(coords, this.size) && this.cells[index] === player) {
      count += 1;
      for (let i = 0; i < this.dimensions; i += 1) coords[i] += dir[i];
      index += step;
    }
    return count;
  }

  getAvailableMoves() {
    const totalDropAxes = this.dimensions - 1;
    const total = this.ipow(this.size, totalDropAxes);
    const moves = [];

    for (let moveIndex = 0; moveIndex < total; moveIndex += 1) {
      if (this.availableToPlay[moveIndex] === 0) continue;
      let temp = moveIndex;
      const coords = new Array(totalDropAxes).fill(0);
      for (let i = 0; i < totalDropAxes; i += 1) {
        coords[i] = temp % this.size;
        temp = Math.floor(temp / this.size);
      }
      moves.push(coords);
    }

    return moves;
  }

  cloneState() {
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

function inBounds(coords, size) {
  return coords.every((coord) => coord >= 0 && coord < size);
}

function ipow(base, exp) {
  let result = 1;
  for (let i = 0; i < exp; i += 1) result *= base;
  return result;
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

function chooseMoveWithHeuristic(state, player, opponent) {
  const board = new WorkerBoard(state);
  const legalMoves = board.getAvailableMoves();
  if (!legalMoves.length) return null;

  for (const move of legalMoves) {
    const probe = new WorkerBoard(board.cloneState());
    const landing = probe.addDrop(move, player);
    if (landing && probe.checkWinAt(player, landing.index, landing.coords)) {
      return { move, reason: "Immediate win" };
    }
  }

  for (const move of legalMoves) {
    const probe = new WorkerBoard(board.cloneState());
    const landing = probe.addDrop(move, opponent);
    if (landing && probe.checkWinAt(opponent, landing.index, landing.coords)) {
      return { move, reason: "Block opponent win" };
    }
  }

  const center = (board.size - 1) / 2;
  let best = legalMoves[0];
  let bestScore = Number.POSITIVE_INFINITY;
  for (const move of legalMoves) {
    let score = 0;
    for (const coord of move) {
      const distance = coord - center;
      score += distance * distance;
    }
    if (score < bestScore) {
      bestScore = score;
      best = move;
    }
  }

  return { move: best, reason: "Center heuristic" };
}

self.onmessage = (event) => {
  const { type, payload } = event.data;
  if (type !== "chooseMove") return;

  const { requestId, state, aiPlayer, humanPlayer } = payload;
  const result = chooseMoveWithHeuristic(state, aiPlayer, humanPlayer);
  self.postMessage({
    type: "moveResult",
    payload: result ? { ...result, requestId } : { requestId },
  });
};
