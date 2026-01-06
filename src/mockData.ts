import { MetricSample, Session, TraceEvent } from './types';

function randBetween(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

export interface MockPayload {
  sessions: Session[];
  events: TraceEvent[];
  metrics: MetricSample[];
}

export function generateMockData(): MockPayload {
  const sessionId = 'sess-001';
  const startTsMs = Date.now() - 1000 * 60 * 10; // 10 min ago
  const startNs = startTsMs * 1_000_000;

  const gpuCount = 2;

  const scopes: TraceEvent[] = [];
  const kernels: TraceEvent[] = [];
  const metrics: MetricSample[] = [];

  // Generate nested scopes (approx 50)
  let currentNs = startNs;
  const scopeDepthMax = 5;
  const scopeCount = 50;
  for (let i = 0; i < scopeCount; i++) {
    const depth = i % scopeDepthMax;
    const dur = Math.floor(randBetween(1e6, 30e6)); // 1-30 ms in ns
    const name = `Scope_${Math.floor(i / scopeDepthMax)}_${depth}`;
    const user_scope = `Training|Epoch${1 + Math.floor(i / 10)}|Step${i}`;
    const stack_trace = `main|trainer|${name}`;
    scopes.push({
      id: `scope-${i}`,
      sessionId,
      type: 'scope',
      name,
      ts_ns: currentNs,
      duration_ns: dur,
      user_scope,
      depth,
      stack_trace,
    });
    currentNs += Math.floor(dur * 0.6); // overlap a bit for flame style
  }

  // Generate kernels on 4 streams per GPU (approx 200)
  const streamsPerGpu = 4;
  const kernelCount = 200;
  for (let i = 0; i < kernelCount; i++) {
    const gpu = i % gpuCount;
    const stream = i % (gpuCount * streamsPerGpu);
    const ts = startNs + Math.floor(randBetween(0, 9 * 60 * 1e9)); // within 9 minutes
    const dur = Math.floor(randBetween(100e3, 5e6)); // 0.1-5 ms
    const grid = `${1 + (i % 64)}x${1 + (i % 32)}x1`;
    const block = `${32 + (i % 224)}x1x1`;
    kernels.push({
      id: `kern-${i}`,
      sessionId,
      type: 'kernel',
      name: `Kernel_${i % 20}`,
      ts_ns: ts,
      duration_ns: dur,
      user_scope: `GPU${gpu}|Stream${stream}`,
      stack_trace: `main|cudaLaunch|Kernel_${i % 20}`,
      stream_id: stream,
      grid,
      block,
    });
  }

  // Metrics every second for each GPU across 10 minutes
  const samples = 10 * 60; // 10 minutes
  for (let s = 0; s < samples; s++) {
    for (let g = 0; g < gpuCount; g++) {
      const ts_ns = startNs + s * 1e9;
      metrics.push({
        sessionId,
        ts_ns,
        gpu_id: g,
        temperature: Math.round(45 + 25 * Math.sin(s / 20 + g)),
        memory_used_mb: Math.round(2000 + 1000 * Math.abs(Math.sin(s / 30 + g))),
        gpu_utilization: Math.round(30 + 60 * Math.abs(Math.sin(s / 15 + g))),
      });
    }
  }

  const sessions: Session[] = [
    {
      sessionId,
      appName: 'ResNet50 Training',
      startTime: Math.floor(startTsMs / 1000), // seconds
      totalEvents: scopes.length + kernels.length,
      gpuCount,
    },
  ];

  return {
    sessions,
    events: [...scopes, ...kernels],
    metrics,
  };
}
