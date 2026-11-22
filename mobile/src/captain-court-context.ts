import type {LineupEditorData} from '../../lib/native-captain-lineup-contract'

export type WorkingCourtTarget={courtId:string;playerKey:string}

export function locateWorkingCourt(data:LineupEditorData,target:WorkingCourtTarget){
 if(!target.courtId||!target.playerKey)return null
 const courts=data.plan.courts.map((court,index)=>({court,index})).filter(({court})=>court.id===target.courtId)
 if(courts.length!==1||courts[0].court.defaulted)return null
 const seats=courts[0].court.players.flatMap((key,index)=>key===target.playerKey?[index]:[])
 return seats.length===1?{courtIndex:courts[0].index,seatIndex:seats[0]}:null
}

export function workingCourtsForPlayer(data:LineupEditorData,key:string){
 return data.plan.courts.flatMap((court,index)=>{
  if(court.defaulted||!court.players.includes(key))return []
  let detail='Singles'
  if(court.slotType==='doubles'){
   const seats=court.players.flatMap((value,seat)=>value===key?[seat]:[])
   if(seats.length!==1||court.players.length!==2)detail='Doubles · Check the court assignments'
   else{
    const partnerKey=court.players[1-seats[0]],partners=data.roster.filter(player=>player.key===partnerKey)
    detail=!partnerKey?'Doubles · Partner not assigned':partners.length===1?'Doubles · Partner: '+partners[0].name:partners.length?'Doubles · Partner needs review':'Doubles · Partner no longer on roster'
   }
  }
  return [{courtId:court.id,playerKey:key,index,label:court.label,detail}]
 })
}
