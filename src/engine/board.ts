import { Cell, MoveResult, Player } from './types';
import { coordsToIndex, getAllDirections, indexToCoords, isInBounds, powInt } from './math';

export class NDBoard {
  readonly size: number;
  readonly dimensions: number;
  readonly directions: number[][];
  readonly cells: Cell[];
  readonly availableToPlay: boolean[];
  lastPlacedIndex: number | null = null;
  lastPlacedCoords: number[] | null = null;

  constructor(size: number, dimensions: number) {
    if (dimensions < 2) throw new Error('dimensions must be >= 2');
    this.size = size;
    this.dimensions = dimensions;
    this.cells = new Array<Cell>(powInt(size, dimensions)).fill(0);
    this.availableToPlay = new Array<boolean>(powInt(size, dimensions - 1)).fill(true);
    this.directions = getAllDirections(dimensions);
  }

  clone(): NDBoard {
    const b = new NDBoard(this.size, this.dimensions);
    b.cells.splice(0, b.cells.length, ...this.cells);
    b.availableToPlay.splice(0, b.availableToPlay.length, ...this.availableToPlay);
    b.lastPlacedIndex = this.lastPlacedIndex;
    b.lastPlacedCoords = this.lastPlacedCoords ? [...this.lastPlacedCoords] : null;
    return b;
  }

  loadCells(cells: Cell[], lastMoveCoords: number[] | null): void {
    if (cells.length !== this.cells.length) throw new Error('invalid cell data length');
    this.cells.splice(0, this.cells.length, ...cells);
    this.lastPlacedCoords = lastMoveCoords ? [...lastMoveCoords] : null;
    this.lastPlacedIndex = lastMoveCoords ? this.coordsToIndex(lastMoveCoords) : null;
    this.rebuildAvailability();
  }

  rebuildAvailability(): void {
    this.availableToPlay.fill(true);
    for (let m = 0; m < this.availableToPlay.length; m += 1) {
      const dropCoords = this.dropMoveCoords(m);
      const top = [dropCoords[0], this.size - 1, ...dropCoords.slice(1)];
      if (this.cells[this.coordsToIndex(top)] !== 0) this.availableToPlay[m] = false;
    }
  }

  coordsToIndex(coords: number[]): number {
    if (coords.length !== this.dimensions) throw new Error('coords length mismatch');
    return coordsToIndex(coords, this.size);
  }

  indexToCoords(index: number): number[] {
    return indexToCoords(index, this.dimensions, this.size);
  }

  dropMoveIndex(dropCoords: number[]): number {
    if (dropCoords.length !== this.dimensions - 1) throw new Error('drop coords mismatch');
    return coordsToIndex(dropCoords, this.size);
  }

  dropMoveCoords(index: number): number[] {
    return indexToCoords(index, this.dimensions - 1, this.size);
  }

  getAvailableMoves(): number[][] {
    const out: number[][] = [];
    this.availableToPlay.forEach((ok, i) => {
      if (ok) out.push(this.dropMoveCoords(i));
    });
    return out;
  }

  addDrop(dropCoords: number[], player: Player): MoveResult {
    if (dropCoords.length !== this.dimensions - 1) return { ok: false, reason: 'invalid move arity' };
    const dropIdx = this.dropMoveIndex(dropCoords);
    if (!this.availableToPlay[dropIdx]) return { ok: false, reason: 'column full' };

    const base = [dropCoords[0], 0, ...dropCoords.slice(1)];
    let idx = this.coordsToIndex(base);
    for (let h = 0; h < this.size; h += 1) {
      if (this.cells[idx] === 0) {
        this.cells[idx] = player;
        base[1] = h;
        this.lastPlacedIndex = idx;
        this.lastPlacedCoords = [...base];
        if (h + 1 === this.size) this.availableToPlay[dropIdx] = false;
        return { ok: true, placedIndex: idx, placedCoords: [...base] };
      }
      idx += this.size;
    }
    this.availableToPlay[dropIdx] = false;
    return { ok: false, reason: 'column full' };
  }

  checkWin(player: Player): boolean {
    if (this.lastPlacedIndex == null || this.lastPlacedCoords == null) return false;
    for (const d of this.directions) {
      let streak = 1;
      for (const sign of [1, -1] as const) {
        let c = [...this.lastPlacedCoords];
        while (true) {
          c = c.map((v, i) => v + d[i] * sign);
          if (!isInBounds(c, this.size)) break;
          const idx = this.coordsToIndex(c);
          if (this.cells[idx] !== player) break;
          streak += 1;
        }
      }
      if (streak >= 4) return true;
    }
    return false;
  }

  isDraw(): boolean {
    return this.cells.every((c) => c !== 0);
  }
}
