import React, { useState } from 'react'
import { Form, Input, Button, Typography, Alert, ConfigProvider, theme } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'

const { Title } = Typography

export default function RegisterPage() {
  const register = useAuthStore((s) => s.register)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const onFinish = async (values: { email: string; username: string; password: string }) => {
    setError(null)
    setLoading(true)
    try {
      await register(values.email, values.username, values.password)
      navigate('/')
    } catch (e: any) {
      setError(e.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorBgBase: '#0b0d10', colorTextBase: '#e5e7eb' } }}>
    <div style={{ minHeight: '100vh', background: '#0b0d10', display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
    <div style={{ maxWidth: 400, width: '100%', margin: '80px 16px 0' }}>
      <Title level={3} style={{ marginBottom: 24 }}>Create Account</Title>
      {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}
      <Form layout="vertical" onFinish={onFinish}>
        <Form.Item label="Email" name="email" rules={[{ required: true, type: 'email' }]}>
          <Input autoComplete="email" />
        </Form.Item>
        <Form.Item label="Username" name="username" rules={[{ required: true, min: 3 }]}>
          <Input autoComplete="username" />
        </Form.Item>
        <Form.Item label="Password" name="password" rules={[{ required: true, min: 8 }]}>
          <Input.Password autoComplete="new-password" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Register
          </Button>
        </Form.Item>
      </Form>
      <div style={{ textAlign: 'center' }}>
        Already have an account? <Link to="/login">Sign in</Link>
      </div>
    </div>
    </div>
    </ConfigProvider>
  )
}
