import type {SupabaseClient} from '@supabase/supabase-js'
import {html} from './match-details'
import {CoachWorkspaceError, type CoachSend} from './coach-workspace-data'
import {coachInvitationsRequest, shareCoachInvitation} from './coach-invites-data'
import {readCoachInviteIntent, coachInviteMatches, coachInviteShareable, type CoachInviteIntent, type CoachInvitations} from '../../lib/native-coach-invite-contract'

export function openCoachInvitations(client: SupabaseClient, owner: string, student: string, current: () => boolean, trigger?: HTMLElement, send?: CoachSend) {
 const dialog = document.createElement('dialog'); dialog.className = 'captain-lineup-dialog coach-workspace-dialog coach-invites-dialog'; dialog.setAttribute('aria-label', 'Coach invitations')
 let disposed = false, busy = false, view: 'list' | 'form' | 'confirm' = 'list', notice = '', email = '', message = '', leaving = false, attempted = false, uncertain = false, conflict = false
 let data: CoachInvitations | null = null, draft: CoachInviteIntent | null = null
 const active = () => !disposed && current(), focus = () => dialog.querySelector<HTMLElement>('h2')?.focus({preventScroll: true})
 const dispose = () => {if (disposed) return; disposed = true; email = message = ''; draft = null; data = null; dialog.close(); dialog.remove(); if (current() && trigger?.isConnected) trigger.focus({preventScroll: true})}
 const clear = () => {email = message = ''; draft = null; attempted = uncertain = leaving = conflict = false; view = 'list'}
 const back = () => {if (busy) return true; if (leaving) {leaving = false; render(); focus()} else if (view !== 'list') {leaving = true; render(); focus()} else dispose(); return true}
 const read = () => coachInvitationsRequest(client, owner, active, student, null, send)
 const load = async () => {
  if (!active() || busy) return
  busy = true; notice = 'Loading invitations…'; render()
  try {const fresh = await read(); if (active()) {data = fresh; notice = ''; clear()}}
  catch (error) {if (active()) {data = null; notice = error instanceof CoachWorkspaceError ? error.message : 'Invitations are unavailable. Try again when connected.'}}
  finally {if (active()) {busy = false; render(); focus()}}
 }
 const save = async (check: boolean) => {
  if (!draft || busy || !active() || (uncertain || conflict) && !check) return
  const intent = draft; busy = true; if (!check) {attempted = uncertain = true}; notice = check ? 'Checking invitations…' : 'Saving invitation…'; render()
  try {
   const found = await coachInvitationsRequest(client, owner, active, student, check ? null : intent, send)
   if (!active()) return
   data = found
   if (coachInviteMatches(found, intent)) {clear(); notice = intent.action === 'create' ? 'Invitation created. Share it with the player when you’re ready.' : 'Invitation revoked. Its link can no longer connect a player.'}
   else {uncertain = false; notice = conflict ? 'The invitation changed. Discard these edits and refresh before making another change.' : 'This exact change was not found. Retry the same change or discard it and refresh.'}
  } catch (error) {
   if (!active()) return
   if (error instanceof CoachWorkspaceError && [401, 403, 404].includes(error.status)) {data = null; clear()}
   if (error instanceof CoachWorkspaceError && error.status === 409) conflict = true
   notice = error instanceof CoachWorkspaceError ? error.message : 'Save not confirmed. Check invitations before retrying.'
  } finally {if (active()) {busy = false; render(); focus()}}
 }
 const share = async (id: string, copy: boolean) => {
  const invitation = data?.invites.find(i => i.id === id)
  if (!active() || busy || !invitation) return
  busy = true; notice = 'Checking the invitation before sharing…'; render()
  try {const result = await shareCoachInvitation(invitation, read, active, copy); if (active()) {data = result.snapshot; notice = result.done ? copy ? 'Invitation link copied.' : 'Share sheet closed.' : 'The invitation changed. Review the current details before sharing again.'}}
  catch {if (active()) notice = 'Sharing did not finish. Refresh invitations before trying again.'}
  finally {if (active()) {busy = false; render(); focus()}}
 }
 const render = () => {
  if (!active()) return
  const heading = leaving ? 'Leave this invitation?' : view === 'form' ? 'Invite your student' : view === 'confirm' ? draft?.action === 'revoke' ? 'Revoke invitation?' : 'Review invitation' : 'Student invitations'
  let content = ''
  if (leaving) content = `<p>${attempted ? 'This change may already be saved. Check invitations before creating another one.' : 'Your unsaved invitation details will be discarded.'}</p><button type="button" data-invite-keep>Keep editing</button><button type="button" class="secondary" data-invite-discard>Discard and refresh</button>`
  else if (view === 'confirm' && draft) {
   const invite = data?.invites.find(i => i.id === draft!.id)
   content = draft.action === 'create' ? `<p>Connect ${html(data?.student.name || 'this student')} using <strong>${html(draft.email)}</strong>.</p><p class="coach-written">${html(draft.message)}</p><p>The link expires in seven days. The player must sign in with this email and accept before assignments appear in their app. Share the link yourself after it is created.</p>` : `<p>Revoke the pending invitation for <strong>${html(invite?.email || 'this player')}</strong>? This does not remove an accepted Coach connection.</p>`
   content += `<button type="button" data-invite-save ${busy || uncertain || conflict ? 'disabled' : ''}>${attempted ? 'Retry same change' : draft.action === 'create' ? 'Create invitation' : 'Revoke invitation'}</button>${attempted ? `<button type="button" class="secondary" data-invite-check ${busy ? 'disabled' : ''}>Check invitations</button>` : draft.action === 'create' ? '<button type="button" class="secondary" data-invite-edit>Edit details</button>' : ''}`
  } else if (view === 'form') content = `<p>Use the email your student uses for TenAceIQ. Only that account can accept.</p><form data-invite-form><label for="coach-invite-email">Player’s account email</label><input id="coach-invite-email" name="email" type="email" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="254" required value="${html(email)}"><label for="coach-invite-message">Message (optional)</label><textarea id="coach-invite-message" name="message" maxlength="500">${html(message)}</textarea><button type="submit">Review invitation</button></form>`
  else if (data) content = `<p>${html(data.student.name)}</p><p>${data.student.linked ? 'This student is connected. Their assignments are available in their app.' : data.student.paused ? 'This student is paused. Resume the connection in advanced Coach tools before inviting them.' : 'Connect this roster record to your student’s TenAceIQ account.'}</p>${!data.student.linked && !data.student.paused ? `<button type="button" data-invite-new ${busy ? 'disabled' : ''}>Create an invitation</button>` : ''}<div class="coach-invitation-list">${data.invites.map((i, n) => `<article class="coach-plan"><small>${html(i.status === 'pending' && !coachInviteShareable(i) && i.expiresAt && Date.parse(i.expiresAt) <= Date.now() ? 'Expired' : i.status[0].toUpperCase() + i.status.slice(1))}</small><h3>${html(i.email || 'Any account with this older link')}</h3>${i.message ? `<p class="coach-written">${html(i.message)}</p>` : ''}${i.expiresAt ? `<p>Expires ${html(new Date(i.expiresAt).toLocaleDateString())}</p>` : '<p>This older invitation has no expiry date.</p>'}${coachInviteShareable(i) && !data!.student.linked && !data!.student.paused ? `<div class="coach-invite-actions"><button type="button" data-invite-share="${n}" ${busy ? 'disabled' : ''}>Share link</button><button type="button" class="secondary" data-invite-copy="${n}" ${busy ? 'disabled' : ''}>Copy link</button></div>` : ''}${i.status === 'pending' ? `<button type="button" class="secondary" data-invite-revoke="${n}" ${busy ? 'disabled' : ''}>Revoke link</button>` : ''}</article>`).join('') || '<p>No invitations for this student yet.</p>'}</div>${data.more ? '<p>Showing the 100 most recently updated invitations.</p>' : ''}`
  dialog.innerHTML = `<header class="coach-workspace-header"><small>Coach workspace</small><h2 tabindex="-1">${heading}</h2><button type="button" class="secondary" data-invite-close ${busy ? 'disabled' : ''} aria-label="Close Coach invitations">${view === 'list' ? 'Close' : 'Back'}</button></header>${content}<p role="status" tabindex="-1">${html(notice)}</p>${view === 'list' ? `<button type="button" class="secondary" data-invite-refresh ${busy ? 'disabled' : ''}>Refresh invitations</button>` : ''}`
  dialog.querySelector('[data-invite-close]')?.addEventListener('click', back)
  dialog.querySelector('[data-invite-refresh]')?.addEventListener('click', () => {void load()})
  dialog.querySelector('[data-invite-new]')?.addEventListener('click', () => {clear(); view = 'form'; notice = ''; render(); focus()})
  dialog.querySelector('[data-invite-edit]')?.addEventListener('click', () => {if (!attempted) {draft = null; view = 'form'; render(); focus()}})
  dialog.querySelector<HTMLInputElement>('[name="email"]')?.addEventListener('input', e => {email = (e.target as HTMLInputElement).value})
  dialog.querySelector<HTMLTextAreaElement>('[name="message"]')?.addEventListener('input', e => {message = (e.target as HTMLTextAreaElement).value})
  dialog.querySelector<HTMLFormElement>('[data-invite-form]')?.addEventListener('submit', e => {e.preventDefault(); if (!data || busy) return; try {draft = Object.freeze(readCoachInviteIntent({action: 'create', id: crypto.randomUUID(), student, expectedUpdatedAt: data.student.updatedAt, email, message})); view = 'confirm'; notice = ''; render(); focus()} catch {notice = 'Check the player’s email and message.'; render(); focus()}})
  dialog.querySelector('[data-invite-save]')?.addEventListener('click', () => {void save(false)})
  dialog.querySelector('[data-invite-check]')?.addEventListener('click', () => {void save(true)})
  dialog.querySelector('[data-invite-keep]')?.addEventListener('click', () => {leaving = false; render(); focus()})
  dialog.querySelector('[data-invite-discard]')?.addEventListener('click', () => {clear(); void load()})
  for (const kind of ['share', 'copy', 'revoke']) dialog.querySelectorAll<HTMLButtonElement>('[data-invite-' + kind + ']').forEach(button => {button.onclick = () => {const i = data?.invites[Number(button.getAttribute('data-invite-' + kind))]; if (!i || busy) return; if (kind !== 'revoke') {void share(i.id, kind === 'copy'); return} draft = Object.freeze(readCoachInviteIntent({action: 'revoke', id: i.id, student, expectedUpdatedAt: i.updatedAt})); attempted = uncertain = false; view = 'confirm'; notice = ''; render(); focus()}})
 }
 dialog.oncancel = e => {e.preventDefault(); back()}
 document.body.append(dialog); render(); dialog.showModal(); void load()
 return {dispose, back, isOpen: () => !disposed}
}
