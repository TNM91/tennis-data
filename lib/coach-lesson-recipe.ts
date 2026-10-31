import {COACH_ASSIGNMENT_TEMPLATES} from './coach-assignment-templates'
import {COACH_SESSION_PRESETS,buildSessionPresetAssignment,COACH_LESSON_BLOCKS} from './coach-workspace'
import {COACH_LEVEL_UP_HANDOFF_PACKS,coachPracticePack} from './coach-practice-packs'
import {LEVEL_UP_CARDS} from './level-up/level-up-cards'
import {PLAYER_DEVELOPMENT_IDENTITIES} from './player-development'
export type CoachLessonRecipe={source:'custom'|'template'|'session'|'pack'|'card'|'identity';key:string;week:number;lessonDateTime:string;lessonLocation:string;lessonFocus:string}
export function readCoachLessonRecipe(value:unknown):CoachLessonRecipe{
 if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Invalid lesson')
 const r=value as Record<string,unknown>
 if(Object.keys(r).some(k=>!['source','key','week','lessonDateTime','lessonLocation','lessonFocus'].includes(k)))throw Error('Unexpected lesson field')
 const text=(key:string,max:number)=>{if(typeof r[key]!=='string'||(r[key] as string).length>max)throw Error('Invalid lesson field');return (r[key] as string).trim()}
 const source=text('source',20) as CoachLessonRecipe['source'],key=text('key',160),week=r.week
 if(!['custom','template','session','pack','card','identity'].includes(source)||typeof week!=='number'||!Number.isInteger(week)||week<1||week>52)throw Error('Invalid lesson source')
 const lessonDateTime=text('lessonDateTime',16)
 if(lessonDateTime&&(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(lessonDateTime)||!Number.isFinite(Date.parse(lessonDateTime))||new Date(lessonDateTime+'Z').toISOString().slice(0,16)!==lessonDateTime||Number(lessonDateTime.slice(11,13))>23||Number(lessonDateTime.slice(14))>59))throw Error('Invalid lesson date')
 const recipe={source,key,week,lessonDateTime,lessonLocation:text('lessonLocation',240),lessonFocus:text('lessonFocus',1000)}
 buildCoachLessonRecipe(recipe)
 return recipe
}
export function buildCoachLessonRecipe(r:CoachLessonRecipe):{title:string;focus:string;instructions:string;evidence:string;assignment:Record<string,unknown>}{
 let title='',focus='',instructions='',evidence='',assignment:Record<string,unknown>={}
 if(r.source==='template'){const t=COACH_ASSIGNMENT_TEMPLATES.find(t=>t.id===r.key);if(!t)throw Error('Unknown template');({title,focus}=t);instructions=t.detail;assignment={...t.assignment,templateId:t.id}}
 if(r.source==='session'){if(!COACH_SESSION_PRESETS.some(t=>t.id===r.key))throw Error('Unknown session');const t=buildSessionPresetAssignment(r.key);({title,focus}=t);instructions=t.detail;assignment={sessionPresetId:r.key,tracker:t.tracker,playerPlusPrompt:t.prompt,lessonBlocks:COACH_LESSON_BLOCKS}}
 if(r.source==='pack'){const t=COACH_LEVEL_UP_HANDOFF_PACKS.find(t=>t.id===r.key),pack=coachPracticePack(r.key);if(!t||!pack)throw Error('Unknown pack');title=t.assignmentTitle;focus=t.focus;instructions=t.detail;evidence=pack.items.map(i=>i.proof).join(' • ');assignment={levelUpPackId:pack.id,levelUpPackTitle:pack.title,levelUpPack:pack,sourcePack:'coach-level-up-handoff',tracker:pack.items.map(i=>i.proof)}}
 if(r.source==='card'){const c=LEVEL_UP_CARDS.find(c=>c.id===r.key&&c.assignable);if(!c)throw Error('Unknown practice');title=c.title;focus=c.tennisGoal;instructions=c.routine.join('\n');evidence=c.proof;assignment={cardId:c.id,levelUpCardTitle:c.title,proofRequired:c.proof,tracker:[c.proof,...c.qualityChecks??[]].slice(0,4),playerPlusPrompt:c.cue}}
 if(r.source==='identity'){const identity=PLAYER_DEVELOPMENT_IDENTITIES.find(i=>i.slug===r.key),lesson=identity?.coachLessons.find(l=>l.week===r.week);if(!identity||!lesson)throw Error('Unknown identity lesson');title=lesson.focus;focus=lesson.objective;instructions=lesson.blocks.join('\n');evidence=lesson.homework;assignment={identitySlug:identity.slug,lessonWeek:lesson.week,lessonBlocks:lesson.blocks}}
 return {title,focus,instructions,evidence,assignment:{...assignment,...(r.lessonDateTime?{lessonDateTime:r.lessonDateTime,calendarLayer:'coach_student_lesson'}:{}),lessonLocation:r.lessonLocation,lessonFocus:r.lessonFocus}}
}
