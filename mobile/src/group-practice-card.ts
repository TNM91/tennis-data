import type { GroupPractice } from '../../lib/group-practice-contract'
import { html } from './html'

export type GroupPracticeDraft = {date:string;time:string;court:string;capacity:string;revision?:string;id?:string;startsAt?:string}
const pad = (value:number) => String(value).padStart(2,'0')
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
      <div class="group-practice-fields">
        <label>Date<input type="date" name="date" value="${html(draft.date)}" required></label>
        <label>Start time<input type="time" name="time" value="${html(draft.time)}" required></label>
      </div>
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
