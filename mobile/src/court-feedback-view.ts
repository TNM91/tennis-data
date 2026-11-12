import {courtFeedbackKeys,type CourtFeedback} from './personal-match-data'

export const courtFeedbackLabels={surface:'Surface condition',lighting:'Lighting',court_time:'Ease of getting court time'}

export function courtFeedbackList(feedback:CourtFeedback){
 const rows=courtFeedbackKeys.flatMap(key=>{
  const rating=feedback[key]
  return rating===null?[]:[`<div><dt>${courtFeedbackLabels[key]}</dt><dd>
   <span aria-hidden="true">${'★'.repeat(rating)}${'☆'.repeat(5-rating)}</span>
   <span class="sr-only">${rating} out of 5 stars</span></dd></div>`]
 }).join('')
 return `<dl class="court-rating-list">${rows}</dl>`
}
