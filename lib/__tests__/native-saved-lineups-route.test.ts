import {scenarioFixture} from './fixtures/captain-scenarios'
import {namedLineupRequest} from '../native-named-lineup-contract'
import {beforeEach,it,expect,vi} from 'vitest'
const s=vi.hoisted(()=>({allowed:false,service:vi.fn(),load:vi.fn(),save:vi.fn()}))
vi.mock('@/lib/captain-api-auth',()=>({getCaptainApiAuth:async()=>s.allowed?{ok:true,userId:'owner',supabase:'caller-rls'}:{ok:false,response:Response.json({ok:false},{status:401})}}))
vi.mock('@/lib/captain-availability-request-server',()=>({getCaptainAvailabilityServiceClient:s.service}))
vi.mock('@/lib/native-saved-lineups',()=>({loadNativeSavedLineups:s.load}))
vi.mock('@/lib/native-named-lineup-save',()=>({saveNativeNamedLineup:s.save}))
import {GET,POST} from '../../app/api/mobile/captain/saved-lineups/route'
beforeEach(()=>{s.allowed=false;vi.clearAllMocks();s.load.mockResolvedValue({ok:true,status:200});s.save.mockResolvedValue({ok:true,status:200})})
it('requires Captain authentication before private service access',async()=>{expect((await GET(new Request('https://synthetic.invalid'))).status).toBe(401);expect(s.service).not.toHaveBeenCalled();expect(s.load).not.toHaveBeenCalled()})
it('passes only the explicit owner/scope/fixture and marks the read private',async()=>{s.allowed=true;const r=await GET(new Request('https://synthetic.invalid?team=Aces&league=City&flight=4.0&match=match'));expect(r.status).toBe(200);expect(r.headers.get('Cache-Control')).toBe('private, no-store');expect(r.headers.get('Referrer-Policy')).toBe('no-referrer');expect(s.load).toHaveBeenCalledWith(undefined,'caller-rls','owner',{teamName:'Aces',leagueName:'City',flight:'4.0'},'match')})
it('contains private failures without exposing server details',async()=>{s.allowed=true;s.load.mockRejectedValue(Error('private secret'));const r=await GET(new Request('https://synthetic.invalid'));expect(r.status).toBe(503);expect(await r.text()).not.toContain('private secret')})

it('authenticates POST before parsing or accessing service state',async()=>{expect((await POST(new Request('https://synthetic.invalid',{method:'POST',body:'not JSON'}))).status).toBe(401);expect(s.save).not.toHaveBeenCalled()})
it('rejects non-JSON, oversized, malformed and invalid save bodies before writes',async()=>{s.allowed=true;for(const [body,type,status] of [['{}','text/plain',415],['x'.repeat(96001),'application/json',413],['{','application/json',400],['{}','application/json',400]] as const){expect((await POST(new Request('https://synthetic.invalid',{method:'POST',headers:{'Content-Type':type},body}))).status).toBe(status)}expect(s.save).not.toHaveBeenCalled()})

it('passes a validated POST only to the authenticated caller and keeps responses private',async()=>{s.allowed=true;const c=scenarioFixture(),body=namedLineupRequest(c.lineup,c.lineup.plan,'Option','11111111-1111-4111-8111-111111111111'),req=()=>new Request('https://synthetic.invalid',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const r=await POST(req());expect(r.status).toBe(200);expect(r.headers.get('Cache-Control')).toBe('private, no-store');expect(s.save).toHaveBeenCalledWith(undefined,'caller-rls','owner',body);s.save.mockRejectedValue(Error('private database detail'));const failure=await POST(req());expect(failure.status).toBe(503);expect(await failure.text()).not.toContain('private database detail')})
