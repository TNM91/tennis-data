import {navigationOwner,refreshNavigationSession,switchNavigationOwner} from './mobile-navigation-client'
import {competitionSnapshot,competitionDetail} from './competitions-data'
import {tournamentSnapshot} from './native-tournaments'
import {DEFAULT_ENTITLEMENTS} from '../../lib/access-model-core'
import {coachPreviewControls,coachPreviewRequest,coachPreviewInvitesRequest} from './native-coach-browser'
const originalFetch=window.fetch.bind(window)
window.fetch=async(input,init)=>{
 const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,location.href)
 if(url.origin===location.origin)return originalFetch(input,init)
 if(url.pathname==='/api/mobile/coach')return coachPreviewRequest(init?.method||'GET',url,init?.body)
 if(url.pathname==='/api/mobile/coach/invites')return coachPreviewInvitesRequest(init?.method||'GET',url,init?.body)
 let reply:unknown={ok:false,error:'Synthetic preview does not provide this service'}
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
})
