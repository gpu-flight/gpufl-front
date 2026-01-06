import React, { useMemo } from 'react'
import { Drawer, Descriptions, Typography, Divider } from 'antd'
import { useStore } from '@/store/useStore'

function formatDuration(ns: number) {
  const us = ns / 1000
  if (us < 1000) return `${us.toFixed(2)} µs`
  const ms = us / 1000
  if (ms < 1000) return `${ms.toFixed(2)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function nsToTime(ns: number) {
  return new Date(ns / 1_000_000).toLocaleString()
}

export default function Inspector() {
  const activeEvent = useStore((s) => s.activeEvent)
  const setActiveEvent = useStore((s) => s.setActiveEvent)

  const stack = useMemo(() => {
    const raw = activeEvent?.stack_trace
    if (!raw) return [] as string[]
    return raw.split('|')
  }, [activeEvent])

  return (
    <Drawer
      title="Inspector"
      open={!!activeEvent}
      onClose={() => setActiveEvent(undefined)}
      width={360}
    >
      {activeEvent && (
        <div>
          <Descriptions size="small" column={1} bordered>
            <Descriptions.Item label="Name">{activeEvent.name}</Descriptions.Item>
            <Descriptions.Item label="Type">{activeEvent.type}</Descriptions.Item>
            <Descriptions.Item label="Start">{nsToTime(activeEvent.ts_ns)}</Descriptions.Item>
            <Descriptions.Item label="Duration">{formatDuration(activeEvent.duration_ns)}</Descriptions.Item>
            {activeEvent.stream_id != null && (
              <Descriptions.Item label="Stream ID">{activeEvent.stream_id}</Descriptions.Item>
            )}
            {activeEvent.grid && <Descriptions.Item label="Grid">{activeEvent.grid}</Descriptions.Item>}
            {activeEvent.block && <Descriptions.Item label="Block">{activeEvent.block}</Descriptions.Item>}
            {activeEvent.user_scope && (
              <Descriptions.Item label="User Scope">{activeEvent.user_scope}</Descriptions.Item>
            )}
          </Descriptions>
          {stack.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <Divider>Stack Trace</Divider>
              <div>
                {stack.map((frame, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center' }}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: '#60a5fa',
                        marginRight: 8,
                      }}
                    />
                    <Typography.Text>{frame}</Typography.Text>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Drawer>
  )
}
