export type CaptainWeeklyResponseRecord = {
  id?: string
  event_key?: string
  contact_id?: string
  status?: string
  note?: string
  updated_at?: string
}

export type CaptainLiveAvailabilityResponse = {
  player_id: string | null
  player_name: string
  match_date: string
  status: string
  responded_at?: string
}

function normalizeStatus(status: string | null | undefined) {
  const value = (status || '').trim().toLowerCase()
  if (['available', 'in', 'yes'].includes(value)) return 'confirmed'
  return value
}

export function mergeCaptainWeeklyResponses<T extends CaptainWeeklyResponseRecord>(input: {
  eventKey: string
  matchDate?: string
  localResponses: T[]
  liveResponses: CaptainLiveAvailabilityResponse[]
  resolveContactId?: (response: CaptainLiveAvailabilityResponse) => string
}) {
  const responseByKey = new Map<string, CaptainWeeklyResponseRecord>()
  const add = (row: CaptainWeeklyResponseRecord, keys: string[]) => {
    const key = keys.map((value) => value.trim().toLowerCase()).find(Boolean)
    if (key) responseByKey.set(key, row)
  }

  for (const response of input.localResponses) {
    if (response.event_key !== input.eventKey) continue
    add(response, [response.contact_id || '', response.id || ''])
  }

  const matchDate = input.matchDate?.slice(0, 10) || ''
  for (const response of input.liveResponses) {
    if (matchDate && response.match_date.slice(0, 10) !== matchDate) continue
    const contactId = input.resolveContactId?.(response) || response.player_id || response.player_name
    const row: CaptainWeeklyResponseRecord = {
      id: `live-${response.player_id || response.player_name}-${response.match_date}`,
      event_key: input.eventKey,
      contact_id: contactId,
      status: normalizeStatus(response.status),
      updated_at: response.responded_at,
    }
    add(row, [contactId, response.player_id || '', response.player_name])
  }

  return Array.from(responseByKey.values())
}
