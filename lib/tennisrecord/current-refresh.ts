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
  const years = activeChampionshipYears(now).map(String)
  return [...new Set(urls)].filter(value => {
    try {
      const url = new URL(value)
      if (!['www.tennisrecord.com', 'tennisrecord.com'].includes(url.hostname) || !['http:', 'https:'].includes(url.protocol)) return false
      const path = url.pathname.toLowerCase()
      if (path === '/adult/profile.aspx') return Boolean(url.searchParams.get('playername'))
      return path.startsWith('/adult/') && years.includes(url.searchParams.get('year') || '')
    } catch { return false }
  })
}

/** Nationwide freshness follows competition and result pages, not every
 * historical player profile. The latter cannot fit a seven-day source budget. */
export function nationalCurrentSeasonUrl(url: string, pageKind: string | null, now = new Date()) {
  return Boolean(pageKind && ['league', 'team', 'match'].includes(pageKind) && currentSeasonDiscoveryUrls([url], now).length > 0)
}

/** Reserve two of every three current-season claims for Missouri when due. */
export function currentSeasonPreferredScope(index: number) {
  return index % 3 === 2 ? 'national' as const : 'missouri' as const
}

/** Fall leagues can count toward the following championship season. */
export function activeChampionshipYears(now = new Date()) {
  const year = now.getUTCFullYear()
  return now.getUTCMonth() >= 7 ? [year, year + 1] : [year]
}

export function currentRefreshPageKindPlan(limit: number) {
  const cycle = [['history'], ['player'], ['team', 'league'], ['match']]
  return Array.from({ length: limit }, (_, index) => cycle[index % cycle.length])
}

/** Preserve the source profile's stable identity parameters when discovering history. */
export function currentPlayerRefreshUrls(profileUrl: string, now = new Date()) {
  try {
    const profile = new URL(profileUrl)
    if (!currentSeasonDiscoveryUrls([profileUrl], now).length || profile.pathname.toLowerCase() !== '/adult/profile.aspx') return []
    return [profileUrl, ...activeChampionshipYears(now).map(year => {
      const history = new URL(profile)
      history.pathname = '/adult/matchhistory.aspx'
      history.searchParams.set('year', String(year))
      return history.toString()
    })]
  } catch { return [] }
}

/** Alternate successful checkpoint opportunities, not wall-clock slots that
 * a long-running job could repeatedly miss. Ratings runs do not affect fairness. */
export function preferCurrentSeason(state: 'manual' | 'bootstrap' | 'weekly', lastTrigger?: string | null) {
  return state === 'weekly' || (state === 'bootstrap' && lastTrigger !== 'weekly')
}

export function nextCurrentRefreshAt(now = new Date()) {
  return new Date(now.getTime() + 7 * 86_400_000).toISOString()
}

/** A complete scheduled event with no courts before play is not a parser quarantine. */
export function futureScorecardRefreshAt(html: string, page: ParsedTennisRecordPage, now = new Date()) {
  if (page.reviewReason || page.matches.length || page.teams.length !== 2 || page.leagues.length !== 1) return null
  const text = html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
  const date = text.match(/Scheduled\s+Date\s*:\s*(\d{1,2})\/(\d{1,2})\/(20\d{2})/i)
  if (!date) return null
  const iso = `${date[3]}-${date[1].padStart(2, '0')}-${date[2].padStart(2, '0')}`
  const scheduled = new Date(iso + 'T00:00:00Z')
  if (!Number.isFinite(scheduled.getTime()) || scheduled.toISOString().slice(0, 10) !== iso || iso < now.toISOString().slice(0, 10)) return null
  return nextCurrentRefreshAt(now)
}

/** A history inherits geography only from the exact previously captured profile locator. */
export function isKnownMissouriPlayerHistory(historyUrl: string, profile: { sourceUrl: string; state: string | null }) {
  if (profile.state !== 'MO') return false
  try {
    const history = new URL(historyUrl), owner = new URL(profile.sourceUrl)
    if (![history, owner].every(url => ['www.tennisrecord.com', 'tennisrecord.com'].includes(url.hostname) && ['http:', 'https:'].includes(url.protocol))) return false
    if (history.pathname.toLowerCase() !== '/adult/matchhistory.aspx' || owner.pathname.toLowerCase() !== '/adult/profile.aspx' || !history.searchParams.get('playername')) return false
    if (!/^20\d{2}$/.test(history.searchParams.get('year') || '')) return false
    history.searchParams.delete('year')
    owner.searchParams.delete('year')
    history.searchParams.sort()
    owner.searchParams.sort()
    return history.searchParams.toString() === owner.searchParams.toString()
  } catch { return false }
}
