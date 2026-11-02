import type {CaptainData} from '../../mobile/src/captain-data'
import type {MatchCenter,MatchDaySnapshot} from '../../mobile/src/captain-match-center-data'

export const captainScope={teamName:'North Court Aces',leagueName:'City Evening Tennis League',flight:'4.0 Doubles'}
export const captainMatch={id:'fixture-one',date:'2026-11-12',opponent:'Riverside Racquet Club',time:'6:30 PM',facility:'North Park Tennis Center · Courts 7–10'}
export function captainCenterFixture():MatchCenter{
 const roster=[{key:'alex',playerId:'alex',name:'Alex Rivera'},{key:'jordan',playerId:'jordan',name:'Jordan Lee'}]
 return {
  fixture:{id:captainMatch.id,date:captainMatch.date,time:captainMatch.time,home:captainScope.teamName,away:captainMatch.opponent,facility:captainMatch.facility,status:'Scheduled',score:''},
  today:'2026-11-02',checkedAt:'2026-11-02T12:00:00Z',
  lineup:{ok:true,scope:captainScope,match:{id:captainMatch.id,date:captainMatch.date,opponent:captainMatch.opponent},version:'saved-one',sent:false,roster,plan:{courts:[{id:'d1',label:'Doubles 1',slotType:'doubles',defaulted:false,players:['alex','jordan']}],notes:'Private captain note',teamNotes:'Warm up together',location:captainMatch.facility,directions:'North entrance',arrivalTime:'6 PM'}},
  replies:{selection:'draft',dayScopedAnswersOmitted:false,people:roster.map(p=>({key:p.key,name:p.name,status:p.key==='alex'?'available':'waiting',source:'player',selected:true}))},
  publication:{scope:captainScope,fixtureId:captainMatch.id,matchDate:captainMatch.date,opponent:captainMatch.opponent,draftVersion:'saved-one',expectedCardToken:'synthetic-private-card-token',proposal:{canShare:true,reason:'',arrivalTime:'6 PM',facility:captainMatch.facility,lineup:[{label:'Doubles 1',players:['Alex Rivera','Jordan Lee']}]},shared:{active:true,messageId:'shared-one',lineupId:'lineup-one',lineup:[{label:'Doubles 1',players:['Alex Rivera','Jordan Lee']}],confirmedCount:0,totalCount:1,courts:[],canFinalize:false,alreadyFinal:false,pendingFinal:false}}
 }
}
export function captainSnapshotFixture():CaptainData{
 return {scope:captainScope,checkedAt:'2026-11-02T12:00:00Z',moreMatches:false,moreDrafts:false,roster:[{id:'alex',playerId:'alex',name:'Alex Rivera'},{id:'jordan',playerId:'jordan',name:'Jordan Lee'}],matches:[captainMatch,{...captainMatch,id:'fixture-two',date:'2026-11-19',opponent:'South Court Rallies'}],drafts:[]}
}
export function captainDayFixture(center:MatchCenter):MatchDaySnapshot{
 return {publication:structuredClone(center.publication),replacement:{currentChange:null,canReplace:false,canSupersede:false,reason:'No replacement is needed.'},arrivals:{available:true,reason:'Only explicit check-ins on this exact shared card are shown. Missing check-ins do not mean a player is absent.',here:1,onMyWay:0,runningLate:1,people:[{profileId:'alex',name:'Alex Rivera',court:'Doubles 1',status:'here'},{profileId:'jordan',name:'Jordan Lee',court:'Doubles 1',status:'running_late'}]},checkedAt:center.checkedAt}
}
