import type {LabGoal} from '../../lib/my-lab-goal-sync'
import {html} from './match-details'
import websiteUi from '../generated/website-ui.json'
import {nativeActionIcon} from './native-action-icons'
import type {LabTrainingOverview} from './lab-training-overview'
import {labRatingLoadingHtml} from './player-ratings-view'
import {trainingTime} from './level-up-model'
export type LabProfile={linked_player_id?:string|null;linked_player_name?:string|null;linked_team_name?:string|null;linked_league_name?:string|null}

export function labTrainingActionsHtml(){
 return `<section class="lab-training-overview" aria-labelledby="lab-training-title">
  <h2 id="lab-training-title">Your training</h2>
  <p>See your last drill and what to try next, or open a saved weekly plan.</p>
  <div class="lab-training-actions">
   <button type="button" class="secondary" id="lab-training-refresh">Load saved practice</button>
   <button type="button" data-training="weeks">Open saved weeks</button>
  </div>
  <p role="status" id="lab-training-status"></p>
 </section>`
}

export function labScoreboardHtml(profile:LabProfile|null,justConnected=false){
 const name=profile?.linked_player_name
 return `<section class="tab-hero lab-stat-panel lab-scoreboard" aria-labelledby="lab-ratings-title">
  ${name||!profile?`<header class="lab-scoreboard-intro"><div>${justConnected?'<small class="stat-eyebrow lab-link-confirmed" id="lab-link-confirmed">Player record connected</small>':`<small class="stat-eyebrow">${name?'My Lab':'Your game'}</small>`}
   <h1 tabindex="-1"${justConnected?' aria-describedby="lab-link-confirmed"':''}>${html(name||'My Lab')}</h1>${name?`<p>${html(profile?.linked_team_name||'Your tennis, in focus')}</p>`:'<span class="lab-profile-loading-line" aria-hidden="true"></span>'}</div>
   ${name?`<button type="button" class="secondary lab-profile-action" data-lab-profile aria-label="Open full player profile">${nativeActionIcon('profile')}</button>`:''}</header>`:''}
  <h2 id="lab-ratings-title" class="sr-only">Your scoreboard</h2>
  <div data-lab-ratings aria-live="polite">${profile?'':labRatingLoadingHtml('profile')}</div>
  ${name&&profile?.linked_player_id?`<button type="button" class="secondary lab-scorecard-jump" data-lab-scorecard-jump>
   <span>Recent scorecards</span><span aria-hidden="true">↓</span>
  </button>`:''}
 </section>`
}

export function labStarterActionsHtml(){
 return `<div class="native-entry-list lab-starter-actions" role="group" aria-label="Play or practice">
   <button type="button" class="secondary app-tool native-entry-featured" data-app-destination="compete" data-browse-first>
    <span class="app-tool-icon" aria-hidden="true">${websiteUi.icons.compete}</span>
    <span class="app-tool-copy"><strong>Find a match</strong></span>
   </button>
   <button type="button" class="secondary app-tool" data-app-destination="training" data-training-card="split-step-rhythm">
    <span class="app-tool-icon" aria-hidden="true">${websiteUi.icons.catalog}</span>
    <span class="app-tool-copy"><strong>Try a drill</strong></span>
   </button>
   <p class="lab-warmup-receipt sr-only" data-lab-warmup-receipt role="status" aria-atomic="true"></p>
 </div>`
}

export function showLabWarmupReceipt(trigger:HTMLElement,title:string,elapsedSeconds:number){
 const receipt=trigger.closest('.lab-starter-actions')?.querySelector<HTMLElement>('[data-lab-warmup-receipt]')
 if(!receipt?.isConnected)return
 receipt.classList.remove('sr-only')
 receipt.innerHTML=`<strong><span aria-hidden="true">✓ </span>Warm-up complete</strong><span>${html(title)} · ${trainingTime(elapsedSeconds)}</span>`
}

export function labFirstScorecardHtml(){
 return `<div class="lab-first-scorecard">
  <p>Scorecards appear here as results are added to your player record.</p>
  ${labStarterActionsHtml()}
 </div>`
}

export function labIdentityHtml(profile: LabProfile | null, overview?: LabTrainingOverview, focus?: LabGoal) {
 const name = profile?.linked_player_name || ''
 const linked = Boolean(profile?.linked_player_id && name)
 const values: Record<string, string> = {
  TIQ_FIRST_NAME: html(name.trim().split(/\s+/)[0] || ''),
  TIQ_PLAYER_NAME: html(name),
  TIQ_PLAYER_ID: 'linked-player',
  TIQ_FOCUS_TITLE: html(focus?.goal || ''),
  TIQ_FOCUS_NOTE: html(focus?.improveNext || focus?.progressUpdate || 'Review your notes before the next match or practice.'),
  ...Object.fromEntries(Object.entries(overview?.text || {}).map(([key, value]) => [key, html(value)])),
 }
 let template = linked ? websiteUi.labLinked : websiteUi.labUnlinked.replaceAll('Active player', 'Player record')
 if (linked && overview) template = (overview.hasProof ? websiteUi.labProof : websiteUi.labProgress)[overview.completed]
 else if (linked && focus) template = websiteUi.labFocus
 const content = template
  .replace(/<header\b[^>]*data-native-part="intro"[^>]*>[\s\S]*?<\/header>/g, header => linked ? '' : header)
  .replace(/<img\b[^>]*data-native-part="(?:ballImage|courtImage)"[^>]*>/g, '')
  .replaceAll('<span aria-hidden="true">→</span>', '<span aria-hidden="true">›</span>')
  .replace('TIQ_CARD_TITLE is in the books.', 'TIQ_CARD_TITLE')
  .replace('aria-labelledby="my-lab-command-title"', linked ? 'aria-label="Your next tennis move for TIQ_PLAYER_NAME"' : 'aria-labelledby="my-lab-command-title"')
  .replace(/<h1(\s[^>]*)?>/g, linked ? '<h2$1>' : '<h1$1>')
  .replaceAll('</h1>', linked ? '</h2>' : '</h1>')
  .replace(/TIQ_[A-Z_]+/g, key => values[key] ?? key)
  .replace(/data-native-ui-action="training:([^"]+)"/g, (_, action) => {
   const target = `data-training="${action}"`
   return action === 'next' && overview
    ? `${target} data-training-card="${html(overview.cardId)}" data-training-direction="${html(overview.identitySlug)}"`
    : target
  })
  .replace(/data-native-ui-action="screen:([^"]+)"/g, 'data-lab-screen="$1"')
  .replaceAll('data-native-ui-action="connect"', 'data-connect-player')
  .replaceAll('data-native-ui-action="profile"', 'data-lab-profile')
  .replace(/data-native-ui-action="goals"/g, 'data-lab-goals')
 const context = linked ? `<p class="lab-context">${html(profile?.linked_team_name || 'No team linked')} · ${html(profile?.linked_league_name || 'No league linked')}</p>` : ''
 return `<div class="website-ui website-lab">${content}${context}</div>`
}
export function labActionsHtml(){const tools=[{kind:'screen',action:'competitions',icon:'compete',title:'Your competitions',detail:'TiQ leagues, schedules, results and standings.'},{kind:'training',action:'inbox',icon:'inbox',title:'Your training inbox',detail:'Saved weekly plans and coach assignments.'},{kind:'training',action:'progress',icon:'progress',title:'Your training progress',detail:'Review sessions saved to your account.'},{kind:'screen',action:'teams',icon:'teams',title:'Open Chats',detail:'Your teams, conversations and match week.'},{kind:'screen',action:'following',icon:'following',title:'Review Following',detail:'Players, teams and leagues you follow.'},{kind:'screen',action:'explore',icon:'explore',title:'Explore tennis',detail:'Find players, teams, leagues and rankings.'}];return `<section class="tennis-tools" aria-labelledby="lab-tools-title"><h2 id="lab-tools-title">Your player tools</h2><div class="tennis-tool-grid">${tools.map(t=>`<button type="button" class="secondary tennis-tool" ${t.kind==='training'?'data-training':'data-lab-screen'}="${t.action}"><span class="tool-icon" aria-hidden="true">${websiteUi.icons[t.icon as keyof typeof websiteUi.icons]}</span><span class="tool-copy"><strong>${t.title}</strong><span>${t.detail}</span></span><span aria-hidden="true" class="tool-arrow">→</span></button>`).join('')}</div></section>`}
