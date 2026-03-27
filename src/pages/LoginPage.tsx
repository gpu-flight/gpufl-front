import React, { useState } from 'react'
import { Form, Input, Button, Typography, Alert, ConfigProvider, theme } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/useAuthStore'

const { Title } = Typography

const registerEnabled = import.meta.env.VITE_DISABLE_REGISTER !== 'true'

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
      <div className="auth-page">
        <div className="auth-card">
          <Title level={3} className="auth-title">Sign In</Title>
          {error && <Alert type="error" message={error} className="auth-error" />}
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
          {registerEnabled && (
            <div className="auth-footer">
              No account? <Link to="/register">Register</Link>
            </div>
          )}
        </div>
      </div>
    </ConfigProvider>
  )
}
