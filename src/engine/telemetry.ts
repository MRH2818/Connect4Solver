export interface TelemetryEvent {
  type: 'move_latency' | 'ai_latency' | 'ai_timeout';
  ms: number;
  meta?: Record<string, number | string | boolean>;
  at: number;
}

export class TelemetryBuffer {
  private readonly events: TelemetryEvent[] = [];

  push(event: Omit<TelemetryEvent, 'at'>): void {
    this.events.push({ ...event, at: Date.now() });
    if (this.events.length > 250) this.events.shift();
  }

  list(): TelemetryEvent[] {
    return [...this.events];
  }

  summary(): string {
    const byType: Record<string, number[]> = {};
    this.events.forEach((e) => {
      byType[e.type] ??= [];
      byType[e.type].push(e.ms);
    });
    return Object.entries(byType)
      .map(([type, vals]) => {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        const max = Math.max(...vals);
        return `${type}: n=${vals.length} avg=${avg.toFixed(1)}ms max=${max.toFixed(1)}ms`;
      })
      .join(' | ');
  }
}
