import {trainingIdentity} from './training-identity'
import type {LevelUpCard} from '../../lib/level-up/level-up-types'
import type {TrainingSave,TrainingSession} from './level-up-data'
export {TrainingClock,trainingTime} from './training-clock'
export function trainingWorkType(card:LevelUpCard):TrainingSave['workType']{return card.category==='mental-routine'?'mental':['strength-stability','conditioning','mobility-stretch','recovery-reset'].includes(card.category)?'physical':'court'}
// Same category/context mapping as the website player-live-workbench.
export function trainingContexts(card:LevelUpCard){return trainingWorkType(card)==='court'?['alone','partner','singles','doubles']:['alone']}
export function initialTrainingContext(card:LevelUpCard){if(trainingWorkType(card)!=='court')return 'alone';if(card.category==='doubles-drill'||card.tags.includes('doubles')||card.tags.includes('doubles-communication'))return 'doubles';if(card.category==='partner-drill'||card.equipment.includes('partner'))return 'partner';return 'alone'}
export function trainingSelection(cards:LevelUpCard[],query:string,setting:string,maxMinutes=Infinity){
 const q=query.trim().toLocaleLowerCase()
 return cards.filter(card=>card.durationMinutes<=maxMinutes
  &&(!setting||card.setting.some(place=>place===setting))
  &&(!q||[card.title,card.useWhen,card.tennisGoal,card.pack,...card.tags].join(' ').toLocaleLowerCase().includes(q)))
}
export function freezeTrainingSave(card:LevelUpCard,rating:number,note:string,context:string,feeling:string,seconds:number,id:string,completedAt:string,identitySlug=''):Readonly<TrainingSave>{
 if((identitySlug&&!trainingIdentity(identitySlug))||!card.id||!Number.isInteger(rating)||rating<0||rating>5||note.length>700||!trainingContexts(card).includes(context)||!['ready','tight','tired','nervous'].includes(feeling)||!Number.isInteger(seconds)||seconds<0||seconds>7200||!/^level-up-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)||!Number.isFinite(Date.parse(completedAt)))throw Error('Choose a proof rating and check your session details.')
 return Object.freeze({...(identitySlug?{identitySlug}:{}),id,focusId:card.id,focusTitle:card.title,drillTitle:card.title,cardId:card.id,workType:trainingWorkType(card),rating,note:note.trim(),context,feeling,elapsedSeconds:seconds,completedAt:new Date(completedAt).toISOString(),accessMode:'player_plus',sharedWithCoach:false})
}
export function trainingProgress(rows:TrainingSession[]){const seconds=rows.reduce((sum,r)=>sum+r.elapsedSeconds,0);return {count:rows.length,seconds}}
