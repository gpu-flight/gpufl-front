import React, { useMemo } from 'react'
import { Card, Col, Row, Space, Tag } from 'antd'
import { useParams } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import MetricsChart from '@/components/MetricsChart'
import TimelineView from '@/components/TimelineView'
import Inspector from '@/components/Inspector'

export default function Dashboard() {
  const { sessionId } = useParams()
  const sessions = useStore((s) => s.sessions)
  const events = useStore((s) => s.events)
  const metrics = useStore((s) => s.metrics)
  const selectSession = useStore((s) => s.selectSession)
  const highlightRange = useStore((s) => s.highlightRange)

  React.useEffect(() => {
    if (sessionId) selectSession(sessionId)
  }, [sessionId, selectSession])

  const session = useMemo(() => sessions.find((s) => s.sessionId === sessionId), [sessions, sessionId])
  const sessionEvents = useMemo(() => events.filter(e => e.sessionId === sessionId), [events, sessionId])
  const sessionMetrics = useMemo(() => metrics.filter(m => m.sessionId === sessionId), [metrics, sessionId])

  return (
    <div style={{ height: 'calc(100vh - 96px)', overflow: 'hidden' }}>
      <Row gutter={12} style={{ height: '100%' }}>
        <Col span={18} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Card size="small" style={{ background: '#0f1318', marginBottom: 12 }}>
            <Space>
              <div style={{ fontSize: 16, fontWeight: 600 }}>{session?.appName ?? 'Session'}</div>
              <Tag color="geekblue">{session?.sessionId}</Tag>
              <Tag color="cyan">GPUs: {session?.gpuCount}</Tag>
              <Tag color="purple">Events: {session?.totalEvents}</Tag>
            </Space>
          </Card>
          <Card title="System Metrics" size="small" style={{ flex: 1, background: '#0f1318', marginBottom: 12, minHeight: 0 }}>
            <div style={{ height: '100%' }}>
              <MetricsChart data={sessionMetrics} highlightRange={highlightRange} />
            </div>
          </Card>
          <Card title="Timeline" size="small" style={{ flex: 1, background: '#0f1318', minHeight: 0 }}>
            <div style={{ height: '100%' }}>
              <TimelineView events={sessionEvents} />
            </div>
          </Card>
        </Col>
        <Col span={6} style={{ height: '100%' }}>
          <Inspector />
        </Col>
      </Row>
    </div>
  )
}
