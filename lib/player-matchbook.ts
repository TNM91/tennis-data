export type MatchbookFilter = 'all' | 'singles' | 'doubles'

export type MatchbookEntry = {
  matchType: string | null
}

export function filterMatchbookEntries<T extends MatchbookEntry>(entries: T[], filter: MatchbookFilter) {
  if (filter === 'all') return entries
  return entries.filter((entry) => new RegExp(filter, 'i').test(entry.matchType || ''))
}

export function getMatchbookFilterLabel(filter: MatchbookFilter) {
  if (filter === 'singles') return 'Singles'
  if (filter === 'doubles') return 'Doubles'
  return 'All matches'
}
