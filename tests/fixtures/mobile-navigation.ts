import {openSyntheticLink} from './mobile-navigation-app'
import {updatesFixture,updateCoachStudent} from './mobile-updates-client'
import {clearCoachDeviceData} from '../../mobile/src/coach-device-cleanup'
import {coachResourcesPreview,coachMessagesPreview} from './native-coach-complete-browser'
import {navigationOwner,refreshNavigationSession,switchNavigationOwner,connectNavigationPlayer} from './mobile-navigation-client'
import {competitionSnapshot,competitionDetail} from './competitions-data'
import {tournamentSnapshot} from './native-tournaments'
import {DEFAULT_ENTITLEMENTS} from '../../lib/access-model-core'
import {coachPreviewControls,coachPreviewRequest,coachPreviewInvitesRequest,coachPreviewConnectionRequest} from './native-coach-browser'
import {tacticsPreviewControls,tacticsPreviewRequest} from './native-tactics-browser'
const originalFetch=window.fetch.bind(window)
const fixtureState={requests:0}
Object.assign(window,{navigationFixture:fixtureState,clearSyntheticCoachCache:clearCoachDeviceData,openSyntheticLink,updatesFixture,refreshNavigationSession,switchNavigationOwner})
window.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href)
 if(url.origin===location.origin)return originalFetch(input,init)
 fixtureState.requests++
 if(url.pathname==='/api/mobile/coach/resources')return coachResourcesPreview(init?.method||'GET',url,init?.body)
 if(url.pathname==='/api/mobile/coach/messages'){
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
