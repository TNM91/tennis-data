import { createHash } from 'node:crypto'
import { canonicalTennisRecordFingerprint, normalizeTennisIdentity } from './reconcile'
import type { ParsedTennisRecordPage, TennisRecordLeague, TennisRecordMatch, TennisRecordParticipant, TennisRecordPlayer, TennisRecordSide, TennisRecordTeam } from './types'

function clean(value: string) { return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim() }
function stripTags(value: string) { return clean(value.replace(/<br\s*\/?\s*>/gi, ' ')) }
function sourceKey(prefix: string, value: string) { return `${prefix}_${createHash('sha256').update(value).digest('hex')}` }
function htmlDecode(value: string) { return value.replace(/&amp;/gi, '&').replace(/&#39;/g, "'").replace(/&quot;/gi, '"') }

function getText(html: string) { return stripTags(html) }

const NON_TEAM_LABELS = new Set(['match results', 'team name', 'home team', 'visiting team', 'score', 'courts won'])

function isTeamName(value: string) {
  const name = value.trim().replace(/\s+/g, ' ')
  const normalized = name.toLowerCase()
  return name.length >= 2 && name.length <= 160 && !NON_TEAM_LABELS.has(normalized) && !/^20\d{2}\s+adult\b/i.test(name)
}

export type TennisRecordRecordPageKind = 'match' | 'player' | 'team' | 'history'
const MAX_DISCOVERED_RECORD_URLS_PER_PAGE = 25

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
  if (pathname === '/adult/matchhistory.aspx' && url.searchParams.has('playername') && /^20\d{2}$/.test(url.searchParams.get('year') || '')) return 'history'
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
  for (const match of html.matchAll(/<a[^>]+href=["']([^"']*profile\.aspx[^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    const url = new URL(htmlDecode(match[1]), 'https://www.tennisrecord.com').toString()
    const text = getText(match[2])
    const rating = text.match(/\(([1-7]\.\d{1,4})\)\s*$/)?.[1]
    const name = text.replace(/\s*\([1-7]\.\d{1,4}\)\s*$/, '').trim()
    if (!name) continue
    participants.push({
      name,
      sourcePlayerKey: sourceKey('trp', url),
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
    const scoreCell = resultRow.find((cell) => /\b\d+\s*-\s*\d+\b/.test(cell)) || ''
    const scoreText = [...scoreCell.matchAll(/\b(\d+)\s*-\s*(\d+)\b/g)].map((score) => `${score[1]}-${score[2]}`).join(' ')
    const participants = [...left, ...right]
    const winnerSide = parseWinnerSide(profileCells[0] || '', left) || winnerFromScoreText(scoreText)
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
      city: '', state: '', ntrpLabel: '', publishedRating: participant.publishedRating, sourceUrl: match.sourceUrl,
    })
  }
  // Only player profiles are eligible to provide player-level provenance when
  // there are no court rows. A history page is discovery-only, so its display
  // of an external rating can never enter staging, reconciliation, or ratings.
  if (!players.size && tennisRecordRecordPageKind(sourceUrl) === 'player') {
    const url = new URL(sourceUrl)
    const name = getText(html.match(/<(?:h1|h2)[^>]*>([\s\S]*?)<\/(?:h1|h2)>/i)?.[1] || '') || url.searchParams.get('playername')?.replace(/\+/g, ' ') || ''
    const location = plain.match(/\(([A-Za-z .'-]+),\s*([A-Z]{2})\)/)
    const rating = plain.match(/Estimated\s+Dynamic\s+Rating\s*([1-7]\.\d{1,4})/i)?.[1]
    const ntrp = plain.match(/\b([1-7](?:\.0|\.5)\s*[A-Z]?)\b/)?.[1] || ''
    if (name && name.length < 120) players.set(sourceKey('trp', sourceUrl), { sourcePlayerKey: sourceKey('trp', sourceUrl), name, city: location?.[1] || '', state: location?.[2] || '', ntrpLabel: ntrp, ...(rating ? { publishedRating: Number(rating) } : {}), sourceUrl })
  }
  const seasonYear = Number(leagueName.match(/\b(20\d{2})\b/)?.[1]) || null
  const leagues: TennisRecordLeague[] = leagueName ? [{ sourceLeagueKey: sourceKey('trl', `${leagueName}::${flight}::${seasonYear || ''}`), name: leagueName, flight, seasonYear, sourceUrl }] : []
  const teams: TennisRecordTeam[] = [homeTeam, awayTeam].filter(isTeamName).map((name) => ({ sourceTeamKey: sourceKey('trt', `${name}::${leagueName}::${flight}::${seasonYear || ''}`), name, leagueName, flight, seasonYear, sourceUrl }))
  const discoveredUrls = [...html.matchAll(/href=["']([^"']+)["']/gi)]
    .map((link) => new URL(htmlDecode(link[1]), sourceUrl).toString())
    .filter((url) => isAllowedTennisRecordDiscovery(sourceUrl, url))
  return { players: [...players.values()], teams, leagues, matches: matches.map((match) => ({ ...match, sourceMatchKey: `${match.sourceMatchKey}:${canonicalTennisRecordFingerprint(match).slice(-16)}` })), discoveredUrls: [...new Set(discoveredUrls)].slice(0, MAX_DISCOVERED_RECORD_URLS_PER_PAGE) }
}

export function normalizedTennisRecordPlayerName(player: TennisRecordPlayer) { return normalizeTennisIdentity(player.name) }
