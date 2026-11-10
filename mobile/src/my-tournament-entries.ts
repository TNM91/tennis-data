import type {SupabaseClient} from '@supabase/supabase-js'
import {MY_TOURNAMENT_ENTRY_LIMIT,type MyTournamentEntry} from '../../lib/native-tournament-entry-contract'
import {html} from './match-details'
import {getMyTournamentEntries} from './tournament-entry-data'
import {openTournamentEntry} from './tournament-entry-view'

const title = 'My Tournament Entries'
const statusLabels = {
 pending: 'Pending review',
 approved: 'Approved',
 declined: 'Not approved',
}

function entryCard(entry: MyTournamentEntry, index: number) {
 const name = entry.eventName || 'Tournament details unavailable'
 return `<article class="competition-card tournament-division-card">
  <div class="competition-card-meta">
   <span class="competition-state competition-entry-status" data-entry-status="${entry.status}">${statusLabels[entry.status]}</span>
  </div>
  <h3>${html(name)}</h3>
  ${entry.divisionName ? `<p class="competition-card-detail">${html(entry.divisionName)}</p>` : ''}
  ${entry.selection ? `<button type="button" class="secondary" data-my-tournament-entry="${index}">
   Open entry<span class="sr-only"> · ${html([name,entry.divisionName].filter(Boolean).join(' · '))}</span><span class="app-tool-arrow" aria-hidden="true">›</span>
  </button>` : '<p class="competition-card-detail">Check with the organizer for details.</p>'}
 </article>`
}

export function openMyTournamentEntries(client: SupabaseClient, owner: string, current: () => boolean, onClose: () => void, trigger: HTMLElement, origin: 'Compete'|'Updates' = 'Compete') {
 const dialog = document.createElement('dialog')
 dialog.className = 'captain-lineup-dialog competitions-dialog my-tournament-entries-dialog'
 dialog.setAttribute('aria-label', title)
 dialog.innerHTML = `<header class="competition-header competition-header-compact">
  <button type="button" class="secondary" data-entries-back aria-label="Back to ${origin}">← ${origin}</button>
  <button type="button" class="secondary" data-entries-refresh>Refresh</button>
 </header>
 <div class="competition-hero my-tournament-entries-heading"><small>Your season</small><h2 tabindex="-1">${title}</h2></div>
 <div data-my-tournament-entries></div>`

 const content = dialog.querySelector<HTMLElement>('[data-my-tournament-entries]')!
 const refresh = dialog.querySelector<HTMLButtonElement>('[data-entries-refresh]')!
 let disposed = false
 let loading = false
 let child: ReturnType<typeof openTournamentEntry> | null = null
 const active = () => !disposed && current()

 function dispose() {
  if(disposed)return
  disposed = true
  child?.dispose()
  document.removeEventListener('visibilitychange', onVisibility)
  dialog.remove()
  onClose()
  if(current() && trigger.isConnected)trigger.focus({preventScroll:true})
 }

 function onVisibility() {
  if(document.visibilityState === 'hidden')dispose()
 }

 function back() {
  if(child?.isOpen())return child.back()
  dispose()
  return true
 }

 async function load() {
  if(!active() || loading || child)return
  loading = true
  refresh.setAttribute('aria-disabled', 'true')
  content.innerHTML = '<p role="status">Checking your entries…</p>'
  try {
   const {entries, more} = await getMyTournamentEntries(client, owner, active)
   if(!active())return
   content.innerHTML = entries.length
    ? `<div class="competition-cards">${entries.map(entryCard).join('')}</div>${more ? `<p class="rating-context">Showing your ${MY_TOURNAMENT_ENTRY_LIMIT} most recently updated entries.</p>` : ''}`
    : '<div class="competition-empty"><h3>No tournament entries yet</h3><p>Entries you submit while signed in will appear here.</p></div>'
   for(const button of content.querySelectorAll<HTMLButtonElement>('[data-my-tournament-entry]')){
    button.onclick = () => {
     if(!active() || child)return
     const entry = entries[Number(button.dataset.myTournamentEntry)]
     if(!entry?.selection)return
     const {parent, division} = entry.selection
     child = openTournamentEntry(client, owner, active, parent, division, () => {child = null},
      undefined, button, {backLabel: 'Back to entries', receiptId: entry.id})
    }
   }
  } catch {
   if(active())content.innerHTML = '<p role="alert">Couldn’t load your tournament entries. Try refreshing.</p>'
  } finally {
   loading = false
   if(active())refresh.removeAttribute('aria-disabled')
  }
 }

 dialog.querySelector('[data-entries-back]')?.addEventListener('click', back)
 refresh.onclick = () => {void load()}
 dialog.oncancel = event => {event.preventDefault();back()}
 document.addEventListener('visibilitychange', onVisibility)
 document.body.append(dialog)
 dialog.showModal()
 dialog.querySelector<HTMLElement>('h2')?.focus({preventScroll:true})
 void load()
 return {dispose, isOpen: active, back}
}
