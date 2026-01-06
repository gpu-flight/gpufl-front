import React, { useMemo } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceArea,
} from 'recharts'
import { MetricSample } from '@/types'
import { Checkbox, Space } from 'antd'
import { useStore } from '@/store/useStore'

function nsToMs(ns: number) {
  return ns / 1_000_000
}

function formatTime(ms: number) {
  return new Date(ms).toLocaleTimeString()
}

export interface MetricsChartProps {
  data: MetricSample[]
  highlightRange?: { start_ns: number; end_ns: number }
}

export default function MetricsChart({ data, highlightRange }: MetricsChartProps) {
  const metricVisibility = useStore((s) => s.metricVisibility)
  const setMetricVisibility = useStore((s) => s.setMetricVisibility)

  const chartData = useMemo(() => {
    // Merge by ts_ns across GPUs by averaging or just keeping separate series per gpu? For simplicity, keep data as-is and show per-gpu suffix.
    // Transform samples to a flat array with keys for each metric per gpu
    const byTs = new Map<number, any>()
    for (const m of data) {
      const key = m.ts_ns
      const row = byTs.get(key) || { ts_ms: nsToMs(key) }
      if (m.temperature != null) row[`temp_g${m.gpu_id}`] = m.temperature
      if (m.memory_used_mb != null) row[`mem_g${m.gpu_id}`] = m.memory_used_mb
      if (m.gpu_utilization != null) row[`util_g${m.gpu_id}`] = m.gpu_utilization
      byTs.set(key, row)
    }
    return Array.from(byTs.values()).sort((a, b) => a.ts_ms - b.ts_ms)
  }, [data])

  const gpuIds = useMemo(() => Array.from(new Set(data.map((d) => d.gpu_id))).sort(), [data])

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <div style={{ marginBottom: 8 }}>
        <Space>
          <span>Metrics:</span>
          <Checkbox
            checked={metricVisibility.temperature}
            onChange={(e) => setMetricVisibility('temperature', e.target.checked)}
          >
            Temperature
          </Checkbox>
          <Checkbox
            checked={metricVisibility.memory_used_mb}
            onChange={(e) => setMetricVisibility('memory_used_mb', e.target.checked)}
          >
            Memory
          </Checkbox>
          <Checkbox
            checked={metricVisibility.gpu_utilization}
            onChange={(e) => setMetricVisibility('gpu_utilization', e.target.checked)}
          >
            Utilization
          </Checkbox>
        </Space>
      </div>
      <ResponsiveContainer width="100%" height="90%">
        <LineChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
          <XAxis
            dataKey="ts_ms"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={formatTime}
            stroke="#9ca3af"
          />
          <YAxis yAxisId="left" stroke="#9ca3af" />
          <Tooltip labelFormatter={(v) => formatTime(v as number)} />
          <Legend />
          {highlightRange && (
            <ReferenceArea
              x1={nsToMs(highlightRange.start_ns)}
              x2={nsToMs(highlightRange.end_ns)}
              strokeOpacity={0.3}
              fill="#f59e0b"
              fillOpacity={0.15}
            />
          )}
          {metricVisibility.temperature &&
            gpuIds.map((g, idx) => (
              <Line
                key={`temp-${g}`}
                yAxisId="left"
                type="monotone"
                dataKey={`temp_g${g}`}
                name={`Temp GPU${g}`}
                stroke={["#60a5fa", "#34d399", "#f87171", "#f59e0b"][idx % 4]}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          {metricVisibility.memory_used_mb &&
            gpuIds.map((g, idx) => (
              <Line
                key={`mem-${g}`}
                yAxisId="left"
                type="monotone"
                dataKey={`mem_g${g}`}
                name={`Mem GPU${g} (MB)`}
                stroke={["#a78bfa", "#f472b6", "#22d3ee", "#fbbf24"][idx % 4]}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          {metricVisibility.gpu_utilization &&
            gpuIds.map((g, idx) => (
              <Line
                key={`util-${g}`}
                yAxisId="left"
                type="monotone"
                dataKey={`util_g${g}`}
                name={`Util GPU${g} (%)`}
                stroke={["#fde047", "#fb7185", "#10b981", "#60a5fa"][idx % 4]}
                dot={false}
                isAnimationActive={false}
              />
            ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
