import React, { useMemo } from 'react'
import { Card, Space, Tag, Button, Tabs, Typography } from 'antd'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftOutlined } from '@ant-design/icons'
import { useStore } from '@/store/useStore'
import MetricsChart from '@/components/MetricsChart'
import KernelTimeline from '@/components/KernelTimeline'
import ScopeView from '@/components/ScopeView'
import Inspector from '@/components/Inspector'
import InsightsPanel from '@/components/InsightsPanel'
import SourceCorrelationView from '@/components/SourceCorrelationView'

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
  const systemEvents = useStore((s) => s.systemEvents)
  const metricsRange = useStore((s) => s.metricsRange)
  const insights = useStore((s) => s.insights)
  const fetchInsights = useStore((s) => s.fetchInsights)

  React.useEffect(() => {
    if (sessionId) {
      selectSession(sessionId)
      fetchSystemMetrics(sessionId)
    }
  }, [sessionId, selectSession, fetchSystemMetrics])

  React.useEffect(() => {
    if ((activeTab === 'scopes' || activeTab === 'profile') && sessionId && profileSamples.length === 0) {
      fetchProfileSamples(sessionId)
    }
  }, [activeTab, sessionId, profileSamples.length, fetchProfileSamples])

  React.useEffect(() => {
    if (activeTab === 'insights' && sessionId && insights === null) {
      fetchInsights(sessionId)
    }
  }, [activeTab, sessionId, insights, fetchInsights])

  // Format nanosecond epoch timestamp as HH:MM:SS.mmm — same style as chart x-axis
  const fmtWallTime = (ns: number) => {
    const d = new Date(ns / 1_000_000)
    const hh = String(d.getHours()).padStart(2, '0')
    const mm = String(d.getMinutes()).padStart(2, '0')
    const ss = String(d.getSeconds()).padStart(2, '0')
    const ms = String(d.getMilliseconds()).padStart(3, '0')
    return `${hh}:${mm}:${ss}.${ms}`
  }

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
          onChange={(key) => setActiveTab(key as 'kernels' | 'scopes' | 'profile' | 'system' | 'insights')}
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
              key: 'profile',
              label: 'Profile',
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
                  <SourceCorrelationView />
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
                  {systemEvents.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#9ca3af' }}>System Events</span>
                        {metricsRange && (
                          <span style={{ fontSize: 11, color: '#6b7280', fontFamily: 'monospace' }}>
                            Chart range:&nbsp;
                            <span style={{ color: '#9ca3af' }}>{fmtWallTime(metricsRange.start_ns)}</span>
                            <span style={{ margin: '0 4px' }}>→</span>
                            <span style={{ color: '#9ca3af' }}>{fmtWallTime(metricsRange.end_ns)}</span>
                          </span>
                        )}
                      </div>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, color: '#e5e7eb' }}>
                        <thead>
                          <tr style={{ borderBottom: '1px solid #1f2937', color: '#6b7280', textAlign: 'left' }}>
                            <th style={{ padding: '4px 8px' }}>Event</th>
                            <th style={{ padding: '4px 8px' }}>Name</th>
                            <th style={{ padding: '4px 8px' }}>App</th>
                            <th style={{ padding: '4px 8px' }}>PID</th>
                            <th style={{ padding: '4px 8px' }}>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {systemEvents.map((ev, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid #1f2937' }}>
                              <td style={{ padding: '4px 8px' }}>
                                <Tag color={ev.eventType === 'system_start' ? 'green' : 'red'} style={{ fontSize: 11 }}>
                                  {ev.eventType}
                                </Tag>
                              </td>
                              <td style={{ padding: '4px 8px' }}>{ev.name}</td>
                              <td style={{ padding: '4px 8px' }}>{ev.app}</td>
                              <td style={{ padding: '4px 8px' }}>{ev.pid}</td>
                              <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>
                                {fmtWallTime(ev.tsNs)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
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
