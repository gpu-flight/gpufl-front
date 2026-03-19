import React, { useEffect, useState } from 'react'
import { Button, Tag, Typography, Table, Empty, Spin } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import { DesktopOutlined, RightOutlined } from '@ant-design/icons'
import { useStore } from '@/store/useStore'
import { SessionSummary, CudaGpuInfo } from '@/types'
import dayjs from 'dayjs'

const { Text } = Typography

function GpuCard({
  gpu,
  selected,
  onClick,
}: {
  gpu: CudaGpuInfo
  selected: boolean
  onClick: () => void
}) {
  return (
    <div
      className={`gpu-card${selected ? ' gpu-card-selected' : ''}`}
      onClick={onClick}
    >
      <div className="gpu-card-id">GPU {gpu.deviceId}</div>
      <div className="gpu-card-name" title={gpu.name}>{gpu.name}</div>
      <div className="gpu-card-meta">
        <Tag className="session-gpu-tag">SM {gpu.computeMajor}.{gpu.computeMinor}</Tag>
        <Tag className="session-gpu-tag">{gpu.multiProcessorCount} MPs</Tag>
      </div>
    </div>
  )
}

const sessionColumns: ColumnsType<SessionSummary> = [
  {
    title: 'App',
    dataIndex: 'appName',
    key: 'appName',
    render: (v: string) => <Text strong>{v}</Text>,
  },
  {
    title: 'Session ID',
    dataIndex: 'sessionId',
    key: 'sessionId',
    render: (v: string) => (
      <Text type="secondary" className="session-id-text">
        {v}
      </Text>
    ),
  },
  {
    title: 'Start Time',
    dataIndex: 'startTime',
    key: 'startTime',
    render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm:ss'),
  },
  {
    title: 'End Time',
    dataIndex: 'endTime',
    key: 'endTime',
    render: (v?: string) => v ? dayjs(v).format('HH:mm:ss') : <Text type="secondary">running</Text>,
  },
  {
    title: 'GPUs',
    key: 'gpus',
    render: (_: unknown, record: SessionSummary) => (
      <Text type="secondary" className="session-gpus-text">
        {record.gpus.map(g => g.name).filter((v, i, a) => a.indexOf(v) === i).join(', ') || '—'}
      </Text>
    ),
  },
]

export default function SessionList() {
  const hosts = useStore((s) => s.hosts)
  const fetchHosts = useStore((s) => s.fetchHosts)
  const navigate = useNavigate()

  const [loading, setLoading] = useState(false)
  // selectedGpuKey: `${hostname}::${deviceId}` — null means show all sessions for the host
  const [selectedGpuKey, setSelectedGpuKey] = useState<string | null>(null)
  const [expandedHost, setExpandedHost] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    fetchHosts().finally(() => setLoading(false))
  }, [fetchHosts])

  const viewColumn: ColumnsType<SessionSummary>[number] = {
    title: '',
    key: 'actions',
    align: 'right' as const,
    render: (_: unknown, record: SessionSummary) => (
      <Button
        type="primary"
        size="small"
        icon={<RightOutlined />}
        onClick={() => {
          // Also trigger init load so the dashboard has event data
          navigate(`/dashboard/${record.sessionId}`)
        }}
      >
        View
      </Button>
    ),
  }

  if (loading) {
    return (
      <div className="session-list-loading">
        <Spin size="large" />
      </div>
    )
  }

  if (hosts.length === 0) {
    return (
      <div className="session-list-empty">
        <Empty description="No hosts found. Make sure the agent is running and has forwarded at least one init event." />
      </div>
    )
  }

  return (
    <div className="session-list-page">
      <Typography.Title level={4} className="session-list-title">
        Host &amp; GPU Selection
      </Typography.Title>

      <div className="session-list-hosts">
        {hosts.map((host) => {
          const isExpanded = expandedHost === host.hostname

          // Collect unique GPUs across all sessions for this host
          const gpuMap = new Map<number, CudaGpuInfo>()
          for (const s of host.sessions) {
            for (const g of s.gpus) {
              if (!gpuMap.has(g.deviceId)) gpuMap.set(g.deviceId, g)
            }
          }
          const gpus = Array.from(gpuMap.values()).sort((a, b) => a.deviceId - b.deviceId)

          // Filter sessions by selected GPU (if any)
          const selectedDeviceId = selectedGpuKey?.startsWith(host.hostname + '::')
            ? parseInt(selectedGpuKey.split('::')[1])
            : null
          const visibleSessions = selectedDeviceId !== null
            ? host.sessions.filter(s => s.gpus.some(g => g.deviceId === selectedDeviceId))
            : host.sessions

          return (
            <div
              key={host.hostname}
              className={`host-section${isExpanded ? ' host-section-active' : ''}`}
            >
              {/* Host header */}
              <div
                className="host-header"
                onClick={() => {
                  setExpandedHost(isExpanded ? null : host.hostname)
                  setSelectedGpuKey(null)
                }}
              >
                <DesktopOutlined className="host-icon" />
                <span className="host-name">{host.hostname}</span>
                {host.ipAddr && (
                  <Text type="secondary" className="host-ip">
                    {host.ipAddr}
                  </Text>
                )}
                <Tag color="blue" className="host-session-count">
                  {host.sessions.length} session{host.sessions.length !== 1 ? 's' : ''}
                </Tag>
                <Tag color="geekblue">
                  {gpus.length} GPU{gpus.length !== 1 ? 's' : ''}
                </Tag>
              </div>

              {/* GPU cards */}
              {gpus.length > 0 && (
                <div className="gpu-card-grid">
                  {gpus.map(gpu => {
                    const gpuKey = `${host.hostname}::${gpu.deviceId}`
                    return (
                      <GpuCard
                        key={gpu.deviceId}
                        gpu={gpu}
                        selected={selectedGpuKey === gpuKey}
                        onClick={() => {
                          setExpandedHost(host.hostname)
                          setSelectedGpuKey(selectedGpuKey === gpuKey ? null : gpuKey)
                        }}
                      />
                    )
                  })}
                </div>
              )}

              {/* Sessions table */}
              {isExpanded && (
                <div className="host-sessions-wrap">
                  <Table<SessionSummary>
                    rowKey="sessionId"
                    columns={[...sessionColumns, viewColumn]}
                    dataSource={visibleSessions}
                    pagination={false}
                    size="small"
                  />
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
