import {beforeEach,expect,it,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {erasureConfiguration,runAccountErasure,type ErasureJob} from '../account-erasure'
import {eraseAccountBilling} from '../account-erasure-billing'
const owner='11111111-1111-4111-8111-111111111111',id='22222222-2222-4222-8222-222222222222',lease='33333333-3333-4333-8333-333333333333'
const env={ACCOUNT_ERASURE_ENABLED:'true',ACCOUNT_ERASURE_MAX_JWT_SECONDS:'3600',RESEND_API_KEY:'synthetic-mail'}
let job:ErasureJob,rpc:ReturnType<typeof vi.fn>,getUserById:ReturnType<typeof vi.fn>,deleteUser:ReturnType<typeof vi.fn>,freeze:ReturnType<typeof vi.fn>,remove:ReturnType<typeof vi.fn>,send:ReturnType<typeof vi.fn<typeof fetch>>,actions:string[]
function service(){return {rpc,auth:{admin:{getUserById,deleteUser,updateUserById:freeze}},storage:{from:()=>({remove})}} as unknown as SupabaseClient}
beforeEach(()=>{
 job={id,account_id:owner,verified_email:'player@example.test',phase:'queued',lease_token:lease,not_before:null,stripe_customer_id:null,stripe_subscription_id:null};actions=[]
 rpc=vi.fn(async(_name:string,args:Record<string,string>)=>{actions.push(args.p_action);return {data:{ok:true,...(args.p_action==='claim'?{job}:{})},error:null}})
 getUserById=vi.fn(async()=>({data:{user:{id:owner,email:job.verified_email}},error:null}));deleteUser=vi.fn(async()=>({error:null}));freeze=vi.fn(async()=>({error:null}));remove=vi.fn(async()=>({error:null}));send=vi.fn<typeof fetch>(async()=>Response.json({id:'mail'}))
})
it('requires activation and a deliberately configured bounded token lifetime',()=>{
 expect(erasureConfiguration({})).toBeNull();for(const ttl of ['0','86401','NaN','3.5'])expect(erasureConfiguration({...env,ACCOUNT_ERASURE_MAX_JWT_SECONDS:ttl})).toBeNull()
 expect(erasureConfiguration(env)).toEqual({jwtSeconds:3600})
})
it('freezes only the consented job owner, revokes sessions and waits before any data/billing/file deletion',async()=>{
 expect(await runAccountErasure(service(),{env})).toEqual({state:'waiting'})
 expect(freeze).toHaveBeenCalledWith(owner,{ban_duration:'876000h'});expect(actions).toEqual(['claim','preflight','freeze'])
 expect(rpc.mock.calls.at(-1)?.[1]).toMatchObject({p_id:id,p_lease:lease,p_value:'3600'})
 expect(deleteUser).not.toHaveBeenCalled();expect(remove).not.toHaveBeenCalled();expect(send).not.toHaveBeenCalled()
})
it('never freezes or removes anything after failed preflight or wrong-identity lookup',async()=>{
 rpc.mockImplementation(async(_name:string,args:Record<string,string>)=>({data:{ok:args.p_action!=='preflight',...(args.p_action==='claim'?{job}:{})},error:null}))
 expect(await runAccountErasure(service(),{env})).toEqual({state:'retry'});expect(freeze).not.toHaveBeenCalled();expect(deleteUser).not.toHaveBeenCalled()
})
it('leaves an unaudited/failed activation completely inert',async()=>{
 expect(await runAccountErasure(service(),{env:{...env,ACCOUNT_ERASURE_ENABLED:'false'}})).toEqual({state:'disabled'});expect(rpc).not.toHaveBeenCalled()
})
it('uses exact DB-selected storage paths and does not advance until a new first-page query is empty',async()=>{
 job.phase='files';let lists=0
 rpc.mockImplementation(async(_name:string,args:Record<string,string>)=>{actions.push(args.p_action);return {data:{ok:true,...(args.p_action==='claim'?{job}:args.p_action==='files'?{objects:++lists===1?[{bucket_id:'team-room-files',name:'room/'+owner+'/photo.jpg'}]:[]}:args.p_action==='erase_data'?{}:{})},error:args.p_action==='erase_data'?{code:'schema_changed'}:null}})
 expect(await runAccountErasure(service(),{env})).toEqual({state:'retry'})
 expect(remove).toHaveBeenCalledWith(['room/'+owner+'/photo.jpg']);expect(lists).toBe(2);expect(deleteUser).not.toHaveBeenCalled();expect(actions.at(-1)).toBe('retry')
})
it('rejects an unexpected bucket without deleting it or the Auth account',async()=>{
 job.phase='files';rpc.mockImplementation(async(_name:string,args:Record<string,string>)=>({data:{ok:true,...(args.p_action==='claim'?{job}:args.p_action==='files'?{objects:[{bucket_id:'maintenance-archives',name:owner+'/archive.zip'}]}:{})},error:null}))
 expect(await runAccountErasure(service(),{env})).toEqual({state:'retry'});expect(remove).not.toHaveBeenCalled();expect(deleteUser).not.toHaveBeenCalled()
})
it('does not send a false completion email if the Auth account exists or removal fails',async()=>{
 job.phase='auth';deleteUser.mockResolvedValue({error:{code:'storage_error'}})
 expect(await runAccountErasure(service(),{env,send})).toEqual({state:'retry'});expect(send).not.toHaveBeenCalled();expect(actions).not.toContain('verify')
})
it('verifies provider absence and SQL remnants before email and clears identity only after acceptance',async()=>{
 job.phase='auth';let lookups=0
 getUserById.mockImplementation(async()=>++lookups<=2?{data:{user:{id:owner,email:job.verified_email}},error:null}:{data:{user:null},error:{status:404,code:'user_not_found'}})
 expect(await runAccountErasure(service(),{env,send})).toEqual({state:'completed'})
 expect(deleteUser).toHaveBeenCalledWith(owner,false);expect(actions).toEqual(['claim','authorize_auth','verify','verify','complete'])
 expect(send).toHaveBeenCalledTimes(1);expect(new Headers(send.mock.calls[0]?.[1]?.headers).get('Idempotency-Key')).toBe('account-deletion-completed-'+id)
})
it('retries confirmation without repeating Auth removal and preserves the request on mail failure',async()=>{
 job.phase='confirmation';getUserById.mockResolvedValue({data:{user:null},error:{status:404,code:'user_not_found'}});send.mockResolvedValue(Response.json({}, {status:503}))
 expect(await runAccountErasure(service(),{env,send})).toEqual({state:'retry'});expect(deleteUser).not.toHaveBeenCalled();expect(actions).not.toContain('complete')
 expect(rpc.mock.calls.at(-1)?.[1].p_value).toBe('mail')
})
it('checks all subscription ownership before canceling any subscription or deleting a customer',async()=>{
 const request=vi.fn(async(url:string)=>Response.json(url.includes('/customers/')?{id:'cus_test'}:{data:[{id:'sub_mine',customer:'cus_test',metadata:{user_id:owner},status:'active'},{id:'sub_other',customer:'cus_test',metadata:{user_id:id},status:'active'}],has_more:false}))
 await expect(eraseAccountBilling({...job,stripe_customer_id:'cus_test',stripe_subscription_id:'sub_mine'},'synthetic-key',request as never)).rejects.toThrow('billing')
 expect(request.mock.calls).toHaveLength(2)
})
it('cancels only the verified owner’s web subscriptions, suppresses new proration and removes its customer',async()=>{
 const calls:Array<{url:string;method?:string;body?:unknown}>=[]
 const request=vi.fn(async(url:string,init:RequestInit)=>{calls.push({url,method:init.method,body:init.body});return Response.json(url.includes('/subscriptions?')?{data:[{id:'sub_mine',customer:'cus_test',metadata:{user_id:owner},status:'active'}],has_more:false}:url.includes('/subscriptions/sub_mine')?{id:'sub_mine',status:'canceled'}:{id:'cus_test',...(init.method==='DELETE'?{deleted:true}:{})})})
 await eraseAccountBilling({...job,stripe_customer_id:'cus_test',stripe_subscription_id:'sub_mine'},'synthetic-key',request as never)
 expect(calls.filter(c=>c.method==='DELETE').map(c=>c.url)).toEqual(['https://api.stripe.com/v1/subscriptions/sub_mine','https://api.stripe.com/v1/customers/cus_test'])
 expect(String(calls.find(c=>c.url.endsWith('/sub_mine'))?.body)).toBe('invoice_now=false&prorate=false')
})

it('does not delete a customer with no positive ownership evidence even when there are no subscriptions',async()=>{
 const request=vi.fn(async(url:string)=>Response.json(url.includes('/customers/')?{id:'cus_unproven'}:{data:[],has_more:false}))
 await expect(eraseAccountBilling({...job,stripe_customer_id:'cus_unproven'},'synthetic-key',request as never)).rejects.toThrow('billing')
 expect(request.mock.calls).toHaveLength(2)
})
