import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import SessionList from './pages/SessionList'
import Dashboard from './pages/Dashboard'
import ErrorBoundary from './components/ErrorBoundary'
import 'antd/dist/reset.css'
import 'vis-timeline/styles/vis-timeline-graph2d.min.css'
import './styles.css'

const router = createBrowserRouter([
  {
    path: '/',
    element: (
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    ),
    errorElement: (
      <ErrorBoundary>
        <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
           <h1>404 - Not Found</h1>
        </div>
      </ErrorBoundary>
    ),
    children: [
      { index: true, element: <SessionList /> },
      { path: 'dashboard/:sessionId', element: <Dashboard /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <RouterProvider router={router} />,
)
