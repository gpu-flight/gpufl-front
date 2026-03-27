import { create } from 'zustand'

interface AuthState {
  token: string | null
  username: string | null
  role: string | null
  login: (emailOrUsername: string, password: string) => Promise<void>
  logout: () => void
  register: (email: string, username: string, password: string) => Promise<void>
  exchangeDemo: (rawToken: string) => Promise<void>
}

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8080'

async function parseErrorMessage(res: Response, fallback: string): Promise<string> {
  const text = await res.text()
  try {
    const json = JSON.parse(text)
    return json.message || json.error || fallback
  } catch {
    return text || fallback
  }
}

function saveAuth(data: { token: string; username: string; role: string }) {
  localStorage.setItem('auth_token', data.token)
  localStorage.setItem('auth_username', data.username)
  localStorage.setItem('auth_role', data.role)
}

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
      throw new Error(await parseErrorMessage(res, 'Login failed'))
    }
    const data = await res.json()
    saveAuth(data)
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
      throw new Error(await parseErrorMessage(res, 'Registration failed'))
    }
    const data = await res.json()
    saveAuth(data)
    set({ token: data.token, username: data.username, role: data.role })
  },

  exchangeDemo: async (rawToken) => {
    const res = await fetch(`${BASE_URL}/api/v1/auth/demo/${rawToken}`)
    if (!res.ok) {
      throw new Error(await parseErrorMessage(res, 'Invalid or expired demo link'))
    }
    const data = await res.json()
    saveAuth(data)
    set({ token: data.token, username: data.username, role: data.role })
  },
}))
