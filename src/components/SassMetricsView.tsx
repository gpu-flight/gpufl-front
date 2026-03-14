import React, { useMemo, useState } from 'react'
import { Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useStore } from '@/store/useStore'
import { formatWallClock, fmtRelNs } from '@/utils/timeFormat'

interface InstructionRow {
  key: string
  pcOffset: string
  functionName: string
  sourceFile: string
  sourceLine: number | null
  tsNs: number
  instExecuted: number
  threadInstExecuted: number
  avgActiveThreads: number
  divergencePct: number
}

interface KernelEntry {
  groupKey: string
  kernelName: string
  startTsNs: number
  avgActiveThreads: number
  rows: InstructionRow[]
}

function divergenceColor(avg: number): string {
  if (avg >= 28) return '#16a34a'
  if (avg >= 16) return '#ca8a04'
  return '#dc2626'
}

function rowBackground(avg: number): React.CSSProperties {
  if (avg < 16) return { background: 'rgba(220,38,38,0.12)' }
  if (avg < 28) return { background: 'rgba(202,138,4,0.12)' }
  return {}
}

export default function SassMetricsView() {
  const profileSamples = useStore((s) => s.profileSamples)
  const events = useStore((s) => s.events)
  const currentSessionId = useStore((s) => s.currentSessionId)
  const globalRange = useStore((s) => s.globalRange)
  const sessionStartNs = globalRange?.start_ns
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null)

  const kernelMap = useMemo(() => {
    const m = new Map<number, string>()
    for (const e of events) {
      if (e.type === 'kernel' && e.sessionId === currentSessionId) {
        const corrId = (e as any).corrId ?? (e as any).corr_id
        if (corrId != null) m.set(corrId, e.name)
      }
    }
    return m
  }, [events, currentSessionId])

  const scopeMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const e of events) {
      if (e.type === 'scope' && e.sessionId === currentSessionId) {
        m.set(e.id, e.name)
      }
    }
    return m
  }, [events, currentSessionId])

  const kernelEntries: KernelEntry[] = useMemo(() => {
    const sassSamples = profileSamples.filter(
      (s) => s.sampleKind === 'sass_metric' && s.sessionId === currentSessionId,
    )

    // Group key: for SASS metrics (corrId=0), use scopeId; for PC sampling, use corrId
    type PcKey = string
    const pcData = new Map<
      string,
      Map<PcKey, { instExecuted: number; threadInstExecuted: number; functionName: string; sourceFile: string; sourceLine: number | null; tsNs: number }>
    >()

    for (const s of sassSamples) {
      const groupKey = s.corrId === 0 ? `scope:${s.scopeId ?? 'unknown'}` : `corr:${s.corrId}`
      const pcOffset = s.pcOffset ?? '0x0'
      if (!pcData.has(groupKey)) pcData.set(groupKey, new Map())
      const corrMap = pcData.get(groupKey)!
      if (!corrMap.has(pcOffset)) {
        corrMap.set(pcOffset, {
          instExecuted: 0,
          threadInstExecuted: 0,
          functionName: s.functionName ?? '',
          sourceFile: s.sourceFile ?? '',
          sourceLine: s.sourceLine ?? null,
          tsNs: s.tsNs,
        })
      }
      const entry = corrMap.get(pcOffset)!
      if (s.metricName === 'smsp__sass_inst_executed') {
        entry.instExecuted += s.metricValue ?? 0
      } else if (s.metricName === 'smsp__sass_thread_inst_executed') {
        entry.threadInstExecuted += s.metricValue ?? 0
      }
    }

    const result: KernelEntry[] = []
    for (const [groupKey, pcMap] of pcData.entries()) {
      const rows: InstructionRow[] = []
      for (const [pcOffset, vals] of pcMap.entries()) {
        if (vals.instExecuted === 0) continue
        const avg = Math.min(32, vals.threadInstExecuted / vals.instExecuted)
        rows.push({
          key: `${groupKey}-${pcOffset}`,
          pcOffset,
          functionName: vals.functionName,
          sourceFile: vals.sourceFile,
          sourceLine: vals.sourceLine,
          tsNs: vals.tsNs,
          instExecuted: vals.instExecuted,
          threadInstExecuted: vals.threadInstExecuted,
          avgActiveThreads: avg,
          divergencePct: ((32 - avg) / 32) * 100,
        })
      }
      rows.sort((a, b) => a.avgActiveThreads - b.avgActiveThreads)

      // Weighted mean across instructions
      let totalInst = 0
      let weightedSum = 0
      for (const r of rows) {
        totalInst += r.instExecuted
        weightedSum += r.avgActiveThreads * r.instExecuted
      }
      const sessionAvg = totalInst > 0 ? weightedSum / totalInst : 0

      const startTsNs = rows.length > 0 ? Math.min(...rows.map((r) => r.tsNs)) : 0

      // Resolve display name: scope name for SASS metrics, kernel name for PC sampling
      let displayName: string
      if (groupKey.startsWith('scope:')) {
        const scopeId = groupKey.slice('scope:'.length)
        displayName = scopeMap.get(scopeId) ?? `scope:${scopeId.slice(0, 8)}`
      } else {
        const corrId = parseInt(groupKey.slice('corr:'.length), 10)
        displayName = kernelMap.get(corrId) ?? `corr_id:${corrId}`
      }

      result.push({
        groupKey,
        kernelName: displayName,
        startTsNs,
        avgActiveThreads: sessionAvg,
        rows,
      })
    }

    result.sort((a, b) => a.avgActiveThreads - b.avgActiveThreads)
    return result
  }, [profileSamples, currentSessionId, kernelMap, scopeMap])

  const selectedKernel = kernelEntries.find((k) => k.groupKey === selectedGroupKey) ?? kernelEntries[0] ?? null

  const columns: ColumnsType<InstructionRow> = [
    {
      title: 'Time',
      dataIndex: 'tsNs',
      width: 160,
      render: (v: number) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {formatWallClock(v)}
          {sessionStartNs != null && (
            <span style={{ color: '#6b7280', marginLeft: 4 }}>
              t+{fmtRelNs(v - sessionStartNs)}
            </span>
          )}
        </span>
      ),
    },
    {
      title: 'PC Offset',
      dataIndex: 'pcOffset',
      width: 110,
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
      render: (_: unknown, record: InstructionRow) => {
        const file = record.sourceFile
        const line = record.sourceLine
        if (!file) return <span style={{ color: '#6b7280', fontSize: 12 }}>—</span>
        const basename = file.split('/').pop() ?? file
        return (
          <span style={{ fontFamily: 'monospace', fontSize: 12 }} title={file}>
            {basename}{line != null ? `:${line}` : ''}
          </span>
        )
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
      sorter: (a, b) => a.avgActiveThreads - b.avgActiveThreads,
      render: (v: number) => (
        <span style={{ color: divergenceColor(v), fontWeight: 600 }}>{v.toFixed(2)}</span>
      ),
    },
    {
      title: 'Divergence %',
      dataIndex: 'divergencePct',
      width: 120,
      align: 'right',
      render: (v: number) => `${v.toFixed(1)}%`,
    },
  ]

  if (kernelEntries.length === 0) {
    return (
      <div style={{ padding: 32, color: '#6b7280', textAlign: 'center' }}>
        No SASS metric data for this session. Run the agent with <code>SassMetrics</code> engine enabled.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left panel — kernel list */}
      <div
        style={{
          width: 260,
          flexShrink: 0,
          borderRight: '1px solid #1f2937',
          overflowY: 'auto',
          padding: '8px 0',
        }}
      >
        {kernelEntries.map((k) => {
          const isSelected = selectedGroupKey === k.groupKey || (selectedGroupKey === null && k === kernelEntries[0])
          return (
            <div
              key={k.groupKey}
              onClick={() => setSelectedGroupKey(k.groupKey)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                background: isSelected ? '#1e293b' : 'transparent',
                borderLeft: isSelected ? '3px solid #3b82f6' : '3px solid transparent',
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: '#e5e7eb',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={k.kernelName}
              >
                {k.kernelName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: divergenceColor(k.avgActiveThreads),
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  avg {k.avgActiveThreads.toFixed(1)} threads/warp
                </span>
              </div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2, fontFamily: 'monospace' }}>
                {formatWallClock(k.startTsNs)}
                {sessionStartNs != null && (
                  <span style={{ marginLeft: 4 }}>t+{fmtRelNs(k.startTsNs - sessionStartNs)}</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Right panel — instruction table */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {selectedKernel && (
          <>
            <div style={{ marginBottom: 12, fontSize: 13, color: '#9ca3af' }}>
              <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{selectedKernel.kernelName}</span>
              &nbsp;— {selectedKernel.rows.length} instructions
            </div>
            <Table
              size="small"
              columns={columns}
              dataSource={selectedKernel.rows}
              pagination={false}
              scroll={{ y: 'calc(100vh - 280px)' }}
              onRow={(record) => ({ style: rowBackground(record.avgActiveThreads) })}
            />
          </>
        )}
      </div>
    </div>
  )
}
