import { createHash } from 'node:crypto'
import { canonicalTennisRecordFingerprint, normalizeTennisIdentity } from './reconcile'
import { tennisRecordSourceEventId } from './source-event-identity'
import type { TennisRecordTeamEvent } from './types'
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

export function parseTennisRecordTeamEvent(html: string, sourceUrl: string): TennisRecordTeamEvent | undefined {
  const sourceEventId = tennisRecordSourceEventId(sourceUrl)
  if (!sourceEventId) return
  const visible = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  const plain = getText(visible)
  // Other scoring systems and tied court totals need an explicit winner rule.
  if (!/Match\s+Criteria\s*:\s*Team\s+Wins\b/i.test(plain)) return
  const playedOn = readDate(plain)
  if (!/^20\d{2}-\d{2}-\d{2}$/.test(playedOn) || Number.isNaN(Date.parse(playedOn))
    || new Date(playedOn).toISOString().slice(0, 10) !== playedOn) return
  const leagueName = readLeagueName(plain)
  const seasonYear = Number(sourceEventId.split(':')[1])
  if (leagueName.match(/\b20\d{2}\b/)?.[0] !== String(seasonYear)) return
  const candidates: TennisRecordTeamEvent[] = []
  for (const table of visible.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table>/gi)) {
    const headers = [...table[1].matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map(cell => getText(cell[1]))
    const nameColumn = headers.indexOf('Team Name'), scoreColumn = headers.indexOf('Courts Won')
    if (nameColumn < 0 || scoreColumn < 0) continue
    const teams = [...table[1].matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap<{ invalid: true } | { name: string; courts: number }>(row => {
      const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(cell => cell[1])
      if (!cells.length) return []
      const name = htmlDecode(getText(cells[nameColumn] || ''))
      const courts = getText(cells[scoreColumn] || '')
      const links = [...(cells[nameColumn] || '').matchAll(/href\s*=\s*(["'])([\s\S]*?)\1/gi)]
      if (!isTeamName(name) || !/^\d{1,2}$/.test(courts) || links.length !== 1) return [{ invalid: true } as const]
      try {
        const target = new URL(htmlDecode(links[0][2]), sourceUrl)
        if (tennisRecordRecordPageKind(target.toString()) !== 'team' || target.searchParams.get('teamname') !== name
          || target.searchParams.get('year') !== String(seasonYear)) return [{ invalid: true } as const]
      } catch { return [{ invalid: true } as const] }
      return [{ name, courts: Number(courts) }]
    })
    if (teams.length !== 2 || teams.some(team => 'invalid' in team)) return
    const [home, away] = teams as { name: string; courts: number }[]
    if (home.name === away.name || home.courts === away.courts || home.courts + away.courts > 20) return
    candidates.push({ sourceEventId, sourceUrl, seasonYear, playedOn, leagueName,
      flight: leagueName.match(/\b[1-7](?:\.0|\.5)\b/)?.[0] || '',
      homeTeam: home.name, awayTeam: away.name, homeCourts: home.courts, awayCourts: away.courts,
      winnerSide: home.courts > away.courts ? 'A' : 'B' })
  }
  const unique = [...new Map(candidates.map(event => [JSON.stringify(event), event])).values()]
  return unique.length === 1 ? unique[0] : undefined
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

/**
 * Current public match-result pages put an arrow beside the score rather than
 * inside a participant cell. The arrow points at the winning side: a left
 * arrow after the score identifies the visiting/right (B) side, while a right
 * arrow before it identifies the home/left (A) side. This is stronger evidence
 * than counting set tokens, especially where a match tiebreak is displayed as
 * the conventional `1-0` marker.
 */
function winnerFromResultCells(cells: string[], scoreCellIndex: number, profileCells: string[]) {
  const indicators = new Set<'A' | 'B'>()
  const beforeScore = cells.slice(0, scoreCellIndex).join(' ')
  const afterScore = cells.slice(scoreCellIndex + 1).join(' ')
  if (scoreCellIndex >= 0 && /arrowhead[_-]?right\.png/i.test(beforeScore)) indicators.add('A')
  if (scoreCellIndex >= 0 && /arrowhead[_-]?left\.png/i.test(afterScore)) indicators.add('B')
  // Legacy layouts label the winner beside either player. Conflicting labels
  // or arrows are not resolved by guessing from winner-first score text.
  const winnerLabel = /<(?:span|b|strong|div)\b[^>]*>\s*Winner\s*<\/(?:span|b|strong|div)>/i
  if (winnerLabel.test(profileCells[0] || '')) indicators.add('A')
  if (winnerLabel.test(profileCells.at(-1) || '')) indicators.add('B')
  return indicators.size === 1 ? [...indicators][0] : null
}

/**
 * Team membership is intentionally stricter than participant parsing. A
 * player becomes a source roster observation only when a team-profile page
 * contains a labelled roster or the verified current team-player table. Match-result participants
 * are never inferred to be team members because court side does not prove
 * which team listing they belong to on every historical layout.
 */
function parseExplicitTeamRoster(html: string, sourceUrl: string): TennisRecordTeamMember[] {
  if (tennisRecordRecordPageKind(sourceUrl) !== 'team') return []

  let url: URL
  try { url = new URL(sourceUrl) } catch { return [] }
  const teamName = clean(url.searchParams.get('teamname') || '')
  if (!isTeamName(teamName)) return []
  const year = url.searchParams.get('year')
  const seasonYear = /^20\d{2}$/.test(year || '') ? Number(year) : undefined

  const members = new Map<string, TennisRecordTeamMember>()
  for (const table of html.matchAll(/<table[^>]*>([\s\S]*?)<\/table>/gi)) {
    const tableHtml = table[0]
    const precedingHtml = html.slice(Math.max(0, (table.index || 0) - 500), table.index || 0)
    const scope = `${getText(precedingHtml)} ${getText(tableHtml)}`
    const headers = [...tableHtml.matchAll(/<th[^>]*>([\s\S]*?)<\/th>/gi)].map((header) => getText(header[1]))
    const headerText = headers.join(' ')
    if (!/\b(?:player|name)\b/i.test(headerText)) continue
    const prefix = html.slice(0, table.index)
    const headingAt = prefix.search(/>\s*Team\s+Profile\s*</i)
    const identityHeader = headingAt >= 0 ? prefix.slice(headingAt) : ''
    const ownerMatches = [...identityHeader.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      .some(cell => htmlDecode(getText(cell[1])) === teamName)
    const leagueLinks = [...identityHeader.matchAll(/<a\b[^>]*href\s*=\s*(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/a>/gi)].flatMap(link => {
      try {
        const target = new URL(htmlDecode(link[2]), sourceUrl)
        const flight = target.searchParams.get('flightname')?.trim()
        const label = htmlDecode(getText(link[3]))
        if (tennisRecordRecordPageKind(target.toString()) !== 'league' || target.pathname.toLowerCase() !== '/adult/league.aspx'
          || !seasonYear || target.searchParams.get('year') !== year || !flight || !label.startsWith(`${year} `) || !label.endsWith(`(${flight})`)) return []
        return [{ seasonYear, leagueName: label.slice(0, -flight.length - 2).trim(), flight, leagueSourceUrl: target.toString() }]
      } catch { return [] }
    })
    const contexts = [...new Map(leagueLinks.map(context => [context.leagueSourceUrl, context])).values()]
    const context = ownerMatches && contexts.length === 1 ? contexts[0] : undefined
    const currentLayout = Boolean(context && headers.includes('Name') && headers.includes('Location') && headers.includes('NTRP')
      && headers.some(header => header === `${year} Record`))
    if (!currentLayout && !/\b(?:team\s+roster|player\s+roster|roster)\b/i.test(scope)) continue

    const nameColumn = Math.max(0, headers.findIndex(header => /^(?:Player\s+)?Name$/i.test(header)))
    const participants = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].flatMap(row => {
      const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)]
      const links = parseProfileLinks(cells[nameColumn]?.[1] || '', 'A', 1)
        .filter(player => player.sourceUrl && tennisRecordRecordPageKind(player.sourceUrl) === 'player')
      return links.length === 1 ? links : []
    })
    for (const participant of participants) {
      if (!participant.name || members.has(participant.sourcePlayerKey)) continue
      members.set(participant.sourcePlayerKey, {
        teamName,
        sourcePlayerKey: participant.sourcePlayerKey,
        name: participant.name,
        sourceUrl,
        profileSourceUrl: participant.sourceUrl,
        ...(seasonYear ? { seasonYear } : {}),
        ...context,
      })
    }
  }

  return [...members.values()]
}

/** A URL is a locator, not evidence that its requested player was found. */
export function tennisRecordProfileEvidence(html: string, sourceUrl: string): { ownerName?: string; reviewReason?: string } {
  if (tennisRecordRecordPageKind(sourceUrl) !== 'player') return {}
  const visible = html.replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style|template)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  const text = (value: string) => getText(htmlDecode(value).replace(/&#x27;|&apos;/gi, "'"))
  if (/\b(?:no players? found|player(?: profile)? (?:was )?not found|profile not found)\b/i.test(text(visible))) {
    return { reviewReason: 'TennisRecord reports No Player Found. Profile evidence retained for review; existing player details were not changed.' }
  }
  const requested = new URL(sourceUrl)
  const expected = normalizeTennisIdentity(requested.searchParams.get('playername') || '')
  const matchesOwner = (name: string) => Boolean(expected && name.length < 120 && normalizeTennisIdentity(name) === expected)
  // Named headings support older/sparse profiles. Generic navigation headings
  // and names occurring only in an opponent's match table do not establish ownership.
  const header = visible.split(/Current Playing Areas|Recent Team|Match Results|(?:Singles|Doubles)\s*#?\s*\d/i)[0]
  for (const heading of header.matchAll(/<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi)) {
    const name = text(heading[1])
    if (matchesOwner(name) && !/^(?:player profile|tennis record|tennisrecord)$/i.test(name)) return { ownerName: name }
  }
  // Current source profiles identify their owner with a self-link in the
  // Player Profile header; a location or rating is optional, not required.
  const profileStart = header.search(/Player\s+Profile/i)
  if (profileStart >= 0) for (const link of header.slice(profileStart).matchAll(/<a\b[^>]*\bhref\s*=\s*(["'])([\s\S]*?)\1[^>]*>([\s\S]*?)<\/a>/gi)) {
    let target: URL
    try { target = new URL(htmlDecode(link[2]), sourceUrl) } catch { continue }
    const name = text(link[3])
    if (target.origin === requested.origin && target.pathname.toLowerCase() === '/adult/profile.aspx'
      && normalizeTennisIdentity(target.searchParams.get('playername') || '') === expected
      && (target.searchParams.get('s') || '') === (requested.searchParams.get('s') || '')
      && matchesOwner(name)) return { ownerName: name }
  }
  return { reviewReason: 'TennisRecord player profile is empty or its owner could not be verified. Source retained for review; existing player details were not changed.' }
}

export function parseTennisRecordMatchPage(html: string, sourceUrl: string): ParsedTennisRecordPage {
  const profile = tennisRecordProfileEvidence(html, sourceUrl)
  if (profile.reviewReason) return { reviewReason: profile.reviewReason, players: [], teams: [], teamMembers: [], leagues: [], matches: [], discoveredUrls: [] }
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
    const numericScore = [...scoreCell.matchAll(/\b(\d+)\s*-\s*(\d+)\b/g)].map((score) => `${score[1]}-${score[2]}`).join(' ')
    // Preserve explicit result status so downstream rating admission cannot
    // mistake a retirement or default with numeric scores for a full match.
    const completionMarker = stripTags(scoreCell).match(/\b(retired|retirement|default(?:ed)?|walkover|w\s*\/\s*o)\b/i)?.[1]
    const status = completionMarker ? (/^retir/i.test(completionMarker) ? 'retired' : /^default/i.test(completionMarker) ? 'default' : 'walkover') : ''
    const scoreText = [numericScore, status].filter(Boolean).join(' ')
    const participants = [...left, ...right]
    const winnerSide = winnerFromResultCells(resultRow, scoreCellIndex, profileCells)
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
      city: '', state: '', ntrpLabel: '', sourceUrl: member.profileSourceUrl || member.sourceUrl,
    })
  }
  // A player profile is the only source page eligible to provide its owner's
  // factual USTA designation. Some profiles also render match rows, so do not
  // discard that profile evidence merely because those rows created players.
  // History pages remain discovery-only and never provide rating provenance.
  if (tennisRecordRecordPageKind(sourceUrl) === 'player') {
    const name = profile.ownerName || ''
    const location = plain.match(/\(([A-Za-z .'-]+),\s*([A-Z]{2})\)/)
    const estimate = plain.match(/Estimated\s+Dynamic\s+Rating\s*([1-7]\.\d{1,4})(?:\s+(\d{1,2}\/\d{1,2}\/20\d{2}))?/i)
    const rating = estimate?.[1]
    const publishedRatingDate = estimate?.[2] ? toIsoDate(estimate[2]) : undefined
    const projectedYearEndLevel = plain.match(/Projected\s+Year\s+End\s+Rating\s+([1-7]\.[05])\b/i)?.[1]
    const statedNtrp = plain.match(new RegExp(`\\b(${STATED_NTRP_LEVEL_PATTERN}\\s*[A-Z]?)\\b(?:\\s+(\\d{1,2}\\/\\d{1,2}\\/20\\d{2}))?`))
    const ntrp = statedNtrp?.[1] || ''
    const ntrpEffectiveDate = statedNtrp?.[2] ? toIsoDate(statedNtrp[2]) : undefined
    const ntrpDesignation = tennisRecordStatedNtrpDesignation(ntrp)
    if (name && name.length < 120) players.set(sourceKey('trp', sourceUrl), { sourcePlayerKey: sourceKey('trp', sourceUrl), name, city: location?.[1] || '', state: location?.[2] || '', ntrpLabel: ntrp, ...(ntrpDesignation === 'unknown' ? {} : { ntrpDesignation }), ...(ntrpEffectiveDate ? { ntrpEffectiveDate } : {}), ...(rating ? { publishedRating: Number(rating) } : {}), ...(publishedRatingDate ? { publishedRatingDate } : {}), ...(projectedYearEndLevel ? { projectedYearEndLevel: Number(projectedYearEndLevel) } : {}), sourceUrl })
  }
  const seasonYear = Number(leagueName.match(/\b(20\d{2})\b/)?.[1]) || null
  const leagues: TennisRecordLeague[] = leagueName ? [{ sourceLeagueKey: sourceKey('trl', `${leagueName}::${flight}::${seasonYear || ''}`), name: leagueName, flight, seasonYear, sourceUrl }] : []
  const teams: TennisRecordTeam[] = [homeTeam, awayTeam].filter(isTeamName).map((name) => ({ sourceTeamKey: sourceKey('trt', `${name}::${leagueName}::${flight}::${seasonYear || ''}`), name, leagueName, flight, seasonYear, sourceUrl }))
  const discoveredUrls = [...html.matchAll(/href\s*=\s*(["'])([\s\S]*?)\1/gi)]
    .map((link) => new URL(htmlDecode(link[2]), sourceUrl).toString())
    .filter((url) => isAllowedTennisRecordDiscovery(sourceUrl, url))
  // Persist the entire supported frontier. Fetch limits belong to the durable
  // queue: truncating here loses the same later teams/scorecards on every visit.
  const teamEvent = parseTennisRecordTeamEvent(html, sourceUrl)
  return { ...(teamEvent ? { teamEvent } : {}), players: [...players.values()], teams, teamMembers, leagues, matches: matches.map((match) => ({ ...match, sourceMatchKey: `${match.sourceMatchKey}:${canonicalTennisRecordFingerprint(match).slice(-16)}` })), discoveredUrls: [...new Set([...discoveredUrls, ...teamMembers.flatMap(member => member.profileSourceUrl ? [member.profileSourceUrl] : [])])] }
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
