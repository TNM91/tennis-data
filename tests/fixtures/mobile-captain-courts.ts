import { courtScorecardKey, readCourtSubmission, type CaptainCourt } from '../../lib/native-court-result-contract'
import { competitionLeague, competitionOwner } from './competitions-data'

export const captainFixtureId = '55555555-5555-4555-8555-555555555555'
const opponent = '22222222-2222-4222-8222-222222222222'
const match = { league: competitionLeague.id, fixture: captainFixtureId, date: '2026-11-06', teamA: 'Baseline Aces', teamB: 'Rally Crew' }
export const captainCourtsFixture = { enabled: new URL(location.href).searchParams.has('captain-courts'), courts: [] as CaptainCourt[] }

export function captainCourtPreview(url: URL, owner: string, body: unknown) {
  const response = { ok: true, owner, releaseScope: 'first-party' }
  const active = captainCourtsFixture.enabled
  if (!url.search) return Response.json({ ...response, scorecards: !active ? [] : captainCourtsFixture.courts.flatMap(row => {
    const side = row.a.includes(owner) ? 'A' : row.b.includes(owner) ? 'B' : ''
    if (!side) return []
    const id = courtScorecardKey(match.league, match.fixture, row.court)
    return [{ id, calendar_match_id: id, match_date: match.date, format: row.format, court: row.court,
      score: row.score, scoreOrder: `${match.teamA} – ${match.teamB}`, opponent: side === 'A' ? match.teamB : match.teamA,
      outcome: row.winner === side ? 'Won' : 'Lost' }]
  }) })
  if (!active || url.searchParams.get('league') !== match.league || url.searchParams.get('fixture') !== match.fixture) {
    return Response.json({ ok: false, releaseScope: 'first-party' }, { status: 403 })
  }
  if (body) {
    const draft = readCourtSubmission(JSON.parse(String(body)))
    const prior = captainCourtsFixture.courts.find(row => row.court === draft.court)
    if ((prior?.revision ?? null) !== draft.expected) return Response.json({ ok: false, releaseScope: 'first-party' }, { status: 409 })
    const court: CaptainCourt = { court: draft.court, format: draft.format, a: draft.a, b: draft.b,
      winner: draft.winner, score: draft.score, revision: draft.revision }
    captainCourtsFixture.courts = [...captainCourtsFixture.courts.filter(row => row.court !== court.court), court]
    return Response.json({ ...response, league: match.league, fixture: match.fixture, court })
  }
  const captain = owner === competitionOwner
  return Response.json({ ...response, desk: { ...match, captain, side: captain ? 'A' : 'B', courts: captain ? captainCourtsFixture.courts : [],
    membersA: captain ? [{ id: competitionOwner, name: 'Jordan Lee' }] : [], membersB: captain ? [{ id: opponent, name: 'Casey Serve' }] : [] } })
}
