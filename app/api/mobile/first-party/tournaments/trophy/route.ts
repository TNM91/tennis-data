import { accountClient, accountResponse, readAccountJson, verifiedAccount } from '@/lib/mobile-account-auth'
import { nativeTournamentPublicationId, tournamentDraftRevision } from '@/lib/native-tournament-draft-contract'
import { tournamentTitleContenders } from '@/lib/native-tournament-trophy'
import { readTournamentTrophy, readTournamentTrophyPreview, readTournamentTrophyWrite } from '@/lib/native-tournament-trophy-contract'

export const runtime = 'nodejs'
export const maxDuration = 30

const json = (body: object, status = 200) => accountResponse({ ...body, scope: 'first-party' }, status, { 'Referrer-Policy': 'no-referrer' })
const failed = (code: string) => json({ ok: false, code }, code === 'missing' ? 404 : code === 'invalid' ? 400 :
  ['stale', 'not_ready', 'recipient'].includes(code) ? 409 : 503)

async function handle(request: Request) {
  try {
    const account = await verifiedAccount(request)
    if (!account) return json({ ok: false }, 401)
    const settings = new URL(request.url).searchParams
    const event = settings.get('event'), division = settings.get('division')
    if (settings.size !== 2 || !tournamentDraftRevision(event) || !nativeTournamentPublicationId(division, 'division')) {
      return failed('invalid')
    }
    const owner = account.user.id
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!key) return failed('unavailable')
    const db = accountClient(key)
    const scope = { p_owner: owner, p_event: event, p_division: division }
    const reply = { ok: true, owner, event, division }
    const write = request.method === 'POST' ? await readAccountJson(request, 2048) : undefined
    let action: ReturnType<typeof readTournamentTrophyWrite> | undefined
    if (request.method === 'POST') {
      try { action = readTournamentTrophyWrite(write) }
      catch { return failed('invalid') }
    }
    if (action?.action === 'withdraw') {
      const result = await db.rpc('native_tournament_title', { ...scope, p_action: 'withdraw', p_award: action.awardId }).retry(false)
      if (result.error || !result.data) return failed('unavailable')
      return result.data.code ? failed(result.data.code) : json({ ...reply, award: readTournamentTrophy(result.data.award) })
    }

    const args = { p_owner: owner, p_event: event }
    const loaded = await db.rpc('native_tournament_draw_plan', args)
    if (loaded.error || !loaded.data) return failed('unavailable')
    if (loaded.data.code) return failed(loaded.data.code)
    const row = loaded.data.divisions?.find((row: Record<string, unknown>) => row.id === division)
    if (!row) return failed('missing')
    const contenders = tournamentTitleContenders(row)
    if (action?.action === 'award') {
      if (!contenders.includes(action.champion)) return failed('not_ready')
      const result = await db.rpc('native_tournament_title', {
        ...scope, p_action: 'award', p_expected: action.revision, p_champion: action.champion,
      }).retry(false)
      if (result.error || !result.data) return failed('unavailable')
      return result.data.code ? failed(result.data.code) : json({ ...reply, award: readTournamentTrophy(result.data.award) })
    }
    const result = await db.rpc('native_tournament_title', scope)
    if (result.error || !result.data) return failed('unavailable')
    if (result.data.code) return failed(result.data.code)
    if (result.data.revision !== loaded.data.revision) return failed('stale')
    const preview = readTournamentTrophyPreview({ eventName: loaded.data.name, division, divisionName: row.name,
      revision: result.data.revision, contenders, tied: contenders.length > 1, award: result.data.award })
    return json({ ...reply, preview })
  } catch {
    return failed('unavailable')
  }
}

export const GET = handle
export const POST = handle
