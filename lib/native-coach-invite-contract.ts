import {coachId, coachRecord} from './native-coach-contract'

export type CoachInvitation = {id: string; student: string; email: string; message: string; status: 'pending' | 'accepted' | 'revoked' | 'expired'; expiresAt: string | null; updatedAt: string; href: string}
export type CoachInvitations = {owner: string; student: {id: string; name: string; linked: boolean; paused: boolean; updatedAt: string}; invites: CoachInvitation[]; more: boolean}
export type CoachInviteIntent = {action: 'create'; id: string; student: string; expectedUpdatedAt: string; email: string; message: string} | {action: 'revoke'; id: string; student: string; expectedUpdatedAt: string}
const text = (v: unknown, max: number, required = false) => {if (typeof v !== 'string' || v.length > max || required && !v.trim()) throw Error('Invalid invitation text'); return v}
const stamp = (v: unknown) => {const s = text(v, 80, true); if (!Number.isFinite(Date.parse(s))) throw Error('Invalid invitation date'); return s}
const flag = (v: unknown) => {if (typeof v !== 'boolean') throw Error('Invalid invitation flag'); return v}
export function readCoachInviteIntent(value: unknown): CoachInviteIntent {
 const r = coachRecord(value), id = coachId(r.id), student = coachId(r.student), expectedUpdatedAt = stamp(r.expectedUpdatedAt)
 if (r.action !== 'create' && r.action !== 'revoke') throw Error('Invalid invitation action')
 if (Object.keys(r).some(k => !(r.action === 'create' ? ['action', 'id', 'student', 'expectedUpdatedAt', 'email', 'message'] : ['action', 'id', 'student', 'expectedUpdatedAt']).includes(k))) throw Error('Unexpected invitation field')
 if (r.action === 'revoke') return {action: r.action, id, student, expectedUpdatedAt}
 if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) throw Error('Invalid new invitation')
 const email = text(r.email, 254, true).trim().toLowerCase()
 if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw Error('Use the player’s account email')
 return {action: r.action, id, student, expectedUpdatedAt, email, message: text(r.message, 500).trim()}
}
export function readCoachInvitations(value: unknown, owner: string, student: string): CoachInvitations {
 const r = coachRecord(value), s = coachRecord(r.student)
 if (r.ok !== true || !owner || r.owner !== owner || s.id !== student || !Array.isArray(r.invites) || r.invites.length > 100 || JSON.stringify(r).length > 150000) throw Error('Invitation account changed')
 const invites = r.invites.map(value => {
  const i = coachRecord(value), status = i.status as CoachInvitation['status']
  if (!['pending', 'accepted', 'revoked', 'expired'].includes(status) || i.student !== student) throw Error('Invalid invitation')
  const href = text(i.href, 300)
  if (href && (!/^https:\/\/www\.tenaceiq\.com\/coach\/invite\/[a-zA-Z0-9_.:-]+$/.test(href) || status !== 'pending')) throw Error('Invalid invitation link')
  return {id: coachId(i.id), student, email: text(i.email, 254), message: text(i.message, 4000), status, expiresAt: i.expiresAt === null ? null : stamp(i.expiresAt), updatedAt: stamp(i.updatedAt), href}
 })
 if (new Set(invites.map(i => i.id)).size !== invites.length) throw Error('Duplicate invitations')
 return {owner, student: {id: student, name: text(s.name, 300, true), linked: flag(s.linked), paused: flag(s.paused), updatedAt: stamp(s.updatedAt)}, invites, more: flag(r.more)}
}
export const coachInviteShareable = (i: CoachInvitation, now = Date.now()) => i.status === 'pending' && Boolean(i.href) && (!i.expiresAt || Date.parse(i.expiresAt) > now)
export function coachInviteMatches(snapshot: CoachInvitations, intent: CoachInviteIntent) {
 const i = snapshot.invites.find(i => i.id === intent.id)
 return Boolean(i && i.student === intent.student && (intent.action === 'create' ? i.email === intent.email && i.message === intent.message : i.status === 'revoked' && i.updatedAt !== intent.expectedUpdatedAt))
}
