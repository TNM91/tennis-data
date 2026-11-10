import { readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'

it('lets competition managers issue awards and rejects an authenticated outsider', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create schema auth;
      create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as
        'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
      grant usage on schema auth to authenticated;
      insert into auth.users values ('11111111-1111-4111-8111-111111111111'), ('22222222-2222-4222-8222-222222222222');
      create table tiq_tournaments(id text primary key, is_event boolean not null);
      insert into tiq_tournaments values ('draw',false),('event',true);
      grant select on tiq_tournaments to authenticated;
      create function can_manage_tiq_league(text) returns boolean language sql stable as
        $$ select $1='league' and auth.uid()='11111111-1111-4111-8111-111111111111'::uuid $$;
      create function can_manage_tiq_tournament(text) returns boolean language sql stable as
        $$ select $1 in ('draw','event') and auth.uid()='11111111-1111-4111-8111-111111111111'::uuid $$;
    `)
    await db.exec(readFileSync('supabase/migrations/20260525000400_create_tiq_awards.sql', 'utf8'))
    await db.exec(readFileSync('supabase/migrations/20261110000600_restrict_tiq_award_publishers.sql', 'utf8'))
    await db.exec('grant select, insert, update on tiq_awards to authenticated; grant select on tiq_awards to anon; set role authenticated;')
    const become = (id: string) => db.query("select set_config('request.jwt.claim.sub',$1,false)", [id])
    const create = (kind: string, source: string) => db.query(`
      insert into tiq_awards(id,source_type,source_id,source_name,recipient_name,recipient_player_id,title,badge_label,badge_code,created_by_user_id)
      values ($2,$1,$2,'Competition','Jordan','player-1','Champion','Champion','1ST',auth.uid())`, [kind, source])
    await become('22222222-2222-4222-8222-222222222222')
    await expect(create('league','league')).rejects.toThrow(/row-level security/)
    await expect(create('tournament','draw')).rejects.toThrow(/row-level security/)
    await become('11111111-1111-4111-8111-111111111111')
    await create('league','league')
    await create('tournament','draw')
    await expect(create('tournament','event')).rejects.toThrow(/row-level security/)
    await expect(db.exec("update tiq_awards set source_id='other' where id='league'")).rejects.toThrow(/row-level security/)
    await db.exec('reset role; set role anon;')
    expect((await db.query('select id from tiq_awards order by id')).rows).toEqual([{ id: 'draw' }, { id: 'league' }])
  } finally {
    await db.close()
  }
})
