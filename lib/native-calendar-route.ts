import { verifiedAccount, accountClient, accountResponse, readAccountJson } from './mobile-account-auth'
import { supabaseKey } from './supabase-public-config'
import { calendarId, calendarIntent, calendarRange, firstPartyPersonalCalendarId } from './native-calendar-contract'
import { CalendarFault, calendarPersonal, loadNativeCalendar, respondNativeCalendar, writeCalendarPersonal } from './native-calendar'
import { loadFirstPartyCalendarCompetitions } from './first-party-calendar'

export async function handleNativeCalendar(request: Request, write: boolean, firstParty = false) {
  const json = (body: object, status = 200) => accountResponse(
    firstParty ? { ...body, releaseScope: 'first-party' } : body, status, { 'Referrer-Policy': 'no-referrer' },
  )
  const account = await verifiedAccount(request)
  if (!account) return json({ ok: false }, 401)
  const owner = account.user.id
  const params = new URL(request.url).searchParams
  if ([...params.keys()].some(key => !['from', 'to', 'item'].includes(key) || params.getAll(key).length !== 1) ||
      write && params.size) return json({ ok: false }, 400)
  let intent, range, id = ''
  try {
    if (write) intent = calendarIntent(await readAccountJson(request, 12000))
    else if (params.has('item')) {
      if (params.size !== 1) throw Error()
      id = calendarId(params.get('item'))
    } else range = calendarRange(params.get('from'), params.get('to'))
  } catch {
    return json({ ok: false, message: 'Review the calendar date and change before trying again.' }, 400)
  }
  if (firstParty) {
    if (id && !firstPartyPersonalCalendarId(id)) return json({ ok: true, owner, item: null })
    if (intent && intent.action !== 'respond' && !firstPartyPersonalCalendarId(intent.action === 'delete' ? intent.id : intent.item.id)) {
      return json({ ok: false, message: 'This date is unavailable in your personal calendar.' }, 404)
    }
  }
  try {
    const client = accountClient(supabaseKey, account.token)
    if (intent?.action === 'respond') {
      const result = firstParty
        ? await respondNativeCalendar(client, owner, intent, loadFirstPartyCalendarCompetitions)
        : await respondNativeCalendar(client, owner, intent)
      return json({ ok: true, owner, ...result })
    }
    if (intent) return json({ ok: true, owner, ...await writeCalendarPersonal(client, owner, intent) })
    if (id) return json({ ok: true, owner, item: await calendarPersonal(client, owner, id) })
    const result = firstParty
      ? await loadNativeCalendar(client, owner, range!, loadFirstPartyCalendarCompetitions)
      : await loadNativeCalendar(client, owner, range!)
    return json({ ok: true, ...result })
  } catch (error) {
    return json({ ok: false, message: error instanceof CalendarFault ? error.message : 'The calendar result couldn’t be confirmed. Refresh before trying again.' },
      error instanceof CalendarFault ? error.status : 503)
  }
}
