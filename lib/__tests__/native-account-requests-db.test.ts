import {expect,it} from 'vitest'
import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
it('enforces the real private request lifecycle, rate windows, erasure prerequisites and privacy cleanup in PostgreSQL',async()=>{
 const db=new PGlite(),a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222',admin='33333333-3333-4333-8333-333333333333'
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema storage;create table public.profiles(id uuid primary key,role text);insert into profiles values('${a}','member'),('${b}','member'),('${admin}','admin');create table public.product_usage_events(user_id uuid);create table public.upgrade_requests(requester_user_id uuid);create table storage.objects(owner_id text,bucket_id text,name text);grant usage on schema public,storage to anon,authenticated,service_role;grant select on profiles,product_usage_events,upgrade_requests,storage.objects to service_role;`)
 await db.exec(await readFile(new URL('../../supabase/migrations/20261028000100_native_account_requests.sql',import.meta.url),'utf8'))
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await expect(db.query('select * from account_deletion_requests')).rejects.toThrow();await expect(db.query('select * from native_email_auth_limits')).rejects.toThrow();await expect(db.query("select consume_native_email_auth(repeat('a',64),repeat('b',64))")).rejects.toThrow();await expect(db.query('select native_account_lifecycle_config()')).rejects.toThrow();await expect(db.query(`select native_account_deletion_request('${a}','a@example.test',true)`)).rejects.toThrow();await expect(db.query(`select admin_account_deletion_request('${admin}','list')`)).rejects.toThrow();await db.exec('reset role')}
 await db.exec('set role service_role')
 const config=(await db.query<{r:Record<string,unknown>}>('select native_account_lifecycle_config() r')).rows[0].r;expect(config).toMatchObject({version:1,deletionReviewDays:7,queueReady:true})
 const call=async(owner:string,email:string,create=false)=>(await db.query<{r:{ok:boolean;request:null|{id:string;dueAt:string;status:string}}}>('select native_account_deletion_request($1,$2,$3) r',[owner,email,create])).rows[0].r
 expect((await call(a,'a@example.test')).request).toBeNull();const first=await call(a,'a@example.test',true),again=await call(a,'changed@example.test',true);expect(again).toEqual(first);await call(b,'b@example.test',true);expect((await call(b,'b@example.test')).request?.id).not.toBe(first.request?.id)
 const list=async(actor:string,action:string,id:string|null=null)=>(await db.query<{r:{ok:boolean;status?:number;row?:Record<string,unknown>;rows?:unknown[]}}>('select admin_account_deletion_request($1,$2,$3) r',[actor,action,id])).rows[0].r
 expect(await list(b,'list')).toMatchObject({ok:false,status:403});expect((await list(admin,'list')).rows).toHaveLength(2);const id=first.request!.id;expect((await list(admin,'review',id)).row?.status).toBe('reviewing');expect(await list(admin,'confirm_erased',id)).toMatchObject({ok:false,status:409})
 await db.exec('reset role');await db.query('delete from profiles where id=$1',[a]);await db.query('insert into product_usage_events values($1)',[a]);await db.exec('set role service_role');expect(await list(admin,'confirm_erased',id)).toMatchObject({ok:false,status:409})
 await db.exec('reset role');await db.query('delete from product_usage_events where user_id=$1',[a]);await db.query('insert into storage.objects values(null,$1,$2)',['team-room-files','room/'+a+'/photo.jpg']);await db.exec('set role service_role');expect(await list(admin,'confirm_erased',id)).toMatchObject({ok:false,status:409})
 await db.exec('reset role');await db.query('delete from storage.objects where name=$1',['room/'+a+'/photo.jpg']);await db.exec('set role service_role');expect((await list(admin,'confirm_erased',id)).row?.status).toBe('erased');const done=await list(admin,'complete',id);expect(done.row).toMatchObject({status:'completed',account_id:null,verified_email:null});expect((await list(admin,'list')).rows).toHaveLength(1);expect((await call(b,'b@example.test')).request?.status).toBe('requested')
 const limit=async(email:string,ip:string)=>(await db.query<{r:boolean}>('select consume_native_email_auth($1,$2) r',[email,ip])).rows[0].r
 const hash='a'.repeat(64),ip='b'.repeat(64);expect(await limit(hash,ip)).toBe(true);expect(await limit(hash,'c'.repeat(64))).toBe(false)
 for(let n=0;n<4;n++)expect(await limit(String(n).repeat(64),ip)).toBe(true);expect(await limit('d'.repeat(64),ip)).toBe(false)
 await db.exec('reset role');await db.query("update native_email_auth_limits set window_started_at=clock_timestamp()-interval '16 minutes' where scope='ip-quarter' and key_hash=$1",[ip]);await db.exec('set role service_role');expect(await limit('d'.repeat(64),ip)).toBe(true)
 expect(await limit('not-a-hash',ip)).toBe(false)
 // Different IPs and expired minute windows cannot bypass the email's hourly cap.
 const hourly='e'.repeat(64)
 for(let n=0;n<5;n++){
  expect(await limit(hourly,(10+n).toString(16).padStart(64,'0'))).toBe(true)
  await db.exec('reset role');await db.query("update native_email_auth_limits set window_started_at=clock_timestamp()-interval '61 seconds' where scope='email-minute' and key_hash=$1",[hourly]);await db.exec('set role service_role')
 }
 expect(await limit(hourly,'f'.repeat(64))).toBe(false)
 // Cleanup is bounded per accepted request, even after a long idle interval.
 await db.exec('reset role');await db.exec("insert into native_email_auth_limits select 'email-hour',lpad(to_hex(n),64,'0'),clock_timestamp()-interval '3 days',1 from generate_series(1000,1119) n");await db.exec('set role service_role')
 expect(await limit('9'.repeat(64),'8'.repeat(64))).toBe(true)
 expect((await db.query<{count:number}>("select count(*)::int count from native_email_auth_limits where window_started_at<clock_timestamp()-interval '2 days'")).rows[0].count).toBe(20)
 }finally{await db.close()}
},30000)
