type Recipient = { id: string } | null

/** Preserve lookup precedence and output order while bounding independent reads. */
export async function resolveSchedulingProfileIds(input: {
  playerIds?: string[]; names?: string[]; profileIds?: string[]
}, lookup: {
  byPlayerId: (value: string) => Promise<Recipient>
  byName: (value: string) => Promise<Recipient>
}) {
  const clean = (values: string[] = []) => [...new Set(values.map((value) => value.trim()).filter(Boolean))]
  const profileIds = new Set(clean(input.profileIds))
  const tasks = [
    ...clean(input.playerIds).map((value) => () => lookup.byPlayerId(value)),
    ...clean(input.names).map((value) => () => lookup.byName(value)),
  ]
  for (let offset = 0; offset < tasks.length; offset += 4) {
    const recipients = await Promise.all(tasks.slice(offset, offset + 4).map((task) => task()))
    for (const recipient of recipients) if (recipient?.id) profileIds.add(recipient.id)
  }
  return [...profileIds]
}
