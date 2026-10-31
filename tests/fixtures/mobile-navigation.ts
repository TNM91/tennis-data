import {coachUnreadFixture,coachUnreadCounts,coachUnreadMessages} from './mobile-coach-unread'
import {coachChatFixture,coachChatPreview} from './mobile-coach-chats'
import {calendarFixture,calendarPreview} from './mobile-calendar'
import {openSyntheticLink} from './mobile-navigation-app'
import {calendarTeamFixture,calendarTeamPreview} from './mobile-calendar-practices'
import {updatesFixture,updateCoachStudent} from './mobile-updates-client'
import {clearCoachDeviceData} from '../../mobile/src/coach-device-cleanup'
import {coachResourcesPreview,coachMessagesPreview} from './native-coach-complete-browser'
import {navigationOwner,currentNavigationOwner,refreshNavigationSession,switchNavigationOwner,connectNavigationPlayer,emitChatSignal} from './mobile-navigation-client'
import {competitionSnapshot,competitionDetail} from './competitions-data'
import {tournamentSnapshot} from './native-tournaments'
import {DEFAULT_ENTITLEMENTS} from '../../lib/access-model-core'
import {coachPreviewControls,coachPreviewRequest,coachPreviewInvitesRequest,coachPreviewConnectionRequest} from './native-coach-browser'
import {tacticsPreviewControls,tacticsPreviewRequest} from './native-tactics-browser'
const originalFetch=window.fetch.bind(window)
const fixtureState={requests:0}
const chatUnreadFixture={total:7,fail:false,detailed:false,secondTeam:false,denyRoom:false,roomName:'Practice & match prep <img src=x>',opened:[] as string[],emit:emitChatSignal}
const chatTeam={teamName:'Baseline Aces',leagueName:'City League',flight:'4.0'},chatRoomId='33333333-3333-4333-8333-333333333333'
const chatTeams=()=>[chatTeam,...(chatUnreadFixture.secondTeam?[{...chatTeam,leagueName:'Evening League',flight:'4.5'}]:[])]
Object.assign(window,{chatUnreadFixture,calendarTeamFixture,coachChatFixture,coachUnreadFixture})
Object.assign(window,{navigationFixture:fixtureState,calendarFixture,clearSyntheticCoachCache:clearCoachDeviceData,openSyntheticLink,updatesFixture,refreshNavigationSession,switchNavigationOwner})
window.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href)
 if(url.origin===location.origin)return originalFetch(input,init)
 // Track tool-driven traffic separately from the independent live unread counter.
 if(url.pathname==='/api/mobile/chats/unread')return Response.json(chatUnreadFixture.fail?{ok:false}:{ok:true,owner:currentNavigationOwner(),total:chatUnreadFixture.total,...(coachUnreadFixture.enabled?{coach:coachUnreadCounts(currentNavigationOwner())}:{}),teams:chatTeams().map((team,i)=>({...team,unread:i?0:chatUnreadFixture.total,...(chatUnreadFixture.detailed?{generalUnread:i?0:Math.min(2,chatUnreadFixture.total),rooms:i?[]:[{id:chatRoomId,name:chatUnreadFixture.roomName,unread:Math.max(0,chatUnreadFixture.total-2)}]}:{})}))},{status:chatUnreadFixture.fail?503:200})
 fixtureState.requests++
 if(url.pathname==='/api/team-rooms'){
  if(coachChatFixture.teamFail)return Response.json({ok:false},{status:503})
  const roomId=url.searchParams.get('chatRoom'),selected=url.searchParams.get('team')
  if(selected)chatUnreadFixture.opened.push(url.search)
  if(selected&&chatUnreadFixture.denyRoom)return Response.json({ok:false},{status:403})
  const team=chatTeams().find(team=>team.teamName===selected&&team.leagueName===url.searchParams.get('league')&&team.flight===url.searchParams.get('flight'))
  return Response.json({ok:true,teams:chatTeams(),room:chatUnreadFixture.detailed&&team?{...team,id:roomId||'22222222-2222-4222-8222-222222222222',subject:team.teamName,messages:[],members:[],chatReady:false,...(roomId?{chatRoom:{id:roomId,parentId:'22222222-2222-4222-8222-222222222222',name:chatUnreadFixture.roomName,teamMuted:false}}:{})}:null})
 }
 if(url.pathname==='/api/mobile/calendar/practices'||url.pathname==='/api/mobile/practices')return calendarTeamPreview(init?.method||'GET',url,init?.body)
 if(url.pathname==='/api/mobile/calendar')return calendarPreview(init?.method||'GET',url,init?.body)
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
 if(url.pathname==='/api/mobile/coach/connection')return coachPreviewConnectionRequest(init?.body)
 if(url.pathname==='/api/mobile/coach/tactics')return tacticsPreviewRequest(init?.method||'GET',url,init?.body)
 let reply:unknown={ok:false,error:'Synthetic preview does not provide this service'}
 if(url.pathname==='/api/profile/link'){connectNavigationPlayer();reply={ok:true,profile:{linked_player_id:navigationOwner}}}
 if(url.pathname==='/api/auth/access')reply={ok:true,access:{role:'admin',entitlements:{...DEFAULT_ENTITLEMENTS}}}
 if(url.pathname==='/api/mobile/competitions'){const snapshot=competitionSnapshot();snapshot.scope=url.searchParams.get('scope')==='discover'?'discover':'mine';snapshot.query=url.searchParams.get('q')||'';if(url.searchParams.get('league'))snapshot.detail=competitionDetail();reply={ok:true,...snapshot}}
 if(url.pathname==='/api/mobile/tournaments'){const snapshot=tournamentSnapshot(url.searchParams.get('tournament')||'',url.searchParams.get('division')||'');snapshot.owner=navigationOwner;snapshot.query=url.searchParams.get('q')||'';reply={ok:true,...snapshot}}
 return new Response(JSON.stringify(reply),{status:200,headers:{'Content-Type':'application/json'}})
}
void import('../../mobile/src/main').then(()=>{
 const controls=document.createElement('aside');controls.setAttribute('aria-label','Preview test controls');controls.className='preview-controls'
 controls.innerHTML='<p>Synthetic account preview</p><button type="button" data-preview-refresh>Simulate token refresh</button><button type="button" data-preview-owner>Switch synthetic account</button><button type="button" data-preview-online>Simulate reconnect</button>'
 document.body.append(controls);controls.querySelector('[data-preview-refresh]')?.addEventListener('click',refreshNavigationSession);controls.querySelector('[data-preview-owner]')?.addEventListener('click',switchNavigationOwner);controls.querySelector('[data-preview-online]')?.addEventListener('click',()=>window.dispatchEvent(new Event('online')))
 coachPreviewControls(controls)
 tacticsPreviewControls(controls)
})
