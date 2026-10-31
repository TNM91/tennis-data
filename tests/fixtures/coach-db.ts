import type {SupabaseClient} from '@supabase/supabase-js'
export type CoachDbRow = Record<string, unknown>
export function coachDb(tables: Record<string, CoachDbRow[]>) {
 const calls: {table: string; operation: string; filters: [string, unknown, string][]; payload?: CoachDbRow}[] = []
 const hooks = {fail: false, beforeWrite: null as null | ((table: string) => void)}
 const client = {from: (table: string) => {
  const call = {table, operation: 'read', filters: [] as [string, unknown, string][], payload: undefined as CoachDbRow | undefined}; calls.push(call); let limit = Infinity
  const run = (single = false) => {
   if (hooks.fail) return {data: null, error: {message: 'private SQL detail'}}
   if (call.operation !== 'read') hooks.beforeWrite?.(table)
   const all = tables[table] ||= []
   if (call.operation === 'insert') {if (all.some(r => r.id === call.payload!.id)) return {data: null, error: {code: '23505'}}; all.unshift({...call.payload}); return {data: null, error: null}}
   const rows = all.filter(r => call.filters.every(([key, value, op]) => op === 'neq' ? r[key] !== value : r[key] === value)).slice(0, limit)
   if (call.operation === 'update') rows.forEach(row => Object.assign(row, call.payload))
   return {data: single ? rows[0] ? {...rows[0]} : null : rows.map(r => ({...r})), error: null}
  }
  const q = {select: () => q, eq: (k: string, v: unknown) => {call.filters.push([k, v, 'eq']); return q}, is: (k: string, v: unknown) => {call.filters.push([k, v, 'is']); return q}, neq: (k: string, v: unknown) => {call.filters.push([k, v, 'neq']); return q}, order: () => q, limit: (n: number) => {limit = n; return q}, abortSignal: () => q, insert: (p: CoachDbRow) => {call.operation = 'insert'; call.payload = p; return q}, update: (p: CoachDbRow) => {call.operation = 'update'; call.payload = p; return q}, maybeSingle: async () => run(true), then: (resolve: (v: unknown) => unknown) => Promise.resolve(run()).then(resolve)}
  return q
 }} as unknown as SupabaseClient
 return {client, tables, calls, hooks}
}
