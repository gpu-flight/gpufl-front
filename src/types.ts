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

export interface HostMetricSample {
  id: string;
  sessionId: string;
  time: string;
  tsNs: number;
  hostname: string;
  cpuPct: number;
  ramUsedMib: number;
  ramTotalMib: number;
}

export interface DeviceMetricSample {
  id: string;
  sessionId: string;
  time: string;
  tsNs: number;
  deviceId: number;
  utilGpu: number;
  utilMem: number;
  tempC: number;
  memUsedMib: number;
  memTotalMib: number;
  powerW: number;
  fanSpeedPct: number;
}

export interface SystemMetricsResponse {
  rangeStart: number;
  rangeEnd: number;
  hostMetrics: HostMetricSample[];
  deviceMetrics: DeviceMetricSample[];
}

export interface RawSession {
  sessionId: string;
  app: string;
  time: string;
  tsNs: number;
  shutdownTsNs: number;
  systemRateMs: number;
  hostMetrics: HostMetricSample[];
  deviceMetrics?: DeviceMetricSample[]; // Might not be in init
  cudaStaticDevices: any[];
  kernels: any[];
  scopes: any[];
}

export type InitResponse = RawSession[];
