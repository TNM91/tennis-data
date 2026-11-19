import {firstPartyUpdatesFixture} from './mobile-updates-client'
import {navigationOwner} from './mobile-navigation-client'
const notice='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const query=new URL(location.href).searchParams, requested=query.get('coach-activity')
const kind=requested==='checkin'?'checkin':requested==='feedback'?'feedback':'assignment'
const activity={kind,student:kind==='checkin'?'student-one':'training-link',assignment:kind==='checkin'?'assignment-one':kind==='feedback'?'training-finished':'training-serve'}
export const coachingActivityFixture={notice,reads:[] as string[],revoked:false}
if(requested){
 Object.assign(window,{coachingActivityFixture})
 firstPartyUpdatesFixture.coachNotices=[{id:notice,recipient_profile_id:navigationOwner,notification_type:'message',title:'Coaching update',body:'Open your coaching update.',href:'/coach?'+new URLSearchParams({student:activity.student,assignment:activity.assignment,activity:kind})+'#coach-workspace',conversation_id:null,schedule_event_id:null,read_at:null,created_at:'2026-11-19T00:00:00Z'}]
}
export function coachActivityPreview(url:URL,owner:string){
 coachingActivityFixture.reads.push(owner)
 return requested&&!coachingActivityFixture.revoked&&owner===navigationOwner&&url.searchParams.get('notice')===notice
  ?Response.json({ok:true,owner,notice,activity}):Response.json({ok:false},{status:404})
}
