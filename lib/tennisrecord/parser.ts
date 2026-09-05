import { createHash } from 'node:crypto'
import { canonicalTennisRecordFingerprint, normalizeTennisIdentity } from './reconcile'
import type { ParsedTennisRecordPage, TennisRecordLeague, TennisRecordMatch, TennisRecordParticipant, TennisRecordPlayer, TennisRecordSide, TennisRecordTeam, TennisRecordTeamMember } from './types'

function clean(value: string) { return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim() }
function stripTags(value: string) { return clean(value.replace(/<br\s*\/?\s*>/gi, ' ')) }
function sourceKey(prefix: string, value: string) { return `${prefix}_${createHash('sha256').update(value).digest('hex')}` }
function htmlDecode(value: string) { return value.replace(/&amp;/gi, '&').replace(/&#39;/g, "'").replace(/&quot;/gi, '"') }

function getText(html: string) { return stripTags(html) }

const NON_TEAM_LABELS = new Set(['match results', 'team name', 'home team', 'visiting team', 'score', 'courts won'])
// USTA NTRP labels are whole or half levels through 7.0. Keep this stricter
// than the generic score/rating parser so an unrelated value such as 7.5 can
// never become factual NTRP provenance or block a staged player profile.
const STATED_NTRP_LEVEL_PATTERN = '(?:[1-6]\\.[05]|7\\.0)'
const STATED_NTRP_LABEL_PATTERN = new RegExp(`(?:^|\\s)(${STATED_NTRP_LEVEL_PATTERN})(?=\\s|$)`)
const STATED_NTRP_DESIGNATION_PATTERN = new RegExp(`(?:^|\\s)${STATED_NTRP_LEVEL_PATTERN}\\s*([CS])(?=\\s|$)`, 'i')

function isTeamName(value: string) {
  const name = value.trim().replace(/\s+/g, ' ')
  const normalized = name.toLowerCase()
  return name.length >= 2 && name.length <= 160 && !NON_TEAM_LABELS.has(normalized) && !/^20\d{2}\s+adult\b/i.test(name)
}

export type TennisRecordRecordPageKind = 'match' | 'player' | 'team' | 'history' | 'league'
const MAX_DISCOVERED_RECORD_URLS_PER_PAGE = 25
const MAX_DISCOVERED_DIRECTORY_URLS_PER_PAGE = 100

function isExplicitSeason(value: string | null) { return /^20\d{2}$/.test(value || '') }

/** Public league-directory routes reviewed for the staged U.S. campaign. */
function isReviewedLeagueDirectoryUrl(url: URL) {
  if (!isExplicitSeason(url.searchParams.get('year'))) return false
  const has = (...names: string[]) => names.every((name) => Boolean(url.searchParams.get(name)?.trim()))
  switch (url.pathname.toLowerCase()) {
    case '/adult/league/leaguetype.aspx': return true
    case '/adult/league/leaguesection.aspx': return has('lt')
    case '/adult/league/leaguedistrict.aspx': return has('lt', 'sectionname')
    case '/adult/league/leaguearea.aspx': return has('lt', 'sectionname', 'districtname')
    case '/adult/league/leaguegender.aspx': return has('lt', 'sectionname', 'districtname', 'areaname')
    case '/adult/league/leaguefind.aspx': return has('lt', 'sectionname', 'districtname', 'areaname', 'gender')
    case '/adult/league.aspx': return has('flightname')
    default: return false
  }
}

/**
 * Only record pages that this collector understands are eligible for follow-up
 * crawling. This deliberately excludes navigation, search, static assets, and
 * any future route we have not explicitly reviewed.
 */
export function tennisRecordRecordPageKind(value: string): TennisRecordRecordPageKind | null {
  let url: URL
  try { url = new URL(value) } catch { return null }
  if (!/^www\.tennisrecord\.com$/i.test(url.hostname)) return null
  const pathname = url.pathname.toLowerCase()
  if (pathname === '/adult/matchresults.aspx' && url.searchParams.has('mid')) return 'match'
  if (pathname === '/adult/profile.aspx' && url.searchParams.has('playername')) return 'player'
  if (pathname === '/adult/teamprofile.aspx' && url.searchParams.has('teamname')) return 'team'
  // A history page is a discovery-only seed. It must name a player and an
  // explicit season; its contents are never treated as a rating source.
  if (pathname === '/adult/matchhistory.aspx' && url.searchParams.has('playername') && isExplicitSeason(url.searchParams.get('year'))) return 'history'
  if (isReviewedLeagueDirectoryUrl(url)) return 'league'
  return null
}

/**
 * Bootstrap breadth is deliberately limited. A seed match may introduce its
 * participants and teams; player/team/history pages may introduce direct match
 * evidence only. This prevents profile/history-link fan-out from becoming a
 * broad crawl while still allowing the source graph to grow through actual
 * results.
 */
export function isAllowedTennisRecordDiscovery(sourceUrl: string, candidateUrl: string) {
  const sourceKind = tennisRecordRecordPageKind(sourceUrl)
  const candidateKind = tennisRecordRecordPageKind(candidateUrl)
  if (!sourceKind || !candidateKind) return false
  if (sourceKind === 'league') {
    const sourceYear = new URL(sourceUrl).searchParams.get('year')
    const candidate = new URL(candidateUrl)
    if (candidateKind === 'league') return candidate.searchParams.get('year') === sourceYear
    return candidateKind === 'team' || candidateKind === 'match'
  }
  if (sourceKind === 'match') return candidateKind === 'player' || candidateKind === 'team'
  return candidateKind === 'match'
}

function readDate(text: string) {
  const match = text.match(/Scheduled\s+Date\s*:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i)
  return match ? `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}` : ''
}
function readTeamNames(html: string) {
  const teamTable = [...html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)]
    .map((match) => match[0])
    .find((table) => /<th[^>]*>\s*Team Name\s*<\/th>/i.test(table)) || ''

  return [...teamTable.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
    .map((row) => row[1].match(/<td[^>]*>([\s\S]*?)<\/td>/i)?.[1] || '')
    .map(getText)
    .filter(isTeamName)
    .slice(0, 2)
}

function readLeagueName(plain: string) {
  const currentOrLegacy = plain.match(/Match\s+Results\s+(.+?)\s+Scheduled\s+Date\s*:/i)?.[1] || ''
  return currentOrLegacy.trim()
}
function parseProfileLinks(html: string, side: TennisRecordSide, startSeat: number) {
  const participants: TennisRecordParticipant[] = []
  // Only the matching delimiter ends an attribute. An apostrophe inside a
  // double-quoted O'Neill/O'Keefe URL is part of the identity, not its end.
  for (const match of html.matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    if (!/profile\.aspx/i.test(match[2])) continue
    const url = new URL(htmlDecode(match[2]), 'https://www.tennisrecord.com').toString()
    const text = getText(match[3])
    const rating = text.match(/\(([1-7]\.\d{1,4})\)\s*$/)?.[1]
    const name = text.replace(/\s*\([1-7]\.\d{1,4}\)\s*$/, '').trim()
    if (!name) continue
    participants.push({
      name,
      sourcePlayerKey: sourceKey('trp', url),
      sourceUrl: url,
      side,
      seat: startSeat + participants.length,
      ...(rating ? { publishedRating: Number(rating) } : {}),
    })
  }
  return participants
}
function parseWinnerSide(html: string, a: TennisRecordParticipant[]) {
  return /winner/i.test(html) && a.length ? 'A' as const : null
}

/**
 * Current public match-result pages put an arrow beside the score rather than
 * inside a participant cell. The arrow points at the winning side: a left
 * arrow after the score identifies the visiting/right (B) side, while a right
 * arrow before it identifies the home/left (A) side. This is stronger evidence
 * than counting set tokens, especially where a match tiebreak is displayed as
 * the conventional `1-0` marker.
 */
function winnerFromResultCells(cells: string[], scoreCellIndex: number) {
  if (scoreCellIndex < 0) return null
  const beforeScore = cells.slice(0, scoreCellIndex).join(' ')
  const afterScore = cells.slice(scoreCellIndex + 1).join(' ')
  if (/arrowhead[_-]?right\.png/i.test(beforeScore)) return 'A' as const
  if (/arrowhead[_-]?left\.png/i.test(afterScore)) return 'B' as const
  return null
}

/**
 * Team membership is intentionally stricter than participant parsing. A
 * player becomes a source roster observation only when a team-profile page
 * contains a table explicitly labelled as a roster. Match-result participants
 * are never inferred to be team members because court side does not prove
 * which team listing they belong to on every historical layout.
 */
function parseExplicitTeamRoster(html: string, sourceUrl: string): TennisRecordTeamMember[] {
  if (tennisRecordRecordPageKind(sourceUrl) !== 'team') return []

  let url: URL
  try { url = new URL(sourceUrl) } catch { return [] }
  const teamName = clean(url.searchParams.get('teamname')?.replace(/\+/g, ' ') || '')
  if (!isTeamName(teamName)) return []

  const members = new Map<string, TennisRecordTeamMember>()
  for (const table of html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)) {
    const tableHtml = table[0]
    const precedingHtml = html.slice(Math.max(0, (table.index || 0) - 500), table.index || 0)
    const scope = `${getText(precedingHtml)} ${getText(tableHtml)}`
    if (!/\b(?:team\s+roster|player\s+roster|roster)\b/i.test(scope)) continue

    const headerText = [...tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((header) => getText(header[1])).join(' ')
    if (!/\b(?:player|name)\b/i.test(headerText)) continue

    for (const participant of parseProfileLinks(tableHtml, 'A', 1)) {
      if (!participant.name || members.has(participant.sourcePlayerKey)) continue
      members.set(participant.sourcePlayerKey, {
        teamName,
        sourcePlayerKey: participant.sourcePlayerKey,
        name: participant.name,
        sourceUrl,
      })
    }
  }

  return [...members.values()]
}
function winnerFromScoreText(scoreText: string) {
  let a = 0; let b = 0
  for (const score of scoreText.matchAll(/\b(\d+)\s*-\s*(\d+)\b/g)) {
    const left = Number(score[1]); const right = Number(score[2])
    if (left > right) a += 1
    else if (right > left) b += 1
  }
  return a > b ? 'A' as const : b > a ? 'B' as const : null
}

export function parseTennisRecordMatchPage(html: string, sourceUrl: string): ParsedTennisRecordPage {
  const plain = getText(html)
  const playedOn = readDate(plain)
  const [homeTeam = '', awayTeam = ''] = readTeamNames(html)
  const leagueName = readLeagueName(plain)
  const flight = leagueName.match(/\b[1-7](?:\.0|\.5)\b/)?.[0] || ''
  const matches: TennisRecordMatch[] = []
  // Older pages use headings; current public pages use a styled inner div in a
  // wrapper. Both are labels immediately followed by the court result table.
  const heading = /<(?:h[1-6]|div)[^>]*>\s*(Singles|Doubles)\s*#?\s*(\d+)\s*<\/(?:h[1-6]|div)>[\s\S]*?<table[^>]*>([\s\S]*?)<\/table>/gi
  for (const block of html.matchAll(heading)) {
    const discipline = block[1].toLowerCase() as 'singles' | 'doubles'
    const courtNumber = Number(block[2])
    const resultRow = [...block[3].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)]
      .map((row) => [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1]))
      .find((cells) => cells.filter((cell) => /profile\.aspx/i.test(cell)).length >= 2) || []
    const profileCells = resultRow.filter((cell) => /profile\.aspx/i.test(cell))
    const left = parseProfileLinks(profileCells[0] || '', 'A', 1)
    const right = parseProfileLinks(profileCells[profileCells.length - 1] || '', 'B', 1)
    const expected = discipline === 'singles' ? 1 : 2
    if (left.length !== expected || right.length !== expected) continue
    const scoreCellIndex = resultRow.findIndex((cell) => /\b\d+\s*-\s*\d+\b/.test(cell))
    const scoreCell = scoreCellIndex >= 0 ? resultRow[scoreCellIndex] : ''
    const scoreText = [...scoreCell.matchAll(/\b(\d+)\s*-\s*(\d+)\b/g)].map((score) => `${score[1]}-${score[2]}`).join(' ')
    const participants = [...left, ...right]
    const winnerSide = winnerFromResultCells(resultRow, scoreCellIndex) || parseWinnerSide(profileCells[0] || '', left) || winnerFromScoreText(scoreText)
    const sourceMatchKey = sourceKey('trm', `${sourceUrl}::${discipline}::${courtNumber}`)
    // Do not turn a page heading or league label into a team. A court result
    // only becomes staging evidence when the event context is complete.
    if (!playedOn || !leagueName || !isTeamName(homeTeam) || !isTeamName(awayTeam)) continue
    matches.push({ sourceMatchKey, sourceUrl, playedOn, leagueName, flight, homeTeam, awayTeam, discipline, courtNumber, scoreText, winnerSide, participants })
  }
  const players = new Map<string, TennisRecordPlayer>()
  for (const match of matches) for (const participant of match.participants) {
    players.set(participant.sourcePlayerKey, {
      sourcePlayerKey: participant.sourcePlayerKey,
      name: participant.name,
      city: '', state: '', ntrpLabel: '', publishedRating: participant.publishedRating, sourceUrl: participant.sourceUrl || match.sourceUrl,
    })
  }
  const teamMembers = parseExplicitTeamRoster(html, sourceUrl)
  for (const member of teamMembers) {
    players.set(member.sourcePlayerKey, {
      sourcePlayerKey: member.sourcePlayerKey,
      name: member.name,
      city: '', state: '', ntrpLabel: '', sourceUrl: member.sourceUrl,
    })
  }
  // A player profile is the only source page eligible to provide its owner's
  // factual USTA designation. Some profiles also render match rows, so do not
  // discard that profile evidence merely because those rows created players.
  // History pages remain discovery-only and never provide rating provenance.
  if (tennisRecordRecordPageKind(sourceUrl) === 'player') {
    const url = new URL(sourceUrl)
    const name = getText(html.match(/<(?:h1|h2)[^>]*>([\s\S]*?)<\/(?:h1|h2)>/i)?.[1] || '') || url.searchParams.get('playername')?.replace(/\+/g, ' ') || ''
    const location = plain.match(/\(([A-Za-z .'-]+),\s*([A-Z]{2})\)/)
    const rating = plain.match(/Estimated\s+Dynamic\s+Rating\s*([1-7]\.\d{1,4})/i)?.[1]
    const statedNtrp = plain.match(new RegExp(`\\b(${STATED_NTRP_LEVEL_PATTERN}\\s*[A-Z]?)\\b(?:\\s+(\\d{1,2}\\/\\d{1,2}\\/20\\d{2}))?`))
    const ntrp = statedNtrp?.[1] || ''
    const ntrpEffectiveDate = statedNtrp?.[2] ? toIsoDate(statedNtrp[2]) : undefined
    const ntrpDesignation = tennisRecordStatedNtrpDesignation(ntrp)
    if (name && name.length < 120) players.set(sourceKey('trp', sourceUrl), { sourcePlayerKey: sourceKey('trp', sourceUrl), name, city: location?.[1] || '', state: location?.[2] || '', ntrpLabel: ntrp, ...(ntrpDesignation === 'unknown' ? {} : { ntrpDesignation }), ...(ntrpEffectiveDate ? { ntrpEffectiveDate } : {}), ...(rating ? { publishedRating: Number(rating) } : {}), sourceUrl })
  }
  const seasonYear = Number(leagueName.match(/\b(20\d{2})\b/)?.[1]) || null
  const leagues: TennisRecordLeague[] = leagueName ? [{ sourceLeagueKey: sourceKey('trl', `${leagueName}::${flight}::${seasonYear || ''}`), name: leagueName, flight, seasonYear, sourceUrl }] : []
  const teams: TennisRecordTeam[] = [homeTeam, awayTeam].filter(isTeamName).map((name) => ({ sourceTeamKey: sourceKey('trt', `${name}::${leagueName}::${flight}::${seasonYear || ''}`), name, leagueName, flight, seasonYear, sourceUrl }))
  const discoveredUrls = [...html.matchAll(/href\s*=\s*(["'])([\s\S]*?)\1/gi)]
    .map((link) => new URL(htmlDecode(link[2]), sourceUrl).toString())
    .filter((url) => isAllowedTennisRecordDiscovery(sourceUrl, url))
  const discoveryLimit = tennisRecordRecordPageKind(sourceUrl) === 'league'
    ? MAX_DISCOVERED_DIRECTORY_URLS_PER_PAGE
    : MAX_DISCOVERED_RECORD_URLS_PER_PAGE
  return { players: [...players.values()], teams, teamMembers, leagues, matches: matches.map((match) => ({ ...match, sourceMatchKey: `${match.sourceMatchKey}:${canonicalTennisRecordFingerprint(match).slice(-16)}` })), discoveredUrls: [...new Set(discoveredUrls)].slice(0, discoveryLimit) }
}

/**
 * Extract only a stated NTRP designation, never TennisRecord's estimated
 * dynamic rating.  A designation such as "4.0 C" is factual source metadata;
 * a value such as "4.0122" is a proprietary estimate and must not enter TiQ.
 */
export function tennisRecordStatedNtrpBaseline(value: unknown): number | null {
  const label = typeof value === 'string' ? value.trim() : ''
  const match = label.match(STATED_NTRP_LABEL_PATTERN)
  return match ? Number(match[1]) : null
}

/**
 * TennisRecord profile labels distinguish an official computer rating (C)
 * from a self rating (S). Both are useful factual USTA context, but only C
 * establishes the high-confidence rating anchor used by TiQ calibration.
 */
export function tennisRecordStatedNtrpDesignation(value: unknown): import('./types').TennisRecordNtrpDesignation {
  const label = typeof value === 'string' ? value.trim() : ''
  const match = label.match(STATED_NTRP_DESIGNATION_PATTERN)
  if (match?.[1]?.toUpperCase() === 'C') return 'computer'
  if (match?.[1]?.toUpperCase() === 'S') return 'self'
  return 'unknown'
}

function toIsoDate(value: string) {
  const match = value.match(/^(\d{1,2})\/(\d{1,2})\/(20\d{2})$/)
  if (!match) return undefined
  return `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}`
}

export function normalizedTennisRecordPlayerName(player: TennisRecordPlayer) { return normalizeTennisIdentity(player.name) }
