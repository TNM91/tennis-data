import type { PersonalMatch } from '../../mobile/src/personal-match-data'

type Row = PersonalMatch & { owner_user_id: string }
export const personalMatchFixture = { rows: [] as Row[], writtenIds: [] as string[], loseReceipt: false }
let missLookup = false

export function personalMatchQuery() {
  const filters = new Map<string, string>()
  let action = 'read', values: Partial<Row> = {}, single = false, limit = 21
  const chain = {
    eq(key: string, value: string) { filters.set(key, value); return chain },
    select() { return chain },
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
      const selected = fixture.rows.filter(row => [...filters].every(([key, value]) => row[key as keyof Row] === value))
      const fail = (message: string) => resolve({ data: null, error: { message } })
      if (action === 'insert') {
        const row = { ...values, created_at: new Date().toISOString() } as Row
        fixture.writtenIds.push(row.id)
        if (fixture.rows.some(item => item.id === row.id && item.owner_user_id === row.owner_user_id)) return fail('Duplicate ID')
        fixture.rows.push(row)
        if (fixture.loseReceipt) { fixture.loseReceipt = false; missLookup = true; return fail('Receipt unavailable') }
        return resolve({ data: row, error: null })
      }
      if (action === 'update') selected.forEach(row => Object.assign(row, values))
      if (action === 'delete') fixture.rows = fixture.rows.filter(row => !selected.includes(row))
      if (action === 'read' && filters.has('id') && missLookup) { missLookup = false; return fail('Lookup unavailable') }
      selected.sort((a, b) => b.match_date.localeCompare(a.match_date) || b.created_at.localeCompare(a.created_at))
      resolve({ data: single ? selected[0] ?? null : selected.slice(0, limit), error: null })
    },
  }
  return chain
}
