import {getScheduleMatchReviewNotes,type DataAssistScheduleParsedDraft} from '../../lib/data-assist-schedule-parser'

export type ScheduleDates = Record<string,string>
// Keep only the existing schedule schema; contact fields and unknown payload keys never leave this review.
export function readReviewSchedule(value:Record<string,unknown>):DataAssistScheduleParsedDraft|undefined{
 try{
  const str=(v:unknown,max=500)=>{if(typeof v!=='string'||v.length>max)throw Error();return v}
  const num=(v:unknown)=>{if(typeof v!=='number'||!Number.isFinite(v))throw Error();return v}
  const list=(v:unknown)=>{if(!Array.isArray(v)||v.length>100)throw Error();return v.map(x=>str(x,2000))}
  if(value.draftKind!=='schedule'||!Array.isArray(value.matches)||!value.matches.length||value.matches.length>100)return
  const provider=str(value.provider) as DataAssistScheduleParsedDraft['provider']
  if(!['disabled','manual_review','mock_review','tesseract','tennislink_export','future_ocr'].includes(provider))return
  const matches=value.matches.map(v=>{
   if(!v||typeof v!=='object'||Array.isArray(v))throw Error()
   const m=v as Record<string,unknown>
   return {externalMatchId:str(m.externalMatchId),matchDate:str(m.matchDate),matchTime:str(m.matchTime),homeTeam:str(m.homeTeam),awayTeam:str(m.awayTeam),facility:str(m.facility),confidenceScore:num(m.confidenceScore),reviewNotes:list(m.reviewNotes)}
  })
  if(value.matchCount!==matches.length)return
  return {draftKind:'schedule',teamName:str(value.teamName),leagueName:str(value.leagueName),flight:str(value.flight),ustaSection:str(value.ustaSection),districtArea:str(value.districtArea),matches,matchCount:matches.length,parserWarnings:list(value.parserWarnings),rawTextPreview:str(value.rawTextPreview,100000),sourceScreenshotCount:num(value.sourceScreenshotCount),provider,confidenceScore:num(value.confidenceScore)}
 }catch{return}
}
export function scheduleDate(value:string){
 const m=/^(20\d{2})-(\d{2})-(\d{2})$/.exec(value)
 if(!m)throw Error('Choose a valid match date between 2000 and 2099.')
 const y=Number(m[1]),month=Number(m[2]),day=Number(m[3]),d=new Date(Date.UTC(y,month-1,day))
 if(d.getUTCFullYear()!==y||d.getUTCMonth()!==month-1||d.getUTCDate()!==day)throw Error('Choose a valid match date.')
 return `${month}/${day}/${y}`
}
export function reviewedSchedule(source:DataAssistScheduleParsedDraft,dates:ScheduleDates){
 for(const key of Object.keys(dates))if(!/^(0|[1-9]\d*)$/.test(key)||!source.matches[Number(key)]?.reviewNotes.includes('Check date'))throw Error('Refresh this schedule before correcting its dates.')
 const matches=source.matches.map((m,i)=>{
  const matchDate=Object.hasOwn(dates,String(i))?scheduleDate(dates[String(i)]):m.matchDate
  return {...m,matchDate,reviewNotes:getScheduleMatchReviewNotes({...m,matchDate})}
 })
 return {...source,matches,matchCount:matches.length}
}
export function scheduleReady(source:DataAssistScheduleParsedDraft,dates:ScheduleDates){
 try{return reviewedSchedule(source,dates).matches.every(m=>m.reviewNotes.length===0)}catch{return false}
}
