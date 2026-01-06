import React, { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { ConfigProvider, theme, Layout } from 'antd'
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
        <Header style={{ background: '#0b0d10', borderBottom: '1px solid #1f2937' }}>
          <div style={{ fontWeight: 700 }}>GPUFL Portal</div>
        </Header>
        <Content style={{ padding: 16 }}>
          <Outlet />
        </Content>
      </Layout>
    </ConfigProvider>
  )
}
