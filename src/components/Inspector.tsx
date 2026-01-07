import React, { useMemo, useEffect, useRef } from 'react'
import { Card, Descriptions, Typography, Divider, Collapse, Tooltip, Button, Space } from 'antd'
import { InfoCircleOutlined, ArrowRightOutlined } from '@ant-design/icons'
import { useStore } from '@/store/useStore'

function formatDuration(ns: number) {
  const us = ns / 1000
  if (us < 1000) return `${us.toFixed(2)} µs`
  const ms = us / 1000
  if (ms < 1000) return `${ms.toFixed(2)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function formatTimestamp(ns: number) {
  const nsStr = `${ns.toLocaleString()} ns`
  const ms = ns / 1_000_000
  return (
    <span>
      {nsStr} <Typography.Text type="secondary" style={{ fontSize: '10px' }}>({ms.toFixed(3)} ms)</Typography.Text>
    </span>
  )
}

export default function Inspector() {
  const activeEventId = useStore((s) => s.activeEventId)
  const setActiveEvent = useStore((s) => s.setActiveEvent)
  const events = useStore((s) => s.events)
  const currentSessionId = useStore((s) => s.currentSessionId)

  const sessionEvents = useMemo(() => {
    return events.filter(e => e.sessionId === currentSessionId)
  }, [events, currentSessionId])

  const scrollRef = useRef<Record<string, HTMLDivElement | null>>({})

  useEffect(() => {
    if (activeEventId && scrollRef.current[activeEventId]) {
      scrollRef.current[activeEventId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [activeEventId])

  return (
    <Card 
      title="Event Details" 
      size="small" 
      style={{ background: '#0f1318', height: '100%', display: 'flex', flexDirection: 'column' }}
      bodyStyle={{ flex: 1, overflowY: 'auto', padding: 0 }}
    >
      <Collapse
        accordion
        activeKey={activeEventId}
        onChange={(key) => {
          const k = Array.isArray(key) ? key[0] : key;
          setActiveEvent(k || undefined);
        }}
        ghost
      >
        {sessionEvents.map((e) => {
          const stack = e.stack_trace ? e.stack_trace.split('|') : []
          return (
            <Collapse.Panel
              header={
                <div ref={(el) => (scrollRef.current[e.id] = el)}>
                  <Typography.Text strong style={{ color: e.type === 'kernel' ? '#fbbf24' : '#60a5fa' }}>
                    {e.type === 'kernel' ? '[K]' : '[S]'}
                  </Typography.Text>{' '}
                  {e.name}
                </div>
              }
              key={e.id}
            >
              <Descriptions size="small" column={1} bordered>
                <Descriptions.Item label="Name">{e.name}</Descriptions.Item>
                <Descriptions.Item label="Type">{e.type}</Descriptions.Item>
                <Descriptions.Item label="Display Start">{formatTimestamp(e.ts_ns)}</Descriptions.Item>
                
                {e.type === 'kernel' && (
                  <>
                    <Descriptions.Item label={
                      <span>
                        Total Duration{' '}
                        <Tooltip title="The full wall-clock impact on your app.">
                          <InfoCircleOutlined style={{ fontSize: '12px', color: '#9ca3af', cursor: 'pointer' }} />
                        </Tooltip>
                      </span>
                    }>
                      <Typography.Text strong style={{ color: '#60a5fa' }}>
                        {formatDuration(e.total_duration_ns ?? 0)}
                      </Typography.Text>
                    </Descriptions.Item>
                    <Descriptions.Item label={
                      <span>
                        GPU Execution{' '}
                        <Tooltip title="Pure hardware work time.">
                          <InfoCircleOutlined style={{ fontSize: '12px', color: '#9ca3af', cursor: 'pointer' }} />
                        </Tooltip>
                      </span>
                    }>
                      <Typography.Text strong type="success">
                        {formatDuration(e.duration_ns)}
                      </Typography.Text>
                    </Descriptions.Item>
                    <Descriptions.Item label={
                      <span>
                        CPU Overhead{' '}
                        <Tooltip title="Time the main thread was blocked.">
                          <InfoCircleOutlined style={{ fontSize: '12px', color: '#9ca3af', cursor: 'pointer' }} />
                        </Tooltip>
                      </span>
                    }>
                      <Typography.Text strong type="warning">
                        {formatDuration(e.cpu_overhead_ns ?? 0)}
                      </Typography.Text>
                    </Descriptions.Item>
                    <Descriptions.Item label={
                      <span>
                        Queue Latency{' '}
                        <Tooltip title="Time spent waiting for the GPU to be ready.">
                          <InfoCircleOutlined style={{ fontSize: '12px', color: '#9ca3af', cursor: 'pointer' }} />
                        </Tooltip>
                      </span>
                    }>
                      <Typography.Text strong style={{ color: '#a78bfa' }}>
                        {formatDuration(e.queue_latency_ns ?? 0)}
                      </Typography.Text>
                    </Descriptions.Item>
                  </>
                )}

                {e.type === 'scope' && (
                  <Descriptions.Item label="Duration">{formatDuration(e.duration_ns)}</Descriptions.Item>
                )}

                {e.apiStartNs != null && (
                  <Descriptions.Item label="API Start">{formatTimestamp(e.apiStartNs)}</Descriptions.Item>
                )}
                {e.apiExitNs != null && (
                  <Descriptions.Item label="API Exit">{formatTimestamp(e.apiExitNs)}</Descriptions.Item>
                )}
                <Descriptions.Item label="GPU Start">{formatTimestamp(e.start_ns)}</Descriptions.Item>
                <Descriptions.Item label="GPU End">{formatTimestamp(e.end_ns)}</Descriptions.Item>
                {e.stream_id != null && (
                  <Descriptions.Item label="Stream ID">{e.stream_id}</Descriptions.Item>
                )}
                {e.grid && <Descriptions.Item label="Grid">{e.grid}</Descriptions.Item>}
                {e.block && <Descriptions.Item label="Block">{e.block}</Descriptions.Item>}
                {e.user_scope && (
                  <Descriptions.Item label="User Scope">
                    <Space>
                      {e.user_scope}
                      {e.parent_scope_id && (
                        <Button 
                          type="link" 
                          size="small" 
                          icon={<ArrowRightOutlined />} 
                          onClick={(ev) => {
                            ev.stopPropagation();
                            setActiveEvent(e.parent_scope_id);
                          }}
                        >
                          Jump to Scope
                        </Button>
                      )}
                    </Space>
                  </Descriptions.Item>
                )}
              </Descriptions>
              
              {stack.length > 0 && (
                <div style={{ marginTop: 16 }}>
                  <Divider plain>Stack Trace</Divider>
                  <div>
                    {stack.map((frame, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: 999,
                            background: '#60a5fa',
                            marginRight: 8,
                            flexShrink: 0,
                          }}
                        />
                        <Typography.Text style={{ fontSize: '11px', wordBreak: 'break-all' }}>{frame}</Typography.Text>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </Collapse.Panel>
          )
        })}
      </Collapse>
    </Card>
  )
}
