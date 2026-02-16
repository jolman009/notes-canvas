import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import BoardCanvas from '@/components/BoardCanvas'
import { clearStoredSession, getStoredSession, isSessionValid, type AuthSession } from '@/lib/auth-session'
import { isSelfUpdate, shouldApplyIncomingState } from '@/lib/collab'
import { sanitizeNotes, seedNotes, type Note } from '@/lib/notes'

type BoardAccess = {
  role: 'owner' | 'editor' | 'viewer'
  canEdit: boolean
  isOwner: boolean
}

type BoardInviteSummary = {
  id: string
  token: string
  role: 'editor' | 'viewer'
  expiresAt: string
  createdAt: string
}

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
      return {
        ok: false as const,
        notes: seedNotes,
        revision: 0,
        updatedBy: null as string | null,
        updatedAt: null as string | null,
      }
    }
    try {
      const store = await import('@/server/board-store')
      const snapshot = await store.getBoardSnapshot(data.accessToken, data.boardId)
      return { ok: true as const, ...snapshot }
    } catch {
      return {
        ok: false as const,
        notes: seedNotes,
        revision: 0,
        updatedBy: null as string | null,
        updatedAt: null as string | null,
      }
    }
  })

const saveBoardNotesServer = createServerFn({ method: 'POST' })
  .inputValidator((input: {
    userId: string
    accessToken: string
    boardId: string
    expectedRevision: number
    notes: Note[]
  }) => ({
    userId: String(input.userId || '').trim(),
    accessToken: String(input.accessToken || ''),
    boardId: String(input.boardId || '').trim(),
    expectedRevision:
      typeof input.expectedRevision === 'number' ? Math.max(0, Math.floor(input.expectedRevision)) : 0,
    notes: sanitizeNotes(input.notes),
  }))
  .handler(async ({ data }) => {
    const auth = await import('@/server/supabase-auth')
    const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken)
    if (!verifiedUser || verifiedUser.id !== data.userId) {
      return {
        ok: false as const,
        updatedAt: Date.now(),
        message: 'Invalid session.',
        code: 'auth' as const,
        revision: data.expectedRevision,
      }
    }
    try {
      const store = await import('@/server/board-store')
      const saved = await store.saveBoardNotes(
        data.accessToken,
        data.boardId,
        verifiedUser.id,
        data.notes,
        data.expectedRevision
      )
      return {
        ok: true as const,
        updatedAt: Date.now(),
        message: '',
        code: 'ok' as const,
        revision: saved.revision,
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      if (message.includes('REVISION_CONFLICT')) {
        return {
          ok: false as const,
          updatedAt: Date.now(),
          message: 'This board changed in another session. Reloaded latest version.',
          code: 'conflict' as const,
          revision: data.expectedRevision,
        }
      }
      return {
        ok: false as const,
        updatedAt: Date.now(),
        message: 'You do not have access to update this board.',
        code: 'access' as const,
        revision: data.expectedRevision,
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

const loadBoardAccessServer = createServerFn({ method: 'POST' })
  .inputValidator((input: { userId: string; accessToken: string; boardId: string }) => ({
    userId: String(input.userId || '').trim(),
    accessToken: String(input.accessToken || ''),
    boardId: String(input.boardId || '').trim(),
  }))
  .handler(async ({ data }) => {
    const auth = await import('@/server/supabase-auth')
    const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken)
    if (!verifiedUser || verifiedUser.id !== data.userId) {
      return {
        ok: false as const,
        access: { role: 'viewer', canEdit: false, isOwner: false } as BoardAccess,
      }
    }
    try {
      const store = await import('@/server/board-store')
      const access = await store.getBoardAccess(data.accessToken, data.boardId, verifiedUser.id)
      return { ok: true as const, access }
    } catch {
      return {
        ok: false as const,
        access: { role: 'viewer', canEdit: false, isOwner: false } as BoardAccess,
      }
    }
  })

const listInvitesServer = createServerFn({ method: 'POST' })
  .inputValidator((input: { userId: string; accessToken: string; boardId: string }) => ({
    userId: String(input.userId || '').trim(),
    accessToken: String(input.accessToken || ''),
    boardId: String(input.boardId || '').trim(),
  }))
  .handler(async ({ data }) => {
    const auth = await import('@/server/supabase-auth')
    const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken)
    if (!verifiedUser || verifiedUser.id !== data.userId) {
      return { ok: false as const, invites: [] as BoardInviteSummary[] }
    }
    try {
      const store = await import('@/server/board-store')
      const invites = await store.listInvites(data.accessToken, data.boardId)
      return { ok: true as const, invites }
    } catch {
      return { ok: false as const, invites: [] as BoardInviteSummary[] }
    }
  })

const revokeInviteServer = createServerFn({ method: 'POST' })
  .inputValidator((input: { userId: string; accessToken: string; boardId: string; inviteId: string }) => ({
    userId: String(input.userId || '').trim(),
    accessToken: String(input.accessToken || ''),
    boardId: String(input.boardId || '').trim(),
    inviteId: String(input.inviteId || '').trim(),
  }))
  .handler(async ({ data }) => {
    const auth = await import('@/server/supabase-auth')
    const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken)
    if (!verifiedUser || verifiedUser.id !== data.userId) {
      return { ok: false as const }
    }
    try {
      const store = await import('@/server/board-store')
      await store.revokeInvite(data.accessToken, data.boardId, data.inviteId)
      return { ok: true as const }
    } catch {
      return { ok: false as const }
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
  const [boardAccess, setBoardAccess] = useState<BoardAccess>({
    role: 'viewer',
    canEdit: false,
    isOwner: false,
  })
  const [activeInvites, setActiveInvites] = useState<BoardInviteSummary[]>([])
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor')
  const [inviteLink, setInviteLink] = useState('')
  const [inviteMessage, setInviteMessage] = useState('')
  const [collabMessage, setCollabMessage] = useState('')
  const [saveErrorMessage, setSaveErrorMessage] = useState('')
  const [presenceUsers, setPresenceUsers] = useState<Array<{ id: string; label: string }>>([])
  const [syncFailureCount, setSyncFailureCount] = useState(0)
  const [conflictCount, setConflictCount] = useState(0)
  const [pendingConflictNotes, setPendingConflictNotes] = useState<Note[] | null>(null)
  const [isCreatingInvite, setIsCreatingInvite] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [boardRevision, setBoardRevision] = useState(0)
  const [realtimeStatus, setRealtimeStatus] = useState<
    'unconfigured' | 'connecting' | 'connected' | 'error'
  >('unconfigured')
  const hasInitializedRef = useRef(false)
  const suppressNextSaveRef = useRef(false)
  const revisionRef = useRef(0)
  const lastSyncedNotesRef = useRef<Note[]>(initialNotes)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const realtimeClientRef = useRef<SupabaseClient | null>(null)
  const realtimeChannelRef = useRef<RealtimeChannel | null>(null)
  const pendingSaveNotesRef = useRef<Note[] | null>(null)

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

  const realtimeConfig = useMemo(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID
    const url =
      import.meta.env.VITE_SUPABASE_URL ||
      (projectId ? `https://${projectId}.supabase.co` : '')
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
    return {
      url,
      anonKey,
      enabled: Boolean(url && anonKey),
    }
  }, [])

  const reloadLatestSnapshot = useCallback(
    async (showCollaboratorNotice: boolean) => {
      if (!session) {
        return
      }
      const latest = await loadBoardNotesServer({
        data: {
          userId: session.user.id,
          accessToken: session.accessToken,
          boardId,
        },
      })
      if (!latest.ok || !shouldApplyIncomingState(revisionRef.current, latest.revision)) {
        return
      }
      revisionRef.current = latest.revision
      setBoardRevision(latest.revision)
      lastSyncedNotesRef.current = latest.notes
      if (showCollaboratorNotice && !isSelfUpdate(latest.updatedBy, session.user.id)) {
        setCollabMessage('Board updated by a collaborator. Latest changes were loaded.')
      }
      suppressNextSaveRef.current = true
      setNotes(latest.notes)
      setSyncState('saved')
    },
    [boardId, session]
  )

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
        suppressNextSaveRef.current = true
        setNotes(result.notes)
        setBoardRevision(result.revision)
        revisionRef.current = result.revision
        lastSyncedNotesRef.current = result.notes
        const accessResult = await loadBoardAccessServer({
          data: {
            userId: session.user.id,
            accessToken: session.accessToken,
            boardId,
          },
        })
        if (accessResult.ok) {
          setBoardAccess(accessResult.access)
        }
        if (accessResult.ok && accessResult.access.isOwner) {
          const invitesResult = await listInvitesServer({
            data: {
              userId: session.user.id,
              accessToken: session.accessToken,
              boardId,
            },
          })
          if (invitesResult.ok) {
            setActiveInvites(invitesResult.invites)
          }
        }
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
    if (suppressNextSaveRef.current) {
      suppressNextSaveRef.current = false
      return
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    setSaveErrorMessage('')
    if (!boardAccess.canEdit) {
      suppressNextSaveRef.current = true
      setNotes(lastSyncedNotesRef.current)
      setSaveErrorMessage('You have viewer access. Changes are read-only.')
      setSyncState('error')
      setSyncFailureCount((count) => count + 1)
      return
    }
    setSyncState('saving')
    saveTimerRef.current = setTimeout(() => {
      void (async () => {
        pendingSaveNotesRef.current = notes
        const result = await saveBoardNotesServer({
          data: {
            userId: session.user.id,
            accessToken: session.accessToken,
            boardId,
            expectedRevision: revisionRef.current,
            notes,
          },
        })
        if (result.ok) {
          setSyncState('saved')
          setBoardRevision(result.revision)
          revisionRef.current = result.revision
          lastSyncedNotesRef.current = notes
          return
        }
        if (result.code === 'conflict') {
          setConflictCount((count) => count + 1)
          setPendingConflictNotes(pendingSaveNotesRef.current)
          setCollabMessage(result.message)
          await reloadLatestSnapshot(false)
          return
        }
        setSaveErrorMessage(result.message || 'Save failed. Your local draft was rolled back.')
        setSyncFailureCount((count) => count + 1)
        suppressNextSaveRef.current = true
        setNotes(lastSyncedNotesRef.current)
        setSyncState('error')
      })()
    }, 450)
    return () => {
      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current)
      }
    }
  }, [session, boardId, notes, reloadLatestSnapshot, boardAccess.canEdit])

  useEffect(() => {
    if (!session || !hasInitializedRef.current) {
      return
    }
    const timer = setInterval(() => {
      void reloadLatestSnapshot(true)
    }, realtimeStatus === 'connected' ? 15000 : 2500)
    return () => clearInterval(timer)
  }, [session, reloadLatestSnapshot, realtimeStatus])

  useEffect(() => {
    if (!session) {
      return
    }
    const onOnline = () => {
      void reloadLatestSnapshot(true)
    }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [session, reloadLatestSnapshot])

  useEffect(() => {
    if (!session || !hasInitializedRef.current) {
      return
    }
    if (!realtimeConfig.enabled) {
      setRealtimeStatus('unconfigured')
      return
    }

    let cancelled = false
    setRealtimeStatus('connecting')

    void (async () => {
      try {
        const { createClient } = await import('@supabase/supabase-js')
        if (cancelled) {
          return
        }

        const client = createClient(realtimeConfig.url, realtimeConfig.anonKey, {
          auth: {
            persistSession: false,
            autoRefreshToken: false,
          },
        })
        await client.realtime.setAuth(session.accessToken)

        const channel = client
          .channel(`board-state:${boardId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'board_state',
              filter: `board_id=eq.${boardId}`,
            },
            () => {
              void reloadLatestSnapshot(true)
            }
          )
          .on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState<{
              id: string
              label: string
            }>()
            const users = Object.values(state)
              .flat()
              .map((entry) => ({
                id: entry.id,
                label: entry.label,
              }))
              .filter((entry) => entry.id)
            const deduped = Array.from(new Map(users.map((entry) => [entry.id, entry])).values())
            setPresenceUsers(deduped)
          })
          .subscribe((status) => {
            if (cancelled) {
              return
            }
            if (status === 'SUBSCRIBED') {
              setRealtimeStatus('connected')
              void channel.track({
                id: session.user.id,
                label: session.user.name || session.user.email,
              })
              return
            }
            if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
              setRealtimeStatus('error')
            }
          })

        realtimeClientRef.current = client
        realtimeChannelRef.current = channel
      } catch {
        if (!cancelled) {
          setRealtimeStatus('error')
        }
      }
    })()

    return () => {
      cancelled = true
      const client = realtimeClientRef.current
      const channel = realtimeChannelRef.current
      realtimeChannelRef.current = null
      realtimeClientRef.current = null
      setPresenceUsers([])
      if (client && channel) {
        void client.removeChannel(channel)
      }
      if (client) {
        void client.realtime.disconnect()
      }
    }
  }, [boardId, session, reloadLatestSnapshot, realtimeConfig])

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
      if (boardAccess.isOwner) {
        const invitesResult = await listInvitesServer({
          data: {
            userId: session.user.id,
            accessToken: session.accessToken,
            boardId,
          },
        })
        if (invitesResult.ok) {
          setActiveInvites(invitesResult.invites)
        }
      }
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

  const retryKeepMine = async () => {
    if (!session || !pendingConflictNotes || !boardAccess.canEdit) {
      return
    }
    setCollabMessage('Re-applying your draft...')
    setSyncState('saving')
    const result = await saveBoardNotesServer({
      data: {
        userId: session.user.id,
        accessToken: session.accessToken,
        boardId,
        expectedRevision: revisionRef.current,
        notes: pendingConflictNotes,
      },
    })
    if (result.ok) {
      suppressNextSaveRef.current = true
      setNotes(pendingConflictNotes)
      lastSyncedNotesRef.current = pendingConflictNotes
      setBoardRevision(result.revision)
      revisionRef.current = result.revision
      setPendingConflictNotes(null)
      setCollabMessage('Your draft was restored and saved.')
      setSyncState('saved')
      return
    }
    setSyncFailureCount((count) => count + 1)
    setSaveErrorMessage('Could not re-apply your draft. Latest board remains loaded.')
    setSyncState('error')
  }

  const revokeInvite = async (inviteId: string) => {
    if (!session || !boardAccess.isOwner) {
      return
    }
    const result = await revokeInviteServer({
      data: {
        userId: session.user.id,
        accessToken: session.accessToken,
        boardId,
        inviteId,
      },
    })
    if (!result.ok) {
      setInviteMessage('Could not revoke invite.')
      return
    }
    setActiveInvites((current) => current.filter((invite) => invite.id !== inviteId))
    setInviteMessage('Invite revoked.')
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
            <span className="text-xs text-slate-400">Rev {boardRevision}</span>
            <span className="text-xs text-slate-400">
              Role: <span className="text-slate-200">{boardAccess.role}</span>
            </span>
            <span className="text-xs text-slate-400">
              Online: <span className="text-slate-200">{presenceUsers.length}</span>
            </span>
            <span className="text-xs text-slate-400">
              Conflicts: <span className="text-slate-200">{conflictCount}</span>
            </span>
            <span className="text-xs text-slate-400">
              Sync fails: <span className="text-slate-200">{syncFailureCount}</span>
            </span>
            <span
              className={`text-xs ${
                realtimeStatus === 'connected'
                  ? 'text-emerald-300'
                  : realtimeStatus === 'connecting'
                    ? 'text-amber-300'
                    : realtimeStatus === 'error'
                      ? 'text-rose-300'
                      : 'text-slate-400'
              }`}
            >
              {realtimeStatus === 'connected'
                ? 'Live'
                : realtimeStatus === 'connecting'
                  ? 'Live connecting...'
                  : realtimeStatus === 'error'
                    ? 'Live offline'
                    : 'Live not configured'}
            </span>
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
      {boardAccess.isOwner && activeInvites.length > 0 ? (
        <div className="px-6 pb-6">
          <div className="rounded-lg border border-slate-700 bg-slate-900/70 p-3">
            <p className="text-sm font-medium text-slate-200 mb-2">Active Invites</p>
            <div className="flex flex-col gap-2">
              {activeInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between gap-3 rounded border border-slate-700 px-3 py-2 text-xs text-slate-300"
                >
                  <span className="truncate">
                    {invite.role} | expires {new Date(invite.expiresAt).toLocaleString()}
                  </span>
                  <button
                    type="button"
                    onClick={() => void revokeInvite(invite.id)}
                    className="rounded border border-rose-600/70 px-2 py-1 text-rose-300 hover:bg-rose-950/40"
                  >
                    Revoke
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : null}
      {presenceUsers.length > 0 ? (
        <div className="px-6 pb-6 text-xs text-slate-400">
          Active: {presenceUsers.map((user) => user.label).join(', ')}
        </div>
      ) : null}
      {inviteMessage ? (
        <div className="fixed right-4 bottom-4 z-50 max-w-md rounded-lg border border-slate-600 bg-slate-900/95 px-4 py-3 text-sm text-slate-100 shadow-2xl">
          {inviteMessage}
        </div>
      ) : null}
      {collabMessage ? (
        <div className="fixed left-4 bottom-4 z-50 max-w-md rounded-lg border border-sky-600/60 bg-slate-900/95 px-4 py-3 text-sm text-sky-200 shadow-2xl">
          <p>{collabMessage}</p>
          {pendingConflictNotes && boardAccess.canEdit ? (
            <button
              type="button"
              onClick={() => void retryKeepMine()}
              className="mt-2 rounded border border-sky-500/70 px-3 py-1 text-xs text-sky-200 hover:bg-sky-950/30"
            >
              Keep mine
            </button>
          ) : null}
        </div>
      ) : null}
      {saveErrorMessage ? (
        <div className="fixed left-4 top-20 z-50 max-w-md rounded-lg border border-rose-600/60 bg-slate-900/95 px-4 py-3 text-sm text-rose-200 shadow-2xl">
          {saveErrorMessage}
        </div>
      ) : null}
    </div>
  )
}
