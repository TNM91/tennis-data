import {describe,it,expect} from 'vitest'
import {filterTennisGifs,tennisGifCategories,tennisGifLibrary,chooseTeamGif} from '../../mobile/src/chat-gif-library-picker'
import {inspectChatGif} from '../chat-gif'
import {chatEmojiChoices,insertChatEmoji} from '../../mobile/src/chat-emoji'
describe('bundled tennis expression library',()=>{
 it('finds tennis moments by label, category and conjunctive aliases without modifying the catalog',()=>{
  const before=JSON.stringify(tennisGifLibrary)
  expect(filterTennisGifs('RAIN')[0].id).toBe('rain-check')
  expect(filterTennisGifs('gg')[0].id).toBe('good-game')
  expect(filterTennisGifs('tennis unknown')).toEqual([])
  expect(filterTennisGifs('team celebrate').map(item=>item.id)).toEqual(['team-win'])
  expect(filterTennisGifs('ace','Respect')).toEqual([])
  expect(filterTennisGifs('  ace  ','Hype').map(item=>item.id)).toEqual(['ace'])
  expect(filterTennisGifs('acé').map(item=>item.id)).toEqual(['ace'])
  expect(filterTennisGifs('<img onerror=alert(1)>')).toEqual([])
  expect(JSON.stringify(tennisGifLibrary)).toBe(before)
 })
 it('bundles twelve distinct bounded original animations and still posters, never remote assets',()=>{
  expect(tennisGifLibrary).toHaveLength(12);expect(new Set(tennisGifLibrary.map(x=>x.id)).size).toBe(12);expect(new Set(tennisGifLibrary.map(x=>x.base64)).size).toBe(12)
  let total=0
  for(const item of tennisGifLibrary){expect(tennisGifCategories).toContain(item.category);expect(item.preview).toMatch(/^data:image\/png;base64,/);const bytes=Buffer.from(item.base64,'base64');total+=bytes.length;expect(bytes.length).toBeLessThan(100000);const proof=inspectChatGif(bytes);expect(proof).toMatchObject({width:280,height:180,duration:2400});expect(proof.frames).toBeGreaterThan(1);expect(proof.frames).toBeLessThanOrEqual(24)}
  expect(total).toBeLessThan(1000000)
 })
 it('returns every item when filters are cleared and rejects an aborted picker before opening UI',async()=>{
  expect(filterTennisGifs('')).toHaveLength(12);expect(filterTennisGifs(' ','Match day').map(x=>x.id)).toEqual(['match-point','rain-check','court-time'])
  const controller=new AbortController();controller.abort();await expect(chooseTeamGif(controller.signal)).rejects.toThrow('No GIF added')
 })
 it('inserts all 24 uniquely labelled emoji choices with the same UTF-16 limit and caret rules',()=>{
  expect(chatEmojiChoices).toHaveLength(24);expect(new Set(chatEmojiChoices.map(x=>x[0])).size).toBe(24)
  for(const [emoji] of chatEmojiChoices){expect(insertChatEmoji('AC',1,1,emoji)).toEqual({text:'A'+emoji+'C',caret:1+emoji.length});expect(insertChatEmoji('A'.repeat(2400),2400,2400,emoji)).toBeNull()}
 })
})
