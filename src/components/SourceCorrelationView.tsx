import { useEffect, useMemo, useState } from 'react'
import { Table, Empty } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useStore } from '@/store/useStore'
import { apiFetch } from '@/api'

interface SourceLineRow {
  key: string
  sourceLine: number | null
  stallHits: number
  stallShare: number
  instExec: number
  threadExec: number
  divergencePct: number | null
  dominantPc: number | null
  coalescingFactor: number | null  // actual / ideal sectors; 1.0 = perfectly coalesced
}

interface FunctionEntry {
  funcKey: string
  displayName: string
  sourceFile: string
  totalStalls: number
  rows: SourceLineRow[]
}

function parseFunctionKey(raw?: string): { name: string; sourceFile: string } {
  if (!raw) return { name: '', sourceFile: '' }
  const at = raw.lastIndexOf('@')
  if (at === -1) return { name: raw, sourceFile: '' }
  return { name: raw.slice(0, at), sourceFile: raw.slice(at + 1) }
}

function rowStyle(stallShare: number): React.CSSProperties {
  if (stallShare > 0.3) return { background: 'rgba(220,38,38,0.12)' }
  if (stallShare > 0.15) return { background: 'rgba(202,138,4,0.10)' }
  return {}
}

function coalColor(v: number): string {
  if (v <= 1.5) return '#16a34a'  // near-ideal coalescing
  if (v <= 4.0) return '#ca8a04'  // partial coalescing
  return '#dc2626'                 // poor coalescing
}

function divColor(pct: number): string {
  if (pct > 20) return '#dc2626'
  if (pct > 10) return '#ca8a04'
  return '#16a34a'
}

export default function SourceCorrelationView() {
  const profileSamples = useStore((s) => s.profileSamples)
  const currentSessionId = useStore((s) => s.currentSessionId)
  const [selectedFuncKey, setSelectedFuncKey] = useState<string | null>(null)
  const [sourceLines, setSourceLines] = useState<string[]>([])
  const [disassembly, setDisassembly] = useState<Map<number, string>>(new Map())

  const functionEntries: FunctionEntry[] = useMemo(() => {
    const samples = profileSamples.filter((s) => s.sessionId === currentSessionId)
    if (samples.length === 0) return []

    type LineAgg = {
      funcKey: string
      displayName: string
      sourceFile: string
      sourceLine: number | null
      stallHits: number
      instExec: number
      threadExec: number
      dominantPc: number | null
      dominantPcHits: number
      sectorsGlobal: number
      sectorsGlobalIdeal: number
    }

    const lineMap = new Map<string, LineAgg>()

    for (const s of samples) {
      const parsed = parseFunctionKey(s.functionName)
      const displayName = parsed.name || s.functionName || '(unknown)'
      const sourceFile = s.sourceFile ?? parsed.sourceFile
      const funcKey = `${displayName}@${sourceFile}`
      const sourceLine = (s.sourceLine != null && s.sourceLine > 0) ? s.sourceLine : null
      const lineKey = `${funcKey}::${sourceLine}`

      if (!lineMap.has(lineKey)) {
        lineMap.set(lineKey, { funcKey, displayName, sourceFile, sourceLine, stallHits: 0, instExec: 0, threadExec: 0, dominantPc: null, dominantPcHits: 0, sectorsGlobal: 0, sectorsGlobalIdeal: 0 })
      }
      const agg = lineMap.get(lineKey)!

      if (s.sampleKind === 'pc_sampling') {
        const hits = s.occurrenceCount
        agg.stallHits += hits
        // PC sampling may have pc_offset=0 (not meaningful); prefer SASS-derived pc
        const pc = (s.pcOffset != null && s.pcOffset > 0) ? s.pcOffset : null
        if (pc != null && hits > agg.dominantPcHits) {
          agg.dominantPc = pc
          agg.dominantPcHits = hits
        }
      } else if (s.sampleKind === 'sass_metric') {
        if (s.metricName === 'smsp__sass_inst_executed') {
          agg.instExec += s.metricValue ?? 0
          // Use the instruction with the most executions as the representative PC
          const pc = s.pcOffset ?? null
          const val = s.metricValue ?? 0
          if (pc != null && val > agg.dominantPcHits) {
            agg.dominantPc = pc
            agg.dominantPcHits = val
          }
        } else if (s.metricName === 'smsp__sass_thread_inst_executed') {
          agg.threadExec += s.metricValue ?? 0
        } else if (s.metricName === 'smsp__sass_sectors_mem_global') {
          agg.sectorsGlobal += s.metricValue ?? 0
        } else if (s.metricName === 'smsp__sass_sectors_mem_global_ideal') {
          agg.sectorsGlobalIdeal += s.metricValue ?? 0
        }
      }
    }

    // Group lines by function
    const funcMap = new Map<string, LineAgg[]>()
    for (const agg of lineMap.values()) {
      if (!funcMap.has(agg.funcKey)) funcMap.set(agg.funcKey, [])
      funcMap.get(agg.funcKey)!.push(agg)
    }

    const result: FunctionEntry[] = []
    for (const [funcKey, lines] of funcMap) {
      const { displayName, sourceFile } = lines[0]
      const totalStalls = lines.reduce((s, l) => s + l.stallHits, 0)

      const rows: SourceLineRow[] = lines.map((l) => {
        const avg = l.instExec > 0 ? l.threadExec / l.instExec : 0
        const divergencePct = l.instExec > 0 ? ((32 - Math.min(32, avg)) / 32) * 100 : null
        const stallShare = totalStalls > 0 ? l.stallHits / totalStalls : 0
        return {
          key: `${funcKey}::${l.sourceLine}`,
          sourceLine: l.sourceLine,
          stallHits: l.stallHits,
          stallShare,
          instExec: l.instExec,
          threadExec: l.threadExec,
          divergencePct,
          dominantPc: l.dominantPc,
          coalescingFactor: l.sectorsGlobalIdeal > 0 ? l.sectorsGlobal / l.sectorsGlobalIdeal : null,
        }
      })

      rows.sort((a, b) => (a.sourceLine ?? 999999) - (b.sourceLine ?? 999999))
      result.push({ funcKey, displayName, sourceFile, totalStalls, rows })
    }

    result.sort((a, b) => b.totalStalls - a.totalStalls)
    return result
  }, [profileSamples, currentSessionId])

  const selected =
    functionEntries.find((e) => e.funcKey === selectedFuncKey) ?? functionEntries[0] ?? null

  // Fetch source lines whenever the selected function changes
  useEffect(() => {
    setSourceLines([])
    if (!selected?.sourceFile || !currentSessionId) return
    apiFetch(
      `/api/v1/events/source-content?sessionId=${encodeURIComponent(currentSessionId)}&sourcePath=${encodeURIComponent(selected.sourceFile)}`
    )
      .then((r) => (r.ok ? r.json() : Promise.resolve([])))
      .then((lines: string[]) => setSourceLines(lines))
      .catch(() => setSourceLines([]))
  }, [selected?.sourceFile, currentSessionId])

  // Fetch SASS disassembly for the selected function
  useEffect(() => {
    setDisassembly(new Map())
    if (!selected?.displayName || !currentSessionId) return
    apiFetch(
      `/api/v1/events/disassembly?sessionId=${encodeURIComponent(currentSessionId)}&functionName=${encodeURIComponent(selected.displayName)}`
    )
      .then((r) => (r.ok ? r.json() : Promise.resolve([])))
      .then((entries: { pcOffset: number; sass: string }[]) =>
        setDisassembly(new Map(entries.map((e) => [e.pcOffset, e.sass])))
      )
      .catch(() => {})
  }, [selected?.funcKey, currentSessionId])

  const dash = <span style={{ color: '#4b5563' }}>—</span>

  const columns: ColumnsType<SourceLineRow> = [
    {
      title: 'Line',
      dataIndex: 'sourceLine',
      width: 70,
      render: (v: number | null) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v != null ? v : dash}</span>
      ),
    },
    {
      title: 'Code',
      dataIndex: 'sourceLine',
      key: 'code',
      ellipsis: true,
      render: (v: number | null) => {
        const text = v != null && sourceLines.length >= v ? sourceLines[v - 1] : null
        if (!text) return dash
        return (
          <code
            style={{
              fontSize: 11,
              fontFamily: 'monospace',
              color: '#93c5fd',
              background: 'rgba(59,130,246,0.08)',
              padding: '1px 4px',
              borderRadius: 3,
              whiteSpace: 'pre',
            }}
          >
            {text.trimStart()}
          </code>
        )
      },
    },
    {
      title: 'SASS',
      key: 'sass',
      ellipsis: true,
      render: (_: unknown, record: SourceLineRow) => {
        const text = record.dominantPc != null ? disassembly.get(record.dominantPc) : null
        if (!text) return dash
        return (
          <code style={{ fontSize: 10, fontFamily: 'monospace', color: '#86efac' }}>
            {text}
          </code>
        )
      },
    },
    {
      title: 'Stall Hits',
      dataIndex: 'stallHits',
      width: 100,
      align: 'right',
      defaultSortOrder: 'descend',
      sorter: (a, b) => a.stallHits - b.stallHits,
      render: (v: number) => (v > 0 ? v.toLocaleString() : dash),
    },
    {
      title: 'Stall %',
      dataIndex: 'stallShare',
      width: 90,
      align: 'right',
      render: (v: number) => (v > 0 ? `${(v * 100).toFixed(1)}%` : dash),
    },
    {
      title: 'Warp Instr',
      dataIndex: 'instExec',
      width: 110,
      align: 'right',
      render: (v: number) => (v > 0 ? v.toLocaleString() : dash),
    },
    {
      title: 'Thread Instr',
      dataIndex: 'threadExec',
      width: 120,
      align: 'right',
      render: (v: number) => (v > 0 ? v.toLocaleString() : dash),
    },
    {
      title: 'Divergence',
      dataIndex: 'divergencePct',
      width: 110,
      align: 'right',
      sorter: (a, b) => (a.divergencePct ?? -1) - (b.divergencePct ?? -1),
      render: (v: number | null) =>
        v != null ? (
          <span style={{ color: divColor(v), fontWeight: 600 }}>{v.toFixed(1)}%</span>
        ) : (
          dash
        ),
    },
    {
      title: 'Coal. ×',
      dataIndex: 'coalescingFactor',
      width: 90,
      align: 'right' as const,
      sorter: (a: SourceLineRow, b: SourceLineRow) => (a.coalescingFactor ?? -1) - (b.coalescingFactor ?? -1),
      render: (v: number | null) =>
        v != null ? (
          <span style={{ color: coalColor(v), fontWeight: 600 }}>{v.toFixed(1)}×</span>
        ) : (
          dash
        ),
    },
  ]

  if (functionEntries.length === 0) {
    return (
      <div style={{ padding: 48, textAlign: 'center' }}>
        <Empty
          description={
            <span style={{ color: '#6b7280' }}>
              No profile sample data for this session.
              <br />
              Run with <code>PcSampling</code> or <code>SassMetrics</code> engine enabled.
            </span>
          }
        />
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', height: '100%', overflow: 'hidden' }}>
      {/* Left panel — function list sorted by stall count */}
      <div
        style={{
          width: 280,
          flexShrink: 0,
          borderRight: '1px solid #1f2937',
          overflowY: 'auto',
          padding: '8px 0',
        }}
      >
        {functionEntries.map((entry) => {
          const isSelected =
            selectedFuncKey === entry.funcKey ||
            (selectedFuncKey === null && entry === functionEntries[0])
          const basename = entry.sourceFile.split('/').pop() ?? entry.sourceFile
          return (
            <div
              key={entry.funcKey}
              onClick={() => setSelectedFuncKey(entry.funcKey)}
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
                title={entry.displayName}
              >
                {entry.displayName}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#6b7280',
                  fontFamily: 'monospace',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginTop: 2,
                }}
                title={entry.sourceFile}
              >
                {basename || '(no source)'}
              </div>
              {entry.totalStalls > 0 && (
                <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 2 }}>
                  {entry.totalStalls.toLocaleString()} stalls
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Right panel — per-source-line table */}
      <div style={{ flex: 1, overflow: 'auto', padding: 16 }}>
        {selected && (
          <>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#e5e7eb' }}>
                {selected.displayName}
              </div>
              <div
                style={{
                  fontSize: 11,
                  color: '#6b7280',
                  fontFamily: 'monospace',
                  marginTop: 2,
                }}
              >
                {selected.sourceFile || '(source path unknown)'}
              </div>
            </div>
            <Table
              size="small"
              columns={columns}
              dataSource={selected.rows}
              pagination={false}
              scroll={{ y: 'calc(100vh - 300px)' }}
              onRow={(record) => ({ style: rowStyle(record.stallShare) })}
            />
          </>
        )}
      </div>
    </div>
  )
}
