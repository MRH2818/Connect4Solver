import { NDBoard } from './board';
import { GameSnapshot, Player } from './types';

export class ConnectNGame {
  board: NDBoard;
  currentPlayer: Player = 1;
  winner: Player | null = null;
  history: { move: number[]; player: Player }[] = [];

  constructor(public readonly size: number, public readonly dimensions: number) {
    this.board = new NDBoard(size, dimensions);
  }

  static fromSnapshot(snapshot: GameSnapshot): ConnectNGame {
    const game = new ConnectNGame(snapshot.size, snapshot.dimensions);
    game.board.loadCells(snapshot.cells, snapshot.lastMoveCoords);
    game.currentPlayer = snapshot.currentPlayer;
    game.winner = snapshot.winner;
    return game;
  }

  reset(): void {
    this.board = new NDBoard(this.size, this.dimensions);
    this.currentPlayer = 1;
    this.winner = null;
    this.history = [];
  }

  play(move: number[]): boolean {
    if (this.winner) return false;
    const result = this.board.addDrop(move, this.currentPlayer);
    if (!result.ok) return false;

    this.history.push({ move: [...move], player: this.currentPlayer });
    if (this.board.checkWin(this.currentPlayer)) {
      this.winner = this.currentPlayer;
      return true;
    }

    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    return true;
  }

  undo(): boolean {
    if (this.history.length === 0) return false;
    const replay = [...this.history];
    replay.pop();
    this.reset();
    replay.forEach((h) => {
      this.play(h.move);
    });
    return true;
  }

  snapshot(): GameSnapshot {
    return {
      size: this.size,
      dimensions: this.dimensions,
      cells: [...this.board.cells],
      currentPlayer: this.currentPlayer,
      winner: this.winner,
      draw: this.board.isDraw(),
      lastMoveCoords: this.board.lastPlacedCoords ? [...this.board.lastPlacedCoords] : null
    };
  }
}
