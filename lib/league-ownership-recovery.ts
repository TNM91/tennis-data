export function normalizeOwnershipEmail(value: string | null | undefined) {
  return String(value || '').trim().toLowerCase()
}

export function canRecoverLegacyLeagueOwnership(input: {
  requesterEmail: string | null | undefined
  requesterEmailConfirmed: boolean
  previousOwnerEmail: string | null | undefined
  previousOwnerEmailConfirmed: boolean
  requesterIsAdmin: boolean
}) {
  if (input.requesterIsAdmin) return true
  if (!input.requesterEmailConfirmed || !input.previousOwnerEmailConfirmed) return false

  const requesterEmail = normalizeOwnershipEmail(input.requesterEmail)
  const previousOwnerEmail = normalizeOwnershipEmail(input.previousOwnerEmail)
  return Boolean(requesterEmail && requesterEmail === previousOwnerEmail)
}

export function matchesLeagueNameConfirmation(leagueName: string, confirmation: string) {
  return confirmation.trim() === leagueName.trim()
}
