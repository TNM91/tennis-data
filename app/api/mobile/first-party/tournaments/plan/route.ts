import { accountClient, accountResponse, readAccountJson, verifiedAccount } from '@/lib/mobile-account-auth'
import { nativeTournamentPublicationId, tournamentDraftRevision } from '@/lib/native-tournament-draft-contract'
import { nativeTournamentPlan } from '@/lib/native-tournament-draw-plan'
import { readTournamentPlanWrite, type TournamentPlanWrite } from '@/lib/native-tournament-plan-contract'

export const runtime = 'nodejs'
export const maxDuration = 30

const response = (body: object, status = 200) =>
  accountResponse({ ...body, scope: 'first-party' }, status, { 'Referrer-Policy': 'no-referrer' })
const failed = (code: string) => response({ ok: false, code }, code === 'missing' ? 404 : code === 'invalid' ? 400 :
  ['closed', 'stale', 'review', 'court', 'player', 'round', 'not_ready', 'downstream', 'trophy_locked'].includes(code) ? 409 : 503)

async function handle(request: Request) {
  try {
    const account = await verifiedAccount(request)
    if (!account) return response({ ok: false }, 401)
    const owner = account.user.id
    const settings = new URL(request.url).searchParams
    const event = settings.get('event')
    const isRead = request.method === 'GET'
    const selection = isRead ? settings.get('division') : null
    if (!tournamentDraftRevision(event) || settings.size !== (selection === null ? 1 : 2) ||
        (selection !== null && !nativeTournamentPublicationId(selection, 'division'))) return failed('invalid')
    let write: TournamentPlanWrite | undefined
    if (!isRead) {
      try { write = readTournamentPlanWrite(await readAccountJson(request, 4096)) }
      catch { return failed('invalid') }
    }
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!key) return failed('unavailable')
    const db = accountClient(key)
    const scope = { p_owner: owner, p_event: event }
    const loaded = await db.rpc('native_tournament_draw_plan', scope)
    if (loaded.error || !loaded.data) return failed('unavailable')
    if (loaded.data.code) return failed(loaded.data.code)
    const selected = write?.division ?? selection ?? undefined
    const preview = nativeTournamentPlan(loaded.data, selected, write)
    if (preview.code) return failed(preview.code)
    if (!write || preview.unchanged) return response({ ok: true, owner, event, plan: preview.plan })

    if (write.action === 'result' && !preview.change) return failed('unavailable')
    const version = { ...scope, p_expected: write.revision, p_division: write.division }
    const operation = (() => {
      if (write.action === 'result') return db.rpc('native_tournament_save_result', {
        ...version, p_match: write.match, p_result: preview.change?.result, p_complete: preview.change?.complete,
      })
      if (write.action === 'publish') return db.rpc('native_tournament_draw_plan', { ...version, p_action: write.action })

      const match = preview.plan.matches.find(match => match.id === write.match)!
      return db.rpc('native_tournament_save_slot', {
        ...version, p_match: write.match, p_slot: write.slot, p_sides: match.ready === false ? [] : [match.a, match.b],
        p_rescheduled: Boolean(match.date && match.time && match.court),
      })
    })()
    const saved = await operation.retry(false)
    if (saved.error?.code === '23514' && saved.error.message === 'trophy_locked') return failed('trophy_locked')
    if (saved.error || !saved.data) return failed('unavailable')
    if (saved.data.code) return failed(saved.data.code)
    const result = nativeTournamentPlan(saved.data, selected)
    if (result.code) return failed(result.code)
    return response({ ok: true, owner, event, plan: result.plan })
  } catch {
    return failed('unavailable')
  }
}

export const GET = handle
export const POST = handle
