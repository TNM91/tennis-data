import {extractCaptainPracticeFocus} from './captain-practice-invite'
import type {NativePractice} from './native-captain-practices'
import type {TeamRoomScope} from './team-room'
import {practiceRsvpPath,resolvePracticeToken} from './captain-practice-rsvp'
import {validPracticeEditId} from './native-practice-edit'
export type PracticeShare={practice:NativePractice;rsvpPath:string}
export type PracticeAnnouncementKind='invitation'|'update'|'cancelled'
export type PracticeAnnouncement=Readonly<{eventId:string;expectedUpdatedAt:string;clientMessageId:string;kind:PracticeAnnouncementKind;note:string;body:string}>
export function validPracticeRsvpPath(path:unknown):path is string{if(typeof path!=='string')return false;const token=path.startsWith('/pr/')?resolvePracticeToken(path.slice(4)):path.startsWith('/practice/')?resolvePracticeToken(path.slice(10)):'';return !!token&&practiceRsvpPath(token)===path}
export function practiceAnnouncementText(share:PracticeShare,scope:TeamRoomScope,kind:PracticeAnnouncementKind,note=''){
 const p=share.practice,focus=extractCaptainPracticeFocus(p.focus);if(!validPracticeRsvpPath(share.rsvpPath)||!['invitation','update','cancelled'].includes(kind)||(kind==='cancelled'?p.status!=='cancelled':!['proposed','confirmed'].includes(p.status)))throw Error('Refresh this practice before announcing.')
 if(note!==note.trim()||note.length>300)throw Error('Keep the team note within 300 characters.')
 const body=[kind==='cancelled'?'Practice cancelled':kind==='update'?'Practice update':'Team practice invitation',p.title,`${scope.teamName} · ${scope.leagueName}${scope.flight?' · '+scope.flight:''}`,`Date: ${p.date}`,p.time?`Time: ${p.time}${p.endTime?'–'+p.endTime:''}`:'Time: Not set',`Location: ${p.facility||'Not set'}`,kind!=='cancelled'&&focus?`Focus: ${focus.slice(0,300)}${focus.length>300?'…':''}`:'',note,kind==='cancelled'?'This occurrence is cancelled. Already-saved future practices are unchanged.':p.capacity===null?'Mark In, Out or Maybe. Capacity is not set.':`Mark In, Out or Maybe · ${p.capacity} ${p.capacity===1?'spot':'spots'}. In does not guarantee a place.`, 'https://www.tenaceiq.com'+share.rsvpPath].filter(Boolean).join('\n')
 if(body.length>2400)throw Error('Practice details are too long for one announcement.');return body
}
export function freezePracticeAnnouncement(share:PracticeShare,scope:TeamRoomScope,kind:PracticeAnnouncementKind,note:string,clientMessageId:string):PracticeAnnouncement{if(!validPracticeEditId(clientMessageId))throw Error('Invalid announcement.');return Object.freeze({eventId:share.practice.id,expectedUpdatedAt:share.practice.updatedAt,clientMessageId,kind,note:note.trim(),body:practiceAnnouncementText(share,scope,kind,note.trim())})}
export function samePracticeShare(a:PracticeShare,b:PracticeShare){return a.practice.id===b.practice.id&&a.practice.owner===b.practice.owner&&a.practice.updatedAt===b.practice.updatedAt&&a.practice.status===b.practice.status&&a.rsvpPath===b.rsvpPath&&['title','date','time','endTime','facility','focus','capacity'].every(k=>a.practice[k as keyof NativePractice]===b.practice[k as keyof NativePractice])}
