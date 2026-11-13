import {afterEach,describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import {loadNativeTournaments} from '../native-tournaments'
import {testflightTournamentId} from '../testflight-tournament'
import {tournamentEntryDigest,tournamentRevisionDigest} from '../native-tournament-approvals'
import {getSignedInPlayerApiAuth} from '../player-api-auth'
import {GET as firstPartyTournaments} from '../../app/api/mobile/first-party/tournaments/route'
import {readTournamentSnapshot,tournamentInput} from '../native-tournaments-contract'
import {buildRoundRobinStandings,buildSingleEliminationPreview,buildTournamentPreview} from '../tournament-draw'
import {tournamentOwner as owner,tournamentSnapshot} from '../../tests/fixtures/native-tournaments'
import {loadTournaments} from '../../mobile/src/tournaments-data'
import {tournamentCardsHtml,tournamentDetailHtml} from '../../mobile/src/tournaments-view'
type Row=Record<string,unknown>
vi.mock('../player-api-auth', () => ({ getSignedInPlayerApiAuth: vi.fn() }))
afterEach(() => {
 vi.unstubAllEnvs()
 vi.resetAllMocks()
})

function fixture(){
 const root:Row={id:'event-one',event_id:null,is_event:true,name:'Northside Open',format:'round_robin',entrant_type:'players',status:'scheduled',starts_on:'2026-11-14',location_label:'Northside',event_details:{timeZone:'America/Chicago'},updated_at:'v1',is_public:true,entrants:[],results:{},schedule:{},director_notes:'secret',created_by_user_id:'director',entrant_player_ids:{Alex:'private-link'}}
 const division:Row={...root,id:'division-one',event_id:'event-one',is_event:false,name:'4.0 Doubles',entrants:['Alex','Casey','Jordan'],results:{'r1-m2':{winner:'Casey',score:'6-4 3-6 [10-8]'}},schedule:{'r1-m2':{date:'2026-11-14',time:'18:00',court:'2',change:{private:'secret'}}}}
 const rows:Row[]=[root,division],calls:{ops:unknown[][];table:string}[]=[],reads=new Map<string,number>();let change='',error=false
 const db={from(table:string){const c={table,ops:[] as unknown[][]};calls.push(c);const filters:((r:Row)=>boolean)[]=[];let max=Infinity,cols='',selected=''
  const get=()=>{let found=rows.filter(r=>filters.every(f=>f(r))).slice(0,max);if(selected){const count=(reads.get(selected)||0)+1;reads.set(selected,count);if(count>1&&change===selected)found=[]}return found.map(r=>Object.fromEntries(cols.split(',').map(k=>[k,r[k]])))}
  const q={
   in(k:string,values:unknown[]){filters.push(r=>values.includes(r[k]));c.ops.push(['in',k,values]);return q},
   select(v:string){cols=v;c.ops.push(['select',v]);return q},eq(k:string,v:unknown){if(k==='id')selected=String(v);filters.push(r=>r[k]===v);c.ops.push(['eq',k,v]);return q},neq(k:string,v:unknown){filters.push(r=>r[k]!==v);c.ops.push(['neq',k,v]);return q},is(k:string,v:unknown){filters.push(r=>r[k]===v);c.ops.push(['is',k,v]);return q},ilike(k:string,v:string){filters.push(r=>String(r[k]).toLowerCase().includes(v.slice(1,-1).replace(/\\(.)/g,'$1').toLowerCase()));c.ops.push(['ilike',k,v]);return q},order(...v:unknown[]){c.ops.push(['order',...v]);return q},limit(v:number){max=v;c.ops.push(['limit',v]);return q},abortSignal(){return q},maybeSingle(){return Promise.resolve({data:get()[0]||null,error:error?{}:null})},then(resolve:(r:unknown)=>unknown){return Promise.resolve({data:get(),error:error?{}:null}).then(resolve)}};return q}} as unknown as SupabaseClient
 return {db,rows,root,division,calls,change:(id:string)=>{change=id},fail:()=>{error=true}}
}

describe('first-party tournament route', () => {
 const request = (query = '') => new Request('https://example.test/api/mobile/first-party/tournaments' + query)
 const approve = (...rows: Row[]) => vi.stubEnv('TIQ_FIRST_PARTY_TOURNAMENT_APPROVALS', JSON.stringify(
  Object.fromEntries(rows.map(row => [String(row.id), {
   summary: tournamentRevisionDigest(row),
   draw: tournamentRevisionDigest(row, true),
  }])),
 ))
 const signedIn = (supabase: SupabaseClient) => {
  vi.mocked(getSignedInPlayerApiAuth).mockResolvedValue({ ok: true, supabase, userId: owner })
 }

 it('rejects anonymous requests and bad parameters without reading tournament data', async () => {
  const f = fixture()
  vi.mocked(getSignedInPlayerApiAuth).mockResolvedValue({ ok: false, response: new Response(null, { status: 401 }) })
  const denied = await firstPartyTournaments(request())
  expect(denied.status).toBe(401)
  expect(denied.headers.get('Cache-Control')).toBe('private, no-store')
  signedIn(f.db)
  expect((await firstPartyTournaments(request('?q=a&q=b'))).status).toBe(400)
  expect((await firstPartyTournaments(request('?scope=integrated'))).status).toBe(400)
  expect(f.calls).toEqual([])
 })

 it('defaults to an empty feed and fails closed when the approval list is invalid', async () => {
  const f = fixture()
  signedIn(f.db)
  vi.stubEnv('TIQ_FIRST_PARTY_TOURNAMENT_APPROVALS', '')
  const empty = await firstPartyTournaments(request())
  expect(empty.headers.get('Cache-Control')).toBe('private, no-store')
  expect(readTournamentSnapshot(await empty.json(), owner).tournaments).toEqual([])
  expect(f.calls).toHaveLength(1)
  expect((await firstPartyTournaments(request('?tournament=event-one'))).status).toBe(503)
  vi.stubEnv('TIQ_FIRST_PARTY_TOURNAMENT_APPROVALS', '{"event-one":{"summary":"invalid"}}')
  expect((await firstPartyTournaments(request())).status).toBe(503)
  expect(f.calls).toHaveLength(1)
 })

 it('lists the private doubles demo only for its owner and only in first-party tournaments', async () => {
  const f = fixture()
  const id = testflightTournamentId(owner)
  f.rows.push({...f.division,id,event_id:null,is_public:false,created_by_user_id:owner,entrant_type:'teams',
   name:'TestFlight Doubles Demo',registration_email:'',entrants:['Demo Casey / Demo Morgan','Demo Alex / Demo Sam'],
   results:{},schedule:{'r1-m1':{date:'2026-11-14',time:'10:00',court:'Demo Court 2'}}})
  signedIn(f.db)
  vi.stubEnv('TIQ_FIRST_PARTY_TOURNAMENT_APPROVALS', '')
  expect(await (await firstPartyTournaments(request())).json()).toMatchObject({tournaments:[{id}]})
  expect(await (await firstPartyTournaments(request('?tournament='+id))).json()).toMatchObject({
   detail:{entryAvailable:true,matches:[{court:'Demo Court 2'}]},
  })
  expect((await loadNativeTournaments(f.db,owner)).tournaments.map(t=>t.id)).toEqual(['event-one'])
  vi.mocked(getSignedInPlayerApiAuth).mockResolvedValue({ok:true,supabase:f.db,userId:'20000000-0000-4000-8000-000000000002'})
  expect(await (await firstPartyTournaments(request())).json()).toMatchObject({tournaments:[]})
  expect((await firstPartyTournaments(request('?tournament='+id))).status).toBe(503)
 })

 it('returns only the reviewed event and division through the existing tournament contract', async () => {
  const f = fixture()
  const unreviewed = { ...f.division, id: 'division-unreviewed' }
  f.rows.push({ ...f.root, id: 'event-unreviewed' }, unreviewed)
  signedIn(f.db)
  approve(f.root, f.division)
  const list = await firstPartyTournaments(request('?q=Northside'))
  expect(readTournamentSnapshot(await list.json(), owner, 'Northside').tournaments.map(t => t.id)).toEqual(['event-one'])
  expect(f.calls[0].ops).toContainEqual(['in', 'id', ['event-one', 'division-one']])
  const detail = await firstPartyTournaments(request('?tournament=event-one&division=division-one'))
  const snapshot = readTournamentSnapshot(await detail.json(), owner, '', 'event-one', 'division-one')
  expect(snapshot.detail?.divisions.map(t => t.id)).toEqual(['division-one'])
  expect(snapshot.detail?.matches.find(m => m.id === 'r1-m2')).toMatchObject({ winner: 'Casey', court: '2' })
  expect((await firstPartyTournaments(request('?tournament=event-unreviewed'))).status).toBe(503)
  expect((await firstPartyTournaments(request('?tournament=event-one&division=division-unreviewed'))).status).toBe(503)
 })

 it('withholds edited content even when an approved ID and timestamp are reused', async () => {
  const f = fixture()
  signedIn(f.db)
  approve(f.root, f.division)
  f.division.results = { 'r1-m2': { winner: 'Jordan', score: '6-0 6-0' } }
  const detail = await firstPartyTournaments(request('?tournament=event-one&division=division-one'))
  expect(detail.status).toBe(503)
  expect(await detail.text()).not.toContain('Jordan')
  f.root.event_details = { ...f.root.event_details as object, subtitle: 'New event text' }
  const list = await firstPartyTournaments(request())
  expect(readTournamentSnapshot(await list.json(), owner).tournaments).toEqual([])
  expect((await firstPartyTournaments(request('?tournament=event-one'))).status).toBe(503)
 })

 it('shows a rescheduled time and court after the new division revision is approved', async () => {
  const f = fixture()
  signedIn(f.db)
  approve(f.root, f.division)
  const url = '?tournament=event-one&division=division-one'
  f.division.schedule = { 'r1-m2': { date: '2026-11-14', time: '19:00', court: 'Court 5' } }
  expect((await firstPartyTournaments(request(url))).status).toBe(503)
  approve(f.root, f.division)
  const latest = readTournamentSnapshot(await (await firstPartyTournaments(request(url))).json(), owner, '', 'event-one', 'division-one')
  expect(latest.detail?.matches.find(match => match.id === 'r1-m2')).toMatchObject({ time: '19:00', court: 'Court 5' })
 })

 it('exposes entry only for a separately approved event and division', async () => {
  const f = fixture()
  signedIn(f.db)
  f.root.registration_email='director@example.test'
  f.division.registration_email='director@example.test'
  const config=(includeParent:boolean)=>JSON.stringify(Object.fromEntries(f.rows.map(row=>[String(row.id),{
   summary:tournamentRevisionDigest(row),draw:tournamentRevisionDigest(row,true),
   ...(includeParent||row===f.division?{entry:tournamentEntryDigest(row)}:{}),
  }])))
  const selection=request('?tournament=event-one&division=division-one')
  vi.stubEnv('TIQ_FIRST_PARTY_TOURNAMENT_APPROVALS',config(false))
  expect((await (await firstPartyTournaments(selection)).json()).detail.entryAvailable).toBe(false)
  vi.stubEnv('TIQ_FIRST_PARTY_TOURNAMENT_APPROVALS',config(true))
  const published=await firstPartyTournaments(selection)
  expect((await published.json()).detail.entryAvailable).toBe(true)
  f.root.registration_email='changed@example.test'
  expect((await (await firstPartyTournaments(selection)).json()).detail.entryAvailable).toBe(false)
 })
})

describe('native public tournament browsing',()=>{
 it('lists only root published events with bounded metadata and no private desk data',async()=>{const f=fixture();f.rows.push({...f.root,id:'private',is_public:false},{...f.root,id:'draft',status:'draft'});const r=await loadNativeTournaments(f.db,owner);expect(r.tournaments.map(t=>t.id)).toEqual(['event-one']);expect(f.calls).toHaveLength(1);expect(f.calls[0].ops).toContainEqual(['is','event_id',null]);expect(f.calls[0].ops).toContainEqual(['limit',21]);expect(f.calls[0].ops).toContainEqual(['eq','is_public',true]);expect(f.calls[0].ops).toContainEqual(['neq','status','draft']);expect(JSON.stringify(r)).not.toMatch(/secret|director_notes|entrant_player_ids|created_by_user_id/);expect(readTournamentSnapshot({ok:true,...r},owner)).toEqual(r)})
 it('loads only the chosen public division and reuses published pairings, results and ordinary games',async()=>{const f=fixture(),r=await loadNativeTournaments(f.db,owner,'','event-one','division-one');expect(r.detail?.standings.find(s=>s.name==='Casey')).toMatchObject({wins:1,losses:0,gamesWon:9,gamesLost:10});expect(r.detail?.matches.find(m=>m.id==='r1-m2')).toMatchObject({winner:'Casey',court:'2',score:'6-4 3-6 [10-8]'});expect(f.calls.every(c=>c.table==='tiq_tournaments')).toBe(true);expect(JSON.stringify(r)).not.toContain('private');expect(readTournamentSnapshot({ok:true,...r},owner,'','event-one','division-one')).toEqual(r)})
 it('does not allow private/draft roots or divisions, direct child roots or foreign division selections',async()=>{for(const patch of [{is_public:false},{status:'draft'}]){const f=fixture();Object.assign(f.root,patch);await expect(loadNativeTournaments(f.db,owner,'','event-one')).rejects.toThrow();const child=fixture();Object.assign(child.division,patch);await expect(loadNativeTournaments(child.db,owner,'','event-one','division-one')).rejects.toThrow()}const f=fixture();await expect(loadNativeTournaments(f.db,owner,'','division-one')).rejects.toThrow();f.division.event_id='foreign';await expect(loadNativeTournaments(f.db,owner,'','event-one','division-one')).rejects.toThrow()})
 it('fails closed if root visibility or the selected draw changes during dependent reads',async()=>{for(const id of ['event-one','division-one']){const f=fixture();f.change(id);await expect(loadNativeTournaments(f.db,owner,'','event-one','division-one')).rejects.toThrow()}})
 it('does not propagate a nonexistent winner or a stale side-bound result',async()=>{for(const result of [{winner:'Ghost',score:'6-0'},{winner:'Casey',score:'6-0',sideA:'Changed',sideB:'Jordan'}]){const f=fixture();f.division.results={'r1-m2':result};const r=await loadNativeTournaments(f.db,owner,'','event-one','division-one');expect(r.detail?.matches.every(m=>!m.winner)).toBe(true);expect(r.detail?.standings.every(s=>!s.played)).toBe(true)}})
 it('does not advance bogus first-round winners into later knockout rounds',async()=>{const f=fixture();f.division.format='single_elimination';f.division.entrants=['A','B','C','D'];f.division.results={'r1-m1':{winner:'Ghost',score:'6-0'},'r1-m2':{winner:'B',score:'6-0'},'r2-m1':{winner:'Ghost',score:'6-0'}};const r=await loadNativeTournaments(f.db,owner,'','event-one','division-one');expect(r.detail?.matches.find(m=>m.id==='r2-m1')).toMatchObject({a:'Winner R1.1',b:'B',winner:''})})
 it('preserves the website’s strict opponent binding for group-play results',async()=>{const f=fixture(),entrants=Array.from({length:8},(_,i)=>'Player '+i);f.division.format='group_playoffs';f.division.entrants=entrants;const match=buildTournamentPreview({format:'group_playoffs',entrants}).find(m=>entrants.includes(m.sideA)&&entrants.includes(m.sideB))!;f.division.results={[match.id]:{winner:match.sideA,score:'6-0',updatedAt:''}};const r=await loadNativeTournaments(f.db,owner,'','event-one','division-one');expect(r.detail?.matches.every(m=>!m.winner)).toBe(true);expect(r.detail?.standings.every(s=>s.played===0)).toBe(true);expect(buildTournamentPreview({format:'group_playoffs',entrants,results:f.division.results as Parameters<typeof buildTournamentPreview>[0]['results']}).every(m=>!m.result?.winner)).toBe(true)})
 it('keeps group qualification and championship results consistent with the shared website draw',async()=>{const f=fixture();f.division.format='group_playoffs';const entrants=Array.from({length:8},(_,i)=>'Player '+i),results:Record<string,{winner:string;score:string;updatedAt:string;sideA:string;sideB:string}>={};f.division.entrants=entrants
  for(let pass=0;pass<12;pass++){let added=0;for(const m of buildTournamentPreview({format:'group_playoffs',entrants,results})){if(!results[m.id]&&entrants.includes(m.sideA)&&entrants.includes(m.sideB)){results[m.id]={winner:m.sideA,score:'6-4',updatedAt:'',sideA:m.sideA,sideB:m.sideB};added++}}if(!added)break}
  f.division.results=results;const r=await loadNativeTournaments(f.db,owner,'','event-one','division-one'),shared=buildTournamentPreview({format:'group_playoffs',entrants,results}).filter(m=>m.sideA!=='Bye'&&m.sideB!=='Bye');expect(r.detail?.matches.map(m=>[m.id,m.winner])).toEqual(shared.map(m=>[m.id,m.result?.winner||'']));expect(r.detail?.standings).toHaveLength(8);expect(r.detail?.standings.every(s=>!!s.group)).toBe(true)
 })
 it('withholds whole oversized or unsupported draws instead of showing partial standings',async()=>{for(const patch of [{entrants:Array.from({length:65},(_,i)=>'Player '+i)},{format:'compass_draw'},{results:Object.fromEntries(Array.from({length:501},(_,i)=>['m'+i,{}]))},{entrants:Array.from({length:33},(_,i)=>'Player '+i)}]){const f=fixture();Object.assign(f.division,patch);const r=await loadNativeTournaments(f.db,owner,'','event-one','division-one');expect(r.detail).toMatchObject({drawNotice:expect.any(String),matches:[],standings:[]});expect(r.detail!.drawNotice).not.toBe('');expect(tournamentDetailHtml(r.detail!,'home')).not.toContain('competition-metrics')}})
 it('discloses list and division limits and searches literal names',async()=>{const f=fixture();for(let i=0;i<20;i++)f.rows.push({...f.root,id:'event-'+i});expect(await loadNativeTournaments(f.db,owner)).toMatchObject({more:true,tournaments:expect.any(Array)});const c=fixture();for(let i=0;i<20;i++)c.rows.push({...c.division,id:'division-'+i});expect((await loadNativeTournaments(c.db,owner,'','event-one')).detail).toMatchObject({moreDivisions:true,divisions:expect.any(Array)});await loadNativeTournaments(c.db,owner,'Northside');expect(c.calls.at(-1)?.ops).toContainEqual(['ilike','name','%Northside%'])})
 it('supports standalone draws and never reads private registration/court call tables',async()=>{const f=fixture();f.rows.splice(0,1);f.division.event_id=null;const r=await loadNativeTournaments(f.db,owner,'','division-one');expect(r.detail?.active?.id).toBe('division-one');expect(readTournamentSnapshot({ok:true,...r},owner,'','division-one')).toEqual(r);expect(f.calls.every(c=>c.table==='tiq_tournaments')).toBe(true)})
 it('rejects malformed inputs before any read and does not silently recover failed queries',async()=>{for(const input of [['x'.repeat(81),'',''],['','../private',''],['','','division-one']]){const f=fixture();await expect(loadNativeTournaments(f.db,owner,...input as [string,string,string])).rejects.toThrow();expect(f.calls).toHaveLength(0)}const f=fixture();f.fail();await expect(loadNativeTournaments(f.db,owner)).rejects.toThrow();expect(()=>tournamentInput('','','x')).toThrow()})
})
describe('tournament phone boundary, copy and shared calculations',()=>{
 it('rejects wrong owner, stale root/division, contradictory totals and incomplete draw payloads',()=>{const r=tournamentSnapshot('event-one','division-one');for(const patch of [{owner:'other'},{selected:'other'},{division:'other'},{detail:{...r.detail,active:{...r.detail!.active,parentId:'other'}}},{detail:{...r.detail,standings:[{...r.detail!.standings[0],wins:4}]}},{detail:{...r.detail,drawNotice:'Incomplete'}}])expect(()=>readTournamentSnapshot({ok:true,...r,...patch},owner,'','event-one','division-one')).toThrow()})
 it('escapes names and makes the schedule/status boundaries explicit',()=>{const r=tournamentSnapshot('event-one','division-one');r.detail!.active!.name='<Ace>';expect(tournamentCardsHtml([r.detail!.active!])).toContain('&lt;Ace&gt;');expect(tournamentDetailHtml(r.detail!,'schedule')).toContain('Published court assignments');expect(tournamentDetailHtml(r.detail!,'results')).not.toContain('Jordan Serve');expect(tournamentDetailHtml(r.detail!,'standings')).toContain('12–7 games')})
 it('uses one match win per player and excludes all tiebreak point notation from ordinary games',()=>{for(const score of ['6-4 3-6 [10-8]','6–4 3–6 10–8']){expect(buildRoundRobinStandings({format:'round_robin',entrants:['A','B'],results:{'r1-m1':{winner:'A',score,updatedAt:''}}})).toMatchObject([{entrant:'A',played:1,wins:1,gamesWon:9,gamesLost:10},{entrant:'B',played:1,losses:1,gamesWon:10,gamesLost:9}])}expect(buildSingleEliminationPreview(['A','B'])).toHaveLength(1)})
 it('revalidates the account after native transport and never follows redirects/caches account data',async()=>{let current=true;const client={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'synthetic'}}})}} as unknown as SupabaseClient;const send=async(o:{url:string;disableRedirects?:boolean;headers?:Record<string,string>})=>{expect(o.url).toBe('https://www.tenaceiq.com/api/mobile/tournaments?q=');expect(o.disableRedirects).toBe(true);expect(o.headers?.['Cache-Control']).toBe('no-store');return {status:200,data:{ok:true,...tournamentSnapshot()},headers:{},url:o.url}};expect(await loadTournaments(client,owner,()=>current,'','','',send)).toEqual(tournamentSnapshot());await expect(loadTournaments(client,owner,()=>current,'','','',async o=>{current=false;return send(o)})).rejects.toThrow()})
})
