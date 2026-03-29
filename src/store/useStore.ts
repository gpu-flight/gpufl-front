import { create } from 'zustand';
import { Session, TraceEvent, HostMetricSample, DeviceMetricSample, InitResponse, SystemMetricsResponse, SystemEventRecord, HostSummary, ProfileSample, InsightDto } from '@/types';
import { apiFetch } from '@/api';

export type HostMetricKey = 'cpuPct' | 'ramUsedMib' | 'ramTotalMib';
export type DeviceMetricKey = 'utilGpu' | 'utilMem' | 'tempC' | 'memUsedMib' | 'memTotalMib' | 'powerW' | 'fanSpeedPct';
export type MetricKey = HostMetricKey | DeviceMetricKey;

interface AppState {
  hosts: HostSummary[];
  sessions: Session[];
  events: TraceEvent[];
  hostMetrics: HostMetricSample[];
  deviceMetrics: DeviceMetricSample[];
  systemEvents: SystemEventRecord[];
  profileSamples: ProfileSample[];
  insights: InsightDto[] | null;
  metricsRange?: { start_ns: number; end_ns: number };
  globalRange?: { start_ns: number; end_ns: number };
  currentSessionId?: string;
  activeEventId?: string;
  highlightRange?: { start_ns: number; end_ns: number };
  metricVisibility: Record<MetricKey, boolean>;
  activeTab: 'kernels' | 'scopes' | 'profile' | 'system' | 'insights';
  comparedScopeIds: string[];
  metricsZoomRange?: [number, number];
  activeScopeKey?: string;

  // derived
  currentSession?: Session;
  activeEvent?: TraceEvent;

  // actions
  fetchHosts: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  fetchInit: () => Promise<void>;
  fetchSystemMetrics: (sessionId: string) => Promise<void>;
  fetchProfileSamples: (sessionId: string) => Promise<void>;
  fetchInsights: (sessionId: string) => Promise<void>;
  selectSession: (id: string) => void;
  setActiveEvent: (id?: string) => void;
  setMetricVisibility: (key: MetricKey, visible: boolean) => void;
  updateGlobalRange: () => void;
  setActiveTab: (tab: 'kernels' | 'scopes' | 'profile' | 'system' | 'insights') => void;
  toggleComparedScope: (id: string) => void;
  setMetricsZoom: (range?: [number, number]) => void;
  setActiveScopeKey: (key?: string) => void;
  jumpToScope: (scopeId: string) => void;
}

export const useStore = create<AppState>((set, get) => ({
  hosts: [],
  sessions: [],
  events: [],
  hostMetrics: [],
  deviceMetrics: [],
  systemEvents: [],
  profileSamples: [],
  insights: null,
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
  activeTab: 'kernels' as 'kernels' | 'scopes' | 'profile' | 'system' | 'insights',
  comparedScopeIds: [],
  metricsZoomRange: undefined,
  activeScopeKey: undefined,
  fetchHosts: async () => {
    try {
      const res = await apiFetch('/api/v1/events/hosts');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: HostSummary[] = await res.json();
      set({ hosts: data });
    } catch (err) {
      console.error('Failed to fetch hosts', err);
    }
  },
  deleteSession: async (sessionId: string) => {
    const res = await apiFetch(`/api/v1/events/sessions/${encodeURIComponent(sessionId)}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`Failed to delete session: HTTP ${res.status}`);
    await get().fetchHosts();
  },
  fetchInit: async () => {
    try {
      const dateTo = new Date();
      const dateFrom = new Date(dateTo.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days back
      const res = await apiFetch(
        `/api/v1/events/init?dateFrom=${dateFrom.toISOString()}&dateTo=${dateTo.toISOString()}`
      );
      const data: InitResponse = await res.json();
      
      const sessions: Session[] = data.map(s => ({
        sessionId: s.sessionId,
        appName: s.app,
        startTime: s.tsNs / 1_000_000_000,
        endTime: s.shutdownTsNs ? s.shutdownTsNs / 1_000_000_000 : undefined,
        totalEvents: s.kernels.length + s.scopes.length,
        gpuCount: s.cudaStaticDevices.length,
        hostname: s.hostMetrics?.[0]?.hostname,
        ipAddr: s.hostMetrics?.[0]?.ipAddr,
        gpus: s.cudaStaticDevices?.map((d: any) => ({
          deviceId: d.deviceId,
          name: d.name,
          uuid: d.uuid,
          computeMajor: d.computeMajor,
          computeMinor: d.computeMinor,
          multiProcessorCount: d.multiProcessorCount,
          warpSize: d.warpSize,
        })),
      }));

      const events: TraceEvent[] = data.flatMap(s => {
        const kernels: TraceEvent[] = s.kernels.map((k: any) => {
          const apiStart = k.apiStartNs ?? k.startNs;
          const apiExit = k.apiExitNs ?? apiStart;
          const gpuStart = k.startNs;
          const gpuEnd = k.endNs;

          const totalDuration = Math.max(gpuEnd, apiExit) - apiStart;
          const gpuExecution = gpuEnd - gpuStart;
          const cpuOverhead = apiExit - apiStart;
          const queueLatency = Math.max(0, gpuStart - apiExit);

          return {
            id: k.id,
            sessionId: s.sessionId,
            type: 'kernel' as const,
            name: k.name,
            ts_ns: apiStart,
            duration_ns: gpuExecution,
            total_duration_ns: totalDuration,
            cpu_overhead_ns: cpuOverhead,
            queue_latency_ns: queueLatency,
            api_duration_ns: cpuOverhead, // legacy
            launch_latency_ns: queueLatency, // legacy
            start_ns: gpuStart,
            end_ns: gpuEnd,
            apiStartNs: k.apiStartNs,
            apiExitNs: k.apiExitNs,
            user_scope: k.userScope,
            stack_trace: k.stackTrace,
            stream_id: k.streamId ?? k.deviceId ?? 0,
            grid: k.grid,
            block: k.block,
            numRegs: k.numRegs,
            occupancy: k.occupancy != null ? Number(k.occupancy) : undefined,
            regOccupancy: k.regOccupancy != null ? Number(k.regOccupancy) : undefined,
            smemOccupancy: k.smemOccupancy != null ? Number(k.smemOccupancy) : undefined,
            warpOccupancy: k.warpOccupancy != null ? Number(k.warpOccupancy) : undefined,
            blockOccupancy: k.blockOccupancy != null ? Number(k.blockOccupancy) : undefined,
            limitingResource: k.limitingResource,
            localMemTotalBytes: k.localMemTotalBytes,
            localMemPerThreadBytes: k.localMemPerThreadBytes,
            cacheConfigRequested: k.cacheConfigRequested,
            cacheConfigExecuted: k.cacheConfigExecuted,
            sharedMemExecutedBytes: k.sharedMemExecutedBytes,
            dynSharedBytes: k.dynSharedBytes,
            staticSharedBytes: k.staticSharedBytes,
          };
        });

        const scopes: TraceEvent[] = s.scopes.map((sc: any) => {
          const start = sc.startNs ?? sc.tsNs;
          const end = sc.endNs ?? (start + (sc.durationNs || 0));
          const duration = end - start;

          return {
            id: sc.id,
            sessionId: s.sessionId,
            type: 'scope' as const,
            name: sc.name,
            ts_ns: start,
            duration_ns: duration,
            total_duration_ns: duration,
            start_ns: start,
            end_ns: end,
            user_scope: sc.userScope,
            depth: sc.scopeDepth,
          };
        }).sort((a, b) => a.ts_ns - b.ts_ns);

        // Ensure minimum duration if 0
        for (let i = 0; i < scopes.length; i++) {
          if (scopes[i].duration_ns <= 0) {
            scopes[i].duration_ns = 1000; // 1us fallback
          }
        }

        return [...kernels, ...scopes];
      });

      // Post-process to find parent-child relationships
      for (const e of events) {
        if (e.type === 'kernel' && e.user_scope) {
          // Find the scope that matches the kernel's user_scope
          // Try exact match first, then try matching the last part of a pipe-separated path
          const leafName = e.user_scope.split('|').pop();
          const parent = events.find(s => 
            s.type === 'scope' && 
            s.sessionId === e.sessionId && 
            (s.name === e.user_scope || (leafName && s.name === leafName))
          );
          if (parent) {
            e.parent_scope_id = parent.id;
          }
        }
      }

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
      const res = await apiFetch(`/api/v1/events/system?sessionId=${sessionId}`);
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      // API returns List<SystemEventDto>: each element is one system event with
      // all session host/device metrics embedded. Take metrics from the first
      // element (they're identical across all elements) and store all events.
      const rawData: any[] = await res.json();

      if (!Array.isArray(rawData) || rawData.length === 0) {
        set({ systemEvents: [], hostMetrics: [], deviceMetrics: [], metricsRange: undefined });
        return;
      }

      const systemEvents: SystemEventRecord[] = rawData.map((e: any) => ({
        sessionId: e.sessionId,
        pid: e.pid,
        app: e.app,
        name: e.name,
        eventType: e.eventType,
        tsNs: e.tsNs,
        rangeStart: e.rangeStart,
        rangeEnd: e.rangeEnd,
      }));

      const first = rawData[0];
      const hostMetrics: HostMetricSample[] = first.hostMetrics || [];
      const deviceMetrics = (first.deviceMetrics || []).map((m: any) => ({
        ...m,
        memUsedMib: m.memUsedMib ?? m.usedMib ?? 0,
        memTotalMib: m.memTotalMib ?? m.totalMib ?? 0,
        powerW: m.powerW ?? (m.powerMw ? m.powerMw / 1000 : 0),
        fanSpeedPct: m.fanSpeedPct ?? 0,
      }));

      // Compute time range from actual metric timestamps (event rangeStart/End
      // is just the event's own ts_ns, not the span of all metrics).
      const allTs = [
        ...hostMetrics.map((m: HostMetricSample) => m.tsNs),
        ...deviceMetrics.map((m: any) => m.tsNs),
      ];
      let startNs: number | undefined;
      let endNs: number | undefined;
      if (allTs.length > 1) {
        startNs = Math.min(...allTs);
        endNs   = Math.max(...allTs);
      } else if (allTs.length === 1) {
        startNs = allTs[0] - 500_000;
        endNs   = allTs[0] + 500_000;
      }
      if (startNs != null && endNs != null && endNs - startNs < 1_000) {
        const center = (startNs + endNs) / 2;
        startNs = center - 500;
        endNs   = center + 500;
      }

      set({
        systemEvents,
        hostMetrics,
        deviceMetrics,
        metricsRange: startNs != null && endNs != null ? { start_ns: startNs, end_ns: endNs } : undefined,
      });
      get().updateGlobalRange();
    } catch (err) {
      console.error('Failed to fetch system metrics', err);
      set({ systemEvents: [], hostMetrics: [], deviceMetrics: [], metricsRange: undefined });
    }
  },
  fetchProfileSamples: async (sessionId: string) => {
    try {
      const res = await apiFetch(`/api/v1/events/profile-samples?sessionId=${sessionId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: ProfileSample[] = await res.json();
      set({ profileSamples: data });
    } catch (err) {
      console.error('Failed to fetch profile samples', err);
    }
  },
  fetchInsights: async (sessionId: string) => {
    try {
      const res = await apiFetch(`/api/v1/insights/${sessionId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const items: InsightDto[] = Array.isArray(data) ? data : (data.insights ?? []);
      set({ insights: items });
    } catch (err) {
      console.error('Failed to fetch insights', err);
      set({ insights: [] });
    }
  },
  selectSession: (id: string) => {
    set({ currentSessionId: id, activeTab: 'kernels', activeEventId: undefined, highlightRange: undefined, profileSamples: [] });
    get().updateGlobalRange();
  },
  setActiveEvent: (id?: string) => {
    if (!id) return set({ activeEventId: undefined, highlightRange: undefined });
    const ev = get().events.find((e) => e.id === id);
    if (!ev) return;
    
    set({
      activeEventId: id,
      highlightRange: { start_ns: ev.ts_ns, end_ns: ev.ts_ns + (ev.total_duration_ns ?? ev.duration_ns) },
    });
  },
  setMetricVisibility: (key, visible) =>
    set((s) => ({ metricVisibility: { ...s.metricVisibility, [key]: visible } })),
  setActiveTab: (tab) => set({ activeTab: tab }),
  toggleComparedScope: (id) =>
    set((s) => {
      const idx = s.comparedScopeIds.indexOf(id);
      if (idx >= 0) return { comparedScopeIds: s.comparedScopeIds.filter((x) => x !== id) };
      if (s.comparedScopeIds.length >= 3) return {};
      return { comparedScopeIds: [...s.comparedScopeIds, id] };
    }),
  setMetricsZoom: (range) => set({ metricsZoomRange: range }),
  setActiveScopeKey: (key) => set({ activeScopeKey: key }),
  jumpToScope: (scopeId) => {
    const state = get();
    const scope = state.events.find((e) => e.id === scopeId);
    if (!scope) return;
    set({
      activeEventId: scopeId,
      highlightRange: { start_ns: scope.ts_ns, end_ns: scope.ts_ns + scope.duration_ns },
      activeTab: 'scopes',
      activeScopeKey: scope.user_scope || scope.name,
    });
  },
  updateGlobalRange: () => {
    const { events, hostMetrics, deviceMetrics, currentSessionId } = get();
    if (!currentSessionId) return;

    const sessionEvents = events.filter(e => e.sessionId === currentSessionId);
    let minNs = Infinity;
    let maxNs = -Infinity;

    for (const e of sessionEvents) {
      const end_ns = e.ts_ns + (e.total_duration_ns ?? e.duration_ns);
      if (e.ts_ns < minNs) minNs = e.ts_ns;
      if (end_ns > maxNs) maxNs = end_ns;
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
      // Ensure at least 1us
      if (maxNs - minNs < 1_000) {
        const center = (minNs + maxNs) / 2;
        minNs = center - 500;
        maxNs = center + 500;
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
