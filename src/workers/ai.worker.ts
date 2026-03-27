import { randomAgent } from '../agents/random';
import { strategicAgent } from '../agents/strategic';
import { Agent } from '../agents/types';
import { GameSnapshot } from '../engine/types';

type MoveRequest = {
  kind: 'choose';
  id: number;
  agent: string;
  snapshot: GameSnapshot;
  maxTimeMs?: number;
};

type CancelRequest = { kind: 'cancel'; id: number };

const agents: Record<string, Agent> = {
  random: randomAgent,
  strategic: strategicAgent
};

const active = new Map<number, AbortController>();

self.onmessage = async (event: MessageEvent<MoveRequest | CancelRequest>) => {
  const msg = event.data;

  if (msg.kind === 'cancel') {
    active.get(msg.id)?.abort();
    active.delete(msg.id);
    return;
  }

  const selected = agents[msg.agent] ?? randomAgent;
  const controller = new AbortController();
  active.set(msg.id, controller);
  const startedAt = performance.now();

  let timeout: number | undefined;
  if (msg.maxTimeMs && msg.maxTimeMs > 0) {
    timeout = self.setTimeout(() => controller.abort(), msg.maxTimeMs);
  }

  try {
    const move = await selected.chooseMove(msg.snapshot, {
      signal: controller.signal,
      maxTimeMs: msg.maxTimeMs
    });
    const elapsed = performance.now() - startedAt;
    (self as unknown as Worker).postMessage({ id: msg.id, move, elapsed, timeout: controller.signal.aborted });
  } finally {
    if (timeout != null) self.clearTimeout(timeout);
    active.delete(msg.id);
  }
};
