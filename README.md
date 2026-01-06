### GPUFL Portal

A GPU Profiling Dashboard scaffold built with React + Vite + TypeScript.

Tech stack
- Build Tool: Vite (React + TypeScript)
- UI: Ant Design v5
- State: Zustand
- Timeline: react-vis-timeline (Vis.js timeline)
- Metrics: Recharts
- Styling: Ant Design dark theme + small CSS overrides

Getting started
1) Create the project with Vite (already scaffolded in this repo)

If you were starting from scratch:
- npm create vite@latest gpufl-portal -- --template react-ts
- cd gpufl-portal

2) Install dependencies
- npm install antd dayjs react-router-dom zustand recharts vis-timeline react-vis-timeline
- npm install -D @vitejs/plugin-react vite vite-tsconfig-paths typescript @types/react @types/react-dom

3) Run the app
- npm run dev
- Open http://localhost:5173

Project structure (key files)
- src/types.ts: TypeScript interfaces (Session, TraceEvent, MetricSample)
- src/mockData.ts: Generates 1 mock session with ~50 scopes, ~200 kernels, and metrics
- src/store/useStore.ts: Zustand store for sessions, events, metrics, selection, and metric visibility
- src/pages/SessionList.tsx: Landing page (AntD Table)
- src/pages/Dashboard.tsx: Master-detail layout with metrics (top), timeline (bottom), and inspector (right)
- src/components/MetricsChart.tsx: Recharts line chart with ReferenceArea highlight
- src/components/TimelineView.tsx: Vis.js timeline groups and items; click to select event
- src/components/Inspector.tsx: Right drawer for event details and stack trace

Notes
- The app loads mock data on start. Replace generateMockData() and load from your backend when ready.
- API example (future): GET http://localhost:8080/api/v1/events/init
- Dark theme is enabled using Ant Design ConfigProvider with darkAlgorithm.
