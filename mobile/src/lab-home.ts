import type {LabGoal} from '../../lib/my-lab-goal-sync'
import {html} from './match-details'
import websiteUi from '../generated/website-ui.json'
import {nativeActionIcon} from './native-action-icons'
import type {LabTrainingOverview} from './lab-training-overview'
export type LabProfile={linked_player_id?:string|null;linked_player_name?:string|null;linked_team_name?:string|null;linked_league_name?:string|null}

export function labTrainingActionsHtml(){
 return `<section class="lab-training-overview" aria-labelledby="lab-training-title">
  <h2 id="lab-training-title">Your training</h2>
  <p>Pick up a saved weekly plan or see your recent practice.</p>
  <div class="lab-training-actions">
   <button type="button" data-training="weeks">Open saved weeks</button>
   <button type="button" class="secondary" id="lab-training-refresh">Load training overview</button>
  </div>
  <p role="status" id="lab-training-status"></p>
 </section>`
}

export function labScoreboardHtml(profile:LabProfile){
 const name=profile.linked_player_name
 return `<section class="tab-hero lab-stat-panel lab-scoreboard" aria-labelledby="lab-ratings-title">
  ${name?`<header class="lab-scoreboard-intro"><div><small class="stat-eyebrow">My Lab</small><h1 tabindex="-1">${html(name)}</h1><p>${html(profile.linked_team_name||'Your tennis, in focus')}</p></div><button type="button" class="secondary lab-profile-action" data-lab-profile aria-label="Open full player profile">${nativeActionIcon('profile')}</button></header>`:''}
  <h2 id="lab-ratings-title" class="sr-only">Your scoreboard</h2><div data-lab-ratings aria-live="polite"></div>
 </section>`
}
export function labIdentityHtml(profile:LabProfile|null,overview?:LabTrainingOverview,focus?:LabGoal){
 const linked=Boolean(profile?.linked_player_id&&profile.linked_player_name),name=profile?.linked_player_name||'',values:Record<string,string>={TIQ_FIRST_NAME:html(name.trim().split(/\s+/)[0]||''),TIQ_PLAYER_NAME:html(name),TIQ_PLAYER_ID:'linked-player',TIQ_FOCUS_TITLE:html(focus?.goal||''),TIQ_FOCUS_NOTE:html(focus?.improveNext||focus?.progressUpdate||'Review your notes before the next match or practice.'),...Object.fromEntries(Object.entries(overview?.text||{}).map(([key,value])=>[key,html(value)]))}
 return '<div class="website-ui website-lab">'+(linked&&overview?(overview.hasProof?websiteUi.labProof:websiteUi.labProgress)[overview.completed]:linked?focus?websiteUi.labFocus:websiteUi.labLinked:websiteUi.labUnlinked.replaceAll('Active player','Player record')).replace(/<header\b[^>]*data-native-part="intro"[^>]*>[\s\S]*?<\/header>/g,header=>linked?'':header).replace(/<img\b[^>]*data-native-part="(?:ballImage|courtImage)"[^>]*>/g,'').replace('aria-labelledby="my-lab-command-title"',linked?'aria-label="Your next tennis move for TIQ_PLAYER_NAME"':'aria-labelledby="my-lab-command-title"').replace(/<h1(\s[^>]*)?>/g,linked?'<h2$1>':'<h1$1>').replaceAll('</h1>',linked?'</h2>':'</h1>').replace(/TIQ_[A-Z_]+/g,key=>values[key]??key).replace(/data-native-ui-action="training:([^"]+)"/g,(_,action)=>'data-training="'+action+'"'+(action==='next'&&overview?' data-training-card="'+html(overview.cardId)+'" data-training-direction="'+html(overview.identitySlug)+'"':'')).replace(/data-native-ui-action="screen:([^"]+)"/g,'data-lab-screen="$1"').replace(/data-native-ui-action="connect"/g,'data-connect-player').replace(/data-native-ui-action="profile"/g,'data-lab-profile').replace(/data-native-ui-action="goals"/g,'data-lab-goals')+(linked?'<p class="lab-context">'+html(profile!.linked_team_name||'No team linked')+' · '+html(profile!.linked_league_name||'No league linked')+'</p>':'')+'</div>'
}
export function labActionsHtml(){const tools=[{kind:'screen',action:'competitions',icon:'compete',title:'Your competitions',detail:'TiQ leagues, schedules, results and standings.'},{kind:'training',action:'inbox',icon:'inbox',title:'Your training inbox',detail:'Saved weekly plans and coach assignments.'},{kind:'training',action:'progress',icon:'progress',title:'Your training progress',detail:'Review sessions saved to your account.'},{kind:'screen',action:'teams',icon:'teams',title:'Open Chats',detail:'Your teams, conversations and match week.'},{kind:'screen',action:'following',icon:'following',title:'Review Following',detail:'Players, teams and leagues you follow.'},{kind:'screen',action:'explore',icon:'explore',title:'Explore tennis',detail:'Find players, teams, leagues and rankings.'}];return `<section class="tennis-tools" aria-labelledby="lab-tools-title"><h2 id="lab-tools-title">Your player tools</h2><div class="tennis-tool-grid">${tools.map(t=>`<button type="button" class="secondary tennis-tool" ${t.kind==='training'?'data-training':'data-lab-screen'}="${t.action}"><span class="tool-icon" aria-hidden="true">${websiteUi.icons[t.icon as keyof typeof websiteUi.icons]}</span><span class="tool-copy"><strong>${t.title}</strong><span>${t.detail}</span></span><span aria-hidden="true" class="tool-arrow">→</span></button>`).join('')}</div></section>`}
