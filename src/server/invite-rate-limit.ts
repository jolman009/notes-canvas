type Bucket = {
  count: number
  resetAt: number
}

const createInviteBuckets = new Map<string, Bucket>()
const acceptInviteBuckets = new Map<string, Bucket>()

function nowMs() {
  return Date.now()
}

function consume(
  buckets: Map<string, Bucket>,
  key: string,
  limit: number,
  windowMs: number
) {
  const currentTime = nowMs()
  const bucket = buckets.get(key)

  if (!bucket || bucket.resetAt <= currentTime) {
    buckets.set(key, {
      count: 1,
      resetAt: currentTime + windowMs,
    })
    return
  }

  if (bucket.count >= limit) {
    const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000))
    throw new Error(`RATE_LIMITED:${retryAfterSeconds}`)
  }

  bucket.count += 1
  buckets.set(key, bucket)
}

export function enforceCreateInviteRateLimit(userId: string, boardId: string) {
  consume(createInviteBuckets, `${userId}:${boardId}`, 12, 60 * 1000)
}

export function enforceAcceptInviteRateLimit(userId: string) {
  consume(acceptInviteBuckets, userId, 20, 60 * 1000)
}

