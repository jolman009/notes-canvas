import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useEffect, useMemo, useRef, useState } from 'react'
import BoardCanvas from '@/components/BoardCanvas'
import { clearStoredSession, getStoredSession, isSessionValid, type AuthSession } from '@/lib/auth-session'
import { sanitizeNotes, seedNotes, type Note } from '@/lib/notes'

const loadBoardNotesServer = createServerFn({ method: 'POST' })
  .inputValidator((input: { userId: string; accessToken: string; boardId: string }) => ({
    userId: String(input.userId || '').trim(),
    accessToken: String(input.accessToken || ''),
    boardId: String(input.boardId || '').trim(),
  }))
  .handler(async ({ data }) => {
    const auth = await import('@/server/supabase-auth')
    const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken)
    if (!verifiedUser || verifiedUser.id !== data.userId) {
      return { ok: false as const, notes: seedNotes }
    }
    try {
      const store = await import('@/server/board-store')
      const notes = await store.getBoardNotes(data.accessToken, data.boardId)
      return { ok: true as const, notes }
    } catch {
      return { ok: false as const, notes: seedNotes }
    }
  })

const saveBoardNotesServer = createServerFn({ method: 'POST' })
  .inputValidator((input: {
    userId: string
    accessToken: string
    boardId: string
    notes: Note[]
  }) => ({
    userId: String(input.userId || '').trim(),
    accessToken: String(input.accessToken || ''),
    boardId: String(input.boardId || '').trim(),
    notes: sanitizeNotes(input.notes),
  }))
  .handler(async ({ data }) => {
    const auth = await import('@/server/supabase-auth')
    const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken)
    if (!verifiedUser || verifiedUser.id !== data.userId) {
      return { ok: false as const, updatedAt: Date.now(), message: 'Invalid session.' }
    }
    try {
      const store = await import('@/server/board-store')
      await store.saveBoardNotes(data.accessToken, data.boardId, verifiedUser.id, data.notes)
      return { ok: true as const, updatedAt: Date.now(), message: '' }
    } catch {
      return {
        ok: false as const,
        updatedAt: Date.now(),
        message: 'You do not have access to update this board.',
      }
    }
  })

const createInviteServer = createServerFn({ method: 'POST' })
  .inputValidator((input: {
    userId: string
    accessToken: string
    boardId: string
    role: 'editor' | 'viewer'
  }) => ({
    userId: String(input.userId || '').trim(),
    accessToken: String(input.accessToken || ''),
    boardId: String(input.boardId || '').trim(),
    role: input.role === 'viewer' ? 'viewer' : 'editor',
  }))
  .handler(async ({ data }) => {
    const auth = await import('@/server/supabase-auth')
    const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken)
    if (!verifiedUser || verifiedUser.id !== data.userId) {
      return { ok: false as const, inviteToken: '', message: 'Invalid session.' }
    }
    try {
      const store = await import('@/server/board-store')
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      const inviteToken = await store.createInvite(
        data.accessToken,
        data.boardId,
        data.role,
        expiresAt,
        verifiedUser.id
      )
      return { ok: true as const, inviteToken, message: '' }
    } catch (error) {
      return {
        ok: false as const,
        inviteToken: '',
        message: error instanceof Error ? error.message : 'Failed to create invite.',
      }
    }
  })

export const Route = createFileRoute('/board/$boardId')({
  loader: () => seedNotes,
  component: BoardRoute,
})

function BoardRoute() {
  const navigate = useNavigate()
  const { boardId } = Route.useParams()
  const initialNotes = Route.useLoaderData()
  const [session, setSession] = useState<AuthSession | null>(null)
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor')
  const [inviteLink, setInviteLink] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [isCreatingInvite, setIsCreatingInvite] = useState(false)
  const [loadError, setLoadError] = useState('')
  const hasInitializedRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const cacheKey = useMemo(
    () => (session ? `canvas-board:${session.user.id}:${boardId}` : ''),
    [boardId, session]
  )

  useEffect(() => {
    const current = getStoredSession()
    if (!isSessionValid(current)) {
      clearStoredSession()
      void navigate({ to: '/login' })
      return
    }
    setSession(current)
    setIsCheckingAuth(false)
  }, [navigate])

  useEffect(() => {
    if (!session || typeof window === 'undefined') {
      return
    }
    hasInitializedRef.current = false
    const cached = window.localStorage.getItem(cacheKey)
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as unknown
        const sanitized = sanitizeNotes(parsed)
        if (sanitized.length > 0) {
          setNotes(sanitized)
        }
      } catch {
        // Ignore local cache parse errors.
      }
    }
    void (async () => {
      const result = await loadBoardNotesServer({
        data: {
          userId: session.user.id,
          accessToken: session.accessToken,
          boardId,
        },
      })
      if (result.ok) {
        setNotes(result.notes)
      } else {
        setLoadError('You do not have access to this board.')
        await navigate({ to: '/boards' })
      }
      hasInitializedRef.current = true
    })()
  }, [session, boardId, cacheKey])

  useEffect(() => {
    if (!session || typeof window === 'undefined') {
      return
    }
    window.localStorage.setItem(cacheKey, JSON.stringify(notes))
  }, [cacheKey, notes, session])

  useEffect(() => {
    if (!session || !hasInitializedRef.current) {
      return
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    setSyncState('saving')
    saveTimerRef.current = setTimeout(() => {
      void (async () => {
        const result = await saveBoardNotesServer({
          data: {
            userId: session.user.id,
            accessToken: session.accessToken,
            boardId,
            notes,
          },
        })
        setSyncState(result.ok ? 'saved' : 'error')
      })()
    }, 450)
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [session, boardId, notes])

  const createInvite = async () => {
    if (!session) {
      return
    }
    setIsCreatingInvite(true)
    setInviteMessage('Creating invite...')
    setInviteLink('')
    try {
      const result = await createInviteServer({
        data: {
          userId: session.user.id,
          accessToken: session.accessToken,
          boardId,
          role: inviteRole,
        },
      })
      if (!result.ok) {
        const rawMessage = result.message || 'Failed to create invite.'
        if (
          rawMessage.toLowerCase().includes('row-level security') ||
          rawMessage.toLowerCase().includes('permission')
        ) {
          setInviteMessage('Invite creation is owner-only for this board.')
        } else {
          setInviteMessage(rawMessage)
        }
        return
      }
      const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
      const url = `${baseUrl}/invite/${result.inviteToken}`
      setInviteLink(url)
      setInviteMessage('Invite created. Link copied to clipboard.')
      if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(url).catch(() => {
          setInviteMessage('Invite created. Copy the link manually below.')
        })
      }
    } catch (error) {
      const rawMessage = error instanceof Error ? error.message : 'Failed to create invite.'
      if (
        rawMessage.toLowerCase().includes('row-level security') ||
        rawMessage.toLowerCase().includes('permission')
      ) {
        setInviteMessage('Invite creation is owner-only for this board.')
      } else {
        setInviteMessage(rawMessage)
      }
    } finally {
      setIsCreatingInvite(false)
    }
  }

  if (isCheckingAuth) {
    return (
      <main className="h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">Checking session...</p>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-sm text-rose-300">{loadError}</p>
      </main>
    )
  }

  return (
    <div>
      <BoardCanvas
        notes={notes}
        onNotesChange={setNotes}
        syncState={syncState}
        title={`Board ${boardId.slice(0, 8)}`}
        rightActions={
          <>
            <Link
              to="/boards"
              className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Boards
            </Link>
            <select
              value={inviteRole}
              onChange={(event) =>
                setInviteRole(event.target.value === 'viewer' ? 'viewer' : 'editor')
              }
              className="h-10 rounded-lg bg-slate-950 border border-slate-700 text-sm px-2"
            >
              <option value="editor">Invite editor</option>
              <option value="viewer">Invite viewer</option>
            </select>
            <button
              type="button"
              onClick={() => void createInvite()}
              disabled={isCreatingInvite}
              className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              {isCreatingInvite ? 'Creating...' : 'Create invite'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSession(null)
                clearStoredSession()
                void navigate({ to: '/login' })
              }}
              className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              Log out
            </button>
          </>
        }
      />
      {inviteLink ? (
        <div className="px-6 pb-6 text-sm text-slate-300">
          Invite link: <span className="text-amber-300">{inviteLink}</span>
        </div>
      ) : null}
      {inviteMessage ? (
        <div className="fixed right-4 bottom-4 z-50 max-w-md rounded-lg border border-slate-600 bg-slate-900/95 px-4 py-3 text-sm text-slate-100 shadow-2xl">
          {inviteMessage}
        </div>
      ) : null}
    </div>
  )
}
