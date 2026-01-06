import sampleData from './sample.json';
import { MetricSample, Session, TraceEvent } from './types';

export interface DataPayload {
  sessions: Session[];
  events: TraceEvent[];
  metrics: MetricSample[];
}

export function loadSampleData(): DataPayload {
  const sessions: Session[] = sampleData.map((s: any) => ({
    sessionId: s.sessionId,
    appName: s.app,
    startTime: Math.floor(s.tsNs / 1_000_000_000),
    totalEvents: (s.kernels?.length || 0) + (s.scopes?.length || 0),
    gpuCount: s.cudaStaticDevices?.length || 0,
  }));

  const events: TraceEvent[] = [];
  const metrics: MetricSample[] = [];

  sampleData.forEach((s: any) => {
    if (s.kernels) {
      s.kernels.forEach((k: any) => {
        events.push({
          id: k.id,
          sessionId: s.sessionId,
          type: 'kernel',
          name: k.name,
          ts_ns: k.startNs,
          duration_ns: k.durationNs,
          user_scope: k.userScope,
          stack_trace: k.stackTrace,
          stream_id: k.deviceId, // Use deviceId as stream_id for now
          grid: k.grid,
          block: k.block,
        });
      });
    }

    if (s.scopes) {
      // Sort scopes by tsNs to try and estimate duration if needed
      const sortedScopes = [...s.scopes].sort((a: any, b: any) => a.tsNs - b.tsNs);
      
      sortedScopes.forEach((sc: any, index: number) => {
        // Find next scope at same or lower depth to estimate duration
        let duration_ns = 1_000_000; // Default 1ms
        for (let i = index + 1; i < sortedScopes.length; i++) {
          if (sortedScopes[i].scopeDepth <= sc.scopeDepth) {
            duration_ns = Math.max(1, sortedScopes[i].tsNs - sc.tsNs);
            break;
          }
        }
        
        events.push({
          id: sc.id,
          sessionId: s.sessionId,
          type: 'scope',
          name: sc.name,
          ts_ns: sc.tsNs,
          duration_ns: duration_ns,
          user_scope: sc.userScope,
          depth: sc.scopeDepth,
        });
      });
    }

    if (s.hostMetrics) {
      s.hostMetrics.forEach((m: any) => {
        metrics.push({
          sessionId: s.sessionId,
          ts_ns: m.tsNs,
          gpu_id: 0, // Mapping host metrics to gpu_id 0 for visualization
          gpu_utilization: m.cpuPct,
          memory_used_mb: m.ramUsedMib,
        });
      });
    }
  });

  return {
    sessions,
    events,
    metrics,
  };
}
