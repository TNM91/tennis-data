import { afterEach, expect, it, vi } from 'vitest'
import { GET, POST } from '../../app/api/mobile/first-party/tournaments/plan/route'

const { verifiedAccount, rpc } = vi.hoisted(() => ({ verifiedAccount: vi.fn(), rpc: vi.fn() }))
vi.mock('../mobile-account-auth', async importOriginal => ({
  ...await importOriginal<typeof import('../mobile-account-auth')>(),
  verifiedAccount, accountClient: () => ({ rpc }),
}))

const owner = '10000000-0000-4000-8000-000000000001'
const event = '10000000-0000-4000-8000-000000000002'
const division = 'tiq-native-division-10000000-0000-4000-8000-000000000003'
const id = 'tiq-native-event-10000000-0000-4000-8000-000000000004'
const revision = '1'.repeat(32)
const url = 'https://example.test/api/mobile/first-party/tournaments/plan?event=' + event
const write = () => new Request(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ action: 'publish', division, revision }) })
const row = (status: 'open' | 'scheduled') => ({
  id, name: 'Northside Open', date: '2099-06-06', zone: 'America/Chicago', revision,
  divisions: [{ id: division, name: 'Singles', format: 'single_elimination', status,
    entrants: ['Morgan Serve', 'Casey Court'], pending: 0, results: {}, schedule: {} }],
})
function signedIn() {
  vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', 'synthetic')
  verifiedAccount.mockResolvedValue({ user: { id: owner } })
}
afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetAllMocks()
})

it('scopes reads to the authenticated organizer and rejects extra selection fields', async () => {
  verifiedAccount.mockResolvedValueOnce(null)
  expect((await GET(new Request(url))).status).toBe(401)
  signedIn()
  expect((await GET(new Request(url + '&owner=someone-else'))).status).toBe(400)
  expect(rpc).not.toHaveBeenCalled()
  rpc.mockResolvedValueOnce({ data: row('open') })
  const result = await GET(new Request(url + '&division=' + division))
  expect(result.status).toBe(200)
  expect(result.headers.get('Cache-Control')).toBe('private, no-store')
  expect(await result.json()).toMatchObject({ owner, event, scope: 'first-party', plan: { division, matches: [{ id: 'r1-m1' }] } })
  expect(rpc).toHaveBeenCalledExactlyOnceWith('native_tournament_draw_plan', { p_owner: owner, p_event: event })
})

it('publishes only the selected revision and acknowledges a completed retry without a second write', async () => {
  signedIn()
  rpc.mockResolvedValueOnce({ data: row('open') })
  rpc.mockReturnValueOnce({ retry: async () => ({ data: row('scheduled') }) })
  const response = await POST(write())
  expect(await response.json()).toMatchObject({ ok: true, plan: { divisions: [{ status: 'scheduled' }] } })
  expect(rpc).toHaveBeenLastCalledWith('native_tournament_draw_plan', {
    p_owner: owner, p_event: event, p_action: 'publish', p_expected: revision, p_division: division,
  })
  rpc.mockResolvedValueOnce({ data: row('scheduled') })
  expect((await POST(write())).status).toBe(200)
  expect(rpc).toHaveBeenCalledTimes(3)
})

it('writes an organizer’s score to the same contestants and completes their division', async () => {
  signedIn()
  const request = () => new Request(url, {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
    action:'result',division,revision,match:'r1-m1',sides:['Morgan Serve','Casey Court'],result:{outcome:'retirement',score:'6-4, 2-1',side:'B'},
  })})
  const saved = {winner:'Casey Court',sideA:'Morgan Serve',sideB:'Casey Court',outcome:'retirement',score:'6-4, 2-1'}
  const completed = row('scheduled')
  Object.assign(completed.divisions[0],{status:'completed',results:{'r1-m1':saved}})
  rpc.mockResolvedValueOnce({data:row('scheduled')})
  rpc.mockReturnValueOnce({retry:async()=>({data:completed})})
  expect(await (await POST(request())).json()).toMatchObject({ok:true,plan:{matches:[
    {a:'Morgan Serve',b:'Casey Court',winner:'Casey Court',outcome:'retirement',score:'6-4, 2-1'},
  ]}})
  expect(rpc).toHaveBeenLastCalledWith('native_tournament_save_result',{
    p_owner:owner,p_event:event,p_expected:revision,p_division:division,p_match:'r1-m1',p_result:saved,p_complete:true,
  })
  rpc.mockResolvedValueOnce({data:completed})
  expect((await POST(request())).status).toBe(200)
  expect(rpc).toHaveBeenCalledTimes(3)
})
