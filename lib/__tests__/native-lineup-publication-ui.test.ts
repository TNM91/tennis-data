import {expect,it} from 'vitest'
import {availableLineupReserves,lineupPublicationHtml,lineupPublishPreviewHtml} from '../../mobile/src/team-lineup-publication'

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
