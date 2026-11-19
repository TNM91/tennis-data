import {describe,expect,it} from 'vitest'
import type {TeamMatchReplies} from '../team-match-replies-contract'
import type {TeamNextMatchSchedule} from '../../mobile/src/team-room-data'
import {playerAssignmentSnapshot,playerAssignmentChanges,playerAssignmentUpdateHtml} from '../../mobile/src/player-assignment-review'
import {lineupPublicationHtml} from '../../mobile/src/team-lineup-publication'

const owner='owner',partner='partner',version='v1'
const schedule=():TeamNextMatchSchedule=>({revision:'match1',nextMatch:{date:'2030-06-09',time:'18:00',timeZone:'America/Chicago',facility:'Court 2',opponent:'Topspin'}})
function replies():TeamMatchReplies{
 return {own:{id:'availability',choice:'in'},sharedLineup:{version,courts:[{format:'singles',players:['other']},{format:'doubles',players:[owner,partner]}],
  names:{[owner]:'You',[partner]:'<Blair>',other:'Other Player'}},lineupReply:{id:'response',version,choice:'confirmed'},
  savedLineup:{version:'private',courts:[{format:'singles',players:['private']}],names:{private:'Private Player'}}}
}
const time=(match:NonNullable<TeamNextMatchSchedule['nextMatch']>)=>match.time

describe('player assignment updates',()=>{
 it('takes an independent snapshot of only the player’s shared assignment and logistics',()=>{
  const match=schedule(),data=replies(),snapshot=playerAssignmentSnapshot(match,data,owner)
  match.nextMatch!.facility='New venue';data.sharedLineup!.names[partner]='Renamed'
  expect(snapshot).toMatchObject({court:'Doubles 1',partners:[{id:partner,name:'<Blair>'}],response:'Confirmed',match:{facility:'Court 2'}})
  expect(JSON.stringify(snapshot)).not.toMatch(/Private Player|Other Player/)
 })
 it('compares the court, partner and match logistics rather than just the publication version',()=>{
  const match=schedule(),data=replies(),before=playerAssignmentSnapshot(match,data,owner)
  match.nextMatch={...match.nextMatch!,date:'2030-06-10',time:'19:00',facility:'Clubhouse',opponent:'Aces'}
  data.sharedLineup={version:'v2',courts:[{format:'doubles',players:['other','reserve']},{format:'doubles',players:[owner,'new']}],names:{[owner]:'You',new:'Morgan',other:'Other Player',reserve:'Reserve'}}
  data.own=null;data.lineupReply=null
  const rows=playerAssignmentChanges({before,after:playerAssignmentSnapshot(match,data,owner)},time)
  expect(rows.map(row=>row.label)).toEqual(['Opponent','Date','Start time','Venue','Your court','Your partner','Your availability','Your response'])
  expect(rows.find(row=>row.label==='Your court')).toMatchObject({before:'Doubles 1',after:'Doubles 2'})
  expect(rows.find(row=>row.label==='Your partner')).toMatchObject({before:'<Blair>',after:'Morgan'})
 })
 it('makes a time-zone change explicit even when the local clock time stays the same',()=>{
  const match=schedule(),data=replies(),before=playerAssignmentSnapshot(match,data,owner)
  match.nextMatch!.timeZone='America/New_York'
  expect(playerAssignmentChanges({before,after:playerAssignmentSnapshot(match,data,owner)},time)).toEqual([
   {label:'Start time',before:'18:00 · America/Chicago',after:'18:00 · America/New York'}])
 })
 it('detects same-name partner replacements by identity and distinguishes the two names',()=>{
  const match=schedule(),data=replies();data.sharedLineup!.names[partner]='Alex'
  const before=playerAssignmentSnapshot(match,data,owner)
  data.sharedLineup!.courts[1].players=[owner,'replacement'];data.sharedLineup!.names.replacement='Alex'
  const row=playerAssignmentChanges({before,after:playerAssignmentSnapshot(match,data,owner)},time)[0]
  expect(row.label).toBe('Your partner');expect(row.before).not.toBe(row.after)
  expect(row.before).toContain('Alex (');expect(row.after).toContain('Alex (')
 })
 it('does not invent a partner change when only the player order or partner display name changes',()=>{
  const match=schedule(),data=replies(),before=playerAssignmentSnapshot(match,data,owner)
  data.sharedLineup!.courts[1].players.reverse();data.sharedLineup!.names[partner]='Blair Renamed'
  expect(playerAssignmentChanges({before,after:playerAssignmentSnapshot(match,data,owner)},time)).toEqual([])
 })
 it('explains a new version without claiming the player’s unchanged assignment moved',()=>{
  const match=schedule(),data=replies(),before=playerAssignmentSnapshot(match,data,owner)
  data.sharedLineup!.version='v2';data.lineupReply=null
  const markup=playerAssignmentUpdateHtml({before,after:playerAssignmentSnapshot(match,data,owner)},time)
  expect(markup).toContain('Your response');expect(markup).toContain('Now · Not confirmed')
  data.lineupReply={id:'new-response',version:'v2',choice:'confirmed'}
  expect(playerAssignmentUpdateHtml({before,after:playerAssignmentSnapshot(match,data,owner)},time)).toContain('Your court and partner are unchanged')
 })
 it('shows removal and cancellation without exposing other courts or private assignments',()=>{
  const match=schedule(),data=replies(),before=playerAssignmentSnapshot(match,data,owner)
  data.sharedLineup!.courts=[{format:'singles',players:['other']}]
  delete data.sharedLineup!.names[owner];delete data.sharedLineup!.names[partner]
  const removed=playerAssignmentUpdateHtml({before,after:playerAssignmentSnapshot(match,data,owner)},time)
  expect(removed).toContain('Now · Not assigned');expect(removed).not.toMatch(/Other Player|Private Player/)
  match.nextMatch=null
  expect(playerAssignmentChanges({before,after:playerAssignmentSnapshot(match,null,owner)},time)).toEqual([
   {label:'Match',before:'vs Topspin',after:'No upcoming match'}])
 })
 it('escapes user-supplied old and new names and locations in the comparison',()=>{
  const match=schedule(),data=replies(),before=playerAssignmentSnapshot(match,data,owner)
  match.nextMatch!.facility='<New venue>'
  data.sharedLineup!.courts[1].players=[owner,'new'];data.sharedLineup!.names.new='<Morgan>'
  const markup=playerAssignmentUpdateHtml({before,after:playerAssignmentSnapshot(match,data,owner)},time)
  expect(markup).toContain('&lt;Blair&gt;');expect(markup).toContain('&lt;Morgan&gt;');expect(markup).toContain('&lt;New venue&gt;')
  expect(markup).not.toMatch(/<Blair>|<Morgan>|<New venue>/)
 })
})

describe('player assignment response presentation',()=>{
 it('never displays an older version’s confirmation as current or disables the current confirm action',()=>{
  const data=replies();data.lineupReply!.version='old'
  const markup=lineupPublicationHtml(data,owner,false,false)
  expect(markup).toContain('data-lineup-own-state="awaiting"');expect(markup).toContain('Awaiting your confirmation')
  expect(markup.match(/<button[^>]*data-lineup-reply="confirmed"[^>]*>/)?.[0]).not.toContain('disabled')
 })
 it.each(['in','maybe','out'] as const)('shows %s availability separately from the assignment response',choice=>{
  const data=replies();data.own!.choice=choice
  const markup=lineupPublicationHtml(data,owner,false,false)
  expect(markup).toContain(`Your availability · ${choice==='in'?'In':choice==='out'?'Out':'Maybe'}`)
  expect(markup).toContain(`data-lineup-own-state="${choice==='out'?'out':'confirmed'}"`)
  if(choice==='out')expect(markup.match(/<button[^>]*data-lineup-reply="confirmed"[^>]*>/)?.[0]).toContain('disabled')
 })
})
