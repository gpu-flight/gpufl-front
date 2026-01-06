import React, { useMemo } from 'react'
import { Button, Table } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/store/useStore'
import { Session } from '@/types'
import dayjs from 'dayjs'

export default function SessionList() {
  const sessions = useStore((s) => s.sessions)
  const navigate = useNavigate()

  const columns: ColumnsType<Session> = useMemo(
    () => [
      { title: 'App Name', dataIndex: 'appName', key: 'appName' },
      { title: 'Session ID', dataIndex: 'sessionId', key: 'sessionId' },
      {
        title: 'Start Time',
        dataIndex: 'startTime',
        key: 'startTime',
        render: (v: number) => dayjs.unix(v).format('YYYY-MM-DD HH:mm:ss'),
      },
      { title: 'GPU Count', dataIndex: 'gpuCount', key: 'gpuCount' },
      {
        title: 'Actions',
        key: 'actions',
        render: (_, record) => (
          <Button type="primary" onClick={() => navigate(`/dashboard/${record.sessionId}`)}>
            View Dashboard
          </Button>
        ),
      },
    ],
    [navigate],
  )

  return (
    <div>
      <h2 style={{ marginBottom: 16 }}>Sessions</h2>
      <Table<Session>
        rowKey={(r) => r.sessionId}
        columns={columns}
        dataSource={sessions}
        pagination={false}
      />
    </div>
  )
}
