import React, { useMemo } from 'react'
import { Card, Col, Row, Space, Tag, Button } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useStore } from '@/store/useStore'
import MetricsChart from '@/components/MetricsChart'
import TimelineView from '@/components/TimelineView'
import Inspector from '@/components/Inspector'

export default function Dashboard() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const sessions = useStore((s) => s.sessions)
  const events = useStore((s) => s.events)
  const hostMetrics = useStore((s) => s.hostMetrics)
  const deviceMetrics = useStore((s) => s.deviceMetrics)
  const metricsRange = useStore((s) => s.metricsRange)
  const globalRange = useStore((s) => s.globalRange)
  const fetchSystemMetrics = useStore((s) => s.fetchSystemMetrics)
  const selectSession = useStore((s) => s.selectSession)
  const highlightRange = useStore((s) => s.highlightRange)

  React.useEffect(() => {
    if (sessionId) {
      selectSession(sessionId)
      fetchSystemMetrics(sessionId)
    }
  }, [sessionId, selectSession, fetchSystemMetrics])

  const session = useMemo(() => sessions.find((s) => s.sessionId === sessionId), [sessions, sessionId])
  const sessionEvents = useMemo(() => events.filter(e => e.sessionId === sessionId), [events, sessionId])

  return (
    <div style={{ height: 'calc(100vh - 96px)', overflow: 'hidden' }}>
      <Row gutter={12} style={{ height: '100%' }}>
        <Col span={24} style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <Card size="small" style={{ background: '#0f1318', marginBottom: 12 }}>
            <Space>
              <Button 
                type="text" 
                icon={<ArrowLeftOutlined />} 
                onClick={() => navigate('/')}
                style={{ color: '#9ca3af', paddingLeft: 0 }}
              >
                Back
              </Button>
              <div style={{ fontSize: 16, fontWeight: 600, marginLeft: 8 }}>{session?.appName ?? 'Session'}</div>
              <Tag color="geekblue">{session?.sessionId}</Tag>
              <Tag color="cyan">GPUs: {session?.gpuCount}</Tag>
              <Tag color="purple">Events: {session?.totalEvents}</Tag>
            </Space>
          </Card>
          <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
            <Card title="System Metrics" size="small" style={{ background: '#0f1318', marginBottom: 12 }}>
              <MetricsChart hostData={hostMetrics} deviceData={deviceMetrics} globalRange={globalRange} highlightRange={highlightRange} />
            </Card>
            
            <Row gutter={12} style={{ height: 500 }}>
              <Col span={18} style={{ height: '100%' }}>
                <Card title="Timeline" size="small" style={{ background: '#0f1318', height: '100%' }}>
                  <div style={{ height: '100%' }}>
                    <TimelineView events={sessionEvents} globalRange={globalRange} />
                  </div>
                </Card>
              </Col>
              <Col span={6} style={{ height: '100%' }}>
                <Inspector />
              </Col>
            </Row>
          </div>
        </Col>
      </Row>
    </div>
  )
}
