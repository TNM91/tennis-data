type Court = { label: string; slotType?: string; players: string[] }
export type CaptainHomeFocusAction = 'team' | 'schedule' | 'replace' | 'court' | 'lineup' | 'availability' | 'send' | 'chat'
export type CaptainHomeMatchFocus = {
  courtsLabel: string
  confirmedLabel: string
  waitingLabel: string
  action: { kind: CaptainHomeFocusAction; label: string; detail: string }
  issues: Array<{ kind: CaptainHomeFocusAction; label: string }>
}
const key = (name: string) => name.trim().toLowerCase()
const namesLabel = (names: string[]) => `${names.slice(0, 2).join(', ')}${names.length > 2 ? ` + ${names.length - 2} more` : ''}`

export function buildCaptainHomeMatchFocus(input: {
  hasTeam: boolean
  matchDate: string
  lineup: { matchDate: string; courts: Court[]; expectedCourtCount?: number; confirmedCourtLabels?: string[]; attentionCourtLabels?: string[]; sent?: boolean } | null
  availability: { matchDate: string; people: Array<{ name: string; status: string }> } | null
}): CaptainHomeMatchFocus {
  const date = input.matchDate.slice(0, 10)
  const lineup = input.hasTeam && date && input.lineup?.matchDate.slice(0, 10) === date ? input.lineup : null
  const courts = lineup?.courts ?? []
  const courtTotal = Math.max(courts.length, lineup?.expectedCourtCount ?? 0)
  const missingCourtCount = courtTotal - courts.length
  const people = input.hasTeam && date && input.availability?.matchDate.slice(0, 10) === date ? input.availability.people : []
  const statuses = new Map(people.map((person) => [key(person.name), key(person.status)]))
  const confirmedCourts = new Set(lineup?.confirmedCourtLabels?.map(key) ?? [])
  const players = new Map<string, string>()
  const openCourts = courts.filter((court) => court.players.filter((name) => name.trim()).length !== (court.slotType === 'singles' ? 1 : 2))
  for (const court of courts) {
    for (const name of court.players.filter((name) => name.trim())) {
      players.set(key(name), name.trim())
      if (!statuses.has(key(name)) && confirmedCourts.has(key(court.label))) statuses.set(key(name), 'confirmed')
    }
  }
  const selected = [...players.values()]
  const confirmed = selected.filter((name) => ['confirmed', 'available', 'yes', 'in'].includes(statuses.get(key(name)) ?? ''))
  const out = selected.filter((name) => ['out', 'no', 'unavailable', 'declined'].includes(statuses.get(key(name)) ?? ''))
  const late = selected.filter((name) => ['running-late', 'need-sub'].includes(statuses.get(key(name)) ?? ''))
  const waiting = selected.filter((name) => !confirmed.includes(name) && !out.includes(name) && !late.includes(name))
  const attention = lineup?.attentionCourtLabels ?? []
  const duplicatePlayers = courts.reduce((count, court) => count + court.players.filter((name) => name.trim()).length, 0) !== selected.length
  const issues: CaptainHomeMatchFocus['issues'] = []
  if (out.length) issues.push({ kind: 'replace', label: `${namesLabel(out)}: out` })
  else if (late.length) issues.push({ kind: 'court', label: `${namesLabel(late)}: needs follow-up` })
  else if (attention.length) issues.push({ kind: 'court', label: `${namesLabel(attention)}: needs captain` })
  if (openCourts.length || missingCourtCount) issues.push({ kind: 'lineup', label: openCourts.length
    ? `${namesLabel(openCourts.map((court) => court.label))}: open spots${missingCourtCount ? ` · ${missingCourtCount} more court${missingCourtCount === 1 ? '' : 's'} to fill` : ''}`
    : `${missingCourtCount} court${missingCourtCount === 1 ? '' : 's'} still need${missingCourtCount === 1 ? 's' : ''} players.` })
  else if (duplicatePlayers) issues.push({ kind: 'lineup', label: 'A player is on more than one court.' })
  if (waiting.length) issues.push({ kind: 'availability', label: `${namesLabel(waiting)}: confirmation needed` })
  const action: CaptainHomeMatchFocus['action'] = !input.hasTeam
    ? { kind: 'team', label: 'Choose team', detail: 'Connect your team to start match week.' }
    : !date
      ? { kind: 'schedule', label: 'Choose next match', detail: 'Add your schedule to start planning.' }
      : out.length
        ? { kind: 'replace', label: 'Replace out player', detail: 'Update the affected court before sending your lineup.' }
        : late.length || attention.length
          ? { kind: 'court', label: 'Review court', detail: 'Resolve the player update in Team Chat.' }
          : !courts.length || openCourts.length || missingCourtCount || duplicatePlayers
            ? { kind: 'lineup', label: courts.length ? 'Finish courts' : 'Build lineup', detail: 'Choose a player for every spot.' }
            : waiting.length
              ? { kind: 'availability', label: 'Confirm players', detail: `${confirmed.length}/${selected.length} selected players are in.` }
              : lineup?.sent
                ? { kind: 'chat', label: 'Open Team Chat', detail: 'Your lineup was sent. Check the latest team updates.' }
                : { kind: 'send', label: 'Review & send lineup', detail: 'Review your courts and send the confirmed lineup.' }
  return {
    courtsLabel: courtTotal ? `${courts.length - openCourts.length}/${courtTotal} filled` : 'Not built',
    confirmedLabel: selected.length ? `${confirmed.length}/${selected.length} in` : 'Not selected',
    waitingLabel: selected.length ? String(waiting.length) : 'Not asked',
    action, issues,
  }
}
