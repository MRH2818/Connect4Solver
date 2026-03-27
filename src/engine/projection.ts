import { ConnectNGame } from './game';
import { Cell } from './types';

export interface SliceView {
  axisA: number;
  axisB: number;
  fixed: Record<number, number>;
}

export interface SliceCell {
  x: number;
  y: number;
  topOwner: Cell;
  height: number;
  dropCoords: number[];
}

export const getDropAxes = (dimensions: number): number[] => {
  const axes: number[] = [0];
  for (let axis = 2; axis < dimensions; axis += 1) axes.push(axis);
  return axes;
};

export const moveFromSlice = (
  dimensions: number,
  axisA: number,
  axisB: number,
  fixed: Record<number, number>,
  x: number,
  y: number
): number[] => {
  const dropAxes = getDropAxes(dimensions);
  const dropCoords = new Array<number>(dimensions - 1).fill(0);
  dropAxes.forEach((axis, idx) => {
    if (axis === axisA) {
      dropCoords[idx] = x;
    } else if (axis === axisB) {
      dropCoords[idx] = y;
    } else {
      dropCoords[idx] = fixed[axis] ?? 0;
    }
  });
  return dropCoords;
};

export const makeSliceCells = (game: ConnectNGame, view: SliceView): SliceCell[] => {
  const cells: SliceCell[] = [];
  for (let x = 0; x < game.size; x += 1) {
    for (let y = 0; y < game.size; y += 1) {
      const dropCoords = moveFromSlice(game.dimensions, view.axisA, view.axisB, view.fixed, x, y);
      let topOwner: Cell = 0;
      let height = 0;

      const columnBase = [dropCoords[0], 0, ...dropCoords.slice(1)];
      let idx = game.board.coordsToIndex(columnBase);
      for (let h = 0; h < game.size; h += 1) {
        const v = game.board.cells[idx];
        if (v !== 0) {
          topOwner = v;
          height = h + 1;
        }
        idx += game.size;
      }

      cells.push({ x, y, topOwner, height, dropCoords });
    }
  }
  return cells;
};
