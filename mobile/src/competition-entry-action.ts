import websiteUi from '../generated/website-ui.json'

export function competitionEntryActionHtml(kind:'league'|'tournament') {
 const id=`${kind}-entry-action`
 const action=kind==='league'?'data-competition-entry':'data-tournament-entry'
 return `<button type="button" class="secondary competition-entry-action" ${action} aria-labelledby="${id}-title" aria-describedby="${id}-description">
  <span class="competition-entry-icon" aria-hidden="true">${websiteUi.icons.inbox}</span>
  <span class="app-tool-copy"><strong id="${id}-title">Entry &amp; registration</strong><span id="${id}-description">See how to enter or review your entry.</span></span>
  <span class="app-tool-arrow" aria-hidden="true">›</span>
 </button>`
}
