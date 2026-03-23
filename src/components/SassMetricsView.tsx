import { useMemo, useState } from 'react'
import { Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useStore } from '@/store/useStore'

interface InstructionRow {
  key: string
  pcOffset: number | null
  functionName: string
  sourceFile: string
  instExecuted: number
  threadInstExecuted: number
  avgActiveThreads: number
  divergencePct: number
}

interface ScopeEntry {
  groupKey: string
  scopeName: string
  avgActiveThreads: number
  rows: InstructionRow[]
}

// functionName is stored as "name@sourceFile" from the client dictionary
function parseFunctionKey(raw?: string): { name: string; sourceFile: string } {
  if (!raw) return { name: '', sourceFile: '' }
  const at = raw.lastIndexOf('@')
  if (at === -1) return { name: raw, sourceFile: '' }
  return { name: raw.slice(0, at), sourceFile: raw.slice(at + 1) }
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
  const currentSessionId = useStore((s) => s.currentSessionId)
  const [selectedGroupKey, setSelectedGroupKey] = useState<string | null>(null)

  const scopeEntries: ScopeEntry[] = useMemo(() => {
    const sassSamples = profileSamples.filter(
      (s) => s.sampleKind === 'sass_metric' && s.sessionId === currentSessionId,
    )

    // Group by scopeName (resolved string stored directly in the DB row)
    type PcKey = number | null
    const pcData = new Map<
      string,
      Map<PcKey, { instExecuted: number; threadInstExecuted: number; functionName: string; sourceFile: string }>
    >()

    for (const s of sassSamples) {
      const groupKey = s.scopeName ?? '(no scope)'
      const pcKey = s.pcOffset ?? null
      if (!pcData.has(groupKey)) pcData.set(groupKey, new Map())
      const pcMap = pcData.get(groupKey)!
      if (!pcMap.has(pcKey)) {
        const { name, sourceFile } = parseFunctionKey(s.functionName)
        pcMap.set(pcKey, { instExecuted: 0, threadInstExecuted: 0, functionName: name, sourceFile })
      }
      const entry = pcMap.get(pcKey)!
      if (s.metricName === 'smsp__sass_inst_executed') {
        entry.instExecuted += s.metricValue ?? 0
      } else if (s.metricName === 'smsp__sass_thread_inst_executed') {
        entry.threadInstExecuted += s.metricValue ?? 0
      }
    }

    const result: ScopeEntry[] = []
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
          instExecuted: vals.instExecuted,
          threadInstExecuted: vals.threadInstExecuted,
          avgActiveThreads: avg,
          divergencePct: ((32 - avg) / 32) * 100,
        })
      }
      rows.sort((a, b) => a.avgActiveThreads - b.avgActiveThreads)

      let totalInst = 0
      let weightedSum = 0
      for (const r of rows) {
        totalInst += r.instExecuted
        weightedSum += r.avgActiveThreads * r.instExecuted
      }
      const scopeAvg = totalInst > 0 ? weightedSum / totalInst : 0

      result.push({ groupKey, scopeName: groupKey, avgActiveThreads: scopeAvg, rows })
    }

    result.sort((a, b) => a.avgActiveThreads - b.avgActiveThreads)
    return result
  }, [profileSamples, currentSessionId])

  const selectedScope = scopeEntries.find((e) => e.groupKey === selectedGroupKey) ?? scopeEntries[0] ?? null

  const columns: ColumnsType<InstructionRow> = [
    {
      title: 'PC Offset',
      dataIndex: 'pcOffset',
      width: 110,
      render: (v: number | null) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>
          {v != null ? `0x${v.toString(16)}` : '—'}
        </span>
      ),
    },
    {
      title: 'Function',
      dataIndex: 'functionName',
      ellipsis: true,
      render: (v: string) => <span style={{ fontSize: 12 }}>{v || '—'}</span>,
    },
    {
      title: 'Source',
      dataIndex: 'sourceFile',
      ellipsis: true,
      render: (v: string) => {
        if (!v) return <span style={{ color: '#6b7280', fontSize: 12 }}>—</span>
        const basename = v.split('/').pop() ?? v
        return <span style={{ fontFamily: 'monospace', fontSize: 12 }} title={v}>{basename}</span>
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

  if (scopeEntries.length === 0) {
    return (
      <div style={{ padding: 32, color: '#6b7280', textAlign: 'center' }}>
        No SASS metric data for this session. Run the agent with <code>SassMetrics</code> engine enabled.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left panel — scope list */}
      <div
        style={{
          width: 260,
          flexShrink: 0,
          borderRight: '1px solid #1f2937',
          overflowY: 'auto',
          padding: '8px 0',
        }}
      >
        {scopeEntries.map((entry) => {
          const isSelected = selectedGroupKey === entry.groupKey || (selectedGroupKey === null && entry === scopeEntries[0])
          return (
            <div
              key={entry.groupKey}
              onClick={() => setSelectedGroupKey(entry.groupKey)}
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
                title={entry.scopeName}
              >
                {entry.scopeName}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: divergenceColor(entry.avgActiveThreads),
                    flexShrink: 0,
                  }}
                />
                <span style={{ fontSize: 11, color: '#9ca3af' }}>
                  avg {entry.avgActiveThreads.toFixed(1)} threads/warp
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Right panel — instruction table */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {selectedScope && (
          <>
            <div style={{ marginBottom: 12, fontSize: 13, color: '#9ca3af' }}>
              <span style={{ color: '#e5e7eb', fontWeight: 600 }}>{selectedScope.scopeName}</span>
              &nbsp;— {selectedScope.rows.length} instructions
            </div>
            <Table
              size="small"
              columns={columns}
              dataSource={selectedScope.rows}
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
