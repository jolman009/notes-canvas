export function hasRevisionAdvance(currentRevision: number, incomingRevision: number) {
  return incomingRevision > currentRevision
}

export function isSelfUpdate(updatedBy: string | null | undefined, currentUserId: string) {
  return Boolean(updatedBy && updatedBy === currentUserId)
}

export function shouldApplyIncomingState(currentRevision: number, incomingRevision: number) {
  return hasRevisionAdvance(currentRevision, incomingRevision)
}
