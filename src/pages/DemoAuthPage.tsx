import React, { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ConfigProvider, theme, Spin, Alert, Button, Typography } from 'antd'
import { useAuthStore } from '@/store/useAuthStore'

const { Title, Text } = Typography

export default function DemoAuthPage() {
  const { token } = useParams<{ token: string }>()
  const exchangeDemo = useAuthStore((s) => s.exchangeDemo)
  const navigate = useNavigate()
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) {
      setError('Invalid demo link.')
      return
    }
    exchangeDemo(token)
      .then(() => navigate('/', { replace: true }))
      .catch((e: any) => setError(e.message || 'Invalid or expired demo link.'))
  }, [token])

  return (
    <ConfigProvider theme={{ algorithm: theme.darkAlgorithm, token: { colorBgBase: '#0b0d10', colorTextBase: '#e5e7eb' } }}>
      <div className="auth-page">
        <div className="auth-card">
          <Title level={3} className="auth-title">Demo Access</Title>
          {!error ? (
            <div style={{ textAlign: 'center', padding: '24px 0' }}>
              <Spin size="large" />
              <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
                Signing you in…
              </Text>
            </div>
          ) : (
            <>
              <Alert type="error" message={error} style={{ marginBottom: 16 }} />
              <Button block onClick={() => navigate('/login')}>Go to Login</Button>
            </>
          )}
        </div>
      </div>
    </ConfigProvider>
  )
}
