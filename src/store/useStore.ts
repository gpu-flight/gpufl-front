import { create } from 'zustand';
import { Session, TraceEvent, HostMetricSample, DeviceMetricSample, InitResponse, SystemMetricsResponse } from '@/types';

export type HostMetricKey = 'cpuPct' | 'ramUsedMib' | 'ramTotalMib';
export type DeviceMetricKey = 'utilGpu' | 'utilMem' | 'tempC' | 'memUsedMib' | 'memTotalMib' | 'powerW' | 'fanSpeedPct';
export type MetricKey = HostMetricKey | DeviceMetricKey;

interface AppState {
  sessions: Session[];
  events: TraceEvent[];
  hostMetrics: HostMetricSample[];
  deviceMetrics: DeviceMetricSample[];
  metricsRange?: { start_ns: number; end_ns: number };
  globalRange?: { start_ns: number; end_ns: number };
  currentSessionId?: string;
  activeEventId?: string;
  highlightRange?: { start_ns: number; end_ns: number };
  metricVisibility: Record<MetricKey, boolean>;

  // derived
  currentSession?: Session;
  activeEvent?: TraceEvent;

  // actions
  fetchInit: () => Promise<void>;
  fetchSystemMetrics: (sessionId: string) => Promise<void>;
  selectSession: (id: string) => void;
  setActiveEvent: (id?: string) => void;
  setMetricVisibility: (key: MetricKey, visible: boolean) => void;
  updateGlobalRange: () => void;
}

export const useStore = create<AppState>((set, get) => ({
  sessions: [],
  events: [],
  hostMetrics: [],
  deviceMetrics: [],
  metricsRange: undefined,
  globalRange: undefined,
  metricVisibility: {
    cpuPct: true,
    ramUsedMib: true,
    ramTotalMib: false,
    utilGpu: true,
    utilMem: true,
    tempC: true,
    memUsedMib: true,
    memTotalMib: false,
    powerW: true,
    fanSpeedPct: false,
  },
  fetchInit: async () => {
    try {
      const res = await fetch('http://localhost:8080/api/v1/events/init');
      const data: InitResponse = await res.json();
      
      const sessions: Session[] = data.map(s => ({
        sessionId: s.sessionId,
        appName: s.app,
        startTime: s.tsNs / 1_000_000_000,
        totalEvents: s.kernels.length + s.scopes.length,
        gpuCount: s.cudaStaticDevices.length,
      }));

      const events: TraceEvent[] = data.flatMap(s => {
        const kernels: TraceEvent[] = s.kernels.map((k: any) => ({
          id: k.id,
          sessionId: s.sessionId,
          type: 'kernel' as const,
          name: k.name,
          ts_ns: k.startNs,
          duration_ns: k.durationNs,
          user_scope: k.userScope,
          stack_trace: k.stackTrace,
          stream_id: k.streamId || 0, // Fallback to 0 if not present
          grid: k.grid,
          block: k.block,
        }));

        const scopes: TraceEvent[] = s.scopes.map((sc: any) => ({
          id: sc.id,
          sessionId: s.sessionId,
          type: 'scope' as const,
          name: sc.name,
          ts_ns: sc.tsNs,
          duration_ns: sc.durationNs || 0,
          user_scope: sc.userScope,
          depth: sc.scopeDepth,
        })).sort((a, b) => a.ts_ns - b.ts_ns);

        // Estimate duration if missing
        for (let i = 0; i < scopes.length; i++) {
          if (scopes[i].duration_ns === 0) {
            // Find next scope at same or parent depth
            const next = scopes.slice(i + 1).find(ns => (ns.depth || 0) <= (scopes[i].depth || 0));
            if (next) {
              scopes[i].duration_ns = next.ts_ns - scopes[i].ts_ns;
            } else if (s.shutdownTsNs) {
              scopes[i].duration_ns = s.shutdownTsNs - scopes[i].ts_ns;
            }
            
            // Ensure minimum duration
            if (scopes[i].duration_ns <= 0) scopes[i].duration_ns = 1000; 
          }
        }

        return [...kernels, ...scopes];
      });

      set({
        sessions,
        events,
      });
      get().updateGlobalRange();
    } catch (err) {
      console.error('Failed to fetch init data', err);
    }
  },
  fetchSystemMetrics: async (sessionId: string) => {
    try {
      const res = await fetch(`http://localhost:8080/api/v1/events/system?sessionId=${sessionId}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      const rawData = await res.json();
      
      // The API returns an array of objects, take the first one
      const data: SystemMetricsResponse = Array.isArray(rawData) ? rawData[0] : rawData;
      
      if (!data) {
        set({ hostMetrics: [], deviceMetrics: [], metricsRange: undefined });
        return;
      }

      const hostMetrics = data.hostMetrics || [];
      const deviceMetrics = (data.deviceMetrics || []).map((m: any) => ({
        ...m,
        // Map backend names to frontend expected names
        memUsedMib: m.memUsedMib ?? m.usedMib ?? 0,
        memTotalMib: m.memTotalMib ?? m.totalMib ?? 0,
        powerW: m.powerW ?? (m.powerMw ? m.powerMw / 1000 : 0),
        fanSpeedPct: m.fanSpeedPct ?? 0,
      }));
      
      let startNs = data.rangeStart;
      let endNs = data.rangeEnd;

      // Fallback: Calculate range from data if missing
      if (!startNs || !endNs || startNs >= endNs) {
        const allTs = [
          ...hostMetrics.map(m => m.tsNs),
          ...deviceMetrics.map(m => m.tsNs)
        ];
        if (allTs.length > 1) {
          startNs = Math.min(...allTs);
          endNs = Math.max(...allTs);
        } else if (allTs.length === 1) {
          startNs = allTs[0] - 500_000; // 0.5ms before
          endNs = allTs[0] + 500_000;  // 0.5ms after
        }
      }

      // Ensure minimum duration of 1ms
      if (startNs && endNs && endNs - startNs < 1_000_000) {
        const center = (startNs + endNs) / 2;
        startNs = center - 500_000;
        endNs = center + 500_000;
      }

      set({
        hostMetrics,
        deviceMetrics,
        metricsRange: startNs && endNs ? { start_ns: startNs, end_ns: endNs } : undefined,
      });
      get().updateGlobalRange();
    } catch (err) {
      console.error('Failed to fetch system metrics', err);
      set({ hostMetrics: [], deviceMetrics: [], metricsRange: undefined });
    }
  },
  selectSession: (id: string) => {
    set({ currentSessionId: id });
    get().updateGlobalRange();
  },
  setActiveEvent: (id?: string) => {
    if (!id) return set({ activeEventId: undefined, highlightRange: undefined });
    const ev = get().events.find((e) => e.id === id);
    if (!ev) return;
    set({
      activeEventId: id,
      highlightRange: { start_ns: ev.ts_ns, end_ns: ev.ts_ns + ev.duration_ns },
    });
  },
  setMetricVisibility: (key, visible) =>
    set((s) => ({ metricVisibility: { ...s.metricVisibility, [key]: visible } })),
  updateGlobalRange: () => {
    const { events, hostMetrics, deviceMetrics, currentSessionId } = get();
    if (!currentSessionId) return;

    const sessionEvents = events.filter(e => e.sessionId === currentSessionId);
    let minNs = Infinity;
    let maxNs = -Infinity;

    for (const e of sessionEvents) {
      if (e.ts_ns < minNs) minNs = e.ts_ns;
      if (e.ts_ns + e.duration_ns > maxNs) maxNs = e.ts_ns + e.duration_ns;
    }

    for (const m of hostMetrics) {
      if (m.tsNs < minNs) minNs = m.tsNs;
      if (m.tsNs > maxNs) maxNs = m.tsNs;
    }

    for (const m of deviceMetrics) {
      if (m.tsNs < minNs) minNs = m.tsNs;
      if (m.tsNs > maxNs) maxNs = m.tsNs;
    }

    if (minNs !== Infinity && maxNs !== -Infinity) {
      // Ensure at least 1ms
      if (maxNs - minNs < 1_000_000) {
        const center = (minNs + maxNs) / 2;
        minNs = center - 500_000;
        maxNs = center + 500_000;
      }
      set({ globalRange: { start_ns: minNs, end_ns: maxNs } });
    }
  },

  get currentSession() {
    const state = get();
    return state.sessions.find((s) => s.sessionId === state.currentSessionId);
  },
  get activeEvent() {
    const state = get();
    return state.events.find((e) => e.id === state.activeEventId);
  },
}));
