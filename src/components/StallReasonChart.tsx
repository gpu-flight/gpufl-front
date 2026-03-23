import React, { useMemo } from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  LabelList,
  ResponsiveContainer,
} from 'recharts'
import { ProfileSample } from '@/types'

interface StallReasonChartProps {
  samples: ProfileSample[]
}

// CUPTI CUpti_ActivityPCSamplingStallReason integer → display name
const STALL_REASON_NAMES: Record<number, string> = {
  0: 'Invalid',
  1: 'None',
  2: 'Instruction Fetch',
  3: 'Execution Dependency',
  4: 'Memory Dependency',
  5: 'Texture',
  6: 'Sync',
  7: 'Constant Memory',
  8: 'Pipe Busy',
  9: 'Memory Throttle',
  10: 'Branch Resolving',
  11: 'Wait',
  12: 'Barrier',
  13: 'Sleeping',
}

const MEMORY_KEYWORDS = ['MEM', 'TEXTURE', 'L1', 'L2']

function isMemoryReason(reasonName: string): boolean {
  const upper = reasonName.toUpperCase()
  return MEMORY_KEYWORDS.some((kw) => upper.includes(kw))
}

export default function StallReasonChart({ samples }: StallReasonChartProps) {
  const chartData = useMemo(() => {
    const pcSamples = samples.filter(
      (s) => s.sampleKind === 'pc_sampling' && s.stallReason != null && s.stallReason !== 0 && s.stallReason !== 1,
    )
    if (pcSamples.length === 0) return []

    const counts = new Map<string, number>()
    for (const s of pcSamples) {
      const name = STALL_REASON_NAMES[s.stallReason!] ?? `Stall#${s.stallReason}`
      counts.set(name, (counts.get(name) ?? 0) + (s.metricValue ?? s.occurrenceCount))
    }

    const total = [...counts.values()].reduce((a, b) => a + b, 0)

    return [...counts.entries()]
      .map(([reasonName, count]) => ({
        reasonName,
        count,
        pct: total > 0 ? (count / total) * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count)
  }, [samples])

  if (chartData.length === 0) return null

  const barHeight = 28
  const chartHeight = Math.max(120, chartData.length * barHeight + 40)

  return (
    <ResponsiveContainer width="100%" height={chartHeight}>
      <BarChart
        layout="vertical"
        data={chartData}
        margin={{ top: 4, right: 60, bottom: 4, left: 8 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v) => `${v.toFixed(1)}%`}
          tick={{ fill: '#9ca3af', fontSize: 11 }}
          domain={[0, 100]}
        />
        <YAxis
          type="category"
          dataKey="reasonName"
          width={140}
          tick={{ fill: '#d1d5db', fontSize: 11 }}
        />
        <Tooltip
          formatter={(value: number) => [`${value.toFixed(2)}%`, 'Stall %']}
          contentStyle={{ background: '#1f2937', border: '1px solid #374151', fontSize: 12 }}
          labelStyle={{ color: '#f9fafb' }}
        />
        <Bar dataKey="pct" radius={[0, 3, 3, 0]}>
          {chartData.map((entry) => (
            <Cell
              key={entry.reasonName}
              fill={isMemoryReason(entry.reasonName) ? '#dc2626' : '#4682b4'}
            />
          ))}
          <LabelList
            dataKey="pct"
            position="right"
            formatter={(v: number) => `${v.toFixed(1)}%`}
            style={{ fill: '#9ca3af', fontSize: 11 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}
