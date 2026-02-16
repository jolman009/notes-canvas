import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { isSessionValid, setStoredSession, getStoredSession } from '@/lib/auth-session'
import { signUpWithEmailServer } from '@/server/auth-fns'

export const Route = createFileRoute('/signup')({
  component: SignUpPage,
})

function SignUpPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    if (isSessionValid(getStoredSession())) {
      void navigate({ to: '/' })
    }
  }, [navigate])

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError('')
    setSuccess('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setIsSubmitting(true)
    try {
      const result = await signUpWithEmailServer({
        data: { email, password },
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      if (result.session) {
        setStoredSession(result.session)
        await navigate({ to: '/' })
        return
      }
      setSuccess(result.message || 'Account created. You can now log in.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-700 bg-slate-900 p-6">
        <h1 className="text-2xl font-semibold">Sign up</h1>
        <p className="text-sm text-slate-400 mt-1">
          Create an account with email and password.
        </p>
        <form onSubmit={onSubmit} className="mt-6 flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email"
            className="h-11 rounded-lg bg-slate-950 border border-slate-700 px-3 outline-none focus:border-slate-500"
          />
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            className="h-11 rounded-lg bg-slate-950 border border-slate-700 px-3 outline-none focus:border-slate-500"
          />
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm password"
            className="h-11 rounded-lg bg-slate-950 border border-slate-700 px-3 outline-none focus:border-slate-500"
          />
          {error ? <p className="text-sm text-rose-300">{error}</p> : null}
          {success ? <p className="text-sm text-emerald-300">{success}</p> : null}
          <button
            type="submit"
            disabled={isSubmitting}
            className="h-11 rounded-lg bg-amber-400 text-slate-900 font-semibold disabled:opacity-60"
          >
            {isSubmitting ? 'Creating account...' : 'Sign up'}
          </button>
        </form>
        <p className="text-sm text-slate-400 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-amber-300 underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  )
}
