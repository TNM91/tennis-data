import websiteUi from '../generated/website-ui.json'
import {nativeActionIcon} from './native-action-icons'

const setupActions=[
 {key:'player',attribute:'data-connect-player',title:'Find my player',detail:'Bring your TIQ ratings and match history into My Lab.',icon:nativeActionIcon('profile')},
 {key:'team',attribute:'data-setup-team',title:'Use a team invite',detail:'Join your team with a link from your captain.',icon:websiteUi.icons.teams},
 {key:'explore',attribute:'data-app-destination="explore"',title:'Explore tennis',detail:'Browse players, teams and rankings.',icon:websiteUi.icons.explore},
] as const

export function playerSetupHtml(){
 return `<section class="player-setup" aria-labelledby="player-setup-title">
  <header class="native-entry-hero tab-hero tab-hero-court">
   <small class="stat-eyebrow">My Lab</small>
   <h1 id="player-setup-title" tabindex="-1">Your tennis starts here.</h1>
   <p>Find your record or jump into your team.</p>
  </header>
  <div class="native-entry-list">${setupActions.map(action=>`
   <button type="button" class="secondary app-tool${action.key==='player'?' native-entry-featured':''}" ${action.attribute} aria-labelledby="setup-${action.key}-title" aria-describedby="setup-${action.key}-detail">
    <span class="app-tool-icon" aria-hidden="true">${action.icon}</span>
    <span class="app-tool-copy"><strong id="setup-${action.key}-title">${action.title}</strong><span id="setup-${action.key}-detail">${action.detail}</span></span>
    <span aria-hidden="true">›</span>
   </button>`).join('')}</div>
 </section>`
}
