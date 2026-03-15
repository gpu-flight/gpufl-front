export interface CudaGpuInfo {
  deviceId: number;
  name: string;
  uuid: string;
  computeMajor: string;
  computeMinor: string;
  multiProcessorCount: number;
  warpSize: number;
}

export interface Session {
  sessionId: string;
  appName: string;
  startTime: number; // Unix timestamp (seconds)
  endTime?: number;  // Unix timestamp (seconds), absent if still running
  totalEvents: number;
  gpuCount: number;
  hostname?: string;
  ipAddr?: string;
  gpus?: CudaGpuInfo[];
}

export type TraceEventType = 'kernel' | 'scope';

export interface TraceEvent {
  id: string;
  sessionId: string;
  type: TraceEventType;
  name: string;
  ts_ns: number;       // Display start time (apiStartNs)
  duration_ns: number; // GPU Execution (end_ns - start_ns)
  total_duration_ns?: number; // Total Duration (Max(end, api_exit) - api_start)
  cpu_overhead_ns?: number;   // CPU Overhead (apiExitNs - apiStartNs)
  queue_latency_ns?: number;  // Queue Latency (Max(0, start_ns - apiExitNs))
  api_duration_ns?: number; // Obsolete but keeping for compatibility if needed, though we should prefer cpu_overhead_ns
  launch_latency_ns?: number; // Obsolete but keeping for compatibility
  start_ns: number;    // Internal start time (GPU)
  end_ns: number;      // Internal end time (GPU)
  apiStartNs?: number;
  apiExitNs?: number;
  user_scope: string;  // e.g., "Training|Epoch1|Forward"
  stack_trace?: string; // e.g., "main|funcA|funcB" (Raw stack)

  // For Kernels only
  stream_id?: number;
  grid?: string;
  block?: string;

  // For Scopes only
  depth?: number;
  
  // Relationships
  parent_scope_id?: string;
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

// Host summary from GET /api/v1/events/hosts
export interface SessionSummary {
  sessionId: string;
  appName: string;
  startTime: string; // ISO instant
  endTime?: string;
  gpus: CudaGpuInfo[];
}

export interface HostSummary {
  hostname: string;
  ipAddr?: string;
  sessions: SessionSummary[];
}

export interface ProfileSample {
  id: string;
  sessionId: string;
  scopeName?: string;
  sampleKind: 'sass_metric' | 'pc_sampling';
  functionName?: string;
  pcOffset?: string;
  sourceFile?: string;
  sourceLine?: number;
  instExecuted: number;
  threadInstExecuted: number;
  stallReason?: number;
  reasonName?: string;
  sampleCount: number;
  occurrenceCount: number;
}
