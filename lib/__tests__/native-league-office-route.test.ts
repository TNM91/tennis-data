import {beforeEach,it,expect,vi} from 'vitest'
const s=vi.hoisted(()=>({signed:false,allowed:false,load:vi.fn(),access:vi.fn()}))
vi.mock('@/lib/player-api-auth',()=>({getSignedInPlayerApiAuth:async()=>s.signed?{ok:true,userId:'owner',supabase:'caller-rls'}:{ok:false,response:Response.json({ok:false},{status:401})},loadPlayerAccess:s.access}))
vi.mock('@/lib/native-league-office',()=>({loadNativeLeagueOffice:s.load}))
import {GET} from '../../app/api/mobile/league-office/route'
beforeEach(()=>{vi.clearAllMocks();s.signed=false;s.allowed=false;s.access.mockImplementation(async()=>({canUseLeagueTools:s.allowed}));s.load.mockResolvedValue({owner:'owner',leagues:[],detail:null})})
it('requires authentication and current League Office access before reads',async()=>{expect((await GET(new Request('https://synthetic.invalid'))).status).toBe(401);expect(s.access).not.toHaveBeenCalled();expect(s.load).not.toHaveBeenCalled();s.signed=true;expect((await GET(new Request('https://synthetic.invalid'))).status).toBe(403);expect(s.load).not.toHaveBeenCalled()})
it('passes only the signed-in caller, owner and explicit selection with private caching',async()=>{s.signed=s.allowed=true;const r=await GET(new Request('https://synthetic.invalid?league=selected&owner=other'));expect(r.status).toBe(200);expect(s.load).toHaveBeenCalledWith('caller-rls','owner','selected');expect(r.headers.get('Cache-Control')).toBe('private, no-store');expect(r.headers.get('Referrer-Policy')).toBe('no-referrer')})
it('contains database failures without returning private error details',async()=>{s.signed=s.allowed=true;s.load.mockRejectedValue(Error('private info'));const r=await GET(new Request('https://synthetic.invalid'));expect(r.status).toBe(503);expect(await r.text()).not.toContain('private info')})
