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
      <Layout className="app-layout">
        <Header className="app-header">
          <Link to="/" className="app-logo-link">
            <div className="app-logo-title">GPUFL Portal</div>
          </Link>
          <div className="app-header-actions">
            <Link to="/">
              <Button type="text" icon={<HomeOutlined />} className="app-header-btn">
                Home
              </Button>
            </Link>
            <Link to="/api-keys">
              <Button type="text" icon={<KeyOutlined />} className="app-header-btn">
                API Keys
              </Button>
            </Link>
            {username && (
              <span className="app-header-username">{username}</span>
            )}
            <Button type="text" icon={<LogoutOutlined />} className="app-header-btn" onClick={handleLogout}>
              Logout
            </Button>
          </div>
        </Header>
        <Content className="app-content">
          <Outlet />
        </Content>
      </Layout>
    </ConfigProvider>
  )
}
