import { ConnectNGame } from '../engine/game';
import { Agent } from './types';
import { getLegalMoves } from './utils';

const terminalScore = (game: ConnectNGame, me: 1 | 2, depth: number): number => {
  if (game.winner === me) return 10000 - depth;
  if (game.winner && game.winner !== me) return -10000 + depth;
  return 0;
};

const search = (game: ConnectNGame, me: 1 | 2, depth: number, maxDepth: number, deadline: number): number => {
  const now = performance.now();
  if (now >= deadline) return 0;

  const term = terminalScore(game, me, depth);
  if (term !== 0) return term;
  if (depth >= maxDepth || game.board.isDraw()) return 0;

  const moves = getLegalMoves(game.snapshot());
  if (moves.length === 0) return 0;

  let best = -Infinity;
  for (const move of moves) {
    const next = ConnectNGame.fromSnapshot(game.snapshot());
    next.play(move);
    const score = -search(next, me, depth + 1, maxDepth, deadline);
    if (score > best) best = score;
  }
  return best;
};

export const strategicAgent: Agent = {
  id: 'strategic-lite',
  async chooseMove(snapshot, context) {
    const moves = getLegalMoves(snapshot);
    if (moves.length === 0 || context?.signal?.aborted) return null;

    const me = snapshot.currentPlayer;
    const maxDepth = snapshot.dimensions >= 4 ? 1 : 2;
    const deadline = performance.now() + (context?.maxTimeMs ?? 250);

    let best = moves[0];
    let bestScore = -Infinity;

    for (const move of moves) {
      if (context?.signal?.aborted) return null;
      const next = ConnectNGame.fromSnapshot(snapshot);
      next.play(move);
      const score = -search(next, me, 1, maxDepth, deadline);
      if (score > bestScore) {
        bestScore = score;
        best = move;
      }
      if (performance.now() >= deadline) break;
    }

    return best;
  }
};
