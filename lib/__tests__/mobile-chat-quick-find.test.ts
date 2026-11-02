import {describe,it,expect} from 'vitest'
import {messageSearchRanges} from '../../mobile/src/message-search'
import {chatQuickFindHtml} from '../../mobile/src/chat-quick-find'
import {chatMatches} from '../../mobile/src/chat-filters'
import type {TeamMessage} from '../../mobile/src/team-room-data'

describe('quick conversation find',()=>{
 it('uses literal bounded matches with original Unicode offsets',()=>{
  expect(messageSearchRanges('İ 🎾 Try [a+b]. Then [A+B].','[a+b]')).toEqual([{start:9,end:14},{start:21,end:26}])
  expect(messageSearchRanges('Practice',' ')).toEqual([])
  expect(messageSearchRanges('a'.repeat(121),'a'.repeat(121))).toEqual([{start:0,end:120}])
 })
 it('keeps sender/category matching and removed-message boundaries',()=>{
  const message={senderName:'Alex',body:'Try [A+B] on court 3',kind:'message',deletedAt:''} as TeamMessage
  expect(chatMatches(message,'all','[a+b]')).toBe(true);expect(chatMatches(message,'all','alex')).toBe(true)
  expect(chatMatches(message,'media','court')).toBe(false);expect(chatMatches({...message,deletedAt:'removed'},'all','court')).toBe(false)
 })
 it('escapes the query and provides one local field plus an explicit older-history action',()=>{
  const markup=chatQuickFindHtml('"<serve>','mentions',false)
  expect(markup).toContain('value="&quot;&lt;serve&gt;"');expect(markup).not.toContain('<serve>')
  expect(markup).toContain('aria-label="Find in conversation" hidden')
  expect(markup).toContain('value="mentions" selected');expect(markup.match(/<input /g)).toHaveLength(1)
  expect(markup).toContain('id="chat-history-open">Search older history')
 })
})
