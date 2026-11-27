import {beforeEach, expect, it, vi} from 'vitest'
import {createClient} from '@supabase/supabase-js'
const st=vi.hoisted(()=>({configured:true,deliver:vi.fn(),after:vi.fn()}))
vi.mock('server-only',()=>({}))
vi.mock('next/server',()=>({after:st.after}))
vi.mock('../native-activity-push-server',()=>({nativeActivityPushConfiguration:()=>st.configured?{}:null,deliverActivityNotifications:st.deliver}))
import {nativeCoachActivityPayload,sendNativeCoachActivityPush,scheduleCoachActivityPush} from '../native-coach-activity-push'
import {coachActivityHref,coachActivityPushHref,readCoachActivityHref,readCoachActivityPush} from '../coach-activity'
const actor='11111111-1111-4111-8111-111111111111',recipient='22222222-2222-4222-8222-222222222222',notice='33333333-3333-4333-8333-333333333333',installation='44444444-4444-4444-8444-444444444444'
const device={installation_id:installation,profile_id:recipient,device_token:'a'.repeat(64),updated_at:'2026-11-19T00:00:00.123456+00:00'}
let calls:{name:string;body:Record<string,unknown>}[],claimed:boolean,devices:unknown[],fail:string
const service=()=>createClient('https://synthetic.invalid','synthetic-key',{auth:{persistSession:false},global:{fetch:async(raw,init)=>{
  const name=new URL(String(raw)).pathname.split('/').at(-1)!,body=JSON.parse(String(init?.body));calls.push({name,body})
  if(name===fail)return Response.json({message:'private failure'},{status:503})
  if(name==='claim_native_coach_activity_push'){if(claimed)return Response.json([]);claimed=true;return Response.json([{notification_id:notice}])}
  if(name==='native_coach_activity_push_devices')return Response.json(devices)
  return new Response(null,{status:204})
}}})
beforeEach(()=>{calls=[];claimed=false;devices=[device];fail='';st.configured=true;st.after.mockReset();st.deliver.mockReset().mockImplementation(async requests=>requests.map((r:{device:unknown})=>({device:r.device,result:{status:200},expired:false})))})
it('accepts exact activity destinations and rejects unsupported kinds, duplicated keys and foreign push owners',()=>{
  for(const kind of ['assignment','checkin','feedback'] as const){const activity={kind,student:'student-one',assignment:'practice-one'};expect(readCoachActivityHref(coachActivityHref(activity))).toEqual(activity)}
  for(const href of ['/coach?student=s&assignment=a&activity=bogus#coach-workspace','/coach?student=s&assignment=a&activity=checkin&student=x#coach-workspace','https://www.tenaceiq.com/coach?student=s&assignment=a&activity=checkin#coach-workspace','/coach?student=../s&assignment=a&activity=checkin#coach-workspace'])expect(readCoachActivityHref(href)).toBeNull()
  expect(readCoachActivityPush({recipient,href:coachActivityPushHref(notice)},recipient)).toBe(notice)
  expect(readCoachActivityPush({recipient:actor,href:coachActivityPushHref(notice)},recipient)).toBeNull()
  expect(readCoachActivityPush({recipient,href:coachActivityPushHref(notice)+'&next=evil'},recipient)).toBeNull()
})
it('keeps names, instructions, check-ins and feedback off the lock screen',()=>{
  expect(nativeCoachActivityPayload(recipient,coachActivityPushHref(notice))).toEqual({aps:{alert:{title:'TenAceIQ',body:'You have a coaching update.'},sound:'default'},recipient,href:coachActivityPushHref(notice)})
  expect(()=>nativeCoachActivityPayload(recipient,'https://evil.invalid')).toThrow()
})
it('claims once, sends only to current opted-in devices and never retries a delivered event',async()=>{
  const client=service(),input={actor,assignment:'practice-one',kind:'assignment' as const}
  expect(await sendNativeCoachActivityPush(client,input)).toEqual({attempted:1,failed:0})
  expect(await sendNativeCoachActivityPush(client,input)).toEqual({attempted:0,failed:0})
  expect(st.deliver).toHaveBeenCalledTimes(1);expect(calls[0].body).toEqual({p_actor:actor,p_assignment:'practice-one',p_kind:'assignment'})
  expect(st.deliver.mock.calls[0][0][0]).toMatchObject({href:coachActivityPushHref(notice),collapseId:notice,expiresAt:0})
})
it('does not claim when delivery is disabled, and suppresses revoked connections or invalid devices',async()=>{
  st.configured=false;expect(await sendNativeCoachActivityPush(service(),{actor,assignment:'a',kind:'checkin'})).toEqual({attempted:0,failed:0});expect(calls).toEqual([])
  st.configured=true;devices=[];expect(await sendNativeCoachActivityPush(service(),{actor,assignment:'a',kind:'checkin'})).toEqual({attempted:0,failed:0})
  for(const list of [[device,device],Array(4).fill(device),[{...device,profile_id:'foreign'}]]){claimed=false;devices=list;st.deliver.mockClear();expect((await sendNativeCoachActivityPush(service(),{actor,assignment:'a',kind:'feedback'})).failed).toBe(1);expect(st.deliver).not.toHaveBeenCalled()}
})
it('expires only the exact rejected registration and keeps delivery failures separate from saved work',async()=>{
  st.deliver.mockImplementation(async requests=>requests.map((r:{device:unknown})=>({device:r.device,result:{status:410},expired:true})))
  expect(await sendNativeCoachActivityPush(service(),{actor,assignment:'a',kind:'feedback'})).toEqual({attempted:1,failed:1})
  expect(calls.at(-1)).toEqual({name:'expire_native_coach_activity_device',body:{p_notice:notice,p_installation:installation,p_version:device.updated_at}})
  claimed=false;fail='claim_native_coach_activity_push';await expect(sendNativeCoachActivityPush(service(),{actor,assignment:'a',kind:'assignment'})).resolves.toEqual({attempted:0,failed:1})
  scheduleCoachActivityPush({actor,assignment:'a',kind:'assignment'});expect(st.after).toHaveBeenCalledTimes(1)
})
