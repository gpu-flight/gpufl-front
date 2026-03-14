import React, { useState } from 'react'
import { Form, Input, Button, Typography, Alert, ConfigProvider, theme } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'

const { Title } = Typography

export default function LoginPage() {
  const login = useAuthStore((s) => s.login)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { emailOrUsername: string; password: string }) => {
    setError(null)
    setLoading(true)
    try {
      await login(values.emailOrUsername, values.password)
      navigate('/')
    } catch (e: any) {
      setError(e.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorBgBase: '#0b0d10', colorTextBase: '#e5e7eb' } }}>
    <div style={{ minHeight: '100vh', background: '#0b0d10', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
    <div style={{ maxWidth: 400, width: '100%', margin: '80px 16px 0' }}>
      <Title level={3} style={{ marginBottom: 24 }}>Sign In</Title>
      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item label="Email or Username" name="emailOrUsername" rules={[{ required: true }]}>
          <Input autoComplete="username" />
        </Form.Item>
        <Form.Item label="Password" name="password" rules={[{ required: true }]}>
          <Input.Password autoComplete="current-password" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Sign In
          </Button>
        </Form.Item>
      </Form>
      <div style={{ textAlign: 'center' }}>
        No account? <Link to="/register">Register</Link>
      </div>
    </div>
    </div>
    </ConfigProvider>
  )
}
