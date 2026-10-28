import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import {authorizeNativeCaptainScope} from './native-captain-workspace'
import {buildTeamRoomScopeId,type TeamRoomScope} from './team-room'
import {loadSeasonRoster,seasonToday} from './season-kickoff-server'
import {publicTeamFixture} from './team-fixtures'
import {fixtureId,fixtureWindow,fixtureCancelled,fixtureOpponent} from './team-fixtures-contract'
import {nativeTeamCardId} from './native-captain-publication'
import type {AvailabilityReview,AvailabilityRequest} from './native-availability-contract'
const fail=(status:number)=>({ok:false as const,status})
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const object=(v:unknown):Record<string,unknown>=>v&&typeof v==='object'&&!Array.isArray(v)?v as Record<string,unknown>:{}
async function context(service:SupabaseClient,owner:string,scope:TeamRoomScope){
 const access=await authorizeNativeCaptainScope(service,owner,scope);if(!access.ok)return access
 const room=await service.from('internal_conversations').select('id,status').eq('related_entity_type','team_room').eq('related_entity_id',buildTeamRoomScopeId(scope)).maybeSingle()
 if(room.error)return fail(503);if(!room.data||room.data.status==='closed')return fail(403)
 return {ok:true as const,status:200,roomId:String(room.data.id)}
}
export async function loadNativeAvailabilityReview(service:SupabaseClient,owner:string,scope:TeamRoomScope,id:string){
 if(!fixtureId(id))return fail(400)
 const ctx=await context(service,owner,scope);if(!ctx.ok)return ctx
 let query=service.from('matches').select('id,match_date,match_time,home_team,away_team,facility,status,score,league_name,flight,line_number,match_type').eq('id',id).eq('league_name',scope.leagueName).is('line_number',null)
 query=scope.flight?query.eq('flight',scope.flight):query.or('flight.is.null,flight.eq.')
 const match=await query.maybeSingle();if(match.error)return fail(503)
 const fixture=match.data&&publicTeamFixture(match.data,scope);if(!fixture)return fail(404)
 const today=seasonToday(),window=fixtureWindow(today);if(fixture.date<window.from||fixture.date>window.until)return fail(409)
 const escaped=scope.teamName.replace(/\\/g,'\\\\').replace(/"/g,'\\"')
 let sameQuery=service.from('matches').select('id,match_date,match_time,home_team,away_team,facility,status,score,league_name,flight,line_number,match_type').eq('league_name',scope.leagueName).eq('match_date',fixture.date).is('line_number',null).or(`home_team.eq."${escaped}",away_team.eq."${escaped}"`)
 sameQuery=scope.flight?sameQuery.eq('flight',scope.flight):sameQuery.or('flight.is.null,flight.eq.')
 const [same,cards,roster]=await Promise.all([
  sameQuery.limit(3),
  service.from('internal_messages').select('id,metadata').eq('conversation_id',ctx.roomId).is('deleted_at',null).contains('metadata',{teamRoomCard:true,matchDate:fixture.date}).order('created_at',{ascending:false}).limit(2),
  loadSeasonRoster(service,{team:scope.teamName,league:scope.leagueName,flight:scope.flight,seasonKey:''}),
 ])
 if(same.error||cards.error)return fail(503)
 const fixtures=(same.data||[]).map(row=>publicTeamFixture(row,scope)).filter(Boolean)
 if((same.data?.length||0)>=3||fixtures.length!==1||fixtures[0]!.id!==id||(cards.data?.length||0)>1)return fail(409)
 const card=cards.data?.[0],metadata=object(card?.metadata)
 if(card&&(metadata.matchId&&metadata.matchId!==id||metadata.opponent&&metadata.opponent!==fixtureOpponent(fixture,scope)))return fail(409)
 if(roster.some(p=>!p.name.trim()||p.name.length>120))return fail(409)
 const reason=fixture.date<today||fixtureCancelled(fixture)||/^(completed?|final|played)$/i.test(fixture.status)||!!fixture.score?'This fixture is no longer open for a new availability request.':card?'A match plan is already shared. Use it to collect replies.':''
 const review:AvailabilityReview={ok:true,owner,scope,fixture,roster:roster.map(p=>p.name),token:hash([owner,scope,today,fixture,roster,card||null]),existingCardId:card?String(card.id):'',canPost:!reason,reason}
 return {ok:true as const,status:200,review,roomId:ctx.roomId}
}
/** Exact committed receipt lookup also works after a fixture changes. It never posts or notifies. */
async function receipt(service:SupabaseClient,owner:string,scope:TeamRoomScope,roomId:string,a:AvailabilityRequest){
 const r=await service.from('internal_messages').select('id,metadata').eq('conversation_id',roomId).is('deleted_at',null).contains('metadata',{nativeAvailabilityRequest:{id:a.publicationId,owner}}).limit(2)
 if(r.error)return fail(503);if(!r.data?.length)return fail(404);if(r.data.length!==1)return fail(409)
 const row=r.data[0],m=object(row.metadata),proof=object(m.nativeAvailabilityRequest)
 if(m.teamRoomCard!==true||m.matchId!==a.fixtureId||proof.id!==a.publicationId||proof.owner!==owner||proof.token!==a.expectedCardToken)return fail(409)
 return {ok:true as const,status:200,replayed:true as const,owner,scope,fixtureId:a.fixtureId,publicationId:a.publicationId,messageId:String(row.id),conversationId:roomId}
}
export async function publishNativeAvailability(service:SupabaseClient,owner:string,scope:TeamRoomScope,body:Record<string,unknown>){
 const a=body as unknown as AvailabilityRequest
 if(!fixtureId(a.fixtureId)||!fixtureId(a.publicationId)||typeof a.expectedCardToken!=='string'||!/^[a-f0-9]{64}$/.test(a.expectedCardToken)||body.lookup!==undefined&&typeof body.lookup!=='boolean')return fail(400)
 const ctx=await context(service,owner,scope);if(!ctx.ok)return ctx
 const saved=await receipt(service,owner,scope,ctx.roomId,a);if(saved.ok||saved.status!==404)return saved
 if(body.lookup===true)return saved
 const state=await loadNativeAvailabilityReview(service,owner,scope,a.fixtureId);if(!state.ok)return state
 const r=state.review;if(!r.canPost||r.existingCardId||r.token!==a.expectedCardToken||state.roomId!==ctx.roomId)return fail(409)
 const fixture=r.fixture,bodyText=`Can you play on ${fixture.date} vs ${fixtureOpponent(fixture,scope)}?`,metadata={teamRoomCard:true,cardType:'availability',title:'Match availability',matchId:fixture.id,matchDate:fixture.date,opponent:fixtureOpponent(fixture,scope),matchTime:fixture.time,facility:fixture.facility,lineup:[],lineupVersion:0,nativeAvailabilityRequest:{id:a.publicationId,owner,token:a.expectedCardToken}}
 const inserted=await service.from('internal_messages').insert({id:nativeTeamCardId(ctx.roomId,fixture.date),conversation_id:ctx.roomId,sender_user_id:owner,message_kind:'announcement',body:bodyText,metadata}).select('id').maybeSingle()
 if(inserted.error&&inserted.error.code!=='23505')return fail(503)
 if(!inserted.data){const found=await receipt(service,owner,scope,ctx.roomId,a);return found.ok?found:fail(found.status===404?409:found.status)}
 return {ok:true as const,status:200,replayed:false as const,owner,scope,fixtureId:a.fixtureId,publicationId:a.publicationId,messageId:String(inserted.data.id),conversationId:ctx.roomId,matchDate:fixture.date,body:bodyText}
}

/** Caller has rechecked accepted team membership and current conversation access. */
export async function canReplyNativeAvailability(service:SupabaseClient,scope:TeamRoomScope,roomId:string,id:string,metadata:Record<string,unknown>){
 if(metadata.cardType!=='availability'||metadata.matchCompletedAt||!fixtureId(metadata.matchId)||!fixtureId(object(metadata.nativeAvailabilityRequest).id)||typeof metadata.matchDate!=='string'||metadata.matchDate<seasonToday())return false
 const escaped=scope.teamName.replace(/\\/g,'\\\\').replace(/"/g,'\\"')
 let q=service.from('matches').select('id,match_date,match_time,home_team,away_team,facility,status,score,league_name,flight,line_number,match_type').eq('league_name',scope.leagueName).eq('match_date',metadata.matchDate).is('line_number',null).or(`home_team.eq."${escaped}",away_team.eq."${escaped}"`)
 q=scope.flight?q.eq('flight',scope.flight):q.or('flight.is.null,flight.eq.')
 const [matches,cards]=await Promise.all([q.limit(3),service.from('internal_messages').select('id').eq('conversation_id',roomId).is('deleted_at',null).contains('metadata',{teamRoomCard:true,matchDate:metadata.matchDate}).limit(2)])
 if(matches.error||cards.error||(matches.data?.length||0)>=3||cards.data?.length!==1||cards.data[0].id!==id)return false
 const rows=(matches.data||[]).map(row=>publicTeamFixture(row,scope)).filter(Boolean)
 if(rows.length!==1)return false
 const fixture=rows[0]!
 return fixture.id===metadata.matchId&&fixture.time===metadata.matchTime&&fixture.facility===metadata.facility&&fixtureOpponent(fixture,scope)===metadata.opponent&&!fixtureCancelled(fixture)&&!fixture.score&&!/^(completed?|final|played)$/i.test(fixture.status)
}
