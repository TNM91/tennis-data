import {coachUnreadFixture,coachUnreadCounts,coachUnreadMessages} from './mobile-coach-unread'
import {coachAlertFixture} from './mobile-coach-alerts'
import {nativeCoachAlertFixture} from './mobile-native-coach-alerts'
import {coachChatFixture,coachChatPreview} from './mobile-coach-chats'
import {calendarFixture,calendarPreview} from './mobile-calendar'
import {openSyntheticLink} from './mobile-navigation-app'
import {calendarTeamFixture,calendarTeamPreview} from './mobile-calendar-practices'
import {firstPartyUpdatesFixture,firstPartyUpdatesPreview,updatesFixture,updateCoachStudent} from './mobile-updates-client'
import {clearCoachDeviceData} from '../../mobile/src/coach-device-cleanup'
import {coachResourcesPreview,coachMessagesPreview} from './native-coach-complete-browser'
import {navigationOwner,currentNavigationOwner,refreshNavigationSession,switchNavigationOwner,connectNavigationPlayer,emitChatSignal,labProfileFixture,labDataReads} from './mobile-navigation-client'
import {competitionSnapshot,competitionDetail} from './competitions-data'
import {publicCompetitionOwner} from '../../lib/native-competitions-contract'
import {tournamentSnapshot} from './native-tournaments'
import {tournamentEntrySnapshot,tournamentReceipt} from './native-tournament-entry'
import type {MyTournamentEntry} from '../../lib/native-tournament-entry-contract'
import {DEFAULT_ENTITLEMENTS} from '../../lib/access-model-core'
import {coachPreviewControls,coachPreviewRequest,coachPreviewInvitesRequest,coachPreviewConnectionRequest} from './native-coach-browser'
import {tacticsPreviewControls,tacticsPreviewRequest} from './native-tactics-browser'
import {trainingInboxPreview} from './mobile-training-inbox'
import {personalMatchFixture} from './mobile-personal-matches'
const originalFetch=window.fetch.bind(window)
const freeTraining=new URL(location.href).searchParams.has('free-training')
const fixtureState={requests:0,leagueReads:0,teamReads:0,trainingWrites:0,teamInviteActions:[] as string[],tournamentReads:[] as string[],unscopedTournamentReply:false,unscopedLeagueReply:false,competitionReads:[] as {path:string;query:string;audience:string|null;authenticated:boolean}[]}
const tournamentShortcutFixture={enabled:new URL(location.href).searchParams.has('tournament-shortcut-review'),approved:true,entryReads:[] as string[]}
const myEntriesFixture={
 enabled:new URL(location.href).searchParams.has('my-tournament-entries'),
 fail:true,
 missingReceipt:false,
 entries:[
  {id:tournamentReceipt().id,eventName:'Northside Open',divisionName:'4.0 Doubles',status:'approved',selection:{parent:'event-one',division:'division-one'}},
  {id:'20000000-0000-4000-8000-000000000003',eventName:'Northside Open',divisionName:'3.5 Singles',status:'pending',selection:{parent:'event-one',division:'division-pending'}},
  {id:'20000000-0000-4000-8000-000000000004',eventName:'Northside Open',divisionName:'5.0 Doubles',status:'declined',selection:{parent:'event-one',division:'division-declined'}},
 ] satisfies MyTournamentEntry[],
}
Object.assign(window,{myEntriesFixture})
const shortcutDate='2026-11-13'
if(tournamentShortcutFixture.enabled){
 const match={...calendarFixture.competitions[0],id:'tournament:division-one:r2-m1',kind:'tournament',competitionId:'division-one',competitionName:'Northside Open · 4.0 Doubles',
  date:shortcutDate,time:'10:00',title:'Northside Open: vs Jordan Serve',opponent:'Jordan Serve',detail:'Round 2 · Court 1',status:'Scheduled',publishedView:{id:'event-one',divisionId:'division-one'}}
 calendarFixture.competitions.push(match)
 Object.assign(window,{tournamentShortcutFixture})
}
if(new URL(location.href).searchParams.has('team-practice-review')){
 calendarTeamFixture.enabled=true
 calendarTeamFixture.items[0].title='Return + first ball'
}
const calendarPaths:string[]=[]
if(new URL(location.href).searchParams.has('mixed-calendar')){
 const match=calendarFixture.competitions[0]
 calendarFixture.competitions.push({...match,id:'league:imported-league:match-one',competitionId:'imported-league',title:'Unreviewed league date'})
 calendarFixture.personal.push({...calendarFixture.personal[0],id:'team-schedule-external-copy',title:'Imported schedule copy'})
}
const chatUnreadFixture={total:7,reads:0,fail:false,detailed:false,secondTeam:false,empty:false,denyRoom:false,captain:false,roomName:'Practice & match prep <img src=x>',opened:[] as string[],emit:emitChatSignal}
const matchDayFixture={enabled:new URL(location.href).searchParams.has('match-day-review'),published:false,finalSeen:false,response:'',posts:[] as string[]}
const chatTeam={teamName:'Baseline Aces',leagueName:'City League',flight:'4.0'},chatRoomId='33333333-3333-4333-8333-333333333333'
const chatTeams=()=>chatUnreadFixture.empty?[]:[chatTeam,...(chatUnreadFixture.secondTeam?[{...chatTeam,leagueName:'Evening League',flight:'4.5'}]:[])]
const canManage=(team:typeof chatTeam)=>chatUnreadFixture.captain&&team.leagueName===chatTeam.leagueName
const firstPartyTeamFixture={requests:[] as string[],posts:[] as string[],integratedReads:0,unscoped:false}
const firstPartyTeamMessages=[{id:'66666666-6666-4666-8666-666666666666',senderUserId:'77777777-7777-4777-8777-777777770E4A',senderName:'Teammate 0E4A',body:'Anyone up for a hit on Friday?',kind:'message',createdAt:'2026-11-06T10:00:00.000Z',isMine:false}]
Object.assign(window,{firstPartyTeamFixture})
Object.assign(window,{chatUnreadFixture,matchDayFixture,calendarTeamFixture,coachChatFixture,coachUnreadFixture,coachAlertFixture,nativeCoachAlertFixture})
Object.assign(window,{navigationFixture:fixtureState,calendarFixture,calendarPaths,clearSyntheticCoachCache:clearCoachDeviceData,openSyntheticLink,updatesFixture,firstPartyUpdatesFixture,refreshNavigationSession,switchNavigationOwner,labProfileFixture,labDataReads,personalMatchFixture})
window.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href)
 if(url.origin===location.origin)return originalFetch(input,init)
 if(url.pathname==='/api/mobile/first-party/updates')return firstPartyUpdatesPreview(init?.method||'GET',url,init?.body,currentNavigationOwner())
 if(url.pathname.includes('/calendar'))calendarPaths.push(url.pathname)
 if(/^\/api\/(team-rooms(?:\/|$)|mobile\/(team-invites|chats\/unread)$)/.test(url.pathname))firstPartyTeamFixture.integratedReads++
 if(url.pathname==='/api/mobile/first-party/team-rooms'){
  const op=url.searchParams.get('op')||'room',owner=currentNavigationOwner()
  firstPartyTeamFixture.requests.push(op)
  const base={ok:true,owner,releaseScope:firstPartyTeamFixture.unscoped?undefined:'first-party'}
  if(op==='unread')return Response.json({...base,total:0,teams:[],coach:coachUnreadCounts(owner)})
  const teams=chatTeams().map(team=>({...team,canManage:false}))
  if(init?.method==='POST'){
   const action=JSON.parse(String(init.body))
   if(action.action==='mark_chat_read')return Response.json(base)
   if(action.action!=='send')return Response.json({ok:false},{status:400})
   firstPartyTeamFixture.posts.push(action.body)
   const message={id:action.clientMessageId,senderUserId:owner,senderName:'You',body:action.body,kind:'message',createdAt:'2026-11-06T10:05:00.000Z',isMine:true,canManageOwn:true,replyToMessageId:action.replyToMessageId}
   firstPartyTeamMessages.push(message)
   return Response.json({...base,message})
  }
  const team=teams.find(item=>item.teamName===url.searchParams.get('team')&&item.leagueName===url.searchParams.get('league')&&item.flight===url.searchParams.get('flight'))
  const room=team?{...team,id:chatRoomId,chatReady:true,lastReadAt:'2026-11-06T10:00:00.000Z',members:[],messages:firstPartyTeamMessages}:null
  return Response.json({...base,teams,room,nextCursor:''})
 }
 // Track tool-driven traffic separately from the independent live unread counter.
 if(url.pathname==='/api/mobile/chats/unread'){chatUnreadFixture.reads++;return Response.json(chatUnreadFixture.fail?{ok:false}:{ok:true,owner:currentNavigationOwner(),total:chatUnreadFixture.total,...(coachUnreadFixture.enabled?{coach:coachUnreadCounts(currentNavigationOwner())}:{}),teams:chatTeams().map((team,i)=>({...team,unread:i?0:chatUnreadFixture.total,...(chatUnreadFixture.detailed?{generalUnread:i?0:Math.min(2,chatUnreadFixture.total),rooms:i?[]:[{id:chatRoomId,name:chatUnreadFixture.roomName,unread:Math.max(0,chatUnreadFixture.total-2)}]}:{})}))},{status:chatUnreadFixture.fail?503:200})}
 fixtureState.requests++
 if(url.pathname==='/api/mobile/team-invites'||url.pathname==='/api/mobile/first-party/team-invites'){
  const command=JSON.parse(String(init?.body))
  const release=url.pathname.includes('/first-party/')?{releaseScope:'first-party',owner:currentNavigationOwner()}:{}
  if(release.releaseScope)firstPartyTeamFixture.requests.push('invite:'+command.action)
  const scope={...chatTeam,roomId:chatRoomId,expiresAt:'2027-06-30T18:00:00Z'}
  const expected={...scope,inviteId:'55555555-5555-4555-8555-555555555555',creatorId:navigationOwner}
  if(command.token!=='44444444-4444-4444-8444-444444444444')return Response.json({ok:false,message:'Invite unavailable.'},{status:404})
  fixtureState.teamInviteActions.push(command.action)
  if(command.action==='preview')return Response.json({ok:true,nativeTeamInvite:1,review:{...scope,expected,linkVersion:'v1',alreadyJoined:false},...release})
  if(command.action!=='join'||JSON.stringify(command.expected)!==JSON.stringify({invite:expected,linkVersion:'v1'}))return Response.json({ok:false,message:'Invite changed.'},{status:409})
  chatUnreadFixture.detailed=true
  return Response.json({ok:true,nativeTeamInvite:1,joined:true,roomId:chatRoomId,scope,...release})
 }
 if(url.pathname==='/api/mobile/coach/alerts'){if(init?.method==='POST'){nativeCoachAlertFixture.enabled=JSON.parse(String(init.body)).enabled;nativeCoachAlertFixture.writes.push(nativeCoachAlertFixture.enabled)}return Response.json({ok:true,owner:currentNavigationOwner(),enabled:nativeCoachAlertFixture.enabled,available:true})}
 if(url.pathname==='/api/team-rooms/teams')return coachChatFixture.teamFail?Response.json({ok:false},{status:503}):Response.json({ok:true,owner:currentNavigationOwner(),teams:chatTeams().map(team=>({...team,canManage:canManage(team)}))})
 if(url.pathname==='/api/team-rooms'){
  if(matchDayFixture.enabled&&init?.method==='POST'){
   const action=JSON.parse(String(init.body))
   matchDayFixture.posts.push(action.action)
   if(action.action==='respond'&&action.messageId==='match-card'){
    matchDayFixture.response=action.response
    return Response.json({ok:true,response:action.response})
   }
   if(action.action==='ack_final_lineup'&&action.messageId==='lineup-announcement'){
    matchDayFixture.finalSeen=true
    return Response.json({ok:true,seen:true})
   }
   return Response.json({ok:false},{status:409})
  }
  fixtureState.teamReads++
  if(coachChatFixture.teamFail)return Response.json({ok:false},{status:503})
  const roomId=url.searchParams.get('chatRoom'),selected=url.searchParams.get('team')
  if(selected)chatUnreadFixture.opened.push(url.search)
  if(selected&&chatUnreadFixture.denyRoom)return Response.json({ok:false},{status:403})
  const team=chatTeams().find(team=>team.teamName===selected&&team.leagueName===url.searchParams.get('league')&&team.flight===url.searchParams.get('flight'))
  if(team&&matchDayFixture.enabled&&!roomId){
   const nextScheduledMatch={matchDate:'2026-11-08',opponent:'River Returners',facility:'Northside Tennis Center',matchTime:'18:00'}
   const card={...nextScheduledMatch,state:'active',cardType:'projected_lineup',lineupVersion:2,finalLineup:matchDayFixture.published?{id:'final-lineup'}:null,
    lineup:[{label:'D1',players:['Jordan Lee','Casey Rivera']},{label:'D2',players:['Taylor Morgan','Sam Return']}]}
   return Response.json({ok:true,teams:chatTeams(),room:{...team,id:'22222222-2222-4222-8222-222222222222',subject:team.teamName,activeCardId:'match-card',
    chatReady:true,canManage:canManage(team),nextScheduledMatch,members:[{id:navigationOwner,name:'Jordan Lee',playerName:'Jordan Lee',roles:['player']}],
    messages:[{id:'match-card',kind:'match_card',card,response:matchDayFixture.response}],
    finalLineupReview:matchDayFixture.published?{announcementMessageId:'lineup-announcement',currentUserRequired:true,currentUserSeen:matchDayFixture.finalSeen}:null}})
  }
  return Response.json({ok:true,teams:chatTeams(),room:chatUnreadFixture.detailed&&team?{...team,id:roomId||'22222222-2222-4222-8222-222222222222',subject:team.teamName,messages:[],members:[],chatReady:false,canManage:!roomId&&canManage(team),...(roomId?{chatRoom:{id:roomId,parentId:'22222222-2222-4222-8222-222222222222',name:chatUnreadFixture.roomName,teamMuted:false}}:{})}:null})
 }
 if(url.pathname==='/api/team-rooms/search')return Response.json({ok:true,chatSearch:1,roomId:'22222222-2222-4222-8222-222222222222',query:url.searchParams.get('q'),kind:url.searchParams.get('kind'),beforeCursor:'',nextCursor:'',results:[]})
 if(url.pathname==='/api/mobile/captain')return Response.json({ok:true,scope:chatTeam,roster:[],matches:[],drafts:[]})
 if(url.pathname==='/api/mobile/calendar/practices'||url.pathname==='/api/mobile/practices')return calendarTeamPreview(init?.method||'GET',url,init?.body)
 if(url.pathname==='/api/mobile/calendar'||url.pathname==='/api/mobile/first-party/calendar')return calendarPreview(init?.method||'GET',url,init?.body)
 if(url.pathname==='/api/mobile/coach/resources')return coachResourcesPreview(init?.method||'GET',url,init?.body)
 if(url.pathname==='/api/mobile/coach/messages'){
  const unreadReply=await coachUnreadMessages(currentNavigationOwner(),init?.method||'GET',url,init?.body);if(unreadReply)return unreadReply
  const coachReply=coachChatPreview(currentNavigationOwner(),init?.method||'GET',url,init?.body);if(coachReply)return coachReply
  if(url.searchParams.get('student')===updateCoachStudent)return Response.json({ok:true,owner:navigationOwner,student:updateCoachStudent,messages:[{id:'preview-note',mine:false,body:'Bring your return notes to our next lesson.',createdAt:'2026-10-31T12:00:00Z'}],more:false,checked:null})
  const response=coachMessagesPreview(init?.method||'GET',url,init?.body)
  if(!url.searchParams.has('student')){const value=await response.json();value.connections.push({id:updateCoachStudent,name:'Taylor Morgan',role:'coach'});return Response.json(value)}
  return response
 }
 if(url.pathname==='/api/mobile/coach')return coachPreviewRequest(init?.method||'GET',url,init?.body)
 if(url.pathname==='/api/mobile/coach/invites')return coachPreviewInvitesRequest(init?.method||'GET',url,init?.body)
 if(url.pathname==='/api/mobile/coach/connection'){
  const response=coachPreviewConnectionRequest(init?.body)
  if(coachChatFixture.empty&&response.ok&&(await response.clone().json()).state==='connected')coachChatFixture.empty=false
  return response
 }
 if(url.pathname==='/api/mobile/coach/tactics')return tacticsPreviewRequest(init?.method||'GET',url,init?.body)
 if(url.pathname==='/api/player/level-up-sessions'&&init?.method==='POST')fixtureState.trainingWrites++
 const trainingReply=trainingInboxPreview(url,init?.method||'GET',init?.body);if(trainingReply)return trainingReply
 let reply:unknown={ok:false,error:'Synthetic preview does not provide this service'}
 if(url.pathname==='/api/leagues/summary'&&new URL(location.href).searchParams.has('explore-return')){
  fixtureState.leagueReads++
  const fall={key:'northside',leagueName:'Northside League',flight:'4.0',year:'2026',season:'Fall',teamCount:4,matchCount:6,districtArea:'Northside'}
  const leagues=[fall]
  if(new URL(location.href).searchParams.has('guest-handoff'))leagues.push({...fall,season:'Spring',matchCount:3})
  reply={leagues}
 }
 if(url.pathname==='/api/profile/link'){
  connectNavigationPlayer()
  const legacy=new URL(location.href).searchParams.has('legacy-player-link')
  const profile=legacy?{linked_player_id:navigationOwner}:{linked_player_id:navigationOwner,linked_player_name:'Jordan Lee',linked_team_name:'Baseline Aces',linked_league_name:'City Tennis League'}
  reply={ok:true,profile}
 }
 if(url.pathname==='/api/auth/access')reply={ok:true,access:{role:freeTraining?'member':'admin',entitlements:{...DEFAULT_ENTITLEMENTS}}}
 if(url.pathname==='/api/mobile/competitions'||url.pathname==='/api/mobile/first-party/competitions'){
  const snapshot=competitionSnapshot(),audience=url.searchParams.get('audience')
  snapshot.scope=url.searchParams.get('scope')==='discover'?'discover':'mine'
  snapshot.query=url.searchParams.get('q')||''
  if(url.searchParams.get('league'))snapshot.detail=competitionDetail()
  if(audience==='public')snapshot.owner=publicCompetitionOwner
  const scoped=url.pathname==='/api/mobile/first-party/competitions'
  if(scoped&&(snapshot.scope==='discover'||snapshot.detail))snapshot.connections=[]
  fixtureState.competitionReads.push({
   path:url.pathname,query:snapshot.query,audience,authenticated:new Headers(init?.headers).has('Authorization'),
  })
  reply={ok:true,releaseScope:scoped&&!fixtureState.unscopedLeagueReply?'first-party':undefined,...snapshot}
 }
 if(myEntriesFixture.enabled&&url.pathname==='/api/mobile/tournaments/entries'){
  if(myEntriesFixture.fail)return Response.json({ok:false},{status:503})
  const division=url.searchParams.get('division')
  const entries=division?myEntriesFixture.entries.filter(item=>item.selection?.division===division):myEntriesFixture.entries
  return Response.json({ok:true,owner:currentNavigationOwner(),entries,more:false})
 }
 if(myEntriesFixture.enabled&&url.pathname==='/api/mobile/tournaments/entry'){
  const entry=myEntriesFixture.entries.find(item=>item.selection?.division===url.searchParams.get('division')&&item.selection?.parent===url.searchParams.get('parent'))
  if(!entry?.selection||init?.method&&init.method!=='GET')return Response.json({ok:false},{status:404})
  const snapshot=tournamentEntrySnapshot()
  Object.assign(snapshot.context,{owner:currentNavigationOwner(),...entry.selection,name:entry.divisionName})
  snapshot.receipt=myEntriesFixture.missingReceipt?null:{
   ...tournamentReceipt(),id:entry.id,status:entry.status,inDraw:entry.status==='approved',
   note:entry.status==='declined'?'The division is full.': '',
  }
  return Response.json({ok:true,...snapshot})
 }
 if(url.pathname==='/api/mobile/tournaments/entry'&&tournamentShortcutFixture.enabled){
  tournamentShortcutFixture.entryReads.push(url.search)
  const snapshot=tournamentEntrySnapshot()
  if(url.searchParams.get('parent')!==snapshot.context.parent||url.searchParams.get('division')!==snapshot.context.division||init?.method&&init.method!=='GET')return Response.json({ok:false},{status:404})
  snapshot.context.owner=navigationOwner
  snapshot.receipt=tournamentShortcutFixture.approved?{...tournamentReceipt(),status:'approved',inDraw:true}:null
  return Response.json({ok:true,...snapshot})
 }
 if(url.pathname==='/api/mobile/tournaments'||url.pathname==='/api/mobile/first-party/tournaments'){
  fixtureState.tournamentReads.push(url.pathname)
  const snapshot=tournamentSnapshot(url.searchParams.get('tournament')||'',url.searchParams.get('division')||'')
  snapshot.owner=navigationOwner;snapshot.query=url.searchParams.get('q')||''
  if((tournamentShortcutFixture.enabled||myEntriesFixture.enabled)&&snapshot.detail?.active){
   const match=snapshot.detail.matches.find(match=>match.id==='r2-m1')!
   match.a=tournamentReceipt().name;match.date=shortcutDate
  }
  const scope=url.pathname==='/api/mobile/first-party/tournaments'&&!fixtureState.unscopedTournamentReply?'first-party':undefined
  reply={ok:true,scope,...snapshot}
 }
 return new Response(JSON.stringify(reply),{status:200,headers:{'Content-Type':'application/json'}})
}
void import('../../mobile/src/main').then(()=>{
 const controls=document.createElement('aside');controls.setAttribute('aria-label','Preview test controls');controls.className='preview-controls'
 controls.innerHTML='<p>Synthetic account preview</p><button type="button" data-preview-refresh>Simulate token refresh</button><button type="button" data-preview-owner>Switch synthetic account</button><button type="button" data-preview-online>Simulate reconnect</button>'
 document.body.append(controls);controls.querySelector('[data-preview-refresh]')?.addEventListener('click',refreshNavigationSession);controls.querySelector('[data-preview-owner]')?.addEventListener('click',switchNavigationOwner);controls.querySelector('[data-preview-online]')?.addEventListener('click',()=>window.dispatchEvent(new Event('online')))
 coachPreviewControls(controls)
 tacticsPreviewControls(controls)
})
