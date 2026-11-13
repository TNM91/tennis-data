import { lineupRecord } from './native-captain-lineup-contract'
import { courtAccountId } from './native-court-result-contract'
import { entryLeague } from './native-league-entry-contract'
import { isValidCalendarDate } from './calendar-date'
import { inferTiqBestOfThreeWinner, validateTiqTennisMatchScore } from './tiq-scoring'

export type LeagueScoreDiscipline = 'singles' | 'doubles'
export type LeagueCourtOutcome = 'played' | 'walkover' | 'retirement'
export type LeagueScoreLine = { format: LeagueScoreDiscipline; score: string; winner: 'A' | 'B'; outcome?: Exclude<LeagueCourtOutcome,'played'> }
export type LeagueScoreAction = 'submit' | 'approve' | 'return'
export type LeagueScoreState = 'pending' | 'changes_requested' | 'approved'
export type LeagueScoreChange = {
  action: LeagueScoreAction; leagueId: string; matchId: string; requestId: string
  revision: string | null; fixtureVersion: string; lines: LeagueScoreLine[]; note: string
}
export type LeagueScoreFixture = { id: string; date: string; time: string; a: string; b: string }
export type LeagueScoreCard = { revision: string; state: LeagueScoreState; lines: LeagueScoreLine[]; note: string }
export type LeagueScoreDesk = {
  match: LeagueScoreFixture; fixtureVersion: string; card: LeagueScoreCard | null
  canSubmit: boolean; canReview: boolean; thirdSetRule: 'full_set' | 'match_tiebreak_10' | 'either'
  slots: { label: string; format: LeagueScoreDiscipline }[]
}

function text(value: unknown, max: number, allowEmpty = false) {
  if (typeof value !== 'string' || value.length > max || /\p{Cc}/u.test(value) || !allowEmpty && !value.trim()) {
    throw Error('Check the scorecard details.')
  }
  return value.trim()
}
function id(value: unknown) {
  if (!courtAccountId(value)) throw Error('Choose a scheduled match.')
  return value.toLowerCase()
}
function timestamp(value: unknown) {
  const version = text(value, 40)
  if (!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(version) ||
      !Number.isFinite(Date.parse(version))) throw Error('Reload the match before entering a score.')
  return version
}
function discipline(value: unknown) {
  if (value !== 'singles' && value !== 'doubles') throw Error('Choose singles or doubles for each court.')
  return value
}

function retirementScore(input: unknown, rule: LeagueScoreDesk['thirdSetRule'] = 'either'): string {
  if (rule==='either') {
    try { return retirementScore(input,'full_set') }
    catch (error) {
      try { return retirementScore(input,'match_tiebreak_10') }
      catch { throw error }
    }
  }
  const score = text(input, 64, true).replace(/[–—]/g, '-').split(/[,\s]+/).filter(Boolean).join(', ')
  if (!score) return ''
  const parts = score.split(', ')
  const invalid = () => Error('Enter only the score when play stopped, like 6-4, 2-1, or leave it blank.')
  if (parts.length > 3) throw invalid()
  let aWins=0, bWins=0
  for (const [i, part] of parts.entries()) {
    const match = /^(0|[1-9]\d?)-(0|[1-9]\d?)(?:\(\d{1,2}(?:-\d{1,2})?\))?$/.exec(part)
    if (!match) throw invalid()
    const a=Number(match[1]), b=Number(match[2]), high=Math.max(a,b), low=Math.min(a,b), gap=high-low
    const setComplete=(high===6&&low<=4)||(high===7&&(low===5||low===6))
    const setOpen=high<=5||(high===6&&(low===5||low===6))
    const breakerComplete=high>=10&&gap>=2&&(high===10||gap===2)
    const breakerOpen=high<10||gap<=1
    if (i===2&&!(aWins===1&&bWins===1) ||
        part.includes('(') && !(high===7&&low===6&&(i<2||rule!=='match_tiebreak_10'))) throw invalid()
    const complete=i<2 || rule==='full_set' ? setComplete : breakerComplete
    const unfinished=i<2 || rule==='full_set' ? setOpen : breakerOpen
    if (complete) { if (a>b) aWins++; else bWins++ }
    else if (!unfinished || i!==parts.length-1) throw invalid()
    if (aWins===2||bWins===2) throw Error('This score is complete. Choose Played to record it.')
  }
  return score
}

export function leagueScoreLine(format: unknown, input: unknown, outcome: unknown = 'played', side: unknown = undefined): LeagueScoreLine {
  if (outcome==='walkover'||outcome==='retirement') {
    if (side!=='A'&&side!=='B') throw Error('Choose the team awarded this court.')
    if (outcome==='walkover'&&input!=='') throw Error('Leave the set score blank for a walkover.')
    return {format:discipline(format),score:outcome==='walkover'?'':retirementScore(input),winner:side,outcome}
  }
  if (outcome!=='played') throw Error('Choose a court outcome.')
  const score = text(input, 64).replace(/[–—]/g, '-').replace(/[,\s]+/g, ', ')
  const winner = inferTiqBestOfThreeWinner(score)
  if (!winner) {
    const validation = validateTiqTennisMatchScore(score)
    throw Error(validation.message || 'Enter the deciding set only when the first two sets were split.')
  }
  return { format: discipline(format), score, winner }
}

function readLines(value: unknown, requireWinner = false) {
  if (!Array.isArray(value) || value.length > 30) throw Error('Enter up to 30 court scores.')
  return value.map(item => {
    const row = lineupRecord(item)
    const line = leagueScoreLine(row.format, row.score, row.outcome, row.winner)
    if (requireWinner && line.winner !== row.winner) throw Error('The recorded court winner does not match the score.')
    return line
  })
}

export function readLeagueScoreChange(value: unknown): LeagueScoreChange {
  const row = lineupRecord(value)
  const { action } = row
  const keys = ['action', 'leagueId', 'matchId', 'requestId', 'revision', 'fixtureVersion', 'lines', 'note']
  if (Object.keys(row).length !== keys.length || !keys.every(key => Object.hasOwn(row, key)) ||
      (action !== 'submit' && action !== 'approve' && action !== 'return')) throw Error('Check the scorecard details.')
  const lines = readLines(row.lines)
  const note = text(row.note, 500, true)
  const revision = row.revision === null ? null : id(row.revision)
  if (action === 'submit' ? !lines.length || note : lines.length || !revision || (action === 'return') !== Boolean(note)) {
    throw Error(action === 'return' ? 'Tell the captain what needs correcting.' : 'Check the scorecard details.')
  }
  return { action, leagueId: entryLeague(row.leagueId), matchId: id(row.matchId), requestId: id(row.requestId),
    revision, fixtureVersion: timestamp(row.fixtureVersion), lines, note }
}

export function readLeagueScoreFixture(value: unknown): LeagueScoreFixture {
  const row = lineupRecord(value)
  const date = text(row.date, 10), time = text(row.time, 5, true)
  const a = text(row.a, 160), b = text(row.b, 160)
  if (!isValidCalendarDate(date) || time && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) || a === b) {
    throw Error('Match details changed.')
  }
  return { id: id(row.id), date, time, a, b }
}

export function readLeagueScoreCard(value: unknown): LeagueScoreCard {
  const row = lineupRecord(value)
  const { state } = row
  if (state !== 'pending' && state !== 'changes_requested' && state !== 'approved') throw Error('Scorecard status changed.')
  const note = text(row.note, 500, true), lines = readLines(row.lines, true)
  if (!lines.length || (state === 'changes_requested') !== Boolean(note)) throw Error('Scorecard details changed.')
  return { revision: id(row.revision), state, lines, note }
}

export function leagueScoreUpdateLink(url: URL) {
  const leagueId = /^\/explore\/leagues\/tiq\/([a-zA-Z0-9_-]{1,80})$/.exec(url.pathname)?.[1]
  const matchId = url.searchParams.get('scoreMatch')
  if (leagueId && courtAccountId(matchId) && url.searchParams.size === 1 && url.hash === '#league-scores') {
    return { leagueId, matchId }
  }
}

export function readLeagueScoreDesk(value: unknown, matchId: string): LeagueScoreDesk {
  const row = lineupRecord(value), match = readLeagueScoreFixture(row.match), rule = row.thirdSetRule
  if (match.id !== matchId || typeof row.canSubmit !== 'boolean' || typeof row.canReview !== 'boolean' ||
      (rule !== 'either' && rule !== 'full_set' && rule !== 'match_tiebreak_10') || !Array.isArray(row.slots) || row.slots.length > 30) {
    throw Error('Match access changed.')
  }
  return { match, fixtureVersion: timestamp(row.fixtureVersion), card: row.card === null ? null : readLeagueScoreCard(row.card),
    canSubmit: row.canSubmit, canReview: row.canReview, thirdSetRule: rule,
    slots: row.slots.map(item => { const slot = lineupRecord(item); return { label: text(slot.label, 80), format: discipline(slot.format) } }) }
}

export function validateLeagueScoreLines(lines: LeagueScoreLine[], desk: Pick<LeagueScoreDesk, 'slots' | 'thirdSetRule'>) {
  if (desk.slots.length && (lines.length !== desk.slots.length || lines.some((line, i) => line.format !== desk.slots[i].format))) {
    throw Error('Enter a score for every court in the league’s match format.')
  }
  for (const { score, winner, outcome } of lines) {
    if (outcome==='walkover') continue
    if (outcome==='retirement') { retirementScore(score,desk.thirdSetRule); continue }
    const third = validateTiqTennisMatchScore(score, winner).parsedSets[2]
    if (!third) continue
    if (desk.thirdSetRule === 'full_set' && third.kind === 'match_tiebreak') throw Error('This league requires a full third set.')
    if (desk.thirdSetRule === 'match_tiebreak_10' && third.kind !== 'match_tiebreak') throw Error('This league uses a match tiebreak for the third set.')
  }
}

export function leagueCourtResultText(line: LeagueScoreLine) {
  return line.outcome==='walkover'?'Walkover':line.outcome==='retirement'
    ? ['Retired',line.score].filter(Boolean).join(' · ') : line.score
}
