import React, { useEffect, useMemo, useRef } from 'react'
import { Timeline, DataSet } from 'vis-timeline/standalone'
import { TraceEvent } from '@/types'
import { useStore } from '@/store/useStore'

function nsToUs(ns: number) {
  return ns / 1_000
}

export interface TimelineViewProps {
  events: TraceEvent[]
  globalRange?: { start_ns: number; end_ns: number }
}

export default function TimelineView({ events, globalRange }: TimelineViewProps) {
  const activeEventId = useStore((s) => s.activeEventId)
  const setActiveEvent = useStore((s) => s.setActiveEvent)
  const containerRef = useRef<HTMLDivElement>(null)
  const timelineInstance = useRef<Timeline | null>(null)

  const isInternalSelection = useRef(false)

  const { groups, items, minStart, maxEnd } = useMemo(() => {
    const groupList: any[] = []
    const itemsList: any[] = []

    let minTs = Infinity
    let maxTs = -Infinity

    // Add flat groups for each event
    for (const e of events) {
      const display_end_ns = e.ts_ns + (e.total_duration_ns ?? e.duration_ns)

      const start = nsToUs(e.ts_ns)
      const end = nsToUs(display_end_ns)
      if (start < minTs) minTs = start
      if (end > maxTs) maxTs = end

      // Create a unique group for each event
      const groupId = `group_${e.id}`
      const groupContent = e.type === 'kernel' 
        ? `[K] ${e.name.length > 30 ? e.name.substring(0, 30) + '...' : e.name}`
        : `[S] ${e.name.length > 30 ? e.name.substring(0, 30) + '...' : e.name}`

      groupList.push({ id: groupId, content: groupContent })

      if (e.type === 'scope') {
        itemsList.push({
          id: e.id,
          group: groupId,
          content: e.name,
          start: start,
          end: end,
          className: 'scope-item',
        })
      } else if (e.type === 'kernel') {
        itemsList.push({
          id: e.id,
          group: groupId,
          content: e.name,
          title: `${e.name}\nTotal Duration: ${((e.total_duration_ns ?? 0) / 1000).toFixed(2)} µs\nGPU Execution: ${(e.duration_ns / 1000).toFixed(2)} µs`,
          start: start,
          end: end,
          className: 'kernel-item',
        })
      }
    }

    const minS = globalRange ? nsToUs(globalRange.start_ns) : (minTs !== Infinity ? minTs : undefined)
    const maxE = globalRange ? nsToUs(globalRange.end_ns) : (maxTs !== -Infinity ? maxTs : undefined)

    return {
      groups: new DataSet(groupList),
      items: new DataSet(itemsList),
      minStart: minS,
      maxEnd: maxE,
    }
  }, [events, globalRange])

  useEffect(() => {
    if (!timelineInstance.current) return
    if (activeEventId) {
      // Never focus/zoom automatically when selection changes
      timelineInstance.current.setSelection(activeEventId, { focus: false, animation: false } as any)
      
      // Highlight related items
      const activeEvent = events.find(e => e.id === activeEventId);
      if (activeEvent) {
        const relatedIds = new Set<string>();
        relatedIds.add(activeEvent.id);
        if (activeEvent.parent_scope_id) {
          relatedIds.add(activeEvent.parent_scope_id);
        }
        // Also find all kernels that have this scope as parent if this is a scope
        if (activeEvent.type === 'scope') {
          events.forEach(e => {
            if (e.parent_scope_id === activeEvent.id) {
              relatedIds.add(e.id);
            }
          });
        }

        items.forEach((item: any) => {
          const isRelated = relatedIds.has(item.id);
          // Highlight related items and also the active item itself
          let newClass = item.className.split(' ')[0];
          if (item.id === activeEventId) {
            newClass += ' active-item';
          } else if (isRelated) {
            newClass += ' related-item';
          }
          
          if (item.className !== newClass) {
            items.update({ id: item.id, className: newClass });
          }
        });
      }
    } else {
      timelineInstance.current.setSelection([])
      // Clear highlights
      items.forEach((item: any) => {
        const baseClass = item.className.split(' ')[0];
        if (item.className !== baseClass) {
          items.update({ id: item.id, className: baseClass });
        }
      });
    }
    isInternalSelection.current = false
  }, [activeEventId, events, items])

  const options = useMemo(
    () => ({
      stack: false, // Each item in its own group, no need to stack
      zoomFriction: 5,
      min: minStart,
      max: maxEnd,
      selectable: true,
      multiselect: false,
      verticalScroll: true,
      configure: false,
      orientation: 'both',
      groupHeightMode: 'fixed', // Better performance with many groups
    }),
    [minStart, maxEnd],
  ) as any

  useEffect(() => {
    if (!containerRef.current) return

    // Initialize timeline
    const timeline = new Timeline(containerRef.current, items, groups, options)
    timelineInstance.current = timeline

    // Handle initial selection if needed
    if (activeEventId) {
      // Never focus/zoom automatically
      timeline.setSelection(activeEventId, { focus: false, animation: false } as any)
    }

    // Add event listener
    timeline.on('select', (props: any) => {
      const selectedId = props.items && props.items.length > 0 ? String(props.items[0]) : null
      if (selectedId) {
        isInternalSelection.current = true
        setActiveEvent(selectedId)
      }
    })

    timeline.on('click', (props: any) => {
      // If clicking a group instead of an item, still select the associated event
      if (!props.item && props.group) {
        const groupId = String(props.group)
        if (groupId.startsWith('group_')) {
          const eventId = groupId.replace('group_', '')
          isInternalSelection.current = true
          setActiveEvent(eventId)
          timeline.setSelection(eventId)
        }
      }
    })

    return () => {
      if (timelineInstance.current) {
        timelineInstance.current.destroy()
        timelineInstance.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, groups]) 

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
