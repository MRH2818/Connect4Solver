import { GameSnapshot } from '../engine/types';
import { coordsToIndex } from '../engine/math';

export const getLegalMoves = (snapshot: GameSnapshot): number[][] => {
  const moves: number[][] = [];
  const moveDims = snapshot.dimensions - 1;
  const total = Math.pow(snapshot.size, moveDims);

  for (let m = 0; m < total; m += 1) {
    const coords = new Array<number>(moveDims).fill(0);
    let n = m;
    for (let i = 0; i < moveDims; i += 1) {
      coords[i] = n % snapshot.size;
      n = Math.floor(n / snapshot.size);
    }
    const full = [coords[0], snapshot.size - 1, ...coords.slice(1)];
    if (snapshot.cells[coordsToIndex(full, snapshot.size)] === 0) moves.push(coords);
  }
  return moves;
};
