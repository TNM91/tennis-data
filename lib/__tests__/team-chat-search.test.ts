import {firstChatPlan,parseChatPlan} from '../team-chat-plan-links'
import {practiceRsvpPath} from '../captain-practice-rsvp'
import {describe,it,expect,vi} from 'vitest'
import type {SupabaseClient} from '@supabase/supabase-js'
import type {SentTeamMessage} from '../team-room-message-send'
import {chatSearchMatch,isPublishedChatPoll,searchTeamChatRows,searchPhotoMime,publicChatSearchResult,chatSearchPreview} from '../team-chat-search'
import {chatSearchInput,chatSearchCursorProgress,parseChatSearchMatch} from '../team-chat-search-contract'
import {teamChatCursor} from '../team-chat-cursor'
import {readChatSearch,parseChatSearch,searchResultHtml} from '../../mobile/src/chat-history-search'
const owner='11111111-1111-4111-8111-111111111111',id=(n:number)=>`22222222-2222-4222-8222-${String(n).padStart(12,'0')}`
const post=(n:number,patch:Record<string,unknown>={})=>({id:id(n),sender_user_id:'sender',body:'Practice court 3',message_kind:'message',metadata:null,created_at:'2026-10-24T12:00:00.123456+00:00',edited_at:null,deleted_at:null,reply_to_message_id:null,...patch})
function database(rows:SentTeamMessage[]=[],patch:Record<string,unknown>={}){const calls:{table:string;method:string;args:unknown[]}[]=[],results:Record<string,unknown>={internal_messages:{data:rows,error:null},participant:{data:{last_read_at:''}},removal:{data:null},team_chat_blocks:{data:[]},...patch};const service={from:(table:string)=>{const q:Record<string,unknown>={};for(const method of ['select','eq','is','not','order','or','limit'])q[method]=(...args:unknown[])=>{calls.push({table,method,args});return q};q.maybeSingle=async()=>results[table==='internal_conversation_participants'?'participant':'removal'];q.then=(resolve:(value:unknown)=>void)=>Promise.resolve(resolve(results[table]));return q}} as unknown as SupabaseClient;return {service,calls}}
describe('private bounded team history search',()=>{
 it('validates literal query, collection and cursor without reading rows for malformed requests',async()=>{for(const args of [['x','all',''],['x'.repeat(121),'all',''],['a\nb','all',''],['court','everyone',''],['court','all','bad cursor']]){const db=database();expect(await searchTeamChatRows(db.service,owner,'room',...args as [string,string,string])).toMatchObject({status:400});expect(db.calls).toEqual([])}expect(chatSearchInput('  Court 3  ','all','')).toEqual({query:'Court 3',kind:'all',before:''})})
 it('checks current membership, removals for every role and blocks before reading content',async()=>{for(const patch of [{participant:{data:null}},{removal:{data:{profile_id:owner}}},{participant:{error:{}}},{team_chat_blocks:{error:{}}}]){const db=database([post(1)],patch);expect(await searchTeamChatRows(db.service,owner,'room','court','all','')).toMatchObject({ok:false});expect(db.calls.some(call=>call.table==='internal_messages')).toBe(false)}})
 it('uses only exact-room ordered reads and a validated microsecond tuple; no storage or mutation API is available',async()=>{const before=teamChatCursor('2026-10-24T12:00:00.123457Z',id(999)),db=database([post(1)]);expect(await searchTeamChatRows(db.service,owner,'room','COURT','all',before)).toMatchObject({ok:true,rows:[post(1)]});expect(db.calls).toContainEqual({table:'internal_messages',method:'eq',args:['conversation_id','room']});expect(db.calls).toContainEqual({table:'internal_messages',method:'limit',args:[201]});expect(db.calls).toContainEqual({table:'internal_messages',method:'or',args:[`created_at.lt.2026-10-24T12:00:00.123457Z,and(created_at.eq.2026-10-24T12:00:00.123457Z,id.lt.${id(999)})`]});expect(new Set(db.calls.map(call=>call.method))).toEqual(new Set(['select','eq','limit','is','not','or','order']))})
 it('returns at most 25 matches and resumes after the last inspected row, without skipping later matches',async()=>{const rows=Array.from({length:201},(_,i)=>post(1000-i)),db=database(rows),result=await searchTeamChatRows(db.service,owner,'room','','all','');expect(result).toMatchObject({ok:true,nextCursor:teamChatCursor(rows[24].created_at,rows[24].id)});expect(result.ok&&result.rows).toHaveLength(25)})
 it('scans at most 200 candidates and makes empty partial results explicitly pageable',async()=>{const rows=Array.from({length:201},(_,i)=>post(1000-i,{body:i===200?'Needle in older history':'No match'})),result=await searchTeamChatRows(database(rows).service,owner,'room','Needle','all','');expect(result).toMatchObject({ok:true,rows:[],nextCursor:teamChatCursor(rows[199].created_at,rows[199].id)});expect(await searchTeamChatRows(database([rows[200]]).service,owner,'room','Needle','all',teamChatCursor(rows[199].created_at,rows[199].id))).toMatchObject({ok:true,rows:[rows[200]],nextCursor:''})})
 it('omits deleted and blocked content and treats SQL wildcard characters as literal text',async()=>{const db=database([post(4,{body:'Literal %_ token'}),post(3,{body:'Literal %_ secret',sender_user_id:'blocked'}),post(2,{deleted_at:'now',body:'Literal %_ removed'}),post(1)],{team_chat_blocks:{data:[{blocked_user_id:'blocked'}]}});const result=await searchTeamChatRows(db.service,owner,'room','%_','all','');expect(result.ok&&result.rows.map(row=>row.id)).toEqual([id(4)])})
 it('filters announcements and explicit owner mentions without trusting typed @names',async()=>{const mention=post(3,{body:'@Alex ready?',metadata:{nativeMentions:[{profileId:owner,label:'Alex'}]}}),rows=[post(4,{message_kind:'announcement'}),mention,post(2,{body:'@Alex plain text'})];expect(await searchTeamChatRows(database(rows).service,owner,'room','','announcements','')).toMatchObject({rows:[rows[0]]});expect(await searchTeamChatRows(database(rows).service,owner,'room','','mentions','')).toMatchObject({rows:[mention]})})
 it('browses only bounded supported private images with a sender-owned room path',async()=>{const photo=post(2,{metadata:{teamRoomAttachment:{bucket:'team-room-files',path:'room/sender/photo.jpg',mimeType:'image/jpeg',size:1200,url:'https://private.invalid'}}}),pdf=post(1,{metadata:{teamRoomAttachment:{bucket:'team-room-files',path:'room/sender/file.pdf',mimeType:'application/pdf',size:1200}}});expect(await searchTeamChatRows(database([photo,pdf]).service,owner,'room','','media','')).toMatchObject({rows:[photo]});for(const patch of [{path:'other/sender/photo.jpg'},{path:'room/other/photo.jpg'},{path:'room/sender/../photo.jpg'},{size:2097153},{size:0},{bucket:'other'}])expect(searchPhotoMime({...photo,metadata:{teamRoomAttachment:{...(photo.metadata as unknown as {teamRoomAttachment:object}).teamRoomAttachment,...patch}}},'room')).toBe('')})
 it('returns only a bounded public snippet, name and media type without private metadata or identities',()=>{const row=post(1,{body:'a'.repeat(400)+' NEEDLE '+'b'.repeat(400),metadata:{teamRoomAttachment:{bucket:'team-room-files',path:'room/sender/photo.jpg',mimeType:'image/jpeg',size:1200},privateNotes:'secret'}}),value=publicChatSearchResult(row,'Captain'.repeat(30),'room','needle');expect(value.preview).toContain('NEEDLE');expect(value.preview.length).toBeLessThanOrEqual(242);expect(value.senderName).toHaveLength(120);for(const secret of ['privateNotes','sender_user_id','metadata','secret','photo.jpg','bucket'])expect(JSON.stringify(value)).not.toContain(secret);expect(chatSearchPreview('short','')).toBe('short')})
 it('fails closed on database errors and an unpageable corrupt row boundary',async()=>{expect(await searchTeamChatRows(database([],{internal_messages:{error:{message:'private DB'}}}).service,owner,'room','','all','')).toMatchObject({status:503});const rows=Array.from({length:201},()=>post(1,{id:'bad'}));expect(await searchTeamChatRows(database(rows).service,owner,'room','','all','')).toMatchObject({status:503})})
})
const scope={teamName:'Aces',leagueName:'City',flight:'4.0'},root={ok:true,chatSearch:1,roomId:'room',query:'court',kind:'all' as const,beforeCursor:'',nextCursor:'',results:[{id:id(1),senderName:'<Captain>',preview:'<img src=x> Court 3',kind:'message' as const,createdAt:'2026-10-24T12:00:00Z',photoMimeType:''}]}
describe('native search transport and result validation',()=>{
 it('uses only the fixed HTTPS endpoint and captured owner token, with no read acknowledgement',async()=>{const client={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'synthetic'}}})}} as unknown as SupabaseClient,send=vi.fn().mockResolvedValue({status:200,data:root});await readChatSearch(client,owner,()=>true,scope,'room','court','all','',send);const options=send.mock.calls[0][0],url=new URL(options.url);expect(url.origin+url.pathname).toBe('https://www.tenaceiq.com/api/team-rooms/search');expect(url.searchParams.get('team')).toBe('Aces');expect(url.searchParams.has('read')).toBe(false);expect(options.disableRedirects).toBe(true);expect(options.headers).toEqual({Authorization:'Bearer synthetic'});send.mockClear();await expect(readChatSearch(client,'other',()=>true,scope,'room','court','all','',send)).rejects.toThrow();expect(send).not.toHaveBeenCalled()})
 it('rejects rollback, wrong room/query/filter/page, corrupt rows, duplicates and oversized responses',()=>{for(const patch of [{chatSearch:undefined},{roomId:'other'},{query:'other'},{kind:'media'},{beforeCursor:'other'},{nextCursor:'bad'},{results:Array(26).fill(root.results[0])},{results:[root.results[0],root.results[0]]},{results:[{...root.results[0],preview:'x'.repeat(243)}]},{results:[{...root.results[0],photoMimeType:'text/html'}]}])expect(()=>parseChatSearch({...root,...patch},'room','court','all','')).toThrow();expect(parseChatSearch(root,'room','court','all','').results).toHaveLength(1)})
 it('ignores results after disposal and never renders HTML or automatic external URLs from a snippet',async()=>{let active=true;const client={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'synthetic'}}})}} as unknown as SupabaseClient,send=vi.fn(async()=>{active=false;return {status:200,data:root,headers:{},url:'https://www.tenaceiq.com/api/team-rooms/search'}});await expect(readChatSearch(client,owner,()=>active,scope,'room','court','all','',send)).rejects.toThrow('no longer open');const markup=searchResultHtml(root.results[0]);expect(markup).toContain('&lt;img');expect(markup).not.toContain('<img');expect(markup).toContain('&lt;Captain&gt;');expect(markup).not.toContain('https://')})
})

it('requires older cursor progress with PostgreSQL microseconds, equivalent UTC offsets and UUID tie breaks',()=>{const before=teamChatCursor('2026-10-24T12:00:00.123456+00:00',id(20));expect(chatSearchCursorProgress(teamChatCursor('2026-10-24T12:00:00.123455Z',id(99)),before)).toBe(true);expect(chatSearchCursorProgress(teamChatCursor('2026-10-24T12:00:00.123456Z',id(19)),before)).toBe(true);expect(chatSearchCursorProgress(teamChatCursor('2026-10-24T12:00:00.123456Z',id(20)),before)).toBe(false);expect(chatSearchCursorProgress(teamChatCursor('2026-10-24T12:00:00.123457Z',id(1)),before)).toBe(false)})

const publishedPoll=(n:number,patch:Record<string,unknown>={})=>post(n,{body:'Team poll: When?\n1. Tuesday\n2. Thursday\nhttps://www.tenaceiq.com/team-room?poll='+id(n),metadata:{nativePoll:{version:1,id:id(n)}},...patch})
it('browses only published polls with matching immutable message identity, preserving blocks and deletion',async()=>{
 const good=publishedPoll(9),rows=[good,publishedPoll(8,{sender_user_id:'blocked'}),publishedPoll(7,{deleted_at:'now'}),publishedPoll(6,{metadata:null}),publishedPoll(5,{metadata:{nativePoll:{version:1,id:id(4)}}}),publishedPoll(3,{metadata:{nativePoll:{version:2,id:id(3)}}}),post(2,{body:'Let us run a poll'})]
 const result=await searchTeamChatRows(database(rows,{team_chat_blocks:{data:[{blocked_user_id:'blocked'}]}}).service,owner,'room','','polls','')
 expect(result).toMatchObject({ok:true,kind:'polls',rows:[good]});expect(isPublishedChatPoll(good)).toBe(true)
})
it('keeps poll browsing bounded and resumes after the last inspected candidate even with no matches',async()=>{
 const rows=Array.from({length:201},(_,i)=>post(1000-i)),db=database(rows),result=await searchTeamChatRows(db.service,owner,'room','','polls','')
 expect(result).toMatchObject({rows:[],nextCursor:teamChatCursor(rows[199].created_at,rows[199].id)});expect(db.calls).toContainEqual({table:'internal_messages',method:'limit',args:[201]});expect(db.calls.filter(c=>c.table==='internal_messages'&&c.method==='select')).toHaveLength(1)
})
it('carries one canonical plan from the complete authorized body even when the snippet omits its URL',()=>{
 const row=publishedPoll(1,{body:'x'.repeat(500)+' https://www.tenaceiq.com/team-room?poll='+id(1)}),value=publicChatSearchResult(row,'Alex','room','')
 expect(value.preview).not.toContain('https:');expect(value.plan).toEqual({kind:'poll',id:id(1)});expect(searchResultHtml(value)).toContain('data-chat-poll="'+id(1)+'"')
 const practice='https://www.tenaceiq.com'+practiceRsvpPath(id(2));expect(firstChatPlan('Invite '+practice+'.')).toEqual({kind:'practice',id:id(2)});expect(publicChatSearchResult(post(2,{body:practice}),'Alex','room','').plan).toEqual({kind:'practice',id:id(2)})
})
it('does not promote noncanonical or external links and returns only the first approved plan',()=>{
 const poll='https://www.tenaceiq.com/team-room?poll='+id(1)
 for(const bad of [poll+'&team=Other',poll+'#fake',poll.replace('https:','http:'),poll.replace('www.tenaceiq.com','evil.test'),'https://www.tenaceiq.com/practice/'+id(1)])expect(firstChatPlan(bad)).toBeNull()
 expect(firstChatPlan(poll+' '+poll.replace(id(1),id(2)))).toEqual({kind:'poll',id:id(1)})
})
it('rejects malformed plan descriptors and strips unexpected fields without weakening legacy receipts',()=>{
 for(const plan of [{kind:'practice',id:''},{kind:'poll',id:'invalid'},{kind:'practice',id:'<img>'},{kind:'external',id:id(1)},[],42])expect(()=>parseChatSearch({...root,results:[{...root.results[0],plan}]},'room','court','all','')).toThrow()
 const parsed=parseChatSearch({...root,results:[{...root.results[0],plan:{kind:'poll',id:id(1),voters:['private']}}]},'room','court','all','')
 expect(parsed.results[0].plan).toEqual({kind:'poll',id:id(1)});expect(parseChatSearch(root,'room','court','all','').results[0]).not.toHaveProperty('plan');expect(parseChatPlan(null)).toBeNull()
})
it('withholds a late search response if the account changes while the request is in flight',async()=>{
 const session=vi.fn().mockResolvedValueOnce({data:{session:{user:{id:owner},access_token:'synthetic'}}}).mockResolvedValueOnce({data:{session:{user:{id:'other'},access_token:'other'}}}),send=vi.fn().mockResolvedValue({status:200,data:root}),client={auth:{getSession:session}} as unknown as SupabaseClient
 await expect(readChatSearch(client,owner,()=>true,scope,'room','court','all','',send)).rejects.toThrow('no longer open');expect(send).toHaveBeenCalledTimes(1)
})


describe('team plans and shared-match discovery',()=>{
 const match=(n:number,patch:Record<string,unknown>={})=>post(n,{body:'Captain match request',metadata:{teamRoomCard:true,cardType:'availability',matchDate:'2026-11-03',opponent:'November Aces',privateNotes:'private captain note',roster:['private roster'],...patch}})
 const practice='https://www.tenaceiq.com'+practiceRsvpPath(id(40)),poll='https://www.tenaceiq.com/team-room?poll='+id(41)
 it('promotes only a stored, supported shared card with an exact calendar date, never typed match text',()=>{
  expect(chatSearchMatch(match(1))).toEqual({matchDate:'2026-11-03',opponent:'November Aces',kind:'availability'})
  expect(chatSearchMatch(match(2,{cardType:'projected_lineup'}))?.kind).toBe('lineup')
  for(const patch of [{teamRoomCard:false},{cardType:'practice'},{matchDate:'2026-02-30'},{matchDate:'2026-13-03'},{matchDate:'<script>'}])expect(chatSearchMatch(match(1,patch))).toBeNull()
  expect(chatSearchMatch(post(1,{body:'Match availability on 2026-11-03 vs November Aces'}))).toBeNull()
 })
 it('browses all three plan types without inferring a published poll from a typed link',async()=>{
  const rows=[match(5),match(4,{cardType:'projected_lineup'}),post(3,{metadata:{nativePoll:{version:1,id:id(3)}}}),post(2,{body:practice}),post(1,{body:poll})]
  const db=database(rows),r=await searchTeamChatRows(db.service,owner,'room','','plans','')
  expect(r).toMatchObject({ok:true,rows:rows.slice(0,4)})
  expect(await searchTeamChatRows(database(rows).service,owner,'room','','matches','')).toMatchObject({rows:rows.slice(0,2)})
  expect(db.calls.filter(c=>c.table==='internal_messages'&&c.method==='select')).toHaveLength(1)
  expect(db.calls).toContainEqual({table:'internal_messages',method:'limit',args:[201]})
 })
 it('finds and opens the practice descriptor even when a poll link precedes it',async()=>{
  const row=post(2,{body:poll+' '+practice}),bad=post(1,{body:practice.replace('www.tenaceiq.com','external.invalid')})
  expect(await searchTeamChatRows(database([row,bad]).service,owner,'room','','practices','')).toMatchObject({rows:[row]})
  const result=publicChatSearchResult(row,'Alex','room','','practices');expect(result.plan).toEqual({kind:'practice',id:id(40)})
  expect(firstChatPlan(row.body)).toEqual({kind:'poll',id:id(41)})
  expect(publicChatSearchResult(post(3,{body:'Poll',metadata:{nativePoll:{version:1,id:id(3)}}}),'Alex','room','','plans').plan).toEqual({kind:'poll',id:id(3)})
 })
 it('keeps the empty-page continuation and 25-result cap for sparse older plans',async()=>{
  const rows=Array.from({length:201},(_,i)=>i===200?match(1):post(1000-i)),result=await searchTeamChatRows(database(rows).service,owner,'room','','plans','')
  expect(result).toMatchObject({rows:[],nextCursor:teamChatCursor(rows[199].created_at,rows[199].id)})
  expect(await searchTeamChatRows(database([rows[200]]).service,owner,'room','','plans',teamChatCursor(rows[199].created_at,rows[199].id))).toMatchObject({rows:[rows[200]],nextCursor:''})
  const capped=await searchTeamChatRows(database(Array.from({length:30},(_,i)=>match(100-i))).service,owner,'room','','matches','');expect(capped.ok&&capped.rows).toHaveLength(25)
 })
 it('retains current-room access and redaction for every new collection',async()=>{
  for(const kind of ['plans','matches','practices']){const db=database([match(1)],{removal:{data:{profile_id:owner}}});expect(await searchTeamChatRows(db.service,owner,'room','',''+kind,'')).toMatchObject({ok:false});expect(db.calls.some(c=>c.table==='internal_messages')).toBe(false)}
  const rows=[match(3),{...match(2),sender_user_id:'blocked'},{...match(1),deleted_at:'now'}],r=await searchTeamChatRows(database(rows,{team_chat_blocks:{data:[{blocked_user_id:'blocked'}]}}).service,owner,'room','','plans','');expect(r).toMatchObject({rows:[rows[0]]})
 })
 it('returns only match date/opponent/type and rejects malformed or wrong-collection native results',()=>{
  const value=publicChatSearchResult(match(1,{opponent:'<img src=x>'}),'Captain','room','','matches'),page={...root,query:'',kind:'matches',results:[value]}
  expect(value.sharedMatch).toEqual({matchDate:'2026-11-03',opponent:'<img src=x>',kind:'availability'})
  for(const secret of ['privateNotes','private captain note','roster','metadata','sender_user_id'])expect(JSON.stringify(value)).not.toContain(secret)
  const parsed=parseChatSearch({...page,results:[{...value,sharedMatch:{...value.sharedMatch,recipients:['secret']}}]},'room','','matches','');expect(parsed.results[0].sharedMatch).not.toHaveProperty('recipients')
  expect(searchResultHtml(value,true)).toContain('Open match in chat');expect(searchResultHtml(value,true)).toContain('&lt;img src=x&gt;');expect(searchResultHtml(value,true)).not.toContain('<img src=x>')
  for(const sharedMatch of [{...value.sharedMatch,matchDate:'2026-02-30'},{...value.sharedMatch,kind:'other'},[],42])expect(()=>parseChatSearch({...page,results:[{...value,sharedMatch}]},'room','','matches','')).toThrow()
  expect(()=>parseChatSearch({...page,results:root.results},'room','','matches','')).toThrow()
  expect(()=>parseChatSearch({...page,kind:'practices'},'room','','practices','')).toThrow()
  expect(parseChatSearch({...root,kind:'plans',query:'',results:[value]},'room','','plans','').results).toHaveLength(1)
  expect(parseChatSearchMatch(null)).toBeNull()
 })
 it('sends the explicit collection and named-room scope without a read or mutation',async()=>{
  const client={auth:{getSession:async()=>({data:{session:{user:{id:owner},access_token:'synthetic'}}})}} as unknown as SupabaseClient,send=vi.fn().mockResolvedValue({status:200,data:{...root,query:'',kind:'practices',results:[{...root.results[0],plan:{kind:'practice',id:id(40)}}]}})
  await readChatSearch(client,owner,()=>true,{...scope,chatRoomId:id(42)},'room','','practices','',send)
  const url=new URL(send.mock.calls[0][0].url);expect(url.searchParams.get('kind')).toBe('practices');expect(url.searchParams.get('chatRoom')).toBe(id(42));expect(url.searchParams.has('read')).toBe(false);expect(send).toHaveBeenCalledTimes(1)
 })
})
