import React, { useEffect } from 'react'
import { Outlet, Link, useNavigate } from 'react-router-dom'
import { ConfigProvider, theme, Layout, Button } from 'antd'
import { HomeOutlined, LogoutOutlined, KeyOutlined } from '@ant-design/icons'
import { useStore } from './store/useStore'
import { useAuthStore } from './store/useAuthStore'

const { Header, Content } = Layout

export default function App() {
  const fetchInit = useStore((s) => s.fetchInit)
  const logout = useAuthStore((s) => s.logout)
  const username = useAuthStore((s) => s.username)
  const navigate = useNavigate()
  useEffect(() => {
    fetchInit()
  }, [fetchInit])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <ConfigProvider
      theme={{
        algorithm: theme.darkAlgorithm,
        token: {
          colorBgBase: '#0b0d10',
          colorTextBase: '#e5e7eb',
        },
      }}
    >
      <Layout style={{ minHeight: '100vh' }}>
        <Header style={{ background: '#0b0d10', borderBottom: '1px solid #1f2937', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px' }}>
          <Link to="/" style={{ color: 'inherit', textDecoration: 'none', display: 'flex', alignItems: 'center' }}>
            <div style={{ fontWeight: 700, fontSize: '18px' }}>GPUFL Portal</div>
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link to="/">
              <Button type="text" icon={<HomeOutlined />} style={{ color: '#9ca3af' }}>
                Home
              </Button>
            </Link>
            <Link to="/api-keys">
              <Button type="text" icon={<KeyOutlined />} style={{ color: '#9ca3af' }}>
                API Keys
              </Button>
            </Link>
            {username && (
              <span style={{ color: '#9ca3af', fontSize: 13 }}>{username}</span>
            )}
            <Button type="text" icon={<LogoutOutlined />} style={{ color: '#9ca3af' }} onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </Header>
        <Content style={{ padding: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </ConfigProvider>
  )
}
