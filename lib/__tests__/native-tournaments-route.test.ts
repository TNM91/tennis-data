import {it,expect,vi,beforeEach} from 'vitest'
const {auth,load}=vi.hoisted(()=>({auth:vi.fn(),load:vi.fn()}))
vi.mock('../player-api-auth',()=>({getSignedInPlayerApiAuth:auth}))
vi.mock('../native-tournaments',()=>({loadNativeTournaments:load}))
import {GET} from '../../app/api/mobile/tournaments/route'
beforeEach(()=>{vi.clearAllMocks();auth.mockResolvedValue({ok:true,supabase:{caller:'rls'},userId:'owner'});load.mockResolvedValue({owner:'owner',leagues:[],detail:null})})
it('requires verified sign-in before any tournament read',async()=>{auth.mockResolvedValue({ok:false,response:Response.json({ok:false},{status:401})});const r=await GET(new Request('https://example.invalid/api/mobile/tournaments'));expect(r.status).toBe(401);expect(r.headers.get('Cache-Control')).toContain('no-store');expect(load).not.toHaveBeenCalled()})
it('passes only the verified caller and normalized request through without paid-tier gating',async()=>{const r=await GET(new Request('https://example.invalid/api/mobile/tournaments?q=Night%20%20Open'));expect(r.status).toBe(200);expect(load).toHaveBeenCalledWith({caller:'rls'},'owner','Night Open','','');expect(r.headers.get('Cache-Control')).toBe('private, no-store')})
it.each(['?owner=foreign','?division=orphan','?tournament=../secret','?q='+('x'.repeat(81)),'?q=one&q=two'])('rejects invalid input %s',async suffix=>{expect((await GET(new Request('https://example.invalid/api/mobile/tournaments'+suffix))).status).toBe(400);expect(load).not.toHaveBeenCalled()})
it('withholds database error details and stale records on a failure',async()=>{load.mockRejectedValue(Error('private database payload'));const r=await GET(new Request('https://example.invalid/api/mobile/tournaments'));expect(r.status).toBe(503);expect(await r.text()).not.toContain('private database')})
