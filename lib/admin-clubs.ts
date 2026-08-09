export type AdminClubSummary = {
  id: string
  name: string
  slug: string
  locationLabel: string
  isPublic: boolean
  memberCount: number
  programCount: number
  createdAt: string
  updatedAt: string
}

export function normalizeClubDeleteConfirmation(value: unknown) {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ').toLocaleLowerCase() : ''
}

export function canDeleteClubWithConfirmation(clubName: string, confirmation: unknown) {
  const expected = normalizeClubDeleteConfirmation(clubName)
  return expected.length >= 2 && normalizeClubDeleteConfirmation(confirmation) === expected
}

export function countClubRows(rows: Array<{ club_id?: string | null }> | null | undefined) {
  const counts = new Map<string, number>()
  for (const row of rows ?? []) {
    if (!row.club_id) continue
    counts.set(row.club_id, (counts.get(row.club_id) ?? 0) + 1)
  }
  return counts
}
