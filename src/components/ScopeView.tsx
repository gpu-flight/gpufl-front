import React, { useMemo, useState, useEffect } from 'react'
import { Tree, Typography, Tag, Divider, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PushpinOutlined, PushpinFilled } from '@ant-design/icons'
import { TraceEvent, ProfileSample } from '@/types'
import { useStore } from '@/store/useStore'
import { formatWallClock, fmtRelNs } from '@/utils/timeFormat'
import MetricsChart from '@/components/MetricsChart'

// Padding on each side of the scope when rendering the system chart
const CHART_PAD_NS = 2_000_000_000 // 2 seconds

interface ScopeNode {
  key: string
  title: string
  children: ScopeNode[]
  scopeEvent?: TraceEvent
}

function buildScopeTree(scopes: TraceEvent[]): ScopeNode[] {
  const nodeMap = new Map<string, ScopeNode>()

  const sorted = [...scopes].sort((a, b) => {
    const aDepth = (a.user_scope || a.name).split('|').length
    const bDepth = (b.user_scope || b.name).split('|').length
    return aDepth - bDepth
  })

  for (const scope of sorted) {
    const path = scope.user_scope || scope.name
    const parts = path.split('|')

    for (let i = 0; i < parts.length; i++) {
      const key = parts.slice(0, i + 1).join('|')
      const name = parts[i]

      if (!nodeMap.has(key)) {
        nodeMap.set(key, {
          key,
          title: name,
          children: [],
          scopeEvent: i === parts.length - 1 ? scope : undefined,
        })
      } else if (i === parts.length - 1) {
        const node = nodeMap.get(key)!
        if (!node.scopeEvent) node.scopeEvent = scope
      }
    }
  }

  const topLevel: ScopeNode[] = []
  for (const [key, node] of nodeMap) {
    const parts = key.split('|')
    if (parts.length === 1) {
      topLevel.push(node)
    } else {
      const parentKey = parts.slice(0, -1).join('|')
      const parent = nodeMap.get(parentKey)
      if (parent && !parent.children.find((c) => c.key === key)) {
        parent.children.push(node)
      }
    }
  }

  return topLevel
}

function fmtDur(ns: number): string {
  const us = ns / 1000
  if (us < 1000) return `${us.toFixed(2)} µs`
  const ms = us / 1000
  if (ms < 1000) return `${ms.toFixed(2)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function divergenceColor(avg: number): string {
  if (avg >= 28) return '#16a34a'
  if (avg >= 16) return '#ca8a04'
  return '#dc2626'
}

interface SassRow {
  key: string
  pcOffset: string
  functionName: string
  sourceFile: string
  sourceLine: number | null
  instExecuted: number
  threadInstExecuted: number
  avgActiveThreads: number
  divergencePct: number
  occurrenceCount: number
}

function buildSassRows(samples: ProfileSample[]): SassRow[] {
  const rows: SassRow[] = []
  for (const s of samples) {
    if (s.instExecuted === 0) continue
    const avg = Math.min(32, s.threadInstExecuted / s.instExecuted)
    const pcKey = `${s.functionName ?? ''}::${s.pcOffset ?? '0x0'}`
    rows.push({
      key: pcKey,
      pcOffset: s.pcOffset ?? '0x0',
      functionName: s.functionName ?? '',
      sourceFile: s.sourceFile ?? '',
      sourceLine: s.sourceLine ?? null,
      instExecuted: s.instExecuted,
      threadInstExecuted: s.threadInstExecuted,
      avgActiveThreads: avg,
      divergencePct: ((32 - avg) / 32) * 100,
      occurrenceCount: s.occurrenceCount,
    })
  }
  return rows.sort((a, b) => a.avgActiveThreads - b.avgActiveThreads)
}

const SASS_COLUMNS: ColumnsType<SassRow> = [
  {
    title: 'PC Offset',
    dataIndex: 'pcOffset',
    width: 100,
    render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v}</span>,
  },
  {
    title: 'Function',
    dataIndex: 'functionName',
    ellipsis: true,
    render: (v: string) => <span style={{ fontSize: 12 }}>{v || '—'}</span>,
  },
  {
    title: 'Source',
    key: 'source',
    ellipsis: true,
    render: (_: unknown, r: SassRow) => {
      if (!r.sourceFile) return <span style={{ color: '#6b7280', fontSize: 12 }}>—</span>
      const basename = r.sourceFile.split('/').pop() ?? r.sourceFile
      return <span style={{ fontFamily: 'monospace', fontSize: 12 }} title={r.sourceFile}>{basename}{r.sourceLine != null ? `:${r.sourceLine}` : ''}</span>
    },
  },
  {
    title: 'Warp Instr',
    dataIndex: 'instExecuted',
    width: 110,
    align: 'right',
    render: (v: number) => v.toLocaleString(),
  },
  {
    title: 'Thread Instr',
    dataIndex: 'threadInstExecuted',
    width: 120,
    align: 'right',
    render: (v: number) => v.toLocaleString(),
  },
  {
    title: 'Avg Active Threads',
    dataIndex: 'avgActiveThreads',
    width: 150,
    align: 'right',
    defaultSortOrder: 'ascend',
    sorter: (a: SassRow, b: SassRow) => a.avgActiveThreads - b.avgActiveThreads,
    render: (v: number) => <span style={{ color: divergenceColor(v), fontWeight: 600 }}>{v.toFixed(2)}</span>,
  },
  {
    title: 'Divergence %',
    dataIndex: 'divergencePct',
    width: 110,
    align: 'right',
    render: (v: number) => `${v.toFixed(1)}%`,
  },
  {
    title: 'Runs',
    dataIndex: 'occurrenceCount',
    width: 70,
    align: 'right',
  },
]

interface ScopeDetailProps {
  scopeEvent: TraceEvent
  kernels: TraceEvent[]
  sassMetrics: ProfileSample[]
  onSelectEvent: (id: string) => void
  activeEventId?: string
}

function ScopeDetail({ scopeEvent, kernels, sassMetrics, onSelectEvent, activeEventId }: ScopeDetailProps) {
  const globalRange = useStore((s) => s.globalRange)
  const sessionStartNs = globalRange?.start_ns
  const hostMetrics = useStore((s) => s.hostMetrics)
  const deviceMetrics = useStore((s) => s.deviceMetrics)

  // Chart window: scope ± max(CHART_PAD_NS, 50% of scope duration)
  const chartRange = useMemo(() => {
    const pad = Math.max(CHART_PAD_NS, scopeEvent.duration_ns * 0.5)
    return {
      start_ns: scopeEvent.ts_ns - pad,
      end_ns: scopeEvent.ts_ns + scopeEvent.duration_ns + pad,
    }
  }, [scopeEvent])

  const highlightRange = useMemo(() => ({
    start_ns: scopeEvent.ts_ns,
    end_ns: scopeEvent.ts_ns + scopeEvent.duration_ns,
  }), [scopeEvent])

  const chartHostMetrics = useMemo(
    () => hostMetrics.filter(m => m.tsNs >= chartRange.start_ns && m.tsNs <= chartRange.end_ns),
    [hostMetrics, chartRange],
  )
  const chartDeviceMetrics = useMemo(
    () => deviceMetrics.filter(m => m.tsNs >= chartRange.start_ns && m.tsNs <= chartRange.end_ns),
    [deviceMetrics, chartRange],
  )

  const hasSystemData = chartHostMetrics.length > 0 || chartDeviceMetrics.length > 0

  const scopeKernels = useMemo(() => {
    return kernels
      .filter((k) => {
        if (k.parent_scope_id === scopeEvent.id) return true
        if (!k.user_scope) return false
        const scopePath = scopeEvent.user_scope || scopeEvent.name
        return k.user_scope === scopePath || k.user_scope.startsWith(scopePath + '|')
      })
      .sort((a, b) => a.ts_ns - b.ts_ns)
  }, [scopeEvent, kernels])

  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ marginBottom: 12 }}>
        <Typography.Title level={5} style={{ margin: 0, color: '#60a5fa' }}>
          {scopeEvent.name}
        </Typography.Title>
        <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <Tag color="blue">
            {formatWallClock(scopeEvent.ts_ns)}
            {sessionStartNs != null && (
              <span style={{ opacity: 0.7, marginLeft: 4 }}>
                t+{fmtRelNs(scopeEvent.ts_ns - sessionStartNs)}
              </span>
            )}
          </Tag>
          <Tag color="green">Duration: {fmtDur(scopeEvent.duration_ns)}</Tag>
          {scopeEvent.user_scope && (
            <Tag color="default" style={{ fontSize: 11 }}>
              {scopeEvent.user_scope}
            </Tag>
          )}
        </div>
        <Typography.Text type="secondary" style={{ fontSize: 11 }}>
          {scopeKernels.length} kernel{scopeKernels.length !== 1 ? 's' : ''}
        </Typography.Text>
      </div>
      <div>
        {scopeKernels.length === 0 ? (
          <div style={{ color: '#6b7280', textAlign: 'center', padding: 16 }}>
            No kernels in this scope
          </div>
        ) : (
          scopeKernels.map((k) => {
            const isActive = k.id === activeEventId
            return (
              <div
                key={k.id}
                className={`scope-kernel-row${isActive ? ' scope-kernel-row-active' : ''}`}
                onClick={() => onSelectEvent(k.id)}
              >
                <Typography.Text
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: isActive ? '#fbbf24' : '#e5e7eb',
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={k.name}
                >
                  {k.name}
                </Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 11 }}>
                  {formatWallClock(k.ts_ns)}
                  {sessionStartNs != null && ` (t+${fmtRelNs(k.ts_ns - sessionStartNs)})`}
                  {' · '}GPU: {fmtDur(k.duration_ns)} | Total:{' '}
                  {fmtDur(k.total_duration_ns ?? k.duration_ns)}
                </Typography.Text>
              </div>
            )
          })
        )}
      </div>

      <Divider plain style={{ margin: '16px 0 8px', fontSize: 12, color: '#6b7280' }}>
        System Metrics
      </Divider>
      {hasSystemData ? (
        <MetricsChart
          hostData={chartHostMetrics}
          deviceData={chartDeviceMetrics}
          globalRange={chartRange}
          highlightRange={highlightRange}
        />
      ) : (
        <div style={{ color: '#6b7280', textAlign: 'center', padding: '8px 0 16px', fontSize: 12 }}>
          No system samples in ±{CHART_PAD_NS >= 1_000_000_000
            ? `${(CHART_PAD_NS / 1_000_000_000).toFixed(0)} s`
            : `${(CHART_PAD_NS / 1_000_000).toFixed(0)} ms`} around this scope
        </div>
      )}

      {sassMetrics.length > 0 && (() => {
        const rows = buildSassRows(sassMetrics)
        const totalInst = rows.reduce((s, r) => s + r.instExecuted, 0)
        const weightedAvg = totalInst > 0
          ? rows.reduce((s, r) => s + r.avgActiveThreads * r.instExecuted, 0) / totalInst
          : 0
        const nRuns = rows.length > 0 ? Math.max(...rows.map(r => r.occurrenceCount)) : 0
        return (
          <>
            <Divider plain style={{ margin: '16px 0 8px', fontSize: 12, color: '#6b7280' }}>
              SASS Metrics — avg{' '}
              <span style={{ color: divergenceColor(weightedAvg), fontWeight: 600 }}>
                {weightedAvg.toFixed(2)}
              </span>
              {' '}threads/warp · {nRuns} run{nRuns !== 1 ? 's' : ''} ({rows.length} instructions)
            </Divider>
            <Table
              size="small"
              columns={SASS_COLUMNS}
              dataSource={rows}
              pagination={false}
              scroll={{ x: true }}
              onRow={(record) => ({
                style: record.avgActiveThreads < 16
                  ? { background: 'rgba(220,38,38,0.12)' }
                  : record.avgActiveThreads < 28
                  ? { background: 'rgba(202,138,4,0.12)' }
                  : {},
              })}
            />
          </>
        )
      })()}
    </div>
  )
}

interface ScopeViewProps {
  events: TraceEvent[]
  onSelectEvent: (id: string) => void
}

export default function ScopeView({ events, onSelectEvent }: ScopeViewProps) {
  const activeEventId = useStore((s) => s.activeEventId)
  const comparedScopeIds = useStore((s) => s.comparedScopeIds)
  const toggleComparedScope = useStore((s) => s.toggleComparedScope)
  const activeScopeKey = useStore((s) => s.activeScopeKey)
  const profileSamples = useStore((s) => s.profileSamples)

  const [selectedKey, setSelectedKey] = useState<string | undefined>()

  useEffect(() => {
    if (activeScopeKey) setSelectedKey(activeScopeKey)
  }, [activeScopeKey])

  const scopeEvents = useMemo(() => events.filter((e) => e.type === 'scope'), [events])
  const kernelEvents = useMemo(() => events.filter((e) => e.type === 'kernel'), [events])

  const scopeByKey = useMemo(() => {
    const map = new Map<string, TraceEvent>()
    for (const s of scopeEvents) {
      map.set(s.user_scope || s.name, s)
    }
    return map
  }, [scopeEvents])

  const scopeById = useMemo(() => {
    const map = new Map<string, TraceEvent>()
    for (const s of scopeEvents) map.set(s.id, s)
    return map
  }, [scopeEvents])

  const sassByScopeName = useMemo(() => {
    const map = new Map<string, ProfileSample[]>()
    for (const s of profileSamples) {
      if (!s.scopeName) continue
      const arr = map.get(s.scopeName) ?? []
      arr.push(s)
      map.set(s.scopeName, arr)
    }
    return map
  }, [profileSamples])

  const treeData = useMemo(() => {
    const tree = buildScopeTree(scopeEvents)
    function convert(nodes: ScopeNode[]): any[] {
      return nodes.map((node) => ({
        key: node.key,
        title: node.title,
        children: convert(node.children),
        _scopeEvent: node.scopeEvent,
      }))
    }
    return convert(tree)
  }, [scopeEvents])

  const selectedScope = useMemo(() => {
    if (!selectedKey) return undefined
    return scopeByKey.get(selectedKey) ?? scopeById.get(selectedKey)
  }, [selectedKey, scopeByKey, scopeById])

  const comparedScopes = useMemo(
    () => comparedScopeIds.map((id) => scopeById.get(id)).filter(Boolean) as TraceEvent[],
    [comparedScopeIds, scopeById],
  )

  const isComparisonMode = comparedScopes.length >= 2

  const renderTitle = (nodeData: any) => {
    const scopeEvent: TraceEvent | undefined = nodeData._scopeEvent
    const scopeId = scopeEvent?.id
    const isPinned = scopeId ? comparedScopeIds.includes(scopeId) : false

    return (
      <div className="scope-tree-node">
        <span style={{ flex: 1 }}>{nodeData.title}</span>
        {scopeEvent && (
          <span
            className={`scope-tree-pin${isPinned ? ' scope-tree-pin-active' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              if (scopeId) toggleComparedScope(scopeId)
            }}
          >
            {isPinned ? (
              <PushpinFilled style={{ color: '#f59e0b', fontSize: 12 }} />
            ) : (
              <PushpinOutlined style={{ color: '#6b7280', fontSize: 12 }} />
            )}
          </span>
        )}
      </div>
    )
  }

  if (scopeEvents.length === 0) {
    return (
      <div style={{ padding: 32, color: '#6b7280', textAlign: 'center' }}>
        No scope events in this session
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', gap: 0 }}>
      {/* Left: Scope Tree */}
      <div
        style={{
          width: 280,
          flexShrink: 0,
          borderRight: '1px solid #1f2937',
          overflowY: 'auto',
          padding: '8px 0',
        }}
      >
        {comparedScopeIds.length > 0 && (
          <Typography.Text
            type="secondary"
            style={{ fontSize: 11, padding: '0 12px 6px', display: 'block' }}
          >
            {comparedScopeIds.length} scope{comparedScopeIds.length !== 1 ? 's' : ''} pinned
          </Typography.Text>
        )}
        <Tree
          treeData={treeData}
          titleRender={renderTitle}
          selectedKeys={selectedKey ? [selectedKey] : []}
          onSelect={(keys) => setSelectedKey(keys[0] as string | undefined)}
          style={{ background: 'transparent' }}
          blockNode
          defaultExpandAll
        />
      </div>

      {/* Right: Scope Detail or Comparison */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {isComparisonMode ? (
          <div style={{ display: 'flex', gap: 0, height: '100%' }}>
            {comparedScopes.map((scope, i) => (
              <div
                key={scope.id}
                style={{
                  flex: 1,
                  borderLeft: i > 0 ? '1px solid #1f2937' : 'none',
                  minWidth: 0,
                }}
              >
                <ScopeDetail
                  scopeEvent={scope}
                  kernels={kernelEvents}
                  sassMetrics={sassByScopeName.get(scope.name) ?? []}
                  onSelectEvent={onSelectEvent}
                  activeEventId={activeEventId}
                />
              </div>
            ))}
          </div>
        ) : selectedScope ? (
          <ScopeDetail
            scopeEvent={selectedScope}
            kernels={kernelEvents}
            sassMetrics={sassByScopeName.get(selectedScope.name) ?? []}
            onSelectEvent={onSelectEvent}
            activeEventId={activeEventId}
          />
        ) : (
          <div style={{ padding: 32, color: '#6b7280', textAlign: 'center' }}>
            Select a scope from the tree
          </div>
        )}
      </div>
    </div>
  )
}
