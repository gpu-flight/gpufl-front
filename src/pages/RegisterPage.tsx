import React, { useState } from 'react'
import { Form, Input, Button, Typography, Alert, ConfigProvider, theme } from 'antd'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'

const { Title } = Typography

const registerEnabled = import.meta.env.VITE_DISABLE_REGISTER !== 'true'

export default function RegisterPage() {
  if (!registerEnabled) return <Navigate to="/login" replace />
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
      <div className="auth-page">
        <div className="auth-card">
          <Title level={3} className="auth-title">Create Account</Title>
          {error && <Alert type="error" message={error} className="auth-error" />}
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
          <div className="auth-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </div>
        </div>
      </div>
    </ConfigProvider>
  )
}
