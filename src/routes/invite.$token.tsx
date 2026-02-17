import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import { clearStoredSession, getStoredSession, isSessionValid, type AuthSession } from '@/lib/auth-session'

const acceptInviteServer = createServerFn({ method: 'POST' })
  .inputValidator((input: { userId: string; accessToken: string; token: string }) => ({
    userId: String(input.userId || '').trim(),
    accessToken: String(input.accessToken || ''),
    token: String(input.token || '').trim(),
  }))
  .handler(async ({ data }) => {
    const auth = await import('@/server/supabase-auth')
    const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken)
    if (!verifiedUser || verifiedUser.id !== data.userId) {
      return {
        ok: false as const,
        boardId: '',
        code: 'unauthorized' as const,
        message: 'Invalid session.',
      }
    }
    try {
      const store = await import('@/server/board-store')
      const result = await store.acceptInvite(data.accessToken, verifiedUser.id, data.token)
      return {
        ok: true as const,
        boardId: result.boardId,
        code: result.status === 'already_member' ? ('already-member' as const) : ('joined' as const),
        message: '',
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to accept invite.'
      if (message.includes('INVITE_EXPIRED')) {
        return {
          ok: false as const,
          boardId: '',
          code: 'expired-token' as const,
          message: 'This invite link has expired.',
        }
      }
      if (message.includes('INVITE_INVALID')) {
        return {
          ok: false as const,
          boardId: '',
          code: 'invalid-token' as const,
          message: 'This invite link is invalid or no longer available.',
        }
      }
      if (message.includes('INVITE_USED')) {
        return {
          ok: false as const,
          boardId: '',
          code: 'used-token' as const,
          message: 'This invite link has already been used.',
        }
      }
      if (message.includes('INVITE_REVOKED')) {
        return {
          ok: false as const,
          boardId: '',
          code: 'revoked-token' as const,
          message: 'This invite link was revoked by the board owner.',
        }
      }
      return {
        ok: false as const,
        boardId: '',
        code: 'error' as const,
        message,
      }
    }
  })

export const Route = createFileRoute('/invite/$token')({
  component: InvitePage,
})

function InvitePage() {
  const { token } = Route.useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState<AuthSession | null>(null)
  const [status, setStatus] = useState<
    | 'loading'
    | 'joined'
    | 'already-member'
    | 'invalid-token'
    | 'expired-token'
    | 'used-token'
    | 'revoked-token'
    | 'error'
  >('loading')
  const [message, setMessage] = useState('Accepting invite...')
  const [joinedBoardId, setJoinedBoardId] = useState('')

  useEffect(() => {
    const current = getStoredSession()
    if (!isSessionValid(current)) {
      clearStoredSession()
      void navigate({ to: '/login' })
      return
    }
    setSession(current)
  }, [navigate])

  useEffect(() => {
    if (!session) {
      return
    }
    setStatus('loading')
    setMessage('Accepting invite...')
    void (async () => {
      const result = await acceptInviteServer({
        data: {
          userId: session.user.id,
          accessToken: session.accessToken,
          token,
        },
      })
      if (!result.ok) {
        if (result.code === 'unauthorized') {
          clearStoredSession()
          await navigate({ to: '/login' })
          return
        }
        setStatus(
          result.code === 'expired-token' ||
            result.code === 'invalid-token' ||
            result.code === 'used-token' ||
            result.code === 'revoked-token' ||
            result.code === 'error'
            ? result.code
            : 'error'
        )
        setMessage(result.message || 'Invite failed.')
        return
      }
      setJoinedBoardId(result.boardId)
      if (result.code === 'already-member') {
        setStatus('already-member')
        setMessage('You are already a member of this board.')
      } else {
        setStatus('joined')
        setMessage('Invite accepted. Redirecting to board...')
      }
      setTimeout(() => {
        void navigate({
          to: '/board/$boardId',
          params: { boardId: result.boardId },
        })
      }, 800)
    })()
  }, [session, token, navigate])

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex items-center justify-center">
      <div className="w-full max-w-lg rounded-xl border border-slate-700 bg-slate-900 p-6 text-center">
        <p className="text-slate-200">{message}</p>
        {status === 'loading' ? <p className="mt-2 text-sm text-slate-400">Please wait...</p> : null}
        {status === 'joined' || status === 'already-member' ? (
          <div className="mt-4">
            <Link
              to="/board/$boardId"
              params={{ boardId: joinedBoardId }}
              className="inline-flex items-center rounded-lg bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-900"
            >
              Open board now
            </Link>
          </div>
        ) : null}
        {status === 'invalid-token' ||
        status === 'expired-token' ||
        status === 'used-token' ||
        status === 'revoked-token' ||
        status === 'error' ? (
          <div className="mt-4 flex items-center justify-center gap-3">
            <Link
              to="/boards"
              className="inline-flex items-center rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              Go to boards
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center rounded-lg border border-slate-600 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800"
            >
              Log in
            </Link>
          </div>
        ) : null}
      </div>
    </main>
  )
}
