import React, { useEffect } from 'react'
import { Outlet, Link } from 'react-router-dom'
import { ConfigProvider, theme, Layout, Button } from 'antd'
import { HomeOutlined } from '@ant-design/icons'
import { useStore } from './store/useStore'

const { Header, Content } = Layout

export default function App() {
  const fetchInit = useStore((s) => s.fetchInit)
  useEffect(() => {
    fetchInit()
  }, [fetchInit])

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
          <Link to="/">
            <Button type="text" icon={<HomeOutlined />} style={{ color: '#9ca3af' }}>
              Home
            </Button>
          </Link>
        </Header>
        <Content style={{ padding: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </ConfigProvider>
  )
}
