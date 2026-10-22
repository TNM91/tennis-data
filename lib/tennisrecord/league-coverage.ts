import type { SupabaseClient } from '@supabase/supabase-js'
import { tennisRecordRecordPageKind } from './parser'
import type { ParsedTennisRecordPage } from './types'

/** One existing request slot per checkpoint, leaving the other slots fair. */
export function isLeagueWatchSlot(index: number, currentSeason?: boolean) {
  return Boolean(currentSeason && index === 3)
}

export function leagueWatchCaptureFacts(parsed: ParsedTennisRecordPage, sourceUrl: string, now = new Date(), html = '') {
  if (parsed.reviewReason) return null
  const owner = new URL(sourceUrl)
  const year = owner.searchParams.get('year')
  const kind = tennisRecordRecordPageKind(sourceUrl)
  const links = [...new Set(parsed.discoveredUrls)].flatMap(url => {
    try {
      const link = new URL(url), pageKind = tennisRecordRecordPageKind(url)
      return link.origin === 'https://www.tennisrecord.com' && link.searchParams.get('year') === year
        && (pageKind === 'team' || pageKind === 'match') ? [{ url, kind: pageKind }] : []
    } catch { return [] }
  })
  const count = kind === 'team' ? new Set(parsed.teamMembers.filter(m => m.sourceUrl === sourceUrl).map(m => m.sourcePlayerKey)).size || null
    : kind === 'league' ? new Set(links.filter(l => l.kind === 'team').map(l => l.url)).size || null
      : parsed.teamEvent ? parsed.teamEvent.homeCourts + parsed.teamEvent.awayCourts : null
  const date = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').match(/Scheduled\s+Date\s*:\s*(\d{1,2})\/(\d{1,2})\/(20\d{2})/i)
  const playedOn = parsed.matches[0]?.playedOn || (date ? `${date[3]}-${date[1].padStart(2, '0')}-${date[2].padStart(2, '0')}` : null)
  // Missing printed results cannot be inferred from an empty parser output.
  const validDate = playedOn && /^20\d{2}-\d{2}-\d{2}$/.test(playedOn) && Number.isFinite(Date.parse(`${playedOn}T00:00:00Z`))
    && new Date(`${playedOn}T00:00:00Z`).toISOString().slice(0, 10) === playedOn
  const pending = kind === 'match' && !parsed.teamEvent && !parsed.matches.length
    && parsed.teams.length === 2 && parsed.leagues.length === 1
    && parsed.teams[0].sourceTeamKey !== parsed.teams[1].sourceTeamKey
    && parsed.teams.every(t => String(t.seasonYear) === year) && String(parsed.leagues[0].seasonYear) === year
    && Boolean(validDate && playedOn && [Number(year), Number(year) - 1].includes(Number(playedOn.slice(0, 4))) && playedOn < now.toISOString().slice(0, 10))
  return { count, pending, links }
}

export async function recordLeagueWatchCapture(service: SupabaseClient, parsed: ParsedTennisRecordPage, sourceUrl: string, pageId: string, html = '') {
  const facts = leagueWatchCaptureFacts(parsed, sourceUrl, new Date(), html)
  if (!facts) return
  const { error } = await service.rpc('record_tennisrecord_watch_capture', {
    p_source_url: sourceUrl, p_page_id: pageId, p_count: facts.count, p_pending: facts.pending, p_links: facts.links,
  })
  if (error) throw new Error(error.message)
  if (facts.pending) {
    const released = await service.rpc('release_tennisrecord_unposted_scorecard', { p_source_url: sourceUrl, p_page_id: pageId })
    if (released.error) throw new Error(released.error.message)
  }
  return facts
}
