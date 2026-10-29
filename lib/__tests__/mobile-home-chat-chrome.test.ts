import {labRecentFormHtml} from '../../mobile/src/lab-recent-form'
import type {RecentMatchRow} from '../../mobile/src/recent-results'
import {describe,it,expect} from 'vitest'
import {chatRoomHeaderHtml} from '../../mobile/src/chat-room-chrome'
import {ratingsHtml} from '../../mobile/src/player-ratings-view'
import {nativeActionIcon} from '../../mobile/src/native-action-icons'
import type {NativeTeamRoom} from '../../mobile/src/team-room-data'
const room={teamName:'Aces <one>',leagueName:'City & Court',flight:'4.0',canManage:true,muted:false} as NativeTeamRoom
const teams=[{teamName:room.teamName,leagueName:room.leagueName,flight:room.flight},{teamName:room.teamName,leagueName:'Other league',flight:'4.5'}]
describe('conversation-first chrome and recorded home scoreboard',()=>{
 it('keeps exact teams and existing tools inside a closed options menu with named icon controls',()=>{
  const markup=chatRoomHeaderHtml(room,teams,'Conversation',false)
  expect(markup).toContain('aria-label="All team chats"');expect(markup).toContain('aria-label="Rooms · General"');expect(markup).toContain('aria-label="Search team history"')
  expect(markup).toContain('<details class="chat-room-options">');expect(markup).toContain('aria-label="Team tools"');expect(markup).not.toContain('<details class="chat-room-options" open')
  expect(markup).toContain('Aces &lt;one&gt;');expect(markup).toContain('City &amp; Court');expect(markup).not.toContain('<one>');expect(markup).toContain('Other league')
  expect(markup.match(/id="linked-team"/g)).toHaveLength(1);expect(markup).toContain('data-team-tab="Captain"');expect(markup).toContain('id="refresh-team"')
 })
 it('does not present Captain or official match tools in a named room and disables guarded navigation',()=>{
  const markup=chatRoomHeaderHtml({...room,chatRoom:{id:'child',name:'Practice <late>',parentId:'parent',teamMuted:false}},teams,'Conversation',true)
  expect(markup).toContain('Rooms · Practice &lt;late&gt;');expect(markup).not.toContain('data-team-tab="Match day"');expect(markup).not.toContain('data-team-tab="Captain"');expect(markup).toContain('id="linked-team" disabled')
  expect(chatRoomHeaderHtml({...room,canManage:false},teams,'Members',false)).not.toContain('data-team-tab="Captain"')
 })
 it('shows the same recorded numbers and fallbacks while preserving source context and approved art',()=>{
  const player={overall_dynamic_rating:4.249,singles_dynamic_rating:null,doubles_dynamic_rating:4.4,rating_source:'self'}
  const markup=ratingsHtml(player,true,true)
  expect(markup).toContain('4.25');expect(markup).toContain('4.40');expect(markup).toContain('Overall used');expect(markup).toContain('Self-rated TIQ');expect(markup).toContain('About these ratings');expect(markup).toContain('not official USTA ratings');expect(markup).toContain('./brand/approved/TiQ_White_Transparent_Refined.png');expect(markup).not.toContain('lab-level-path')
  expect(ratingsHtml(player,true)).toContain('lab-level-path');expect(ratingsHtml(player)).not.toContain('rating-brand-mark')
  expect(ratingsHtml({...player,rating_source:null},true,true)).toContain('Source unavailable')
  expect(ratingsHtml(null,true,true)).not.toContain('<meter')
 })
 it('uses real library icon markup with hidden decorative semantics and no runtime handlers',()=>{
  for(const name of ['back','send','plus','emoji','react','more','search','camera','photo'] as const){const markup=nativeActionIcon(name);expect(markup).toContain('<svg');expect(markup).toContain('aria-hidden="true"');expect(markup).not.toMatch(/style=|onClick|<script/)}
 })
})

describe('home form from the already loaded results',()=>{
 it('uses only five decided player results, keeps source indexes and never counts pending rows',()=>{
  const row={id:'court',match_date:'2026-10-20',match_type:'doubles',league_name:'City',score:'6-4',winner_side:'A',match_players:[{player_id:'owner',side:'A'}]} as RecentMatchRow
  const rows=[{...row,winner_side:null},row,{...row,winner_side:'B'},row,row,row,row].map((entry,index)=>({...entry,id:'court-'+index}))
  const markup=labRecentFormHtml(rows,'owner')
  expect(markup.match(/data-lab-form-index=/g)).toHaveLength(5);expect(markup).toContain('4W · 1L');expect(markup).toContain('data-lab-form-index="1"');expect(markup).not.toContain('data-lab-form-index="0"');expect(markup).toContain('Latest 5 decided results in your loaded matches')
  expect(labRecentFormHtml(rows,'outsider')).toBe('');expect(labRecentFormHtml([], 'owner')).toBe('')
 })
})
