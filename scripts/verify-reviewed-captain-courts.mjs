import { readFileSync } from 'node:fs'
import assert from 'node:assert/strict'
if (!process.env.TIQ_PGLITE_MODULE) throw new Error('Set TIQ_PGLITE_MODULE to an existing PGlite module URL')
const { PGlite } = await import(process.env.TIQ_PGLITE_MODULE)
const db = new PGlite()
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table public.matches(id uuid primary key); create table public.tennisrecord_source_pages(id uuid primary key);
    insert into matches values('00000000-0000-0000-0000-000000000001'),('00000000-0000-0000-0000-000000000002');
    insert into tennisrecord_source_pages values('00000000-0000-0000-0000-000000000003');`)
  await db.exec(readFileSync('supabase/migrations/20261022000400_reviewed_captain_court_links.sql','utf8'))
  const grants = await db.query(`select has_table_privilege('anon','tennisrecord_reviewed_captain_courts','select') anon_read,
    has_table_privilege('authenticated','tennisrecord_reviewed_captain_courts','select') authenticated_read,
    has_table_privilege('service_role','tennisrecord_reviewed_captain_courts','select,insert,update,delete') service_access,
    (select relrowsecurity from pg_class where oid='tennisrecord_reviewed_captain_courts'::regclass) rls`)
  assert.deepEqual(grants.rows,[{anon_read:false,authenticated_read:false,service_access:true,rls:true}])
  const insert = `insert into tennisrecord_reviewed_captain_courts(source_event_id,discipline,court_number,canonical_match_id,canonical_parent_id,source_page_id,source_snapshot,court_snapshot,parent_snapshot,review_notes)
    values($1,'singles',1,'00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','{}','{}','{}','Retained scorecard and captain context reviewed')`
  await db.query(insert,['tennisrecord:2027:123'])
  await assert.rejects(db.query(insert,['tennisrecord:2027:456']),/unique/)
  await assert.rejects(db.query(insert,['not-a-source-event']),/check/)
  await db.exec('set role anon')
  await assert.rejects(db.query('select * from tennisrecord_reviewed_captain_courts'),/permission denied/)
  await db.exec('reset role')
  console.log('PASS: RLS, explicit private/service grants, exact event constraint, and one source court per captain record')
} finally { await db.close() }
