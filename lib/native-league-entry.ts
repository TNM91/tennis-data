import {createHash} from 'node:crypto'
import type {SupabaseClient} from '@supabase/supabase-js'
import {buildPlayerEligibilityRequirement} from './player-eligibility'
import {entryLeague,entryDraft,entryAssessment,entryCanSubmit,type EntryReview,type EntryReceipt} from './native-league-entry-contract'
import {loadPlayerAccess} from './player-api-auth'
import {MEMBERSHIP_TIERS} from './product-story'
type Row=Record<string,unknown>
const text=(v:unknown)=>typeof v==='string'?v.trim():''
const digest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex')
const timeout=()=>AbortSignal.timeout(12000)
const rows=(r:{data:unknown;error:unknown},max:number):Row[]=>{if(r.error||!Array.isArray(r.data)||r.data.length>max)throw Error('Entry records unavailable');return r.data as Row[]}
const receipt=(r:Row,team:boolean):EntryReceipt=>{if(!text(r.id)||!text(r[team?'team_name':'player_name'])||!['pending','active','rejected','removed'].includes(text(r.entry_status)))throw Error('Entry changed');return {id:text(r.id),name:text(r[team?'team_name':'player_name']),status:r.entry_status as EntryReceipt['status'],...(!team&&r.entry_status==='pending'&&r.player_action_required===true?{information:{updatedAt:text(r.updated_at),note:text(r.player_request_note)}}:{})}}
/** Caller JWT/RLS only. No service role, upsert, status update, or fallback storage. */
export async function loadNativeLeagueEntry(db:SupabaseClient,owner:string,leagueId:string):Promise<EntryReview>{
 entryLeague(leagueId);if(!owner)throw Error('Sign in required')
 const getLeague=()=>db.from('tiq_leagues').select('id,league_name,league_format,season_status,flight,notes,is_public,updated_at').eq('id',leagueId).eq('is_public',true).neq('season_status','draft').abortSignal(timeout()).maybeSingle()
 const initial=await getLeague(),l=initial.data as Row|null
 if(initial.error||!l||l.id!==leagueId||l.is_public!==true||!['team','individual'].includes(text(l.league_format)))throw Error('League unavailable')
 const team=l.league_format==='team',requirement=buildPlayerEligibilityRequirement(text(l.league_name),text(l.flight),text(l.notes)),profile=await db.from('profiles').select('id,linked_player_id').eq('id',owner).abortSignal(timeout()).maybeSingle()
 if(profile.error||profile.data?.id!==owner)throw Error('Account unavailable')
 const playerId=text(profile.data.linked_player_id)
 let player:EntryReview['player']={id:'',name:'',location:'',rating:null,ratingSource:'unknown',hasAgeEvidence:false,hasDivisionEvidence:false}
 if(!team&&playerId){
  const [p,roster]=await Promise.all([db.from('players').select('id,name,location,overall_rating,doubles_rating,singles_rating,rating_source,mixed_pair_role').eq('id',playerId).abortSignal(timeout()).maybeSingle(),db.from('team_roster_members').select('player_id,age_division,mixed_pair_role,rating_source').eq('player_id',playerId).limit(101).abortSignal(timeout())])
  if(p.error||p.data?.id!==playerId||!text(p.data.name))throw Error('Linked player unavailable')
  const evidence=rows(roster,101);if(evidence.length>100||evidence.some(r=>r.player_id!==playerId))throw Error('Player evidence changed')
  const verified=evidence.filter(r=>r.rating_source==='verified'),rating=p.data.overall_rating??p.data.doubles_rating??p.data.singles_rating??null
  if(rating!==null&&(typeof rating!=='number'||!Number.isFinite(rating)||rating<1||rating>7))throw Error('Player rating unavailable')
  player={id:playerId,name:text(p.data.name),location:text(p.data.location),rating,ratingSource:p.data.rating_source==='verified'?'verified':rating!==null?'self':'unknown',hasAgeEvidence:!!requirement.ageDivision&&verified.some(r=>r.age_division===requirement.ageDivision),hasDivisionEvidence:requirement.mixedPairRole!=='unknown'&&verified.some(r=>r.mixed_pair_role===requirement.mixedPairRole)}
 }
 const table=team?'tiq_team_league_entries':'tiq_player_league_entries',fields='id,league_id,created_by_user_id,entry_status,'+(team?'team_name':'player_name,player_id,player_action_required,player_request_note,updated_at')
 const owned=rows(await db.from(table).select(fields).eq('league_id',leagueId).eq('created_by_user_id',owner).order('id').limit(51).abortSignal(timeout()),51)
 if(owned.length>50||owned.some(r=>r.league_id!==leagueId||r.created_by_user_id!==owner))throw Error('Entry ownership changed')
 const linked=!team&&player.id?rows(await db.from(table).select(fields).eq('league_id',leagueId).eq('player_id',player.id).order('id').limit(3).abortSignal(timeout()),3):[]
 if(linked.length>1||linked.some(r=>r.league_id!==leagueId||r.player_id!==player.id))throw Error('Player entry needs organizer review')
 const unique=new Map<string,Row>();for(const r of [...owned,...linked])unique.set(text(r.id),r)
 if(!team&&unique.size>1)throw Error('Player entries need organizer review')
 const receipts=[...unique.values()].map(r=>receipt(r,team)),access=team?await loadPlayerAccess(db,owner):null,allowed=!team||access?.canEnterTiqTeamLeague===true
 const [latest,latestProfile]=await Promise.all([getLeague(),db.from('profiles').select('id,linked_player_id').eq('id',owner).abortSignal(timeout()).maybeSingle()])
 if(latest.error||JSON.stringify(latest.data)!==JSON.stringify(l)||latestProfile.error||latestProfile.data?.id!==owner||text(latestProfile.data.linked_player_id)!==playerId)throw Error('League or linked player changed')
 const review=digest({owner,league:l,player,allowed})
 return {owner,leagueId,leagueName:text(l.league_name),format:team?'team':'individual',review,checkedAt:new Date().toISOString(),open:l.season_status==='active',allowed,blockedReason:allowed?'':`Team entry requires active ${MEMBERSHIP_TIERS.league.name} access.`,requirement,player,receipts}
}
const fail=(status:number,message:string)=>({ok:false as const,status,message})
export async function submitNativeLeagueEntry(db:SupabaseClient,owner:string,body:Record<string,unknown>){
 if(Object.keys(body).some(k=>!['leagueId','review','draft'].includes(k)))return fail(400,'Check the entry details.')
 let leagueId:string,draft:ReturnType<typeof entryDraft>;try{leagueId=entryLeague(body.leagueId);draft=entryDraft(body.draft);if(typeof body.review!=='string'||!/^[a-f0-9]{64}$/.test(body.review))throw Error()}catch{return fail(400,'Check the entry details.')}
 const r=await loadNativeLeagueEntry(db,owner,leagueId),team=r.format==='team',existing=r.receipts.find(e=>!team||e.name.toLowerCase()===draft.name.toLowerCase())
 // Retry/read recovery never resets an existing decision, including after registration closes.
 if(existing)return {ok:true as const,status:200,owner,leagueId,receipt:existing,alreadySubmitted:true}
 if(!r.open)return fail(409,'Registration is closed for this league.')
 if(!r.allowed)return fail(403,r.blockedReason)
 if(r.review!==body.review||!team&&r.player.id&&draft.name!==r.player.name)return fail(409,'League or player details changed. Review your entry again.')
 if(!entryCanSubmit(r,draft))return fail(400,'Confirm the division requirements before requesting entry.')
 const hash=digest(['native-league-entry-v1',owner,leagueId,team?draft.name.toLowerCase():'player']),id=hash.slice(0,8)+'-'+hash.slice(8,12)+'-4'+hash.slice(13,16)+'-a'+hash.slice(17,20)+'-'+hash.slice(20,32)
 const assessment=entryAssessment(r,draft),rating=r.player.rating??draft.rating,now=new Date().toISOString()
 const payload:Row={id,league_id:leagueId,created_by_user_id:owner,updated_by_user_id:owner,entry_status:'pending',...(team?{team_name:draft.name,team_entity_id:'',source_league_name:'',source_flight:''}:{player_name:r.player.id?r.player.name:draft.name,player_id:r.player.id,player_location:r.player.location,eligibility_status:assessment.status,eligibility_review_note:assessment.detail,eligibility_rating:rating,eligibility_rating_source:rating===null?'unknown':r.player.rating!==null?r.player.ratingSource:'self',eligibility_mixed_pair_role:r.player.hasDivisionEvidence||draft.divisionAttested?r.requirement.mixedPairRole:'unknown',eligibility_mixed_pair_role_source:r.player.hasDivisionEvidence?'verified':draft.divisionAttested?'self':'unknown',eligibility_age_division:r.requirement.ageDivision&&(r.player.hasAgeEvidence||draft.ageAttested)?r.requirement.ageDivision:null,eligibility_age_division_source:r.player.hasAgeEvidence?'verified':draft.ageAttested?'self':'unknown',eligibility_submitted_at:now})}
 let result:{error:{code?:string}|null};try{result=await db.from(team?'tiq_team_league_entries':'tiq_player_league_entries').insert(payload).abortSignal(timeout())}catch{return fail(503,'Your request could not be confirmed. Check entry status before trying again.')}
 if(result.error&&result.error.code!=='23505')return fail(503,'Your request could not be confirmed. Check entry status before trying again.')
 const saved=await db.from(team?'tiq_team_league_entries':'tiq_player_league_entries').select('id,league_id,created_by_user_id,entry_status,'+(team?'team_name':'player_name')).eq('id',id).eq('league_id',leagueId).eq('created_by_user_id',owner).abortSignal(timeout()).maybeSingle()
 if(saved.error)return fail(503,'Your request could not be confirmed. Check entry status before trying again.')
 const savedRow=saved.data as unknown as Row|null
 if(!savedRow||savedRow.id!==id||savedRow.league_id!==leagueId||savedRow.created_by_user_id!==owner)return fail(409,'An entry may already exist. Ask the organizer to check it before trying again.')
 return {ok:true as const,status:200,owner,leagueId,receipt:receipt(savedRow,team),alreadySubmitted:!!result.error}
}

/** Replies are self-attestations only, conditional on the exact outstanding question and caller-owned entry. */
export async function answerNativeLeagueInformation(db:SupabaseClient,owner:string,body:Record<string,unknown>){
 let leagueId:string,draft:ReturnType<typeof entryDraft>,id:string,updatedAt:string
 try{if(Object.keys(body).some(k=>!['leagueId','entryId','updatedAt','draft','information'].includes(k))||body.information!==true)throw Error();leagueId=entryLeague(body.leagueId);id=text(body.entryId);updatedAt=text(body.updatedAt);draft=entryDraft(body.draft);if(!/^[a-f0-9-]{36}$/i.test(id)||!Number.isFinite(Date.parse(updatedAt)))throw Error()}catch{return fail(400,'Check your eligibility reply.')}
 const review=await loadNativeLeagueEntry(db,owner,leagueId),entry=review.receipts.find(e=>e.id===id)
 if(review.format!=='individual'||!entry?.information||entry.information.updatedAt!==updatedAt)return fail(409,'This information request changed. Check entry status before replying.')
 const requirement=review.requirement
 if(requirement.ageDivision&&!draft.ageAttested||requirement.mixedPairRole!=='unknown'&&!draft.divisionAttested)return fail(400,'Confirm the division requirements before replying.')
 const now=new Date().toISOString(),payload:Row={player_action_required:false,player_request_note:'',player_responded_at:now,eligibility_status:'needs_confirmation',eligibility_review_note:'Player supplied updated eligibility information.',eligibility_submitted_at:now,updated_by_user_id:owner}
 if(draft.rating!==null){payload.eligibility_rating=draft.rating;payload.eligibility_rating_source='self'}
 if(requirement.ageDivision&&draft.ageAttested){payload.eligibility_age_division=requirement.ageDivision;payload.eligibility_age_division_source='self'}
 if(requirement.mixedPairRole!=='unknown'&&draft.divisionAttested){payload.eligibility_mixed_pair_role=requirement.mixedPairRole;payload.eligibility_mixed_pair_role_source='self'}
 const saved=await db.from('tiq_player_league_entries').update(payload).eq('id',id).eq('league_id',leagueId).eq('created_by_user_id',owner).eq('entry_status','pending').eq('player_action_required',true).eq('updated_at',updatedAt).select('id,league_id,created_by_user_id,entry_status,player_name').abortSignal(timeout()).maybeSingle()
 if(saved.error)throw Error('Reply outcome unavailable');if(!saved.data||saved.data.id!==id||saved.data.created_by_user_id!==owner||saved.data.league_id!==leagueId)return fail(409,'This entry changed. Check entry status before replying.')
 return {ok:true as const,status:200,owner,leagueId,receipt:receipt(saved.data,false),alreadySubmitted:false}
}
