import {it,expect,vi,beforeEach,afterEach} from 'vitest'
const {auth,rpc,accountClient}=vi.hoisted(()=>({auth:vi.fn(),rpc:vi.fn(),accountClient:vi.fn()}))
vi.mock('../player-api-auth',()=>({getSignedInPlayerApiAuth:auth}))
vi.mock('../mobile-account-auth',()=>({accountClient}))
import {GET,POST} from '../../app/api/mobile/tournaments/entry/route'
import {GET as getFirstParty,POST as postFirstParty} from '../../app/api/mobile/first-party/tournaments/entry/route'
import {tournamentEntrySnapshot,tournamentReceipt,tournamentDraft} from '../../tests/fixtures/native-tournament-entry'
import {tournamentOwner as owner} from '../../tests/fixtures/native-tournaments'
const url='https://example.invalid/api/mobile/tournaments/entry',query='?parent=event-one&division=division-one'
const body=()=>({parent:'event-one',division:'division-one',action:'submit',data:{revision:'a'.repeat(32),...tournamentDraft}})
const post=(b:unknown)=>new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)})
beforeEach(()=>{vi.clearAllMocks();auth.mockResolvedValue({ok:true,supabase:{rpc},userId:owner});rpc.mockResolvedValue({data:{ok:true,...tournamentEntrySnapshot()},error:null})})
afterEach(()=>vi.unstubAllEnvs())
it('authenticates before access, with no shared cache',async()=>{auth.mockResolvedValue({ok:false,response:Response.json({ok:false},{status:401})});for(const method of [GET,POST]){const r=await method(new Request(url,{method:method===POST?'POST':'GET'}));expect(r.status).toBe(401);expect(r.headers.get('Cache-Control')).toContain('no-store')}expect(rpc).not.toHaveBeenCalled()})
it('uses only caller-JWT RPC and strips extra private response fields',async()=>{const s=tournamentEntrySnapshot();s.receipt=tournamentReceipt();rpc.mockResolvedValue({data:{ok:true,...s,privateEmail:'secret'},error:null});const response=await GET(new Request(url+query));expect(response.status).toBe(200);expect(rpc).toHaveBeenCalledWith('native_tournament_registration',{p_action:'review',p_parent:'event-one',p_division:'division-one'});expect(await response.text()).not.toContain('secret');expect(response.headers.get('Referrer-Policy')).toBe('no-referrer')})
it.each(['','?parent=event-one','?parent=event-one&division=../bad','?parent=x&parent=y&division=z',query+'&owner=other',query+'&organizer=0'])('rejects malformed selection %s',async suffix=>{expect((await GET(new Request(url+suffix))).status).toBe(400);expect(rpc).not.toHaveBeenCalled()})
it('requires manager confirmation for the queue even on a successful RPC response',async()=>{expect((await GET(new Request(url+query+'&organizer=1'))).status).toBe(503);const s=tournamentEntrySnapshot();s.context.canManage=true;s.queue=[tournamentReceipt()];rpc.mockResolvedValue({data:{ok:true,...s},error:null});expect((await GET(new Request(url+query+'&organizer=1'))).status).toBe(200);expect(rpc).toHaveBeenLastCalledWith('native_tournament_registration',{p_action:'queue',p_parent:'event-one',p_division:'division-one'})})
it('validates submit details before the RPC, including owner injection and actual byte limit',async()=>{for(const b of [{...body(),owner:'other'},{...body(),data:{...body().data,owner:'other'}},{...body(),data:{...body().data,rating:4.2}},[]])expect((await POST(post(b))).status).toBe(400);expect((await POST(new Request(url,{method:'POST',headers:{'Content-Type':'application/json'},body:'x'.repeat(12001)}))).status).toBe(413);expect(rpc).not.toHaveBeenCalled()})
it('returns a bounded confirmation and preserves actionable conflicts without SQL errors',async()=>{const s=tournamentEntrySnapshot();s.receipt=tournamentReceipt();rpc.mockResolvedValue({data:{ok:true,...s,alreadySubmitted:false},error:null});expect((await POST(post(body()))).status).toBe(200);expect(rpc).toHaveBeenCalledWith('native_tournament_registration',{p_action:'submit',p_parent:'event-one',p_division:'division-one',p_data:body().data});rpc.mockResolvedValue({data:{ok:false,status:409,message:'The division changed. Refresh registration.'},error:null});expect((await POST(post(body()))).status).toBe(409);rpc.mockResolvedValue({data:null,error:Error('private SQL contact')});const r=await POST(post(body()));expect(r.status).toBe(503);expect(await r.text()).not.toContain('private SQL')})
it('rejects cross-account or cross-division confirmations',async()=>{for(const key of ['owner','division']){const s=tournamentEntrySnapshot();s.context[key as 'owner'|'division']='other';rpc.mockResolvedValue({data:{ok:true,...s},error:null});expect((await GET(new Request(url+query))).status).toBe(503)}})
it('returns just the private rehearsal receipt and refuses entry or queue changes',async()=>{
 const parent='tiq-native-event-74697166-6c74-4e10-8f11-000000000001'
 const division='tiq-native-division-74697166-6c74-4e10-8f11-000000000002'
 const endpoint='https://example.invalid/api/mobile/first-party/tournaments/entry'
 const exact=endpoint+'?parent='+parent+'&division='+division
 const snapshot=tournamentEntrySnapshot()
 Object.assign(snapshot.context,{parent,division,mode:'closed',locked:true})
 snapshot.receipt={...tournamentReceipt(),status:'approved',inDraw:true}
 const response=vi.fn().mockResolvedValue({data:{ok:true,...snapshot,privateEmail:'private@example.invalid'},error:null})
 rpc.mockImplementation((_name,{p_view})=>({abortSignal:()=>({retry:p_view==='walkthrough'
   ? async()=>({data:null,error:null}) : response})}))
 const result=await getFirstParty(new Request(exact))
 expect(result.status).toBe(200)
 const value=await result.json()
 expect(value).toMatchObject({scope:'first-party',receipt:{status:'approved',inDraw:true}})
 expect(value).not.toHaveProperty('privateEmail')
 expect((await getFirstParty(new Request(exact+'&organizer=1'))).status).toBe(404)
 expect((await postFirstParty(new Request(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},
  body:JSON.stringify({...body(),parent,division})}))).status).toBe(404)
 expect(rpc).toHaveBeenNthCalledWith(2,'native_tournament_alert_rehearsal',
  {p_parent:parent,p_division:division,p_view:'entry'})
 response.mockResolvedValue({data:null,error:null})
 expect((await getFirstParty(new Request(exact))).status).toBe(404)
})

it('submits a walkthrough entry using only the verified player and the exact private event revision',async()=>{
 const parent='tiq-native-event-74697166-6c74-4e10-8f11-000000000005'
 const division='tiq-native-division-74697166-6c74-4e10-8f11-000000000006'
 const publication={
  [parent]:{id:parent,is_public:false},
  [division]:{id:division,event_id:parent,is_public:false},
 }
 const available={viewer:owner,root:{id:parent},division:{id:division},publication}
 rpc.mockReturnValue({abortSignal:()=>({retry:async()=>({data:available,error:null})})})
 const snapshot=tournamentEntrySnapshot()
 Object.assign(snapshot.context,{parent,division})
 snapshot.receipt=tournamentReceipt()
 const secured=vi.fn().mockReturnValue({retry:async()=>({data:{ok:true,...snapshot,alreadySubmitted:false},error:null})})
 accountClient.mockReturnValue({rpc:secured})
 vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic')
 const request=()=>post({...body(),parent,division})
 const response=await postFirstParty(request())
 expect(response.status).toBe(200)
 expect(secured).toHaveBeenCalledExactlyOnceWith('native_first_party_tournament_registration',{
  p_actor:owner,p_action:'submit',p_parent:parent,p_division:division,p_publication:publication,p_data:body().data,
 })
 available.viewer='other'
 expect((await postFirstParty(request())).status).toBe(503)
 expect(secured).toHaveBeenCalledTimes(1)
})
