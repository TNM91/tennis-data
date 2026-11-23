import type {LevelUpCard} from './level-up-types'
import type {LevelUpTrainingContext,LevelUpWorkType} from '../level-up-sessions'

export function cardTrainingWorkType(card:LevelUpCard):LevelUpWorkType{
 if(card.category==='mental-routine')return 'mental'
 return ['strength-stability','conditioning','mobility-stretch','recovery-reset'].includes(card.category)?'physical':'court'
}

function hasPartner(card:LevelUpCard){
 return card.category==='partner-drill'||card.equipment.includes('partner')||(card.playbook?.players??1)>1
}

export function cardTrainingContext(card:LevelUpCard,workType:LevelUpWorkType=cardTrainingWorkType(card)):LevelUpTrainingContext{
 if(workType==='mental')return 'alone'
 if(workType==='court'&&(card.category==='doubles-drill'||card.tags.includes('doubles')||card.tags.includes('doubles-communication')))return 'doubles'
 return hasPartner(card)?'partner':'alone'
}

export function cardTrainingContexts(workType:LevelUpWorkType,card?:LevelUpCard):LevelUpTrainingContext[]{
 if(workType==='court')return ['alone','partner','singles','doubles']
 // Keep solo available for an explicit adaptation or an older saved session.
 return workType==='physical'&&card&&hasPartner(card)?['alone','partner']:['alone']
}

export function cardTrainingContextHint(card?:LevelUpCard,workType:LevelUpWorkType=card?cardTrainingWorkType(card):'court',roundResults=false){
 if(roundResults&&workType==='physical'&&card&&hasPartner(card)&&card.playbook?.versions.some(mode=>mode.requiresPartner))return 'This drill uses a partner. For solo adaptations, leave the round results blank and save your practice note.'
 return workType==='physical'&&card&&hasPartner(card)?'This drill uses a partner. Choose solo practice only if you have adapted it to work alone.':''
}

const labels:Record<LevelUpTrainingContext,string>={alone:'Solo',partner:'With a partner',singles:'Singles',doubles:'Doubles',coach:'With a coach'}
export function trainingContextLabel(context:string){
 return Object.hasOwn(labels,context)?labels[context as LevelUpTrainingContext]:context
}
