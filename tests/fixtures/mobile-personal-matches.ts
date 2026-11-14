import type { PersonalMatch } from '../../mobile/src/personal-match-data'

type Row = Omit<PersonalMatch, 'court_venue_key' | 'court_feedback'> &
  Partial<Pick<PersonalMatch, 'court_venue_key' | 'court_feedback'>> & { owner_user_id: string }
export const personalMatchFixture = { rows: [] as Row[], writtenIds: [] as string[], loseReceipt: false,
  courtFeedbackReads: [] as { owner: string | undefined; venue: string | undefined; limit: number; columns: string }[], failCourtFeedbackRead: false,
  teamScoreReads: [] as { owner: string | undefined; keys: string[] }[], failTeamScoreRead: false }
let missLookup = false

export function personalMatchQuery() {
  const filters = new Map<string, string>()
  let action = 'read', values: Partial<Row> = {}, single = false, limit = 21
  let afterId: string | undefined
  let teamScoreKeys: string[] | undefined
  let ratedOnly = false, columns = ''
  const chain = {
    eq(key: string, value: string) { filters.set(key, value); return chain },
    in(key: string, keys: string[]) {
      if (key !== 'calendar_match_id') throw Error('Unexpected scorecard query.')
      teamScoreKeys = keys
      return chain
    },
    or(value: string) { afterId = /,id\.lt\.([0-9a-f-]+)\)$/.exec(value)?.[1]; return chain },
    select(projection = '') { columns = projection; return chain },
    not(key: string, operator: string, value: null) {
      if (key !== 'court_feedback' || operator !== 'is' || value !== null) throw Error('Unexpected scorecard filter.')
      ratedOnly = true
      return chain
    },
    order() { return chain },
    limit(value: number) { limit = value; return chain },
    abortSignal() { return chain },
    retry() { return chain },
    maybeSingle() { single = true; return chain },
    insert(row: Row) { action = 'insert'; values = row; return chain },
    update(row: Partial<Row>) { action = 'update'; values = row; return chain },
    delete() { action = 'delete'; return chain },
    then(resolve: (result: { data: unknown; error: { message: string } | null }) => void) {
      const fixture = personalMatchFixture
      const fail = (message: string) => resolve({ data: null, error: { message } })
      if (teamScoreKeys) {
        fixture.teamScoreReads.push({ owner: filters.get('owner_user_id'), keys: teamScoreKeys })
        if (fixture.failTeamScoreRead) return fail('Saved team score check unavailable')
      }
      if (ratedOnly) {
        fixture.courtFeedbackReads.push({owner:filters.get('owner_user_id'),venue:filters.get('court_venue_key'),limit,columns})
        if (fixture.failCourtFeedbackRead) return fail('Court ratings unavailable')
      }
      const selected = fixture.rows.filter(row => (!teamScoreKeys || row.calendar_match_id && teamScoreKeys.includes(row.calendar_match_id)) &&
        (!ratedOnly || row.court_feedback != null) &&
        [...filters].every(([key, value]) => row[key as keyof Row] === value))
      if (action === 'insert') {
        const row = { ...values, created_at: new Date().toISOString() } as Row
        fixture.writtenIds.push(row.id)
        if (fixture.rows.some(item => item.owner_user_id === row.owner_user_id &&
            (item.id === row.id || row.calendar_match_id && item.calendar_match_id === row.calendar_match_id ||
             row.hitting_calendar_id && item.hitting_calendar_id === row.hitting_calendar_id ||
             row.chat_hit_id && item.chat_hit_id === row.chat_hit_id))) return fail('Duplicate ID')
        fixture.rows.push(row)
        if (fixture.loseReceipt) { fixture.loseReceipt = false; missLookup = true; return fail('Receipt unavailable') }
        return resolve({ data: row, error: null })
      }
      if (action === 'update') {
        selected.forEach(row => Object.assign(row, values))
        if (selected.length && fixture.loseReceipt) { fixture.loseReceipt = false; missLookup = true; return fail('Receipt unavailable') }
      }
      if (action === 'delete') fixture.rows = fixture.rows.filter(row => !selected.includes(row))
      if (action === 'read' && filters.has('id') && missLookup) { missLookup = false; return fail('Lookup unavailable') }
      selected.sort((a, b) => b.match_date.localeCompare(a.match_date) || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id))
      const offset = afterId ? selected.findIndex(row => row.id === afterId) + 1 : 0
      resolve({ data: single ? selected[0] ?? null : selected.slice(offset, offset + limit), error: null })
    },
  }
  return chain
}
