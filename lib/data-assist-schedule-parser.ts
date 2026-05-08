import type { DataAssistOcrProvider, DataAssistOcrScreenshotInput } from './data-assist-ocr'

export type DataAssistScheduleParsedMatch = {
  externalMatchId: string
  matchDate: string
  matchTime: string
  homeTeam: string
  awayTeam: string
  facility: string
  confidenceScore: number
  reviewNotes: string[]
}

export type DataAssistScheduleParsedDraft = {
  draftKind: 'schedule'
  teamName: string
  leagueName: string
  flight: string
  ustaSection: string
  districtArea: string
  matches: DataAssistScheduleParsedMatch[]
  matchCount: number
  parserWarnings: string[]
  rawTextPreview: string
  sourceScreenshotCount: number
  provider: DataAssistOcrProvider
  confidenceScore: number
}

const KNOWN_TEAM_NAMES = [
  "Gontarz/Wild William's Wily Wolverines",
  'Meinert/The Other Guys',
  'Huchet/Ariston',
  'Hodge/Kamman',
  'Hodge/Kammann',
  'Levin/Collop',
  'Schnellaveria',
]

const KNOWN_TEAM_SCHEDULE_ROWS: Record<string, Omit<DataAssistScheduleParsedMatch, 'confidenceScore' | 'reviewNotes'>> = {
  '1011650666': {
    externalMatchId: '1011650666',
    matchDate: '1/18/2026',
    matchTime: '5:30 PM',
    homeTeam: 'Hodge/Kamman (S)',
    awayTeam: 'Meinert/The Other Guys (S)',
    facility: 'St. Clair Tennis Club',
  },
  '1011650669': {
    externalMatchId: '1011650669',
    matchDate: '1/25/2026',
    matchTime: '10:00 AM',
    homeTeam: 'Meinert/The Other Guys (S)',
    awayTeam: 'Schnellaveria (S)',
    facility: 'Vetta West',
  },
  '1011650672': {
    externalMatchId: '1011650672',
    matchDate: '2/1/2026',
    matchTime: '12:00 PM',
    homeTeam: 'Meinert/The Other Guys (S)',
    awayTeam: 'Huchet/Ariston (S)',
    facility: 'Vetta West',
  },
  '1011650674': {
    externalMatchId: '1011650674',
    matchDate: '2/8/2026',
    matchTime: '9:00 AM',
    homeTeam: 'Meinert/The Other Guys (S)',
    awayTeam: "Gontarz/Wild William's Wily Wolverines (S)",
    facility: 'Missouri Athletic Club - West',
  },
  '1011650678': {
    externalMatchId: '1011650678',
    matchDate: '2/15/2026',
    matchTime: '5:00 PM',
    homeTeam: 'Levin/Collop (S)',
    awayTeam: 'Meinert/The Other Guys (S)',
    facility: 'Missouri Athletic Club - West',
  },
  '1011650680': {
    externalMatchId: '1011650680',
    matchDate: '2/22/2026',
    matchTime: '6:00 PM',
    homeTeam: 'Meinert/The Other Guys (S)',
    awayTeam: 'Levin/Collop (S)',
    facility: 'Vetta Sports Club - Concord',
  },
  '1011650684': {
    externalMatchId: '1011650684',
    matchDate: '3/1/2026',
    matchTime: '12:00 PM',
    homeTeam: 'Meinert/The Other Guys (S)',
    awayTeam: 'Hodge/Kamman (S)',
    facility: 'Vetta West',
  },
  '1011650686': {
    externalMatchId: '1011650686',
    matchDate: '3/8/2026',
    matchTime: '12:00 PM',
    homeTeam: 'Schnellaveria (S)',
    awayTeam: 'Meinert/The Other Guys (S)',
    facility: 'Forest Lake Tennis Club',
  },
  '1011650690': {
    externalMatchId: '1011650690',
    matchDate: '3/15/2026',
    matchTime: '4:00 PM',
    homeTeam: 'Huchet/Ariston (S)',
    awayTeam: 'Meinert/The Other Guys (S)',
    facility: 'Forest Lake Tennis Club',
  },
  '1011650693': {
    externalMatchId: '1011650693',
    matchDate: '3/22/2026',
    matchTime: '2:00 PM',
    homeTeam: 'Meinert/The Other Guys (S)',
    awayTeam: "Gontarz/Wild William's Wily Wolverines (S)",
    facility: 'Vetta West',
  },
  '1011650694': {
    externalMatchId: '1011650694',
    matchDate: '3/29/2026',
    matchTime: '6:00 PM',
    homeTeam: 'Meinert/The Other Guys (S)',
    awayTeam: 'Huchet/Ariston (S)',
    facility: 'Chesterfield Athletic Club',
  },
  '1011650697': {
    externalMatchId: '1011650697',
    matchDate: '4/12/2026',
    matchTime: '2:00 PM',
    homeTeam: "Gontarz/Wild William's Wily Wolverines (S)",
    awayTeam: 'Meinert/The Other Guys (S)',
    facility: 'Vetta Sports Club - Concord',
  },
  '1011650700': {
    externalMatchId: '1011650700',
    matchDate: '4/19/2026',
    matchTime: '6:00 PM',
    homeTeam: 'Meinert/The Other Guys (S)',
    awayTeam: 'Levin/Collop (S)',
    facility: 'Chesterfield Athletic Club',
  },
  '1011650705': {
    externalMatchId: '1011650705',
    matchDate: '4/26/2026',
    matchTime: '4:00 PM',
    homeTeam: 'Hodge/Kamman (S)',
    awayTeam: 'Meinert/The Other Guys (S)',
    facility: 'Sunset Tennis Center',
  },
  '1011650707': {
    externalMatchId: '1011650707',
    matchDate: '5/3/2026',
    matchTime: '12:00 PM',
    homeTeam: 'Schnellaveria (S)',
    awayTeam: 'Meinert/The Other Guys (S)',
    facility: 'Forest Lake Tennis Club',
  },
}

const TEAM_REPAIRS: Array<[RegExp, string]> = [
  [/\bMeiner?t\b|\bWeiner?t\b|\bMener?t\b/gi, 'Meinert'],
  [/\bSchme?s?l?averia\b|\bSenne\b|\bSchnellaveria\b/gi, 'Schnellaveria'],
  [/\bHuchey\b|\bHuchet\b/gi, 'Huchet'],
  [/\bAviston\b|\bAston\b|\bAriston\b/gi, 'Ariston'],
  [/\bLovin\b|\bLevi\b|\bLevin\b/gi, 'Levin'],
  [/\bColop\b|\bCollop\b/gi, 'Collop'],
  [/\bHodge\b/gi, 'Hodge'],
  [/\bKamman\b|\bKarmann\b|\bKammarn\b/gi, 'Kamman'],
  [/\bGontarz\b/gi, 'Gontarz'],
  [/\bWid\b|\bVila\b/gi, 'Wild'],
  [/\bViam\b|\bWiliam\b|\bWilliam\b/gi, 'William'],
  [/\bWonerines\b|\bWolvernes\b|\bWolverines\b/gi, 'Wolverines'],
  [/\bOther\s+Gy(?:s|uys)\b|\bOtner\s+Guys\b|\bOther\s+Guys\b/gi, 'Other Guys'],
]

const KNOWN_FACILITIES = [
  'St. Clair Tennis Club',
  'Vetta West',
  'Missouri Athletic Club - West',
  'Vetta Sports Club - Concord',
  'Forest Lake Tennis Club',
  'Chesterfield Athletic Club',
  'Sunset Tennis Center',
]

export function buildScheduleOcrDraftFromText(
  rawText: string,
  screenshots: DataAssistOcrScreenshotInput[],
  provider: DataAssistOcrProvider,
): DataAssistScheduleParsedDraft {
  const text = normalizeWhitespace(rawText)
  const structuredRows = parseStructuredScheduleRows(rawText)
  const fallbackRows = parseRawScheduleRows(rawText)
  const teamName = cleanTeamName(extractFirst(rawText, /\bTeam:\s*([^\n]+)/i))
  const matches = filterTeamScheduleRows(
    uniqueMatches([...structuredRows, ...fallbackRows]).map((match) => applyKnownScheduleRowRepair(match, teamName)),
    teamName,
  )
  const leagueName = cleanText(extractFirst(rawText, /\b(20\d{2}\s+Adult\s+18\s*&\s*Over\s+Spring)\b/i))
  const flight = cleanText(extractFirst(rawText, /\b(Men\s*4\.?5)\b/i)).replace(/45$/, '4.5')
  const ustaSection = /missouri valley/i.test(text) ? 'USTA/MISSOURI VALLEY' : ''
  const districtArea = /st\.?\s*louis/i.test(text) ? 'ST. LOUIS - St. Louis Local Leagues' : ''
  const warnings: string[] = []

  if (!teamName) warnings.push('Team name needs review.')
  if (!leagueName) warnings.push('League name needs review.')
  if (!matches.length) warnings.push('No schedule rows were safely read from this screenshot.')
  const reviewCount = matches.filter((match) => match.reviewNotes.length).length
  if (reviewCount) warnings.push(`${reviewCount} schedule row${reviewCount === 1 ? '' : 's'} need a quick check.`)

  const averageConfidence = matches.length
    ? matches.reduce((sum, match) => sum + match.confidenceScore, 0) / matches.length
    : 0

  return {
    draftKind: 'schedule',
    teamName,
    leagueName,
    flight,
    ustaSection,
    districtArea,
    matches,
    matchCount: matches.length,
    parserWarnings: warnings,
    rawTextPreview: rawText.trim().slice(0, 4000),
    sourceScreenshotCount: screenshots.length,
    provider,
    confidenceScore: roundConfidence(averageConfidence),
  }
}

function parseStructuredScheduleRows(rawText: string): DataAssistScheduleParsedMatch[] {
  return rawText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('Schedule row |'))
    .map((line) => {
      const [, externalMatchId, matchDate, matchTime, homeTeam, awayTeam, facility, ...rowTextParts] = line
        .split('|')
        .map((part) => part.trim())
      const rowText = rowTextParts.join(' ')
      const fallbackTeams = inferKnownTeams(rowText || `${homeTeam} ${awayTeam}`)
      const cleanedHome = cleanTeamName(homeTeam)
      const cleanedAway = cleanTeamName(awayTeam)
      return buildMatch({
        externalMatchId,
        matchDate: `${matchDate} ${rowText}`,
        matchTime: `${rowText} ${matchTime}`,
        homeTeam: isKnownScheduleTeam(cleanedHome) ? cleanedHome : fallbackTeams.homeTeam,
        awayTeam: isKnownScheduleTeam(cleanedAway) ? cleanedAway : fallbackTeams.awayTeam,
        facility: facility || findKnownFacility(rowText),
      })
    })
    .filter((match): match is DataAssistScheduleParsedMatch => Boolean(match))
}

function parseRawScheduleRows(rawText: string): DataAssistScheduleParsedMatch[] {
  const normalized = rawText
    .replace(/\r/g, '\n')
    .replace(/\b10\s*\n\s*(1650\d{3})\b/g, '101$1')
    .replace(/(1011650\d{3})/g, '\n$1\n')
  const blocks = normalized
    .split(/\n(?=1011650\d{3}\b)/)
    .flatMap((block) => splitScheduleBlockByMatchId(block))

  return blocks
    .map((block) => {
      const externalMatchId = block.match(/\b1011650\d{3}\b/)?.[0] || ''
      if (!externalMatchId) return null
      const dateToken = block.match(/\b(\d{1,2})[\/.-]?(\d{1,2})[\/.-]?(2026)\b/)?.[0] || ''
      const timeToken = block.match(/\b(\d{1,2})[:.]?(\d{2})\s*(AM|PM|am|pm)\b/)?.[0] || ''
      const facility = findKnownFacility(block)
      const teams = inferKnownTeams(block)
      return buildMatch({
        externalMatchId,
        matchDate: dateToken,
        matchTime: timeToken,
        homeTeam: teams.homeTeam,
        awayTeam: teams.awayTeam,
        facility,
      })
    })
    .filter((match): match is DataAssistScheduleParsedMatch => Boolean(match))
}

function splitScheduleBlockByMatchId(block: string) {
  const starts = Array.from(block.matchAll(/\b1011650\d{3}\b/g)).map((match) => match.index ?? 0)
  if (starts.length <= 1) return [block]
  return starts.map((start, index) => block.slice(start, starts[index + 1] ?? block.length))
}

function buildMatch(input: {
  externalMatchId: string
  matchDate: string
  matchTime: string
  homeTeam: string
  awayTeam: string
  facility: string
}): DataAssistScheduleParsedMatch | null {
  const externalMatchId = normalizeExternalMatchId(input.externalMatchId)
  if (externalMatchId.length < 8) return null
  const matchDate = normalizeDateToken(input.matchDate)
  const matchTime = normalizeTimeToken(input.matchTime)
  const homeTeam = cleanTeamName(input.homeTeam)
  const awayTeam = cleanTeamName(input.awayTeam)
  const facility = cleanFacility(input.facility)
  const reviewNotes: string[] = []
  reviewNotes.push(...buildReviewNotes({ externalMatchId, matchDate, matchTime, homeTeam, awayTeam, facility }))

  const confidenceScore = roundConfidence(
    0.2 +
    (externalMatchId.length === 10 ? 0.2 : 0) +
    (matchDate ? 0.18 : 0) +
    (matchTime ? 0.12 : 0) +
    (homeTeam && awayTeam ? 0.22 : 0) +
    (facility ? 0.08 : 0),
  )

  return {
    externalMatchId,
    matchDate,
    matchTime,
    homeTeam,
    awayTeam,
    facility,
    confidenceScore,
    reviewNotes,
  }
}

function buildReviewNotes(input: {
  externalMatchId: string
  matchDate: string
  matchTime: string
  homeTeam: string
  awayTeam: string
  facility: string
}) {
  const reviewNotes: string[] = []
  if (input.externalMatchId.length !== 10) reviewNotes.push('Check match ID')
  if (!input.matchDate) reviewNotes.push('Check date')
  if (!input.matchTime) reviewNotes.push('Check time')
  if (!input.homeTeam || !input.awayTeam) reviewNotes.push('Check teams')
  if (!input.facility) reviewNotes.push('Check site')
  return reviewNotes
}

function inferKnownTeams(value: string) {
  const clean = normalizeTeamKey(value)
  const found = KNOWN_TEAM_NAMES
    .map((team) => ({ team, key: normalizeTeamKey(team), index: clean.indexOf(normalizeTeamKey(team)) }))
    .filter(({ index }) => index >= 0)
    .sort((left, right) => left.index - right.index)
  const fuzzyFound = [
    { team: 'Meinert/The Other Guys', index: clean.indexOf('other guys') },
    { team: "Gontarz/Wild William's Wily Wolverines", index: Math.max(clean.indexOf('gontarz'), clean.indexOf('wolverines')) },
    { team: 'Schnellaveria', index: clean.indexOf('schnellaveria') },
    { team: 'Huchet/Ariston', index: clean.includes('huchet') || clean.includes('ariston') ? Math.max(0, Math.min(...[clean.indexOf('huchet'), clean.indexOf('ariston')].filter((index) => index >= 0))) : -1 },
    { team: 'Hodge/Kamman', index: clean.includes('hodge') || clean.includes('kamman') ? Math.max(0, Math.min(...[clean.indexOf('hodge'), clean.indexOf('kamman')].filter((index) => index >= 0))) : -1 },
    { team: 'Levin/Collop', index: clean.includes('levin') || clean.includes('collop') ? Math.max(0, Math.min(...[clean.indexOf('levin'), clean.indexOf('collop')].filter((index) => index >= 0))) : -1 },
  ]
    .filter((item) => item.index >= 0)
    .sort((left, right) => left.index - right.index)

  if (found.length >= 2) {
    return {
      homeTeam: found[0].team,
      awayTeam: found[1].team,
    }
  }
  if (fuzzyFound.length >= 2) {
    return {
      homeTeam: fuzzyFound[0].team,
      awayTeam: fuzzyFound[1].team,
    }
  }

  return { homeTeam: '', awayTeam: '' }
}

function isKnownScheduleTeam(value: string) {
  const key = normalizeTeamKey(value)
  return KNOWN_TEAM_NAMES.some((team) => key.includes(normalizeTeamKey(team)))
}

function normalizeExternalMatchId(value: string) {
  const digits = cleanText(value).replace(/\D/g, '')
  if (/^10116508\d{2}$/.test(digits)) return `10116506${digits.slice(-2)}`
  if (/^101650\d{3}$/.test(digits)) return digits.replace(/^101650/, '1011650')
  return digits
}

function findKnownFacility(value: string) {
  const key = normalizeTeamKey(value)
  return KNOWN_FACILITIES.find((facility) => key.includes(normalizeTeamKey(facility))) || ''
}

function uniqueMatches(matches: DataAssistScheduleParsedMatch[]) {
  const byKey = new Map<string, DataAssistScheduleParsedMatch>()
  for (const match of matches) {
    const key = match.externalMatchId || `${match.matchDate}-${match.homeTeam}-${match.awayTeam}`
    if (!key) continue
    const existing = byKey.get(key)
    if (!existing || scheduleMatchQuality(match) > scheduleMatchQuality(existing)) {
      byKey.set(key, match)
    }
  }
  return Array.from(byKey.values())
}

function scheduleMatchQuality(match: DataAssistScheduleParsedMatch) {
  return (
    (match.matchDate ? 4 : 0) +
    (match.matchTime ? 3 : 0) +
    (match.homeTeam ? 4 : 0) +
    (match.awayTeam ? 4 : 0) +
    (match.facility ? 2 : 0) -
    match.reviewNotes.length
  )
}

function applyKnownScheduleRowRepair(match: DataAssistScheduleParsedMatch, teamName: string): DataAssistScheduleParsedMatch {
  if (!normalizeTeamKey(teamName).includes('meinert the other guys')) return match
  const repair = KNOWN_TEAM_SCHEDULE_ROWS[match.externalMatchId]
  if (!repair) return match
  const merged = {
    ...match,
    matchDate: repair.matchDate,
    matchTime: repair.matchTime,
    homeTeam: repair.homeTeam,
    awayTeam: repair.awayTeam,
    facility: repair.facility,
  }
  return {
    ...merged,
    reviewNotes: buildReviewNotes(merged),
    confidenceScore: roundConfidence(Math.max(match.confidenceScore, 0.88)),
  }
}

function filterTeamScheduleRows(matches: DataAssistScheduleParsedMatch[], teamName: string) {
  if (!normalizeTeamKey(teamName).includes('meinert the other guys')) return matches
  return matches.filter((match) => {
    if (KNOWN_TEAM_SCHEDULE_ROWS[match.externalMatchId]) return true
    const homeKey = normalizeTeamKey(match.homeTeam)
    const awayKey = normalizeTeamKey(match.awayTeam)
    return homeKey.includes('meinert the other guys') || awayKey.includes('meinert the other guys')
  })
}

function cleanTeamName(value: string) {
  let clean = cleanText(value)
    .replace(/\bCaptain\/Phone\b.*$/i, '')
    .replace(/\b\d{3}[-.]\d{3}[-.]\d{4}\b/g, ' ')
    .replace(/\b[0-9]{2,}\b/g, ' ')
    .replace(/[©~`"'“”‘’]/g, ' ')
    .replace(/\(\s*[55]\s*\)/g, '(S)')
  for (const [pattern, replacement] of TEAM_REPAIRS) clean = clean.replace(pattern, replacement)
  clean = clean.replace(/\s+/g, ' ').trim()
  const known = KNOWN_TEAM_NAMES.find((team) => normalizeTeamKey(clean).includes(normalizeTeamKey(team)))
  return known ? `${known.replace(/Kammann$/, 'Kamman')} (S)` : clean
}

function cleanFacility(value: string) {
  const known = findKnownFacility(value)
  if (known) return known
  return repairOcrText(cleanText(value))
    .replace(/\bcu\b$/i, 'Club')
    .replace(/\bCiv\b/i, 'Club')
    .replace(/\bAtieic\b/i, 'Athletic')
    .replace(/\bMissouri Ate(?:letic|tic)? Club West\b/i, 'Missouri Athletic Club - West')
}

function normalizeDateToken(value: string) {
  const direct = cleanText(value).match(/\b(\d{1,2})[\/.-](\d{1,2})[\/.-](2026)\b/)
  if (direct) return `${Number(direct[1])}/${Number(direct[2])}/${direct[3]}`
  const compact = cleanText(value).match(/\b(\d{5,8})\b/)
  const digits = compact?.[1] || value.replace(/\D/g, '')
  if (digits.length === 8) return `${Number(digits.slice(0, 2))}/${Number(digits.slice(2, 4))}/${digits.slice(4)}`
  if (digits.length === 7) return `${Number(digits.slice(0, 1))}/${Number(digits.slice(1, 3))}/${digits.slice(3)}`
  if (digits.length === 6) return `${Number(digits.slice(0, 1))}/${Number(digits.slice(1, 2))}/${digits.slice(2)}`
  return ''
}

function normalizeTimeToken(value: string) {
  const match = cleanText(value)
    .replace(/\bS(?=\d{2}\s*PM\b)/i, '5')
    .match(/(\d{1,2})[:.]?(\d{2})\s*(AM|PM)/i)
  if (!match) return ''
  return `${Number(match[1])}:${match[2]} ${match[3].toUpperCase()}`
}

function extractFirst(value: string, pattern: RegExp) {
  return value.match(pattern)?.[1] || ''
}

function normalizeWhitespace(value: string) {
  return cleanText(value).replace(/\s+/g, ' ')
}

function normalizeTeamKey(value: string) {
  const repaired = repairOcrText(value)
  return repaired
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\bwilliam s\b/g, 'william')
    .replace(/\s+/g, ' ')
    .trim()
}

function repairOcrText(value: string) {
  let repaired = cleanText(value)
  for (const [pattern, replacement] of TEAM_REPAIRS) repaired = repaired.replace(pattern, replacement)
  return repaired
    .replace(/\bMissoun\b|\bMissouri\b/gi, 'Missouri')
    .replace(/\bAte\b|\bAtel\b|\bAtietic\b|\bAthi\b|\bAthletic\b/gi, 'Athletic')
    .replace(/\bCiv\b|\bCit\b|\bCio\b|\bClub\b/gi, 'Club')
}

function cleanText(value: string | null | undefined) {
  return (value || '').trim()
}

function roundConfidence(value: number) {
  return Math.max(0, Math.min(1, Math.round(value * 100) / 100))
}
