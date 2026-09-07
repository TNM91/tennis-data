import { getCaptainApiAuth } from '@/lib/captain-api-auth'
import { getCaptainAvailabilityServiceClient, isUuid } from '@/lib/captain-availability-request-server'
import { authorizeSeason, loadSeasonFixtures, loadSeasonInvites, loadSeasonResponses, loadSeasonRoster, loadSeasonSelf, readSeasonScope, seasonPrivateHeaders, seasonToday } from '@/lib/season-kickoff-server'
import { seasonReadiness } from '@/lib/season-kickoff'
import { randomUUID } from 'node:crypto'

export const runtime = 'nodejs'
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: seasonPrivateHeaders })

async function handle(request: Request) {
  const auth = await getCaptainApiAuth(request)
  if (!auth.ok) return auth.response
  const service = getCaptainAvailabilityServiceClient()
  const scope = readSeasonScope(new URL(request.url).searchParams)
  if (!await authorizeSeason(service, auth.userId, scope)) return json({ message: 'Link your captain or co-captain role for this team and season first.' }, 403)
  const [allMatches, roster] = await Promise.all([loadSeasonFixtures(service, scope), loadSeasonRoster(service, scope)])
  const matches = allMatches.filter(match => (match.match_date || '') >= seasonToday())
  const self = await loadSeasonSelf(service, auth.userId, roster)
  if (request.method === 'POST') {
    const body = await request.json() as { playerKeys?: unknown; action?: unknown }
    if (body.action === 'self') {
      if (!self) return json({ message: 'Link your own player record in Profile and make sure it is on this team roster.' }, 409)
      // Never use a submitted player ID or a name guess for "my availability".
      body.playerKeys = [self.key]
    }
    if (!Array.isArray(body.playerKeys) || !body.playerKeys.length || body.playerKeys.length > 60 || !matches.length) return json({ message: 'Choose up to 60 roster players and a season with upcoming matches.' }, 400)
    const players = roster.filter(player => body.playerKeys instanceof Array && body.playerKeys.includes(player.key))
    if (players.length !== new Set(body.playerKeys).size) return json({ message: 'Your roster changed. Reload before preparing invitations.' }, 409)
    const { error } = await service.from('season_availability_invites').upsert(players.map(player => ({
      created_by: auth.userId, team_name: scope.team, league_name: scope.league, flight: scope.flight, season_key: scope.seasonKey,
      roster_key: player.key, player_id: player.playerId, player_name: player.name, match_ids: allMatches.map(match => match.id),
    })), { onConflict: 'team_name,league_name,flight,season_key,roster_key', ignoreDuplicates: true })
    if (error) throw new Error('Invitations could not be prepared. Retry safely; existing personal links will stay valid.')
    // Refresh allowed fixtures without rotating tokens or deleting any replies.
    const { error: updateError } = await service.from('season_availability_invites').update({ match_ids: allMatches.map(match => match.id) })
      .eq('team_name', scope.team).eq('league_name', scope.league).eq('flight', scope.flight).eq('season_key', scope.seasonKey)
      .in('roster_key', players.map(player => player.key)).is('revoked_at', null)
    if (updateError) throw new Error('The updated schedule could not be attached. Retry before sharing the links.')
  } else if (request.method === 'PATCH') {
    const body = await request.json() as { inviteId?: string; action?: string }
    if (!isUuid(body.inviteId || '')) return json({ message: 'Choose a player link.' }, 400)
    if (body.action === 'replace' && !allMatches.length) return json({ message: 'Load the team schedule before replacing the link.' }, 400)
    const { error } = await service.from('season_availability_invites').update(body.action === 'replace'
      ? { response_token: randomUUID(), calendar_token: randomUUID(), revoked_at: null, match_ids: allMatches.map(match => match.id) }
      : { revoked_at: new Date().toISOString() })
      .eq('id', body.inviteId).eq('team_name', scope.team).eq('league_name', scope.league).eq('flight', scope.flight).eq('season_key', scope.seasonKey)
    if (error) throw new Error('The link could not be stopped. Please retry.')
  }
  const invites = await loadSeasonInvites(service, scope)
  const replies = await loadSeasonResponses(service, invites.map(invite => invite.id))
  return json({ ok: true, matches, roster, invites, replies, self, readiness: seasonReadiness(matches, invites, replies) })
}
async function safely(request: Request) {
  try { return await handle(request) }
  catch (error) { return json({ message: error instanceof Error ? error.message : 'Season setup could not be loaded. Please retry.' }, 500) }
}
export const GET = safely
export const POST = safely
export const PATCH = safely
