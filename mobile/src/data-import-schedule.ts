import {getScheduleMatchReviewNotes,type DataAssistScheduleParsedDraft} from '../../lib/data-assist-schedule-parser'

export type ScheduleDates = Record<string,string>
export const scheduleCorrectionFields = [
 {key:'externalMatchId',note:'Check match ID',label:'Match ID',type:'text'},
 {key:'matchTime',note:'Check time',label:'Match time',type:'time'},
 {key:'homeTeam',note:'Check teams',label:'Home team',type:'text'},
 {key:'awayTeam',note:'Check teams',label:'Visiting team',type:'text'},
 {key:'facility',note:'Check site',label:'Court / location',type:'text'},
] as const
export type ScheduleCorrectionField = typeof scheduleCorrectionFields[number]['key']
export type ScheduleCorrections = Record<string,Partial<Record<ScheduleCorrectionField,string>>>
export function scheduleTime(value:string){
 const m=/^(\d{2}):(\d{2})$/.exec(value)
 if(!m||Number(m[1])>23||Number(m[2])>59)throw Error('Choose a valid match time.')
 const hour=Number(m[1]);return `${hour%12||12}:${m[2]} ${hour<12?'AM':'PM'}`
}
export function canCorrectScheduleField(match:DataAssistScheduleParsedDraft['matches'][number],field:ScheduleCorrectionField){
 const rule=scheduleCorrectionFields.find(f=>f.key===field)
 return Boolean(rule&&match.reviewNotes.includes(rule.note)&&(field!=='homeTeam'&&field!=='awayTeam'||!match[field]))
}
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
export function reviewedSchedule(source:DataAssistScheduleParsedDraft,dates:ScheduleDates,corrections:ScheduleCorrections={}){
 for(const key of Object.keys(dates))if(!/^(0|[1-9]\d*)$/.test(key)||!source.matches[Number(key)]?.reviewNotes.includes('Check date'))throw Error('Refresh this schedule before correcting its dates.')
 for(const [key,fields] of Object.entries(corrections)){
  if(!/^(0|[1-9]\d*)$/.test(key)||!source.matches[Number(key)]||!fields||typeof fields!=='object'||Array.isArray(fields))throw Error('Refresh this schedule before correcting its details.')
  for(const [field,value] of Object.entries(fields))if(!scheduleCorrectionFields.some(f=>f.key===field)||!canCorrectScheduleField(source.matches[Number(key)],field as ScheduleCorrectionField)||typeof value!=='string'||value.length>500||/[\x00-\x1f\x7f]/.test(value))throw Error('Check the highlighted schedule details.')
 }
 const matches=source.matches.map((m,i)=>{
  const matchDate=Object.hasOwn(dates,String(i))?scheduleDate(dates[String(i)]):m.matchDate
  const updated={...m,matchDate}
  for(const [field,value] of Object.entries(corrections[String(i)]||{})){
   const key=field as ScheduleCorrectionField,clean=value.trim()
   if(key==='externalMatchId'&&!/^\d{10}$/.test(clean))throw Error('Enter the 10-digit match ID from the schedule.')
   updated[key]=key==='matchTime'?scheduleTime(clean):clean
  }
  return {...updated,reviewNotes:getScheduleMatchReviewNotes(updated)}
 })
 return {...source,matches,matchCount:matches.length}
}
export function scheduleReady(source:DataAssistScheduleParsedDraft,dates:ScheduleDates,corrections:ScheduleCorrections={}){
 try{return reviewedSchedule(source,dates,corrections).matches.every(m=>m.reviewNotes.length===0)}catch{return false}
}
