import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'
import { reviewedRevisionDigest } from '../first-party-revisions'
import { mergeAttestedLeagueMatches } from '../native-league-schedule'
import type { OfficeDetail } from '../native-league-office-contract'

const uuid = (n: number) => '11111111-1111-4111-8111-' + String(n).padStart(12, '0')
const [coordinator, captain, player, contact, unrelated, a, b, c, d, venue] = Array.from({length:10},(_,i)=>uuid(i+1))
const version = '2026-11-12T16:00:00Z'

it('publishes and moves the same match, checks court and participant overlaps, and sends one scoped in-app update', async () => {
  const db = new PGlite()
  try {
    await db.exec(await readFile('lib/__tests__/fixtures/account-erasure-audited-schema.sql', 'utf8'))
    await db.exec(`
      create schema private;
      grant usage on schema private to authenticated;
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      create table public.account_deletion_requests(account_id uuid, status text);
      create table public.native_captain_court_results(fixture_id uuid);
      create view public.native_first_party_updates with (security_invoker=true) as
        select id,recipient_profile_id,notification_type,title,body,href,conversation_id,schedule_event_id,read_at,created_at
        from public.internal_notifications where false;
      grant select on public.native_first_party_updates, public.internal_notifications to authenticated;
    `)
    await db.exec(await readFile('supabase/migrations/20261113000400_native_first_party_league_schedule.sql', 'utf8'))
    await db.exec(`
      create function public.fixture_clock() returns trigger language plpgsql as $$begin new.updated_at=clock_timestamp();return new;end$$;
      create trigger fixture_clock before update on public.tiq_league_schedule_items for each row execute function public.fixture_clock();
    `)
    for (const id of [coordinator,captain,player,contact,unrelated]) {
      await db.query("insert into auth.users(id,email) values($1,$2)",[id,id+'@example.test'])
      await db.query("insert into profiles(id,email,role) values($1,$2,$3)",[id,id+'@example.test',id===coordinator?'admin':'member'])
    }
    await db.query(`insert into tiq_leagues (id,created_by_user_id,is_public,league_name,league_format,
      season_status,starts_on,ends_on,max_match_events,default_facility,default_match_time,updated_at)
      values ('demo',$1,true,'City League','team','active',current_date,current_date+10,20,'Court Club','18:00',$2),
      ('singles',$1,true,'Singles League','individual','active',current_date,current_date+10,20,'Court Club','18:00',$2)`, [coordinator,version])
    await db.query(`insert into tiq_team_league_entries(id,league_id,team_name,entry_status,created_by_user_id) values
      ($1,'demo','Aces','active',$5),($2,'demo','Rallies','active',$6),($3,'demo','Servers','active',$7),($4,'demo','Returners','active',$7)`,
      [a,b,c,d,contact,player,unrelated])
    await db.query(`insert into team_profile_links(profile_user_id,team_name,league_name,source_type,source_record_id,status,team_roles) values
      ($1,'Aces','City League','tiq_entry',$2,'accepted',array['captain']),
      ($3,'Aces','Other League','tiq_entry',$2,'accepted',array['captain'])`, [captain,a,unrelated])
    await db.query("insert into calendar_venue_directory(id,facility_name,name_keys,street_address,city,state_code) values($1,'Court Club',array['court club'],'123 Main St','St. Louis','MO')",[venue])
    const date = (await db.query<{date:string}>('select (current_date+3)::text as date')).rows[0].date
    const earlier = (await db.query<{date:string}>('select (current_date+2)::text as date')).rows[0].date
    const call = async (request: number, time = '18:00', params: {match?:string;version?:string;a?:string;b?:string;court?:string;actor?:string;notify?:boolean;league?:string} = {}) =>
      (await db.query<{result: {code:string;match:{id:string;time:string;facility:string}}}>(`select
        public.native_first_party_save_league_match($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,90,$13) as result`,
        [params.actor??coordinator,params.league??'demo',version,uuid(request),params.match??null,params.version??null,
          params.a??a,params.b??b,date,time,venue,params.court??'3',params.notify??true])).rows[0].result
    const review = async (league='demo') => (await db.query<{result: {matches: {id:string;version:string}[]}}>(
      "select public.native_first_party_league_schedule_review($1,$2,$3) as result",[coordinator,league,version])).rows[0].result
    const inbox = async (owner: string) => {
      await db.exec('reset role; set role authenticated')
      await db.query("select set_config('request.jwt.claim.sub',$1,false)",[owner])
      const result = await db.query('select title,body,href from native_first_party_updates order by title')
      await db.exec('reset role')
      return result.rows
    }
    await db.exec('set role authenticated')
    await expect(call(50)).rejects.toMatchObject({code:'42501'})
    await db.exec('reset role; set role service_role')
    expect(await call(50,'18:00',{actor:unrelated})).toMatchObject({code:'forbidden'})
    expect(await review()).toMatchObject({defaultTime:'18:00',defaultVenueId:venue,entries:[{id:a},{id:b},{id:d},{id:c}]})
    await db.exec('reset role')
    const original = uuid(19)
    await db.query(`insert into tiq_league_schedule_items (id,league_id,league_format,participant_a_name,participant_b_name,
      scheduled_date,scheduled_time,facility,status) values($1,'demo','team','Aces','Rallies',$2,'17:00','Court Club','confirmed')`,
      [original,earlier])
    const originalVersion = (await review()).matches[0].version
    const moved = await call(51,'18:00',{match:original,version:originalVersion})
    expect(moved).toMatchObject({code:'saved',notified:2,unreachable:0,match:{id:original,time:'18:00',facility:'Court Club · Court 3 — 123 Main St, St. Louis, MO'}})
    expect(await call(51,'18:00',{match:original,version:originalVersion})).toEqual(moved)
    expect(await call(52,'20:00',{match:original,version:originalVersion})).toMatchObject({code:'stale'})
    expect(await call(53,'18:30',{a:c,b:d})).toMatchObject({code:'overlap'})
    expect(await call(54,'18:30',{a,b:c,court:'4'})).toMatchObject({code:'overlap'})
    expect(await call(55,'18:30',{a:c,b:d,court:'4',notify:false})).toMatchObject({code:'saved',notified:0})
    expect(await inbox(captain)).toEqual([expect.objectContaining({title:'League match rescheduled',body:expect.stringContaining('Court 3'),
      href:'/explore/leagues/tiq/demo?scheduledMatch='+original+'#league-schedule'})])
    expect(await inbox(player)).toHaveLength(1)
    expect(await inbox(contact)).toHaveLength(0)
    expect(await inbox(unrelated)).toHaveLength(0)
    const attest = async () => (await db.query<{result: unknown}>(
      "select native_first_party_league_matches('demo',$1) as result",[version])).rows[0].result
    const all = await attest()
    expect(all).toEqual(expect.arrayContaining([
      expect.objectContaining({match:expect.objectContaining({id:original}),original:expect.objectContaining({date:earlier})}),
      expect.objectContaining({original:null}),
    ]))
    const fixtures = (all as {match:OfficeDetail['fixtures'][number]}[]).map(({match:{id,date,time,facility,a,b,status}})=>
      ({id,date,time:time+':00',facility,a,b,status}))
    const context: OfficeDetail = {league:{id:'demo',name:'City League',format:'team',season:'Fall',status:'active',
      flight:'',location:'',startsOn:'',endsOn:'',timeZone:'America/Chicago',updatedAt:version},
      participants:[{name:'Aces',status:'active'}],results:[],
      fixtures,moreFixtures:false,moreParticipants:false,moreResults:false,standingsAvailable:false,standings:[]}
    const baseline = {...context,fixtures:[{id:original,date:earlier,time:'17:00:00',facility:'Court Club',a:'Aces',b:'Rallies',status:'confirmed'}]}
    expect(mergeAttestedLeagueMatches(context,all,reviewedRevisionDigest(baseline))).toMatchObject({fullDetail:true})
    expect(mergeAttestedLeagueMatches({...context,participants:[...context.participants,{name:'Unreviewed',status:'active'}]},all,
      reviewedRevisionDigest(baseline))).toMatchObject({fullDetail:false,publishedSchedule:expect.arrayContaining([expect.objectContaining({id:original})])})
    const newVersion = (await review()).matches.find(match=>match.id===original)!.version
    expect(await call(56,'20:30',{match:original,version:newVersion})).toMatchObject({code:'saved',notified:2,match:{id:original}})
    expect(await inbox(captain)).toEqual([expect.objectContaining({body:expect.stringContaining('8:30 PM')})])
    await db.query("update tiq_league_schedule_items set facility='Unreviewed edit' where id=$1",[original])
    expect(await inbox(captain)).toHaveLength(0)
    expect(await attest()).toHaveLength(1)
    await db.query(`insert into tiq_player_league_entries(id,league_id,player_name,entry_status,created_by_user_id,eligibility_rating_source,
      eligibility_age_division_source,eligibility_mixed_pair_role_source) values
      ($1,'singles','Alex','active',$4,'self','unknown','unknown'),($2,'singles','Drew','active',$5,'self','unknown','unknown'),
      ($3,'singles','Imported','active',$6,'verified','unknown','unknown')`, [a,b,c,captain,player,unrelated])
    await db.query('insert into internal_notification_preferences(profile_id,schedule_alerts_enabled) values ($1,false)',[player])
    expect(await call(57,'18:00',{league:'singles',a:c})).toMatchObject({code:'roster'})
    expect(await call(58,'18:00',{league:'singles'})).toMatchObject({code:'saved',notified:1,unreachable:1})
    expect(await inbox(captain)).toEqual([expect.objectContaining({title:'League match scheduled',body:expect.stringContaining('Alex vs Drew')})])
    expect(await inbox(player)).toHaveLength(0)
  } finally { await db.close() }
}, 45000)
