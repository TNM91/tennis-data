import {beforeEach, expect, it, vi} from 'vitest'
import {createClient,type SupabaseClient} from '@supabase/supabase-js'
const st=vi.hoisted(()=>({allowed:true,client:{} as SupabaseClient}))
vi.mock('../mobile-account-auth',()=>({verifiedAccount:async()=>st.allowed?{user:{id:'11111111-1111-4111-8111-111111111111'},token:'synthetic-token'}:null,accountClient:()=>st.client,accountResponse:(body:unknown,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'private, no-store'}})}))
vi.mock('../supabase-public-config',()=>({supabaseKey:'synthetic-key'}))
import {GET} from '../../app/api/mobile/coach/activity/route'
const owner='11111111-1111-4111-8111-111111111111',notice='22222222-2222-4222-8222-222222222222'
let row:Record<string,unknown>|null,urls:URL[],failure:boolean
beforeEach(()=>{st.allowed=true;urls=[];failure=false;row={id:notice,recipient_profile_id:owner,href:'/coach?student=student-one&assignment=practice-one&activity=feedback#coach-workspace'};st.client=createClient('https://synthetic.invalid','synthetic-key',{auth:{persistSession:false},global:{fetch:async input=>{urls.push(new URL(String(input)));return failure?Response.json({message:'private'},{status:503}):Response.json(row)}}})})
const request=(query='notice='+notice)=>new Request('https://synthetic.invalid/api/mobile/coach/activity?'+query)
it('requires the current account and a single valid notice ID before reading',async()=>{st.allowed=false;expect((await GET(request())).status).toBe(401);st.allowed=true;for(const q of ['notice=bad','notice='+notice+'&notice='+notice,'notice='+notice+'&owner=other'])expect((await GET(request(q))).status).toBe(400);expect(urls).toEqual([])})
it('resolves only a currently visible owned first-party notice with no private message contents',async()=>{const response=await GET(request());expect(response.status).toBe(200);expect(await response.json()).toEqual({ok:true,owner,notice,activity:{student:'student-one',assignment:'practice-one',kind:'feedback'}});expect(urls[0].pathname).toContain('native_first_party_updates');expect(urls[0].searchParams.get('recipient_profile_id')).toBe('eq.'+owner);expect(urls[0].searchParams.get('id')).toBe('eq.'+notice);expect(response.headers.get('Cache-Control')).toContain('no-store')})
it('rejects revoked, malformed and foreign notices without falling back to another assignment',async()=>{for(const next of [null,{...row,recipient_profile_id:notice},{...row,href:'/messages?thread='+notice}]){row=next;expect((await GET(request())).status).toBe(404)}failure=true;expect((await GET(request())).status).toBe(503)})
