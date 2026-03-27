import { GameSnapshot } from '../engine/types';

export interface AgentContext {
  signal?: AbortSignal;
  maxTimeMs?: number;
}

export interface Agent {
  id: string;
  chooseMove(snapshot: GameSnapshot, context?: AgentContext): Promise<number[] | null>;
}
