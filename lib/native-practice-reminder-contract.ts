import {practiceId} from './native-player-practice-contract'
import {privateTeamRoomId} from './private-team-contract'
import type {TeamRoomScope} from './team-room'

export const practiceReminderLimit=200
export type PracticeReminderReview={
 updatedAt:string
 date:string
 recipients:{id:string;name:string}[]
 alreadySent:boolean
}
export type PracticeReminderSend={
 requestId:string
 updatedAt:string
 recipientIds:string[]
}

export function practiceReminderHref(scope:TeamRoomScope,eventId:string,requestId:string){
 return '/team-room?'+new URLSearchParams({
  practiceReminder:eventId,team:scope.teamName,league:scope.leagueName,flight:scope.flight,request:requestId,
 }).toString()
}

export function readPracticeReminderDestination(url:URL,eventId:string,roomId:string){
 if(url.pathname!=='/team-room'||url.hash||!url.search.startsWith('?practiceReminder='))return null
 const params=url.searchParams
 const keys=['practiceReminder','team','league','flight','request']
 if([...params.keys()].length!==keys.length||keys.some(key=>params.getAll(key).length!==1))return null
 const teamName=params.get('team')!,leagueName=params.get('league')!,flight=params.get('flight')!
 if(!practiceId(eventId)||params.get('practiceReminder')!==eventId||!practiceId(params.get('request'))||
    !roomId||privateTeamRoomId(leagueName)!==roomId||!teamName.trim()||teamName.length>100||flight.length>60||
    /[\u0000-\u001f\u007f]/.test(teamName+flight))return null
 return {eventId,scope:{teamName,leagueName,flight}}
}
