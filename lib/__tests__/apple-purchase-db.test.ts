import {expect,it} from 'vitest'
import {PGlite} from '@electric-sql/pglite'
import {readFile} from 'node:fs/promises'
const a='11111111-1111-4111-8111-111111111111',b='22222222-2222-4222-8222-222222222222'
it('keeps purchase ownership private, rejects stale/replayed grants, isolates sandbox, and erases account-owned records',async()=>{
 const db=new PGlite()
 try{
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;create table profiles(id uuid primary key,player_plus_subscription_active boolean default false);create table account_deletion_requests(account_id uuid,automatic_consent boolean);insert into auth.users values('${a}'),('${b}');insert into profiles(id) values('${a}'),('${b}');grant usage on schema public,auth to anon,authenticated,service_role;`)
 await db.exec(await readFile(new URL('../../supabase/migrations/20261028000300_apple_purchase_records.sql',import.meta.url),'utf8'))
 for(const role of ['anon','authenticated']){await db.exec('set role '+role);await expect(db.query('select * from tenaceiq_private.apple_memberships')).rejects.toThrow();await expect(db.query('select apple_purchase_account($1,true)',[a])).rejects.toThrow();await expect(db.query('select apple_purchase_access($1)',[b])).rejects.toThrow();await expect(db.query('select apple_purchase_claim($1,gen_random_uuid(),repeat(\'a\',64))',[a])).rejects.toThrow();await db.exec('reset role')}
 await db.exec('set role service_role')
 expect((await db.query<{r:boolean}>('select apple_purchase_catalog_ready() r')).rows[0].r).toBe(true)
 const account=async(owner:string)=>(await db.query<{r:{accountToken:string}}>('select apple_purchase_account($1,true) r',[owner])).rows[0].r
 const token=(await account(a)).accountToken,bToken=(await account(b)).accountToken
 let sequence=0;const operation=()=>`10000000-0000-4000-8000-${String(++sequence).padStart(12,'0')}`
 const claim=async(owner:string,id:string,kind='client')=>(await db.query<{r:{ok:boolean;status?:number;lease:string;receipt?:unknown}}>('select apple_purchase_claim($1,$2,repeat(\'a\',64),$3) r',[owner,id,kind])).rows[0].r
 const now=Date.now(),membership={environment:'Production',originalTransactionId:'1001',transactionId:'1002',appAccountToken:token,productId:'com.tenaceiq.app.captain.monthly',expiresAt:now+86400000,signedAt:now,status:1,revoked:false,upgraded:false}
 const commit=async(owner:string,id:string,lease:string,patch:Record<string,unknown>={})=>(await db.query<{r:{ok:boolean;status?:number;receipt?:{transactionId:string}}}>('select apple_purchase_commit($1,$2,$3,$4,$5) r',[owner,id,lease,{...membership,...patch},'1002'])).rows[0].r
 const access=async(owner:string)=>(await db.query<{r:{playerExpiresAt:string|null;captainExpiresAt:string|null}}>('select apple_purchase_access($1) r',[owner])).rows[0].r
 const first=operation(),lease=(await claim(a,first)).lease
 expect(await commit(a,first,b)).toMatchObject({ok:false,status:409});expect(await commit(a,first,lease)).toMatchObject({ok:true,receipt:{transactionId:'1002'}})
 expect((await access(a)).captainExpiresAt).not.toBeNull();expect((await access(b)).captainExpiresAt).toBeNull();expect(await claim(a,first)).toMatchObject({ok:true,receipt:{transactionId:'1002'}})
 const foreign=operation();expect(await commit(b,foreign,(await claim(b,foreign)).lease,{appAccountToken:bToken})).toMatchObject({ok:false,status:409})
 const refund=operation();expect(await commit(a,refund,(await claim(a,refund,'notification')).lease,{status:5,revoked:true,signedAt:now+1000})).toMatchObject({ok:true});expect((await access(a)).playerExpiresAt).toBeNull()
 const replay=operation();await commit(a,replay,(await claim(a,replay)).lease);expect((await access(a)).playerExpiresAt).toBeNull()
 const equal=operation();await commit(a,equal,(await claim(a,equal)).lease,{signedAt:now+1000});expect((await access(a)).playerExpiresAt).toBeNull()
 const sandbox=operation();expect(await commit(a,sandbox,(await claim(a,sandbox)).lease,{environment:'Sandbox',originalTransactionId:'2001'})).toMatchObject({ok:false,status:403})
 await db.exec('reset role');await db.query('update tenaceiq_private.apple_purchase_accounts set sandbox_enabled=true where owner_id=$1',[a]);await db.exec('set role service_role')
 const sandbox2=operation();expect(await commit(a,sandbox2,(await claim(a,sandbox2)).lease,{environment:'Sandbox',originalTransactionId:'2001'})).toMatchObject({ok:true});expect((await access(a)).captainExpiresAt).not.toBeNull()
 await db.exec('reset role');await db.query('update tenaceiq_private.apple_purchase_accounts set sandbox_enabled=false where owner_id=$1',[a]);await db.exec('set role service_role');expect((await access(a)).captainExpiresAt).toBeNull()
 // Client throttling cannot consume notification capacity.
 for(let n=0;n<11;n++)expect((await claim(b,operation())).ok).toBe(true)
 expect(await claim(b,operation())).toMatchObject({ok:false,status:429});expect((await claim(b,operation(),'notification')).ok).toBe(true)
 await db.exec('reset role');expect((await db.query<{player_plus_subscription_active:boolean}>('select player_plus_subscription_active from profiles where id=$1',[a])).rows[0].player_plus_subscription_active).toBe(false)
 await db.query('delete from auth.users where id=$1',[a]);for(const table of ['apple_memberships','apple_purchase_accounts','apple_purchase_operations'])expect((await db.query(`select * from tenaceiq_private.${table} where owner_id=$1`,[a])).rows).toHaveLength(0)
 }finally{await db.close()}
},30000)
