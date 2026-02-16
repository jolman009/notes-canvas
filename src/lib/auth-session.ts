export type AuthSession = {
  accessToken: string
  refreshToken: string
  expiresAt: number
  user: {
    id: string
    email: string
    name?: string
  }
}

const AUTH_STORAGE_KEY = 'canvas-notes-auth-session'

export function getStoredSession(): AuthSession | null {
  if (typeof window === 'undefined') {
    return null
  }
  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw) as Partial<AuthSession>
    if (
      typeof parsed.accessToken !== 'string' ||
      typeof parsed.refreshToken !== 'string' ||
      typeof parsed.expiresAt !== 'number' ||
      !parsed.user ||
      typeof parsed.user.id !== 'string' ||
      typeof parsed.user.email !== 'string' ||
      (parsed.user.name !== undefined && typeof parsed.user.name !== 'string')
    ) {
      return null
    }
    return parsed as AuthSession
  } catch {
    return null
  }
}

export function setStoredSession(session: AuthSession) {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session))
}

export function clearStoredSession() {
  if (typeof window === 'undefined') {
    return
  }
  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}

export function isSessionValid(session: AuthSession | null) {
  if (!session) {
    return false
  }
  return session.expiresAt > Date.now()
}
