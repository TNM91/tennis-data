import {expect,it} from 'vitest'
import {LEVEL_UP_CARDS} from '../level-up/level-up-cards'
import type {LevelUpCard} from '../level-up/level-up-types'
import {newDrillPractice,drillSessionNote,type DrillPractice} from '../../mobile/src/drill-playbook'
import {drillGuidePage,moveDrillGuide,drillCourtGuideHtml} from '../../mobile/src/drill-court'
import {freezeTrainingSave} from '../../mobile/src/level-up-model'

const card=LEVEL_UP_CARDS.find(card=>card.id==='return-depth-lane')!
it('opens all twenty-six playbooks in their selected version without changing their dose',()=>{
 const cards=LEVEL_UP_CARDS.filter(card=>card.playbook);expect(cards).toHaveLength(26)
 for(const card of cards)for(const mode of card.playbook!.versions){const page=drillGuidePage(card,newDrillPractice(card,mode.id),0)!;expect(page.instruction).toBe(mode.steps[0]);expect(page.mode).toBe(mode);expect(page.total).toBe(mode.steps.length)}
})
it('bounds instruction navigation without wrapping or completing rounds',()=>{
 const practice=newDrillPractice(card)!,total=drillGuidePage(card,practice,0)!.total
 let position=0;for(let i=0;i<total+2;i++)position=moveDrillGuide(card,practice,position,1)
 expect(position).toBe(total-1);expect(drillGuidePage(card,practice,position)).toMatchObject({previous:true,next:false})
 for(let i=0;i<total+2;i++)position=moveDrillGuide(card,practice,position,-1)
 expect(position).toBe(0);expect(practice.results).toEqual(['','',''])
})
it('falls back to the first instruction for invalid positions and ignores invalid directions',()=>{
 const practice=newDrillPractice(card)!
 for(const position of [-1,NaN,.5,Infinity,4])expect(drillGuidePage(card,practice,position)?.index).toBe(0)
 expect(moveDrillGuide(card,practice,2,0 as 1)).toBe(2)
})
it('does not offer instructions for legacy or mismatched sessions',()=>{
 const practice=newDrillPractice(card)!
 for(const [candidate,draft] of [[{...card,playbook:undefined},practice],[card,null],[{...card,id:'other'},practice],[card,{...practice,version:'retired'}],[card,{...practice,results:['']}]] as const){
  expect(drillGuidePage(candidate,draft as DrillPractice|null,0)).toBeNull();expect(drillCourtGuideHtml(candidate,draft as DrillPractice|null,0)).toBe('');expect(moveDrillGuide(candidate,draft as DrillPractice|null,0,1)).toBe(0)
 }
})
it('escapes instructions, labels, and cues before rendering',()=>{
 const mode={...card.playbook!.versions[0],label:'<img>',steps:['<script>alert(1)</script>']}
 const dangerous:LevelUpCard={...card,cue:'A & B <img>',playbook:{...card.playbook!,versions:[mode,card.playbook!.versions[1]]}},markup=drillCourtGuideHtml(dangerous,newDrillPractice(dangerous),0)
 expect(markup).toContain('&lt;script&gt;');expect(markup).toContain('&lt;img&gt;');expect(markup).toContain('A &amp; B');expect(markup).not.toContain('<script>');expect(markup).not.toContain('<img>')
})
it('preserves raw zero, blank and recorded counts during navigation',()=>{
 const practice={...newDrillPractice(card,'pressure')!,results:['0','','8']},before=structuredClone(practice)
 for(let i=0;i<4;i++){drillCourtGuideHtml(card,practice,i);moveDrillGuide(card,practice,i,1)}
 expect(practice).toEqual(before);expect(drillSessionNote(card,practice,'')).toContain('R1 0/10; R3 8/10')
})
it('exposes an atomic instruction status and focusable bounded controls',()=>{
 const practice=newDrillPractice(card)!,first=drillCourtGuideHtml(card,practice,0),last=drillCourtGuideHtml(card,practice,3)
 expect(first).toContain('role="status" aria-live="polite" aria-atomic="true"');expect(first).toContain('Instruction 1 of 4')
 expect(first).toMatch(/aria-label="Previous instruction"[^>]*aria-disabled="true"/);expect(last).toMatch(/aria-label="Next instruction"[^>]*aria-disabled="true"/)
 expect(first).not.toContain(' disabled');expect(first).not.toContain('type="submit"')
})
it('keeps private session evidence and the frozen save unchanged while paging',()=>{
 const practice={...newDrillPractice(card,'pressure')!,results:['0','','8']},note=drillSessionNote(card,practice,'Recover first.'),saved=freezeTrainingSave(card,2,note,'partner','tight',120,'level-up-11111111-1111-4111-8111-111111111111','2026-11-22T12:00:00Z'),before=structuredClone(saved)
 for(let i=0;i<8;i++)moveDrillGuide(card,practice,i%4,1)
 expect(saved).toEqual(before);expect(saved.sharedWithCoach).toBe(false);expect(saved).not.toHaveProperty('courtPosition');expect(saved).not.toHaveProperty('tiqGrowth')
})
