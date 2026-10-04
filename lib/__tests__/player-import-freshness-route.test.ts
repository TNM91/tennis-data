import { afterEach, describe, expect, it, vi } from 'vitest'
const db = vi.hoisted(() => ({ results: new Map<string, unknown>(), calls: [] as string[] }))
vi.mock('@supabase/supabase-js', () => ({ createClient: () => ({ from: (table: string) => {
  db.calls.push(table)
  const q = { select: () => q, eq: () => q, in: () => q, limit: () => q, then: (resolve: (v: unknown) => unknown) => Promise.resolve(db.results.get(table)).then(resolve) }
  return q
} }) }))
vi.mock('@/lib/supabase', () => ({ supabaseUrl: 'https://example.supabase.co' }))
import { GET } from '@/app/api/player/import-freshness/route'
const id = 'ba687267-2f42-4a5c-9052-518de1f8b495'
afterEach(() => { db.results.clear(); db.calls.length = 0; vi.unstubAllEnvs() })
describe('public player import freshness', () => {
 it('rejects arbitrary identifiers before querying privileged data', async () => { const r = await GET(new Request('https://example.com?playerId=bad')); expect(r.status).toBe(400); expect(db.calls).toEqual([]) })
 it('does not attach freshness to ambiguous identities', async () => { vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','test'); db.results.set('tennisrecord_player_identities',{data:[{status:'ambiguous'}],error:null}); const r = await GET(new Request('https://example.com?playerId='+id)); expect((await r.json()).status).toBe('unknown'); expect(db.calls).toEqual(['tennisrecord_player_identities']) })
 it('publishes only aggregate dates and states, never source locators', async () => { vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','test'); db.results.set('tennisrecord_player_identities',{data:[{status:'matched',tennisrecord_staged_players:{source_url:'https://www.tennisrecord.com/adult/profile.aspx?playername=Example&s=2'}}],error:null}); const at = new Date().toISOString(); const due = new Date(Date.now()+86400000).toISOString(); db.results.set('tennisrecord_crawl_queue',{data:[{status:'done',current_refreshed_at:at,refresh_due_at:due},{status:'done',current_refreshed_at:at,refresh_due_at:due}],error:null}); const r=await GET(new Request('https://example.com?playerId='+id)); const text=await r.text(); expect(text).toContain('lastImportedAt'); expect(text).not.toMatch(/tennisrecord|source_url|playername|test/); expect(r.headers.get('cache-control')).toContain('s-maxage=300') })
})
