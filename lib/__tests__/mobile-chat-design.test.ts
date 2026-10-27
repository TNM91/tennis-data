import {describe,it,expect} from 'vitest'
import {chatEmojiChoices,insertChatEmoji,chatEmojiPickerHtml} from '../../mobile/src/chat-emoji'
import {chatsInboxHtml} from '../../mobile/src/chats-inbox'
import {inspectChatGif} from '../chat-gif'
import library from '../../mobile/src/chat-gif-library.json'
describe('Chat expression and inbox',()=>{
 it('inserts at the caret and replaces a selection without splitting emoji or exceeding the send limit',()=>{
  const tennis=chatEmojiChoices[0][0]
  expect(insertChatEmoji('Nice!',4,4,tennis)).toEqual({text:'Nice'+tennis+'!',caret:6})
  expect(insertChatEmoji('old words',0,3,tennis)?.text).toBe(tennis+' words')
  expect(insertChatEmoji(tennis,1,1,tennis)).toBeNull()
  expect(insertChatEmoji('a'.repeat(2400),2400,2400,tennis)).toBeNull()
  expect(insertChatEmoji('a'.repeat(2400),2398,2400,tennis)?.text.length).toBe(2400)
  expect(insertChatEmoji('',0,0,'<img>')).toBeNull()
  expect(insertChatEmoji('abc',-1,2,tennis)).toBeNull()
  expect(insertChatEmoji('abc',2,1,tennis)).toBeNull()
 })
 it('provides labelled buttons and freezes choices during an attempted send',()=>{
  const enabled=chatEmojiPickerHtml(false),disabled=chatEmojiPickerHtml(true)
  expect(enabled.match(/data-chat-emoji=/g)).toHaveLength(12)
  expect(enabled).toContain('aria-label="Insert Tennis"');expect(enabled).not.toContain(' disabled')
  expect(disabled.match(/ disabled/g)).toHaveLength(12)
 })
 it('shows exact authorized team scopes without invented message previews or unread counts',()=>{
  const markup=chatsInboxHtml({room:null,teams:[{teamName:'<Aces>',leagueName:'City & Court',flight:'4.0'},{teamName:'Aces',leagueName:'Other',flight:'4.5'}]})
  expect(markup).toContain('&lt;Aces&gt;');expect(markup).toContain('City &amp; Court');expect(markup).toContain('data-open-team-chat="0"');expect(markup).toContain('data-open-team-chat="1"');expect(markup).not.toContain('<Aces>');expect(markup).not.toContain('unread')
  expect(chatsInboxHtml({room:null,teams:[]})).toContain('Join your team with an invite')
 })
 it('bundles actual bounded animated tennis GIFs with still previews and no third-party requests',()=>{
  expect(library).toHaveLength(3)
  for(const item of library){const proof=inspectChatGif(new Uint8Array(Buffer.from(item.base64,'base64')));expect(proof.frames).toBe(24);expect(proof.duration).toBe(2400);expect(proof.width).toBe(280);expect(item.preview).toMatch(/^data:image\/png;base64,/)}
 })
})
