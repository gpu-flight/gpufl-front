import React, { useMemo } from 'react'
import { Tag, Tooltip } from 'antd'
import { TraceEvent } from '@/types'
import { formatWallClock } from '@/utils/timeFormat'

const STREAM_COLORS = ['#60a5fa', '#34d399', '#f87171', '#f59e0b', '#a78bfa', '#f472b6', '#22d3ee']
const BAR_MAX_PX = 200

function fmtDur(ns: number): string {
  const us = ns / 1000
  if (us < 1000) return `${us.toFixed(1)} µs`
  const ms = us / 1000
  if (ms < 1000) return `${ms.toFixed(2)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function fmtRel(ns: number): string {
  const us = ns / 1000
  if (us < 1000) return `${us.toFixed(0)} µs`
  const ms = us / 1000
  if (ms < 1000) return `${ms.toFixed(1)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

/** Returns a sortable bucket key and a human-readable label for a given epoch-ns timestamp. */
function hourBucket(ns: number): { key: string; label: string } {
  const d = new Date(ns / 1_000_000)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hour = String(d.getHours()).padStart(2, '0')
  const key = `${year}-${month}-${day} ${hour}`
  const dateLabel = d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
  const label = `${dateLabel}  ·  ${hour}:xx`
  return { key, label }
}

interface KernelTimelineProps {
  events: TraceEvent[]
  onSelectEvent: (id: string) => void
  activeEventId?: string
  sessionStartNs?: number
}

export default function KernelTimeline({ events, onSelectEvent, activeEventId, sessionStartNs }: KernelTimelineProps) {
  const sorted = useMemo(() => [...events].sort((a, b) => a.ts_ns - b.ts_ns), [events])

  const minTs = useMemo(() => (sorted.length > 0 ? sorted[0].ts_ns : 0), [sorted])

  const maxTotalDur = useMemo(
    () => Math.max(...sorted.map((e) => e.total_duration_ns ?? e.duration_ns), 1),
    [sorted],
  )

  const streamColorMap = useMemo(() => {
    const map = new Map<number, string>()
    const ids = Array.from(new Set(sorted.map((e) => e.stream_id ?? 0))).sort((a, b) => a - b)
    ids.forEach((sid, i) => map.set(sid, STREAM_COLORS[i % STREAM_COLORS.length]))
    return map
  }, [sorted])

  const rows = useMemo(() => {
    if (sorted.length === 0) return []
    const items: React.ReactNode[] = []
    let lastBucketKey = ''

    for (const ev of sorted) {
      const { key, label } = hourBucket(ev.ts_ns)
      if (key !== lastBucketKey) {
        lastBucketKey = key
        items.push(
          <div
            key={`hdr-${key}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '10px 12px 6px',
              position: 'sticky',
              top: 0,
              zIndex: 1,
              background: '#0a0e14',
            }}
          >
            <div style={{ flex: 1, height: 1, background: '#1f2937' }} />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', whiteSpace: 'nowrap' }}>
              {label}
            </span>
            <div style={{ flex: 1, height: 1, background: '#1f2937' }} />
          </div>
        )
      }

      const relNs = ev.ts_ns - (sessionStartNs ?? minTs)
      const total = ev.total_duration_ns ?? ev.duration_ns
      const gpu = ev.duration_ns
      const cpu = ev.cpu_overhead_ns ?? 0
      const queue = ev.queue_latency_ns ?? 0
      const barW = (total / maxTotalDur) * BAR_MAX_PX
      const color = streamColorMap.get(ev.stream_id ?? 0) ?? STREAM_COLORS[0]
      const isActive = ev.id === activeEventId

      const cpuFrac = total > 0 ? cpu / total : 0
      const queueFrac = total > 0 ? queue / total : 0
      const gpuFrac = total > 0 ? gpu / total : 0

      items.push(
        <div
          key={ev.id}
          className="ktl-row"
          onClick={() => onSelectEvent(ev.id)}
        >
          <Tooltip title={formatWallClock(ev.ts_ns)} placement="right">
            <div className="ktl-time">{fmtRel(relNs)}</div>
          </Tooltip>
          <div className="ktl-arrow">→</div>
          <div className={`ktl-card${isActive ? ' ktl-card-active' : ''}`}>
            <div className="ktl-card-head">
              <span className="ktl-name" title={ev.name}>
                {ev.name}
              </span>
              <Tag
                style={{
                  background: color + '22',
                  borderColor: color,
                  color,
                  fontSize: 10,
                  lineHeight: '16px',
                  padding: '0 4px',
                  marginLeft: 6,
                  flexShrink: 0,
                }}
              >
                stream:{ev.stream_id ?? 0}
              </Tag>
            </div>
            <div className="ktl-bar-track">
              <Tooltip
                title={`CPU: ${fmtDur(cpu)} | Queue: ${fmtDur(queue)} | GPU: ${fmtDur(gpu)}`}
                placement="top"
              >
                <div
                  style={{
                    display: 'flex',
                    width: Math.max(barW, 4),
                    height: 8,
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  {cpuFrac > 0 && (
                    <div style={{ width: `${cpuFrac * 100}%`, background: '#6b7280' }} />
                  )}
                  {queueFrac > 0 && (
                    <div style={{ width: `${queueFrac * 100}%`, background: '#f59e0b' }} />
                  )}
                  {gpuFrac > 0 && (
                    <div style={{ width: `${gpuFrac * 100}%`, background: '#60a5fa' }} />
                  )}
                </div>
              </Tooltip>
            </div>
            <div className="ktl-card-foot">
              <span>GPU: {fmtDur(gpu)}</span>
              <span>CPU: {fmtDur(cpu)}</span>
              <span>Queue: {fmtDur(queue)}</span>
              <span style={{ color: '#60a5fa' }}>Total: {fmtDur(total)}</span>
            </div>
          </div>
        </div>
      )
    }

    return items
  }, [sorted, sessionStartNs, minTs, maxTotalDur, streamColorMap, activeEventId, onSelectEvent])

  if (rows.length === 0) {
    return (
      <div style={{ padding: 32, color: '#6b7280', textAlign: 'center' }}>
        No kernel events
      </div>
    )
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', padding: '4px 0' }}>
      {rows}
    </div>
  )
}
