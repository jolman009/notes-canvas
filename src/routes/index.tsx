import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  NOTE_COLORS,
  DEFAULT_NOTE_HEIGHT,
  DEFAULT_NOTE_WIDTH,
  MIN_NOTE_HEIGHT,
  MIN_NOTE_WIDTH,
  clamp,
  sanitizeNotes,
  seedNotes,
  type Note,
} from '@/lib/notes'
import {
  clearStoredSession,
  getStoredSession,
  isSessionValid,
  type AuthSession,
} from '@/lib/auth-session'

const loadNotesServer = createServerFn({ method: 'POST' })
  .inputValidator((input: { userId: string; accessToken: string }) => ({
    userId: String(input.userId || '').trim(),
    accessToken: String(input.accessToken || ''),
  }))
  .handler(async ({ data }) => {
    try {
      const auth = await import('@/server/supabase-auth')
      const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken)
      if (!verifiedUser || verifiedUser.id !== data.userId) {
        return { ok: false as const, notes: seedNotes }
      }
      const store = await import('@/server/notes-store')
      const notes = await store.loadNotesFromStore(verifiedUser.id)
      return { ok: true as const, notes }
    } catch {
      return { ok: false as const, notes: seedNotes }
    }
  })

const saveNotesServer = createServerFn({ method: 'POST' })
  .inputValidator((input: { notes: Note[]; userId: string; accessToken: string }) => ({
    notes: sanitizeNotes(input.notes),
    userId: String(input.userId || '').trim(),
    accessToken: String(input.accessToken || ''),
  }))
  .handler(async ({ data }) => {
    try {
      const auth = await import('@/server/supabase-auth')
      const verifiedUser = await auth.verifySupabaseAccessToken(data.accessToken)
      if (!verifiedUser || verifiedUser.id !== data.userId) {
        return { ok: false as const, updatedAt: Date.now() }
      }
      const store = await import('@/server/notes-store')
      await store.saveNotesToStore(verifiedUser.id, data.notes)
      return { ok: true as const, updatedAt: Date.now() }
    } catch {
      return { ok: false as const, updatedAt: Date.now() }
    }
  })

export const Route = createFileRoute('/')({
  loader: () => seedNotes,
  component: App,
})

function App() {
  const navigate = useNavigate()
  const initialNotes = Route.useLoaderData()
  const [notes, setNotes] = useState<Note[]>(initialNotes)
  const [session, setSession] = useState<AuthSession | null>(null)
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [query, setQuery] = useState('')
  const [colorFilter, setColorFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [syncState, setSyncState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const boardRef = useRef<HTMLDivElement | null>(null)
  const hasInitializedRef = useRef(false)
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const dragStateRef = useRef<{
    id: string
    offsetX: number
    offsetY: number
  } | null>(null)
  const resizeStateRef = useRef<{
    id: string
    startX: number
    startY: number
    startWidth: number
    startHeight: number
    noteX: number
    noteY: number
  } | null>(null)

  const tags = useMemo(
    () =>
      Array.from(
        new Set(notes.map((note) => note.tag.trim()).filter((tag) => tag.length > 0))
      ).sort((a, b) => a.localeCompare(b)),
    [notes]
  )

  const filteredNotes = useMemo(
    () =>
      notes.filter((note) => {
        const textMatches =
          query.trim().length === 0 ||
          `${note.title}\n${note.body}\n${note.tag}\n${note.link}`
            .toLowerCase()
            .includes(query.toLowerCase())
        const colorMatches = colorFilter === 'all' || note.color === colorFilter
        const tagMatches = tagFilter === 'all' || note.tag.trim() === tagFilter
        return textMatches && colorMatches && tagMatches
      }),
    [notes, query, colorFilter, tagFilter]
  )

  useEffect(() => {
    const nextSession = getStoredSession()
    if (!isSessionValid(nextSession)) {
      clearStoredSession()
      void navigate({ to: '/login' })
      return
    }
    setSession(nextSession)
    setIsCheckingAuth(false)
  }, [navigate])

  useEffect(() => {
    if (typeof window === 'undefined' || !session) {
      return
    }
    hasInitializedRef.current = false
    const cacheKey = getUserNotesCacheKey(session.user.id)
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
      const result = await loadNotesServer({
        data: {
          userId: session.user.id,
          accessToken: session.accessToken,
        },
      })
      if (result.ok) {
        setNotes(result.notes)
      }
      hasInitializedRef.current = true
    })()
  }, [session])

  useEffect(() => {
    if (typeof window === 'undefined' || !session) {
      return
    }
    window.localStorage.setItem(
      getUserNotesCacheKey(session.user.id),
      JSON.stringify(notes)
    )
  }, [notes, session])

  useEffect(() => {
    if (!hasInitializedRef.current || !session) {
      return
    }
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
    }
    setSyncState('saving')
    saveTimerRef.current = setTimeout(() => {
      void (async () => {
        const result = await saveNotesServer({
          data: {
            notes,
            userId: session.user.id,
            accessToken: session.accessToken,
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
  }, [notes, session])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const board = boardRef.current
      if (!board) {
        return
      }

      const dragState = dragStateRef.current
      if (dragState) {
        const note = notes.find((item) => item.id === dragState.id)
        if (!note) {
          return
        }
        const bounds = board.getBoundingClientRect()
        const nextX = clamp(
          event.clientX - bounds.left - dragState.offsetX,
          0,
          Math.max(0, bounds.width - note.width)
        )
        const nextY = clamp(
          event.clientY - bounds.top - dragState.offsetY,
          0,
          Math.max(0, bounds.height - note.height)
        )
        setNotes((current) =>
          current.map((item) =>
            item.id === dragState.id ? { ...item, x: nextX, y: nextY } : item
          )
        )
        return
      }

      const resizeState = resizeStateRef.current
      if (resizeState) {
        const bounds = board.getBoundingClientRect()
        const deltaX = event.clientX - resizeState.startX
        const deltaY = event.clientY - resizeState.startY
        const nextWidth = clamp(
          resizeState.startWidth + deltaX,
          MIN_NOTE_WIDTH,
          Math.max(MIN_NOTE_WIDTH, bounds.width - resizeState.noteX)
        )
        const nextHeight = clamp(
          resizeState.startHeight + deltaY,
          MIN_NOTE_HEIGHT,
          Math.max(MIN_NOTE_HEIGHT, bounds.height - resizeState.noteY)
        )
        setNotes((current) =>
          current.map((item) =>
            item.id === resizeState.id
              ? { ...item, width: nextWidth, height: nextHeight }
              : item
          )
        )
      }
    }

    const onPointerUp = () => {
      dragStateRef.current = null
      resizeStateRef.current = null
      setActiveNoteId(null)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }
  }, [notes])

  const createNote = () => {
    const board = boardRef.current
    const id = `note-${Date.now()}`
    const x = board
      ? clamp(
          board.clientWidth / 2 - DEFAULT_NOTE_WIDTH / 2,
          0,
          board.clientWidth - DEFAULT_NOTE_WIDTH
        )
      : 100
    const y = board
      ? clamp(
          board.clientHeight / 2 - DEFAULT_NOTE_HEIGHT / 2,
          0,
          board.clientHeight - DEFAULT_NOTE_HEIGHT
        )
      : 100

    setNotes((current) => [
      ...current,
      {
        id,
        title: 'New note',
        body: '',
        tag: '',
        link: '',
        imageDataUrl: '',
        imageFit: 'cover',
        imageNaturalWidth: 0,
        imageNaturalHeight: 0,
        x,
        y,
        width: DEFAULT_NOTE_WIDTH,
        height: DEFAULT_NOTE_HEIGHT,
        color: NOTE_COLORS[current.length % NOTE_COLORS.length],
      },
    ])
  }

  const bringToFront = (id: string) => {
    setNotes((current) => {
      const target = current.find((item) => item.id === id)
      if (!target) {
        return current
      }
      return [...current.filter((item) => item.id !== id), target]
    })
  }

  const startDrag = (id: string, event: React.PointerEvent<HTMLDivElement>) => {
    const board = boardRef.current
    if (!board) {
      return
    }
    const source = event.target as HTMLElement
    if (['INPUT', 'TEXTAREA', 'BUTTON', 'SELECT'].includes(source.tagName)) {
      return
    }
    const note = notes.find((item) => item.id === id)
    if (!note) {
      return
    }
    const bounds = board.getBoundingClientRect()
    dragStateRef.current = {
      id,
      offsetX: event.clientX - bounds.left - note.x,
      offsetY: event.clientY - bounds.top - note.y,
    }
    resizeStateRef.current = null
    setActiveNoteId(id)
    bringToFront(id)
  }

  const startResize = (id: string, event: React.PointerEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const note = notes.find((item) => item.id === id)
    if (!note) {
      return
    }
    dragStateRef.current = null
    resizeStateRef.current = {
      id,
      startX: event.clientX,
      startY: event.clientY,
      startWidth: note.width,
      startHeight: note.height,
      noteX: note.x,
      noteY: note.y,
    }
    setActiveNoteId(id)
    bringToFront(id)
  }

  const removeNote = (id: string) => {
    setNotes((current) => current.filter((note) => note.id !== id))
  }

  const updateNote = (
    id: string,
    field: keyof Pick<
      Note,
      | 'title'
      | 'body'
      | 'tag'
      | 'color'
      | 'link'
      | 'imageDataUrl'
      | 'imageFit'
      | 'imageNaturalWidth'
      | 'imageNaturalHeight'
    >,
    value: string | number
  ) => {
    setNotes((current) =>
      current.map((note) => (note.id === id ? { ...note, [field]: value } : note))
    )
  }

  const updateNoteImage = async (id: string, file: File | null) => {
    if (!file) {
      return
    }
    if (!file.type.startsWith('image/')) {
      return
    }
    const image = await readImageFile(file)
    setNotes((current) =>
      current.map((note) =>
        note.id === id
          ? {
              ...note,
              imageDataUrl: image.dataUrl,
              imageNaturalWidth: image.width,
              imageNaturalHeight: image.height,
            }
          : note
      )
    )
  }

  const fitNoteToImage = (id: string) => {
    const board = boardRef.current
    if (!board) {
      return
    }
    const boardWidth = board.clientWidth
    const boardHeight = board.clientHeight

    setNotes((current) =>
      current.map((note) => {
        if (
          note.id !== id ||
          !note.imageDataUrl ||
          note.imageNaturalWidth <= 0 ||
          note.imageNaturalHeight <= 0
        ) {
          return note
        }
        const ratio = note.imageNaturalWidth / note.imageNaturalHeight
        const targetWidth = clamp(
          note.imageNaturalWidth,
          MIN_NOTE_WIDTH,
          Math.min(560, boardWidth)
        )
        const targetHeight = clamp(
          targetWidth / ratio,
          MIN_NOTE_HEIGHT,
          Math.min(520, boardHeight)
        )
        return {
          ...note,
          width: targetWidth,
          height: targetHeight,
          x: clamp(note.x, 0, Math.max(0, boardWidth - targetWidth)),
          y: clamp(note.y, 0, Math.max(0, boardHeight - targetHeight)),
        }
      })
    )
  }

  return (
    isCheckingAuth ? (
      <main className="h-[calc(100vh-4rem)] bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-400">Checking session...</p>
      </main>
    ) : (
    <main className="h-[calc(100vh-4rem)] bg-slate-950 text-slate-100">
      <section className="h-full p-4 md:p-6 flex flex-col gap-4">
        <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">Your Canvas Board</h2>
              <p className="text-sm text-slate-400">
                Showing {filteredNotes.length} of {notes.length} notes
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-medium px-2 py-1 rounded border ${
                  syncState === 'saved'
                    ? 'text-emerald-300 border-emerald-500/50'
                    : syncState === 'error'
                      ? 'text-rose-300 border-rose-500/50'
                      : 'text-amber-300 border-amber-500/50'
                }`}
              >
                {syncState === 'saved'
                  ? 'Synced'
                  : syncState === 'error'
                    ? 'Sync failed'
                    : syncState === 'saving'
                      ? 'Saving...'
                      : 'Ready'}
              </span>
              <button
                type="button"
                onClick={createNote}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-400 text-slate-900 font-semibold hover:bg-amber-300 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Add note
              </button>
              <button
                type="button"
                onClick={() => {
                  setSession(null)
                  hasInitializedRef.current = false
                  clearStoredSession()
                  void navigate({ to: '/login' })
                }}
                className="inline-flex items-center px-4 py-2 rounded-lg border border-slate-600 text-slate-200 text-sm font-medium hover:bg-slate-800 transition-colors"
              >
                Log out
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <label className="relative block">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search title, body, or tag..."
                className="w-full h-10 pl-9 pr-3 rounded-lg bg-slate-950 border border-slate-700 text-sm outline-none focus:border-slate-500"
              />
            </label>
            <select
              value={colorFilter}
              onChange={(event) => setColorFilter(event.target.value)}
              className="h-10 rounded-lg bg-slate-950 border border-slate-700 text-sm px-3 outline-none focus:border-slate-500"
            >
              <option value="all">All colors</option>
              {NOTE_COLORS.map((color) => (
                <option key={color} value={color}>
                  {color}
                </option>
              ))}
            </select>
            <select
              value={tagFilter}
              onChange={(event) => setTagFilter(event.target.value)}
              className="h-10 rounded-lg bg-slate-950 border border-slate-700 text-sm px-3 outline-none focus:border-slate-500"
            >
              <option value="all">All tags</option>
              {tags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div
          ref={boardRef}
          className="relative flex-1 border border-slate-700 rounded-2xl overflow-hidden"
          style={{
            backgroundColor: '#0f172a',
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.12) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        >
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className={`absolute rounded-xl border border-slate-800/30 shadow-xl ${
                activeNoteId === note.id ? 'ring-2 ring-amber-200/70' : ''
              }`}
              style={{
                left: note.x,
                top: note.y,
                width: note.width,
                height: note.height,
                backgroundColor: note.color,
              }}
              onPointerDown={() => bringToFront(note.id)}
            >
              <div
                onPointerDown={(event) => startDrag(note.id, event)}
                className="h-10 px-3 flex items-center justify-between cursor-grab active:cursor-grabbing bg-black/10 rounded-t-xl select-none touch-none"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-800/70">
                  note
                </span>
                <div className="flex items-center gap-1">
                  {NOTE_COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => updateNote(note.id, 'color', color)}
                      className={`w-3.5 h-3.5 rounded-full border ${
                        note.color === color ? 'border-slate-900' : 'border-slate-700/40'
                      }`}
                      style={{ backgroundColor: color }}
                      aria-label="Set note color"
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => removeNote(note.id)}
                    className="ml-1 p-1 rounded text-slate-800/70 hover:bg-black/10 hover:text-slate-950"
                    aria-label="Delete note"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="h-[calc(100%-2.5rem)] px-3 py-2 flex flex-col gap-2">
                <input
                  value={note.title}
                  onChange={(event) =>
                    updateNote(note.id, 'title', event.target.value)
                  }
                  className="bg-transparent border-none p-0 m-0 text-base font-semibold text-slate-900 placeholder:text-slate-700/60 focus:outline-none"
                  placeholder="Title"
                />
                <textarea
                  value={note.body}
                  onChange={(event) =>
                    updateNote(note.id, 'body', event.target.value)
                  }
                  className="w-full flex-1 resize-none bg-transparent border-none text-sm leading-relaxed text-slate-900 placeholder:text-slate-700/60 focus:outline-none"
                  placeholder="Write your note..."
                />
                <input
                  value={note.link}
                  onChange={(event) => updateNote(note.id, 'link', event.target.value)}
                  className="w-full bg-black/5 rounded px-2 py-1 text-xs text-slate-900 placeholder:text-slate-700/70 focus:outline-none"
                  placeholder="https://example.com"
                />
                {note.link.trim().length > 0 ? (
                  <a
                    href={toSafeLink(note.link)}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-xs text-blue-800 underline truncate"
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    Open link
                  </a>
                ) : null}
                {note.imageDataUrl ? (
                  <div className="w-full rounded overflow-hidden border border-black/10 bg-black/5">
                    <img
                      src={note.imageDataUrl}
                      alt="Note attachment"
                      className="w-full"
                      style={{
                        height: Math.max(72, Math.min(168, Math.floor(note.height * 0.38))),
                        objectFit: note.imageFit,
                      }}
                    />
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-2">
                  <input
                    value={note.tag}
                    onChange={(event) => updateNote(note.id, 'tag', event.target.value)}
                    className="w-24 bg-black/5 rounded px-2 py-1 text-xs text-slate-900 placeholder:text-slate-700/70 focus:outline-none"
                    placeholder="tag"
                  />
                  <label className="text-xs px-2 py-1 bg-black/20 text-slate-900 border border-black/20 rounded cursor-pointer font-medium">
                    Image
                    <input
                      type="file"
                      accept="image/jpeg,image/gif,image/png,image/webp"
                      className="hidden"
                      onChange={(event) =>
                        void updateNoteImage(note.id, event.target.files?.[0] ?? null)
                      }
                    />
                  </label>
                  {note.imageDataUrl ? (
                    <button
                      type="button"
                      className="text-xs px-2 py-1 bg-black/20 text-slate-900 border border-black/20 rounded font-medium"
                      onClick={() => {
                        setNotes((current) =>
                          current.map((item) =>
                            item.id === note.id
                              ? {
                                  ...item,
                                  imageDataUrl: '',
                                  imageNaturalWidth: 0,
                                  imageNaturalHeight: 0,
                                }
                              : item
                          )
                        )
                      }}
                    >
                      Remove image
                    </button>
                  ) : null}
                  {note.imageDataUrl ? (
                    <button
                      type="button"
                      className="text-xs px-2 py-1 bg-black/20 text-slate-900 border border-black/20 rounded font-medium"
                      onClick={() =>
                        updateNote(
                          note.id,
                          'imageFit',
                          note.imageFit === 'cover' ? 'contain' : 'cover'
                        )
                      }
                    >
                      {note.imageFit === 'cover' ? 'Contain' : 'Cover'}
                    </button>
                  ) : null}
                  {note.imageDataUrl ? (
                    <button
                      type="button"
                      className="text-xs px-2 py-1 bg-black/20 text-slate-900 border border-black/20 rounded font-medium"
                      onClick={() => fitNoteToImage(note.id)}
                    >
                      Fit note
                    </button>
                  ) : null}
                </div>
              </div>

              <div
                className="absolute right-0 bottom-0 w-4 h-4 cursor-se-resize bg-black/15 rounded-tl-md"
                onPointerDown={(event) => startResize(note.id, event)}
                aria-label="Resize note"
              />
            </div>
          ))}
        </div>
      </section>
    </main>
    )
  )
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

async function readImageFile(file: File) {
  const dataUrl = await readFileAsDataUrl(file)
  const size = await getImageSize(dataUrl)
  return {
    dataUrl,
    width: size.width,
    height: size.height,
  }
}

function getImageSize(dataUrl: string) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve({ width: image.naturalWidth, height: image.naturalHeight })
    image.onerror = () => reject(new Error('Failed to read image dimensions.'))
    image.src = dataUrl
  })
}

function toSafeLink(value: string) {
  const trimmed = value.trim()
  if (!trimmed) {
    return '#'
  }
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  return `https://${trimmed}`
}

function getUserNotesCacheKey(userId: string) {
  return `canvas-notes:${userId}`
}
