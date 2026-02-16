import type { Note } from '@/lib/notes'
import { sanitizeNotes, seedNotes } from '@/lib/notes'

const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  (SUPABASE_PROJECT_ID ? `https://${SUPABASE_PROJECT_ID}.supabase.co` : '')
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''

type BoardSummary = {
  id: string
  title: string
  role: 'owner' | 'editor' | 'viewer'
  ownerUserId: string
  createdAt: string
  updatedAt: string
}

export type InviteAcceptResult = {
  boardId: string
  status: 'joined' | 'already_member'
}

export async function listBoards(accessToken: string, userId: string) {
  const rows = await restFetch<Array<{ role: string; boards: null | {
    id: string
    title: string
    owner_user_id: string
    created_at: string
    updated_at: string
  } }>>(
    `/rest/v1/board_members?user_id=eq.${encodeURIComponent(
      userId
    )}&select=role,boards!inner(id,title,owner_user_id,created_at,updated_at)&order=created_at.desc`,
    {
      method: 'GET',
      accessToken,
    }
  )

  return rows
    .filter((row) => row.boards !== null)
    .map((row) => ({
      id: row.boards!.id,
      title: row.boards!.title,
      role: normalizeRole(row.role),
      ownerUserId: row.boards!.owner_user_id,
      createdAt: row.boards!.created_at,
      updatedAt: row.boards!.updated_at,
    })) as BoardSummary[]
}

export async function createBoard(accessToken: string, ownerUserId: string, title: string) {
  const rows = await restFetch<Array<{ id: string }>>('/rest/v1/boards?select=id', {
    method: 'POST',
    accessToken,
    body: [
      {
        title: title.trim() || 'Untitled Board',
        owner_user_id: ownerUserId,
      },
    ],
    prefer: 'return=representation',
  })

  const boardId = rows[0]?.id
  if (!boardId) {
    throw new Error('Board creation failed.')
  }
  return boardId
}

export async function getBoardNotes(accessToken: string, boardId: string) {
  const rows = await restFetch<Array<{ notes: unknown }>>(
    `/rest/v1/board_state?board_id=eq.${encodeURIComponent(boardId)}&select=notes&limit=1`,
    {
      method: 'GET',
      accessToken,
    }
  )
  const sanitized = sanitizeNotes(rows[0]?.notes)
  return sanitized.length > 0 ? sanitized : seedNotes
}

export async function saveBoardNotes(
  accessToken: string,
  boardId: string,
  userId: string,
  notes: Note[]
) {
  const cleaned = sanitizeNotes(notes)
  const current = await restFetch<Array<{ revision: number }>>(
    `/rest/v1/board_state?board_id=eq.${encodeURIComponent(boardId)}&select=revision&limit=1`,
    {
      method: 'GET',
      accessToken,
    }
  )
  const revision = (current[0]?.revision || 0) + 1

  await restFetch<Array<{ board_id: string }>>('/rest/v1/board_state?select=board_id', {
    method: 'POST',
    accessToken,
    body: [
      {
        board_id: boardId,
        notes: cleaned,
        revision,
        updated_by: userId,
      },
    ],
    prefer: 'resolution=merge-duplicates,return=representation',
  })
}

export async function createInvite(
  accessToken: string,
  boardId: string,
  role: 'editor' | 'viewer',
  expiresAt: string,
  createdBy: string
) {
  const token = crypto.randomUUID()
  const rows = await restFetch<Array<{ token: string }>>('/rest/v1/board_invites?select=token', {
    method: 'POST',
    accessToken,
    body: [
      {
        token,
        board_id: boardId,
        role,
        expires_at: expiresAt,
        created_by: createdBy,
      },
    ],
    prefer: 'return=representation',
  })
  const inviteToken = rows[0]?.token
  if (!inviteToken) {
    throw new Error('Invite creation failed.')
  }
  return inviteToken
}

export async function acceptInvite(
  accessToken: string,
  userId: string,
  token: string
): Promise<InviteAcceptResult> {
  const rows = await restFetch<
    Array<{ board_id: string; role: 'editor' | 'viewer'; expires_at: string }>
  >(`/rest/v1/board_invites?token=eq.${encodeURIComponent(token)}&select=board_id,role,expires_at&limit=1`, {
    method: 'GET',
    accessToken,
  })

  const invite = rows[0]
  if (!invite) {
    throw new Error('INVITE_INVALID')
  }
  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    throw new Error('INVITE_EXPIRED')
  }

  const existingMembership = await restFetch<Array<{ board_id: string }>>(
    `/rest/v1/board_members?board_id=eq.${encodeURIComponent(
      invite.board_id
    )}&user_id=eq.${encodeURIComponent(userId)}&select=board_id&limit=1`,
    {
      method: 'GET',
      accessToken,
    }
  )
  if (existingMembership[0]?.board_id) {
    return {
      boardId: invite.board_id,
      status: 'already_member',
    }
  }

  await restFetch<Array<{ board_id: string }>>('/rest/v1/board_members?select=board_id', {
    method: 'POST',
    accessToken,
    body: [
      {
        board_id: invite.board_id,
        user_id: userId,
        role: invite.role,
      },
    ],
    prefer: 'return=representation',
  })

  return {
    boardId: invite.board_id,
    status: 'joined',
  }
}

function normalizeRole(value: string): 'owner' | 'editor' | 'viewer' {
  if (value === 'owner' || value === 'editor' || value === 'viewer') {
    return value
  }
  return 'viewer'
}

async function restFetch<T>(
  path: string,
  options: {
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE'
    accessToken: string
    body?: unknown
    prefer?: string
  }
) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Supabase is not configured.')
  }
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method: options.method,
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${options.accessToken}`,
      'Content-Type': 'application/json',
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '')
    throw new Error(
      `Supabase request failed (${response.status}): ${errorBody || response.statusText}`
    )
  }
  return (await response.json().catch(() => [])) as T
}
