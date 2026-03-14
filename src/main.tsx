import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App'
import SessionList from './pages/SessionList'
import Dashboard from './pages/Dashboard'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import ApiKeysPage from './pages/ApiKeysPage'
import ProtectedRoute from './components/ProtectedRoute'
import ErrorBoundary from './components/ErrorBoundary'
import 'antd/dist/reset.css'
import './styles.css'

const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/register',
    element: <RegisterPage />,
  },
  {
    path: '/',
    element: (
      <ErrorBoundary>
        <ProtectedRoute>
          <App />
        </ProtectedRoute>
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
      { path: 'api-keys', element: <ApiKeysPage /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')!).render(
  <RouterProvider router={router} />,
)
