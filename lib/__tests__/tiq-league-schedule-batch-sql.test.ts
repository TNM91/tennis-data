import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

const coordinator = '11111111-1111-4111-8111-111111111111'
const outsider = '22222222-2222-4222-8222-222222222222'
const firstId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const secondId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const first = {
  id: firstId, participant_a_name: 'Aces', participant_b_name: 'Breakers',
  scheduled_date: '2090-06-10', scheduled_time: '18:30', facility: 'Riverside',
}
const second = {
  id: secondId, participant_a_name: 'Court Crew', participant_b_name: 'Deuce',
  scheduled_date: '2090-06-10', scheduled_time: '18:30', facility: 'Riverside',
}
let db: PGlite

async function publish(matches: unknown = [first, second], capacity = 2, user = coordinator) {
  await db.query("select set_config('request.jwt.claim.sub', $1, false)", [user])
  return (await db.query<{ result: { ok: boolean; status?: number; ids?: string[]; message?: string } }>(
    "select public.publish_tiq_league_schedule_batch('season', $1::jsonb, $2) result",
    [JSON.stringify(matches), capacity],
  )).rows[0].result
}

async function savedIds() {
  return (await db.query<{ id: string }>('select id from public.tiq_league_schedule_items order by id')).rows.map(({ id }) => id)
}

describe('League Office batch publish transaction', () => {
  beforeAll(async () => {
    db = new PGlite()
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      insert into auth.users values ('${coordinator}'), ('${outsider}');
      create function auth.uid() returns uuid language sql stable as
        $$select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid$$;
      create table tiq_leagues (
        id text primary key, created_by_user_id uuid, league_format text, individual_competition_format text,
        season_status text, scheduling_mode text, weekly_settings jsonb, schedule_time_zone text,
        starts_on date, ends_on date, max_match_events integer, teams text[], players text[],
        is_public boolean default false, max_weeks integer default 12
      );
      create table tiq_league_delegates(league_id text, user_id uuid);
      create function can_manage_tiq_league(target_league_id text) returns boolean
      language sql stable security definer set search_path = public as $$
        select exists (select 1 from tiq_leagues where id = target_league_id and created_by_user_id = auth.uid())
          or exists (select 1 from tiq_league_delegates where league_id = target_league_id and user_id = auth.uid())
      $$;
      create table tiq_team_league_entries(league_id text, team_name text, team_entity_id text, entry_status text);
      create table tiq_player_league_entries(league_id text, player_name text, player_id text, entry_status text);
      create table tiq_team_league_match_events(
        league_id text, schedule_item_id uuid, team_a_name text, team_a_id text, team_b_name text, team_b_id text, match_date date
      );
      create table tiq_individual_league_results(
        league_id text, schedule_item_id uuid, player_a_name text, player_a_id text, player_b_name text, player_b_id text
      );
    `)
    await db.exec(readFileSync('supabase/migrations/20260507170000_create_tiq_league_schedule_items.sql', 'utf8')
      .replace('create extension if not exists pgcrypto;', ''))
    await db.exec(readFileSync('supabase/migrations/20261111000100_publish_tiq_league_schedule_batch.sql', 'utf8'))
  }, 30000)

  beforeEach(async () => {
    await db.exec(`
      truncate tiq_league_schedule_items, tiq_leagues, tiq_league_delegates, tiq_team_league_entries,
        tiq_player_league_entries, tiq_team_league_match_events, tiq_individual_league_results;
      insert into tiq_leagues values ('season','${coordinator}','team','standard','active','coordinator_fixed','{}',
        'America/Chicago','2090-06-01','2090-07-01',12,array['Aces','Breakers','Court Crew','Deuce'],'{}');
    `)
  })

  afterAll(async () => { await db?.close() })

  it('publishes the whole batch and recognizes the exact retry without duplicates', async () => {
    expect(await publish()).toEqual({ ok: true, ids: [firstId, secondId] })
    expect(await publish()).toEqual({ ok: true, ids: [firstId, secondId] })
    expect(await savedIds()).toEqual([firstId, secondId])
    expect(await publish([{ ...first, facility: 'Other venue' }, second])).toMatchObject({ ok: false, status: 409 })
  })

  it('rejects an outsider and permits a league delegate through the existing scope', async () => {
    await db.exec('set role authenticated')
    try {
      expect(await publish([first], 2, outsider)).toMatchObject({ ok: false, status: 403 })
    } finally {
      await db.exec('reset role')
    }
    expect(await savedIds()).toEqual([])
    await db.query("insert into tiq_league_delegates values ('season',$1)", [outsider])
    await db.exec('set role authenticated')
    try {
      expect(await publish([first], 2, outsider)).toEqual({ ok: true, ids: [firstId] })
    } finally {
      await db.exec('reset role')
    }
    const { rows } = await db.query<{ allowed: boolean }>(
      "select has_function_privilege('anon','public.publish_tiq_league_schedule_batch(text,jsonb,integer)','execute') allowed",
    )
    expect(rows[0].allowed).toBe(false)
  })

  it('stops the entire batch if another save books a participant or adds a reversed matchup', async () => {
    await db.exec(`insert into tiq_league_schedule_items
      (league_id,league_format,participant_a_name,participant_b_name,scheduled_date,scheduled_time,facility,status)
      values ('season','team','Breakers','Aces','2090-06-16','18:30','Riverside','coordinator_set')`)
    const before = await savedIds()
    expect(await publish()).toMatchObject({ ok: false, status: 409 })
    expect(await savedIds()).toEqual(before)
    expect(await publish([{ ...first, participant_b_name: 'Court Crew', scheduled_date: '2090-06-16' }, second]))
      .toMatchObject({ ok: false, status: 409 })
    expect(await savedIds()).toEqual(before)
  })

  it('rejects duplicate participants, full starts, and over-limit seasons before inserting', async () => {
    expect(await publish([first, { ...second, participant_a_name: 'Aces' }])).toMatchObject({ ok: false, status: 409 })
    expect(await publish([first, second], 1)).toMatchObject({ ok: false, status: 409 })
    await db.exec('update tiq_leagues set max_match_events = 1')
    expect(await publish()).toMatchObject({ ok: false, status: 409 })
    expect(await savedIds()).toEqual([])
  })

  it('checks the current venue capacity including older time and site formatting', async () => {
    await db.exec(`insert into tiq_league_schedule_items
      (league_id,league_format,participant_a_name,participant_b_name,scheduled_date,scheduled_time,facility,status)
      values ('season','team','Court Crew','Deuce','2090-06-10','18:30:30','  Riverside  Tennis  ','coordinator_set')`)
    const before = await savedIds()
    const match = { ...first, facility: 'Riverside Tennis' }
    expect(await publish([match], 1)).toMatchObject({ ok: false, status: 409 })
    expect(await savedIds()).toEqual(before)
    expect(await publish([{ ...match, scheduled_time: '19:30' }], 1)).toEqual({ ok: true, ids: [firstId] })
  })

  it('uses active individual entries and rejects stale names or an ineligible format', async () => {
    await db.exec(`update tiq_leagues set league_format = 'individual', individual_competition_format = 'round_robin';
      insert into tiq_player_league_entries values ('season','Aces','player-1','active'), ('season','Breakers','player-2','active')`)
    const match = { ...first, participant_a_id: 'player-1', participant_b_id: 'player-2' }
    expect(await publish([{ ...match, participant_a_name: 'Former Name' }])).toMatchObject({ ok: false, status: 409 })
    await db.exec("update tiq_leagues set individual_competition_format = 'ladder'")
    expect(await publish([match])).toMatchObject({ ok: false, status: 409 })
    await db.exec("update tiq_leagues set individual_competition_format = 'round_robin'")
    expect(await publish([match])).toEqual({ ok: true, ids: [firstId] })
  })

  it('keeps exceptions within a season with or without an explicit end date', async () => {
    expect(await publish([{ ...first, scheduled_date: '2090-07-02' }])).toMatchObject({ ok: false, status: 409 })
    await db.exec('update tiq_leagues set ends_on = null, max_weeks = 2')
    expect(await publish([{ ...first, scheduled_date: '2090-06-15' }])).toMatchObject({ ok: false, status: 409 })
    expect(await publish([first])).toEqual({ ok: true, ids: [firstId] })
  })

  it('rechecks roster and results and keeps legacy configured names usable', async () => {
    await db.exec("insert into tiq_team_league_entries values ('season','Aces',null,'removed')")
    expect(await publish()).toMatchObject({ ok: false, status: 409 })
    await db.exec("truncate tiq_team_league_entries; insert into tiq_team_league_match_events values ('season',null,'Breakers',null,'Aces',null,'2090-06-06')")
    expect(await publish()).toMatchObject({ ok: false, status: 409 })
    expect(await savedIds()).toEqual([])
    expect(await publish([second])).toEqual({ ok: true, ids: [secondId] })
  })

  it('rolls back every row when a write fails and accepts the same retry', async () => {
    await db.exec(`
      create function fail_batch() returns trigger language plpgsql as $$
        begin if new.id = '${secondId}' then raise exception 'test write failure'; end if; return new; end
      $$;
      create trigger fail_batch before insert on tiq_league_schedule_items for each row execute function fail_batch();
    `)
    await expect(publish()).rejects.toThrow('test write failure')
    expect(await savedIds()).toEqual([])
    await db.exec('drop trigger fail_batch on tiq_league_schedule_items; drop function fail_batch()')
    expect(await publish()).toEqual({ ok: true, ids: [firstId, secondId] })
  })
})
