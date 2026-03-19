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
} from 'antd'
import type { ColumnsType } from 'antd/es/table'
import { PlusOutlined, DeleteOutlined, CopyOutlined, KeyOutlined } from '@ant-design/icons'
import { apiFetch } from '@/api'
import dayjs from 'dayjs'

const { Title, Text, Paragraph } = Typography

interface ApiKeyDto {
  id: string
  name: string
  keyPrefix: string
  createdAt: string
  lastUsedAt: string | null
}

interface ApiKeyCreatedDto {
  id: string
  name: string
  rawKey: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKeyDto[]>([])
  const [loading, setLoading] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [newKey, setNewKey] = useState<ApiKeyCreatedDto | null>(null)
  const [copied, setCopied] = useState(false)
  const [form] = Form.useForm()

  const fetchKeys = async () => {
    setLoading(true)
    try {
      const res = await apiFetch('/api/v1/auth/api-keys')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      setKeys(await res.json())
    } catch (e: any) {
      console.error('Failed to fetch API keys', e)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchKeys() }, [])

  const handleCreate = async (values: { name: string }) => {
    setCreating(true)
    setCreateError(null)
    try {
      const res = await apiFetch('/api/v1/auth/api-keys', {
        method: 'POST',
        body: JSON.stringify({ name: values.name }),
      })
      if (!res.ok) throw new Error(await res.text())
      const created: ApiKeyCreatedDto = await res.json()
      setNewKey(created)
      form.resetFields()
      fetchKeys()
    } catch (e: any) {
      setCreateError(e.message || 'Failed to create key')
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (id: string) => {
    try {
      await apiFetch(`/api/v1/auth/api-keys/${id}`, { method: 'DELETE' })
      setKeys((prev) => prev.filter((k) => k.id !== id))
    } catch (e) {
      console.error('Failed to revoke key', e)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleCloseNewKey = () => {
    setNewKey(null)
    setCopied(false)
    setCreateOpen(false)
  }

  const columns: ColumnsType<ApiKeyDto> = [
    {
      title: 'Name',
      dataIndex: 'name',
      key: 'name',
      render: (v: string) => <Text strong>{v}</Text>,
    },
    {
      title: 'Prefix',
      dataIndex: 'keyPrefix',
      key: 'keyPrefix',
      render: (v: string) => (
        <Tag className="api-key-prefix">{v}…</Tag>
      ),
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
      render: (_: unknown, record: ApiKeyDto) => (
        <Popconfirm
          title="Revoke this key?"
          description="The agent using this key will immediately lose access."
          onConfirm={() => handleRevoke(record.id)}
          okText="Revoke"
          okButtonProps={{ danger: true }}
        >
          <Button danger size="small" icon={<DeleteOutlined />}>
            Revoke
          </Button>
        </Popconfirm>
      ),
    },
  ]

  return (
    <div className="api-keys-page">
      <div className="api-keys-header">
        <Title level={4} className="api-keys-title">
          <KeyOutlined className="api-keys-title-icon" />
          API Keys
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setCreateOpen(true); setCreateError(null) }}>
          Generate Key
        </Button>
      </div>

      <Table<ApiKeyDto>
        rowKey="id"
        columns={columns}
        dataSource={keys}
        loading={loading}
        pagination={false}
        size="small"
        locale={{ emptyText: 'No API keys yet. Generate one to let the agent authenticate.' }}
      />

      {/* Create modal */}
      <Modal
        title="Generate API Key"
        open={createOpen && !newKey}
        onCancel={() => { setCreateOpen(false); setCreateError(null); form.resetFields() }}
        footer={null}
        destroyOnClose
      >
        {createError && <Alert type="error" message={createError} className="api-keys-alert" />}
        <Form form={form} layout="vertical" onFinish={handleCreate}>
          <Form.Item
            label="Key name"
            name="name"
            rules={[{ required: true, message: 'Enter a name to identify this key' }]}
            extra="E.g. my-workstation-agent"
          >
            <Input placeholder="my-workstation-agent" />
          </Form.Item>
          <Form.Item className="api-keys-form-actions">
            <Space>
              <Button onClick={() => { setCreateOpen(false); form.resetFields() }}>Cancel</Button>
              <Button type="primary" htmlType="submit" loading={creating}>Generate</Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* One-time key display modal */}
      <Modal
        title="Key Generated — Copy It Now"
        open={!!newKey}
        onCancel={handleCloseNewKey}
        footer={[
          <Button key="close" type="primary" onClick={handleCloseNewKey}>
            Done
          </Button>,
        ]}
        closable={false}
        maskClosable={false}
      >
        <Alert
          type="warning"
          message="This key will not be shown again. Copy it now and store it securely."
          className="api-keys-alert"
        />
        {newKey && (
          <>
            <Text type="secondary">Key name: </Text>
            <Text strong>{newKey.name}</Text>
            <div className="api-keys-key-row">
              <Paragraph
                code
                copyable={false}
                className="api-keys-key-text"
              >
                {newKey.rawKey}
              </Paragraph>
              <Button
                icon={<CopyOutlined />}
                onClick={() => handleCopy(newKey.rawKey)}
                type={copied ? 'primary' : 'default'}
              >
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <div className="api-keys-config-block">
              <Text type="secondary">Place this in your agent config:</Text>
              <Paragraph
                code
                className="api-keys-config-code"
              >
                {`"publisher": {\n  "authToken": "${newKey.rawKey}"\n}`}
              </Paragraph>
            </div>
          </>
        )}
      </Modal>
    </div>
  )
}
