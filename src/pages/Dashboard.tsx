import React, { useMemo } from 'react'
import { Card, Space, Tag, Button, Tabs } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useStore } from '@/store/useStore'
import MetricsChart from '@/components/MetricsChart'
import KernelTimeline from '@/components/KernelTimeline'
import ScopeView from '@/components/ScopeView'
import Inspector from '@/components/Inspector'
import InsightsPanel from '@/components/InsightsPanel'

export default function Dashboard() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const sessions = useStore((s) => s.sessions)
  const events = useStore((s) => s.events)
  const hostMetrics = useStore((s) => s.hostMetrics)
  const deviceMetrics = useStore((s) => s.deviceMetrics)
  const globalRange = useStore((s) => s.globalRange)
  const fetchSystemMetrics = useStore((s) => s.fetchSystemMetrics)
  const selectSession = useStore((s) => s.selectSession)
  const highlightRange = useStore((s) => s.highlightRange)
  const setActiveEvent = useStore((s) => s.setActiveEvent)
  const activeEventId = useStore((s) => s.activeEventId)
  const activeTab = useStore((s) => s.activeTab)
  const setActiveTab = useStore((s) => s.setActiveTab)
  const profileSamples = useStore((s) => s.profileSamples)
  const fetchProfileSamples = useStore((s) => s.fetchProfileSamples)
  const insights = useStore((s) => s.insights)
  const fetchInsights = useStore((s) => s.fetchInsights)

  React.useEffect(() => {
    if (sessionId) {
      selectSession(sessionId)
      fetchSystemMetrics(sessionId)
    }
  }, [sessionId, selectSession, fetchSystemMetrics])

  React.useEffect(() => {
    if (activeTab === 'scopes' && sessionId && profileSamples.length === 0) {
      fetchProfileSamples(sessionId)
    }
  }, [activeTab, sessionId, profileSamples.length, fetchProfileSamples])

  React.useEffect(() => {
    if (activeTab === 'insights' && sessionId && insights === null) {
      fetchInsights(sessionId)
    }
  }, [activeTab, sessionId, insights, fetchInsights])

  const session = useMemo(
    () => sessions.find((s) => s.sessionId === sessionId),
    [sessions, sessionId],
  )

  // Auto-refresh system metrics when the session is still running
  React.useEffect(() => {
    if (activeTab !== 'system' || !sessionId || session?.endTime) return
    const id = setInterval(() => fetchSystemMetrics(sessionId), 5_000)
    return () => clearInterval(id)
  }, [activeTab, sessionId, session?.endTime, fetchSystemMetrics])
  const sessionEvents = useMemo(
    () => events.filter((e) => e.sessionId === sessionId),
    [events, sessionId],
  )
  const kernelEvents = useMemo(
    () => sessionEvents.filter((e) => e.type === 'kernel'),
    [sessionEvents],
  )

  return (
    <div
      style={{
        height: 'calc(100vh - 96px)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Header */}
      <Card size="small" style={{ background: '#0f1318', marginBottom: 8, flexShrink: 0 }}>
        <Space>
          <Button
            type="text"
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/')}
            style={{ color: '#9ca3af', paddingLeft: 0 }}
          >
            Back
          </Button>
          <div style={{ fontSize: 16, fontWeight: 600, marginLeft: 8 }}>
            {session?.appName ?? 'Session'}
          </div>
          <Tag color="geekblue">{session?.sessionId}</Tag>
          <Tag color="cyan">GPUs: {session?.gpuCount}</Tag>
          <Tag color="purple">Events: {session?.totalEvents}</Tag>
        </Space>
      </Card>

      {/* Three-tab layout */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as 'kernels' | 'scopes' | 'system' | 'insights')}
          className="dashboard-tabs"
          items={[
            {
              key: 'kernels',
              label: 'Kernels',
              children: (
                <div
                  style={{
                    display: 'flex',
                    height: '100%',
                    gap: 12,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      background: '#0f1318',
                      borderRadius: 6,
                      border: '1px solid #1f2937',
                    }}
                  >
                    <KernelTimeline
                      events={kernelEvents}
                      onSelectEvent={setActiveEvent}
                      activeEventId={activeEventId}
                      sessionStartNs={globalRange?.start_ns}
                    />
                  </div>
                  <div style={{ width: 320, flexShrink: 0 }}>
                    <Inspector />
                  </div>
                </div>
              ),
            },
            {
              key: 'scopes',
              label: 'Scopes',
              children: (
                <div
                  style={{
                    height: '100%',
                    background: '#0f1318',
                    borderRadius: 6,
                    border: '1px solid #1f2937',
                    overflow: 'hidden',
                  }}
                >
                  <ScopeView events={sessionEvents} onSelectEvent={setActiveEvent} />
                </div>
              ),
            },
            {
              key: 'system',
              label: 'System',
              children: (
                <div
                  style={{
                    height: '100%',
                    overflowY: 'auto',
                    background: '#0f1318',
                    borderRadius: 6,
                    border: '1px solid #1f2937',
                    padding: 16,
                  }}
                >
                  <MetricsChart
                    hostData={hostMetrics}
                    deviceData={deviceMetrics}
                    globalRange={globalRange}
                    highlightRange={highlightRange}
                    isLive={!session?.endTime}
                  />
                </div>
              ),
            },
            {
              key: 'insights',
              label: 'Insights',
              children: (
                <div
                  style={{
                    height: '100%',
                    overflowY: 'auto',
                    background: '#0f1318',
                    borderRadius: 6,
                    border: '1px solid #1f2937',
                  }}
                >
                  <InsightsPanel insights={insights} />
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  )
}
