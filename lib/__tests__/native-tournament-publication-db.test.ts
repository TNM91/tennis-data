import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'
import { nativeTournamentPlan } from '../native-tournament-draw-plan'
import { tournamentTitleContenders } from '../native-tournament-trophy'

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
      create schema auth; create schema private; create schema tenaceiq_private;
      create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
      create table public.account_deletion_requests(account_id uuid, automatic_consent boolean,status text);
      create function auth.uid() returns uuid language sql stable as $$
        select coalesce(nullif(current_setting('request.jwt.claim.sub',true),'')::uuid, '${owner}'::uuid)
      $$;
      create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, role text not null default 'member');
      create table public.internal_conversations(id uuid primary key);
      create table public.internal_schedule_events(id uuid primary key);
      create table public.team_chat_blocks(owner_user_id uuid, blocked_user_id uuid);
      create function public.can_run_club_competition(uuid) returns boolean language sql stable as $$select false$$;
      create function public.has_current_league_access(uuid) returns boolean language sql stable as $$select true$$;
      create function public.has_current_full_court_access(uuid) returns boolean language sql stable as $$select true$$;
      create function public.consume_api_rate_limit(text,text,integer,integer) returns boolean language sql as $$select true$$;
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
      add column native_registration jsonb not null default '{}'::jsonb,
      add column eligibility_rating numeric,
      add column eligibility_rating_source text,
      add column eligibility_status text,
      add column eligibility_review_note text,
      add column eligibility_reviewed_by uuid,
      add column eligibility_reviewed_at timestamptz,
      add column player_action_required boolean not null default false`)
    const receiptsMigration = await readFile(new URL('../../supabase/migrations/20261030000100_native_tournament_registration.sql', import.meta.url), 'utf8')
    await db.exec(receiptsMigration.slice(receiptsMigration.indexOf('create function public.native_tournament_entry_receipt'),
      receiptsMigration.indexOf("notify pgrst")))
    await migration('20261112000800_native_first_party_tournament_entry')
    await migration('20261113000100_native_testflight_tournament')
    await migration('20261114001200_native_tournament_drafts')
    await migration('20261114001300_native_tournament_desk')
    await migration('20261114001400_native_tournament_setup_settings')
    await migration('20261114001500_native_tournament_publication')
    await migration('20261114001600_native_tournament_draw_plan')
    await migration('20261114001700_native_tournament_results')
    await migration('20261114001800_native_tournament_trophies')
    await migration('20261115000100_private_tournament_trophy_rehearsal')
    await migration('20261115000200_tournament_checkout_cancellation')
    await migration('20260507224500_create_internal_notifications')
    await db.exec(`create view public.native_first_party_updates with (security_invoker=true) as
      select id,recipient_profile_id,notification_type,title,body,href,conversation_id,schedule_event_id,read_at,created_at
      from public.internal_notifications where false;
      grant select on public.profiles,public.internal_notifications,public.native_first_party_updates to authenticated;
      grant update (read_at) on public.internal_notifications to authenticated;`)
    const inboxMigration = await readFile(new URL('../../supabase/migrations/20261110000100_native_first_party_updates.sql', import.meta.url), 'utf8')
    await db.exec(inboxMigration.slice(inboxMigration.indexOf('create or replace function public.native_first_party_mark_updates_read'),
      inboxMigration.indexOf("notify pgrst")))
    await migration('20261115000300_native_tournament_schedule_updates')
    await migration('20261115000400_private_tournament_alert_rehearsal')
    await migration('20261115001400_private_tournament_walkthrough')
    await db.query('insert into auth.users values ($1,now()),($2,now()),($3,now()),($4,now())', [owner, other, partner, stranger])
    await db.exec('insert into public.profiles(id) select id from auth.users')
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
    const abandoned = '20000000-0000-4000-8000-000000000001'
    expect(await checkout('Sandbox', 'cancel', abandoned)).toEqual({ state: 'ready' })
    expect(await checkout('Sandbox', 'prepare', abandoned)).toEqual({ state: 'ready' })
    expect(await checkout('Sandbox', 'prepare', abandoned, revision, other)).toEqual({ code: 'conflict' })
    expect(await settle(abandoned, 'Sandbox', '314')).toEqual({ code: 'conflict' })
    expect(await checkout('Sandbox')).toEqual({ state: 'ready' })
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
    await approve(division, 'Morgan Serve', partner)
    const published = await plan('publish', (await plan()).revision, division)
    const slot = { date: settings.registrationClosesOn, time: '13:00', court: 'Court 2' }
    expect(await plan('slot', published.revision, division, 'r1-m1', slot)).toEqual({ code: 'invalid' })
    slot.date = draft.date
    const saveSlot = (expected: unknown, next: object | null, rescheduled: boolean, actor = owner) =>
      rpc('native_tournament_save_slot($1,$2,$3,$4,$5,$6,$7,$8)',
        [actor, event, expected, division, 'r1-m1', next, ['Morgan Serve','Casey Court'], rescheduled])
    const withRecipient = async <T>(recipient: string, read: () => Promise<T>) => {
      await db.exec('set role authenticated')
      await db.query("select set_config('request.jwt.claim.sub',$1,false)", [recipient])
      try { return await read() }
      finally {
        await db.exec("reset role; select set_config('request.jwt.claim.sub','',false)")
      }
    }
    const updates = (recipient: string) => withRecipient(recipient, async () =>
      (await db.query<{id:string}>('select id,title,body,href from public.native_first_party_updates')).rows)
    await db.exec('set role authenticated')
    await expect(saveSlot(published.revision,slot,false)).rejects.toThrow(/permission denied/)
    await db.exec('reset role')
    expect(await saveSlot(published.revision,slot,false,other)).toEqual({code:'missing'})
    const saved = await saveSlot(published.revision,slot,false)
    expect(saved).toMatchObject({ divisions: expect.arrayContaining([expect.objectContaining({
      id: division, status: 'scheduled', schedule: { 'r1-m1': slot },
    })]) })
    const scheduled = await updates(other)
    expect(scheduled).toEqual([expect.objectContaining({title:'Tournament match scheduled',
      body:expect.stringContaining('1:00 PM (America/Chicago) · Court 2'),
      href:expect.stringMatching(/&match=r1-m1&entry=[a-f0-9-]{36}#tournament-schedule$/)})])
    expect(await updates(partner)).toHaveLength(1)
    expect(await updates(owner)).toEqual([])
    expect(await updates(stranger)).toEqual([])
    const markRead = (recipient:string) => withRecipient(recipient, async () =>
      (await db.query('select id,recipient_profile_id,read_at from public.native_first_party_mark_updates_read($1::uuid[])',
        [[scheduled[0].id]])).rows)
    await expect(markRead(stranger)).rejects.toThrow(/Updates changed/)
    expect(await markRead(other)).toEqual([expect.objectContaining({id:scheduled[0].id,recipient_profile_id:other,read_at:expect.any(Date)})])
    expect(await saveSlot(saved.revision,slot,true)).toEqual(saved)
    expect(await updates(other)).toEqual(scheduled)
    const moved = {...slot,time:'14:30',court:'Court 3'}
    expect(await saveSlot(published.revision,moved,true)).toEqual({code:'stale'})
    const rescheduled = await saveSlot(saved.revision,moved,true)
    expect(await updates(other)).toEqual([expect.objectContaining({title:'Tournament match rescheduled',
      body:expect.stringContaining('2:30 PM (America/Chicago) · Court 3')})])
    await db.query('insert into public.team_chat_blocks values ($1,$2)', [partner,owner])
    expect(await updates(partner)).toEqual([])
    const cleared = await saveSlot(rescheduled.revision,null,true)
    expect(cleared).toMatchObject({ divisions: expect.arrayContaining([expect.objectContaining({id: division, status: 'scheduled', schedule: {} })]) })
    expect(await updates(other)).toEqual([expect.objectContaining({title:'Tournament court time cleared',
      body:expect.stringContaining('New time to be confirmed')})])
    expect(await updates(partner)).toEqual([])
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

    const testEvent = '74697166-6c74-4e10-8f11-000000000001'
    const testRoot = `tiq-native-event-${testEvent}`
    const testDivision = `tiq-native-division-${testEvent}`
    const testChampion = 'Demo Avery / Demo Robin'
    const testOpponent = 'Demo Casey / Demo Morgan'
    const testResults = { 'r1-m1': { winner:testChampion, sideA:testChampion, sideB:testOpponent, score:'6-3, 6-4' } }
    await db.query(`insert into public.tiq_tournaments(id,name,status,is_event,created_by_user_id,starts_on,event_details)
      values ($1,'TestFlight Rehearsal','completed',true,$2,'2099-06-06','{"timeZone":"America/Chicago"}')`, [testRoot,owner])
    await db.query(`insert into public.tiq_tournaments(id,event_id,name,status,entrant_type,created_by_user_id,entrants,results)
      values ($1,$2,'Doubles','completed','teams',$3,$4,$5)`, [testDivision,testRoot,owner,[testChampion,testOpponent],JSON.stringify(testResults)])
    await db.query(`insert into private.native_tournament_setups(owner_id,id,draft,settings,settings_revision) values ($1,$2,$3,$4,$5)`,
      [owner,testEvent,JSON.stringify(draft),JSON.stringify(settings),revision])
    await db.query(`insert into private.native_tournament_rehearsals(owner_id,event_id,event_key,winner_id,partner_id,expires_at)
      values ($1,$2,$3,$4,$5,statement_timestamp() + interval '1 hour')`, [owner,testEvent,testRoot,other,partner])
    await db.query(`insert into public.tiq_tournament_entries(tournament_id,player_name,status,submitted_by_user_id,native_registration)
      values ($1,$2,'approved',$3,'{"version":1}')`, [testDivision,testChampion,other])
    await expect(db.query(`update public.tiq_tournaments set is_public=true where id=$1`, [testRoot])).rejects.toThrow(/rehearsals_are_private/)
    await db.exec('set role service_role')
    const testSetup = (actor: string) => rpc('native_tournament_setup($1,$2)', [actor,testEvent])
    const testPlan = (actor: string, action = 'read') => rpc('native_tournament_draw_plan($1,$2,$3)', [actor,testEvent,action])
    const testTitle = (actor: string, action = 'read', version: unknown = null, champion: string | null = null) =>
      rpc('native_tournament_title($1,$2,$3,$4,$5,$6)', [actor,testEvent,testDivision,action,version,champion])
    expect(await testSetup(owner)).toMatchObject({publicId:testRoot})
    expect(await testSetup(other)).toBeNull()
    expect(await testPlan(stranger)).toEqual({code:'missing'})
    expect(await testPlan(owner,'publish')).toEqual({code:'missing'})
    expect(await testTitle(stranger)).toEqual({code:'missing'})
    expect(await rpc('native_tournament_checkout($1,$2,$3,$4)', [owner,testEvent,'Sandbox','status'])).toEqual({code:'missing'})
    const snapshot = await testPlan(owner) as unknown as Parameters<typeof nativeTournamentPlan>[0]
    expect(nativeTournamentPlan(snapshot).plan?.matches[0]?.winner).toBe(testChampion)
    expect(tournamentTitleContenders(snapshot.divisions[0])).toEqual([testChampion])
    const testAward = (await testTitle(owner,'award',snapshot.revision,testChampion)).award as {id:string;partnerCode:string}
    expect(await trophies(other)).toContainEqual(expect.objectContaining({id:'tiq-title-' + testAward.id}))
    expect(await trophies(partner)).not.toContainEqual(expect.objectContaining({id:'tiq-title-' + testAward.id}))
    expect(await claim(stranger,testAward.partnerCode)).toBeNull()
    expect(await claim(other,testAward.partnerCode)).toBeNull()
    expect(await claim(partner,testAward.partnerCode)).toBe(testAward.id)
    expect(await trophies(partner)).toContainEqual(expect.objectContaining({id:'tiq-title-' + testAward.id}))
    await db.exec('reset role')
    await db.query(`update private.native_tournament_rehearsals set created_at=statement_timestamp() - interval '2 hours',
      expires_at=statement_timestamp() - interval '1 hour' where event_id=$1`, [testEvent])
    await db.exec('set role service_role')
    expect(await testSetup(owner)).toBeNull()
    expect(await rpc('native_tournament_desk($1)', [owner])).not.toContainEqual(expect.objectContaining({revision:testEvent}))
    expect(await testPlan(owner)).toEqual({code:'missing'})
    expect(await claim(partner,testAward.partnerCode)).toBeNull()
    expect(await trophies(other)).not.toContainEqual(expect.objectContaining({id:'tiq-title-' + testAward.id}))
    expect(await trophies(partner)).not.toContainEqual(expect.objectContaining({id:'tiq-title-' + testAward.id}))

    await db.exec('reset role')
    const alertEvent = '74697166-6c74-4e10-8f11-000000000010'
    const alertRoot = 'tiq-native-event-' + alertEvent
    const alertDivision = 'tiq-native-division-' + alertEvent
    const sides = ['Demo Avery','Demo Casey']
    await db.query(`insert into public.tiq_tournaments(id,name,status,is_event,created_by_user_id,starts_on,event_details)
      values ($1,'TestFlight Court Change','scheduled',true,$2,'2099-06-06','{"timeZone":"America/Chicago"}')`, [alertRoot,owner])
    await db.query(`insert into public.tiq_tournaments(id,event_id,name,status,format,entrant_type,created_by_user_id,entrants)
      values ($1,$2,'Singles','scheduled','single_elimination','players',$3,$4)`, [alertDivision,alertRoot,owner,sides])
    await db.query(`insert into private.native_tournament_setups(owner_id,id,draft,settings,settings_revision) values ($1,$2,$3,$4,$5)`,
      [owner,alertEvent,JSON.stringify(draft),JSON.stringify(settings),revision])
    await db.query(`insert into private.native_tournament_rehearsals(owner_id,event_id,event_key,winner_id,partner_id,expires_at)
      values ($1,$2,$3,$4,$5,statement_timestamp() + interval '1 hour')`, [owner,alertEvent,alertRoot,other,partner])
    await db.query('delete from public.team_chat_blocks where owner_user_id=$1 and blocked_user_id=$2',[partner,owner])
    for (const [name,actor] of [[sides[0],other],[sides[1],partner],[sides[1],stranger]]) {
      await db.query(`insert into public.tiq_tournament_entries(tournament_id,player_name,status,submitted_by_user_id,native_registration)
        values ($1,$2,'approved',$3,jsonb_build_object('version',1,'one',$2::text))`, [alertDivision,name,actor])
    }

    const rehearsalDraw = () => rpc('native_tournament_draw_plan($1,$2)', [owner,alertEvent])
    const rehearsalSave = (version: unknown, court: string, rescheduled = false) =>
      rpc('native_tournament_save_slot($1,$2,$3,$4,$5,$6,$7,$8)',
        [owner,alertEvent,version,alertDivision,'r1-m1',{...slot,court},sides,rescheduled])
    const rehearsalRead = (actor: string, view: string, division = alertDivision) =>
      withRecipient(actor, () => rpc('native_tournament_alert_rehearsal($1,$2,$3)', [alertRoot,division,view]))
    expect(await rehearsalRead(other,'entry')).toBeNull()
    expect(await rehearsalSave((await rehearsalDraw()).revision,'Court 4')).toEqual({code:'missing'})
    await db.query('update private.native_tournament_rehearsals set schedule_enabled=true where event_id=$1',[alertEvent])
    const initial = await rehearsalSave((await rehearsalDraw()).revision,'Court 4')
    const movedRehearsal = await rehearsalSave(initial.revision,'Court 5',true)
    expect(movedRehearsal).toMatchObject({divisions:[expect.objectContaining({schedule:{'r1-m1':{...slot,court:'Court 5'}}})]})
    expect(await updates(other)).toContainEqual(expect.objectContaining({
      title:'Tournament match rescheduled',body:expect.stringContaining('TestFlight Court Change · Singles'),
      href:expect.stringContaining('event=' + alertRoot + '&division=' + alertDivision + '&match=r1-m1'),
    }))
    expect(await updates(partner)).toContainEqual(expect.objectContaining({title:'Tournament match rescheduled'}))
    expect(await updates(stranger)).toEqual([])
    expect(await rehearsalRead(other,'entry')).toMatchObject({
      context:{owner:other,parent:alertRoot,division:alertDivision,mode:'closed'},
      receipt:{name:sides[0],status:'approved',inDraw:true},queue:[],
    })
    expect(await rehearsalRead(partner,'draw')).toMatchObject({
      root:{id:alertRoot,is_public:false},division:{id:alertDivision,is_public:false,schedule:{'r1-m1':{court:'Court 5'}}},
    })
    expect(await rehearsalRead(stranger,'draw')).toBeNull()
    expect(await rehearsalRead(other,'entry',testDivision)).toBeNull()
    expect(await rehearsalRead(owner,'entry')).toBeNull()
    await db.exec('set role anon')
    await expect(rpc('native_tournament_alert_rehearsal($1,$2,$3)',[alertRoot,alertDivision,'draw'])).rejects.toThrow(/permission denied/)
    await db.exec('reset role')
    await expect(db.query('update public.tiq_tournaments set is_public=true where id=$1',[alertRoot])).rejects.toThrow(/rehearsals_are_private/)
    expect((await db.query('update public.tiq_tournaments set is_public=true where id=$1 returning is_public',[alertDivision])).rows)
      .toEqual([{is_public:false}])
    await db.query(`update private.native_tournament_rehearsals set created_at=statement_timestamp() - interval '2 hours',
      expires_at=statement_timestamp() - interval '1 hour' where event_id=$1`, [alertEvent])
    expect(await rehearsalRead(other,'draw')).toBeNull()
    expect(await updates(other)).not.toContainEqual(expect.objectContaining({title:'Tournament match rescheduled'}))
    expect(await rehearsalSave(movedRehearsal.revision,'Court 6',true)).toEqual({code:'missing'})

    const walkthrough = '74697166-6c74-4e10-8f11-000000000020'
    const walkRoot = 'tiq-native-event-' + walkthrough
    const walkDivision = 'tiq-native-division-' + walkthrough
    const opponent = 'Practice Opponent', player = 'Rehearsal Player'
    await db.query(`insert into public.tiq_tournaments(id,name,status,is_event,created_by_user_id,starts_on,event_details)
      values($1,'TestFlight Singles Tournament','open',true,$2,$3,$4)`,
    [walkRoot,owner,draft.date,{timeZone:'America/Chicago',registrationClosesOn:settings.registrationClosesOn}])
    await db.query(`insert into public.tiq_tournaments(id,event_id,name,status,format,entrant_type,created_by_user_id,entrants)
      values($1,$2,'Singles','open','single_elimination','players',$3,array[$4])`,[walkDivision,walkRoot,owner,opponent])
    await db.query(`insert into private.native_tournament_setups(owner_id,id,draft,settings,settings_revision)
      values($1,$2,$3,$4,$5)`,[owner,walkthrough,draft,settings,revision])
    await db.query(`insert into private.native_tournament_rehearsals(owner_id,event_id,event_key,winner_id,expires_at,walkthrough_enabled)
      values($1,$2,$3,$4,statement_timestamp()+interval '1 day',true)`,[owner,walkthrough,walkRoot,other])
    const readWalkthrough = (actor: string, selected = '') =>
      withRecipient(actor,()=>rpc('native_tournament_alert_rehearsal($1,$2,$3)',[walkRoot,selected,'walkthrough']))
    expect(await readWalkthrough(stranger)).toBeNull()
    expect(await readWalkthrough(partner)).toBeNull()
    expect(await readWalkthrough(other,testDivision)).toBeNull()
    const opening = await readWalkthrough(other)
    expect(opening).toMatchObject({viewer:other,root:{id:walkRoot,is_public:false},division:{id:walkDivision,status:'open'}})
    expect(await rpc('native_tournament_desk($1)',[owner])).toContainEqual(expect.objectContaining({revision:walkthrough}))
    const signEntry = async(actor: string,action: string,publication: unknown,data = {}) => {
      await db.exec('set role service_role')
      try {
        return await rpc('native_first_party_tournament_registration($1,$2,$3,$4,$5,$6)',
          [actor,action,walkRoot,walkDivision,publication,data])
      } finally { await db.exec('reset role') }
    }
    const currentEntry = await signEntry(other,'review',opening.publication)
    expect(currentEntry).toMatchObject({ok:true,context:{mode:'native',canManage:false},receipt:null})
    expect(await signEntry(stranger,'review',opening.publication)).toMatchObject({ok:false,status:404})
    expect(await signEntry(other,'queue',opening.publication)).toMatchObject({ok:false,status:403})
    const entry = await signEntry(other,'submit',opening.publication,{
      revision:(currentEntry.context as {revision:string}).revision,one:player,two:'',rating:4,attested:true,
      partnerRating:null,partnerAttested:false,
    })
    expect(entry).toMatchObject({ok:true,receipt:{name:player,status:'pending'}})
    const walkPlan = (actor = owner, action = 'read', expected: unknown = null) =>
      rpc('native_tournament_draw_plan($1,$2,$3,$4,$5)',[actor,walkthrough,action,expected,walkDivision])
    expect(await walkPlan(owner,'publish',(await walkPlan()).revision)).toEqual({code:'review'})
    expect(await walkPlan(other)).toEqual({code:'missing'})
    const queue = await signEntry(owner,'queue',opening.publication)
    const pendingWalkthrough = (queue.queue as {id:string;updatedAt:string}[])[0]
    expect(await signEntry(owner,'decide',opening.publication,{
      revision:(queue.context as {revision:string}).revision,entryId:pendingWalkthrough.id,updatedAt:pendingWalkthrough.updatedAt,
      decision:'approve',note:'Confirmed for the rehearsal.',confirmed:true,
    })).toMatchObject({ok:true,receipt:{status:'approved',inDraw:true}})
    const walkDraw = await walkPlan(owner,'publish',(await walkPlan()).revision)
    expect(walkDraw).toMatchObject({divisions:[{entrants:[opponent,player],status:'scheduled'}]})
    const placed = await rpc('native_tournament_save_slot($1,$2,$3,$4,$5,$6,$7,$8)',
      [owner,walkthrough,walkDraw.revision,walkDivision,'r1-m1',slot,[opponent,player],false])
    expect(placed).toMatchObject({divisions:[{schedule:{'r1-m1':slot}}]})
    expect(await updates(other)).toContainEqual(expect.objectContaining({
      title:'Tournament match scheduled',href:expect.stringContaining('event='+walkRoot),
    }))
    const matchResult = {sideA:opponent,sideB:player,winner:player,score:'4-6, 4-6',outcome:'played'}
    const recordWalkthrough = (actor: string) => rpc('native_tournament_save_result($1,$2,$3,$4,$5,$6,$7)',
      [actor,walkthrough,placed.revision,walkDivision,'r1-m1',matchResult,true])
    expect(await recordWalkthrough(other)).toEqual({code:'missing'})
    const finish = await recordWalkthrough(owner)
    expect(finish).toMatchObject({divisions:[{status:'completed',results:{'r1-m1':expect.objectContaining(matchResult)}}]})
    expect(await readWalkthrough(other,walkDivision)).toMatchObject({division:{status:'completed',results:{'r1-m1':{winner:player}}}})
    const walkTitle = await rpc('native_tournament_title($1,$2,$3,$4,$5,$6)',[owner,walkthrough,walkDivision,'award',finish.revision,player])
    expect(walkTitle).toMatchObject({award:{champion:player,paired:false,partnerCode:null}})
    const walkTrophy = 'tiq-title-' + (walkTitle.award as {id:string}).id
    expect(await trophies(other)).toContainEqual(expect.objectContaining({id:walkTrophy}))
    expect(await trophies(stranger)).not.toContainEqual(expect.objectContaining({id:walkTrophy}))
    expect(await rpc('native_tournament_checkout($1,$2,$3,$4)',[owner,walkthrough,'Production','status'])).toEqual({code:'missing'})
  } finally {
    await db.close()
  }
}, 30000)
