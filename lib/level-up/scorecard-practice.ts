export const scorecardFocusOptions = [
  {title:'Serve placement',cardId:'serve-target-ladder',target:'Hit the chosen serve target 6 times in 10 attempts.'},
  {title:'Return depth',cardId:'return-depth-lane',target:'Land 6 of 8 returns in the chosen lane and recover to ready.'},
  {title:'Rally consistency',cardId:'crosscourt-consistency',target:'Rally 8 crosscourt balls in a row with time to recover.'},
  {title:'Doubles first move',cardId:'doubles-return-first-move',target:'Follow the return and partner call on 6 of 8 points.',doublesOnly:true},
] as const

export type ScorecardPractice = {cardId:typeof scorecardFocusOptions[number]['cardId'];target:string}
export const matchTargetLimit = 160

export function readScorecardPractice(value:unknown):ScorecardPractice {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Choose a practice drill and target.')
  const {cardId,target,...rest} = value as Record<string,unknown>
  const focus = scorecardFocusOptions.find(option=>option.cardId===cardId)
  if (!focus || Object.keys(rest).length || typeof target !== 'string' || target.length > matchTargetLimit ||
      !target.trim() || /\p{Cc}/u.test(target)) throw Error('Choose a practice drill and target.')
  return {cardId:focus.cardId,target:target.trim()}
}

export function isScorecardPracticeEntry(entry:{kind:string;recurrenceRule:string}) {
  return entry.kind === 'practice' && !entry.recurrenceRule
}
