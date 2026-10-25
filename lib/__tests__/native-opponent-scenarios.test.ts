import {beforeEach,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {opponentScenarioFixture} from './fixtures/opponent-scenarios'
const s=vi.hoisted(()=>({load:vi.fn(),from:vi.fn(),select:vi.fn(),inside:vi.fn(),limit:vi.fn()}))
vi.mock('../native-captain-court-scout',()=>({loadNativeCaptainCourtScout:s.load}))
import {loadNativeOpponentScenarios} from '../native-opponent-scenarios'
const service={from:s.from} as unknown as SupabaseClient,c=opponentScenarioFixture().opp
beforeEach(()=>{vi.clearAllMocks();s.load.mockResolvedValue({ok:true,status:200,...c});s.from.mockReturnValue({select:s.select});s.select.mockReturnValue({in:s.inside});s.inside.mockReturnValue({limit:s.limit});s.limit.mockResolvedValue({data:c.ratings,error:null})})
it('authorizes exact owner/fixture/history before any additional rating query',async()=>{s.load.mockResolvedValue({ok:false,status:403});expect(await loadNativeOpponentScenarios(service,c.owner,c.scope,c.match.id)).toEqual({ok:false,status:403});expect(s.from).not.toHaveBeenCalled();expect(s.load).toHaveBeenCalledWith(service,c.owner,c.scope,c.match.id)})
it('reads only linked opponent public rating IDs with a fixed cap',async()=>{expect(await loadNativeOpponentScenarios(service,c.owner,c.scope,c.match.id)).toMatchObject({ok:true,ratings:c.ratings});expect(s.from).toHaveBeenCalledWith('players');expect(s.inside).toHaveBeenCalledWith('id',c.records.players.map(p=>p.id));expect(s.limit).toHaveBeenCalledWith(321)})
it('skips unbounded fallbacks for empty histories and contains query failures',async()=>{s.load.mockResolvedValue({ok:true,status:200,...c,records:{...c.records,players:[]}});expect(await loadNativeOpponentScenarios(service,c.owner,c.scope,c.match.id)).toMatchObject({ratings:[]});expect(s.from).not.toHaveBeenCalled();s.load.mockResolvedValue({ok:true,status:200,...c});s.limit.mockResolvedValue({data:null,error:{message:'private'}});expect(await loadNativeOpponentScenarios(service,c.owner,c.scope,c.match.id)).toEqual({ok:false,status:503})})
