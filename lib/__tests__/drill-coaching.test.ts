import {expect,it} from 'vitest'
import {LEVEL_UP_CARDS} from '../level-up/level-up-cards'
import {drillCoachingCues} from '../level-up/drill-coaching-cues'
import {drillCoachingHtml} from '../../mobile/src/drill-coaching'
import {newDrillPractice,drillSessionNote} from '../../mobile/src/drill-playbook'

const get=(id:string)=>LEVEL_UP_CARDS.find(card=>card.id===id)!
it('gives all twenty tracked drills distinct corrections and the same progression rules as their playbooks',()=>{
 const cards=LEVEL_UP_CARDS.filter(card=>card.playbook)
 expect(cards).toHaveLength(20)
 expect(new Set(cards.map(card=>card.commonMiss?.fix)).size).toBe(cards.length)
 for(const card of cards){
  expect(drillCoachingCues(card.id)).toBeDefined();expect(card.qualityChecks).toHaveLength(3)
  expect(card.progression).toBe(card.playbook!.advance);expect(card.regression).toBe(card.playbook!.easier)
 }
 expect(drillCoachingCues('__proto__')).toBeUndefined();expect(drillCoachingCues('retired-drill')).toBeUndefined()
})
it('keeps serve, rally and no-ball corrections consistent with what is actually being counted',()=>{
 expect(get('serve-target-call').commonMiss?.fix).toContain('Keep the fault in the count')
 expect(get('crosscourt-consistency').commonMiss?.fix).toContain('your partner’s miss starts another rally without adding an attempt for you')
 expect(get('30-30-pressure-game').commonMiss?.fix).toContain('keep point wins separate')
 expect(get('poach-timing-shadow').commonMiss?.fix).toContain('free of live balls')
 expect(get('poach-timing-shadow').progression).toContain('separate live-ball drill')
 expect(get('middle-ball-rule').commonMiss?.fix).toContain('positions and handedness')
 expect(get('switch-call-drill').commonMiss?.fix).toContain('does not change your designated receiving sides')
})
it('shows the chosen version without changing private raw rounds or adding guidance to saved evidence',()=>{
 const card=get('return-depth-lane'),practice={...newDrillPractice(card,'pressure')!,results:['0','','8']},before=structuredClone(practice)
 const note=drillSessionNote(card,practice,'Recover first.'),markup=drillCoachingHtml(card,practice,true,true)
 expect(markup).toContain('Add pressure');expect(markup).toContain(card.playbook!.versions[1].focus)
 expect(markup).toContain('data-session-coaching open');expect(markup).toContain('data-session-control="coaching"')
 expect(markup).not.toContain('<input');expect(markup).not.toContain('type="submit"');expect(markup).not.toContain('role="status"')
 expect(practice).toEqual(before);expect(drillSessionNote(card,practice,'Recover first.')).toBe(note)
 expect(note).toContain('R1 0/10; R3 8/10');expect(note).not.toContain('Quick coaching')
})
it('escapes all coaching text and omits the panel for an incompatible or legacy draft',()=>{
 const card=get('return-depth-lane'),dangerous={...card,qualityChecks:['<img src=x>'],commonMiss:{miss:'<script>miss</script>',fix:'A & B'},playbook:{...card.playbook!,easier:'<button>save</button>'}},practice=newDrillPractice(card)!
 const markup=drillCoachingHtml(dangerous,practice)
 expect(markup).toContain('&lt;img src=x&gt;');expect(markup).toContain('&lt;script&gt;');expect(markup).toContain('A &amp; B');expect(markup).toContain('&lt;button&gt;')
 expect(markup).not.toContain('<img');expect(markup).not.toContain('<script>');expect(markup).not.toContain('<button>')
 expect(markup).toContain('data-drill-fold="coaching"');expect(markup).not.toContain('data-session-control')
 for(const candidate of [{...card,playbook:undefined},{...card,id:'other'},{...card,qualityChecks:[]},{...card,commonMiss:undefined}])expect(drillCoachingHtml(candidate,practice)).toBe('')
 expect(drillCoachingHtml(card,null)).toBe('');expect(drillCoachingHtml(card,{...practice,results:['0']})).toBe('')
})
