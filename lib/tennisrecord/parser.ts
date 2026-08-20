import { createHash } from 'node:crypto'
import { canonicalTennisRecordFingerprint, normalizeTennisIdentity } from './reconcile'
import type { ParsedTennisRecordPage, TennisRecordLeague, TennisRecordMatch, TennisRecordParticipant, TennisRecordPlayer, TennisRecordSide, TennisRecordTeam } from './types'

function clean(value: string) { return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/\s+/g, ' ').trim() }
function stripTags(value: string) { return clean(value.replace(/<br\s*\/?\s*>/gi, ' ')) }
function sourceKey(prefix: string, value: string) { return `${prefix}_${createHash('sha256').update(value).digest('hex')}` }
function htmlDecode(value: string) { return value.replace(/&amp;/gi, '&').replace(/&#39;/g, "'").replace(/&quot;/gi, '"') }

function getText(html: string) { return stripTags(html) }
function readDate(text: string) {
  const match = text.match(/Scheduled\s+Date\s*:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i)
  return match ? `${match[3]}-${match[1].padStart(2, '0')}-${match[2].padStart(2, '0')}` : ''
}
function readTeamNames(html: string) {
  const table = html.match(/<table[^>]*>[\s\S]*?<th[^>]*>\s*Team Name\s*<\/th>[\s\S]*?<\/table>/i)?.[0] || ''
  return [...table.matchAll(/<tr[^>]*>[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => getText(match[1])).filter(Boolean).slice(0, 2)
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

export function parseTennisRecordMatchPage(html: string, sourceUrl: string): ParsedTennisRecordPage {
  const plain = getText(html)
  const playedOn = readDate(plain)
  const [homeTeam = '', awayTeam = ''] = readTeamNames(html)
  const leagueName = getText(html.match(/<h2[^>]*>\s*Match Results\s*<\/h2>\s*<div[^>]*>([\s\S]*?)<\/div>/i)?.[1] || '')
  const flight = leagueName.match(/\b[1-7](?:\.0|\.5)\b/)?.[0] || ''
  const matches: TennisRecordMatch[] = []
  const heading = /<h[1-6][^>]*>\s*(Singles|Doubles)\s*#?\s*(\d+)\s*<\/h[1-6]>\s*<table[^>]*>([\s\S]*?)<\/table>/gi
  for (const block of html.matchAll(heading)) {
    const discipline = block[1].toLowerCase() as 'singles' | 'doubles'
    const courtNumber = Number(block[2])
    const cells = [...block[3].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => cell[1])
    const left = parseProfileLinks(cells[0] || '', 'A', 1)
    const right = parseProfileLinks(cells[cells.length - 1] || '', 'B', 1)
    const expected = discipline === 'singles' ? 1 : 2
    if (left.length !== expected || right.length !== expected) continue
    const scoreText = [...(cells[1] || '').matchAll(/\b(\d+)\s*-\s*(\d+)\b/g)].map((score) => `${score[1]}-${score[2]}`).join(' ')
    const participants = [...left, ...right]
    const winnerSide = parseWinnerSide(cells[0] || '', left)
    const sourceMatchKey = sourceKey('trm', `${sourceUrl}::${discipline}::${courtNumber}`)
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
  if (!players.size) {
    const url = new URL(sourceUrl)
    const name = getText(html.match(/<(?:h1|h2)[^>]*>([\s\S]*?)<\/(?:h1|h2)>/i)?.[1] || '') || url.searchParams.get('playername')?.replace(/\+/g, ' ') || ''
    const location = plain.match(/\(([A-Za-z .'-]+),\s*([A-Z]{2})\)/)
    const rating = plain.match(/Estimated\s+Dynamic\s+Rating\s*([1-7]\.\d{1,4})/i)?.[1]
    const ntrp = plain.match(/\b([1-7](?:\.0|\.5)\s*[A-Z]?)\b/)?.[1] || ''
    if (name && name.length < 120) players.set(sourceKey('trp', sourceUrl), { sourcePlayerKey: sourceKey('trp', sourceUrl), name, city: location?.[1] || '', state: location?.[2] || '', ntrpLabel: ntrp, ...(rating ? { publishedRating: Number(rating) } : {}), sourceUrl })
  }
  const seasonYear = Number(leagueName.match(/\b(20\d{2})\b/)?.[1]) || null
  const leagues: TennisRecordLeague[] = leagueName ? [{ sourceLeagueKey: sourceKey('trl', `${leagueName}::${flight}::${seasonYear || ''}`), name: leagueName, flight, seasonYear, sourceUrl }] : []
  const teams: TennisRecordTeam[] = [homeTeam, awayTeam].filter(Boolean).map((name) => ({ sourceTeamKey: sourceKey('trt', `${name}::${leagueName}::${flight}::${seasonYear || ''}`), name, leagueName, flight, seasonYear, sourceUrl }))
  const discoveredUrls = [...html.matchAll(/href=["']([^"']+)["']/gi)]
    .map((link) => new URL(htmlDecode(link[1]), sourceUrl).toString())
    .filter((url) => /^https:\/\/(?:www\.)?tennisrecord\.com\//i.test(url))
  return { players: [...players.values()], teams, leagues, matches: matches.map((match) => ({ ...match, sourceMatchKey: `${match.sourceMatchKey}:${canonicalTennisRecordFingerprint(match).slice(-16)}` })), discoveredUrls: [...new Set(discoveredUrls)] }
}

export function normalizedTennisRecordPlayerName(player: TennisRecordPlayer) { return normalizeTennisIdentity(player.name) }
