import {expect,it} from 'vitest'
import {availableLineupReserves,lineupAssignmentFollowups,lineupAvailabilityFollowup,lineupConfirmationReminder,lineupConfirmationSummary,lineupPublicationHtml,lineupPublishPreviewHtml} from '../../mobile/src/team-lineup-publication'
import type {TeamMatchReplies} from '../team-match-replies-contract'

const player='22222222-2222-4222-8222-222222222222',captain='11111111-1111-4111-8111-111111111111',
 version='55555555-5555-4555-8555-555555555555'
const courts=[{format:'singles' as const,players:[player]}]
it('offers unassigned In players as reserves and escapes published previews',()=>{
 expect(availableLineupReserves(courts,[{id:player,name:'Alex',choice:'in'},{id:captain,name:'Blair',choice:'in'},{id:version,name:'Casey',choice:'maybe'}]))
  .toEqual([{id:captain,name:'Blair',choice:'in'}])
 const preview=lineupPublishPreviewHtml(courts,[{id:player,name:'<Alex>',choice:'in'}])
 expect(preview).toContain('&lt;Alex&gt;');expect(preview).not.toContain('<Alex>')
})
it('does not count a removed player as a current confirmed assignment',()=>{
 const removed=lineupPublicationHtml({own:null,sharedLineup:{version,courts,names:{[player]:'Alex'}},rosterComplete:true,lineupRoster:[],
  lineupReplies:[{profileId:player,id:captain,version,choice:'confirmed'}]},captain,true,false)
 expect(removed).toContain('0 of 1 assignments confirmed');expect(removed).toContain('No longer on roster')
})

function confirmationFixture():TeamMatchReplies{
 return {own:null,rosterComplete:true,
  sharedLineup:{version,courts:[{format:'doubles',players:[player,captain]},{format:'singles',players:['reserve']}],
   names:{[player]:'<Alex>',[captain]:'Blair',reserve:'Casey'}},
  lineupRoster:[{id:player,name:'<Alex>',choice:'in'},{id:captain,name:'Blair',choice:'out'},{id:'reserve',name:'Casey',choice:'in'}],
  lineupReplies:[{profileId:player,id:captain,version,choice:'confirmed'},{profileId:captain,id:player,version,choice:'confirmed'}]}
}

it('prioritizes an unavailable assignment over its old confirmation and attaches court context',()=>{
 const summary=lineupConfirmationSummary(confirmationFixture())
 expect(summary).toMatchObject({checked:true,confirmed:1,awaiting:1,review:1,unknown:0})
 expect(summary.rows.map(row=>[row.name,row.court,row.reason])).toEqual([
  ['Blair','Doubles 1','Can’t play'],['Casey','Singles 1','Awaiting confirmation'],['<Alex>','Doubles 1','Confirmed']])
 const markup=lineupPublicationHtml(confirmationFixture(),captain,true,false)
 expect(markup).toContain('aria-label="Review court for Blair"')
 expect(markup).toContain('&lt;Alex&gt;');expect(markup).not.toContain('<Alex>')
})

it('keeps change requests distinct from unanswered assignments and ignores confirmations for another version',()=>{
 const fixture=confirmationFixture()
 fixture.lineupRoster![1].choice='in'
 fixture.lineupReplies![0].choice='needs_change'
 fixture.lineupReplies![1].version='another-version'
 expect(lineupConfirmationSummary(fixture)).toMatchObject({confirmed:0,awaiting:2,review:1})
 expect(lineupConfirmationSummary(fixture).rows[0].reason).toBe('Needs a change')
})

it('does not invent pending confirmations when confirmation data or part of the roster is missing',()=>{
 const fixture=confirmationFixture()
 fixture.lineupReplies=undefined
 expect(lineupConfirmationSummary(fixture)).toMatchObject({checked:false,confirmed:0,awaiting:0,review:1,unknown:2})
 expect(()=>lineupConfirmationReminder(fixture,'Saturday')).toThrow('Reload the match')
 fixture.lineupReplies=[];fixture.rosterComplete=false;fixture.lineupRoster=[]
 expect(lineupConfirmationSummary(fixture)).toMatchObject({awaiting:0,review:0,unknown:3})
 expect(lineupConfirmationReminder(fixture,'Saturday')).toBeNull()
})

it('drafts only unanswered published assignments without including unavailable, confirmed or private-only players',()=>{
 const fixture=confirmationFixture()
 fixture.savedLineup={version:'private',courts:[{format:'singles',players:['private-player']}],names:{'private-player':'Private Player'}}
 const message=lineupConfirmationReminder(fixture,'our match vs Topspin')!
 expect(message).toContain('Casey — please open Team → Next match')
 for(const name of ['Alex','Blair','Private Player'])expect(message).not.toContain(name)
 expect(lineupPublicationHtml(fixture,captain,true,false)).toContain('Your private lineup has unpublished edits')
 expect(lineupPublicationHtml(fixture,player,false,false)).not.toContain('Your private lineup has unpublished edits')
 expect(lineupPublicationHtml(fixture,'unassigned',true,false)).not.toContain('aria-label="Your shared court"')
 expect(lineupPublicationHtml(fixture,'unassigned',false,false)).toContain('You don’t have a court assignment')
 fixture.lineupReplies!.push({profileId:'reserve',id:version,version,choice:'confirmed'})
 expect(lineupConfirmationReminder(fixture,'Saturday')).toBeNull()
})

it('keeps reminder drafts within the team composer limit',()=>{
 const fixture=confirmationFixture()
 expect(()=>lineupConfirmationReminder(fixture,'x'.repeat(2400))).toThrow('too long')
})

it.each(['maybe',null] as const)('keeps a confirmed assignment in follow-ups when availability is %s',choice=>{
 const fixture=confirmationFixture()
 fixture.lineupRoster![0].choice=choice
 const followups=lineupAssignmentFollowups(fixture)
 expect(lineupConfirmationSummary(fixture).confirmed).toBe(1)
 expect(followups.attention).toBe(3)
 expect(followups.rows.find(row=>row.id===player)).toMatchObject({status:'confirmed',needsAttention:true,
  availability:choice==='maybe'?'Maybe':'Not replied'})
 // An availability follow-up must not draft another assignment-confirmation reminder for this player.
 expect(lineupConfirmationReminder(fixture,'Saturday')).not.toContain('Alex')
})

it('keeps unchecked and removed assignments in follow-ups and excludes private-only players',()=>{
 const fixture=confirmationFixture()
 fixture.lineupRoster=[];fixture.rosterComplete=false
 fixture.savedLineup={version:'private',courts:[{format:'singles',players:['private-only']}],names:{'private-only':'Private Player'}}
 expect(lineupAssignmentFollowups(fixture)).toMatchObject({attention:3})
 expect(lineupAssignmentFollowups(fixture).rows.every(row=>row.needsAttention&&row.availability==='Not checked')).toBe(true)
 fixture.rosterComplete=true
 expect(lineupAssignmentFollowups(fixture).rows.map(row=>[row.status,row.availability])).toEqual([
  ['review','No longer on roster'],['review','No longer on roster'],['review','No longer on roster']])
 expect(lineupAssignmentFollowups(fixture).rows.some(row=>row.id==='private-only')).toBe(false)
})

it('clears follow-ups only when the current published assignments are confirmed and In',()=>{
 const fixture=confirmationFixture()
 fixture.lineupRoster!.forEach(row=>row.choice='in')
 fixture.lineupReplies!.push({profileId:'reserve',id:version,version,choice:'confirmed'})
 expect(lineupAssignmentFollowups(fixture).attention).toBe(0)
 fixture.lineupReplies![0].version='old-publication'
 expect(lineupAssignmentFollowups(fixture)).toMatchObject({attention:1})
 expect(lineupAssignmentFollowups(fixture).rows[0]).toMatchObject({id:player,status:'awaiting',needsAttention:true})
})

it('limits response-view controls to captains and disables them while a change is in progress',()=>{
 const fixture=confirmationFixture()
 expect(lineupPublicationHtml(fixture,player,false,false)).not.toContain('data-assignment-view')
 const busy=lineupPublicationHtml(fixture,captain,true,true)
 expect(busy).toContain('data-assignment-view="attention" aria-pressed="true" disabled')
 expect(busy).toContain('data-assignment-view="all" aria-label="All assignments (3)" aria-pressed="false" disabled')
 expect(lineupPublicationHtml(fixture,captain,true,false,'all')).toContain('data-assignment-view="all" aria-label="All assignments (3)" aria-pressed="true"')
})

it.each(['maybe',null] as const)('drafts a named availability follow-up for %s without requesting another court confirmation',choice=>{
 const fixture=confirmationFixture()
 fixture.lineupRoster![0].choice=choice
 const message=lineupAvailabilityFollowup(fixture,player,'our match vs Topspin on Saturday at Court 2')!
 expect(message).toContain('<Alex> · Doubles 1')
 expect(message).toContain('our match vs Topspin on Saturday at Court 2')
 expect(message).toContain(choice==='maybe'?'when you know':'Please reply')
 expect(message).toContain('Your court confirmation is separate.')
 expect(message).not.toMatch(/Blair|Casey|confirm your published court assignment/)
 expect(lineupConfirmationSummary(fixture).confirmed).toBe(1)
})

it.each(['in','out'] as const)('does not ask for availability once the player is %s',choice=>{
 const fixture=confirmationFixture();fixture.lineupRoster![0].choice=choice
 expect(lineupAvailabilityFollowup(fixture,player,'Saturday')).toBeNull()
 expect(lineupAssignmentFollowups(fixture).rows.find(row=>row.id===player)?.needsAvailabilityReply).toBe(false)
})

it('withholds availability drafts without a current published assignment and checked captain data',()=>{
 const fixture=confirmationFixture()
 expect(()=>lineupAvailabilityFollowup(fixture,'private-only','Saturday')).toThrow('no longer in the published lineup')
 fixture.lineupRoster=fixture.lineupRoster!.filter(row=>row.id!==player)
 expect(()=>lineupAvailabilityFollowup(fixture,player,'Saturday')).toThrow('availability could not be checked')
 fixture.lineupRoster=undefined
 expect(()=>lineupAvailabilityFollowup(fixture,player,'Saturday')).toThrow('Captain access could not be confirmed')
 fixture.lineupRoster=[];fixture.lineupReplies=undefined
 expect(()=>lineupAvailabilityFollowup(fixture,player,'Saturday')).toThrow('Captain access could not be confirmed')
})

it('distinguishes same-name published teammates in the follow-up list and draft',()=>{
 const fixture=confirmationFixture()
 fixture.sharedLineup!.names[player]='Alex';fixture.sharedLineup!.names[captain]='Alex'
 fixture.lineupRoster!.forEach(row=>{if(row.id===player||row.id===captain){row.name='Alex';row.choice='maybe'}})
 const followups=lineupAssignmentFollowups(fixture)
 expect(followups.rows.find(row=>row.id===player)?.name).toBe('Alex (2222)')
 expect(followups.rows.find(row=>row.id===captain)?.name).toBe('Alex (1111)')
 const message=lineupAvailabilityFollowup(fixture,player,'Saturday')!
 expect(message).toContain('Alex (2222) · Doubles 1');expect(message).not.toContain('Alex (1111)')
})

it('offers captains their own reply shortcut and reserves follow-up drafting for other players',()=>{
 const fixture=confirmationFixture();fixture.lineupRoster![0].choice='maybe';fixture.lineupRoster![1].choice=null
 const markup=lineupPublicationHtml(fixture,captain,true,false)
 expect(markup).toContain('data-open-assignment-availability')
 expect(markup).not.toContain(`data-draft-availability-followup="${captain}"`)
 expect(markup).toContain(`data-draft-availability-followup="${player}" aria-label="Draft follow-up for &lt;Alex&gt;"`)
 expect(lineupPublicationHtml(fixture,captain,true,true)).toContain('aria-label="Draft follow-up for &lt;Alex&gt;" disabled')
 expect(lineupPublicationHtml(fixture,player,false,false)).not.toContain('data-draft-availability-followup')
 expect(()=>lineupAvailabilityFollowup(fixture,player,'x'.repeat(2400))).toThrow('too long')
})
