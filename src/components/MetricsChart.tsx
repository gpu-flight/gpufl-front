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
import { HostMetricSample, DeviceMetricSample } from '@/types'
import { Checkbox, Space, Divider, Typography } from 'antd'
import { useStore, MetricKey } from '@/store/useStore'

function nsToUs(ns: number) {
  return ns / 1_000
}

function formatTime(us: number) {
  // Simple relative time in microseconds or milliseconds
  if (us < 1000) return `${us.toFixed(0)}us`
  return `${(us / 1000).toFixed(2)}ms`
}

export interface MetricsChartProps {
  hostData: HostMetricSample[]
  deviceData: DeviceMetricSample[]
  globalRange?: { start_ns: number; end_ns: number }
  highlightRange?: { start_ns: number; end_ns: number }
}

export default function MetricsChart({ hostData, deviceData, globalRange, highlightRange }: MetricsChartProps) {
  const metricVisibility = useStore((s) => s.metricVisibility)
  const setMetricVisibility = useStore((s) => s.setMetricVisibility)

  const hostChartData = useMemo(() => {
    if (!hostData || !globalRange) return []
    const start = globalRange.start_ns
    return hostData.map(m => ({
      ...m,
      ts_rel_us: nsToUs(m.tsNs - start)
    })).sort((a, b) => a.ts_rel_us - b.ts_rel_us)
  }, [hostData, globalRange])

  const deviceChartData = useMemo(() => {
    if (!deviceData || !globalRange) return []
    const start = globalRange.start_ns
    const byTs = new Map<number, any>()
    for (const m of deviceData) {
      const key = m.tsNs
      const row = byTs.get(key) || { ts_rel_us: nsToUs(key - start) }
      row[`utilGpu_d${m.deviceId}`] = m.utilGpu
      row[`utilMem_d${m.deviceId}`] = m.utilMem
      row[`tempC_d${m.deviceId}`] = m.tempC
      row[`memUsedMib_d${m.deviceId}`] = m.memUsedMib
      row[`memTotalMib_d${m.deviceId}`] = m.memTotalMib
      row[`powerW_d${m.deviceId}`] = m.powerW
      row[`fanSpeedPct_d${m.deviceId}`] = m.fanSpeedPct
      byTs.set(key, row)
    }
    return Array.from(byTs.values()).sort((a, b) => a.ts_rel_us - b.ts_rel_us)
  }, [deviceData, globalRange])

  const deviceIds = useMemo(() => {
    if (!deviceData) return []
    return Array.from(new Set(deviceData.map((d) => d.deviceId))).sort()
  }, [deviceData])

  const domain = useMemo(() => {
    if (globalRange) {
      const durationUs = nsToUs(globalRange.end_ns - globalRange.start_ns)
      return [0, Math.max(durationUs, 1)] // Min 1us range
    }
    return ['dataMin', 'dataMax']
  }, [globalRange])

  const ticks = useMemo(() => {
    if (!globalRange) return undefined
    const durationUs = nsToUs(globalRange.end_ns - globalRange.start_ns)
    
    // Choose a step that results in reasonable number of ticks
    let step = 100 // 100us
    if (durationUs > 1000) step = 200 // 200us
    if (durationUs > 5000) step = 500 // 500us
    if (durationUs > 10000) step = 1000 // 1ms
    if (durationUs > 50000) step = 5000 // 5ms
    if (durationUs > 100000) step = 10000 // 10ms
    if (durationUs > 500000) step = 50000 // 50ms

    const tickCount = Math.floor(durationUs / step)
    if (tickCount > 0 && tickCount < 200) {
      return Array.from({ length: tickCount + 1 }, (_, i) => i * step)
    }
    return undefined // Fallback to automatic ticks
  }, [globalRange])

  const formatRelTime = (us: number) => {
    if (us < 1000) return `${us.toFixed(0)}us`
    if (us < 1000000) return `${(us / 1000).toFixed(1)}ms`
    return `${(us / 1000000).toFixed(3)}s`
  }

  const formatAbsTime = (us: number) => {
    if (!globalRange) return ''
    const absMs = (globalRange.start_ns + (us * 1000)) / 1_000_000
    const date = new Date(absMs)
    const timeStr = date.toLocaleTimeString([], { hour12: false })
    const msStr = String(date.getMilliseconds()).padStart(3, '0')
    const usRemainder = Math.floor((absMs % 1) * 1000)
    return `${timeStr}.${msStr}.${String(usRemainder).padStart(3, '0')}`
  }

  const highlightArea = useMemo(() => {
    if (!highlightRange || !globalRange) return null
    return (
      <ReferenceArea
        x1={nsToUs(highlightRange.start_ns - globalRange.start_ns)}
        x2={nsToUs(highlightRange.end_ns - globalRange.start_ns)}
        strokeOpacity={0.3}
        fill="#f59e0b"
        fillOpacity={0.15}
      />
    )
  }, [highlightRange, globalRange])

  const renderToggle = (key: MetricKey, label: string) => (
    <Checkbox
      checked={metricVisibility[key]}
      onChange={(e) => setMetricVisibility(key, e.target.checked)}
    >
      {label}
    </Checkbox>
  )

  return (
    <div style={{ width: '100%' }}>
      <div style={{ marginBottom: 16 }}>
        <Typography.Text strong>Host Metrics: </Typography.Text>
        <Space wrap>
          {renderToggle('cpuPct', 'CPU %')}
          {renderToggle('ramUsedMib', 'RAM Used (MiB)')}
          {renderToggle('ramTotalMib', 'RAM Total (MiB)')}
        </Space>
        <div style={{ height: 250, marginTop: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hostChartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="ts_rel_us"
                type="number"
                domain={domain}
                ticks={ticks}
                tickFormatter={formatRelTime}
                stroke="#9ca3af"
                allowDataOverflow
                minTickGap={30}
              />
              <YAxis yAxisId="left" stroke="#9ca3af" />
              <Tooltip labelFormatter={(v) => formatAbsTime(v as number)} />
              <Legend />
              {highlightArea}
              {metricVisibility.cpuPct && <Line yAxisId="left" type="monotone" dataKey="cpuPct" name="CPU %" stroke="#60a5fa" dot={false} isAnimationActive={false} connectNulls />}
              {metricVisibility.ramUsedMib && <Line yAxisId="left" type="monotone" dataKey="ramUsedMib" name="RAM Used (MiB)" stroke="#34d399" dot={false} isAnimationActive={false} connectNulls />}
              {metricVisibility.ramTotalMib && <Line yAxisId="left" type="monotone" dataKey="ramTotalMib" name="RAM Total (MiB)" stroke="#f87171" dot={false} isAnimationActive={false} connectNulls />}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <Divider style={{ margin: '12px 0' }} />

      <div style={{ marginBottom: 16 }}>
        <Typography.Text strong>Device Metrics: </Typography.Text>
        <Space wrap>
          {renderToggle('utilGpu', 'GPU Util %')}
          {renderToggle('utilMem', 'Mem Util %')}
          {renderToggle('tempC', 'Temp (C)')}
          {renderToggle('memUsedMib', 'Mem Used (MiB)')}
          {renderToggle('memTotalMib', 'Mem Total (MiB)')}
          {renderToggle('powerW', 'Power (W)')}
          {renderToggle('fanSpeedPct', 'Fan %')}
        </Space>
        <div style={{ height: 300, marginTop: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={deviceChartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="ts_rel_us"
                type="number"
                domain={domain}
                ticks={ticks}
                tickFormatter={formatRelTime}
                stroke="#9ca3af"
                allowDataOverflow
                minTickGap={30}
              />
              <YAxis yAxisId="left" stroke="#9ca3af" />
              <Tooltip labelFormatter={(v) => formatAbsTime(v as number)} />
              <Legend />
              {highlightArea}
              {deviceIds.flatMap((d, idx) => {
                const colors = ["#60a5fa", "#34d399", "#f87171", "#f59e0b", "#a78bfa", "#f472b6", "#22d3ee"];
                const baseColor = colors[idx % colors.length];
                return [
                  metricVisibility.utilGpu && (
                    <Line key={`utilGpu-${d}`} yAxisId="left" type="monotone" dataKey={`utilGpu_d${d}`} name={`GPU${d} Util %`} stroke={baseColor} dot={false} isAnimationActive={false} connectNulls />
                  ),
                  metricVisibility.utilMem && (
                    <Line key={`utilMem-${d}`} yAxisId="left" type="monotone" dataKey={`utilMem_d${d}`} name={`GPU${d} Mem Util %`} stroke={baseColor} strokeDasharray="5 5" dot={false} isAnimationActive={false} connectNulls />
                  ),
                  metricVisibility.tempC && (
                    <Line key={`tempC-${d}`} yAxisId="left" type="monotone" dataKey={`tempC_d${d}`} name={`GPU${d} Temp (C)`} stroke="#fbbf24" dot={false} isAnimationActive={false} connectNulls />
                  ),
                  metricVisibility.memUsedMib && (
                    <Line key={`memUsedMib-${d}`} yAxisId="left" type="monotone" dataKey={`memUsedMib_d${d}`} name={`GPU${d} Mem Used (MiB)`} stroke="#ec4899" dot={false} isAnimationActive={false} connectNulls />
                  ),
                  metricVisibility.memTotalMib && (
                    <Line key={`memTotalMib-${d}`} yAxisId="left" type="monotone" dataKey={`memTotalMib_d${d}`} name={`GPU${d} Mem Total (MiB)`} stroke="#9333ea" dot={false} isAnimationActive={false} connectNulls />
                  ),
                  metricVisibility.powerW && (
                    <Line key={`powerW-${d}`} yAxisId="left" type="monotone" dataKey={`powerW_d${d}`} name={`GPU${d} Power (W)`} stroke="#10b981" dot={false} isAnimationActive={false} connectNulls />
                  ),
                  metricVisibility.fanSpeedPct && (
                    <Line key={`fanSpeedPct-${d}`} yAxisId="left" type="monotone" dataKey={`fanSpeedPct_d${d}`} name={`GPU${d} Fan %`} stroke="#64748b" dot={false} isAnimationActive={false} connectNulls />
                  ),
                ].filter(Boolean);
              })}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
