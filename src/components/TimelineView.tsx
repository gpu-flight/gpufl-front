import React, { useEffect, useMemo, useRef } from 'react'
import { Timeline, DataSet } from 'vis-timeline/standalone'
import { TraceEvent } from '@/types'
import { useStore } from '@/store/useStore'

function nsToMs(ns: number) {
  return ns / 1_000_000
}

export interface TimelineViewProps {
  events: TraceEvent[]
}

export default function TimelineView({ events }: TimelineViewProps) {
  const setActiveEvent = useStore((s) => s.setActiveEvent)
  const containerRef = useRef<HTMLDivElement>(null)
  const timelineInstance = useRef<Timeline | null>(null)

  const { groups, items, minStart, maxEnd } = useMemo(() => {
    const groupList: { id: number | string; content: string }[] = []
    const itemsList: any[] = []

    // Fixed group for scopes
    groupList.push({ id: 'cpu', content: 'CPU / Scopes' })

    const streamIds = new Set<number>()
    let minTs = Infinity
    let maxTs = -Infinity

    for (const e of events) {
      const start = nsToMs(e.ts_ns)
      const end = nsToMs(e.ts_ns + e.duration_ns)
      if (start < minTs) minTs = start
      if (end > maxTs) maxTs = end

      if (e.type === 'scope') {
        itemsList.push({
          id: e.id,
          group: 'cpu',
          content: e.name,
          start: new Date(start),
          end: new Date(end),
          className: 'scope-item',
        })
      } else if (e.type === 'kernel') {
        if (typeof e.stream_id === 'number') streamIds.add(e.stream_id)
      }
    }

    // Add GPU groups
    ;[...streamIds].sort((a, b) => a - b).forEach((sid) => {
      groupList.push({ id: `g${sid}`, content: `GPU Stream ${sid}` })
    })

    // Add kernel items into appropriate group
    for (const e of events) {
      if (e.type === 'kernel') {
        const start = nsToMs(e.ts_ns)
        const end = nsToMs(e.ts_ns + e.duration_ns)
        const groupId = typeof e.stream_id === 'number' ? `g${e.stream_id}` : 'cpu'
        itemsList.push({
          id: e.id,
          group: groupId,
          content: e.name,
          start: new Date(start),
          end: new Date(end),
          className: 'kernel-item',
        })
      }
    }

    return {
      groups: new DataSet(groupList),
      items: new DataSet(itemsList),
      minStart: minTs !== Infinity ? new Date(minTs) : undefined,
      maxEnd: maxTs !== -Infinity ? new Date(maxTs) : undefined,
    }
  }, [events])

  const options = useMemo(
    () => ({
      stack: true,
      zoomFriction: 5,
      min: minStart,
      max: maxEnd,
      selectable: true,
      multiselect: false,
      verticalScroll: true,
      configure: false,
      orientation: 'both',
    }),
    [minStart, maxEnd],
  ) as any

  useEffect(() => {
    if (!containerRef.current) return

    // Initialize timeline
    const timeline = new Timeline(containerRef.current, items, groups, options)
    timelineInstance.current = timeline

    // Add event listener
    timeline.on('click', (props: any) => {
      if (props.item) {
        setActiveEvent(String(props.item))
      }
    })

    return () => {
      if (timelineInstance.current) {
        timelineInstance.current.destroy()
        timelineInstance.current = null
      }
    }
  }, [items, groups, options, setActiveEvent])

  if (events.length === 0) {
    return (
      <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f1318', color: '#9ca3af' }}>
        No events to display
      </div>
    )
  }

  return (
    <div ref={containerRef} style={{ height: '100%' }} />
  )
}
