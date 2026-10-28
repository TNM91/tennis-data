import {beforeEach,it,expect,vi} from 'vitest'
const f=vi.hoisted(()=>({signed:true,call:vi.fn(),notify:vi.fn(),service:{},owners:[] as string[]}))
vi.mock('../player-api-auth',()=>({getSignedInPlayerApiAuth:async()=>f.signed?{ok:true,userId:'verified-owner'}:{ok:false,response:Response.json({ok:false},{status:401})}}))
vi.mock('../captain-availability-request-server',()=>({getCaptainAvailabilityServiceClient:()=>f.service}))
vi.mock('../native-team-polls',()=>({nativeTeamPoll:(...args:unknown[])=>f.call(...args)}))
vi.mock('../native-team-poll-alert',()=>({notifyNativeTeamPoll:(...args:unknown[])=>f.notify(...args)}))
import {GET,POST} from '../../app/api/team-rooms/polls/route'
const id='55555555-5555-4555-8555-555555555555',url='https://www.tenaceiq.com/api/team-rooms/polls?team=Aces&league=City&flight=4.0&room=33333333-3333-4333-8333-333333333333&poll='+id
beforeEach(()=>{f.signed=true;f.call.mockReset().mockResolvedValue({ok:true,status:200});f.notify.mockReset()})
it('denies unsigned reads and writes before any privileged service operation',async()=>{f.signed=false;expect((await GET(new Request(url))).status).toBe(401);expect((await POST(new Request(url,{method:'POST',body:'{}'}))).status).toBe(401);expect(f.call).not.toHaveBeenCalled()})
it('pins the verified owner/scope and returns no-store headers',async()=>{const r=await GET(new Request(url));expect(r.status).toBe(200);expect(r.headers.get('cache-control')).toBe('private, no-store');expect(f.call).toHaveBeenCalledWith(f.service,'verified-owner',{teamName:'Aces',leagueName:'City',flight:'4.0'},'33333333-3333-4333-8333-333333333333',{action:'get',id})})
it('bounds streamed mutation bodies and rejects malformed actions without RPC execution',async()=>{for(const body of ['{','{}',JSON.stringify({action:'get',id})])expect((await POST(new Request(url,{method:'POST',body}))).status).toBe(400);expect((await POST(new Request(url,{method:'POST',body:' '.repeat(8193)}))).status).toBe(413);expect(f.call).not.toHaveBeenCalled()})
it('passes a valid desired vote and sanitized failures without accepting a body owner',async()=>{const action={action:'vote',id,choice:1,expected:2,owner:'attacker'};expect((await POST(new Request(url,{method:'POST',body:JSON.stringify(action)}))).status).toBe(200);expect(f.call.mock.calls[0].slice(0,2)).toEqual([f.service,'verified-owner']);f.call.mockRejectedValueOnce(Error('private database details'));const r=await POST(new Request(url,{method:'POST',body:JSON.stringify(action)}));expect(r.status).toBe(503);expect(await r.text()).not.toContain('private')})
