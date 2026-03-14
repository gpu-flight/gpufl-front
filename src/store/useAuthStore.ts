import { create } from 'zustand'

interface AuthState {
  token: string | null
  username: string | null
  role: string | null
  login: (emailOrUsername: string, password: string) => Promise<void>
  logout: () => void
  register: (email: string, username: string, password: string) => Promise<void>
}

const BASE_URL = 'http://localhost:8080'

export const useAuthStore = create<AuthState>((set) => ({
  token: localStorage.getItem('auth_token'),
  username: localStorage.getItem('auth_username'),
  role: localStorage.getItem('auth_role'),

  login: async (emailOrUsername, password) => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrUsername, password }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(err || 'Login failed')
    }
    const data = await res.json()
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('auth_username', data.username)
    localStorage.setItem('auth_role', data.role)
    set({ token: data.token, username: data.username, role: data.role })
  },

  logout: () => {
    localStorage.removeItem('auth_token')
    localStorage.removeItem('auth_username')
    localStorage.removeItem('auth_role')
    set({ token: null, username: null, role: null })
  },

  register: async (email, username, password) => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, username, password }),
    })
    if (!res.ok) {
      const err = await res.text()
      throw new Error(err || 'Registration failed')
    }
    const data = await res.json()
    localStorage.setItem('auth_token', data.token)
    localStorage.setItem('auth_username', data.username)
    localStorage.setItem('auth_role', data.role)
    set({ token: data.token, username: data.username, role: data.role })
  },
}))
