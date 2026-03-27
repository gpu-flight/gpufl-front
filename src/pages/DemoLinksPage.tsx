import React, { useEffect, useState } from 'react'
import {
  Typography,
  Button,
  Table,
  Modal,
  Form,
  Input,
  Alert,
  Popconfirm,
  Tag,
  Space,
  Tooltip,
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, DeleteOutlined, CopyOutlined, LinkOutlined } from '@ant-design/icons'
import { apiFetch } from '@/api'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography

const FRONTEND_BASE = window.location.origin

interface DemoTokenDto {
  id: string
  name: string
  tokenPrefix: string
  revoked: boolean
  createdAt: string
  lastUsedAt: string | null
}

interface DemoTokenCreatedDto {
  id: string
  name: string
  rawToken: string
}

export default function DemoLinksPage() {
  const [tokens, setTokens] = useState<DemoTokenDto[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newToken, setNewToken] = useState<DemoTokenCreatedDto | null>(null)
  const [copied, setCopied] = useState(false)
  const [form] = Form.useForm()

  const fetchTokens = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/v1/auth/demo-tokens')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setTokens(await res.json())
    } catch (e: any) {
      console.error('Failed to fetch demo tokens', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchTokens() }, [])

  const handleCreate = async (values: { name: string }) => {
    setCreating(true)
    setCreateError(null)
    try {
      const res = await apiFetch('/api/v1/auth/demo-tokens', {
        method: 'POST',
        body: JSON.stringify({ name: values.name }),
      })
      if (!res.ok) throw new Error(await res.text())
      setNewToken(await res.json())
      form.resetFields()
      fetchTokens()
    } catch (e: any) {
      setCreateError(e.message || 'Failed to create demo link')
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id: string) => {
    try {
      await apiFetch(`/api/v1/auth/demo-tokens/${id}`, { method: 'DELETE' })
      setTokens((prev) => prev.map((t) => t.id === id ? { ...t, revoked: true } : t))
    } catch (e) {
      console.error('Failed to revoke demo token', e)
    }
  }

  const demoUrl = (rawToken: string) => `${FRONTEND_BASE}/demo/${rawToken}`

  const handleCopy = (text: string) => {
    navigator.clipboard?.writeText(text).catch(() => {
      const el = document.createElement('textarea')
      el.value = text
      el.style.position = 'fixed'
      el.style.opacity = '0'
      document.body.appendChild(el)
      el.select()
      document.execCommand('copy')
      document.body.removeChild(el)
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCloseNewToken = () => {
    setNewToken(null)
    setCopied(false)
    setCreateOpen(false)
  }

  const columns: ColumnsType<DemoTokenDto> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Prefix',
      dataIndex: 'tokenPrefix',
      key: 'tokenPrefix',
      render: (v: string) => <Tag>{v}…</Tag>,
    },
    {
      title: 'Status',
      dataIndex: 'revoked',
      key: 'revoked',
      render: (v: boolean) =>
        v ? <Tag color="red">Revoked</Tag> : <Tag color="green">Active</Tag>,
    },
    {
      title: 'Created',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (v: string) => dayjs(v).format('YYYY-MM-DD HH:mm'),
    },
    {
      title: 'Last Used',
      dataIndex: 'lastUsedAt',
      key: 'lastUsedAt',
      render: (v: string | null) =>
        v ? dayjs(v).format('YYYY-MM-DD HH:mm') : <Text type="secondary">Never</Text>,
    },
    {
      title: '',
      key: 'actions',
      align: 'right',
      render: (_: unknown, record: DemoTokenDto) =>
        !record.revoked ? (
          <Popconfirm
            title="Revoke this demo link?"
            description="Anyone using this link will immediately lose access."
            onConfirm={() => handleRevoke(record.id)}
            okText="Revoke"
            okButtonProps={{ danger: true }}
          >
            <Button danger size="small" icon={<DeleteOutlined />}>Revoke</Button>
          </Popconfirm>
        ) : null,
    },
  ]

  return (
    <div className="api-keys-page">
      <div className="api-keys-header">
        <Title level={4} className="api-keys-title">
          <LinkOutlined className="api-keys-title-icon" />
          Demo Links
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreateOpen(true); setCreateError(null) }}>
          Create Link
        </Button>
      </div>

      <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
        Share these links to give read-only access to your sessions. Each link logs the visitor in as a Demo viewer.
      </Text>

      <Table<DemoTokenDto>
        rowKey="id"
        columns={columns}
        dataSource={tokens}
        loading={loading}
        pagination={false}
        size="small"
        locale={{ emptyText: 'No demo links yet.' }}
      />

      {/* Create modal */}
      <Modal
        title="Create Demo Link"
        open={createOpen && !newToken}
        onCancel={() => { setCreateOpen(false); setCreateError(null); form.resetFields() }}
        footer={null}
        destroyOnClose
      >
        {createError && <Alert type="error" message={createError} className="api-keys-alert" />}
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="Link name"
            name="name"
            rules={[{ required: true, message: 'Enter a name to identify this link' }]}
            extra="E.g. conference-demo or colleague-review"
          >
            <Input placeholder="conference-demo" />
          </Form.Item>
          <Form.Item className="api-keys-form-actions">
            <Space>
              <Button onClick={() => { setCreateOpen(false); form.resetFields() }}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={creating}>Create</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* One-time link display modal */}
      <Modal
        title="Demo Link Created — Copy It Now"
        open={!!newToken}
        onCancel={handleCloseNewToken}
        footer={[
          <Button key="close" type="primary" onClick={handleCloseNewToken}>Done</Button>,
        ]}
        closable={false}
        maskClosable={false}
      >
        <Alert
          type="warning"
          message="This link contains the full token and will not be shown again. Copy it now."
          className="api-keys-alert"
        />
        {newToken && (
          <>
            <Text type="secondary">Link name: </Text>
            <Text strong>{newToken.name}</Text>
            <div className="api-keys-key-row" style={{ marginTop: 12 }}>
              <Paragraph code copyable={false} className="api-keys-key-text">
                {demoUrl(newToken.rawToken)}
              </Paragraph>
              <Button
                icon={<CopyOutlined />}
                onClick={() => handleCopy(demoUrl(newToken.rawToken))}
                type={copied ? 'primary' : 'default'}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
