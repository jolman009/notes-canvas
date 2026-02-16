import { Link } from '@tanstack/react-router'
import { StickyNote } from 'lucide-react'

export default function Header() {
  return (
    <header className="h-16 px-6 flex items-center justify-between bg-slate-900/95 text-slate-100 border-b border-slate-700/80">
      <Link to="/" className="flex items-center gap-2">
        <StickyNote className="w-5 h-5 text-amber-300" />
        <span className="text-lg font-semibold tracking-tight">Canvas Notes</span>
      </Link>
      <span className="text-sm text-slate-400">TanStack Start</span>
    </header>
  )
}
