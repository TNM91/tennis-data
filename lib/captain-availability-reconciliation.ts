export type CaptainRosterAvailabilityStatus = 'available' | 'unavailable' | 'tentative' | 'no-response'

export type CaptainRosterAvailabilityRow = {
  id: string
  event_key: string
  contact_id: string
  status: CaptainRosterAvailabilityStatus
  note: string
  updated_at: string
}

type CaptainAvailabilityContact = {
  id: string
  full_name: string
}

type CaptainGuestAvailabilityReply = {
  player_name: string
  status: 'available' | 'maybe' | 'unavailable'
  responded_at: string
}

export function reconcileCaptainGuestAvailability(input: {
  eventKey: string
  contacts: CaptainAvailabilityContact[]
  rows: CaptainRosterAvailabilityRow[]
  replies: CaptainGuestAvailabilityReply[]
}) {
  if (!input.eventKey || !input.contacts.length || !input.replies.length) {
    return { rows: input.rows, changed: false, matchedReplies: 0 }
  }

  const contactByName = new Map(
    input.contacts.map((contact) => [normalizeName(contact.full_name), contact])
  )
  const latestReplyByName = new Map<string, CaptainGuestAvailabilityReply>()
  for (const reply of input.replies) {
    const playerKey = normalizeName(reply.player_name)
    if (!playerKey) continue
    const current = latestReplyByName.get(playerKey)
    if (!current || timestamp(reply.responded_at) >= timestamp(current.responded_at)) {
      latestReplyByName.set(playerKey, reply)
    }
  }

  let changed = false
  let matchedReplies = 0
  const nextRows = [...input.rows]

  for (const [playerKey, reply] of latestReplyByName) {
    const contact = contactByName.get(playerKey)
    if (!contact) continue
    matchedReplies += 1

    const nextStatus = mapGuestStatus(reply.status)
    const existingIndex = nextRows.findIndex((row) => (
      row.event_key === input.eventKey && row.contact_id === contact.id
    ))
    const existing = existingIndex >= 0 ? nextRows[existingIndex] : null
    if (existing?.status === nextStatus) continue
    if (existing && timestamp(existing.updated_at) > timestamp(reply.responded_at)) continue

    const nextRow: CaptainRosterAvailabilityRow = {
      id: existing?.id || `guest-reply:${input.eventKey}:${contact.id}`,
      event_key: input.eventKey,
      contact_id: contact.id,
      status: nextStatus,
      note: 'Synced from player availability reply',
      updated_at: validTimestamp(reply.responded_at),
    }
    if (existingIndex >= 0) nextRows[existingIndex] = nextRow
    else nextRows.push(nextRow)
    changed = true
  }

  return { rows: changed ? nextRows : input.rows, changed, matchedReplies }
}

function mapGuestStatus(status: CaptainGuestAvailabilityReply['status']): CaptainRosterAvailabilityStatus {
  return status === 'maybe' ? 'tentative' : status
}

function normalizeName(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ')
}

function timestamp(value: string) {
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function validTimestamp(value: string) {
  return timestamp(value) ? new Date(value).toISOString() : new Date(0).toISOString()
}
