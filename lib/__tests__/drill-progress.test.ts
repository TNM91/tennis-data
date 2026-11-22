import {expect,it} from 'vitest'
import {LEVEL_UP_CARDS} from '../level-up/level-up-cards'
import type {TrainingSession} from '../../mobile/src/level-up-data'
import {drillSessionNote,newDrillPractice} from '../../mobile/src/drill-playbook'
import {drillHistoryKey,drillHistoryChoices,selectDrillHistory,readDrillEvidence,recentDrillResults,drillHistoryControlsHtml,drillComparisonHtml} from '../../mobile/src/drill-progress'
import {trainingHistoryHtml} from '../../mobile/src/level-up-view'
const card=LEVEL_UP_CARDS.find(card=>card.id==='return-depth-lane')!
const row=(id='one',version:'control'|'pressure'='pressure',results=['0','','8'],extra:Partial<TrainingSession>={}):TrainingSession=>({id,playerUserId:'owner',cardId:card.id,focusId:card.id,focusTitle:card.title,drillTitle:card.title,rating:2,note:extra.note??drillSessionNote(card,{...newDrillPractice(card,version)!,results},'Keep depth.'),elapsedSeconds:300,completedAt:'2026-11-22T12:00:00Z',context:'partner',feeling:'ready',accessMode:'player_plus',sharedWithCoach:false,workType:'court',...extra})
it('reads the exact saved count format for every playbook and version',()=>{
 for(const card of LEVEL_UP_CARDS.filter(card=>card.playbook))for(const mode of card.playbook!.versions){const practice=newDrillPractice(card,mode.id)!;practice.results[0]='0';practice.results[mode.rounds-1]='8';const saved=row('one',mode.id,[],{cardId:card.id,note:drillSessionNote(card,practice,'note')});expect(readDrillEvidence(card,saved)).toMatchObject({version:mode.id,clean:8,attempts:20,recorded:2,rounds:mode.rounds,percent:40})}
})
it('keeps zero and unfinished rounds distinct and reads an optional practice target',()=>{
 expect(readDrillEvidence(card,row())).toMatchObject({clean:8,attempts:20,recorded:2,percent:40})
 expect(readDrillEvidence(card,row('zero','pressure',['0','','']))).toMatchObject({clean:0,attempts:10,recorded:1,percent:0})
 expect(readDrillEvidence(card,row('empty','pressure',['','','']))).toBeNull()
 const saved=row();saved.note=drillSessionNote(card,{...newDrillPractice(card,'pressure')!,results:['0','','8']},'Private note.','Practice target: 8 deep returns');expect(readDrillEvidence(card,saved)?.clean).toBe(8)
})
it('rejects inconsistent, duplicate, reordered or out-of-range count text without guessing',()=>{
 const saved=row(),text=saved.note.split('\n\n')[0]
 for(const bad of [text.replace('8/20','9/20'),text.replace('R3 8','R1 8'),text.replace('R3 8','R4 8'),text.replace('R1 0/10; R3 8/10','R3 8/10; R1 0/10'),text.replace('R3 8/10','R3 11/10'),text.replace('R1 0/10','R1 00/10'),text.replace('R1 0/10','R1 -1/10'),text.replace('R3 8/10','R3 8/20'),text.replace('Add pressure','Different version'),text.replace('Deep returns','Different task'),'My note\n\n'+text,text+'.'])expect(readDrillEvidence(card,{...saved,note:bad})).toBeNull()
})
it('does not infer counts for a retired, mismatched or untracked drill',()=>{
 expect(readDrillEvidence(card,{...row(),cardId:'retired'})).toBeNull();expect(readDrillEvidence({...card,playbook:undefined},row())).toBeNull();expect(readDrillEvidence(card,{...row(),note:'8/10 today'})).toBeNull()
 expect(drillHistoryKey({...row(),cardId:''})).toBe(card.id);expect(readDrillEvidence(card,{...row(),cardId:''})?.percent).toBe(40)
})
it('compares only the latest version and context, ordered by time and capped at three',()=>{
 const sessions=[row('old','pressure',['1','',''],{completedAt:'2026-11-18T12:00:00Z'}),row('control','control',['8','',''],{completedAt:'2026-11-22T11:00:00Z'}),row('doubles','pressure',['8','',''],{context:'doubles',completedAt:'2026-11-22T11:30:00Z'}),row('latest'),row('earlier','pressure',['2','',''],{completedAt:'2026-11-21T12:00:00Z'}),row('third','pressure',['3','',''],{completedAt:'2026-11-20T12:00:00Z'}),row('other','pressure',['9','',''],{cardId:'wall-rally-rhythm'})],before=structuredClone(sessions)
 expect(recentDrillResults(sessions,card).map(({row})=>row.id)).toEqual(['latest','earlier','third']);expect(sessions).toEqual(before)
})
it('does not present older counts as the latest when the latest session has no usable counts',()=>{
 expect(recentDrillResults([row('latest','pressure',['','','']),row('older','pressure',['8','',''],{completedAt:'2026-11-21T12:00:00Z'})],card)).toEqual([])
 expect(drillComparisonHtml([row('latest','pressure',['','',''])],card.id)).toContain('Round results are not available for the latest session.')
})
it('retains a selected drill with no loaded rows and leaves unknown saved sessions in the full log',()=>{
 const retired=row('old','pressure',['8','',''],{cardId:'retired'}),sessions=[retired,row()]
 expect(selectDrillHistory(sessions,'')).toBe(sessions);expect(selectDrillHistory(sessions,card.id)).toHaveLength(1);expect(drillHistoryChoices([retired],card.id)).toMatchObject([{card:{id:card.id},count:0}]);expect(drillComparisonHtml([retired],card.id)).toBe('')
})
it('renders escaped counts, dates and context without changing ratings or private notes',()=>{
 const saved=row('one','pressure',['0','','8'],{context:'<img>',note:row().note+'\n\n<img src=x>'}),before=structuredClone(saved),markup=drillComparisonHtml([saved],card.id)
 expect(markup).toContain('8 / 20 deep returns');expect(markup).toContain('40%');expect(markup).toContain('2 of 3 rounds logged');expect(markup).toContain('&lt;img&gt;');expect(markup).not.toContain('<img');expect(markup).not.toContain('src=x');expect(markup).toContain('do not change your TiQ rating');expect(saved).toEqual(before)
 expect(trainingHistoryHtml([saved])).toContain('&lt;img src=x&gt;');expect(trainingHistoryHtml([saved])).toContain('data-history-version="pressure"');expect(trainingHistoryHtml([saved])).toContain('<dd>2 / 5</dd>')
})
it('offers a named drill filter and keeps legacy history usable',()=>{
 const markup=drillHistoryControlsHtml([row()],card.id)
 expect(markup).toContain('for="training-history-drill"');expect(markup).toContain('value="return-depth-lane" selected');expect(markup).toContain('All drills');expect(drillHistoryControlsHtml([], '')).toBe('')
 expect(drillHistoryControlsHtml(Array.from({length:80},(_,i)=>row(String(i))),card.id)).toContain('Filtered from your latest 80 saved sessions across all drills.')
 expect(drillComparisonHtml([],card.id)).toBe('');expect(trainingHistoryHtml([row('legacy','pressure',[],{note:'Original private note.'})])).toContain('Original private note.')
})
