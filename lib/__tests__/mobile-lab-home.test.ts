import {describe,expect,it} from 'vitest'
import {labIdentityHtml} from '../../mobile/src/lab-home'
describe('My Lab connected identity',()=>{
 it('escapes names and team context before rendering',()=>{const s=labIdentityHtml({linked_player_id:'p',linked_player_name:'<img src=x>',linked_team_name:'A & B',linked_league_name:'<League>'});expect(s).toContain('&lt;img src=x&gt;');expect(s).toContain('A &amp; B');expect(s).toContain('&lt;League&gt;');expect(s).not.toContain('<img');expect(s).not.toContain('id="connect-player"')})
 it.each([null,{}, {linked_player_id:'p'}, {linked_player_name:'Name'}])('does not present an incomplete link as an active player: %s',profile=>{expect(labIdentityHtml(profile)).toContain('id="connect-player"');expect(labIdentityHtml(profile)).not.toContain('Active player')})
 it('keeps a linked identity when optional team context is missing',()=>{const s=labIdentityHtml({linked_player_id:'p',linked_player_name:'Alex'});expect(s).toContain('Active player');expect(s).toContain('No team linked');expect(s).toContain('No league linked')})
})
