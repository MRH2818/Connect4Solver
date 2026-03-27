import { describe, expect, it } from 'vitest';
import { NDBoard } from '../src/engine/board';
import { coordsToIndex, getAllDirections, indexToCoords } from '../src/engine/math';
import { ConnectNGame } from '../src/engine/game';
import { getDropAxes, moveFromSlice } from '../src/engine/projection';

describe('N-dimensional engine math', () => {
  it('round-trips coords/index in 2d/3d/4d', () => {
    [2, 3, 4].forEach((dimensions) => {
      const size = 5;
      const coords = new Array(dimensions).fill(0).map((_, i) => (i + 1) % size);
      const idx = coordsToIndex(coords, size);
      const back = indexToCoords(idx, dimensions, size);
      expect(back).toEqual(coords);
    });
  });

  it('creates canonical direction count', () => {
    expect(getAllDirections(2)).toHaveLength(4);
    expect(getAllDirections(3)).toHaveLength(13);
    expect(getAllDirections(4)).toHaveLength(40);
  });
});

describe('NDBoard gameplay', () => {
  it('applies gravity in 2D', () => {
    const b = new NDBoard(7, 2);
    b.addDrop([3], 1);
    b.addDrop([3], 2);
    expect(b.cells[b.coordsToIndex([3, 0])]).toBe(1);
    expect(b.cells[b.coordsToIndex([3, 1])]).toBe(2);
  });

  it('detects 3D line win', () => {
    const b = new NDBoard(4, 3);
    b.addDrop([0, 0], 1);
    b.addDrop([1, 0], 1);
    b.addDrop([2, 0], 1);
    b.addDrop([3, 0], 1);
    expect(b.checkWin(1)).toBe(true);
  });

  it('detects 4D diagonal win', () => {
    const b = new NDBoard(4, 4);
    for (let i = 0; i < 4; i += 1) {
      for (let s = 0; s < i; s += 1) b.addDrop([i, i, i], 2);
      b.addDrop([i, i, i], 1);
    }
    expect(b.checkWin(1)).toBe(true);
  });

  it('marks full columns unavailable', () => {
    const b = new NDBoard(4, 2);
    for (let i = 0; i < 4; i += 1) b.addDrop([0], 1);
    expect(b.getAvailableMoves().find((m) => m[0] === 0)).toBeUndefined();
  });

  it('rebuilds availability from loaded snapshot cells', () => {
    const b = new NDBoard(4, 2);
    for (let i = 0; i < 4; i += 1) b.addDrop([1], 1);
    const loaded = new NDBoard(4, 2);
    loaded.loadCells([...b.cells], b.lastPlacedCoords);
    expect(loaded.getAvailableMoves().find((m) => m[0] === 1)).toBeUndefined();
  });
});

describe('Integration & parity', () => {
  it('replays the same line in 2D and 3D(z=0) with matching winner', () => {
    const line2D = new ConnectNGame(7, 2);
    const line3D = new ConnectNGame(7, 3);
    const script = [
      [0],
      [0],
      [1],
      [1],
      [2],
      [2],
      [3]
    ];

    script.forEach((m) => {
      line2D.play(m);
      line3D.play([m[0], 0]);
    });

    expect(line2D.winner).toBe(1);
    expect(line3D.winner).toBe(1);
  });

  it('supports slice move mapping in 5D', () => {
    const move = moveFromSlice(5, 0, 3, { 2: 1, 4: 2 }, 3, 0);
    expect(move).toEqual([3, 1, 0, 2]);
    expect(getDropAxes(5)).toEqual([0, 2, 3, 4]);
  });
});

describe('Performance budgets', () => {
  it('handles moderate 4D stress loop quickly', () => {
    const game = new ConnectNGame(5, 4);
    const start = Date.now();
    for (let i = 0; i < 250; i += 1) {
      const moves = game.board.getAvailableMoves();
      const move = moves[i % moves.length];
      game.play(move);
      if (game.winner || game.board.isDraw()) game.reset();
    }
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(250);
  });
});
