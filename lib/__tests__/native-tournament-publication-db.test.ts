import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

const ids = Array.from({ length: 10 }, (_, index) => '10000000-0000-4000-8000-' + String(index).padStart(12, '0'))
const [owner, other, event, revision, production, sandbox, cancelKey, canceled, partner, stranger] = ids
const draft = {
  name: 'Northside Open', date: '2099-06-06', venue: 'Northside Tennis',
  division: 'Open Doubles', discipline: 'doubles', format: 'round_robin',
}
const settings = {
  registrationClosesOn: '2099-06-04', timeZone: 'America/Chicago',
  divisions: [
    { id: owner, name: 'Open Doubles', discipline: 'doubles', format: 'round_robin' },
    { id: other, name: 'Open Singles', discipline: 'singles', format: 'single_elimination' },
  ],
}

it('settles each purchase once and publishes the draw, schedule, and results for the paid event', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create schema auth; create schema private;
      create table auth.users(id uuid primary key);
      create table public.account_deletion_requests(account_id uuid, automatic_consent boolean);
      create function auth.uid() returns uuid language sql stable as $$select '${owner}'::uuid$$;
      create function public.can_run_club_competition(uuid) returns boolean language sql stable as $$select false$$;
      create function public.has_current_league_access(uuid) returns boolean language sql stable as $$select true$$;
      create function public.has_current_full_court_access(uuid) returns boolean language sql stable as $$select true$$;
    `)
    const migration = async (name: string) => db.exec(await readFile(
      new URL('../../supabase/migrations/' + name + '.sql', import.meta.url), 'utf8',
    ))
    await migration('20260524000100_create_tiq_tournaments')
    await migration('20260525000100_add_tiq_tournament_schedule')
    await db.exec('alter table public.tiq_tournaments add column club_id uuid')
    await migration('20261007000100_tournament_event_divisions')
    await db.exec(`create function public.can_manage_tiq_tournament(tournament text) returns boolean language sql
      stable security definer as $$select exists(select 1 from public.tiq_tournaments
        where id = tournament and created_by_user_id = auth.uid())$$`)
    await migration('20261008000100_tournament_event_registration_desk')
    await migration('20260525000500_create_tiq_tournament_entries')
    await db.exec(`alter table public.tiq_tournament_entries add column submitted_by_user_id uuid,
      add column native_registration jsonb not null default '{}'::jsonb`)
    const entryMigration = await readFile(new URL('../../supabase/migrations/20261113000100_native_testflight_tournament.sql', import.meta.url), 'utf8')
    const contextSource = entryMigration.slice(entryMigration.indexOf('create or replace function public.native_tournament_entry_context'))
    await db.exec(contextSource.slice(0, contextSource.indexOf('end $body$;') + 'end $body$;'.length))
    await migration('20261114001200_native_tournament_drafts')
    await migration('20261114001300_native_tournament_desk')
    await migration('20261114001400_native_tournament_setup_settings')
    await migration('20261114001500_native_tournament_publication')
    await migration('20261114001600_native_tournament_draw_plan')
    await migration('20261114001700_native_tournament_results')
    await migration('20261114001800_native_tournament_trophies')
    await db.query('insert into auth.users values ($1),($2),($3),($4)', [owner, other, partner, stranger])
    await db.exec('grant usage on schema auth to authenticated; grant select,insert,update on public.tiq_tournaments to authenticated')
    const rpc = async (sql: string, params: unknown[]) => (await db.query<{ r: Record<string, unknown> }>('select ' + sql + ' r', params)).rows[0].r
    const checkout = (environment: string, action = 'status', token: string | null = null,
      expected: string | null = revision, key = cancelKey, actor = owner) =>
      rpc('native_tournament_checkout($1,$2,$3,$4,$5,$6,$7)', [actor, event, environment, action, token, expected, key])
    const settle = (token: string, environment: string, transaction: string, revoked = false,
      signed = '2026-11-14T00:00:00Z', actor: string | null = owner, target: string | null = event) =>
      rpc('complete_native_tournament_purchase($1,$2,$3,$4,$5,$6,$7)', [actor, token, environment, transaction, signed, revoked, target])
    const configure = (expected: string | null, next: string) =>
      rpc('save_native_tournament_settings($1,$2,$3,$4,$5)', [owner, event, expected, next, JSON.stringify(settings)])
    const plan = (action = 'read', expected: unknown = null, division: string | null = null,
      match: string | null = null, slot: object | null = null, actor = owner) =>
      rpc('native_tournament_draw_plan($1,$2,$3,$4,$5,$6,$7)', [actor, event, action, expected, division, match, slot])

    await db.exec('set role service_role')
    await rpc('save_native_tournament_draft($1,null,$2,$3)', [owner, event, JSON.stringify(draft)])
    await rpc('prepare_native_tournament($1,$2)', [owner, event])
    expect(await checkout('Production')).toEqual({ state: 'setup' })
    expect(await configure(null, revision)).toMatchObject({ settingsRevision: revision })
    expect(await checkout('Production', 'status', null, null, cancelKey, other)).toEqual({ code: 'missing' })
    expect(await checkout('Production', 'prepare', canceled, other)).toEqual({ code: 'stale' })
    expect(await checkout('Production', 'prepare', canceled)).toMatchObject({ state: 'pending', start: true })
    expect(await checkout('Production', 'cancel', canceled, null, other)).toMatchObject({ state: 'pending' })
    expect(await checkout('Production', 'cancel', canceled)).toEqual({ state: 'ready' })
    expect(await settle(canceled, 'Production', '3')).toEqual({ code: 'conflict' })

    expect(await checkout('Sandbox', 'prepare', sandbox)).toMatchObject({ start: true })
    expect(await settle(sandbox, 'Sandbox', '1')).toMatchObject({ state: 'paid', publicId: null })
    expect(await plan()).toEqual({ code: 'missing' })
    await db.exec('reset role')
    expect((await db.query('select id from tiq_tournaments')).rows).toEqual([])
    await db.exec('set role service_role')
    expect(await checkout('Production', 'prepare', production)).toMatchObject({ start: true, token: production })
    expect(await checkout('Production', 'prepare', canceled)).toEqual({ state: 'pending', token: production, publicId: null })
    await expect(configure(revision, canceled)).rejects.toThrow(/locked/)
    expect(await settle(production, 'Production', '1', false, undefined, other)).toEqual({ code: 'missing' })
    expect(await settle(production, 'Production', '1', false, undefined, owner, other)).toEqual({ code: 'missing' })
    const paid = await settle(production, 'Production', '1', false, undefined, null, null)
    expect(paid).toMatchObject({ state: 'paid', publicId: expect.stringMatching(/^tiq-native-event-/) })
    expect(await settle(production, 'Production', '1')).toEqual(paid)
    expect(await checkout('Production', 'prepare', canceled)).toEqual(paid)
    expect(await rpc('native_tournament_setup($1,$2)', [owner, event])).toMatchObject({ publicId: paid.publicId })
    expect(await plan('read', null, null, null, null, other)).toEqual({ code: 'missing' })
    await db.exec('reset role')
    const rows = (await db.query(`select name, event_id, status, entrant_type, entrants, is_public
      from tiq_tournaments order by name`)).rows
    expect(rows).toEqual([
      { name: 'Northside Open', event_id: null, status: 'open', entrant_type: 'players', entrants: [], is_public: true },
      { name: 'Open Doubles', event_id: paid.publicId, status: 'open', entrant_type: 'teams', entrants: [], is_public: true },
      { name: 'Open Singles', event_id: paid.publicId, status: 'open', entrant_type: 'players', entrants: [], is_public: true },
    ])
    const division = (await db.query<{id: string}>(`select id from tiq_tournaments where name='Open Singles'`)).rows[0].id
    await db.exec('set role authenticated')
    await expect(checkout('Production')).rejects.toThrow(/permission denied/)
    await expect(plan()).rejects.toThrow(/permission denied/)
    await expect(db.query(`insert into tiq_tournaments (id,name,created_by_user_id,updated_by_user_id)
      values ('tiq-native-event-spoof','Spoof',auth.uid(),auth.uid())`)).rejects.toThrow(/row-level security/)
    expect(await rpc('save_tiq_event_registration($1,$2)', [paid.publicId, JSON.stringify({
      tournament_id: division, player_one: 'Morgan Serve', status: 'confirmed', fee_cents: 0, paid_cents: 0,
    })])).toMatchObject({ status: 'confirmed' })
    await db.exec('reset role')
    expect((await db.query('select entrants from tiq_tournaments where id=$1', [division])).rows).toEqual([{ entrants: ['Morgan Serve'] }])
    expect(await plan('publish', (await plan()).revision, division)).toEqual({ code: 'review' })
    await db.query(`update tiq_tournaments set entrants=array_append(entrants, 'Casey Court') where id=$1`, [division])
    const addPending = (name: string, format: object, actor: string | null, target = division) => db.query(`insert into public.tiq_tournament_entries
      (tournament_id,player_name,native_registration,submitted_by_user_id) values ($1,$2,$3,$4)`,
      [target, name, format, actor])
    const approve = async (target: string, name: string, actor: string) => {
      await addPending(name, {version:'1'}, actor, target)
      await db.query("update tiq_tournament_entries set status='approved' where tournament_id=$1 and player_name=$2", [target,name])
    }
    await expect(addPending('Anonymous request', {}, null)).rejects.toThrow(/TenAceIQ app/)
    await addPending('Riley Return', {version: '1'}, other)
    const pending = await plan()
    expect(pending).toMatchObject({ divisions: expect.arrayContaining([{ id: division, status: 'open', pending: 1,
      name: 'Open Singles', format: 'single_elimination', entrants: ['Morgan Serve', 'Casey Court'], schedule: {}, results: {} }]) })
    expect(await plan('publish', pending.revision, division)).toEqual({ code: 'review' })
    await db.query(`update tiq_tournament_entries set status='declined' where tournament_id=$1 and status='pending'`, [division])
    expect(await plan('publish', pending.revision, division)).toEqual({ code: 'stale' })
    await approve(division, 'Casey Court', other)
    const published = await plan('publish', (await plan()).revision, division)
    const slot = { date: settings.registrationClosesOn, time: '13:00', court: 'Court 2' }
    expect(await plan('slot', published.revision, division, 'r1-m1', slot)).toEqual({ code: 'invalid' })
    slot.date = draft.date
    const saved = await plan('slot', published.revision, division, 'r1-m1', slot)
    expect(saved).toMatchObject({ divisions: expect.arrayContaining([expect.objectContaining({
      id: division, status: 'scheduled', schedule: { 'r1-m1': slot },
    })]) })
    expect(await plan('slot', published.revision, division, 'r1-m1', { ...slot, court: '3' })).toEqual({ code: 'stale' })
    const cleared = await plan('slot', saved.revision, division, 'r1-m1')
    expect(cleared).toMatchObject({ divisions: expect.arrayContaining([expect.objectContaining({id: division, status: 'scheduled', schedule: {} })]) })
    await expect(addPending('Late request', {version: '1'}, other)).rejects.toThrow(/Entries are closed/)
    await expect(db.query("update tiq_tournaments set entrants = array['Riley Return','Morgan Serve'] where id=$1", [division])).rejects.toThrow(/draw is published/)
    const rootStatus = async () => (await db.query('select status from tiq_tournaments where id=$1', [paid.publicId])).rows
    expect(await rootStatus()).toEqual([{ status: 'open' }])
    const doubles = (await db.query<{id: string}>(`update tiq_tournaments set entrants=array['Morgan Serve / Alex Ace','Casey Court / Drew Drop']
      where name='Open Doubles' returning id`)).rows[0].id
    await approve(doubles, 'Morgan Serve / Alex Ace', other)
    await approve(doubles, 'Casey Court / Drew Drop', stranger)
    expect(await plan('publish', (await plan()).revision, doubles)).toMatchObject({
      divisions: expect.arrayContaining([expect.objectContaining({id: doubles, status: 'scheduled'})]),
    })
    expect(await rootStatus()).toEqual([{ status: 'scheduled' }])
    const resultRevision = (await plan()).revision
    const singlesWinner = {sideA:'Morgan Serve',sideB:'Casey Court',winner:'Casey Court',score:'4-6, 4-6',outcome:'played'}
    const saveResult = (target: string, version: unknown, result: object, actor = owner) =>
      rpc('native_tournament_save_result($1,$2,$3,$4,$5,$6,$7)', [actor, event, version, target, 'r1-m1', result, true])
    await db.exec('set role authenticated')
    await expect(saveResult(division, resultRevision, singlesWinner)).rejects.toThrow(/permission denied/)
    await db.exec('set role service_role')
    expect(await saveResult(division, resultRevision, singlesWinner, other)).toEqual({code:'missing'})
    expect(await saveResult(division, resultRevision, {...singlesWinner,winner:'Unlisted Player'})).toEqual({code:'not_ready'})
    const signed = await saveResult(division, resultRevision, singlesWinner)
    expect(signed).toMatchObject({divisions: expect.arrayContaining([expect.objectContaining({
      id: division, status:'completed', results:{'r1-m1':expect.objectContaining(singlesWinner)},
    })])})
    expect(await saveResult(division, resultRevision, {...singlesWinner,score:'2-6, 4-6'})).toEqual({code:'stale'})
    expect(await plan('slot', signed.revision, division, 'r1-m1', slot)).toEqual({code:'closed'})
    const second = {sideA:'Morgan Serve / Alex Ace',sideB:'Casey Court / Drew Drop',winner:'Morgan Serve / Alex Ace',
      outcome:'walkover',score:''}
    expect(await saveResult(doubles, signed.revision, {...second,score:'6-0, 6-0'})).toEqual({code:'invalid'})
    const complete = await saveResult(doubles, signed.revision, second)
    expect(complete).toMatchObject({divisions: expect.arrayContaining([expect.objectContaining({
      id: doubles, status:'completed', results:{'r1-m1':expect.objectContaining(second)},
    })])})
    await db.exec('reset role')
    expect(await rootStatus()).toEqual([{status:'completed'}])
    const title = (target: string, action = 'read', version: unknown = null, champion: string | null = null,
      awardId: unknown = null, actor = owner) =>
      rpc('native_tournament_title($1,$2,$3,$4,$5,$6,$7)', [actor,event,target,action,version,champion,awardId])
    const trophies = (actor: string) => rpc('native_tournament_account_trophies($1)', [actor])
    const claim = (actor: string, code: unknown) => rpc('claim_native_tournament_trophy($1,$2)', [actor,code])
    await db.exec('set role authenticated')
    await expect(trophies(other)).rejects.toThrow(/permission denied/)
    await db.exec('set role service_role')
    expect(await title(division, 'read', null, null, null, stranger)).toEqual({code:'missing'})
    expect(await title(division, 'award', published.revision, 'Casey Court')).toEqual({code:'stale'})
    const singlesTitle = await title(division, 'award', complete.revision, 'Casey Court')
    expect(singlesTitle).toMatchObject({award:{champion:'Casey Court',paired:false,partnerCode:null}})
    expect(await title(division, 'award', complete.revision, 'Casey Court')).toEqual(singlesTitle)
    const doublesTitle = await title(doubles, 'award', complete.revision, 'Morgan Serve / Alex Ace')
    const award = doublesTitle.award as {id:string; partnerCode:string}
    expect(award.partnerCode).toMatch(/^[a-f0-9-]{36}$/)
    expect(await trophies(other)).toMatchObject([{division:'Open Doubles',placement:'first'}, {division:'Open Singles',placement:'first'}])
    expect(await trophies(stranger)).toEqual([])
    expect(await claim(stranger, award.partnerCode)).toBeNull()
    expect(await claim(other, award.partnerCode)).toBeNull()
    expect(await claim(partner, award.partnerCode)).toBe(award.id)
    expect(await claim(partner, award.partnerCode)).toBe(award.id)
    expect(await title(doubles)).toMatchObject({award:{partnerClaimed:true,partnerCode:null}})
    expect(await trophies(partner)).toMatchObject([{id:'tiq-title-'+award.id,division:'Open Doubles'}])
    await expect(saveResult(doubles, complete.revision, {...second,winner:second.sideB})).rejects.toThrow(/trophy_locked/)
    const correction = await saveResult(division, complete.revision, {...singlesWinner,score:'2-6, 4-6'})
    expect(correction).toMatchObject({divisions:expect.arrayContaining([expect.objectContaining({id:division,status:'completed'})])})
    expect(await title(doubles, 'withdraw', null, null, award.id)).toEqual({award:null})
    expect(await claim(partner, award.partnerCode)).toBeNull()
    expect(await trophies(partner)).toEqual([])
    await db.exec('reset role')
    const refunded = await settle(production, 'Production', '1', true, '2026-11-15T00:00:00Z')
    expect(refunded).toMatchObject({ state: 'refunded', publicId: paid.publicId })
    expect(await settle(production, 'Production', '1')).toEqual(refunded)
    expect(await plan()).toEqual({ code: 'missing' })
    expect(await trophies(other)).toEqual([])
    expect((await db.query('select id from tiq_tournaments where is_public')).rows).toEqual([])
    expect(await settle(production, 'Production', '1', false, '2026-11-16T00:00:00Z')).toEqual(paid)
    expect((await db.query('select id from tiq_tournaments where is_public')).rows).toHaveLength(3)
  } finally {
    await db.close()
  }
}, 30000)
