import type { GroupPractice } from '../../lib/group-practice-contract'
import type { ChatHit } from '../../lib/chat-hit-contract'
import { listedHittingClub } from '../../lib/hitting-clubs'
import { hittingPlanTimeZone } from '../../lib/hitting-plan'
import { hittingClubOptions } from './hitting-club-picker'
import type { SavedCourts } from './explore-saved-courts'
import { html } from './html'

export type GroupPracticeDraft = {date:string;time:string;court:string;capacity:string;revision?:string;id?:string;startsAt?:string}
export type ChatHitDraft = {date:string;time:string;clubId:string;replaces?:string}
const pad = (value:number) => String(value).padStart(2,'0')
const practiceDateTime = (draft: Pick<GroupPracticeDraft,'date'|'time'>,central=false) => `<div class="group-practice-fields">
  <label>Date<input type="date" name="date" value="${html(draft.date)}" required></label>
  <label>${central?'Start time (CT)':'Start time'}<input type="time" name="time" value="${html(draft.time)}" required></label>
</div>`
export function newGroupPracticeDraft(practice?:GroupPractice):GroupPracticeDraft {
  if (!practice?.revision) return {date:'',time:'',court:'',capacity:'4'}
  const starts = new Date(practice.startsAt)
  return {
    date:`${starts.getFullYear()}-${pad(starts.getMonth()+1)}-${pad(starts.getDate())}`,
    time:`${pad(starts.getHours())}:${pad(starts.getMinutes())}`,
    court:practice.court,capacity:String(practice.capacity),revision:practice.revision,id:practice.id,startsAt:practice.startsAt,
  }
}

export function groupPracticeCard(practice:GroupPractice|null,manage:boolean,draft:GroupPracticeDraft|null) {
  const editing = Boolean(draft?.revision && draft.id===practice?.id)
  if (draft && manage && (editing || !practice && !draft.revision)) return `<section class="group-practice-card" aria-labelledby="group-practice-title">
    <h3 id="group-practice-title">${editing?'Edit practice':'Schedule practice'}</h3>
    <form data-group-practice>
      ${practiceDateTime(draft)}
      <label>Court or club<input type="text" name="court" value="${html(draft.court)}" placeholder="Club name, court 2" maxlength="120" required></label>
      <label>Spots<input type="number" inputmode="numeric" name="capacity" value="${html(draft.capacity)}" min="2" max="32" required></label>
      ${editing?'<p>Time or court changes alert players on the list who have schedule alerts on.</p>':''}
      <button type="submit">${editing?'Save changes':'Post practice'}</button>
      <button type="button" class="secondary" data-practice-dismiss>Back</button>
    </form>
  </section>`
  if (!practice) return manage ? '<button type="button" class="secondary" data-practice-start>Schedule practice</button>' : ''
  const starts = new Intl.DateTimeFormat(undefined,{weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'})
    .format(new Date(practice.startsAt))
  const full = practice.inCount>=practice.capacity
  const response = practice.mine==='in'?'You’re on the list.':practice.mine==='out'?'You declined.':full?'All spots are taken.':''
  const players = practice.players.map(player=>`<li>${html(player.name)}</li>`).join('')
  return `<section class="group-practice-card" aria-labelledby="group-practice-title">
    <h3 id="group-practice-title">Upcoming practice</h3>
    <p><time datetime="${html(practice.startsAt)}">${html(starts)}</time></p>
    <p>${html(practice.court)}</p>
    <p><strong>${practice.inCount} of ${practice.capacity} spots filled</strong>${response?' · '+response:''}</p>
    ${players?`<details><summary>Who’s in</summary><ul role="list">${players}</ul></details>`:''}
    <div class="player-chat-actions">
      ${practice.mine!=='in'&&!full?'<button type="button" data-practice-rsvp="in">Join practice</button>':''}
      ${practice.mine!=='out'?'<button type="button" class="secondary" data-practice-rsvp="out">Can’t make it</button>':''}
    </div>
    ${manage?`<div class="player-chat-actions">${practice.revision?'<button type="button" class="secondary" data-practice-edit>Edit practice</button>':''}
      <button type="button" class="secondary" data-practice-cancel>Cancel practice</button></div>`:''}
  </section>`
}

const chatHitWhen = (hit:ChatHit) => new Intl.DateTimeFormat(undefined,{
  timeZone:hittingPlanTimeZone,weekday:'short',month:'short',day:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short',
}).format(new Date(hit.startsAt))

export function chatHitCard(hit: ChatHit|null, owner: string, draft: ChatHitDraft|null, saved:SavedCourts,
  confirmedHit:ChatHit|undefined, canSuggest:boolean) {
  if (draft) return `<section class="group-practice-card" aria-labelledby="chat-hit-title">
    <h3 id="chat-hit-title">${draft.replaces?'Suggest another time':'Plan a hit'}</h3>
    <form data-chat-hit-form>
      ${practiceDateTime(draft,true)}
      <label>Club<select name="clubId" required>
        <option value="">Choose a club</option>${hittingClubOptions(saved,draft.clubId)}
      </select></label>
      ${draft.replaces&&(confirmedHit||hit?.status==='accepted')?'<p>Your confirmed hit stays on both calendars until the change is accepted.</p>':''}
      <button type="submit">${draft.replaces?'Send suggestion':'Send proposal'}</button>
      <button type="button" class="secondary" data-chat-hit-dismiss>Back</button>
    </form>
  </section>`
  const start = '<button type="button" class="secondary" data-chat-hit-start>Plan a hit</button>'
  const court = listedHittingClub(hit?.clubId)
  if (!hit || !court) return start
  const own = hit.proposedBy===owner
  const status = {
    accepted:'Confirmed · On both calendars', proposed:own?'Waiting for a reply':'Waiting for your reply',
    declined:'Declined',cancelled:'Cancelled',
  }[hit.status]
  const reply = hit.status==='proposed' && !own
  const cancel = hit.status==='accepted' || (hit.status==='proposed' && own)
  const confirmedClub=listedHittingClub(confirmedHit?.clubId)
  return `<section class="group-practice-card" aria-labelledby="chat-hit-title">
    <h3 id="chat-hit-title">Hitting plan</h3>
    ${confirmedHit&&confirmedClub?`<p><strong>Currently confirmed</strong><br>
      <time datetime="${html(confirmedHit.startsAt)}">${html(chatHitWhen(confirmedHit))}</time> · ${html(confirmedClub.name)}</p>`:''}
    <p><strong>${confirmedHit?'Proposed change · ':''}${status}</strong></p>
    <p><time datetime="${html(hit.startsAt)}">${html(chatHitWhen(hit))}</time></p>
    <p>${html(court.name)}</p>
    <div class="player-chat-actions">
      ${reply?`<button type="button" data-chat-hit-reply="accepted">${confirmedHit?'Accept change':'Accept'}</button><button type="button" class="secondary" data-chat-hit-reply="declined">${confirmedHit?'Keep confirmed hit':'Decline'}</button>`:''}
      ${canSuggest&&(hit.status==='accepted'||hit.status==='proposed')?'<button type="button" class="secondary" data-chat-hit-suggest>Suggest another time</button>':''}
      ${hit.status==='accepted'||hit.status==='proposed'?`<button type="button" class="secondary" data-chat-hit-directions>${confirmedHit?'Directions to proposed club':'Directions'}</button>`:''}
      ${cancel?`<button type="button" class="secondary" data-chat-hit-cancel>${confirmedHit?'Withdraw suggestion':hit.status==='proposed'?'Withdraw proposal':'Cancel hit'}</button>`:''}
      ${confirmedHit?`<button type="button" class="secondary" data-chat-hit-directions="confirmed">Directions to confirmed club</button>
        <button type="button" class="secondary" data-chat-hit-cancel="confirmed">Cancel confirmed hit</button>`:''}
      ${hit.status==='declined'||hit.status==='cancelled'?start:''}
    </div>
  </section>`
}
