import {describe,it,expect} from 'vitest'
import {pastedChatGif} from '../../mobile/src/chat-gif-paste'
import {chatTeamActionsHtml} from '../../mobile/src/chat-team-actions'
import type {NativeTeamRoom} from '../../mobile/src/team-room-data'
const room={canManage:true} as NativeTeamRoom
const file=(type:string,name='saved.gif')=>({type,name}) as File
describe('GIF clipboard file boundaries',()=>{
 it('leaves ordinary text paste alone and accepts one original GIF file',()=>{
  expect(pastedChatGif(null)).toBeNull();expect(pastedChatGif([])).toBeNull()
  const gif=file('image/gif');expect(pastedChatGif([gif])).toBe(gif)
  const noMime=file('','SAVED.GIF');expect(pastedChatGif([noMime])).toBe(noMime)
 })
 it('rejects flattened images, disguised files, multiple attachments and missing GIF extensions',()=>{
  for(const f of [file('image/png'),file('text/html'),file('','photo.png')])expect(()=>pastedChatGif([f])).toThrow('original GIF')
  expect(()=>pastedChatGif([file('image/gif'),file('image/gif')])).toThrow('one GIF')
 })
})
describe('chat entry points reuse team plans',()=>{
 it('shows captain planning only in General and preserves member practice entry in named rooms',()=>{
  const captain=chatTeamActionsHtml(room,false);expect(captain).toContain('Practice RSVPs');expect(captain).toContain('Request match availability');expect(captain).toContain('Plan a practice');expect(captain).not.toContain('disabled')
  const member=chatTeamActionsHtml({...room,canManage:false},false);expect(member).not.toContain('Plan a practice');expect(member).toContain('Match availability');expect(member).not.toContain('Request match availability')
  const named=chatTeamActionsHtml({...room,chatRoom:{id:'child',parentId:'parent',name:'Practice',teamMuted:false}},false)
  expect(named).toContain('Practice RSVPs');expect(named).not.toContain('data-chat-availability');expect(named).not.toContain('Plan a practice')
 })
 it('freezes all team actions while the composer is processing a send or media selection',()=>{
  expect(chatTeamActionsHtml(room,true).match(/disabled/g)).toHaveLength(4)
 })
})
