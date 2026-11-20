import type {SupabaseClient} from '@supabase/supabase-js'
import {formatCalendarDay} from '../../lib/calendar-date'
import {tiqSkills, tiqSkillLevels} from '../../lib/tiq-assessment-skills'
import {estimateTiqScore, readTiqAnswers, type TiqAssessment, type TiqHistory, type TiqWrite} from '../../lib/tiq-self-assessment'
import type {NativeCoachStudent} from '../../lib/native-coach-contract'
import {html} from './match-details'
import {loadTiqAccount, writeTiqAccount, rememberPendingTiq, clearPendingTiq, readPendingTiq, deviceTiqId, TiqAccountError} from './tiq-account-data'
import type {CoachSend} from './coach-workspace-data'

export type DeviceAssessment = {date: string; answers: unknown}
const score = (entry: TiqAssessment) => estimateTiqScore(tiqSkills.map(skill => entry.answers[skill.id]))
const historyDate = new Intl.DateTimeFormat('en-US', {month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC'})
export function openTiqAccountHistory(client: SupabaseClient, owner: string, current: () => boolean, trigger: HTMLElement,
  options: {student?: NativeCoachStudent; device?: DeviceAssessment[]; changed?: (page: TiqHistory) => void; closed?: () => void} = {}, send?: CoachSend) {
  const dialog = document.createElement('dialog')
  dialog.className = 'captain-lineup-dialog coach-workspace-dialog tiq-account-dialog'
  dialog.setAttribute('aria-label', options.student ? 'Shared player TiQ' : 'Your TiQ history')
  let snapshot: TiqHistory | null = null, entries: TiqAssessment[] = [], busy = false, disposed = false, notice = '', confirmDelete = ''
  let pending: Extract<TiqWrite, {kind: 'save'}> | null = null, operation: TiqWrite | null = null
  let saveConflict = false, conflictReviewed = false
  let pendingChecked = Boolean(options.student)
  let focusAfter: string | null = 'heading'
  const devices = (options.device ?? []).filter((entry, index, rows) => rows.findIndex(other => JSON.stringify(other) === JSON.stringify(entry)) === index)
  const active = () => !disposed && current() && trigger.isConnected
  function dispose() {
    if (disposed) return
    disposed = true; entries = []; snapshot = null; pending = null; operation = null
    dialog.close(); dialog.remove()
    if (current() && trigger.isConnected) trigger.focus({preventScroll: true})
    if (current()) options.closed?.()
  }
  async function load(more = false, message = '') {
    if (!active() || busy) return
    if (!more && options.student) {entries = []; snapshot = null}
    busy = true; notice = more ? 'Loading earlier assessments…' : 'Loading rating history…'; render()
    try {
      const page = await loadTiqAccount(client, owner, active, {student: options.student?.id, cursor: more ? snapshot?.next : null}, send)
      if (!active()) return
      const known = new Set(entries.map(entry => entry.id))
      if (more && page.items.some(entry => known.has(entry.id))) throw new TiqAccountError(503)
      if (more && page.head?.id !== snapshot?.head?.id) throw new TiqAccountError(409)
      entries = more ? [...entries, ...page.items] : page.items
      if (more && page.items.length) focusAfter = page.items[0].id
      // Earlier pages keep their own sharing information; refresh replaces the loaded snapshot.
      snapshot = more && snapshot ? {...page, shares: [...snapshot.shares, ...page.shares]} : page
      pending = options.student ? null : await readPendingTiq(owner)
      pendingChecked = true
      if (!active()) return
      notice = message
      if (!more && saveConflict) conflictReviewed = true
      if (!more && !options.student) options.changed?.(page)
    } catch (error) {if (active()) {
      if (options.student) {entries = []; snapshot = null}
      notice = error instanceof TiqAccountError ? error.message : 'Rating history couldn’t load. Try refreshing.'
    }}
    finally {busy = false; if (active()) render()}
  }
  async function mutate(write: TiqWrite) {
    if (busy || !active() || options.student) return
    let renderedByLoad = false
    busy = true; operation = write; focusAfter = write.id; notice = write.kind === 'save' ? 'Saving to your account…' : write.kind === 'delete' ? 'Deleting from your account…' : 'Updating sharing…'; render()
    try {
      if (write.kind === 'save') {await rememberPendingTiq(owner, write); pending = write}
      if (!active()) return
      await writeTiqAccount(client, owner, active, write, send)
      if (!active()) return
      if (write.kind === 'save') {await clearPendingTiq(owner); pending = null}
      operation = null; confirmDelete = ''; busy = false; saveConflict = conflictReviewed = false
      renderedByLoad = true
      await load(false, write.kind === 'save' ? 'Assessment saved to your account. Choose a coach below if you want to share it.'
        : write.kind === 'delete' ? 'Assessment deleted from your account and coach sharing stopped.' : write.kind === 'revoke' ? 'Sharing stopped.' : 'This assessment is shared with the selected coach.')
    } catch (error) {
      if (!active()) return
      if (error instanceof TiqAccountError && error.status === 409) {
        notice = error.message + ' Your answers are kept. Refresh before trying a new save.'
        if (write.kind === 'save') {saveConflict = true; conflictReviewed = false}
        operation = null
      } else notice = 'The change wasn’t confirmed. Retry the same change to check it.'
    } finally {busy = false; if (active() && !renderedByLoad) render()}
  }
  function render() {
    const scrollTop = dialog.scrollTop
    const locked = busy || Boolean(operation) || Boolean(pending) || !pendingChecked
    const heading = options.student ? 'Shared self-assessments' : 'Your TiQ history'
    dialog.innerHTML = `<header class="coach-workspace-header"><small>${options.student ? html(options.student.name) : 'Your game'}</small><h2 tabindex="-1">${heading}</h2>
      <button type="button" class="secondary" data-tiq-close>Close</button></header>
      <p>${options.student ? 'These are the player’s own ratings, shared with you. Your coach observations remain separate.'
        : 'Saved to your account across devices. Choose a specific assessment to share with a connected coach.'}</p>
      <p role="status" data-tiq-status>${html(notice)}</p>
      ${operation ? '<button type="button" data-tiq-retry ' + (busy ? 'disabled' : '') + '>Retry same change</button>' : pending ? '<p>An account save needs confirmation before you start another.</p><button type="button" data-tiq-pending ' + (busy || (saveConflict && !conflictReviewed) ? 'disabled' : '') + '>' + (saveConflict ? 'Save kept assessment after review' : 'Check saved assessment') + '</button>' : ''}
      <div class="tiq-account-history">${entries.map((entry, index) => {
        const ownShares = snapshot?.shares.filter(share => share.assessment === entry.id) ?? []
        const activeShares = ownShares.filter(share => share.active)
        const previous = entries[index + 1]
        return `<article class="tiq-account-entry" data-tiq-entry="${html(entry.id)}"><header><div><h3 tabindex="-1"><time datetime="${html(entry.date)}" aria-label="${html(formatCalendarDay(entry.date))}">${html(historyDate.format(new Date(entry.date + 'T12:00:00Z')))}</time></h3>
          ${entries.some(other => other.id !== entry.id && other.date === entry.date) ? `<small>Saved ${html(new Date(entry.createdAt).toLocaleTimeString(undefined, {hour: 'numeric', minute: '2-digit', second: '2-digit'}))}</small>` : ''}
          <p>Self-assessed${options.student ? ' · Shared with you' : activeShares.length ? ' · Shared with ' + activeShares.map(share => html(share.name)).join(', ') : ' · Private'}</p></div><strong>${score(entry)}<span> / 10</span></strong></header>
          <details><summary>Six-skill breakdown</summary><dl>${tiqSkills.map(skill => `<div><dt>${skill.skill}</dt><dd>${tiqSkillLevels[entry.answers[skill.id]]}${previous && previous.answers[skill.id] !== entry.answers[skill.id] ? `<small>Previously ${tiqSkillLevels[previous.answers[skill.id]]}</small>` : ''}</dd></div>`).join('')}</dl>
            ${previous ? `<p>Previous self-rating · ${score(previous)} / 10 · ${html(formatCalendarDay(previous.date))}</p>` : ''}</details>
          ${options.student ? '' : `<div class="tiq-account-sharing">
            ${ownShares.filter(share => share.shared).map(share => `<div><span>${html(share.name)}${share.active ? '' : ' · Connection changed'}</span><button type="button" class="secondary" data-tiq-revoke="${html(entry.id)}" data-tiq-student="${html(share.student)}" ${locked ? 'disabled' : ''}>Stop sharing</button></div>`).join('')}
            ${snapshot?.coaches.length ? `<label>Share with a coach<select data-tiq-coach="${html(entry.id)}" ${locked ? 'disabled' : ''}><option value="">Choose a coach</option>${snapshot.coaches.filter(coach => !ownShares.some(share => share.student === coach.id && share.active)).map(coach => `<option value="${html(coach.id)}">${html(coach.name)}</option>`).join('')}</select></label>
              <button type="button" class="secondary" data-tiq-share="${html(entry.id)}" disabled>Share assessment</button>` : '<p>Connect with a coach to share an assessment.</p>'}
            ${confirmDelete === entry.id ? '<p>Delete this assessment from your account and stop sharing it? Any separate device-only copy stays on that device.</p><button type="button" data-tiq-confirm-delete="' + html(entry.id) + '" ' + (locked ? 'disabled' : '') + '>Delete from account</button><button type="button" class="secondary" data-tiq-keep>Keep assessment</button>' : '<button type="button" class="secondary" data-tiq-delete="' + html(entry.id) + '" ' + (locked ? 'disabled' : '') + '>Delete assessment</button>'}
          </div>`}</article>`
      }).join('') || (snapshot && !busy ? '<p>No account assessments yet.</p>' : '')}</div>
      ${snapshot?.next ? `<button type="button" class="secondary" data-tiq-more ${locked ? 'disabled' : ''}>Load earlier assessments</button>` : ''}
      ${snapshot?.moreCoaches ? '<p>Showing your latest 50 coach connections.</p>' : ''}
      ${!options.student && devices.length ? `<details class="tiq-device-history"><summary>Assessments on this device</summary><p>These device copies stay private unless you save them to your account.</p>${devices.map((entry, index) => `<div><p>${html(formatCalendarDay(entry.date))}</p><button type="button" class="secondary" data-tiq-import="${index}" ${locked || !snapshot ? 'disabled' : ''}>Save device assessment to account</button></div>`).join('')}</details>` : ''}
      <button type="button" class="secondary" data-tiq-refresh ${busy || operation ? 'disabled' : ''}>Refresh history</button>`
    dialog.querySelector('[data-tiq-close]')!.addEventListener('click', dispose)
    dialog.querySelector('[data-tiq-refresh]')!.addEventListener('click', () => {void load()})
    dialog.querySelector('[data-tiq-more]')?.addEventListener('click', () => {void load(true)})
    dialog.querySelector('[data-tiq-retry]')?.addEventListener('click', () => {if (operation) void mutate(operation)})
    dialog.querySelector('[data-tiq-pending]')?.addEventListener('click', () => {if (pending) void mutate(saveConflict && conflictReviewed ? {...pending, expectedHead: snapshot?.head?.id ?? null} : pending)})
    dialog.querySelectorAll<HTMLSelectElement>('[data-tiq-coach]').forEach(select => select.onchange = () => {
      const button = dialog.querySelector<HTMLButtonElement>('[data-tiq-share="' + select.dataset.tiqCoach + '"]')!
      button.disabled = locked || !select.value
    })
    dialog.querySelectorAll<HTMLButtonElement>('[data-tiq-share]').forEach(button => button.onclick = () => {
      const id = button.dataset.tiqShare!, select = dialog.querySelector<HTMLSelectElement>('[data-tiq-coach="' + id + '"]')!
      const coach = snapshot?.coaches.find(coach => coach.id === select.value)
      if (coach) void mutate({kind: 'share', id, student: coach.id, linkUpdatedAt: coach.updatedAt, operation: crypto.randomUUID(), expected: snapshot?.shares.find(share => share.assessment === id && share.student === coach.id)?.operation ?? null})
    })
    dialog.querySelectorAll<HTMLButtonElement>('[data-tiq-revoke]').forEach(button => button.onclick = () => {
      const share = snapshot?.shares.find(share => share.assessment === button.dataset.tiqRevoke && share.student === button.dataset.tiqStudent)
      if (share) void mutate({kind: 'revoke', id: share.assessment, student: share.student, linkUpdatedAt: snapshot?.coaches.find(coach => coach.id === share.student)?.updatedAt ?? '2000-01-01T00:00:00Z', operation: crypto.randomUUID(), expected: share.operation})
    })
    dialog.querySelectorAll<HTMLButtonElement>('[data-tiq-import]').forEach(button => button.onclick = async () => {
      const entry = devices[Number(button.dataset.tiqImport)]
      if (!entry || !snapshot || busy) return
      button.disabled = true
      try {
        const id = await deviceTiqId(owner, entry.date, entry.answers)
        if (active()) await mutate({kind: 'save', id, date: entry.date, answers: readTiqAnswers(entry.answers), version: 1, expectedHead: snapshot?.head?.id ?? null})
      } catch {if (active()) {notice = 'This device assessment couldn’t be prepared. Try again.'; render()}}
    })
    dialog.querySelectorAll<HTMLButtonElement>('[data-tiq-delete]').forEach(button => button.onclick = () => {confirmDelete = button.dataset.tiqDelete!; render(); dialog.querySelector<HTMLElement>('[data-tiq-confirm-delete]')?.focus()})
    dialog.querySelector('[data-tiq-keep]')?.addEventListener('click', () => {const selected = confirmDelete; confirmDelete = ''; render(); dialog.querySelector<HTMLElement>('[data-tiq-delete="' + selected + '"]')?.focus({preventScroll: true})})
    dialog.querySelectorAll<HTMLButtonElement>('[data-tiq-confirm-delete]').forEach(button => button.onclick = () => {void mutate({kind: 'delete', id: button.dataset.tiqConfirmDelete!})})
    dialog.scrollTop = scrollTop
    if (!busy && focusAfter) {
      const target = focusAfter === 'heading' ? null : dialog.querySelector<HTMLElement>('[data-tiq-entry="' + focusAfter + '"] h3')
      ;(target ?? dialog.querySelector<HTMLElement>('h2'))?.focus({preventScroll: true})
      focusAfter = null
    }
  }
  dialog.oncancel = event => {event.preventDefault(); dispose()}
  document.body.append(dialog); dialog.showModal(); void load()
  dialog.querySelector<HTMLElement>('h2')?.focus()
  return {dispose, back() {dispose(); return true}, isOpen: () => !disposed, requestLeave(action?: () => void) {dispose(); action?.()}}
}
