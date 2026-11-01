import {expect,it} from 'vitest'
import {coachMessageHistory,coachMessageRanges,coachMessageText} from '../../mobile/src/coach-message-history'

it('searches literal punctuation and original Unicode offsets without interpreting a pattern',()=>{
 expect(coachMessageRanges('Try [a+b]. Then [A+B].','[a+b]')).toEqual([{start:4,end:9},{start:16,end:21}])
 expect(coachMessageText('İ 🎾 <Serve> SERVE','serve')).toBe('İ 🎾 &lt;<mark>Serve</mark>&gt; <mark>SERVE</mark>')
 expect(coachMessageRanges('Practice','  ')).toEqual([])
 expect(coachMessageRanges('a'.repeat(121),'a'.repeat(121))).toEqual([{start:0,end:120}])
})
it('escapes both highlighted and surrounding text, including HTML supplied as a search term',()=>{
 expect(coachMessageText('<img src=x> & "x"','<img')).toBe('<mark>&lt;img</mark> src=x&gt; &amp; &quot;x&quot;')
 expect(coachMessageText('No markup: <script>','absent')).toBe('No markup: &lt;script&gt;')
})
it('groups only adjacent messages from the same sender and local day within five minutes',()=>{
 const messages=[
  {id:'one',mine:false,body:'First',createdAt:'2026-10-30T12:00:00Z'},
  {id:'two',mine:false,body:'Second',createdAt:'2026-10-30T12:03:00Z'},
  {id:'three',mine:true,body:'My reply',createdAt:'2026-10-30T12:04:00Z'},
  {id:'four',mine:true,body:'Later',createdAt:'2026-10-30T12:11:00Z'},
  {id:'five',mine:true,body:'Tomorrow',createdAt:'2026-10-31T12:12:00Z'}
 ]
 const result=coachMessageHistory(messages,'Taylor <Coach>')
 expect(result.match(/class="coach-message-day"/g)).toHaveLength(2)
 expect(result.match(/is-continuation/g)).toHaveLength(1)
 expect(result).toContain('aria-label="Taylor &lt;Coach&gt;,')
 expect(result).toContain('datetime="2026-10-30T12:03:00Z"')
 expect(result).toContain('aria-label="You,')
 expect(result).not.toContain('<Coach>')
})
it('handles invalid timestamps without throwing or inventing a time',()=>{
 const result=coachMessageHistory([{id:'one',mine:false,body:'Hello',createdAt:'invalid'}],'Coach')
 expect(result).toContain('Date unavailable');expect(result).toContain('Time unavailable');expect(result).not.toContain('datetime=')
})
