import {coachUnreadFixture,coachUnreadCounts,coachUnreadMessages} from './mobile-coach-unread'
import {coachAlertFixture} from './mobile-coach-alerts'
import {nativeCoachAlertFixture} from './mobile-native-coach-alerts'
import {coachChatFixture,coachChatPreview} from './mobile-coach-chats'
import {calendarFixture,calendarPreview} from './mobile-calendar'
import {openSyntheticLink} from './mobile-navigation-app'
import {calendarTeamFixture,calendarTeamPreview} from './mobile-calendar-practices'
import {practiceRsvpPath} from '../../lib/captain-practice-rsvp'
import {practiceAnnouncementText,privatePracticeChatPath} from '../../lib/native-practice-share-contract'
import {practiceReminderHref} from '../../lib/native-practice-reminder-contract'
import type {NativePractice} from '../../lib/native-captain-practices'
import type {PlayerPractice} from '../../lib/native-player-practice-contract'
import {firstPartyUpdatesFixture,firstPartyUpdatesPreview,updatesFixture,updateCoachStudent} from './mobile-updates-client'
import {clearCoachDeviceData} from '../../mobile/src/coach-device-cleanup'
import {coachResourcesPreview,coachMessagesPreview} from './native-coach-complete-browser'
import {navigationOwner,currentNavigationOwner,refreshNavigationSession,switchNavigationOwner,connectNavigationPlayer,emitChatSignal,labProfileFixture,labDataReads} from './mobile-navigation-client'
import {competitionSnapshot,competitionDetail} from './competitions-data'
import {entryReviewFixture} from './league-entry-data'
import {decisionReviewFixture} from './league-decisions-data'
import type {LeaguePostponement,LeagueScheduleChange,LeagueScheduleReview} from '../../lib/native-league-schedule-contract'
import {leagueCourtResultText,type LeagueScoreCard,type LeagueScoreChange} from '../../lib/native-league-score-contract'
import {readScoreReminder} from '../../lib/native-league-attention-contract'
import type {EntryReceipt} from '../../lib/native-league-entry-contract'
import {publicCompetitionOwner} from '../../lib/native-competitions-contract'
import {tournamentSnapshot} from './native-tournaments'
import {tournamentEntrySnapshot,tournamentReceipt} from './native-tournament-entry'
import type {MyTournamentEntry} from '../../lib/native-tournament-entry-contract'
import {DEFAULT_ENTITLEMENTS} from '../../lib/access-model-core'
import {coachPreviewControls,coachPreviewRequest,coachPreviewInvitesRequest,coachPreviewConnectionRequest} from './native-coach-browser'
import {tacticsPreviewControls,tacticsPreviewRequest} from './native-tactics-browser'
import {trainingInboxPreview} from './mobile-training-inbox'
import {personalMatchFixture} from './mobile-personal-matches'
import {captainCourtPreview,captainCourtsFixture,captainFixtureId} from './mobile-captain-courts'
import {shiftCalendarDay} from '../../mobile/src/calendar-data'
import {calendarTeamMatchesHeader} from '../../lib/native-calendar-contract'
import {chatHitChangesHeader,chatHitsHeader,parseChatHitAction,type ChatHit} from '../../lib/chat-hit-contract'
import {hittingPlanStart} from '../../lib/hitting-plan'
import {readReviewedNextMatch} from '../../lib/team-fixtures-contract'
import {readTeamCourtScore,teamCourtScorecard,teamResultOutcome,teamScorecardLimit,teamScorecardsHeader,type TeamResultEntry,type TeamResultScore} from '../../lib/team-results-contract'
const originalFetch=window.fetch.bind(window)
const inboxSearchFixture=new URL(location.href).searchParams.has('chat-inbox-search')
const playerChatFixture={
 enabled:new URL(location.href).searchParams.has('player-chat'),
 practices:new URL(location.href).searchParams.has('group-practice'),
 hitEnabled:new URL(location.href).searchParams.has('chat-hit'),
 hit:null as ChatHit|null,
 confirmedHit:undefined as ChatHit|undefined,
 practice:null as import('../../lib/group-practice-contract').GroupPractice|null,
 room:'bb4f152f-bb10-4b30-a233-09f20121e463',
 player:'ca2592d5-8135-4d6c-86ff-aef07ff620f0',
 newContact:{id:'bcdcb9c8-bf8e-4420-a5ee-a06d0808450d',name:'Morgan'},
 thirdContact:{id:'b662b24f-27b8-43ef-b8c4-e7acfd11f172',name:'Riley'},
 savedNewContact:false,
 inviteGroup:new URL(location.href).searchParams.has('group-invite'),
 groupMembers:[] as string[],
 title:inboxSearchFixture?'Friday Rally':'',
 group:inboxSearchFixture,
 logo:'',
 outgoing:[] as {id:string;name:string;author:string;body:string;createdAt:string}[],
 receive(){
  this.outgoing.push({id:'45526ebf-561c-477e-a6f7-9546ebf52cf4',name:'Jamie',author:this.player,
   body:'I can make Friday.',createdAt:'2026-11-13T20:15:00Z'})
  emitChatSignal()
 },
}
Object.assign(window,{playerChatFixture})
const freeTraining=new URL(location.href).searchParams.has('free-training')
const nearbyExplore=new URL(location.href).searchParams.get('nearby-explore')
const fixtureState={requests:0,leagueReads:0,teamReads:0,trainingWrites:0,teamInviteActions:[] as string[],tournamentReads:[] as string[],unscopedTournamentReply:false,unscopedLeagueReply:false,competitionReads:[] as {path:string;query:string;audience:string|null;authenticated:boolean}[]}
const tournamentShortcutFixture={enabled:new URL(location.href).searchParams.has('tournament-shortcut-review'),approved:true,entryReads:[] as string[]}
const scopedRegistration={enabled:new URL(location.href).searchParams.has('scoped-tournament-entry'),status:'',published:false}
const scopedLeagueEntry={
 enabled:new URL(location.href).searchParams.has('scoped-league-entry'),
 receipt:null as EntryReceipt|null,requests:[] as string[],unscoped:false,
 coordinator:new URL(location.href).searchParams.has('league-coordinator'),
 decisionRequests:[] as string[],
}
const scheduleId=(value:number)=>'20000000-0000-4000-8000-'+String(value).padStart(12,'0')
const scopedLeagueSchedule={
 enabled:new URL(location.href).searchParams.has('league-schedule'),requests:[] as LeagueScheduleChange[],
 match:null as LeagueScheduleReview['matches'][number]|null,lostReply:true,
}
const scopedLeagueScore={
 enabled:new URL(location.href).searchParams.has('league-score-review'),coordinator:false,
 demo:new URL(location.href).searchParams.get('league-score-review')==='demo',
 matchDay:['match-day','postpone'].includes(new URL(location.href).searchParams.get('league-score-review')??''),
 postpone:new URL(location.href).searchParams.get('league-score-review')==='postpone',
 moved:null as LeagueScheduleReview['matches'][number]|null,
 reminders:new Map<string,string>(),
 reminderRequests:0,
 player:false,
 match:{id:scheduleId(10),a:'Baseline Aces',b:'Rally Crew',date:'2026-11-12',time:'18:30'},
 card:null as LeagueScoreCard|null,
}
Object.assign(window,{scopedRegistration,scopedLeagueEntry,scopedLeagueSchedule,scopedLeagueScore})
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
if(tournamentShortcutFixture.enabled||scopedRegistration.enabled){
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
if(new URL(location.href).searchParams.has('calendar-scorecard')){
 const match=calendarFixture.competitions[0]
 const reviewed=Object.assign({...match,id:'tournament:draw-one:r1-m1',kind:'tournament',competitionId:'draw-one',
  title:'City Open: vs Casey & Drew',opponent:'Casey & Drew',status:'Completed'},
  {publishedView:{id:'draw-one'},scorecardFormat:'doubles'})
 calendarFixture.competitions.push(reviewed,{...reviewed,id:'tournament:draw-one:r2-m1',
  title:'City Open: future round',date:shiftCalendarDay(match.date,1),status:'Scheduled'})
}
const chatUnreadFixture={total:7,reads:0,fail:false,detailed:false,secondTeam:false,empty:false,denyRoom:false,captain:false,roomName:'Practice & match prep <img src=x>',opened:[] as string[],emit:emitChatSignal}
const matchDayFixture={enabled:new URL(location.href).searchParams.has('match-day-review'),published:false,finalSeen:false,response:'',posts:[] as string[]}
const chatTeam={teamName:'Baseline Aces',leagueName:'City League',flight:'4.0'},chatRoomId='33333333-3333-4333-8333-333333333333'
const namedChatsFixture=new URL(location.href).searchParams.has('team-channels')
const namedChats=new Map<string,{name:string;messages:typeof firstPartyTeamMessages;logo?:string}>()
const chatTeams=()=>chatUnreadFixture.empty?[]:[chatTeam,...(chatUnreadFixture.secondTeam?[{...chatTeam,leagueName:'Evening League',flight:'4.5'}]:[])]
const canManage=(team:typeof chatTeam)=>chatUnreadFixture.captain&&team.leagueName===chatTeam.leagueName
const firstPartyTeamFixture={requests:[] as string[],posts:[] as string[],integratedReads:0,unscoped:false,
 captainChatSetup:'needs-review',captainInviteTeams:undefined as (typeof chatTeam)[]|undefined}
const setupFixture={done:[] as string[],requests:0,competitionProfileLinked:undefined as boolean|undefined,
 competitionTrophies:[
  {id:'city-league-award',kind:'league',placement:'first',name:'City League',division:'Fall · 4.5',awardedOn:'2026-11-10'},
  {id:'fall-open-award',kind:'tournament',placement:'first',name:'Fall Open',division:'Men’s 4.5',awardedOn:'2026-11-10'},
 ] as unknown}
const captainInvitesEnabled=new URL(location.href).searchParams.has('captain-invites')
const privateTeamFlow=new URL(location.href).searchParams.has('create-team')
const privateTools=new URL(location.href).searchParams.get('private-team-tools')
let privateTeam:(typeof chatTeam&{id:string;leagueLabel:string})|null=privateTools?{
 ...chatTeam,id:chatRoomId,leagueName:'Private team '+chatRoomId,leagueLabel:'Weekend Tennis',
}:null
const privateTeammate='22222222-2222-4222-8222-222222222222'
const privateRoster=[{id:navigationOwner,playerId:'',name:'Sam'},{id:privateTeammate,playerId:'',name:'Alex'}]
let privatePractice:NativePractice|null=null
let privateReply:PlayerPractice['mine']['response']='unanswered'
const privateRsvpPath=practiceRsvpPath('44444444-4444-4444-8444-444444444444')
let privateLogoUrl=''
const linkedSchedule=new URL(location.href).searchParams.get('team-schedule')
const manualScheduleFixture={enabled:new URL(location.href).searchParams.has('manual-team-schedule'),captain:true,
 revision:null as string|null,nextMatch:null as Record<string,unknown>|null,loseNextSave:true,writes:[] as string[],
 reply:null as {id:string;choice:string}|null,loseNextReply:true,replyWrites:[] as string[],
 extraPlayers:[] as {id:string;name:string;choice:string|null}[],
 savedLineup:null as {version:string;courts:{format:string;players:string[]}[];names:Record<string,string>}|null,
 loseNextLineupSave:true,lineupWrites:[] as string[]}
const manualLineupRoster=()=>[{id:'10000000-0000-4000-8000-000000000001',name:'Alex',choice:manualScheduleFixture.reply?.choice??null},
 {id:'10000000-0000-4000-8000-000000000002',name:'Casey',choice:null},...manualScheduleFixture.extraPlayers]
const teamResultFixture={
 fixtureId:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
 match:{opponent:'Topspin Club',date:'2026-11-01',time:'18:00',facility:'Court 2',timeZone:'America/Chicago'},
 score:null as TeamResultScore|null,
 earlier:[] as TeamResultEntry[],
 failBeforeSave:false,loseNextSave:true,writes:[] as string[],
}
let captainInvite:{id:string;token:string;expiresAt:string;revokedAt:string|null;acceptedCount:number;active:boolean}|null=null
let firstPartyTeamJoined=false
const firstPartyTeamMessages=[{id:'66666666-6666-4666-8666-666666666666',senderUserId:'77777777-7777-4777-8777-777777770E4A',senderName:'Teammate 0E4A',body:'Anyone up for a hit on Friday?',kind:'message',createdAt:'2026-11-06T10:00:00.000Z',isMine:false}]
const practiceReminderScenario=new URL(location.href).searchParams.has('practice-reminder')
if(privateTeam&&(new URL(location.href).searchParams.has('posted-practice')||practiceReminderScenario)){
 const updatedAt='2026-11-13T00:00:00.000Z'
 privateReply=practiceReminderScenario?'unanswered':'in'
 privatePractice={
  id:'99999999-9999-4999-8999-999999999999',owner:navigationOwner,title:'Baseline Aces practice',
  date:'2030-06-09',time:'18:00',endTime:'19:00',facility:'Court 3',recurrence:'',focus:'',
  status:'confirmed',updatedAt,capacity:2,inviteId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  roster:privateRoster.map((person,index)=>{
   const response=index===1?privateReply:'unanswered'
   return {...person,response,displayStatus:response,respondedAt:response==='in'?updatedAt:null,confirmedAt:null,updatedAt}
  }),
 }
 firstPartyTeamMessages.push({
  id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',senderUserId:navigationOwner,senderName:'Sam',kind:'message',
  body:practiceAnnouncementText({practice:privatePractice,rsvpPath:privateRsvpPath},privateTeam,'invitation','',true),
  createdAt:'2026-11-13T00:01:00.000Z',isMine:true,
 })
}
const chatNamesEnabled=new URL(location.href).searchParams.has('chat-display-name')
const chatNames=new Map([[firstPartyTeamMessages[0].senderUserId,'Sam']])
const chatSafetyFixture={actions:[] as Record<string,string>[],failNextReport:false,failNextBlock:false,blocked:false}
Object.assign(window,{chatSafetyFixture})
Object.assign(window,{firstPartyTeamFixture,setupFixture,manualScheduleFixture,teamResultFixture})
Object.assign(window,{chatUnreadFixture,matchDayFixture,calendarTeamFixture,coachChatFixture,coachUnreadFixture,coachAlertFixture,nativeCoachAlertFixture})
Object.assign(window,{navigationFixture:fixtureState,calendarFixture,calendarPaths,clearSyntheticCoachCache:clearCoachDeviceData,openSyntheticLink,updatesFixture,firstPartyUpdatesFixture,refreshNavigationSession,switchNavigationOwner,labProfileFixture,labDataReads,personalMatchFixture})
window.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href)
 if(url.origin===location.origin)return originalFetch(input,init)
 if(playerChatFixture.enabled&&url.pathname==='/api/mobile/first-party/player-chats/branding'){
  const {room,photo}=JSON.parse(String(init?.body))
  if(!playerChatFixture.group||room!==playerChatFixture.room)return Response.json({ok:false},{status:403})
  playerChatFixture.logo=photo?'https://pwxppfazbyourjrsutgx.supabase.co/storage/v1/object/sign/team-room-files/team-logos/'+
   room+'/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg?token=group-test':''
  return Response.json({ok:true,releaseScope:'first-party',owner:currentNavigationOwner(),roomId:room,hasLogo:Boolean(photo)})
 }
 if(playerChatFixture.enabled&&url.pathname==='/api/mobile/first-party/player-chats'){
  const state=playerChatFixture
  const owner=currentNavigationOwner()
  const base={ok:true,releaseScope:'first-party',owner}
  const contact={id:state.player,name:'Jamie'}
  const contacts=[contact,...(state.savedNewContact?[state.newContact]:[]),...(state.inviteGroup?[state.thirdContact]:[])]
  if(init?.method==='POST'){
   const body=JSON.parse(String(init.body)) as {action:string;id?:string;text?:string;members?:string[];target?:string;startsAt?:string;court?:string;capacity?:number;response?:'in'|'out';request?:string}
   if(state.hitEnabled){
    const action=parseChatHitAction(body)
    if(action?.action==='hit_propose'||action?.action==='hit_suggest'){
     if(action.action==='hit_suggest'&&state.hit?.status==='accepted')state.confirmedHit=state.hit
     state.hit={...action,startsAt:hittingPlanStart(action)!.toISOString(),proposedBy:owner,status:'proposed'}
    }
    if(action?.action==='hit_reply'&&state.hit){
     state.hit=action.response==='declined'&&state.confirmedHit?state.confirmedHit:{...state.hit,status:action.response}
     state.confirmedHit=undefined
    }
    if(action?.action==='hit_cancel'&&state.hit){
     state.hit=action.id===state.hit.id&&state.confirmedHit?state.confirmedHit:{...(state.confirmedHit??state.hit),status:'cancelled'}
     state.confirmedHit=undefined
    }
   }
   if(body.action==='group'||body.action==='direct'){
    state.group=body.action==='group'
    state.title=state.group?body.text??'':contacts.find(player=>player.id===body.target)?.name??'Jamie'
    state.groupMembers=body.members??[]
    return Response.json({...base,roomId:state.room})
   }
   if(body.action==='invite')return Response.json({...base,expiresAt:'2026-11-20T10:00:00Z'})
   if(body.action==='preview')return Response.json({...base,invite:state.inviteGroup
    ?{group:true,title:'Friday practice'}:{group:false,title:state.newContact.name}})
   if(body.action==='join'){
    if(state.inviteGroup){
     state.group=true
     state.title='Friday practice'
     return Response.json({...base,roomId:state.room})
    }
    state.savedNewContact=true
    return Response.json({...base,contact:state.newContact.id})
   }
   if(body.action==='add'&&body.target&&!state.groupMembers.includes(body.target))state.groupMembers.push(body.target)
   if(body.action==='practice_create'&&body.id&&body.startsAt&&body.court&&body.capacity){
    state.practice={id:body.id,revision:crypto.randomUUID(),startsAt:body.startsAt,court:body.court,capacity:body.capacity,mine:null,inCount:0,players:[]}
   }
   if(body.action==='practice_edit'&&state.practice&&body.request&&body.startsAt&&body.court&&body.capacity){
    state.practice={...state.practice,revision:body.request,startsAt:body.startsAt,court:body.court,capacity:body.capacity}
   }
   if(body.action==='practice_reply'&&state.practice&&body.response){
    const going=body.response==='in'
    state.practice={...state.practice,mine:body.response,inCount:Number(going),players:going?[{id:owner,name:'Avery'}]:[]}
   }
   if(body.action==='practice_cancel')state.practice=null
   if(body.action==='send'&&body.id&&body.text){
    state.outgoing.push({id:body.id,name:'Avery',author:owner,body:body.text,createdAt:'2026-11-13T19:00:00Z'})
    return Response.json({...base,messageId:body.id})
   }
   return Response.json(base)
  }
  if(url.searchParams.get('room')===state.room)return Response.json({...base,room:{
   id:state.room,title:state.title,group:state.group,manage:state.group&&(!state.inviteGroup||!new URL(location.href).searchParams.has('link')),more:false,
   members:state.group?contacts.filter(player=>state.groupMembers.includes(player.id)):[contact],messages:state.outgoing,logo:state.logo,
   ...(state.group&&state.practices?{practice:state.practice}:{}),
   ...(!state.group&&state.hitEnabled&&new Headers(init?.headers).get(chatHitsHeader)==='1'?
    new Headers(init?.headers).get(chatHitChangesHeader)==='1'?{hit:state.hit,confirmedHit:state.confirmedHit,canSuggestHit:true}:
      {hit:state.confirmedHit??state.hit}:{}),
  }})
  return Response.json({...base,contacts,rooms:state.title?[{id:state.room,title:state.title,group:state.group,unread:inboxSearchFixture,
   logo:state.logo,activityAt:'2026-11-13T20:00:00Z'}]:[]})
 }
 if(url.pathname==='/api/mobile/first-party/updates')return firstPartyUpdatesPreview(init?.method||'GET',url,init?.body,currentNavigationOwner())
 if(url.pathname==='/api/mobile/first-party/setup'){
  setupFixture.requests++
  return Response.json({ok:true,owner:currentNavigationOwner(),releaseScope:'first-party',
   tracks:[{tier:'free',done:['account']},{tier:'captain',done:setupFixture.done}],
   competitionProfileLinked:setupFixture.competitionProfileLinked,competitionTrophies:setupFixture.competitionTrophies})
 }
 if(url.pathname==='/api/mobile/account'&&(!init?.method||init.method==='GET'))return Response.json({
  ok:true,email:'captain@example.test',fulfillment:'automated',reviewDays:7,verificationRequired:false,request:null,
 })
 if(url.pathname.includes('/calendar'))calendarPaths.push(url.pathname)
 if(/^\/api\/(team-rooms(?:\/|$)|mobile\/(team-invites|captain\/invites|chats\/unread)$)/.test(url.pathname))firstPartyTeamFixture.integratedReads++
 if(privateTools&&privateTeam&&['/api/mobile/captain/practices','/api/mobile/captain/practices/create','/api/mobile/captain/practices/share','/api/mobile/captain/practices/reminder','/api/mobile/practices'].includes(url.pathname)){
  const owner=currentNavigationOwner(),scope=privateTeam
  if(url.searchParams.get('team')!==scope.teamName||url.searchParams.get('league')!==scope.leagueName||
     url.searchParams.get('flight')!==scope.flight)return Response.json({ok:false},{status:403})
  const base={ok:true,owner,scope,more:false}
  if(url.pathname==='/api/mobile/practices'){
   if(!privatePractice||owner!==privateTeammate)return Response.json({...base,practices:[]})
   const requestedEvent=url.searchParams.get('eventId')
   if(url.searchParams.has('invite')||requestedEvent&&requestedEvent!==privatePractice.id)return Response.json({ok:false},{status:404})
   const {id,title,date,time,endTime,facility,focus,status,updatedAt,capacity}=privatePractice
   const person=privatePractice.roster[1]
   if(init?.method==='PATCH'){
    const reply=JSON.parse(String(init.body))
    if(reply.eventId!==id||reply.personId!==person.id||status==='cancelled'||reply.eventUpdatedAt!==updatedAt)
     return Response.json({ok:false},{status:409})
    privateReply=reply.response
    privatePractice.roster[1]={...person,response:privateReply,displayStatus:privateReply,respondedAt:updatedAt}
   }
   const practice:PlayerPractice={id,title,date,time,endTime,facility,focus,status,updatedAt,capacity,
    inCount:Number(privateReply==='in'),waitlistCount:0,mine:{id:person.id,name:person.name,response:privateReply,
     displayStatus:privateReply,note:'',confirmedAt:null,updatedAt}}
   return Response.json({...base,practices:[practice]})
  }
  if(privateTools!=='captain'||owner!==navigationOwner)return Response.json({ok:false},{status:403})
  if(url.pathname.endsWith('/reminder')){
   if(!privatePractice||url.searchParams.get('eventId')!==privatePractice.id)return Response.json({ok:false},{status:404})
   const eventId=privatePractice.id,updatedAt=privatePractice.updatedAt
   const recipients=privatePractice.roster.filter(person=>person.id!==owner&&person.response==='unanswered')
    .map(({id,name})=>({id,name}))
   const saved=firstPartyUpdatesFixture.practiceReminders[0]
   if(init?.method!=='POST')return Response.json({...base,eventId,updatedAt,date:privatePractice.date,recipients,alreadySent:Boolean(saved)})
   const intent=JSON.parse(String(init.body))
   const href=practiceReminderHref(scope,eventId,intent.requestId)
   if(saved)return saved.href===href?Response.json({...base,eventId,count:1}):Response.json({ok:false},{status:409})
   if(intent.updatedAt!==updatedAt)return Response.json({ok:false},{status:409})
   if(!recipients.some(person=>intent.recipientIds.includes(person.id)))return Response.json({...base,eventId,count:0})
   firstPartyUpdatesFixture.practiceReminders.push({
    id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaa99',recipient_profile_id:privateTeammate,notification_type:'schedule',
    title:'Practice RSVP reminder',body:'Open practice to mark In, Out, or Maybe.',href,
    conversation_id:scope.id,schedule_event_id:eventId,read_at:null,created_at:updatedAt,
   })
   return Response.json({...base,eventId,count:1})
  }
  if(url.pathname.endsWith('/share')){
   if(!privatePractice||url.searchParams.get('eventId')!==privatePractice.id)return Response.json({ok:false},{status:404})
   if(init?.method!=='POST')return Response.json({...base,practice:privatePractice,rsvpPath:privateRsvpPath})
   const {action,body,clientMessageId,expectedUpdatedAt}=JSON.parse(String(init.body))
   if(typeof body!=='string'||!body.endsWith('https://www.tenaceiq.com'+privatePracticeChatPath(privatePractice.id))||body.includes(privateRsvpPath))
    return Response.json({ok:false},{status:409})
   const chatRoomId=url.searchParams.get('chatRoom')
   const named=chatRoomId?namedChats.get(chatRoomId):undefined
   if(chatRoomId&&!named)return Response.json({ok:false},{status:404})
   const messages=named?.messages??firstPartyTeamMessages
   const existing=messages.find(message=>message.id===clientMessageId)
   if(existing?existing.body!==body:action!=='announce'||expectedUpdatedAt!==privatePractice.updatedAt)
    return Response.json({ok:false},{status:409})
   if(!existing)messages.push({id:clientMessageId,senderUserId:owner,senderName:'Sam',body,kind:'message',
    createdAt:new Date(Date.UTC(2026,10,13,0,1,messages.length)).toISOString(),isMine:true})
   return Response.json({...base,eventId:privatePractice.id,announcementId:clientMessageId,body,...(chatRoomId?{chatRoomId}:{})})
  }
  if(url.pathname.endsWith('/create')){
   if(init?.method!=='POST')return Response.json({...base,roster:privateRoster})
   const {draft}=JSON.parse(String(init.body))
   const stamp='2026-11-13T00:00:00.000Z'
   privatePractice={...draft.fields,id:draft.requestId,owner,title:scope.teamName+' practice',status:'proposed',
    updatedAt:stamp,capacity:draft.capacity,inviteId:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    roster:privateRoster.map(person=>({...person,response:'unanswered',displayStatus:'unanswered',respondedAt:null,confirmedAt:null,updatedAt:stamp}))}
   return Response.json({...base,practice:privatePractice,requestId:draft.requestId,
    rsvpPath:privateRsvpPath})
  }
  if(init?.method==='PATCH'){
   const {action,eventId,expectedUpdatedAt,requestId,fields}=JSON.parse(String(init.body))
   if(!privatePractice||privatePractice.id!==eventId||privatePractice.updatedAt!==expectedUpdatedAt||
      !['edit_details','cancel_occurrence'].includes(action))return Response.json({ok:false},{status:409})
   const receipt={requestId,expectedUpdatedAt}
   const updatedAt=new Date(Date.parse(privatePractice.updatedAt)+1000).toISOString()
   privatePractice=action==='edit_details'
    ?{...privatePractice,...fields,editReceipt:receipt,updatedAt}
    :{...privatePractice,status:'cancelled',cancelReceipt:receipt,updatedAt}
   return Response.json({...base,practice:privatePractice})
  }
  return Response.json({...base,practices:privatePractice?[privatePractice]:[]})
 }
 if(privateTools&&privateTeam&&url.pathname==='/api/mobile/first-party/team-rooms/branding'){
  const {roomId,photo}=JSON.parse(String(init?.body))
  if(privateTools!=='captain'||roomId!==privateTeam.id)return Response.json({ok:false},{status:403})
  if(photo!==null&&!String(photo).startsWith('/9j/'))return Response.json({ok:false},{status:400})
  privateLogoUrl=photo?'https://pwxppfazbyourjrsutgx.supabase.co/storage/v1/object/sign/team-room-files/team-logos/'+
   roomId+'/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg?token=sample':''
  return Response.json({ok:true,releaseScope:'first-party',owner:currentNavigationOwner(),roomId,hasLogo:Boolean(photo)})
 }
 if(namedChatsFixture&&url.pathname==='/api/mobile/first-party/team-rooms/branding'){
  const {roomId,chatRoomId,photo}=JSON.parse(String(init?.body))
  const named=namedChats.get(chatRoomId),owner=currentNavigationOwner()
  if(owner!==navigationOwner||!named||roomId!==chatRoomId)return Response.json({ok:false},{status:403})
  if(photo!==null&&!String(photo).startsWith('/9j/'))return Response.json({ok:false},{status:400})
  named.logo=photo?'https://pwxppfazbyourjrsutgx.supabase.co/storage/v1/object/sign/team-room-files/team-logos/'+
   roomId+'/aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa.jpg?token=sample':undefined
  return Response.json({ok:true,releaseScope:'first-party',owner,roomId,hasLogo:Boolean(photo)})
 }
 if(url.pathname==='/api/mobile/first-party/team-rooms'){
  const op=url.searchParams.get('op')||'room',owner=currentNavigationOwner()
  firstPartyTeamFixture.requests.push(op)
  const base={ok:true,owner,releaseScope:firstPartyTeamFixture.unscoped?undefined:'first-party'}
  const roomSummaries=Array.from(namedChats,([id,value])=>({id,name:value.name,unread:inboxSearchFixture?2:0,muted:false,activityAt:'2026-11-14T20:00:00Z',logo:value.logo}))
  if(op==='unread'){
   const total=roomSummaries.reduce((sum,room)=>sum+room.unread,0)
   return Response.json({...base,total,teams:namedChatsFixture?[{...(privateTeam??chatTeam),unread:total,generalUnread:0,rooms:roomSummaries}]:[],coach:coachUnreadCounts(owner)})
  }
  if(op==='captain-setup')return Response.json({...base,captainChatSetup:firstPartyTeamFixture.captainChatSetup,
   captainInviteTeams:firstPartyTeamFixture.captainInviteTeams})
  const teams=(privateTeam?[privateTeam]:privateTeamFlow?[]:chatTeams()).map(team=>({...team,canManage:false,
   activityAt:'2026-11-13T19:00:00Z',
   ...(privateLogoUrl?{teamLogoUrl:privateLogoUrl}:{})}))
  if(init?.method==='POST'){
   const action=JSON.parse(String(init.body))
   if(namedChatsFixture&&['create_chat_room','lookup_chat_room'].includes(action.action)){
    const parent=privateTeam??chatTeam
    if(owner!==navigationOwner||action.teamName!==parent.teamName||action.leagueName!==parent.leagueName||action.flight!==parent.flight)
     return Response.json({ok:false},{status:403})
    if(action.action==='create_chat_room'&&!namedChats.has(action.clientRoomId))namedChats.set(action.clientRoomId,{name:action.roomName,messages:[]})
    const saved=namedChats.get(action.clientRoomId)
    if(!saved||saved.name!==action.roomName)return Response.json({ok:false},{status:404})
    return Response.json({...base,namedRooms:1,parentId:chatRoomId,teamMuted:false,id:action.clientRoomId,name:saved.name})
   }
   if(action.action==='set_chat_display_name'){
    if(!chatNamesEnabled||action.roomId!==chatRoomId)return Response.json({ok:false},{status:403})
    chatNames.set(owner,action.displayName)
    return Response.json({...base,roomId:chatRoomId,chatDisplayName:action.displayName})
   }
   if(action.action==='report_chat_message'){
    if(action.messageId!==firstPartyTeamMessages[0].id)return Response.json({ok:false},{status:404})
    chatSafetyFixture.actions.push(action)
    if(chatSafetyFixture.failNextReport){chatSafetyFixture.failNextReport=false;return Response.json({ok:false},{status:503})}
    return Response.json(base)
   }
   if(action.action==='block_chat_member'||action.action==='unblock_chat_member'){
    if(action.memberId!==firstPartyTeamMessages[0].senderUserId)return Response.json({ok:false},{status:404})
    chatSafetyFixture.actions.push(action)
    if(chatSafetyFixture.failNextBlock){chatSafetyFixture.failNextBlock=false;return Response.json({ok:false},{status:503})}
    chatSafetyFixture.blocked=action.action==='block_chat_member'
    return Response.json(base)
   }
   if(action.action==='save_match_lineup'){
    const fixture=manualScheduleFixture
    if(!fixture.captain||owner!==navigationOwner||action.roomId!==chatRoomId)return Response.json({ok:false},{status:403})
    if(!fixture.nextMatch||action.revision!==fixture.revision)return Response.json({ok:false},{status:409})
    fixture.lineupWrites.push(action.version)
    if(action.version!==fixture.savedLineup?.version){
     if(action.expected!==(fixture.savedLineup?.version??null))return Response.json({ok:false},{status:409})
     const players=new Set<string>(action.courts.flatMap((court:{players:string[]})=>court.players))
     const names=Object.fromEntries(manualLineupRoster().filter(player=>players.has(player.id)&&player.choice!=='out')
      .map(player=>[player.id,player.name]))
     if(Object.keys(names).length!==players.size)return Response.json({ok:false},{status:409})
     fixture.savedLineup={version:action.version,courts:action.courts,names}
     if(fixture.loseNextLineupSave){fixture.loseNextLineupSave=false;return Response.json({ok:false},{status:503})}
    }
    return Response.json({...base,roomId:chatRoomId,revision:fixture.revision,lineup:fixture.savedLineup})
   }
   if(action.action==='save_team_result'){
    const fixture=teamResultFixture
    if(!manualScheduleFixture.enabled||!manualScheduleFixture.captain||owner!==navigationOwner||action.roomId!==chatRoomId||
       action.teamName!==chatTeam.teamName||action.leagueName!==chatTeam.leagueName||action.flight!==chatTeam.flight)
     return Response.json({ok:false},{status:403})
    if(action.fixtureId!==fixture.fixtureId)return Response.json({ok:false},{status:409})
    fixture.writes.push(action.revision)
    if(fixture.failBeforeSave){fixture.failBeforeSave=false;return Response.json({ok:false},{status:503})}
    if(action.revision!==fixture.score?.revision){
     if(action.expected!==(fixture.score?.revision??null))return Response.json({ok:false},{status:409})
     const players=new Map(manualLineupRoster().map(({id,name})=>[id,{id,name}]))
     const courtPlayers=Array.isArray(action.courtPlayerIds)?action.courtPlayerIds.map((ids:string[])=>ids.flatMap(id=>{
      const player=players.get(id)
      return player?[player]:[]
     })):undefined
     fixture.score={revision:action.revision,won:action.won,lost:action.lost,
      ...(Array.isArray(action.courtScores)?{courtScores:action.courtScores}:{}),
      ...(courtPlayers?{courtPlayers}:{})}
     if(fixture.loseNextSave){fixture.loseNextSave=false;return Response.json({ok:false},{status:503})}
    }
    return Response.json({...base,roomId:chatRoomId,fixtureId:fixture.fixtureId,score:{...fixture.score,
     ...(Array.isArray(action.courtPlayerIds)?{courtPlayerIds:action.courtPlayerIds}:{})}})
   }
   if(action.action==='create_private_team'){
    if(!privateTeamFlow||owner!==navigationOwner)return Response.json({ok:false},{status:403})
    firstPartyTeamFixture.requests.push('create:'+action.id)
    if(!privateTeam){
     privateTeam={id:action.id,teamName:action.teamName,leagueName:'Private team '+action.id,leagueLabel:action.leagueLabel,flight:action.flight}
     return Response.json({ok:false},{status:503})
    }
    if(action.id!==privateTeam.id)return Response.json({ok:false},{status:409})
    return Response.json({...base,roomId:privateTeam.id,team:privateTeam})
   }
   if(action.action==='set_next_match'){
    const fixture=manualScheduleFixture
    if(!fixture.enabled||!fixture.captain||owner!==navigationOwner||action.roomId!==chatRoomId||
       action.teamName!==chatTeam.teamName||action.leagueName!==chatTeam.leagueName||action.flight!==chatTeam.flight)
     return Response.json({ok:false},{status:403})
    fixture.writes.push(action.revision)
    if(action.revision!==fixture.revision){
     if(action.expected!==fixture.revision)return Response.json({ok:false},{status:409})
     if(fixture.nextMatch?.opponent!==action.nextMatch?.opponent||fixture.nextMatch?.date!==action.nextMatch?.date)fixture.savedLineup=null
     fixture.revision=action.revision
     fixture.nextMatch=action.nextMatch
     fixture.reply=null
     if(fixture.loseNextSave){fixture.loseNextSave=false;return Response.json({ok:false},{status:503})}
    }
    return Response.json({...base,roomId:chatRoomId,revision:fixture.revision,nextMatch:fixture.nextMatch})
   }
   if(action.action==='reply_next_match'){
    const fixture=manualScheduleFixture
    if(!fixture.enabled||action.roomId!==chatRoomId||!fixture.nextMatch||fixture.revision!==action.revision)
     return Response.json({ok:false},{status:409})
    fixture.replyWrites.push(action.id)
    if(fixture.reply?.id!==action.id){
     if((fixture.reply?.id??null)!==action.expected)return Response.json({ok:false},{status:409})
     fixture.reply={id:action.id,choice:action.choice}
     if(fixture.loseNextReply){fixture.loseNextReply=false;return Response.json({ok:false},{status:503})}
    }
    return Response.json({...base,roomId:chatRoomId,revision:fixture.revision,reply:fixture.reply})
   }
   if(action.action==='mark_chat_read')return Response.json(base)
   if(action.action!=='send')return Response.json({ok:false},{status:400})
   firstPartyTeamFixture.posts.push(action.body)
   const message={id:action.clientMessageId,senderUserId:owner,senderName:'You',body:action.body,kind:'message',createdAt:'2026-11-06T10:05:00.000Z',isMine:true,canManageOwn:true,replyToMessageId:action.replyToMessageId}
   const named=action.chatRoomId?namedChats.get(action.chatRoomId):null
   if(action.chatRoomId&&!named)return Response.json({ok:false},{status:404})
   const messages=named?.messages??firstPartyTeamMessages
   if(!messages.some(item=>item.id===message.id))messages.push(message)
   return Response.json({...base,message})
  }
  const team=teams.find(item=>item.teamName===url.searchParams.get('team')&&item.leagueName===url.searchParams.get('league')&&item.flight===url.searchParams.get('flight'))
  if(namedChatsFixture&&team&&op==='chats'){
   return Response.json({...base,namedRooms:1,parentId:chatRoomId,teamMuted:false,canCreate:owner===navigationOwner,generalUnread:0,rooms:roomSummaries})
  }
  const selectedRoom=url.searchParams.get('chatRoom')
  if(namedChatsFixture&&team&&selectedRoom){
   const named=namedChats.get(selectedRoom)
   if(!named)return Response.json({ok:false},{status:404})
   const room={...team,id:selectedRoom,subject:named.name,chatLogoUrl:named.logo,canManageTeamLogo:owner===navigationOwner,
    chatRoom:{id:selectedRoom,parentId:chatRoomId,name:named.name,teamMuted:false},
    teamPractices:Boolean(privateTools),canPlanPractice:privateTools==='captain'&&owner===navigationOwner,
    scheduleLinked:Boolean(linkedSchedule),manualFixture:manualScheduleFixture.enabled,canScheduleMatch:manualScheduleFixture.captain&&owner===navigationOwner,
    chatReady:true,lastReadAt:'',members:[],messages:named.messages.map(message=>({
     ...message,isMine:message.senderUserId===owner,canManageOwn:message.senderUserId===owner,
    })),blockedUserIds:[],blockedMembers:[]}
   return Response.json(op==='updates'?{...base,room,chatUpdate:true,beforeCursor:'',nextCursor:''}:{...base,teams,room,nextCursor:''})
  }
  if(op==='result-roster'){
   if(!team||!manualScheduleFixture.enabled||!manualScheduleFixture.captain||owner!==navigationOwner)return Response.json({ok:false},{status:403})
   return Response.json({...base,roomId:chatRoomId,players:manualLineupRoster().map(({id,name})=>({id,name}))})
  }
  if(op==='team-results'){
   if(!team||!manualScheduleFixture.enabled)return Response.json({ok:false},{status:403})
   const canEdit=manualScheduleFixture.captain&&owner===navigationOwner
   const record={wins:0,losses:0,ties:0}
   const entries=[teamResultFixture,...teamResultFixture.earlier].filter(({score})=>canEdit||score).map(({fixtureId,match,score:saved})=>{
    const myCourt=(saved?.courtPlayers?.findIndex(players=>players.some(player=>player.id===owner))??-1)+1
    const score=saved?{...saved,...(myCourt?{myCourt}:{}),...(saved.courtPlayers&&!canEdit?{
     courtPlayers:saved.courtPlayers.map(players=>players.map(({name})=>({name}))),
    }:{})}:null
    const plannedLineup=canEdit&&fixtureId===manualScheduleFixture.revision?manualScheduleFixture.savedLineup:null
    if(score)record[teamResultOutcome(score)]++
    return {fixtureId,match,score,plannedLineup}
   })
   return Response.json({...base,roomId:chatRoomId,results:{canEdit,entries,more:false,record}})
  }
  if(op==='match-replies'){
   const fixture=manualScheduleFixture
   if(!team||!fixture.enabled||!fixture.nextMatch||fixture.revision!==url.searchParams.get('revision'))return Response.json({ok:false},{status:409})
   const lineupRoster=manualLineupRoster()
   const teamReplies=lineupRoster.filter(player=>player.choice).map(({name,choice})=>({name,choice}))
   const awaiting=lineupRoster.filter(player=>player.choice===null).map(player=>player.name)
   return Response.json({...base,roomId:chatRoomId,revision:fixture.revision,replies:{own:fixture.reply,
    ...(fixture.captain&&owner===navigationOwner?{team:teamReplies,awaiting,awaitingTeammates:awaiting.length,rosterComplete:true,lineupRoster,
     savedLineup:fixture.savedLineup}:{})}})
  }
  if(op==='next-match'){
   if(team&&linkedSchedule)return Response.json({...base,roomId:chatRoomId,revision:null,
    nextMatch:{opponent:'Topspin Club',date:'2030-06-09',time:'18:00',facility:'Court 2',timeZone:'America/Chicago'}})
   if(team&&manualScheduleFixture.enabled)return Response.json({...base,roomId:chatRoomId,
    revision:manualScheduleFixture.revision,nextMatch:manualScheduleFixture.nextMatch})
   return Response.json({ok:false},{status:403})
  }
  const room=team?{...team,id:privateTeam?.id??chatRoomId,chatReady:true,canInviteTeammates:(captainInvitesEnabled||privateTeamFlow)&&owner===navigationOwner,
   ...(privateTools?{teamPractices:true,canPlanPractice:privateTools==='captain'&&owner===navigationOwner,
    canManageTeamLogo:privateTools==='captain'&&owner===navigationOwner}:{}),
   scheduleLinked:Boolean(linkedSchedule),manualFixture:manualScheduleFixture.enabled,canScheduleMatch:manualScheduleFixture.captain&&owner===navigationOwner,
   lastReadAt:'2026-11-06T10:00:00.000Z',members:[],
   ...(chatNamesEnabled?{chatDisplayName:chatNames.get(owner)||''}:{}),
   blockedMembers:chatSafetyFixture.blocked?[{id:firstPartyTeamMessages[0].senderUserId,name:firstPartyTeamMessages[0].senderName}]:[],
   messages:privateTeamFlow?[]:firstPartyTeamMessages.map((message,index)=>chatSafetyFixture.blocked&&index===0
    ?{...message,body:'',deletedAt:'1970-01-01T00:00:00.000Z'}
    :privateTools?{...message,isMine:message.senderUserId===owner,canManageOwn:message.senderUserId===owner}
    :chatNamesEnabled&&!message.isMine?{...message,senderName:chatNames.get(message.senderUserId)||message.senderName}:message)}:null
  return Response.json({...base,teams,room,nextCursor:''})
 }
 // Track tool-driven traffic separately from the independent live unread counter.
 if(url.pathname==='/api/mobile/chats/unread'){chatUnreadFixture.reads++;return Response.json(chatUnreadFixture.fail?{ok:false}:{ok:true,owner:currentNavigationOwner(),total:chatUnreadFixture.total,...(coachUnreadFixture.enabled?{coach:coachUnreadCounts(currentNavigationOwner())}:{}),teams:chatTeams().map((team,i)=>({...team,unread:i?0:chatUnreadFixture.total,...(chatUnreadFixture.detailed?{generalUnread:i?0:Math.min(2,chatUnreadFixture.total),rooms:i?[]:[{id:chatRoomId,name:chatUnreadFixture.roomName,unread:Math.max(0,chatUnreadFixture.total-2)}]}:{})}))},{status:chatUnreadFixture.fail?503:200})}
 fixtureState.requests++
 if(url.pathname==='/api/mobile/team-invites'||url.pathname==='/api/mobile/first-party/team-invites'){
  const command=JSON.parse(String(init?.body))
  const release=url.pathname.includes('/first-party/')?{releaseScope:'first-party',owner:currentNavigationOwner()}:{}
  if(release.releaseScope)firstPartyTeamFixture.requests.push('invite:'+command.action)
  if(['list','create','revoke'].includes(command.action)){
   const inviteScope=privateTeam??chatTeam
   if(!release.releaseScope||!(captainInvitesEnabled||privateTeamFlow)||release.owner!==navigationOwner||
    command.teamName!==inviteScope.teamName||command.leagueName!==inviteScope.leagueName||command.flight!==inviteScope.flight)
    return Response.json({ok:false},{status:403})
   const receipt={...release,ok:true,nativeCaptainInvites:1,action:command.action,scope:inviteScope}
   if(command.action==='list')return Response.json({...receipt,invites:captainInvite?[captainInvite]:[]})
   if(command.action==='create'&&!captainInvite)captainInvite={id:command.id,token:'44444444-4444-4444-8444-444444444444',
    expiresAt:'2030-01-01T00:00:00Z',revokedAt:null,acceptedCount:0,active:true}
   if(!captainInvite||captainInvite.id!==command.id)return Response.json({ok:false},{status:409})
   if(command.action==='revoke')captainInvite={...captainInvite,revokedAt:'2026-11-10T12:00:00Z',active:false}
   return Response.json({...receipt,operationId:command.id,invite:captainInvite})
  }
  const scope={...chatTeam,roomId:chatRoomId,expiresAt:'2027-06-30T18:00:00Z'}
  const expected={...scope,inviteId:'55555555-5555-4555-8555-555555555555',creatorId:navigationOwner}
  if(command.token!=='44444444-4444-4444-8444-444444444444')return Response.json({ok:false,message:'Invite unavailable.'},{status:404})
  fixtureState.teamInviteActions.push(command.action)
  if(command.action==='preview')return Response.json({ok:true,nativeTeamInvite:1,review:{...scope,expected,linkVersion:'v1',alreadyJoined:!!release.releaseScope&&firstPartyTeamJoined},...release})
  if(command.action!=='join'||JSON.stringify(command.expected)!==JSON.stringify({invite:expected,linkVersion:'v1'}))return Response.json({ok:false,message:'Invite changed.'},{status:409})
  chatUnreadFixture.detailed=true
  if(release.releaseScope)firstPartyTeamJoined=true
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
 if(url.pathname==='/api/mobile/calendar'||url.pathname==='/api/mobile/first-party/calendar'){
  const {enabled,revision,nextMatch}=manualScheduleFixture
  const match=readReviewedNextMatch(nextMatch)
  const include=new Headers(init?.headers).get(calendarTeamMatchesHeader)==='1'
  const teamMatches=include&&enabled&&revision&&match?[{roomId:chatRoomId,revision,match,scope:chatTeam}]:undefined
  const response=await calendarPreview(init?.method||'GET',url,init?.body,teamMatches)
  const hit=playerChatFixture.confirmedHit??playerChatFixture.hit,from=url.searchParams.get('from'),to=url.searchParams.get('to')
  if(response.ok&&hit?.status==='accepted'&&from&&to&&hit.date>=from&&hit.date<=to&&new Headers(init?.headers).get(chatHitsHeader)==='1'){
   return Response.json({...await response.json(),chatHits:[{...hit,partner:'Jamie'}]})
  }
  return response
 }
 if(url.pathname==='/api/mobile/first-party/court-results'){
  const owner=currentNavigationOwner()
  const include=!url.search&&new Headers(init?.headers).get(teamScorecardsHeader)==='1'
  const cards=include&&manualScheduleFixture.enabled?[teamResultFixture,...teamResultFixture.earlier]
   .sort((a,b)=>b.match.date.localeCompare(a.match.date))
   .flatMap(entry=>{
    const index=entry.score?.courtPlayers?.findIndex(players=>players.some(player=>player.id===owner))??-1
    if(index<0)return []
    const court=readTeamCourtScore(entry.score?.courtScores?.[index])
    const card=court&&teamCourtScorecard(chatRoomId,entry,index+1,court,entry.score?.courtPlayers?.[index]?.length??0)
    return card?[card]:[]
   }).slice(0,teamScorecardLimit):undefined
  return captainCourtPreview(url,owner,init?.body,cards)
 }
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
  if(nearbyExplore){
   const upcoming={...snapshot.leagues[0],location:nearbyExplore==='away'?'Kansas City, MO':'Saint Louis, MO',startsOn:'2026-11-13'}
   snapshot.leagues=[upcoming,{...upcoming,id:'past-season',name:'Past season',startsOn:'2026-10-01'}]
   if(snapshot.detail)snapshot.detail.league=upcoming
  }
  if(captainCourtsFixture.enabled&&snapshot.detail)snapshot.detail.fixtures[0].id=captainFixtureId
  if(audience==='public')snapshot.owner=publicCompetitionOwner
  const scoped=url.pathname==='/api/mobile/first-party/competitions'
  if(scoped&&(snapshot.scope==='discover'||snapshot.detail))snapshot.connections=[]
  if(scopedLeagueEntry.enabled){
   const league={...snapshot.leagues[0],name:'Northside Singles Ladder',format:'individual' as const}
   snapshot.leagues=[league]
   if(snapshot.detail)snapshot.detail.league=league
   snapshot.connections=!snapshot.detail&&snapshot.scope==='mine'&&scopedLeagueEntry.receipt
    ? [{leagueId:league.id,kind:'player',status:scopedLeagueEntry.receipt.status}] : []
   if(snapshot.detail&&scopedLeagueEntry.coordinator&&audience!=='public'){
    snapshot.connections=[{leagueId:league.id,kind:'organizer',status:'active'}]
    snapshot.canReviewEntries=true
    if(scopedLeagueSchedule.enabled)snapshot.canScheduleMatches=true
   }
   if(snapshot.detail&&scopedLeagueSchedule.enabled){
    snapshot.detailsUnderReview=true
    snapshot.detail={...snapshot.detail,participants:[],fixtures:[],results:[],standings:[],standingsAvailable:false}
    const match=scopedLeagueSchedule.match
    if(match)snapshot.publishedSchedule=[{id:match.id,a:match.a,b:match.b,date:match.date,time:match.time,facility:match.facility,status:match.status}]
   }
   if(snapshot.detail&&scopedLeagueEntry.receipt?.status==='active'){
    snapshot.detailsUnderReview=true
    snapshot.detail={...snapshot.detail,participants:[],fixtures:[],results:[],standings:[],standingsAvailable:false}
   }
  }
  if(scoped&&scopedLeagueScore.demo&&audience!=='public'){
   const id='tiq-testflight-scores-'+currentNavigationOwner()
   snapshot.leagues=[{...snapshot.leagues[0],id,name:'TestFlight Score Review'}]
   snapshot.connections=[{leagueId:id,kind:'organizer',status:'active'}]
   if(snapshot.detail){snapshot.detail.league=snapshot.leagues[0];snapshot.scoreReviewDemo=true}
  }
  if(scoped&&snapshot.detail&&scopedLeagueScore.enabled){
   const {match,card,coordinator,matchDay,player}=scopedLeagueScore
   snapshot.detail.fixtures=[{...match,facility:'Northside Tennis Center · Court 1',status:'coordinator_set'}]
   if(!player&&audience!=='public')snapshot.canOpenLeagueScores=true
   if(coordinator){
    snapshot.connections=[{leagueId:'league-one',kind:'organizer',status:'active'}]
    snapshot.canReviewEntries=true
    if(scopedLeagueScore.postpone){snapshot.canScheduleMatches=true;snapshot.canPostponeMatches=true}
   }
   if(card?.state==='approved'){
    const [line]=card.lines,winner=line.winner==='A'?match.a:match.b,loser=winner===match.a?match.b:match.a
    snapshot.detail.results=[{...match,id:scheduleId(11),winner,score:'',courts:card.lines.map((court,i)=>({
     label:'Line '+(i+1),a:'',b:'',winner:'Side '+court.winner,score:leagueCourtResultText(court),
    }))}]
    snapshot.detail.standings=[{teamName:winner,wins:1,losses:0,ties:0,lineWins:1,lineLosses:0,points:1},
     {teamName:loser,wins:0,losses:1,ties:0,lineWins:0,lineLosses:1,points:0}]
   }else{
    snapshot.detail.results=[]
    snapshot.detail.standings=[]
   }
   if(matchDay){
    const outcome=card?.state
    const action=outcome==='pending'?(coordinator?'review':'pending'):outcome==='changes_requested'?'fix':'enter'
    const otherMatch=scopedLeagueScore.moved??{...snapshot.detail.fixtures[0],id:scheduleId(13),date:'2026-11-11',a:'Topspin Club',b:'Deuce Crew'}
    snapshot.detail.fixtures.push(otherMatch)
    snapshot.matchDay={
     matches:outcome==='approved'?[{id:match.id,action:'result',resultId:scheduleId(11)}]:
      player||(!['pending'].includes(outcome??'')&&coordinator)?[]:[{id:match.id,action}],
     ...(coordinator?{pendingReviews:outcome==='pending'?1:0}:{}),
    }
    if(coordinator&&!player&&audience!=='public'&&new Headers(init?.headers).get('X-TenAceIQ-League-Attention')==='1'){
     const next=(id:string)=>scopedLeagueScore.reminders.get(id)??null
     snapshot.attention=[...(scopedLeagueScore.moved?[]:[{id:otherMatch.id,fixtureDigest:'a'.repeat(64),since:'2026-11-12T06:00:00Z',
      revision:null,note:'',nextReminderAt:next(otherMatch.id)}]),
      ...(card?.state==='changes_requested'?[{id:match.id,fixtureDigest:'b'.repeat(64),since:'2026-11-13T15:00:00Z',
       revision:card.revision,note:card.note,nextReminderAt:next(match.id)}]:[])]
    }
   }
  }
  fixtureState.competitionReads.push({
   path:url.pathname,query:snapshot.query,audience,authenticated:new Headers(init?.headers).has('Authorization'),
  })
  reply={ok:true,releaseScope:scoped&&!fixtureState.unscopedLeagueReply?'first-party':undefined,...snapshot}
 }
 if(scopedLeagueScore.postpone&&url.pathname==='/api/mobile/first-party/competitions/schedule'){
  const owner=currentNavigationOwner(),leagueId='league-one',aId=scheduleId(21),bId=scheduleId(22),venueId=scheduleId(23)
  const base={ok:true,releaseScope:'first-party',owner,leagueId}
  const current=scopedLeagueScore.moved??{id:scheduleId(13),a:'Topspin Club',b:'Deuce Crew',aId,bId,venueId,
   date:'2026-11-11',time:'18:30',court:'1',facility:'Northside Tennis Center · Court 1',duration:120,
   status:'coordinator_set',canPostpone:true as const,version:'2026-11-12T12:00:00Z'}
  if(!scopedLeagueScore.coordinator)return Response.json({...base,ok:false},{status:403})
  if(init?.method!=='POST')return Response.json({...base,format:'team',name:'Northside Night League',zone:'America/Chicago',
   startsOn:'2026-11-01',endsOn:'2026-12-31',defaultTime:'18:30',defaultVenueId:venueId,
   entries:[{id:aId,name:current.a},{id:bId,name:current.b}],venues:[{id:venueId,name:'Northside Tennis Center',detail:''}],matches:[current]})
  const body=JSON.parse(String(init.body)) as LeaguePostponement|LeagueScheduleChange
  if(body.leagueId!==leagueId||body.matchId!==current.id||body.version!==current.version)return Response.json({...base,ok:false},{status:409})
  const match='action' in body?{...current,status:'postponed',canPostpone:undefined,version:'2026-11-13T15:00:00Z'}:
   {...current,date:body.date,time:body.time,court:body.court,duration:body.duration,facility:'Northside Tennis Center · Court '+body.court,
    status:'coordinator_set',canPostpone:true as const,version:'2026-11-13T15:01:00Z'}
  scopedLeagueScore.moved=match
  firstPartyUpdatesFixture.leagueNotices=[{
   id:scheduleId(25),recipient_profile_id:owner,notification_type:'schedule',
   title:match.status==='postponed'?'League match postponed':'League match rescheduled',
   body:match.a+' vs '+match.b,href:'/explore/leagues/tiq/'+leagueId+'?scheduledMatch='+match.id+'#league-schedule',
   conversation_id:null,schedule_event_id:null,read_at:null,created_at:'2026-11-13T15:00:00Z',
  }]
  return Response.json({...base,requestId:body.requestId,match,notified:2,unreachable:0})
 }
 if(scopedLeagueSchedule.enabled&&url.pathname==='/api/mobile/first-party/competitions/schedule'){
  const review={
   owner:currentNavigationOwner(),leagueId:'league-one',name:'Northside Singles Ladder',format:'individual',zone:'America/Chicago',
   startsOn:'2026-11-01',endsOn:'2026-12-31',defaultTime:'18:00',defaultVenueId:scheduleId(3),
   entries:[{id:scheduleId(1),name:'Alex Server'},{id:scheduleId(2),name:'Drew Return'}],
   venues:[{id:scheduleId(3),name:'Northside Tennis Club',detail:'123 Court Drive, St. Louis, MO'}],
   matches:scopedLeagueSchedule.match?[scopedLeagueSchedule.match]:[],
  } satisfies LeagueScheduleReview
  if(init?.method!=='POST')return Response.json({ok:true,releaseScope:'first-party',...review})
  const body=JSON.parse(String(init.body)) as LeagueScheduleChange
  const repeated=scopedLeagueSchedule.requests.some(request=>request.requestId===body.requestId)
  scopedLeagueSchedule.requests.push(body)
  if(!repeated){
   const [a,b]=review.entries
   scopedLeagueSchedule.match={id:body.matchId??scheduleId(4),a:a.name,b:b.name,aId:body.a,bId:body.b,
    date:body.date,time:body.time,venueId:body.venueId,court:body.court,duration:body.duration,
    facility:review.venues[0].name+' · Court '+body.court,status:'coordinator_set',version:'2026-11-14T00:00:00Z'}
   firstPartyUpdatesFixture.leagueNotices=body.notify?[{
    id:scheduleId(5),recipient_profile_id:review.owner,notification_type:'schedule',title:body.matchId?'League match rescheduled':'League match scheduled',
    body:a.name+' vs '+b.name+' · '+scopedLeagueSchedule.match.facility,
    href:'/explore/leagues/tiq/league-one?scheduledMatch='+scopedLeagueSchedule.match.id+'#league-schedule',
    conversation_id:null,schedule_event_id:null,read_at:null,created_at:'2026-11-13T15:00:00Z',
   }]:[]
  }
  if(scopedLeagueSchedule.lostReply){
   scopedLeagueSchedule.lostReply=false
   return Response.json({ok:false,releaseScope:'first-party'},{status:503})
  }
  return Response.json({ok:true,releaseScope:'first-party',owner:review.owner,leagueId:review.leagueId,requestId:body.requestId,
   match:scopedLeagueSchedule.match,notified:body.notify?2:0,unreachable:0})
 }
 if(scopedLeagueScore.enabled&&url.pathname==='/api/mobile/first-party/competitions/scores'){
  const {match,card,coordinator,demo}=scopedLeagueScore
  const owner=currentNavigationOwner(),leagueId=demo?'tiq-testflight-scores-'+owner:'league-one'
  const base={ok:true,releaseScope:'first-party',owner,leagueId}
  if(init?.method!=='POST'){
   if(!url.searchParams.has('match'))return Response.json({...base,matches:(coordinator||demo)&&card?.state==='pending'?[match]:[]})
   return Response.json({...base,desk:{match,fixtureVersion:'2026-11-13T12:00:00Z',card,
    canSubmit:!coordinator||demo,canReview:coordinator||demo,thirdSetRule:'either',
    slots:demo?[{label:'Singles 1',format:'singles'},{label:'Doubles 1',format:'doubles'},{label:'Doubles 2',format:'doubles'}]:[{label:'Singles 1',format:'singles'}]}})
  }
  const body=JSON.parse(String(init.body)) as LeagueScoreChange | ReturnType<typeof readScoreReminder>
  if(body.action==='remind'){
   const correction=body.matchId===match.id&&card?.state==='changes_requested'&&body.revision===card.revision
   const missing=body.matchId===scheduleId(13)&&body.revision===null
   if(!coordinator||body.leagueId!==leagueId||!correction&&!missing){
    return Response.json({ok:false,releaseScope:'first-party',message:'Match access changed.'},{status:409})
   }
   scopedLeagueScore.reminderRequests++
   const nextReminderAt='2026-11-14T15:00:00Z'
   const code=scopedLeagueScore.reminders.has(body.matchId)?'recent':'sent'
   scopedLeagueScore.reminders.set(body.matchId,nextReminderAt)
   return Response.json({...base,matchId:body.matchId,code,count:correction?1:2,nextReminderAt})
  }
  if(body.leagueId!==leagueId||body.matchId!==match.id||body.revision!==(card?.revision??null)||!demo&&coordinator===(body.action==='submit')){
   return Response.json({ok:false,releaseScope:'first-party',message:'Match access changed.'},{status:409})
  }
  scopedLeagueScore.card={revision:body.requestId,state:body.action==='submit'?'pending':body.action==='return'?'changes_requested':'approved',
   lines:body.action==='submit'?body.lines:card!.lines,note:body.note}
  firstPartyUpdatesFixture.leagueNotices=body.action==='return'?[{
   id:scheduleId(12),recipient_profile_id:base.owner,notification_type:'system',title:'League score needs corrections',
   body:match.a+' vs '+match.b,href:'/explore/leagues/tiq/'+leagueId+'?scoreMatch='+match.id+'#league-scores',
   conversation_id:null,schedule_event_id:null,read_at:null,created_at:'2026-11-13T15:00:00Z',
  }]:[]
  return Response.json({...base,matchId:match.id,card:scopedLeagueScore.card})
 }
 if(scopedLeagueEntry.enabled&&url.pathname.endsWith('/competitions/decisions')){
  scopedLeagueEntry.decisionRequests.push(url.pathname)
  if(!scopedLeagueEntry.coordinator)return Response.json({ok:false,releaseScope:'first-party'},{status:403})
  const review={...decisionReviewFixture(),owner:currentNavigationOwner(),leagueName:'Northside Singles Ladder'}
  const entry=review.entries[0]
  if(init?.method==='POST'){
   const body=JSON.parse(String(init.body)) as {leagueId:string;entryId:string;decision:string;confirmed:boolean}
   if(body.leagueId!==review.leagueId||body.entryId!==entry.id||body.decision!=='active'||!body.confirmed){
    return Response.json({ok:false,releaseScope:'first-party'},{status:400})
   }
   scopedLeagueEntry.receipt={id:entry.id,name:entry.name,status:'active'}
   return Response.json({ok:true,releaseScope:'first-party',owner:review.owner,leagueId:review.leagueId,receipt:{...entry,status:'active'}})
  }
  return Response.json({ok:true,releaseScope:'first-party',...review,entries:scopedLeagueEntry.receipt?.status==='active'?[]:[entry]})
 }
 if(scopedLeagueEntry.enabled&&url.pathname.endsWith('/competitions/entry')){
  scopedLeagueEntry.requests.push(url.pathname)
  const review={...entryReviewFixture(),owner:currentNavigationOwner(),leagueName:'Northside Singles Ladder'}
  review.player={id:'',name:'',location:'',rating:null,ratingSource:'unknown',hasAgeEvidence:false,hasDivisionEvidence:false}
  const releaseScope=scopedLeagueEntry.unscoped?undefined:'first-party'
  if(init?.method==='POST'){
   const body=JSON.parse(String(init.body)) as {draft:{name:string}}
   scopedLeagueEntry.receipt={id:'entry-demo',name:body.draft.name,status:'pending'}
   return Response.json({ok:true,releaseScope,owner:review.owner,leagueId:review.leagueId,
    receipt:scopedLeagueEntry.receipt,alreadySubmitted:false})
  }
  return Response.json({ok:true,releaseScope,...review,receipts:scopedLeagueEntry.receipt?[scopedLeagueEntry.receipt]:[]})
 }
 if(scopedRegistration.enabled&&['/api/mobile/first-party/tournaments/entry','/api/mobile/first-party/tournaments/entries'].includes(url.pathname)){
  const receipt={...tournamentReceipt(),status:scopedRegistration.status,inDraw:scopedRegistration.status==='approved'}
  if(url.pathname.endsWith('/entries'))return Response.json({ok:true,scope:'first-party',owner:currentNavigationOwner(),more:false,
   entries:scopedRegistration.status?[{...myEntriesFixture.entries[0],status:receipt.status}]:[]})
  if(init?.method==='POST'){
   const command=JSON.parse(String(init.body))
   if(command.action!=='submit'||command.parent!=='event-one'||command.division!=='division-one'||command.data.two!=='Sam Return'||!command.data.partnerAttested){
    return Response.json({ok:false},{status:400})
   }
   scopedRegistration.status='pending'
   receipt.status='pending'
  }
  const snapshot=tournamentEntrySnapshot()
  snapshot.context.owner=currentNavigationOwner()
  return Response.json({ok:true,scope:'first-party',...snapshot,receipt:scopedRegistration.status?receipt:null,
   ...(init?.method==='POST'?{alreadySubmitted:false}:{})})
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
  if(nearbyExplore){
   snapshot.tournaments[0].location='Kansas City, MO'
   if(snapshot.detail)snapshot.detail.root.location='Kansas City, MO'
  }
  snapshot.owner=navigationOwner;snapshot.query=url.searchParams.get('q')||''
  if((tournamentShortcutFixture.enabled||myEntriesFixture.enabled)&&snapshot.detail?.active){
   const match=snapshot.detail.matches.find(match=>match.id==='r2-m1')!
   match.a=tournamentReceipt().name;match.date=shortcutDate
  }
  if(scopedRegistration.enabled&&snapshot.detail?.active){
   if(scopedRegistration.status==='approved'&&!scopedRegistration.published)return Response.json({ok:false},{status:503})
   snapshot.detail.entryAvailable=true
   const match=snapshot.detail.matches.find(match=>match.id==='r2-m1')!
   match.a=tournamentReceipt().name
   match.date=shortcutDate
  }
  const scope=url.pathname==='/api/mobile/first-party/tournaments'&&!fixtureState.unscopedTournamentReply?'first-party':undefined
  reply={ok:true,scope,...snapshot}
 }
 return new Response(JSON.stringify(reply),{status:200,headers:{'Content-Type':'application/json'}})
}
void import('../../mobile/src/main').then(()=>{
 const controls=document.createElement('aside');controls.setAttribute('aria-label','Preview test controls');controls.className='preview-controls'
 controls.innerHTML='<p>Synthetic account preview</p><button type="button" data-preview-refresh>Simulate token refresh</button><button type="button" data-preview-owner>Switch synthetic account</button><button type="button" data-preview-online>Simulate reconnect</button>'
 document.body.append(controls);controls.querySelector('[data-preview-refresh]')?.addEventListener('click',refreshNavigationSession);controls.querySelector('[data-preview-owner]')?.addEventListener('click',()=>switchNavigationOwner());controls.querySelector('[data-preview-online]')?.addEventListener('click',()=>window.dispatchEvent(new Event('online')))
 coachPreviewControls(controls)
 tacticsPreviewControls(controls)
})
