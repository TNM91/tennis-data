import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
import {expect,it} from 'vitest'

const id=(n:number)=>'11111111-1111-4111-8111-'+String(n).padStart(12,'0')
it('preserves installation-secret ownership, private access, APNs compatibility and profile deletion cascades',async()=>{
  const db=new PGlite()
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role;
      create schema private;
      create table public.profiles(id uuid primary key);
      create table private.native_chat_hit_reminders(id uuid primary key,due_at timestamptz);
      create function private.native_player_chat_account(owner uuid) returns boolean language sql as $$
        select exists(select 1 from public.profiles where id=owner) $$;`)
    const original=await readFile('supabase/migrations/20261114000700_native_chat_hit_push.sql','utf8')
    await db.exec(original.slice(0,original.indexOf('create function public.claim_native_hit_push'))+'commit;')
    const coach=await readFile('supabase/migrations/20261119000100_native_coach_activity.sql','utf8')
    await db.exec(coach.slice(0,coach.indexOf('-- The notice and the assignment'))+'commit;')
    await db.exec(await readFile('supabase/migrations/20261127000100_android_activity_push.sql','utf8'))
    await db.query('insert into public.profiles values($1),($2)',[id(1),id(2)])
    const bind=async(installation:string,secret:string,profile:string,token:string,enabled=true)=>(await db.query<{accepted:boolean}>(
      'select public.bind_native_android_activity_push($1,$2,$3,$4,$5,true) accepted',[installation,secret,profile,token,enabled])).rows[0].accepted
    const token='CaseSensitive_Token:1234567890'
    expect(await bind(id(3),'a'.repeat(64),id(1),token)).toBe(true)
    expect((await db.query<{device_token:string;coach_activity_enabled:boolean}>('select device_token,coach_activity_enabled from private.native_hit_push_devices')).rows)
      .toEqual([{device_token:'fcm:'+token,coach_activity_enabled:true}])
    expect(await bind(id(3),'b'.repeat(64),id(2),token)).toBe(false)
    expect(await bind(id(3),'a'.repeat(64),id(1),'',false)).toBe(true)
    expect((await db.query<{enabled:boolean}>('select enabled from private.native_hit_push_devices')).rows[0].enabled).toBe(false)
    expect(await bind(id(3),'a'.repeat(64),id(2),token)).toBe(true)
    expect(await bind(id(4),'a'.repeat(64),id(1),'bad\ntoken')).toBe(false)
    expect((await db.query<{ok:boolean}>('select public.bind_native_hit_push($1,$2,$3,$4,true,true) ok',[id(5),'b'.repeat(64),id(1),'c'.repeat(64)])).rows[0].ok).toBe(true)
    expect((await db.query<{ok:boolean}>(`select has_function_privilege('authenticated',
      'public.bind_native_android_activity_push(uuid,text,uuid,text,boolean,boolean)','EXECUTE') ok`)).rows[0].ok).toBe(false)
    expect((await db.query<{ok:boolean}>(`select has_function_privilege('service_role',
      'public.bind_native_android_activity_push(uuid,text,uuid,text,boolean,boolean)','EXECUTE') ok`)).rows[0].ok).toBe(true)
    await db.query('delete from public.profiles where id=$1',[id(2)])
    expect((await db.query('select * from private.native_hit_push_devices where installation_id=$1',[id(3)])).rows).toHaveLength(0)
  } finally { await db.close() }
},20000)
