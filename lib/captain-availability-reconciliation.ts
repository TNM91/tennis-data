export type CaptainRosterAvailabilityStatus = 'available' | 'unavailable' | 'tentative' | 'no-response'

export type CaptainRosterAvailabilityRow = {
  id: string
  event_key: string
  contact_id: string
  status: CaptainRosterAvailabilityStatus
  note: string
  updated_at: string
}

export type CaptainCloudAvailabilityRow = {
  playerName: string
  status: CaptainRosterAvailabilityStatus
  note: string
  updatedAt: string
}

export type CaptainAvailabilityCloudUpdate = {
  contactId: string
  playerName: string
  status: CaptainRosterAvailabilityStatus
  note: string
  updatedAt: string
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
    return { rows: input.rows, changed: false, matchedReplies: 0, updates: [] as CaptainAvailabilityCloudUpdate[] }
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
  const updates: CaptainAvailabilityCloudUpdate[] = []

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
    updates.push({
      contactId: contact.id,
      playerName: contact.full_name,
      status: nextRow.status,
      note: nextRow.note,
      updatedAt: nextRow.updated_at,
    })
    changed = true
  }

  return { rows: changed ? nextRows : input.rows, changed, matchedReplies, updates }
}

export function reconcileCaptainCloudAvailability(input: {
  eventKey: string
  contacts: CaptainAvailabilityContact[]
  rows: CaptainRosterAvailabilityRow[]
  cloudRows: CaptainCloudAvailabilityRow[]
}) {
  if (!input.eventKey || !input.contacts.length) {
    return { rows: input.rows, changed: false, uploads: [] as CaptainAvailabilityCloudUpdate[] }
  }

  const cloudByName = new Map<string, CaptainCloudAvailabilityRow>()
  for (const row of input.cloudRows) {
    const key = normalizeName(row.playerName)
    const current = cloudByName.get(key)
    if (key && (!current || timestamp(row.updatedAt) >= timestamp(current.updatedAt))) cloudByName.set(key, row)
  }

  let changed = false
  const nextRows = [...input.rows]
  const uploads: CaptainAvailabilityCloudUpdate[] = []

  for (const contact of input.contacts) {
    const cloud = cloudByName.get(normalizeName(contact.full_name))
    const localIndex = nextRows.findIndex((row) => row.event_key === input.eventKey && row.contact_id === contact.id)
    const local = localIndex >= 0 ? nextRows[localIndex] : null
    const cloudTime = timestamp(cloud?.updatedAt || '')
    const localTime = timestamp(local?.updated_at || '')

    if (cloud && (!local || cloudTime >= localTime)) {
      if (local?.status === cloud.status && local.note === cloud.note && localTime === cloudTime) continue
      const nextRow: CaptainRosterAvailabilityRow = {
        id: local?.id || `cloud:${input.eventKey}:${contact.id}`,
        event_key: input.eventKey,
        contact_id: contact.id,
        status: cloud.status,
        note: cloud.note,
        updated_at: validTimestamp(cloud.updatedAt),
      }
      if (localIndex >= 0) nextRows[localIndex] = nextRow
      else nextRows.push(nextRow)
      changed = true
      continue
    }

    if (local && (!cloud || localTime > cloudTime)) {
      uploads.push({
        contactId: contact.id,
        playerName: contact.full_name,
        status: local.status,
        note: local.note,
        updatedAt: validTimestamp(local.updated_at),
      })
    }
  }

  return { rows: changed ? nextRows : input.rows, changed, uploads }
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
