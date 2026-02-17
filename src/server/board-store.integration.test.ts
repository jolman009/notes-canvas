import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Note } from '@/lib/notes'

const originalEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_PROJECT_ID: process.env.SUPABASE_PROJECT_ID,
}

const sampleNotes: Note[] = [
  {
    id: 'n1',
    title: 'Integration',
    body: 'test',
    tag: 'phase3',
    link: '',
    imageDataUrl: '',
    imageFit: 'cover',
    imageNaturalWidth: 0,
    imageNaturalHeight: 0,
    x: 10,
    y: 10,
    width: 260,
    height: 220,
    color: '#fef3c7',
  },
]

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  })
}

async function loadStore() {
  vi.resetModules()
  return await import('./board-store')
}

describe('board-store integration flows', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co'
    process.env.SUPABASE_ANON_KEY = 'anon-test-key'
    process.env.SUPABASE_PROJECT_ID = ''
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env.SUPABASE_URL = originalEnv.SUPABASE_URL
    process.env.SUPABASE_ANON_KEY = originalEnv.SUPABASE_ANON_KEY
    process.env.SUPABASE_PROJECT_ID = originalEnv.SUPABASE_PROJECT_ID
  })

  it('rejects stale concurrent saves with REVISION_CONFLICT', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, [{ revision: 1 }]))
      .mockResolvedValueOnce(jsonResponse(200, []))
    vi.stubGlobal('fetch', fetchMock)

    const store = await loadStore()

    await expect(
      store.saveBoardNotes('access-token', 'board-123', 'user-owner', sampleNotes, 0)
    ).resolves.toMatchObject({ revision: 1 })

    await expect(
      store.saveBoardNotes('access-token', 'board-123', 'user-editor', sampleNotes, 0)
    ).rejects.toThrow('REVISION_CONFLICT')

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('denies non-member writes with Supabase 403', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(403, {
          code: '42501',
          message: 'new row violates row-level security policy for table "board_state"',
        })
      )
    vi.stubGlobal('fetch', fetchMock)

    const store = await loadStore()

    await expect(
      store.saveBoardNotes('access-token', 'board-123', 'outsider-user', sampleNotes, 2)
    ).rejects.toThrow('Supabase request failed (403)')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('denies non-member reads with Supabase 403', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(403, {
          code: '42501',
          message: 'permission denied for table board_state',
        })
      )
    vi.stubGlobal('fetch', fetchMock)

    const store = await loadStore()

    await expect(store.getBoardSnapshot('access-token', 'board-123')).rejects.toThrow(
      'Supabase request failed (403)'
    )

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('transfers ownership through RPC', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(200, [{ board_id: 'board-123', new_owner_user_id: 'user-new-owner' }])
      )
    vi.stubGlobal('fetch', fetchMock)

    const store = await loadStore()

    await expect(
      store.transferBoardOwnership('access-token', 'board-123', 'user-new-owner')
    ).resolves.toMatchObject({
      boardId: 'board-123',
      newOwnerUserId: 'user-new-owner',
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const firstCallPath = String(fetchMock.mock.calls[0]?.[0] || '')
    expect(firstCallPath).toContain('/rest/v1/rpc/transfer_board_ownership')
  })

  it('returns helpful message when transfer RPC is missing', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse(404, {
          message: 'Could not find the function public.transfer_board_ownership',
        })
      )
    vi.stubGlobal('fetch', fetchMock)

    const store = await loadStore()

    await expect(
      store.transferBoardOwnership('access-token', 'board-123', 'user-new-owner')
    ).rejects.toThrow('Ownership transfer backend not installed')
  })
})
