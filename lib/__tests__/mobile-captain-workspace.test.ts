import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {parseCaptainData,loadCaptainData,loadCaptainReplies} from '../../mobile/src/captain-data'
import {captainDraftHtml,captainRepliesHtml} from '../../mobile/src/captain-view'
const scope={teamName:'Aces',leagueName:'City',flight:'4.0'},match={id:'match',date:'2026-10-30',time:'18:00',facility:'Club',opponent:'Rallies'}
const raw=()=>({ok:true,scope,roster:[{id:'player',name:'<Alex>'}],matches:[match],drafts:[{matchDate:match.date,opponent:'Rallies',status:'working',notes:'<script>private</script>',courts:[{label:'D1',players:['<Alex>','Jordan']}]}]})
const client={auth:{getSession:async()=>({data:{session:{user:{id:'owner'},access_token:'synthetic'}},error:null})}} as unknown as SupabaseClient
const replies=()=>({scope:{team:'Aces',league:'City',flight:'4.0'},match:{id:'match',match_date:match.date,home_team:'Aces',away_team:'Rallies'},summary:{people:[{key:'p',name:'<Alex>',status:'available',source:'season',selected:true}]},selection:'draft',dayScopedAnswersOmitted:true})
describe('native Captain transport and rendering',()=>{
 it('rejects another team/flight and unbounded responses before showing private data',()=>{
  expect(parseCaptainData(raw(),scope).roster[0].name).toBe('<Alex>')
  for(const patch of [{scope:{...scope,flight:'4.5'}},{roster:Array(251).fill({})},{drafts:Array(21).fill({})},{matches:Array(41).fill({})}])expect(()=>parseCaptainData({...raw(),...patch},scope)).toThrow()
 })
 it('uses only fixed HTTPS reads with the current owner and suppresses late results',async()=>{
  const send=vi.fn().mockResolvedValue({status:200,data:raw()});await loadCaptainData(client,'owner',()=>true,scope,send)
  expect(send.mock.calls[0][0]).toMatchObject({headers:{Authorization:'Bearer synthetic'},disableRedirects:true,readTimeout:30000})
  expect(new URL(send.mock.calls[0][0].url).pathname).toBe('/api/mobile/captain')
  send.mockClear();await expect(loadCaptainData(client,'other',()=>true,scope,send)).rejects.toThrow('Sign in');expect(send).not.toHaveBeenCalled()
  let current=true;send.mockImplementationOnce(async()=>{current=false;return {status:200,data:raw()}});await expect(loadCaptainData(client,'owner',()=>current,scope,send)).rejects.toThrow('no longer')
  send.mockRejectedValueOnce(Error('sensitive underlying transport detail'));await expect(loadCaptainData(client,'owner',()=>true,scope,send)).rejects.not.toThrow('sensitive')
 })
 it('requires fixture id, date, opponent and exact scope for availability replies',async()=>{
  const send=vi.fn().mockResolvedValue({status:200,data:replies()})
  expect((await loadCaptainReplies(client,'owner',()=>true,scope,match,send)).people[0].selected).toBe(true)
  for(const patch of [{match:{...replies().match,id:'other'}},{scope:{...replies().scope,flight:'4.5'}},{match:{...replies().match,away_team:'Other'}}]){send.mockResolvedValueOnce({status:200,data:{...replies(),...patch}});await expect(loadCaptainReplies(client,'owner',()=>true,scope,match,send)).rejects.toThrow('selected fixture')}
  send.mockResolvedValueOnce({status:409});await expect(loadCaptainReplies(client,'owner',()=>true,scope,match,send)).rejects.toThrow('can’t be combined')
 })
 it('escapes roster, notes and lineup names while explaining reply source and double-header omissions',()=>{
  const draft=captionDraft(),markup=captainDraftHtml(draft);expect(markup).not.toContain('<script>');expect(markup).toContain('&lt;script&gt;');expect(markup).toContain('&lt;Alex&gt;')
  const html=captainRepliesHtml({people:[{key:'p',name:'<Alex>',status:'available',source:'season',selected:true}],selection:'draft',dayScopedAnswersOmitted:true});expect(html).toContain('Season reply');expect(html).toContain('Selected');expect(html).toContain('Day-only replies are excluded');expect(html).not.toContain('<Alex>')
 })
})
function captionDraft(){return parseCaptainData(raw(),scope).drafts[0]}
