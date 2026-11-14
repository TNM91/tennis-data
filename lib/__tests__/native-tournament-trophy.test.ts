import { afterEach, expect, it, vi } from 'vitest'
import { GET, POST } from '../../app/api/mobile/first-party/tournaments/trophy/route'
import { POST as claim } from '../../app/api/mobile/first-party/tournaments/trophy/claim/route'
import { tournamentTitleContenders } from '../native-tournament-trophy'
import { buildRoundRobinPreview } from '../tournament-draw'

const { account, rpc } = vi.hoisted(() => ({ account: vi.fn(), rpc: vi.fn() }))
vi.mock('../mobile-account-auth', async importOriginal => ({
  ...await importOriginal<typeof import('../mobile-account-auth')>(),
  verifiedAccount: account, accountClient: () => ({ rpc }),
}))
const key = '10000000-0000-4000-8000-00000000000'
const owner = key+'1', event = key+'2', awardId = key+'3', code = key+'4'
const division = 'tiq-native-division-'+key+'5', revision = '1'.repeat(32)
const root = 'https://example.test/api/mobile/first-party/tournaments/trophy'
const url = root + '?event=' + event + '&division=' + division
const match = {sideA:'Morgan Serve',sideB:'Casey Court',winner:'Casey Court',score:'4-6, 4-6'}
const row = {id:division,name:'Singles',format:'single_elimination',entrants:[match.sideA,match.sideB],
  status:'completed',schedule:{},results:{'r1-m1':match}}
const snapshot = {name:'Northside Open',revision,divisions:[row]}
const award = {id:awardId,champion:'Casey Court',paired:false,partnerCode:null,partnerClaimed:false}
const send = (body: object, path = url) => new Request(path,{method:'POST',
  headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})

afterEach(() => {vi.unstubAllEnvs();vi.resetAllMocks()})
function signedIn() {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY','synthetic')
  account.mockResolvedValue({user:{id:owner}})
}

it('previews only the completed draw champion and rejects requests for arbitrary recipients', async () => {
  account.mockResolvedValueOnce(null)
  expect((await GET(new Request(url))).status).toBe(401)
  signedIn()
  rpc.mockResolvedValueOnce({data:snapshot}).mockResolvedValueOnce({data:{revision,award:null}})
  expect(await (await GET(new Request(url))).json()).toMatchObject({scope:'first-party',owner,
    preview:{division,contenders:['Casey Court'],revision,award:null}})
  rpc.mockResolvedValueOnce({data:snapshot})
  expect((await POST(send({action:'award',revision,champion:'Morgan Serve'}))).status).toBe(409)
  expect(rpc).toHaveBeenCalledTimes(3)
  rpc.mockResolvedValueOnce({data:snapshot}).mockReturnValueOnce({retry:async()=>({data:{award}})})
  expect(await (await POST(send({action:'award',revision,champion:'Casey Court'}))).json()).toMatchObject({award})
  expect(rpc).toHaveBeenLastCalledWith('native_tournament_title',{p_owner:owner,p_event:event,p_division:division,
    p_action:'award',p_expected:revision,p_champion:'Casey Court'})
})

it('limits a tied round robin selection to the wins leaders', () => {
  const entrants = ['Alex','Casey','Drew','Morgan']
  const draws = buildRoundRobinPreview(entrants)
  const beat: Record<string,string[]> = {Alex:['Drew','Morgan'],Casey:['Alex','Morgan'],Drew:['Casey','Morgan']}
  const results = Object.fromEntries(draws.map(match=>[match.id,{
    sideA:match.sideA,sideB:match.sideB,winner:beat[match.sideA]?.includes(match.sideB)?match.sideA:match.sideB,score:'',
  }]))
  const tournament = {...row, format:'round_robin', entrants, results}
  expect(tournamentTitleContenders(tournament).sort()).toEqual(['Alex','Casey','Drew'])
  expect(tournamentTitleContenders({...tournament,status:'scheduled'})).toEqual([])
  expect(tournamentTitleContenders({...tournament,results:{}})).toEqual([])
})

it('binds the private claim to the signed-in account and returns only the trophy ID', async () => {
  signedIn()
  expect((await claim(send({code,owner:'other'},root+'/claim'))).status).toBe(400)
  expect(rpc).not.toHaveBeenCalled()
  rpc.mockReturnValueOnce({retry:async()=>({data:null})})
  expect((await claim(send({code},root+'/claim'))).status).toBe(404)
  rpc.mockReturnValueOnce({retry:async()=>({data:awardId})})
  expect(await (await claim(send({code},root+'/claim'))).json()).toEqual({
    ok:true,scope:'first-party',owner,trophyId:'tiq-title-'+awardId,
  })
  expect(rpc).toHaveBeenLastCalledWith('claim_native_tournament_trophy',{p_owner:owner,p_code:code})
})
