import {buildMyLabWeeklyImprovementPlan,mergeMyLabLevelUpProofRecords} from '../../lib/level-up/mylab-proof-continuity'
import type {LevelUpSession} from '../../lib/level-up-sessions'
import type {TrainingSession} from './level-up-data'
import {LEVEL_UP_CARDS} from '../../lib/level-up/level-up-cards'
export type LabTrainingOverview={completed:number;hasProof:boolean;cardId:string;identitySlug:string;text:Record<string,string>}
// Reuse the website's account-proof merge, card resolution, Monday week and next-rep rules.
export function labTrainingOverview(rows:TrainingSession[],now=new Date()):LabTrainingOverview{
 const sessions:LevelUpSession[]=rows.map(row=>({...row,coachUserId:null,studentLinkId:null,assignmentId:null,identitySlug:row.identitySlug||'',workType:row.workType as LevelUpSession['workType'],context:row.context as LevelUpSession['context'],feeling:row.feeling as LevelUpSession['feeling'],accessMode:row.accessMode as LevelUpSession['accessMode'],sessionJson:{cardId:row.cardId},starterRead:null,createdAt:row.completedAt,updatedAt:row.completedAt}))
 const proofs=mergeMyLabLevelUpProofRecords([],sessions),plan=buildMyLabWeeklyImprovementPlan(proofs,now),latest=proofs[0]
 const card=LEVEL_UP_CARDS.find(c=>c.id===plan.cardId)
 return {completed:plan.completedSessions,hasProof:!!latest,cardId:card?.id||'',identitySlug:plan.identitySlug,text:{TIQ_REP_TITLE:plan.cardTitle,TIQ_REP_NOTE:card?plan.nextAction:'Choose a current training card to build on this saved proof.',TIQ_REP_CTA:card?plan.nextCta:'Choose a training card',TIQ_CARD_TITLE:latest?.cardTitle||'',TIQ_PROOF_LABEL:latest?`${latest.rating}/5 proof`:'',TIQ_PROOF_DATE:latest?new Date(latest.completedAt).toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}):'',TIQ_PROOF_NOTE:latest?.note||'Your proof is ready for the next cleaner rep.',TIQ_PLAN_LABEL:plan.modeLabel,TIQ_PLAN_WHY:card?plan.why:'Your saved card is no longer in the current training catalog.',TIQ_PROOF_TARGET:card?plan.proofTarget:'Review your saved proof score before choosing another card.',TIQ_TREND:plan.trendLabel}}
}
