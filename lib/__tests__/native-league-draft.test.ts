import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { afterEach, expect, it, vi } from 'vitest'
import { GET, POST } from '../../app/api/mobile/first-party/leagues/draft/route'
import { GET as getCheckout, POST as postCheckout } from '../../app/api/mobile/first-party/leagues/publish/route'
import { calculateTiqLeagueEndsOn } from '../tiq-league-limits'
import type { LeagueDraft } from '../native-league-draft-contract'

const mocks = vi.hoisted(() => ({ verifiedAccount: vi.fn(), rpc: vi.fn() }))
vi.mock('server-only', () => ({}))
vi.mock('../apple-purchase-server', () => ({
  applePurchaseConfiguration: () => ({ mode: 'production', environment: 'Production' }),
}))
vi.mock('../mobile-account-auth', async importOriginal => ({
  ...(await importOriginal<typeof import('../mobile-account-auth')>()),
  verifiedAccount: mocks.verifiedAccount,
  accountClient: () => ({ rpc: mocks.rpc }),
}))

const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const first = '33333333-3333-4333-8333-333333333333'
const next = '44444444-4444-4444-8444-444444444444'
const draft: LeagueDraft = {
  name: 'Winter Doubles', location: 'Northside Tennis', format: 'team',
  startsOn: '2026-11-01', timeZone: 'America/Chicago', weeks: 12,
}

afterEach(() => vi.unstubAllEnvs())

it('uses the verified account and enforces the season limit before calling the service', async () => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only')
  mocks.verifiedAccount.mockResolvedValue({ user: { id: owner } }).mockResolvedValueOnce(null)
  mocks.rpc.mockResolvedValue({ data: { draft, revision: first }, error: null })
  const endpoint = 'https://example.test/api/mobile/first-party/leagues/draft'
  const post = (values: object) => POST(new Request(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ draft, revision: first, expected: null, ...values }),
  }))
  expect((await GET(new Request(endpoint))).status).toBe(401)
  expect((await GET(new Request(endpoint + '?owner=' + other))).status).toBe(400)
  expect((await post({ owner: other })).status).toBe(400)
  expect((await post({ draft: { ...draft, weeks: 13 } })).status).toBe(400)
  expect((await post({ draft: { ...draft, startsOn: '2026-02-30' } })).status).toBe(400)
  expect(mocks.rpc).not.toHaveBeenCalled()

  const response = await post({ draft: { ...draft, name: '  Winter Doubles  ' } })
  expect(response.status).toBe(200)
  expect(response.headers.get('Cache-Control')).toBe('private, no-store')
  expect(await response.json()).toEqual({ ok: true, scope: 'first-party', owner, saved: { draft, revision: first } })
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('save_native_league_draft', {
    p_owner: owner, p_expected: null, p_revision: first, p_draft: draft,
  })
  expect(calculateTiqLeagueEndsOn(draft.startsOn, draft.weeks)).toBe('2027-01-23')
})

it('offers test checkout only to an approved sandbox account and respects the purchase switch', async () => {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'test-only')
  vi.stubEnv('APPLE_LEAGUE_SANDBOX_CHECKOUT_ENABLED', 'true')
  vi.stubEnv('APPLE_LEAGUE_PURCHASES_ENABLED', 'false')
  mocks.verifiedAccount.mockResolvedValue({ user: { id: owner } })
  mocks.rpc.mockReset().mockResolvedValueOnce({ data: { ownerId: owner, sandboxEnabled: false } })
    .mockResolvedValueOnce({ data: { state: 'ready' } })
  const endpoint = 'https://example.test/api/mobile/first-party/leagues/publish?draft=' + first
  expect(await (await getCheckout(new Request(endpoint))).json()).toMatchObject({ available: false })
  expect(mocks.rpc).toHaveBeenLastCalledWith('native_league_checkout', {
    p_owner: owner, p_draft: first, p_environment: 'Production', p_action: 'status', p_token: null, p_cancel_key: null,
  })
  const prepare = () => postCheckout(new Request(endpoint, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'prepare', expected: first, token: next, cancelKey: owner }),
  }))
  mocks.rpc.mockReset().mockResolvedValueOnce({ data: { ownerId: owner, sandboxEnabled: false } })
  expect((await prepare()).status).toBe(403)
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('apple_purchase_account', { p_owner: owner })

  mocks.rpc.mockResolvedValueOnce({ data: { ownerId: owner, sandboxEnabled: true } }).mockResolvedValueOnce({ data: { state: 'ready' } })
  expect(await (await getCheckout(new Request(endpoint))).json()).toMatchObject({
    available: true, canStart: true, environment: 'Sandbox', productId: 'com.tenaceiq.app.league.publish',
  })
  vi.stubEnv('APPLE_LEAGUE_SANDBOX_CHECKOUT_ENABLED', 'false')
  mocks.rpc.mockClear().mockResolvedValueOnce({ data: { ownerId: owner, sandboxEnabled: true } })
  const response = await prepare()
  expect(response.status).toBe(403)
  expect(mocks.rpc).toHaveBeenCalledExactlyOnceWith('apple_purchase_account', { p_owner: owner })
})

it('publishes verified production seasons once and scopes registration, refunds and account erasure', async () => {
  const db = new PGlite()
  try {
    await db.exec(await readFile('lib/__tests__/fixtures/account-erasure-audited-schema.sql','utf8'))
    await db.exec(await readFile('supabase/migrations/20261028000100_native_account_requests.sql','utf8'))
    await db.exec(`
      create schema private;
      alter table public.account_deletion_requests add column automatic_consent boolean not null default false;
      alter table public.tiq_leagues enable row level security;
      alter table public.tiq_team_league_entries enable row level security;
      alter table public.tiq_player_league_entries enable row level security;
      alter table public.tiq_leagues add constraint tiq_leagues_team_vs_individual_check check
        (season_status = 'draft' or cardinality(teams) > 0 or cardinality(players) > 0);
      grant select, insert, update on public.tiq_leagues, public.tiq_team_league_entries to authenticated;
      create policy allow_during_test on public.tiq_leagues for all to authenticated using (true) with check (true);
      create policy allow_entry_during_test on public.tiq_team_league_entries for all to authenticated using (true) with check (true);
      create function public.apple_purchase_account(p_owner uuid) returns jsonb language sql as $$
        select jsonb_build_object('sandboxEnabled', p_owner = '11111111-1111-4111-8111-111111111111'::uuid)
      $$;
    `)
    await db.query("insert into auth.users values ($1,'organizer@example.test',now()), ($2,'player@example.test',now())", [owner, other])
    await db.query("insert into profiles (id,email,role) values ($1,'organizer@example.test','member'),($2,'player@example.test','member')",[owner,other])
    await db.exec(await readFile(new URL('../../supabase/migrations/20261115000500_native_league_drafts.sql', import.meta.url), 'utf8'))
    for(const migration of ['20261113000200_native_first_party_league_entry','20261113000300_native_first_party_league_decisions',
      '20261115000600_native_league_checkout','20261115000700_native_league_registration']){
      await db.exec(await readFile('supabase/migrations/'+migration+'.sql','utf8'))
    }

    async function load(user: string) {
      return (await db.query<{ result: unknown }>('select public.native_league_draft($1) result', [user])).rows[0].result
    }
    async function save(user: string, expected: string | null, revision: string, details = draft) {
      return (await db.query<{ result: unknown }>('select public.save_native_league_draft($1,$2,$3,$4) result',
        [user, expected, revision, JSON.stringify(details)])).rows[0].result
    }
    const token = '55555555-5555-4555-8555-555555555555'
    const abandoned = '66666666-6666-4666-8666-666666666666'
    const signed = '2026-11-15T12:00:00Z'
    async function checkout(action: string, attempt: string | null = token, user = owner, env = 'Sandbox') {
      return (await db.query<{ result: unknown }>('select public.native_league_checkout($1,$2,$3,$4,$5,$6) result',
        [user, next, env, action, attempt, first])).rows[0].result
    }
    async function settle(actor: string | null = owner, revoked = false, timestamp = signed, env = 'Sandbox', attempt = token) {
      return (await db.query<{ result: {state?:string;publicId?:string} }>('select public.complete_native_league_purchase($1,$2,$3,$4,$5,$6,$7) result',
        [actor, next, attempt, env, '101', timestamp, revoked])).rows[0].result
    }

    await db.exec('set role authenticated')
    await expect(load(owner)).rejects.toThrow(/permission denied/)
    await expect(checkout('status')).rejects.toThrow(/permission denied/)
    await db.exec('set role service_role')
    await expect(save(owner, null, first, { ...draft, weeks: 13 })).rejects.toThrow(/check constraint/)
    expect(await save(owner, null, first)).toEqual({ draft, revision: first })
    expect(await save(owner, null, first)).toEqual({ draft, revision: first })
    expect(await load(other)).toBeNull()
    expect(await save(other, first, next)).toEqual({ code: 'stale' })
    expect(await save(owner, null, next)).toEqual({ code: 'stale' })

    const update = { ...draft, startsOn: '2099-11-01', weeks: 8 }
    expect(await save(owner, first, next, update)).toEqual({ draft: update, revision: next })
    expect(await load(owner)).toEqual({ draft: update, revision: next })
    expect(await checkout('status', null, other)).toEqual({ code: 'forbidden' })
    expect(await checkout('cancel', abandoned)).toEqual({ state: 'ready' })
    expect(await checkout('prepare', abandoned)).toEqual({ state: 'ready' })
    expect(await checkout('prepare')).toEqual({ state: 'pending', token, start: true })
    expect(await checkout('prepare', abandoned)).toEqual({ state: 'pending', token, publicId: null })
    await expect(save(owner, next, first)).rejects.toThrow('native_league_checkout_pending')
    expect(await settle(other)).toEqual({ code: 'missing' })
    expect(await settle(null)).toEqual({ state: 'paid', token, publicId: null })
    expect(await settle()).toEqual({ state: 'paid', token, publicId: null })
    expect(await settle(owner, true, '2026-11-16T12:00:00Z')).toEqual({ state: 'refunded', token, publicId: null })
    expect(await settle()).toEqual({ state: 'refunded', token, publicId: null })
    const productionToken='77777777-7777-4777-8777-777777777777'
    expect(await checkout('prepare',productionToken,owner,'Production')).toMatchObject({state:'pending',start:true})
    expect(await settle(owner,false,signed,'Sandbox',productionToken)).toEqual({code:'missing'})
    const paid=await settle(owner,false,signed,'Production',productionToken)
    expect(paid).toMatchObject({state:'paid',publicId:expect.stringMatching(/^tiq-native-league-/)})
    expect(await settle(owner,false,signed,'Production',productionToken)).toEqual(paid)
    await db.exec('reset role')
    const seasons=await db.query<{updated_at:string}>(`select id, league_name, is_public, max_weeks, updated_at::text from tiq_leagues`)
    expect(seasons.rows).toEqual([expect.objectContaining({id:paid.publicId, league_name:draft.name,is_public:true,max_weeks:8})])
    const version=seasons.rows[0].updated_at
    const entryId='88888888-8888-4888-8888-888888888888'
    await db.exec('set role authenticated')
    await expect(db.query(`insert into tiq_leagues(id,season_status) values('tiq-native-league-spoof','draft')`))
      .rejects.toMatchObject({code:'42501'})
    await expect(db.query(`insert into tiq_team_league_entries(id,league_id,team_name,entry_status) values($1,$2,'Forged','active')`,
      [entryId,paid.publicId])).rejects.toMatchObject({code:'42501'})
    await db.exec('set role service_role')
    expect((await db.query(`select native_first_party_league_entry($1,$2,'team',$3,$4) as accepted`,
      [other,paid.publicId,version,JSON.stringify({id:entryId,team_name:'Northside Aces'})])).rows).toEqual([{accepted:true}])
    await db.exec('reset role')
    const entryVersion=(await db.query<{updated_at:string}>(`select updated_at::text from tiq_team_league_entries where id=$1`,[entryId])).rows[0].updated_at
    async function approve(actor:string){
      return (await db.query(`select native_first_party_league_decision($1,$2,'team',$3,$4,$5,'active','Team confirmed','') as receipt`,
        [actor,paid.publicId,version,entryId,entryVersion])).rows
    }
    await db.exec('set role service_role')
    expect(await approve(other)).toEqual([{receipt:null}])
    expect(await approve(owner)).toEqual([{receipt:expect.objectContaining({id:entryId,entry_status:'active'})}])
    expect(await settle(owner,true,'2026-11-17T12:00:00Z','Production',productionToken)).toMatchObject({state:'refunded'})
    await db.exec('reset role')
    expect((await db.query(`select is_public from tiq_leagues where id=$1`,[paid.publicId])).rows).toEqual([{is_public:false}])
    await db.exec('set role service_role')
    expect(await save(owner, next, first)).toEqual({ draft, revision: first })
    await expect(save(owner, first, next)).rejects.toThrow('native_league_checkout_revision_used')
    await db.exec('reset role')
    await db.query("insert into public.account_deletion_requests(account_id,verified_email,automatic_consent) values ($1,'organizer@example.test',true)", [owner])
    expect(await save(owner, first, next)).toEqual({ code: 'forbidden' })
    expect(await settle()).toEqual({ code: 'forbidden' })
    expect(await load(owner)).toBeNull()
    await db.query('delete from auth.users where id = $1', [owner])
    expect((await db.query('select * from private.native_league_drafts')).rows).toEqual([])
    expect((await db.query('select * from private.native_league_purchases')).rows).toEqual([])
  } finally {
    await db.close()
  }
}, 30000)
