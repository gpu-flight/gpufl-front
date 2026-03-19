import React, { useMemo, useEffect, useRef } from 'react'
import { Card, Descriptions, Typography, Divider, Collapse, Tooltip, Button, Space } from 'antd'
import { InfoCircleOutlined, ArrowRightOutlined } from '@ant-design/icons'
import { useStore } from '@/store/useStore'
import { formatWallClock, fmtRelNs } from '@/utils/timeFormat'

function formatDuration(ns: number) {
  const us = ns / 1000
  if (us < 1000) return `${us.toFixed(2)} µs`
  const ms = us / 1000
  if (ms < 1000) return `${ms.toFixed(2)} ms`
  return `${(ms / 1000).toFixed(2)} s`
}

function formatTimestamp(ns: number, sessionStartNs?: number) {
  return (
    <span>
      {formatWallClock(ns)}
      {sessionStartNs != null && (
        <Typography.Text type="secondary" style={{ fontSize: '10px', marginLeft: 6 }}>
          (t+{fmtRelNs(ns - sessionStartNs)})
        </Typography.Text>
      )}
    </span>
  )
}

export default function Inspector() {
  const activeEventId = useStore((s) => s.activeEventId)
  const setActiveEvent = useStore((s) => s.setActiveEvent)
  const jumpToScope = useStore((s) => s.jumpToScope)
  const events = useStore((s) => s.events)
  const currentSessionId = useStore((s) => s.currentSessionId)
  const globalRange = useStore((s) => s.globalRange)
  const sessionStartNs = globalRange?.start_ns

  const sessionEvents = useMemo(() => {
    return events.filter(e => e.sessionId === currentSessionId && e.type === 'kernel')
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
          const stack = e.stack_trace ? e.stack_trace.split('|').filter(f => f.trim()) : []
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
                <Descriptions.Item label="Start">{formatTimestamp(e.ts_ns, sessionStartNs)}</Descriptions.Item>
                
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
                  <Descriptions.Item label="API Start">{formatTimestamp(e.apiStartNs, sessionStartNs)}</Descriptions.Item>
                )}
                {e.apiExitNs != null && (
                  <Descriptions.Item label="API Exit">{formatTimestamp(e.apiExitNs, sessionStartNs)}</Descriptions.Item>
                )}
                <Descriptions.Item label="GPU Start">{formatTimestamp(e.start_ns, sessionStartNs)}</Descriptions.Item>
                <Descriptions.Item label="GPU End">{formatTimestamp(e.end_ns, sessionStartNs)}</Descriptions.Item>
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
                            if (e.parent_scope_id) jumpToScope(e.parent_scope_id);
                          }}
                        >
                          Jump to Scope
                        </Button>
                      )}
                    </Space>
                  </Descriptions.Item>
                )}
              </Descriptions>
              
              {e.type === 'kernel' && (
                e.occupancy != null ||
                e.regOccupancy != null ||
                e.smemOccupancy != null ||
                e.warpOccupancy != null ||
                e.blockOccupancy != null ||
                e.limitingResource != null ||
                e.numRegs != null ||
                e.localMemTotalBytes != null ||
                e.dynSharedBytes != null ||
                e.staticSharedBytes != null
              ) && (
                <div style={{ marginTop: 12 }}>
                  <Divider plain>CUDA Metrics</Divider>
                  <Descriptions size="small" column={1} bordered>
                    {e.occupancy != null && (
                      <Descriptions.Item label="Occupancy">
                        {(e.occupancy * 100).toFixed(1)}%
                      </Descriptions.Item>
                    )}
                    <Descriptions.Item label="Limiting Resource">
                      {e.limitingResource ?? '—'}
                    </Descriptions.Item>
                    {e.regOccupancy != null && (
                      <Descriptions.Item label="Reg Occupancy">
                        {(e.regOccupancy * 100).toFixed(1)}%
                      </Descriptions.Item>
                    )}
                    {e.smemOccupancy != null && (
                      <Descriptions.Item label="SMEM Occupancy">
                        {(e.smemOccupancy * 100).toFixed(1)}%
                      </Descriptions.Item>
                    )}
                    {e.warpOccupancy != null && (
                      <Descriptions.Item label="Warp Occupancy">
                        {(e.warpOccupancy * 100).toFixed(1)}%
                      </Descriptions.Item>
                    )}
                    {e.blockOccupancy != null && (
                      <Descriptions.Item label="Block Occupancy">
                        {(e.blockOccupancy * 100).toFixed(1)}%
                      </Descriptions.Item>
                    )}
                    {e.numRegs != null && (
                      <Descriptions.Item label="Registers / Thread">
                        {e.numRegs}
                      </Descriptions.Item>
                    )}
                    {e.localMemTotalBytes != null && (
                      <Descriptions.Item label="Local Mem (spill)">
                        <span style={{ color: e.localMemTotalBytes > 0 ? '#ef4444' : undefined }}>
                          {e.localMemTotalBytes === 0
                            ? '0 B'
                            : e.localMemTotalBytes < 1024
                            ? `${e.localMemTotalBytes} B`
                            : `${(e.localMemTotalBytes / 1024).toFixed(1)} KB`}
                        </span>
                      </Descriptions.Item>
                    )}
                    {(e.dynSharedBytes != null || e.staticSharedBytes != null) && (
                      <Descriptions.Item label="Shared Mem (dyn/static)">
                        {e.dynSharedBytes ?? 0} / {e.staticSharedBytes ?? 0} B
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </div>
              )}

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
