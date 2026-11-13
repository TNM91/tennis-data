import { PGlite } from '@electric-sql/pglite'
import { readFile } from 'node:fs/promises'
import { expect, it } from 'vitest'
import { beforeApprovedLeagueScores, standingsFromLeagueScores } from '../native-league-score-public'
import { leagueScoreLine } from '../native-league-score-contract'
import type { OfficeResult } from '../native-league-office-contract'

const id = (n: number) => '33333333-3333-4333-8333-' + String(n).padStart(12, '0')
const [director, captain, stranger, entry, fixture, future, older, cancelled, posted, otherCaptain, otherEntry, today] =
  Array.from({ length: 12 }, (_, i) => id(i + 1))
const version = '2026-11-13T12:00:00Z'
const first = [leagueScoreLine('singles', '6-4, 6-3')]
const corrected = [leagueScoreLine('singles', '4-6, 3-6')]

it('keeps pending scores private, returns corrections, and posts one official result with updated standings', async () => {
  const db = new PGlite()
  try {
    await db.exec(await readFile('lib/__tests__/fixtures/account-erasure-audited-schema.sql', 'utf8'))
    await db.exec(`
      create schema private;
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      create table public.account_deletion_requests(account_id uuid,status text);
      create table public.native_captain_court_results(fixture_id uuid);
      create view public.native_first_party_updates as
        select id,recipient_profile_id,notification_type,title,body,href,conversation_id,schedule_event_id,read_at,created_at
        from public.internal_notifications where false;
      grant usage on schema private to authenticated;
      grant select on public.native_first_party_updates, public.internal_notifications to authenticated;
    `)
    await db.exec(await readFile('supabase/migrations/20260507174500_link_tiq_schedule_items_to_results.sql', 'utf8'))
    await db.exec(await readFile('supabase/migrations/20261113000400_native_first_party_league_schedule.sql', 'utf8'))
    await db.exec(await readFile('supabase/migrations/20261113000600_native_league_score_review.sql', 'utf8'))
    await db.exec(await readFile('supabase/migrations/20261113000700_native_league_score_outcomes.sql', 'utf8'))
    await db.exec(await readFile('supabase/migrations/20261113000800_native_league_match_day.sql', 'utf8'))
    await db.exec(await readFile('supabase/migrations/20261113000900_native_league_score_attention.sql', 'utf8'))
    for (const owner of [director, captain, stranger, otherCaptain]) {
      await db.query('insert into auth.users(id,email) values($1,$2)', [owner, owner+'@example.test'])
      await db.query('insert into profiles(id,email,role) values($1,$2,$3)', [owner, owner+'@example.test', owner===director?'admin':'member'])
    }
    await db.query(`insert into tiq_leagues(id,created_by_user_id,league_name,league_format,season_status,is_public,updated_at,max_match_events)
      values('demo',$1,'City League','team','active',true,$2,20)`, [director, version])
    await db.query(`insert into tiq_team_league_entries(id,league_id,team_name,entry_status,created_by_user_id)
      values($1,'demo','Aces','active',$2),($3,'demo','Rallies','active',$4)`, [entry,captain,otherEntry,otherCaptain])
    await db.query(`insert into team_profile_links(profile_user_id,team_name,league_name,source_type,source_record_id,status,team_roles)
      values($1,'Aces','City League','manual_invite',null,'accepted',array['captain'])`, [stranger])
    await db.query(`insert into tiq_league_schedule_items(id,league_id,league_format,participant_a_name,participant_b_name,
      participant_a_id,participant_b_id,scheduled_date,scheduled_time,status,updated_at)
      values($1,'demo','team','Aces','Rallies',$3,$5,(now() at time zone 'America/Chicago')::date-1,'18:00','coordinator_set',$4),
            ($2,'demo','team','Aces','Rallies',$3,$5,current_date+2,'18:00','coordinator_set',$4),
            ($6,'demo','team','Aces','Rallies',$3,$5,current_date-5,'18:00','coordinator_set',$4),
            ($7,'demo','team','Aces','Rallies',$3,$5,current_date-6,'18:00','cancelled',$4),
            ($8,'demo','team','Aces','Rallies',$3,$5,current_date-7,'18:00','coordinator_set',$4),
            ($9,'demo','team','Aces','Rallies',$3,$5,(now() at time zone 'America/Chicago')::date,'00:00','coordinator_set',$4)`,
      [fixture,future,entry,version,otherEntry,older,cancelled,posted,today])
    // A site-entered official match can predate schedule linkage.
    await db.exec(`insert into tiq_team_league_match_events(league_id,team_a_name,team_b_name,match_date)
      values('demo','Rallies','Aces',current_date-7)`)
    const save = async (actor:string, action:string, request:number, revision:string|null, lines:unknown = [], note='', match=fixture, canCaptain=actor!==director) => {
      const result = await db.query<{ result: unknown }>(`select native_league_save_score(
        $1,'demo',$2,$3,$2,$4,$5,$6,$7,$8,$9,null,null) as result`, [actor,version,match,revision,id(request),action,JSON.stringify(lines),note,canCaptain])
      return result.rows[0].result
    }
    const review = async (actor:string, match:string|null) => (await db.query<{ result: unknown }>(
      "select native_league_score_review($1,'demo',$2,$3,$4,null,null) as result", [actor,version,match,actor!==director])).rows[0].result
    const published = async () => (await db.query<{ result: OfficeResult[] }>(
      "select native_league_approved_results('demo',$1) as result", [version])).rows[0].result
    const matchDay=async(actor:string|null,access:boolean,matches=[fixture,future],league='demo')=>
      (await db.query<{result:unknown}>(
        "select native_league_match_day($1,$2,$3::uuid[],$4,$5,'{}') as result",
        [league,version,matches,actor,access],
      )).rows[0].result
    type AttentionRow = { id: string; fixture: object; fixtureDigest: string; revision: string | null; note: string }
    const attention = async (actor=director, league='demo', matches=[fixture,older,future,today,cancelled,posted]) =>
      (await db.query<{ result: AttentionRow[] | null }>(
        'select native_league_score_attention($1,$2,$3::uuid[],$4) as result', [league,version,matches,actor],
      )).rows[0].result
    const remind = async (actor:string, row:AttentionRow, league='demo') => (await db.query<{ result: unknown }>(
      'select native_league_remind_score($1,$2,$3,$4,$5,$6,null,null,$7) as result',
      [actor,league,version,row.id,row.fixtureDigest,row.revision,JSON.stringify(row.fixture)],
    )).rows[0].result
    const updates = async (actor:string) => {
      await db.exec('reset role; set role authenticated')
      try {
        await db.query("select set_config('request.jwt.claim.sub',$1,false)", [actor])
        return (await db.query('select title,href from native_first_party_updates')).rows
      } finally { await db.exec('reset role; set role service_role') }
    }
    const href = '/explore/leagues/tiq/demo?scoreMatch='+fixture+'#league-scores'
    const olderHref = '/explore/leagues/tiq/demo?scoreMatch='+older+'#league-scores'
    await db.exec('set role authenticated')
    await expect(review(captain,fixture)).rejects.toMatchObject({code:'42501'})
    await expect(matchDay(captain,true)).rejects.toMatchObject({code:'42501'})
    await expect(attention()).rejects.toMatchObject({code:'42501'})
    await expect(remind(director,{id:fixture,fixtureDigest:'a'.repeat(64),revision:null,note:'',fixture:{}})).rejects.toMatchObject({code:'42501'})
    await db.exec('reset role; set role service_role')
    expect(await matchDay(captain,true,[fixture])).toMatchObject({matches:[{id:fixture,action:'enter'}],canReview:false})
    expect(await matchDay(stranger,true)).toEqual({matches:[],canReview:false})
    expect(await review(stranger,fixture)).toBeNull()
    expect(await save(stranger,'submit',19,null,first)).toEqual({code:'forbidden'})
    expect(await save(captain,'submit',19,null,first,'',fixture,false)).toEqual({code:'forbidden'})
    expect(await save(captain,'submit',19,null,first,'',future)).toEqual({code:'early'})
    const [olderRow, missing] = (await attention())!
    expect([olderRow, missing]).toMatchObject([{id:older,revision:null},{id:fixture,revision:null}])
    expect(await attention(captain)).toBeNull()
    expect(await attention(stranger)).toBeNull()
    expect(await remind(captain,olderRow)).toEqual({code:'forbidden'})
    expect(await remind(director,{...olderRow,fixtureDigest:'a'.repeat(64)})).toEqual({code:'stale'})
    expect(await Promise.all([remind(director,olderRow),remind(director,olderRow)])).toMatchObject([
      {code:'sent',count:2},{code:'recent'},
    ])
    const missingNotice = {title:'League score reminder',href:olderHref}
    expect(await updates(captain)).toEqual([missingNotice])
    expect(await updates(otherCaptain)).toEqual([missingNotice])
    expect(await updates(stranger)).toEqual([])
    expect(await save(captain,'submit',20,null,first)).toMatchObject({code:'saved',card:{state:'pending'}})
    expect(await save(captain,'submit',21,id(20),first)).toEqual({code:'pending'})
    expect(await review(director,null)).toMatchObject({matches:[{id:fixture}]})
    expect(await matchDay(director,false)).toMatchObject({matches:[{id:fixture,action:'review'}],canReview:true})
    expect(await matchDay(captain,true,[fixture])).toMatchObject({matches:[{id:fixture,action:'pending'}],canReview:false})
    expect(await matchDay(null,false)).toEqual({matches:[],canReview:false})
    expect(await updates(director)).toEqual([{title:'League score ready for review',href}])
    expect(await updates(captain)).toEqual([missingNotice])
    expect(await attention()).toMatchObject([{id:older}])
    expect(await remind(director,missing)).toEqual({code:'stale'})
    expect(await published()).toEqual([])
    expect(await save(captain,'approve',21,id(20),first)).toEqual({code:'forbidden'})
    expect(await save(director,'return',21,id(20),[],'Check the score from court one.')).toMatchObject({code:'saved',card:{state:'changes_requested'}})
    expect(await review(captain,fixture)).toMatchObject({card:{note:'Check the score from court one.'}})
    expect(await matchDay(captain,true,[fixture])).toMatchObject({matches:[{id:fixture,action:'fix',official:null}]})
    expect(JSON.stringify(await matchDay(captain,true))).not.toContain('Check the score')
    expect(await matchDay(director,false)).toEqual({matches:[],canReview:true})
    const [stillOlder, correction] = (await attention())!
    expect([stillOlder, correction]).toMatchObject([{id:older}, {id:fixture,revision:id(21),note:'Check the score from court one.'}])
    expect(await remind(director,correction)).toMatchObject({code:'sent',count:1})
    expect(await updates(captain)).toEqual(expect.arrayContaining([missingNotice,
      {title:'League score needs corrections',href},{title:'League score correction reminder',href}]))
    expect(await updates(otherCaptain)).toEqual([missingNotice])
    expect(await updates(director)).toEqual([])
    expect(await updates(stranger)).toEqual([])
    expect(await published()).toEqual([])
    expect(await save(captain,'submit',22,id(21),corrected)).toMatchObject({code:'saved',card:{state:'pending'}})
    expect(await updates(captain)).toEqual([missingNotice])
    expect(await remind(director,correction)).toEqual({code:'stale'})
    expect(await save(director,'approve',23,id(20),first)).toEqual({code:'stale'})
    const approved = await save(director,'approve',23,id(22),corrected)
    expect(approved).toMatchObject({code:'saved',card:{state:'approved',lines:corrected}})
    expect(await save(director,'approve',23,id(22),corrected)).toEqual(approved)
    expect(await review(director,null)).toEqual({matches:[]})
    expect(await updates(captain)).toEqual(expect.arrayContaining([missingNotice,{title:'League score approved',href}]))
    expect((await attention())?.map(row=>row.id)).toEqual([older])
    const scores = await published()
    expect(await matchDay(null,false)).toMatchObject({matches:[{id:fixture,action:null,official:scores[0]}],canReview:false})
    expect(await matchDay(null,false,[future])).toEqual({matches:[],canReview:false})
    expect(scores).toMatchObject([{a:'Aces',b:'Rallies',winner:'Rallies',courts:[{winner:'Side B',score:'4-6, 3-6'}]}])
    expect(standingsFromLeagueScores(scores,{})).toMatchObject([
      {teamName:'Rallies',wins:1,lineWins:1},{teamName:'Aces',losses:1,lineLosses:1},
    ])
    expect(beforeApprovedLeagueScores(scores,scores)).toEqual([])
    await db.exec('reset role')
    await db.query("update tiq_league_schedule_items set scheduled_date=current_date+3 where id=$1",[older])
    expect(await remind(director,olderRow)).toEqual({code:'stale'})
    expect(await updates(otherCaptain)).toEqual([])
    await db.exec('reset role')
    await db.exec("update tiq_team_league_match_lines set score='0-6, 0-6'")
    expect(await published()).toEqual([])
    expect((await db.query('select count(*)::int as count from tiq_team_league_match_events where schedule_item_id is not null')).rows[0]).toEqual({count:1})

    const demo = 'tiq-testflight-scores-'+captain
    const demoMatch = id(41), demoEntry = id(42)
    await db.query(`insert into tiq_leagues(id,created_by_user_id,league_name,league_format,season_status,is_public,updated_at,max_match_events)
      values($1,$2,'TestFlight Score Review','team','active',false,$3,20)`, [demo,captain,version])
    await db.query(`insert into tiq_team_league_entries(id,league_id,team_name,entry_status,created_by_user_id)
      values($1,$2,'Aces','active',$3)`, [demoEntry,demo,captain])
    await db.query(`insert into tiq_league_schedule_items(id,league_id,league_format,participant_a_name,participant_b_name,
      participant_a_id,scheduled_date,scheduled_time,status,updated_at)
      values($1,$2,'team','Aces','Rallies',$3,current_date-3,'18:00','coordinator_set',$4)`, [demoMatch,demo,demoEntry,version])
    const demoLines = [leagueScoreLine('singles','','walkover','A'), leagueScoreLine('doubles','6-4, 2-1','retirement','B'),
      leagueScoreLine('doubles','','retirement','A')]
    const demoSave = async (actor:string, action:string, request:number, revision:string|null, lines:unknown, note='') =>
      (await db.query<{ result: unknown }>(`select native_league_save_score($1,$2,$3,$4,$3,$5,$6,$7,$8,$9,true,null,null) as result`,
        [actor,demo,version,demoMatch,revision,id(request),action,JSON.stringify(lines),note])).rows[0].result
    await db.exec('set role service_role')
    expect(await matchDay(null,false,[demoMatch],demo)).toEqual({matches:[],canReview:false})
    expect(await matchDay(captain,true,[demoMatch],demo)).toMatchObject({matches:[{id:demoMatch,action:'enter'}],canReview:true})
    expect(await attention(stranger,demo,[demoMatch])).toBeNull()
    const [demoMissing] = (await attention(captain,demo,[demoMatch]))!
    expect(await remind(captain,demoMissing,demo)).toMatchObject({code:'sent',count:1})
    expect(await updates(captain)).toContainEqual({title:'League score reminder',href:'/explore/leagues/tiq/'+demo+'?scoreMatch='+demoMatch+'#league-scores'})
    expect(await demoSave(stranger,'submit',44,null,demoLines)).toEqual({code:'stale'})
    expect(await demoSave(captain,'submit',44,null,[{...demoLines[0],score:'6-0, 6-0'}])).toEqual({code:'invalid'})
    expect(await demoSave(captain,'submit',44,null,demoLines)).toMatchObject({code:'saved',card:{state:'pending',lines:demoLines}})
    expect(await demoSave(captain,'return',45,id(44),[],'Check the court outcomes.')).toMatchObject({code:'saved',card:{state:'changes_requested'}})
    expect(await updates(captain)).toContainEqual({title:'League score needs corrections',href:'/explore/leagues/tiq/'+demo+'?scoreMatch='+demoMatch+'#league-scores'})
    expect(await demoSave(captain,'submit',46,id(45),demoLines)).toMatchObject({code:'saved',card:{state:'pending'}})
    expect(await demoSave(captain,'approve',47,id(46),demoLines)).toMatchObject({code:'saved',card:{state:'approved'}})
    const {rows:privateResults} = await db.query<{ result: OfficeResult[] }>('select native_league_approved_results($1,$2) as result',[demo,version])
    expect(privateResults[0].result).toEqual([])
    await db.exec('reset role')
    const {rows:official} = await db.query<{ result: OfficeResult }>(
      'select private.native_league_score_result(e) as result from tiq_team_league_match_events e where schedule_item_id=$1',[demoMatch])
    expect(official[0].result).toMatchObject({winner:'Aces',courts:[
      {winner:'Side A',score:'Walkover'},{winner:'Side B',score:'Retired · 6-4, 2-1'},{winner:'Side A',score:'Retired'},
    ]})
    expect(standingsFromLeagueScores([official[0].result],{})).toMatchObject([{teamName:'Aces',wins:1,lineWins:2},{teamName:'Rallies',losses:1,lineWins:1}])
    expect(standingsFromLeagueScores([official[0].result],{scoring_system:'dynamic_points'}).map(row=>row.points)).toEqual([0,0])
  } finally { await db.close() }
}, 30000)

it('preserves partial retirement scores without inferring a winner or accepting an impossible score', () => {
  expect(leagueScoreLine('doubles','6-4 2-1','retirement','B')).toEqual({format:'doubles',score:'6-4, 2-1',winner:'B',outcome:'retirement'})
  expect(()=>leagueScoreLine('doubles','','walkover')).toThrow('Choose the team')
  expect(()=>leagueScoreLine('doubles','6-0, 6-0','walkover','A')).toThrow('Leave the set score blank')
  for (const score of ['6-4, 6-0','2-1, 6-3','8-1','6-4, 2-1, 0-0','6-4, 4-6, 10-8']) {
    expect(()=>leagueScoreLine('singles',score,'retirement','A')).toThrow()
  }
})
