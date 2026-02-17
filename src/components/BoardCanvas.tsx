import { Plus, Search, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  NOTE_COLORS,
  NOTE_REACTIONS,
  DEFAULT_NOTE_HEIGHT,
  DEFAULT_NOTE_WIDTH,
  MIN_NOTE_HEIGHT,
  MIN_NOTE_WIDTH,
  clamp,
  type Note,
} from '@/lib/notes'

type BoardCanvasProps = {
  notes: Note[]
  onNotesChange: (notes: Note[]) => void
  syncState: 'idle' | 'saving' | 'saved' | 'error'
  title?: string
  rightActions?: React.ReactNode
}

export default function BoardCanvas({
  notes,
  onNotesChange,
  syncState,
  title = 'Your Canvas Board',
  rightActions,
}: BoardCanvasProps) {
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null)
  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [colorFilter, setColorFilter] = useState('all')
  const [tagFilter, setTagFilter] = useState('all')
  const [inspectorTab, setInspectorTab] = useState<'content' | 'media' | 'link' | 'style'>(
    'content'
  )
  const boardRef = useRef<HTMLDivElement | null>(null)
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
  const selectedNote = useMemo(
    () => notes.find((note) => note.id === selectedNoteId) || null,
    [notes, selectedNoteId]
  )

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
        onNotesChange(
          notes.map((item) =>
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
        onNotesChange(
          notes.map((item) =>
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
  }, [notes, onNotesChange])

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

    onNotesChange([
      ...notes,
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
        reactionEmoji: '',
        x,
        y,
        width: DEFAULT_NOTE_WIDTH,
        height: DEFAULT_NOTE_HEIGHT,
        color: NOTE_COLORS[notes.length % NOTE_COLORS.length],
      },
    ])
    setSelectedNoteId(id)
  }

  const bringToFront = (id: string) => {
    const target = notes.find((item) => item.id === id)
    if (!target) {
      return
    }
    onNotesChange([...notes.filter((item) => item.id !== id), target])
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
    setSelectedNoteId(id)
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
    setSelectedNoteId(id)
    bringToFront(id)
  }

  const removeNote = (id: string) => {
    if (selectedNoteId === id) {
      setSelectedNoteId(null)
    }
    onNotesChange(notes.filter((note) => note.id !== id))
  }

  const removeNoteImage = (id: string) => {
    onNotesChange(
      notes.map((item) =>
        item.id === id
          ? {
              ...item,
              imageDataUrl: '',
              imageNaturalWidth: 0,
              imageNaturalHeight: 0,
            }
          : item
      )
    )
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
      | 'reactionEmoji'
    >,
    value: string | number
  ) => {
    onNotesChange(notes.map((note) => (note.id === id ? { ...note, [field]: value } : note)))
  }

  const updateNoteImage = async (id: string, file: File | null) => {
    if (!file || !file.type.startsWith('image/')) {
      return
    }
    const image = await readImageFile(file)
    onNotesChange(
      notes.map((note) =>
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

    onNotesChange(
      notes.map((note) => {
        if (
          note.id !== id ||
          !note.imageDataUrl ||
          note.imageNaturalWidth <= 0 ||
          note.imageNaturalHeight <= 0
        ) {
          return note
        }
        const ratio = note.imageNaturalWidth / note.imageNaturalHeight
        const targetWidth = clamp(note.imageNaturalWidth, MIN_NOTE_WIDTH, Math.min(560, boardWidth))
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
    <main className="h-[calc(100vh-4rem)] bg-slate-950 text-slate-100">
      <section className="h-full p-4 md:p-6 flex flex-col gap-4">
        <div className="bg-slate-900/80 border border-slate-700 rounded-xl p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="text-xl font-semibold">{title}</h2>
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
              {rightActions}
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

        <div className="grid flex-1 min-h-0 grid-cols-1 gap-4 lg:grid-cols-[19rem_minmax(0,1fr)]">
          <aside className="rounded-2xl border border-slate-700 bg-slate-900/85 p-4 flex flex-col gap-3 overflow-y-auto">
            <div>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-300">
                Inspector
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Select a note to edit details in one place.
              </p>
            </div>
            {!selectedNote ? (
              <div className="rounded-xl border border-slate-700 bg-slate-950/60 p-4 text-sm text-slate-400">
                No note selected.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-950/70 p-1">
                  <button
                    type="button"
                    onClick={() => setInspectorTab('content')}
                    className={`h-8 rounded text-xs ${
                      inspectorTab === 'content'
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    Content
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorTab('media')}
                    className={`h-8 rounded text-xs ${
                      inspectorTab === 'media'
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    Media
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorTab('link')}
                    className={`h-8 rounded text-xs ${
                      inspectorTab === 'link'
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    Link
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectorTab('style')}
                    className={`h-8 rounded text-xs ${
                      inspectorTab === 'style'
                        ? 'bg-slate-800 text-slate-100'
                        : 'text-slate-400 hover:bg-slate-900'
                    }`}
                  >
                    Style
                  </button>
                </div>
                {inspectorTab === 'content' ? (
                  <>
                    <input
                      value={selectedNote.title}
                      onChange={(event) => updateNote(selectedNote.id, 'title', event.target.value)}
                      className="h-10 rounded-lg bg-slate-950 border border-slate-700 px-3 text-sm outline-none focus:border-slate-500"
                      placeholder="Title"
                    />
                    <textarea
                      value={selectedNote.body}
                      onChange={(event) => updateNote(selectedNote.id, 'body', event.target.value)}
                      className="min-h-32 rounded-lg bg-slate-950 border border-slate-700 p-3 text-sm outline-none focus:border-slate-500 resize-y"
                      placeholder="Write your note..."
                    />
                    <input
                      value={selectedNote.tag}
                      onChange={(event) => updateNote(selectedNote.id, 'tag', event.target.value)}
                      className="h-10 rounded-lg bg-slate-950 border border-slate-700 px-3 text-sm outline-none focus:border-slate-500"
                      placeholder="Tag"
                    />
                  </>
                ) : null}
                {inspectorTab === 'media' ? (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      <label className="text-xs px-2 py-1 rounded border border-slate-600 bg-slate-950 cursor-pointer text-slate-200">
                        Upload image
                        <input
                          type="file"
                          accept="image/jpeg,image/gif,image/png,image/webp"
                          className="hidden"
                          onChange={(event) =>
                            void updateNoteImage(selectedNote.id, event.target.files?.[0] ?? null)
                          }
                        />
                      </label>
                      {selectedNote.imageDataUrl ? (
                        <>
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded border border-slate-600 bg-slate-950 text-slate-200"
                            onClick={() =>
                              updateNote(
                                selectedNote.id,
                                'imageFit',
                                selectedNote.imageFit === 'cover' ? 'contain' : 'cover'
                              )
                            }
                          >
                            {selectedNote.imageFit === 'cover' ? 'Contain' : 'Cover'}
                          </button>
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded border border-slate-600 bg-slate-950 text-slate-200"
                            onClick={() => fitNoteToImage(selectedNote.id)}
                          >
                            Fit note
                          </button>
                          <button
                            type="button"
                            className="text-xs px-2 py-1 rounded border border-slate-600 bg-slate-950 text-slate-200"
                            onClick={() => removeNoteImage(selectedNote.id)}
                          >
                            Remove image
                          </button>
                        </>
                      ) : null}
                    </div>
                    {selectedNote.imageDataUrl ? (
                      <div className="rounded-lg overflow-hidden border border-slate-700 bg-slate-950">
                        <img
                          src={selectedNote.imageDataUrl}
                          alt="Selected note attachment"
                          className="w-full h-32 object-cover"
                          style={{ objectFit: selectedNote.imageFit }}
                        />
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No image attached.</p>
                    )}
                  </>
                ) : null}
                {inspectorTab === 'link' ? (
                  <>
                    <input
                      value={selectedNote.link}
                      onChange={(event) => updateNote(selectedNote.id, 'link', event.target.value)}
                      className="h-10 rounded-lg bg-slate-950 border border-slate-700 px-3 text-sm outline-none focus:border-slate-500"
                      placeholder="https://example.com"
                    />
                    {selectedNote.link.trim().length > 0 ? (
                      <a
                        href={toSafeLink(selectedNote.link)}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-xs text-amber-300 underline"
                      >
                        Open link
                      </a>
                    ) : (
                      <p className="text-xs text-slate-500">No link set.</p>
                    )}
                  </>
                ) : null}
                {inspectorTab === 'style' ? (
                  <>
                    <div className="flex items-center gap-2 flex-wrap">
                      {NOTE_COLORS.map((color) => (
                        <button
                          key={`${selectedNote.id}-${color}`}
                          type="button"
                          onClick={() => updateNote(selectedNote.id, 'color', color)}
                          className={`h-6 w-6 rounded-full border ${
                            selectedNote.color === color ? 'border-white' : 'border-slate-700'
                          }`}
                          style={{ backgroundColor: color }}
                          aria-label="Set note color"
                        />
                      ))}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {NOTE_REACTIONS.map((emoji) => (
                        <button
                          key={`${selectedNote.id}-reaction-${emoji}`}
                          type="button"
                          onClick={() =>
                            updateNote(
                              selectedNote.id,
                              'reactionEmoji',
                              selectedNote.reactionEmoji === emoji ? '' : emoji
                            )
                          }
                          className={`h-8 min-w-8 rounded border px-2 text-sm ${
                            selectedNote.reactionEmoji === emoji
                              ? 'border-amber-400 bg-amber-400/10'
                              : 'border-slate-600 bg-slate-950'
                          }`}
                          aria-label={`Set reaction ${emoji}`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => removeNote(selectedNote.id)}
                  className="mt-2 inline-flex items-center justify-center rounded-lg border border-rose-600/70 px-3 py-2 text-sm text-rose-300 hover:bg-rose-950/40"
                >
                  Delete note
                </button>
              </>
            )}
          </aside>
          <div
            ref={boardRef}
            className="relative min-h-[420px] lg:min-h-0 border border-slate-700 rounded-2xl overflow-hidden"
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
                  activeNoteId === note.id || selectedNoteId === note.id
                    ? 'ring-2 ring-amber-200/70'
                    : ''
                }`}
                style={{
                  left: note.x,
                  top: note.y,
                  width: note.width,
                  height: note.height,
                  backgroundColor: note.color,
                }}
                onPointerDown={() => {
                  setSelectedNoteId(note.id)
                  bringToFront(note.id)
                }}
              >
              <div
                onPointerDown={(event) => startDrag(note.id, event)}
                className="h-10 px-3 flex items-center justify-between cursor-grab active:cursor-grabbing bg-black/10 rounded-t-xl select-none touch-none"
              >
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-800/70">
                  note
                </span>
                <div className="flex items-center gap-1">
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
                <h4 className="text-sm font-semibold text-slate-900 truncate">
                  {note.title.trim() || 'Untitled note'}
                </h4>
                <p className="max-h-20 overflow-hidden text-xs leading-relaxed text-slate-900/85">
                  {note.body.trim() || 'No content yet. Use the inspector to edit this note.'}
                </p>
                {note.imageDataUrl ? (
                  <div className="w-full rounded overflow-hidden border border-black/10 bg-black/5 mt-auto">
                    <img
                      src={note.imageDataUrl}
                      alt="Note attachment"
                      className="w-full"
                      style={{
                        height: Math.max(64, Math.min(132, Math.floor(note.height * 0.28))),
                        objectFit: note.imageFit,
                      }}
                    />
                  </div>
                ) : null}
                <div className="flex items-center gap-1 flex-wrap mt-auto">
                  {note.tag.trim() ? (
                    <span className="rounded bg-black/15 px-1.5 py-0.5 text-[11px] text-slate-900/80">
                      #{note.tag.trim()}
                    </span>
                  ) : null}
                  {note.link.trim() ? (
                    <a
                      href={toSafeLink(note.link)}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded bg-black/15 px-1.5 py-0.5 text-[11px] text-blue-900 underline"
                      onPointerDown={(event) => event.stopPropagation()}
                    >
                      link
                    </a>
                  ) : null}
                  {note.reactionEmoji ? (
                    <span className="rounded bg-black/15 px-1.5 py-0.5 text-[11px] text-slate-900/90">
                      {note.reactionEmoji}
                    </span>
                  ) : null}
                </div>
                <div className="flex items-center gap-1">
                  {NOTE_REACTIONS.map((emoji) => (
                    <button
                      key={`${note.id}-reaction-${emoji}`}
                      type="button"
                      onClick={() =>
                        updateNote(
                          note.id,
                          'reactionEmoji',
                          note.reactionEmoji === emoji ? '' : emoji
                        )
                      }
                      className={`rounded border px-1.5 py-0.5 text-xs ${
                        note.reactionEmoji === emoji
                          ? 'border-slate-900/70 bg-black/20 text-slate-900'
                          : 'border-black/20 bg-black/10 text-slate-900/85'
                      }`}
                      aria-label={`Set reaction ${emoji}`}
                    >
                      {emoji}
                    </button>
                  ))}
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
        </div>
      </section>
    </main>
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
