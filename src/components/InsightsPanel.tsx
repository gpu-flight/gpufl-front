import React from 'react'
import { List, Tag, Typography, Spin } from 'antd'
import { InsightDto, TraceEvent } from '@/types'
import { useStore } from '@/store/useStore'

interface InsightsPanelProps {
  insights: InsightDto[] | null
}

function severityTag(severity: InsightDto['severity']) {
  if (severity === 'HIGH') return <Tag color="red">HIGH</Tag>
  if (severity === 'MEDIUM') return <Tag color="orange">MEDIUM</Tag>
  return <Tag color="default">LOW</Tag>
}

function fmtDur(ns: number): string {
  const us = ns / 1000
  if (us < 1000) return `${us.toFixed(1)} µs`
  const ms = us / 1000
  if (ms < 1000) return `${ms.toFixed(2)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function fmtBytes(b: number): string {
  if (b === 0) return '0 B'
  if (b < 1024) return `${b} B`
  return `${(b / 1024).toFixed(1)} KB`
}

function occColor(occ: number): string {
  if (occ >= 0.5) return '#22c55e'
  if (occ >= 0.25) return '#f59e0b'
  return '#ef4444'
}

/** A compact label:value chip */
function Chip({ label, value, valueColor }: { label: string; value: string; valueColor?: string }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 3,
      background: '#1f2937',
      border: '1px solid #374151',
      borderRadius: 4,
      padding: '2px 6px',
      fontSize: 11,
      fontFamily: 'monospace',
      whiteSpace: 'nowrap',
    }}>
      <span style={{ color: '#6b7280' }}>{label}</span>
      <span style={{ color: valueColor ?? '#e5e7eb', fontWeight: 600 }}>{value}</span>
    </span>
  )
}

function KernelDetails({ event }: { event: TraceEvent }) {
  const kernelEvents = useStore((s) =>
    s.events.filter((e) => e.sessionId === event.sessionId && e.type === 'kernel' && e.name === event.name)
  )
  const count = kernelEvents.length
  const avgDur = count > 0
    ? kernelEvents.reduce((s, e) => s + e.duration_ns, 0) / count
    : event.duration_ns

  const e = event

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#60a5fa',
        marginBottom: 6,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }} title={e.name}>
        {e.name}
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {e.occupancy != null && (
          <Chip label="occ" value={`${(e.occupancy * 100).toFixed(1)}%`} valueColor={occColor(e.occupancy)} />
        )}
        {e.limitingResource && (
          <Chip label="limit" value={e.limitingResource} valueColor="#f59e0b" />
        )}
        {e.numRegs != null && e.numRegs > 0 && (
          <Chip label="regs" value={`${e.numRegs}/thread`} />
        )}
        {e.regOccupancy != null && (
          <Chip label="reg occ" value={`${(e.regOccupancy * 100).toFixed(1)}%`} valueColor={occColor(e.regOccupancy)} />
        )}
        {e.smemOccupancy != null && (
          <Chip label="smem occ" value={`${(e.smemOccupancy * 100).toFixed(1)}%`} />
        )}
        {e.warpOccupancy != null && (
          <Chip label="warp occ" value={`${(e.warpOccupancy * 100).toFixed(1)}%`} valueColor={occColor(e.warpOccupancy)} />
        )}
        {e.grid && <Chip label="grid" value={e.grid} />}
        {e.block && <Chip label="block" value={e.block} />}
        <Chip label="gpu" value={fmtDur(avgDur)} valueColor="#34d399" />
        {count > 1 && <Chip label="calls" value={`${count}×`} valueColor="#a78bfa" />}
        {e.localMemTotalBytes != null && (
          <Chip
            label="local mem"
            value={fmtBytes(e.localMemTotalBytes)}
            valueColor={e.localMemTotalBytes > 0 ? '#ef4444' : '#6b7280'}
          />
        )}
        {(e.dynSharedBytes != null && e.dynSharedBytes > 0) && (
          <Chip label="dyn smem" value={fmtBytes(e.dynSharedBytes)} />
        )}
        {(e.staticSharedBytes != null && e.staticSharedBytes > 0) && (
          <Chip label="static smem" value={fmtBytes(e.staticSharedBytes)} />
        )}
      </div>
    </div>
  )
}

function ScopeDetails({ event }: { event: TraceEvent }) {
  const kernelCount = useStore((s) =>
    s.events.filter(
      (e) =>
        e.sessionId === event.sessionId &&
        e.type === 'kernel' &&
        (e.parent_scope_id === event.id ||
          (e.user_scope && (e.user_scope === (event.user_scope || event.name) ||
            e.user_scope.startsWith((event.user_scope || event.name) + '|'))))
    ).length
  )

  const path = event.user_scope || event.name

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{
        fontFamily: 'monospace',
        fontSize: 11,
        color: '#60a5fa',
        marginBottom: 6,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }} title={path}>
        {path}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        <Chip label="duration" value={fmtDur(event.duration_ns)} valueColor="#34d399" />
        <Chip label="kernels" value={`${kernelCount}`} valueColor="#a78bfa" />
        {event.depth != null && <Chip label="depth" value={`${event.depth}`} />}
      </div>
    </div>
  )
}

export default function InsightsPanel({ insights }: InsightsPanelProps) {
  const events = useStore((s) => s.events)
  const currentSessionId = useStore((s) => s.currentSessionId)

  const sessionEvents = events.filter((e) => e.sessionId === currentSessionId)

  if (insights === null) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
        <Spin />
      </div>
    )
  }

  if (insights.length === 0) {
    return (
      <div style={{ color: '#6b7280', textAlign: 'center', padding: 48 }}>
        No insights for this session.
      </div>
    )
  }

  return (
    <List
      dataSource={insights}
      style={{ padding: '8px 16px' }}
      renderItem={(insight) => {
        const isKernel = !!insight.kernelName
        const targetName = insight.kernelName ?? insight.functionName
        const matchedEvent = targetName
          ? sessionEvents.find((e) =>
              isKernel
                ? e.type === 'kernel' && e.name === targetName
                : e.type === 'scope' && (e.name === targetName || e.user_scope === targetName)
            )
          : undefined

        return (
          <List.Item style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 4, paddingBottom: 16 }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center', marginBottom: 2 }}>
              {severityTag(insight.severity)}
              <Tag>{insight.category}</Tag>
              <Typography.Text strong>{insight.title}</Typography.Text>
            </div>

            <Typography.Paragraph style={{ margin: '2px 0 4px', color: '#d1d5db', fontSize: 13 }}>
              {insight.message}
            </Typography.Paragraph>

            <code style={{ fontSize: 11, color: '#93c5fd', background: '#1f2937', padding: '2px 6px', borderRadius: 4 }}>
              {insight.metric}
            </code>

            {matchedEvent && (
              <div style={{
                marginTop: 8,
                padding: '8px 10px',
                background: '#0f1318',
                border: '1px solid #1f2937',
                borderRadius: 6,
                width: '100%',
              }}>
                {isKernel
                  ? <KernelDetails event={matchedEvent} />
                  : <ScopeDetails event={matchedEvent} />
                }
              </div>
            )}
          </List.Item>
        )
      }}
    />
  )
}
