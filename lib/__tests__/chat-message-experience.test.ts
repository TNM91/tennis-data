import {describe,it,expect} from 'vitest'
import {practiceRsvpPath} from '../captain-practice-rsvp'
import {chatMessageActionsHtml} from '../../mobile/src/chat-message-menu'
import {chatAttachmentMenuHtml} from '../../mobile/src/chat-attachment-menu'
import {chatReactionButtons} from '../../mobile/src/chat-reactions'
import {chatBodyHtml,sharedChatPlanHtml} from '../../mobile/src/chat-links'
import type {NativeTeamRoom,TeamMessage} from '../../mobile/src/team-room-data'
const id='55555555-5555-4555-8555-555555555555',practiceId='44444444-4444-4444-8444-444444444444'
const message={id,senderName:'Aces <player>',senderUserId:'other',isMine:false,reactions:[]} as unknown as TeamMessage
const room={teamName:'Aces',leagueName:'City',flight:'4.0',canManage:true} as NativeTeamRoom
const poll=`Poll: When should we practice?\n1. Saturday\n2. Sunday\nhttps://www.tenaceiq.com/team-room?poll=${id}`
describe('shared chat interaction boundaries',()=>{
 it('keeps ownership and safety actions on the existing guarded selectors and escapes names',()=>{
  const other=chatMessageActionsHtml(message)
  expect(other).toContain('data-open-message-actions');expect(other).toContain('Aces &lt;player&gt;');expect(other).not.toContain('<player>')
  expect(other).toContain('data-chat-reply');expect(other).toContain('data-chat-view');expect(other).toContain('data-chat-report');expect(other).toContain('data-chat-block');expect(other).not.toContain('data-chat-edit')
  const own=chatMessageActionsHtml({...message,isMine:true,canManageOwn:true})
  expect(own).toContain('data-chat-edit');expect(own).toContain('data-chat-remove');expect(own).not.toContain('data-chat-report')
  expect(chatMessageActionsHtml({...message,isMine:true,canManageOwn:false})).not.toContain('data-chat-remove')
 })
 it('shows only real reaction counts and retains the same six guarded choices for the message sheet',()=>{
  const markup=chatReactionButtons({...message,reactions:[{reaction:'heart',count:2,reacted:true}]},true)
  expect(markup).toContain('data-chat-reaction-sources hidden');expect(markup).not.toContain('<summary');expect(markup).toContain('Love: 2 reactions')
  expect(markup.match(/data-reaction-message=/g)).toHaveLength(7)
 })
 it('keeps General captain controls out of named rooms and disables every media/team choice while locked',()=>{
  const named=chatAttachmentMenuHtml({...room,chatRoom:{id:'child',parentId:'parent',name:'Practice',teamMuted:false}},true,false)
  expect(named).toContain('aria-disabled="true"');expect(named).toContain('Close attachments');expect(named).not.toContain('data-chat-plan-practice');expect(named).not.toContain('data-chat-availability')
  for(const source of ['data-photo-source="library"','data-photo-source="camera"','id="chat-choose-gif"','id="chat-tag-person"','data-chat-create-poll','data-chat-practices'])expect(named).toMatch(new RegExp(source+'[^>]*disabled'))
  expect(chatAttachmentMenuHtml(room,false,true)).toMatch(/id="chat-tag-person"[^>]*disabled/)
 })
 it('turns only complete canonical polls into a question card without claiming live results',()=>{
  const markup=sharedChatPlanHtml(poll)!
  expect(markup).toContain('When should we practice?');expect(markup).toContain('Saturday · Sunday');expect(markup).toContain('2 choices');expect(markup).toContain('Vote · view results');expect(markup).toContain('data-chat-poll')
  expect(markup).not.toContain('https://');expect(markup).not.toContain('votes');expect(chatBodyHtml(poll,false)).not.toContain('chat-plan-card')
  for(const body of [poll.replace('2. Sunday','3. Sunday'),poll.replace('2. Sunday','2. saturday'),poll.replace('www.tenaceiq.com','evil.example'),poll+'\nExtra note'])expect(sharedChatPlanHtml(body)).toBeNull()
 })
 it('preserves practice notes and cancellation context without inventing RSVP state or open places',()=>{
  const body=`Practice cancelled\nDoubles drills\nAces · City · 4.0\nDate: 2026-11-03\nTime: 18:00\nLocation: North courts\nRain expected <bring cover>\nThis occurrence is cancelled. Already-saved future practices are unchanged.\nhttps://www.tenaceiq.com${practiceRsvpPath(practiceId)}`
  const markup=sharedChatPlanHtml(body)!
  expect(markup).toContain('Doubles drills');expect(markup).toContain('Practice cancelled');expect(markup).toContain('View cancellation');expect(markup).toContain('Rain expected &lt;bring cover&gt;');expect(markup).toContain('future practices are unchanged');expect(markup).not.toContain('View practice · RSVP');expect(markup).not.toContain('<bring cover>')
 })
})
