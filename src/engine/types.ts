export type Player = 1 | 2;
export type Cell = 0 | Player;

export interface MoveResult {
  ok: boolean;
  placedIndex?: number;
  placedCoords?: number[];
  reason?: string;
}

export interface GameSnapshot {
  size: number;
  dimensions: number;
  cells: Cell[];
  currentPlayer: Player;
  winner: Player | null;
  draw: boolean;
  lastMoveCoords: number[] | null;
}
