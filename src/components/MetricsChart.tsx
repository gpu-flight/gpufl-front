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
  Brush,
} from 'recharts'
import { HostMetricSample, DeviceMetricSample } from '@/types'
import { Checkbox, Space, Divider, Typography, Badge, Tag } from 'antd'
import { useStore, MetricKey } from '@/store/useStore'

const BRUSH_HEIGHT = 24

function nsToUs(ns: number) {
  return ns / 1_000
}

export interface MetricsChartProps {
  hostData: HostMetricSample[]
  deviceData: DeviceMetricSample[]
  globalRange?: { start_ns: number; end_ns: number }
  highlightRange?: { start_ns: number; end_ns: number }
  isLive?: boolean
}

function fmtDate(ms: number) {
  return new Date(ms).toLocaleDateString([], { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtTime(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function MetricsChart({ hostData, deviceData, globalRange, highlightRange, isLive }: MetricsChartProps) {
  const metricVisibility = useStore((s) => s.metricVisibility)
  const setMetricVisibility = useStore((s) => s.setMetricVisibility)
  const metricsZoomRange = useStore((s) => s.metricsZoomRange)
  const setMetricsZoom = useStore((s) => s.setMetricsZoom)

  // chartRange is derived from the actual metric timestamps, NOT globalRange.
  // globalRange can be dominated by short kernel events (e.g. 18 ms) which would
  // clip metric samples that fall outside that narrow window.
  const chartRange = useMemo(() => {
    const allTs = [
      ...(hostData || []).map(m => m.tsNs),
      ...(deviceData || []).map(m => m.tsNs),
    ]
    if (allTs.length === 0) return globalRange
    const minTs = Math.min(...allTs)
    const maxTs = Math.max(...allTs)
    if (minTs < maxTs) return { start_ns: minTs, end_ns: maxTs }
    return { start_ns: minTs - 500_000, end_ns: minTs + 500_000 }
  }, [hostData, deviceData, globalRange])

  // Session date/time header derived from chartRange
  const sessionHeader = useMemo(() => {
    if (!chartRange) return null
    const startMs = chartRange.start_ns / 1_000_000
    const endMs = chartRange.end_ns / 1_000_000
    const startDate = fmtDate(startMs)
    const endDate = fmtDate(endMs)
    const startTime = fmtTime(startMs)
    const endTime = fmtTime(endMs)
    const sameDay = startDate === endDate
    return { date: startDate, startTime, endTime: sameDay ? endTime : `${endDate} ${endTime}` }
  }, [chartRange])

  const hostChartData = useMemo(() => {
    if (!hostData || !chartRange) return []
    const start = chartRange.start_ns
    return hostData.map(m => ({
      ...m,
      ts_rel_us: nsToUs(m.tsNs - start)
    })).sort((a, b) => a.ts_rel_us - b.ts_rel_us)
  }, [hostData, chartRange])

  const deviceChartData = useMemo(() => {
    if (!deviceData || !chartRange) return []
    const start = chartRange.start_ns
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
  }, [deviceData, chartRange])

  const deviceIds = useMemo(() => {
    if (!deviceData) return []
    return Array.from(new Set(deviceData.map((d) => d.deviceId))).sort()
  }, [deviceData])

  const domain = useMemo(() => {
    if (chartRange) {
      const durationUs = nsToUs(chartRange.end_ns - chartRange.start_ns)
      return [0, Math.max(durationUs, 1)]
    }
    return ['dataMin', 'dataMax']
  }, [chartRange])

  const ticks = useMemo(() => {
    if (!chartRange) return undefined
    const durationUs = nsToUs(chartRange.end_ns - chartRange.start_ns)

    let step = 100
    if (durationUs > 1_000) step = 200
    if (durationUs > 5_000) step = 500
    if (durationUs > 10_000) step = 1_000
    if (durationUs > 50_000) step = 5_000
    if (durationUs > 100_000) step = 10_000
    if (durationUs > 500_000) step = 50_000
    if (durationUs > 2_000_000) step = 200_000       // 200 ms
    if (durationUs > 10_000_000) step = 1_000_000    // 1 s
    if (durationUs > 60_000_000) step = 5_000_000    // 5 s
    if (durationUs > 300_000_000) step = 30_000_000  // 30 s
    if (durationUs > 600_000_000) step = 60_000_000  // 1 min
    if (durationUs > 3_600_000_000) step = 300_000_000 // 5 min

    const tickCount = Math.floor(durationUs / step)
    if (tickCount > 0 && tickCount < 200) {
      return Array.from({ length: tickCount + 1 }, (_, i) => i * step)
    }
    return undefined
  }, [globalRange])

  // Format a relative-us tick as an absolute wall-clock time (HH:MM:SS or HH:MM:SS.mmm)
  const formatTickTime = (us: number) => {
    if (!chartRange) return ''
    const absMs = (chartRange.start_ns / 1_000_000) + (us / 1_000)
    const d = new Date(absMs)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    const durationUs = nsToUs(chartRange.end_ns - chartRange.start_ns)
    // Show milliseconds only for short durations
    if (durationUs < 10_000_000) {
      const ms = String(d.getMilliseconds()).padStart(3, '0')
      return `${hh}:${mm}:${ss}.${ms}`
    }
    return `${hh}:${mm}:${ss}`
  }

  // Tooltip label: full absolute timestamp
  const formatTooltipTime = (us: number) => {
    if (!chartRange) return ''
    const absMs = (chartRange.start_ns / 1_000_000) + (us / 1_000)
    const d = new Date(absMs)
    return d.toLocaleTimeString([], { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0')
  }

  const highlightArea = useMemo(() => {
    if (!highlightRange || !chartRange) return null
    return (
      <ReferenceArea
        x1={nsToUs(highlightRange.start_ns - chartRange.start_ns)}
        x2={nsToUs(highlightRange.end_ns - chartRange.start_ns)}
        strokeOpacity={0.3}
        fill="#f59e0b"
        fillOpacity={0.15}
      />
    )
  }, [highlightRange, chartRange])

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
      {/* Session time range header */}
      {sessionHeader && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          marginBottom: 16, padding: '8px 12px',
          background: '#111827', borderRadius: 6, border: '1px solid #1f2937',
        }}>
          <span style={{ color: '#9ca3af', fontSize: 12 }}>{sessionHeader.date}</span>
          <span style={{ color: '#e5e7eb', fontFamily: 'monospace', fontSize: 13 }}>
            {sessionHeader.startTime}
          </span>
          <span style={{ color: '#4b5563' }}>→</span>
          {isLive ? (
            <Badge status="processing" text={<span style={{ color: '#34d399', fontSize: 13, fontFamily: 'monospace' }}>LIVE</span>} />
          ) : (
            <span style={{ color: '#e5e7eb', fontFamily: 'monospace', fontSize: 13 }}>
              {sessionHeader.endTime}
            </span>
          )}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <Typography.Text strong>Host Metrics: </Typography.Text>
        <Space wrap>
          {renderToggle('cpuPct', 'CPU %')}
          {renderToggle('ramUsedMib', 'RAM Used (MiB)')}
          {renderToggle('ramTotalMib', 'RAM Total (MiB)')}
        </Space>
        <div style={{ height: 270, marginTop: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={hostChartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="ts_rel_us"
                type="number"
                domain={domain}
                ticks={ticks}
                tickFormatter={formatTickTime}
                stroke="#9ca3af"
                allowDataOverflow
                minTickGap={60}
              />
              <YAxis yAxisId="left" stroke="#9ca3af" />
              <Tooltip labelFormatter={(v) => formatTooltipTime(v as number)} />
              <Legend />
              {highlightArea}
              {metricVisibility.cpuPct && <Line yAxisId="left" type="monotone" dataKey="cpuPct" name="CPU %" stroke="#60a5fa" dot={false} isAnimationActive={false} connectNulls />}
              {metricVisibility.ramUsedMib && <Line yAxisId="left" type="monotone" dataKey="ramUsedMib" name="RAM Used (MiB)" stroke="#34d399" dot={false} isAnimationActive={false} connectNulls />}
              {metricVisibility.ramTotalMib && <Line yAxisId="left" type="monotone" dataKey="ramTotalMib" name="RAM Total (MiB)" stroke="#f87171" dot={false} isAnimationActive={false} connectNulls />}
              <Brush
                dataKey="ts_rel_us"
                height={BRUSH_HEIGHT}
                stroke="#374151"
                fill="#111827"
                travellerWidth={6}
                startIndex={metricsZoomRange ? Math.min(metricsZoomRange[0], hostChartData.length - 1) : undefined}
                endIndex={metricsZoomRange ? Math.min(metricsZoomRange[1], hostChartData.length - 1) : undefined}
                tickFormatter={formatTickTime}
                onChange={(range: any) => {
                  if (range?.startIndex != null && range?.endIndex != null) {
                    setMetricsZoom([range.startIndex, range.endIndex])
                  }
                }}
              />
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
        <div style={{ height: 320, marginTop: 8 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={deviceChartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis
                dataKey="ts_rel_us"
                type="number"
                domain={domain}
                ticks={ticks}
                tickFormatter={formatTickTime}
                stroke="#9ca3af"
                allowDataOverflow
                minTickGap={60}
              />
              <YAxis yAxisId="left" stroke="#9ca3af" />
              <Tooltip labelFormatter={(v) => formatTooltipTime(v as number)} />
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
              <Brush
                dataKey="ts_rel_us"
                height={BRUSH_HEIGHT}
                stroke="#374151"
                fill="#111827"
                travellerWidth={6}
                startIndex={metricsZoomRange ? Math.min(metricsZoomRange[0], deviceChartData.length - 1) : undefined}
                endIndex={metricsZoomRange ? Math.min(metricsZoomRange[1], deviceChartData.length - 1) : undefined}
                tickFormatter={formatTickTime}
                onChange={(range: any) => {
                  if (range?.startIndex != null && range?.endIndex != null) {
                    setMetricsZoom([range.startIndex, range.endIndex])
                  }
                }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
