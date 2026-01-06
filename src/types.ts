export interface Session {
  sessionId: string;
  appName: string;
  startTime: number; // Unix timestamp
  totalEvents: number;
  gpuCount: number;
}

export type TraceEventType = 'kernel' | 'scope';

export interface TraceEvent {
  id: string;
  sessionId: string;
  type: TraceEventType;
  name: string;
  ts_ns: number;       // Start time in nanoseconds
  duration_ns: number; // Duration in nanoseconds
  user_scope: string;  // e.g., "Training|Epoch1|Forward"
  stack_trace?: string; // e.g., "main|funcA|funcB" (Raw stack)

  // For Kernels only
  stream_id?: number;
  grid?: string;
  block?: string;

  // For Scopes only
  depth?: number;
}

export interface MetricSample {
  sessionId: string;
  ts_ns: number;
  gpu_id: number;
  temperature?: number;
  memory_used_mb?: number;
  gpu_utilization?: number;
}
