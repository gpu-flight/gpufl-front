import { create } from 'zustand';
import { MetricSample, Session, TraceEvent } from '@/types';
import { loadSampleData } from '@/dataLoader';

export type MetricKey = 'temperature' | 'memory_used_mb' | 'gpu_utilization';

interface AppState {
  sessions: Session[];
  events: TraceEvent[];
  metrics: MetricSample[];
  currentSessionId?: string;
  activeEventId?: string;
  highlightRange?: { start_ns: number; end_ns: number };
  metricVisibility: Record<MetricKey, boolean>;

  // derived
  currentSession?: Session;
  activeEvent?: TraceEvent;

  // actions
  loadMock: () => void;
  selectSession: (id: string) => void;
  setActiveEvent: (id?: string) => void;
  setMetricVisibility: (key: MetricKey, visible: boolean) => void;
}

export const useStore = create<AppState>((set, get) => ({
  sessions: [],
  events: [],
  metrics: [],
  metricVisibility: {
    temperature: true,
    memory_used_mb: true,
    gpu_utilization: true,
  },
  loadMock: () => {
    const payload = loadSampleData();
    set({
      sessions: payload.sessions,
      events: payload.events,
      metrics: payload.metrics,
      currentSessionId: payload.sessions[0]?.sessionId,
    });
  },
  selectSession: (id: string) => set({ currentSessionId: id }),
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

  get currentSession() {
    const state = get();
    return state.sessions.find((s) => s.sessionId === state.currentSessionId);
  },
  get activeEvent() {
    const state = get();
    return state.events.find((e) => e.id === state.activeEventId);
  },
}));
