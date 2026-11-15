import { readFile } from 'node:fs/promises'
import { PGlite } from '@electric-sql/pglite'
import { expect, it } from 'vitest'
import type { TournamentDraft } from '../native-tournament-draft-contract'

const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const first = '33333333-3333-4333-8333-333333333333'
const next = '44444444-4444-4444-8444-444444444444'
const another = '55555555-5555-4555-8555-555555555555'
const draft: TournamentDraft = {
  name: 'Saturday Doubles', date: '2026-12-05', venue: 'Northside Tennis',
  division: 'Open Doubles', discipline: 'doubles', format: 'round_robin',
}
const settings = {
  registrationClosesOn: '2026-12-03', timeZone: 'America/Chicago',
  divisions: [
    { id: first, name: 'Open Doubles', discipline: 'doubles', format: 'round_robin' },
    { id: another, name: 'Open Singles', discipline: 'singles', format: 'single_elimination' },
  ],
}

it('keeps setup private and moves only the exact saved draft into Tournament Desk', async () => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon;
      create role authenticated;
      create role service_role;
      create schema auth;
      create schema private;
      create table auth.users(id uuid primary key);
      create table public.account_deletion_requests(account_id uuid, automatic_consent boolean);
    `)
    await db.query('insert into auth.users values ($1), ($2)', [owner, other])
    await db.exec(await readFile(new URL('../../supabase/migrations/20261114001200_native_tournament_drafts.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../../supabase/migrations/20261114001300_native_tournament_desk.sql', import.meta.url), 'utf8'))
    await db.exec(await readFile(new URL('../../supabase/migrations/20261114001400_native_tournament_setup_settings.sql', import.meta.url), 'utf8'))

    async function load(user: string) {
      return (await db.query<{ result: unknown }>('select public.native_tournament_draft($1) result', [user])).rows[0].result
    }
    async function save(user: string, expected: string | null, revision: string, details = draft) {
      return (await db.query<{ result: unknown }>('select public.save_native_tournament_draft($1,$2,$3,$4) result',
        [user, expected, revision, JSON.stringify(details)])).rows[0].result
    }
    async function prepare(user: string, revision: string) {
      return (await db.query<{ result: unknown }>('select public.prepare_native_tournament($1,$2) result', [user, revision])).rows[0].result
    }
    async function desk(user: string, after: string | null = null) {
      return (await db.query<{ result: unknown }>('select public.native_tournament_desk($1,$2) result', [user, after])).rows[0].result
    }
    async function setup(user: string) {
      return (await db.query<{ result: unknown }>('select public.native_tournament_setup($1,$2) result', [user, next])).rows[0].result
    }
    async function configure(user: string, expected: string | null, change: string, values = settings) {
      return (await db.query<{ result: unknown }>('select public.save_native_tournament_settings($1,$2,$3,$4,$5) result',
        [user, next, expected, change, JSON.stringify(values)])).rows[0].result
    }

    await db.exec('set role service_role')
    expect(await load(owner)).toBeNull()
    expect(await save(owner, null, first)).toEqual({ draft, revision: first })
    expect(await save(owner, null, first)).toEqual({ draft, revision: first })
    expect(await load(other)).toBeNull()
    const updated = { ...draft, name: 'Sunday Doubles' }
    expect(await save(owner, null, next, updated)).toEqual({ code: 'stale' })
    expect(await save(owner, first, next, updated)).toEqual({ draft: updated, revision: next })
    expect(await save(owner, null, first)).toEqual({ code: 'stale' })
    expect(await load(owner)).toEqual({ draft: updated, revision: next })
    expect(await prepare(other, next)).toEqual({ code: 'stale' })
    expect(await prepare(owner, first)).toEqual({ code: 'stale' })
    expect(await prepare(owner, next)).toEqual({ draft: updated, revision: next })
    expect(await prepare(owner, next)).toEqual({ draft: updated, revision: next })
    expect(await load(owner)).toEqual({ draft: null, revision: next })
    expect(await save(owner, first, next, updated)).toEqual({ code: 'stale' })
    expect(await save(owner, null, first)).toEqual({ code: 'stale' })
    expect(await desk(owner)).toEqual([{ draft: updated, revision: next }])
    expect(await desk(owner, next)).toEqual([])
    expect(await desk(other)).toEqual([])
    expect(await save(owner, next, another)).toEqual({ draft, revision: another })
    expect(await prepare(owner, next)).toEqual({ draft: updated, revision: next })
    expect(await load(owner)).toEqual({ draft, revision: another })
    expect(await prepare(owner, another)).toEqual({ draft, revision: another })
    expect(await desk(owner)).toEqual([{ draft, revision: another }, { draft: updated, revision: next }])
    expect(await desk(owner, another)).toEqual([{ draft: updated, revision: next }])
    expect(await setup(owner)).toEqual({ draft: updated, revision: next, settings: null, settingsRevision: null })
    expect(await setup(other)).toBeNull()
    expect(await configure(other, null, first)).toEqual({ code: 'missing' })
    expect(await configure(owner, null, first, { ...settings, registrationClosesOn: '2026-12-06' })).toEqual({ code: 'deadline' })
    expect(await configure(owner, null, first, { ...settings, timeZone: 'Nonexistent/City' })).toEqual({ code: 'timeZone' })
    const configured = { draft: updated, revision: next, settings, settingsRevision: first }
    expect(await configure(owner, null, first)).toEqual(configured)
    expect(await configure(owner, null, first)).toEqual(configured)
    expect(await configure(owner, null, another)).toEqual({ code: 'stale' })
    expect(await setup(owner)).toEqual(configured)
    const changed = { ...settings, divisions: settings.divisions.slice(1) }
    expect(await configure(owner, first, another, changed)).toEqual({ ...configured, settings: changed, settingsRevision: another })
    expect(await setup(owner)).toEqual({ ...configured, settings: changed, settingsRevision: another })
    await expect(db.query('select * from private.native_tournament_drafts')).rejects.toThrow(/permission denied/)
    await expect(db.query('select * from private.native_tournament_setups')).rejects.toThrow(/permission denied/)

    await db.exec('reset role; set role authenticated')
    await expect(load(owner)).rejects.toThrow(/permission denied/)
    await expect(save(owner, null, first)).rejects.toThrow(/permission denied/)
    await expect(prepare(owner, next)).rejects.toThrow(/permission denied/)
    await expect(desk(owner)).rejects.toThrow(/permission denied/)
    await expect(setup(owner)).rejects.toThrow(/permission denied/)
    await expect(configure(owner, first, another)).rejects.toThrow(/permission denied/)
    await db.exec('reset role')
    await db.query('insert into account_deletion_requests values ($1, true)', [owner])
    await db.exec('set role service_role')
    expect(await load(owner)).toBeNull()
    expect(await save(owner, next, first)).toEqual({ code: 'forbidden' })
    expect(await prepare(owner, next)).toEqual({ code: 'forbidden' })
    expect(await desk(owner)).toEqual([])
    expect(await setup(owner)).toBeNull()
    expect(await configure(owner, null, first)).toEqual({ code: 'forbidden' })
    await db.exec('reset role')
    await db.query('delete from auth.users where id=$1', [owner])
    expect((await db.query('select owner_id from private.native_tournament_drafts')).rows).toEqual([])
    expect((await db.query('select owner_id from private.native_tournament_setups')).rows).toEqual([])
  } finally {
    await db.close()
  }
}, 30000)
