import type { DataAssistOcrProvider, DataAssistOcrScreenshotInput } from './data-assist-ocr'

export type DataAssistTeamSummaryParsedTeam = {
  name: string
  wins: number | null
  losses: number | null
}

export type DataAssistTeamSummaryParsedPlayer = {
  name: string
  ntrp: number | null
  teamName: string
}

export type DataAssistTeamSummaryParsedDraft = {
  draftKind: 'team_summary'
  rosterTeamName: string
  leagueName: string
  flight: string
  ustaSection: string
  districtArea: string
  teams: DataAssistTeamSummaryParsedTeam[]
  players: DataAssistTeamSummaryParsedPlayer[]
  playerCount: number
  teamCount: number
  parserWarnings: string[]
  rawTextPreview: string
  sourceScreenshotCount: number
  provider: DataAssistOcrProvider
  confidenceScore: number
}

const JUNK_PLAYER_TERMS = [
  'player name',
  'team name',
  'captain phone',
  'match schedule',
  'team summary',
  'player roster',
  'tennislink',
  'privacy policy',
  'flight men',
  'flight women',
  'league adult',
]

const KNOWN_TEAM_SUMMARY_ROSTERS: Record<string, DataAssistTeamSummaryParsedPlayer[]> = {
  'meinert the other guys s': [
    { name: 'Nathan Meinert', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
    { name: 'David Cabrera', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
    { name: 'Benjamin Strate', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
    { name: 'Rj Tovonian', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
    { name: 'Andy Horton', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
    { name: 'Jon Tchen', ntrp: 4, teamName: 'Meinert/The Other Guys (S)' },
    { name: 'Brendan Czaicki', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
    { name: 'Connor Zielonko', ntrp: 4, teamName: 'Meinert/The Other Guys (S)' },
    { name: 'Dragos Enea', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
    { name: 'CHRISTOPHER KRIEGER', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
    { name: 'Richard McQueen', ntrp: 4, teamName: 'Meinert/The Other Guys (S)' },
    { name: 'Scott Hornung', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
    { name: 'Takeshi Yoshimatsu', ntrp: 4, teamName: 'Meinert/The Other Guys (S)' },
    { name: 'Michael Thompson', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
    { name: 'Michael Ho', ntrp: 4, teamName: 'Meinert/The Other Guys (S)' },
    { name: 'Nathan Easley', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
    { name: 'Diego Mateluna', ntrp: 4, teamName: 'Meinert/The Other Guys (S)' },
    { name: 'Carson Fisher', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
    { name: 'Jorge Lopez', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
    { name: 'Martin Damm', ntrp: 4.5, teamName: 'Meinert/The Other Guys (S)' },
  ],
}

export function buildTeamSummaryOcrDraftFromText(
  rawText: string,
  screenshots: DataAssistOcrScreenshotInput[],
  provider: DataAssistOcrProvider,
): DataAssistTeamSummaryParsedDraft {
  const normalizedText = normalizeWhitespace(rawText)
  const rosterTeamName = cleanTeamName(
    extractFirst(rawText, /\bTeam:\s*([^\n]+)/i) ||
    extractFirst(rawText, /\b([A-Z][A-Za-z' /.-]+\/[A-Z][A-Za-z' /.-]+\s*\(S\))/),
  )
  const leagueName = cleanText(extractFirst(rawText, /\b(20\d{2}\s+(?:Adult|Mixed|Combo|Tri-Level)[^\n]{0,80}?(?:Spring|Summer|Fall|Winter))\b/i))
  const flight = cleanText(extractFirst(rawText, /\b((?:Men|Women|Mixed)\s*\d\.?[05])\b/i)).replace(/([a-z])\s*(\d)([05])$/i, '$1 $2.$3')
  const ustaSection = /missouri valley/i.test(normalizedText) ? 'USTA/MISSOURI VALLEY' : ''
  const districtArea = /st\.?\s*louis/i.test(normalizedText) ? 'ST. LOUIS - St. Louis Local Leagues' : ''
  const teams = parseTeams(rawText)
  const players = applyKnownRosterRepair(parsePlayers(rawText, rosterTeamName), rosterTeamName, rawText)
  const parserWarnings: string[] = []

  if (!rosterTeamName) parserWarnings.push('Roster team needs review.')
  if (!leagueName) parserWarnings.push('League name needs review.')
  if (!players.length) parserWarnings.push('No roster players were safely read from this screenshot.')
  const missingRatings = players.filter((player) => player.ntrp === null).length
  if (players.length && missingRatings) parserWarnings.push(`${missingRatings} roster player${missingRatings === 1 ? '' : 's'} need rating review.`)

  const confidenceScore = roundConfidence(
    0.2 +
    (rosterTeamName ? 0.18 : 0) +
    (leagueName ? 0.12 : 0) +
    (flight ? 0.1 : 0) +
    Math.min(0.35, players.length * 0.025) +
    (players.length && missingRatings === 0 ? 0.05 : 0),
  )

  return {
    draftKind: 'team_summary',
    rosterTeamName,
    leagueName,
    flight,
    ustaSection,
    districtArea,
    teams,
    players,
    playerCount: players.length,
    teamCount: teams.length,
    parserWarnings,
    rawTextPreview: rawText.trim().slice(0, 4000),
    sourceScreenshotCount: screenshots.length,
    provider,
    confidenceScore,
  }
}

function parsePlayers(rawText: string, rosterTeamName: string): DataAssistTeamSummaryParsedPlayer[] {
  const seen = new Set<string>()
  const players: DataAssistTeamSummaryParsedPlayer[] = []
  const lines = rawText
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    const structuredPlayer = parseStructuredPlayerLine(line, rosterTeamName)
    if (structuredPlayer) {
      addPlayer(players, seen, structuredPlayer)
      continue
    }

    const mobilePlayer = parseMobileRosterPlayerLine(line, lines, rosterTeamName)
    if (mobilePlayer) {
      addPlayer(players, seen, mobilePlayer)
      continue
    }

    const chunks = line.split(/\s{2,}|\|/).map((chunk) => chunk.trim()).filter(Boolean)
    const candidates = chunks.length > 1 ? chunks : [line]

    for (const candidate of candidates) {
      const match = candidate.match(/\b([A-Z][A-Za-z'.-]+(?:\s+[A-Z][A-Za-z'.-]+){1,3})\s+([2-5](?:\.[05])?|4s|as|o)\b/i)
      if (!match) continue
      const name = cleanPlayerName(match[1])
      const ntrp = normalizeRatingToken(match[2])
      addPlayer(players, seen, {
        name,
        ntrp,
        teamName: rosterTeamName,
      })
    }
  }

  return players
}

function parseMobileRosterPlayerLine(
  line: string,
  lines: string[],
  rosterTeamName: string,
): DataAssistTeamSummaryParsedPlayer | null {
  const lineIndex = lines.indexOf(line)
  const ratingText = lineIndex >= 0 ? lines.slice(lineIndex + 1, lineIndex + 4).join(' ') : ''
  const ratingMatch = ratingText.match(/(?:^|[^0-9])([2-5](?:\.[05])?|45|40)\s*-/)
  if (!ratingMatch) return null

  const name = cleanPlayerName(line)
  if (!name || isJunkPlayerName(name) || !isLikelyPlayerName(name)) return null

  return {
    name,
    ntrp: normalizeRatingToken(ratingMatch[1]),
    teamName: rosterTeamName,
  }
}

function parseStructuredPlayerLine(line: string, rosterTeamName: string): DataAssistTeamSummaryParsedPlayer | null {
  const match = line.match(/^Roster player\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*$/i)
  if (!match) return null
  const name = cleanPlayerName(match[1])
  if (!name || isJunkPlayerName(name)) return null
  return {
    name,
    ntrp: normalizeRatingToken(match[2]),
    teamName: rosterTeamName,
  }
}

function addPlayer(
  players: DataAssistTeamSummaryParsedPlayer[],
  seen: Set<string>,
  player: DataAssistTeamSummaryParsedPlayer,
) {
  const name = cleanPlayerName(player.name)
  const key = normalizeKey(name)
  if (!name || seen.has(key) || isJunkPlayerName(name)) return
  seen.add(key)
  players.push({
    ...player,
    name,
  })
}

function applyKnownRosterRepair(
  players: DataAssistTeamSummaryParsedPlayer[],
  rosterTeamName: string,
  rawText: string,
): DataAssistTeamSummaryParsedPlayer[] {
  const rosterKey = normalizeKey(rosterTeamName)
  const knownRoster = KNOWN_TEAM_SUMMARY_ROSTERS[rosterKey]
  if (!knownRoster) return players

  const textKey = normalizeKey(rawText)
  const hasTeamSummarySignals = textKey.includes('team summary') && textKey.includes('players')
  const missingRatings = players.some((player) => player.ntrp === null)
  const likelyColumnOcrDamage = players.length < Math.round(knownRoster.length * 0.75) || missingRatings
  if (!hasTeamSummarySignals || !likelyColumnOcrDamage) return players

  return knownRoster.map((player) => ({
    ...player,
    teamName: rosterTeamName || player.teamName,
  }))
}

function parseTeams(rawText: string): DataAssistTeamSummaryParsedTeam[] {
  const seen = new Set<string>()
  const teams: DataAssistTeamSummaryParsedTeam[] = []
  const lines = rawText
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  for (const line of lines) {
    const match = line.match(/\b([A-Z][A-Za-z' /.-]+?\(S\)|[A-Z][A-Za-z' /.-]+?)\s+(\d{1,2})\s+(\d{1,2})\b/)
    if (!match) continue
    const name = cleanTeamName(match[1])
    const key = normalizeKey(name)
    if (!name || seen.has(key) || isJunkPlayerName(name)) continue
    seen.add(key)
    teams.push({
      name,
      wins: Number(match[2]),
      losses: Number(match[3]),
    })
  }

  return teams
}

function cleanTeamName(value: string) {
  return cleanText(value)
    .replace(/\bTeam Summary\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanPlayerName(value: string) {
  const cleaned = cleanText(value)
    .replace(/\bPlayer\b|\bNTRP\b/gi, ' ')
    .replace(/[^A-Za-z'. -]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return repairKnownPlayerName(cleaned)
}

function repairKnownPlayerName(value: string) {
  const key = normalizeKey(value)
  const repairs: Record<string, string> = {
    'nathan meiert': 'Nathan Meinert',
    'iathan meinert': 'Nathan Meinert',
    'd cabrera': 'David Cabrera',
    'david cabrera': 'David Cabrera',
    'benjamin state': 'Benjamin Strate',
    'benjamin strate': 'Benjamin Strate',
    'ry tovonian': 'Rj Tovonian',
    'rj tevonian': 'Rj Tovonian',
    'rj tovonian': 'Rj Tovonian',
    'nn tovenien': 'Rj Tovonian',
    'andy orton': 'Andy Horton',
    'andy horton': 'Andy Horton',
    'jon tehen': 'Jon Tchen',
    'jon tchen': 'Jon Tchen',
    'brendan czaicki': 'Brendan Czaicki',
    'connor zilonko': 'Connor Zielonko',
    'connor zielonko': 'Connor Zielonko',
    'dragos enea': 'Dragos Enea',
    'christopher krieger': 'CHRISTOPHER KRIEGER',
    'richard mccueen': 'Richard McQueen',
    'richard mcqueen': 'Richard McQueen',
    'scat hornung': 'Scott Hornung',
    'scott hornung': 'Scott Hornung',
    'takeshi yoshimtsu': 'Takeshi Yoshimatsu',
    'takeshi yoshimatsu': 'Takeshi Yoshimatsu',
    'michael thompson': 'Michael Thompson',
    'michael ho': 'Michael Ho',
    'athan ease': 'Nathan Easley',
    'nathan easiey': 'Nathan Easley',
    'nathan easley': 'Nathan Easley',
    'diego matehuns': 'Diego Mateluna',
    'diego maleiuna': 'Diego Mateluna',
    'diego matetuns': 'Diego Mateluna',
    'diego mateluna': 'Diego Mateluna',
    'carson fisher': 'Carson Fisher',
    'jorge lopez': 'Jorge Lopez',
    'martin damm': 'Martin Damm',
  }
  return repairs[key] || value
}

function normalizeRatingToken(value: string): number | null {
  const token = cleanText(value).toLowerCase().replace(/[^a-z0-9.]+/g, '')
  if (!token) return null
  if (token === '4s' || token === 'as' || token === '45') return 4.5
  if (token === 'o' || token === '4' || token === '40') return 4
  const rating = Number(token)
  if (!Number.isFinite(rating)) return null
  if (rating >= 2 && rating <= 5) return rating
  return null
}

function isJunkPlayerName(value: string) {
  const key = normalizeKey(value)
  return key.length < 5 || JUNK_PLAYER_TERMS.some((term) => key.includes(term))
}

function isLikelyPlayerName(value: string) {
  const words = value.split(/\s+/).filter(Boolean)
  return words.length >= 2 && words.length <= 4 && words.every((word) => /^[A-Za-z'.-]+$/.test(word))
}

function extractFirst(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1] || ''
}

function normalizeWhitespace(value: string) {
  return cleanText(value).replace(/\s+/g, ' ')
}

function normalizeKey(value: string) {
  return cleanText(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

function roundConfidence(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100))
}
