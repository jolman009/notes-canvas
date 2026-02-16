const SUPABASE_PROJECT_ID = process.env.SUPABASE_PROJECT_ID
const SUPABASE_URL =
  process.env.SUPABASE_URL ||
  (SUPABASE_PROJECT_ID ? `https://${SUPABASE_PROJECT_ID}.supabase.co` : '')
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || ''

export async function verifySupabaseAccessToken(accessToken: string) {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !accessToken) {
    return null
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: 'GET',
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  })
  if (!response.ok) {
    return null
  }

  const body = (await response.json()) as {
    id?: string
    email?: string
  }
  if (!body.id || !body.email) {
    return null
  }

  return {
    id: body.id,
    email: body.email,
  }
}
