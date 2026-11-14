import { accountClient, accountResponse, readAccountJson, verifiedAccount } from '@/lib/mobile-account-auth'
import { readSavedTournamentDraft, tournamentDraftRevision } from '@/lib/native-tournament-draft-contract'
import { readNativeTournamentSetup, readTournamentSettings } from '@/lib/native-tournament-setup-contract'

export const runtime = 'nodejs'

function response(body: object, status = 200) {
  return accountResponse({ ...body, scope: 'first-party' }, status, { 'Referrer-Policy': 'no-referrer' })
}

async function handle(request: Request) {
  try {
    const account = await verifiedAccount(request)
    if (!account) return response({ ok: false }, 401)
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    if (!key) return response({ ok: false }, 503)
    const owner = account.user.id
    const service = accountClient(key)
    const params = new URL(request.url).searchParams

    if (request.method === 'GET') {
      if (params.has('event')) {
        const event = params.get('event')
        if (params.size !== 1 || !tournamentDraftRevision(event)) return response({ ok: false }, 400)
        const result = await service.rpc('native_tournament_setup', { p_owner: owner, p_event: event })
        if (result.error) return response({ ok: false }, 503)
        if (result.data === null) return response({ ok: false }, 404)
        const setup = readNativeTournamentSetup(result.data)
        if (setup.revision !== event) return response({ ok: false }, 503)
        return response({ ok: true, owner, setup })
      }
      const after = params.get('after')
      if (params.size !== (after === null ? 0 : 1) || (after !== null && !tournamentDraftRevision(after))) {
        return response({ ok: false }, 400)
      }
      const result = await service.rpc('native_tournament_desk', { p_owner: owner, p_after: after })
      if (result.error || !Array.isArray(result.data) || result.data.length > 21) return response({ ok: false }, 503)
      const events = result.data.slice(0, 20).map(readSavedTournamentDraft)
      return response({ ok: true, owner, events, next: result.data.length === 21 ? events[19].revision : null })
    }

    if (params.size) return response({ ok: false }, 400)
    if (request.method === 'PATCH') {
      const body = await readAccountJson(request, 12288)
      if (!body || Object.keys(body).length !== 4 || !tournamentDraftRevision(body.event) ||
          !tournamentDraftRevision(body.revision) ||
          (body.expected !== null && !tournamentDraftRevision(body.expected)) || body.expected === body.revision) {
        return response({ ok: false }, 400)
      }
      let settings
      try { settings = readTournamentSettings(body.settings) }
      catch { return response({ ok: false }, 400) }
      const result = await service.rpc('save_native_tournament_settings', {
        p_owner: owner, p_event: body.event, p_expected: body.expected, p_revision: body.revision, p_settings: settings,
      })
      if (result.error) return response({ ok: false }, 503)
      if (result.data?.code === 'stale') return response({ ok: false, code: 'stale' }, 409)
      if (result.data?.code === 'forbidden') return response({ ok: false }, 403)
      if (result.data?.code === 'missing') return response({ ok: false }, 404)
      if (result.data?.code === 'deadline' || result.data?.code === 'timeZone') return response({ ok: false }, 400)
      const setup = readNativeTournamentSetup(result.data)
      if (setup.revision !== body.event || setup.settingsRevision !== body.revision) return response({ ok: false }, 503)
      return response({ ok: true, owner, setup })
    }
    const body = await readAccountJson(request, 1024)
    if (!body || Object.keys(body).length !== 1 || !tournamentDraftRevision(body.revision)) {
      return response({ ok: false }, 400)
    }
    const result = await service.rpc('prepare_native_tournament', { p_owner: owner, p_revision: body.revision })
    if (result.error) return response({ ok: false }, 503)
    if (result.data?.code === 'stale') return response({ ok: false, code: 'stale' }, 409)
    if (result.data?.code === 'forbidden') return response({ ok: false }, 403)
    const event = readSavedTournamentDraft(result.data)
    if (event.revision !== body.revision) return response({ ok: false }, 503)
    return response({ ok: true, owner, event })
  } catch {
    return response({ ok: false }, 503)
  }
}

export const GET = handle
export const POST = handle
export const PATCH = handle
