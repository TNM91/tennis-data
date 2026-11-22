import {expect,it} from 'vitest'
import {LEVEL_UP_CARDS} from '../level-up/level-up-cards'
import {tiqSkills} from '../tiq-assessment-skills'
import {drillPlaybook} from '../level-up/drill-playbooks'
import {newDrillPractice,drillRoundTotals,drillSessionNote,drillTally,drillEvidence,drillSetupHtml,drillResultsHtml} from '../../mobile/src/drill-playbook'
import {freezeTrainingSave} from '../../mobile/src/level-up-model'

const card=LEVEL_UP_CARDS.find(card=>card.id==='return-depth-lane')!
it('provides original, measurable setup and both versions for each TiQ assessment drill',()=>{
 for(const skill of tiqSkills){const drill=LEVEL_UP_CARDS.find(card=>card.id===skill.drill.id)!,book=drill.playbook!;expect(book).toBeDefined();expect(book.setup.length).toBeGreaterThanOrEqual(2);expect(book.countRule.length).toBeGreaterThan(40);expect(book.versions.map(mode=>mode.id)).toEqual(['control','pressure']);expect(drill.routine).toEqual(book.versions[0].steps)
  for(const mode of book.versions){expect(mode.reps).toBe(10);expect(mode.rounds).toBeGreaterThanOrEqual(2);expect(mode.steps).toHaveLength(4);expect(mode.focus.length).toBeGreaterThan(10)}
 }
 expect(drillPlaybook('__proto__')).toBeUndefined();expect(drillPlaybook('retired-card')).toBeUndefined()
 expect(drillPlaybook('serve-target-call')!.setup.join(' ')).toContain('diagonal service box')
 expect(drillPlaybook('split-step-rhythm')!.versions[1].requiresPartner).toBe(true)
})
it('keeps blank rounds unrecorded and distinguishes a real zero from an unfinished round',()=>{
 const practice=newDrillPractice(card)!;expect(drillTally(card,practice)).toBe('No round results entered.');expect(drillEvidence(card,practice)).toBe('')
 practice.results=['0','','8'];expect(drillRoundTotals(card,practice)).toMatchObject({recorded:2,clean:8,attempts:20,rounds:[{round:1,count:0},null,{round:3,count:8}]});expect(drillTally(card,practice)).toBe('2 of 3 rounds recorded · 8/20 deep returns')
 expect(drillSessionNote(card,practice,'Keep <finish> high.')).toBe('Build control · Deep returns: R1 0/10; R3 8/10. Total 8/20.\n\nKeep <finish> high.')
})
it.each(['-1','11','1.5','1e1','00',' 5 ','NaN'])('rejects an invalid raw count %s without changing the draft',raw=>{
 const practice={...newDrillPractice(card)!,results:[raw,'','']},before=structuredClone(practice)
 expect(()=>drillSessionNote(card,practice,'Keep the note.')).toThrow('Use a whole number from 0 to 10 for round 1.');expect(practice).toEqual(before)
})
it('rejects stale card/version/round identities and a note that cannot fit without truncation',()=>{
 const practice={...newDrillPractice(card,'pressure')!,results:['9','8','7']}
 expect(()=>drillSessionNote({...card,id:'other'},practice,'')).toThrow('Review the current drill')
 expect(()=>drillSessionNote(card,{...practice,results:['9']},'')).toThrow('Review the current drill')
 expect(()=>drillSessionNote(card,practice,'x'.repeat(700))).toThrow('Shorten your note')
 expect(practice.results).toEqual(['9','8','7'])
 expect(drillSessionNote(card,newDrillPractice(card),'  Old note  ')).toBe('Old note')
 expect(drillSessionNote(card,practice,'  Good depth. ','Practice target: 7 deep returns')).toContain('Practice target: 7 deep returns\n\nAdd pressure · Deep returns: R1 9/10; R2 8/10; R3 7/10. Total 24/30.\n\nGood depth.')
})
it('uses the existing immutable private session contract, keeping counts separate from the self-rating',()=>{
 const practice={...newDrillPractice(card,'pressure')!,results:['9','8','7']},note=drillSessionNote(card,practice,'Recover first.'),saved=freezeTrainingSave(card,2,note,'partner','ready',180,'level-up-11111111-1111-4111-8111-111111111111','2026-11-22T12:00:00Z')
 practice.results[0]='0';expect(saved.note).toContain('R1 9/10');expect(saved.rating).toBe(2);expect(saved.sharedWithCoach).toBe(false);expect(Object.isFrozen(saved)).toBe(true);expect(saved).not.toHaveProperty('tiqGrowth');expect(saved).not.toHaveProperty('assignmentId')
})
it('escapes setup and draft values, exposes the selected version, and locks uncertain results',()=>{
 const dangerous={...card,playbook:{...card.playbook!,setup:['<img src=x>','A & B'],countRule:'<script> no',countLabel:'<target>'}},practice={...newDrillPractice(card,'pressure')!,results:['" onfocus="evil','0','']}
 const setup=drillSetupHtml(dangerous,practice,true),fields=drillResultsHtml(dangerous,practice,true)
 expect(setup).toContain('&lt;img src=x&gt;');expect(setup).toContain('value="pressure" selected');expect(setup).not.toContain('<img')
 expect(fields).toContain('&quot; onfocus=&quot;evil');expect(fields).toContain('fieldset class="training-rounds" disabled');expect(fields).toContain('value="0"');expect(fields).not.toContain('<script>');expect(fields).toContain('Check the round counts below.')
 const legacy={...card,playbook:undefined};expect(newDrillPractice(legacy)).toBeNull();expect(drillSetupHtml(legacy,null,true)).toBe('');expect(drillResultsHtml(legacy,null,false)).toBe('')
})
