import type { ParsedTennisRecordPage } from './types'

/** Missouri Valley includes several states. Require Missouri district evidence. */
export function isMissouriCompetition(label: string) {
  return /\bmissouri\s+valley\s+missouri\b/i.test(label.replace(/[\/_-]+/g, ' '))
}

export function hasMissouriPageEvidence(page?: ParsedTennisRecordPage) {
  return Boolean(page && (
    (!page.matches.length && !page.teams.length && !page.leagues.length && page.players.some(p => p.state.toUpperCase() === 'MO')) ||
    page.matches.some(m => isMissouriCompetition(m.leagueName)) ||
    page.teams.some(t => isMissouriCompetition(t.leagueName)) ||
    page.leagues.some(l => isMissouriCompetition(l.name))
  ))
}

export function currentSeasonDiscoveryUrls(urls: string[], now = new Date()) {
  const year = String(now.getUTCFullYear())
  return [...new Set(urls)].filter(value => {
    try {
      const url = new URL(value)
      if (!['www.tennisrecord.com', 'tennisrecord.com'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol)) return false
      // Undated profile links remain reference-only; explicit-season discovery
      // pages and scorecards are revisited, including those initially empty.
      return url.searchParams.get('year') === year
    } catch { return false }
  })
}

/** Alternate successful checkpoint opportunities, not wall-clock slots that
 * a long-running job could repeatedly miss. Ratings runs do not affect fairness. */
export function preferCurrentSeason(state: 'manual' | 'bootstrap' | 'weekly', lastTrigger?: string | null) {
  return state === 'weekly' || (state === 'bootstrap' && lastTrigger !== 'weekly')
}

export function nextCurrentRefreshAt(now = new Date()) {
  return new Date(now.getTime() + 7 * 86_400_000).toISOString()
}
