import { accountClient } from './mobile-account-auth'
import { lineupRecord } from './native-captain-lineup-contract'
import type { CompetitionSnapshot } from './native-competitions-contract'
import { courtAccountId } from './native-court-result-contract'
import { leagueAttentionFixture, readLeagueAttention } from './native-league-attention-contract'

export async function loadNativeLeagueAttention(snapshot: CompetitionSnapshot, actor: string) {
  const detail = snapshot.detail
  if (!detail || detail.league.format !== 'team') return
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!key) return
  const fixtures = new Map((snapshot.publishedSchedule ?? detail.fixtures)
    .filter(fixture => courtAccountId(fixture.id)).map(fixture => [fixture.id, fixture]))
  const { data, error } = await accountClient(key).rpc('native_league_score_attention', {
    p_league: detail.league.id, p_version: detail.league.updatedAt, p_matches: [...fixtures.keys()], p_actor: actor,
  }).retry(false)
  if (error) throw Error('League follow-ups unavailable')
  if (data === null) return
  if (!Array.isArray(data) || data.length > fixtures.size) throw Error('Invalid league follow-ups')
  const visible = data.filter(raw => {
    const row = lineupRecord(raw), match = lineupRecord(row.fixture)
    const fixture = courtAccountId(row.id) ? fixtures.get(row.id) : undefined
    if (!fixture) throw Error('Unexpected league follow-up')
    return Object.entries(leagueAttentionFixture(fixture)).every(([key, value]) => match[key] === value)
  })
  return readLeagueAttention(visible, fixtures)
}
