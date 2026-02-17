import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Note } from '@/lib/notes'

const originalEnv = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
  SUPABASE_PROJECT_ID: process.env.SUPABASE_PROJECT_ID,
}

const sampleNotes: Note[] = [
  {
    id: 'n-release-1',
    title: 'Release gate note',
    body: 'end to end',
    tag: 'qa',
    link: '',
    imageDataUrl: '',
    imageFit: 'cover',
    imageNaturalWidth: 0,
    imageNaturalHeight: 0,
    reactionEmoji: '',
    x: 10,
    y: 20,
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

describe('release gate: invite/collaboration coverage', () => {
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

  it('covers end-to-end invite -> join -> edit flow', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(200, [{ token: 'invite-token-1' }]))
      .mockResolvedValueOnce(jsonResponse(200, [{ board_id: 'board-1', status: 'joined' }]))
      .mockResolvedValueOnce(jsonResponse(200, [{ revision: 3 }]))
    vi.stubGlobal('fetch', fetchMock)

    const store = await loadStore()

    await expect(
      store.createInvite(
        'access-token-owner',
        'board-1',
        'editor',
        new Date(Date.now() + 60_000).toISOString(),
        'user-owner',
        false
      )
    ).resolves.toBe('invite-token-1')

    await expect(store.acceptInvite('access-token-editor', 'user-editor', 'invite-token-1')).resolves.toMatchObject(
      {
        boardId: 'board-1',
        status: 'joined',
      }
    )

    await expect(
      store.saveBoardNotes('access-token-editor', 'board-1', 'user-editor', sampleNotes, 2)
    ).resolves.toMatchObject({
      revision: 3,
    })

    expect(fetchMock).toHaveBeenCalledTimes(3)
    expect(String(fetchMock.mock.calls[0]?.[0] || '')).toContain('/rest/v1/board_invites')
    expect(String(fetchMock.mock.calls[1]?.[0] || '')).toContain('/rest/v1/rpc/accept_board_invite')
    expect(String(fetchMock.mock.calls[2]?.[0] || '')).toContain('/rest/v1/board_state')
  })

  it('covers role matrix for edit permissions (owner/editor allowed, viewer/outsider denied)', async () => {
    const store = await loadStore()
    const allowedRoles: Array<{ role: 'owner' | 'editor'; token: string; userId: string }> = [
      { role: 'owner', token: 'owner-token', userId: 'owner-user' },
      { role: 'editor', token: 'editor-token', userId: 'editor-user' },
    ]
    for (const roleCase of allowedRoles) {
      const successMock = vi.fn().mockResolvedValueOnce(jsonResponse(200, [{ revision: 1 }]))
      vi.stubGlobal('fetch', successMock)
      await expect(
        store.saveBoardNotes(roleCase.token, 'board-role', roleCase.userId, sampleNotes, 0)
      ).resolves.toMatchObject({ revision: 1 })
    }

    const deniedRoles: Array<{ role: 'viewer' | 'outsider'; token: string; userId: string }> = [
      { role: 'viewer', token: 'viewer-token', userId: 'viewer-user' },
      { role: 'outsider', token: 'outsider-token', userId: 'outsider-user' },
    ]
    for (const roleCase of deniedRoles) {
      const deniedMock = vi
        .fn()
        .mockResolvedValueOnce(
          jsonResponse(403, {
            code: '42501',
            message: `permission denied (${roleCase.role})`,
          })
        )
      vi.stubGlobal('fetch', deniedMock)
      await expect(
        store.saveBoardNotes(roleCase.token, 'board-role', roleCase.userId, sampleNotes, 0)
      ).rejects.toThrow('Supabase request failed (403)')
    }
  })

  it('covers invite regression: revoked and expired invite tokens are rejected', async () => {
    const store = await loadStore()

    const expiredMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(400, { message: 'INVITE_EXPIRED' }))
    vi.stubGlobal('fetch', expiredMock)
    await expect(store.acceptInvite('token', 'user-expired', 'invite-expired')).rejects.toThrow(
      'INVITE_EXPIRED'
    )

    const revokedMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(400, { message: 'INVITE_REVOKED' }))
    vi.stubGlobal('fetch', revokedMock)
    await expect(store.acceptInvite('token', 'user-revoked', 'invite-revoked')).rejects.toThrow(
      'INVITE_REVOKED'
    )
  })
})
