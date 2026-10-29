import type {SupabaseClient} from '@supabase/supabase-js'
import type {ImportBatch,ImportDetail} from './data-imports-data'
import {html} from './match-details'
import {openRosterPlayerProfile} from './roster-player-profile'
import {showDirectory} from './directory-view'
const idPattern=/^[a-zA-Z0-9_-]{1,100}$/
export function hasImportedRecords(batch:ImportBatch,detail:ImportDetail|null){return Boolean(detail?.reviewSource&&batch.status==='imported'&&detail.status==='imported'&&!detail.outcome.some(([key,value])=>key==='Failed'&&Number(value)>0))}
type Court={id:string;external_match_id:string;match_type:string;line_number:number;score:string|null;match_players:Array<{player_id:string;side:string;seat:number|null;players:{name:string}|Array<{name:string}>}>}
export function readImportedCourts(value:unknown,externalId:string):Court[]{
 if(!/^\d{10}$/.test(externalId)||!Array.isArray(value)||value.length>10)throw Error('The saved courts could not be confirmed.')
 const seen=new Set<string>()
 for(const item of value){const row=item as Court
  if(!row||typeof row.id!=='string'||!idPattern.test(row.id)||seen.has(row.id)||typeof row.external_match_id!=='string'||!row.external_match_id.startsWith(externalId+'::line:')||!['singles','doubles'].includes(row.match_type)||! /^(?:[1-9]|1[0-9]|20)$/.test(String(row.line_number))||row.score!==null&&(typeof row.score!=='string'||row.score.length>500)||!Array.isArray(row.match_players)||row.match_players.length>(row.match_type==='singles'?2:4))throw Error('The saved courts need review.')
  seen.add(row.id)
  for(const p of row.match_players){const player=Array.isArray(p.players)?p.players.length===1?p.players[0]:null:p.players;if(typeof p.player_id!=='string'||!idPattern.test(p.player_id)||!['A','B'].includes(p.side)||!player||typeof player.name!=='string'||!player.name.trim()||player.name.length>200)throw Error('The saved players need review.')}
 }
 return value.map(row=>({...row,line_number:Number(row.line_number)})) as Court[]
}
export function openImportedRecords(client:SupabaseClient,owner:string,current:()=>boolean,batch:ImportBatch,detail:ImportDetail){
 if(!hasImportedRecords(batch,detail)||!current())return null
 const base=detail.reviewSource!,previous=document.activeElement as HTMLElement|null,dialog=document.createElement('dialog');dialog.className='data-imports-dialog';dialog.setAttribute('aria-label','Imported records')
 let disposed=false,busy=false,version=0,profile:ReturnType<typeof openRosterPlayerProfile>|null=null,team:ReturnType<typeof showDirectory>|null=null
 const valid=()=>!disposed&&current()&&dialog.isConnected
 const own=async()=>{const session=await client.auth.getSession();if(session.error||session.data.session?.user.id!==owner||!valid())throw Error('Close this screen and sign in again.')}
 const dispose=()=>{if(disposed)return;disposed=true;version++;profile?.dispose();team?.dispose();dialog.remove();if(current()&&previous?.isConnected)previous.focus({preventScroll:true})}
 const names=Array.from(new Set(base.rows.flatMap(row=>base.kind==='scorecard'?[...row.homePlayers.split('\n'),...row.awayPlayers.split('\n')]:[row.name]).map(n=>n.trim()).filter(Boolean)))
 const teams=Array.from(new Set(base.kind==='scorecard'?[base.fields.homeTeam,base.fields.awayTeam]:[base.fields.rosterTeamName]))
 const league=base.fields.leagueName||detail.context.find(([k])=>k==='League')?.[1]||null,flight=base.fields.flight||detail.context.find(([k])=>k==='Flight')?.[1]||null
 const status=()=>dialog.querySelector<HTMLElement>('[data-result-status]')!
 const render=()=>{
  team?.dispose();team=null
  dialog.innerHTML='<h1 tabindex="-1">Imported records</h1><p>Open the saved results, team, or player profile. Ratings may still be refreshing.</p><p role="status" data-result-status></p>'+(base.kind==='scorecard'?'<button type="button" class="secondary" data-result-scorecard>View saved scorecard</button>':'')+'<h2>Teams</h2>'+teams.map((name,i)=>'<button type="button" class="secondary" data-result-team="'+i+'">View '+html(name)+'</button>').join('')+'<details><summary>Players in this file · '+names.length+'</summary>'+names.map((name,i)=>'<button type="button" class="secondary" data-result-name="'+i+'">View '+html(name)+'</button>').join('')+'</details><div data-result-content></div><button type="button" class="secondary" data-result-close>Back to upload</button>'
  dialog.querySelector('[data-result-close]')!.addEventListener('click',dispose)
  dialog.querySelectorAll<HTMLButtonElement>('[data-result-team]').forEach(button=>button.onclick=()=>{if(busy||!valid())return;const name=teams[Number(button.dataset.resultTeam)];if(!name)return;team?.dispose();team=showDirectory(dialog.querySelector<HTMLElement>('[data-result-content]')!,'Teams',client,valid,'',{team:{name,league,flight,source:'recorded'},backLabel:'Back to imported records',back:()=>{render();dialog.querySelector<HTMLElement>('h1')?.focus()}})})
  dialog.querySelectorAll<HTMLButtonElement>('[data-result-name]').forEach(button=>button.onclick=()=>{void find(names[Number(button.dataset.resultName)])})
  dialog.querySelector('[data-result-scorecard]')?.addEventListener('click',()=>{void scorecard()})
 }
 const find=async(name:string)=>{
  if(busy||!valid()||!name)return;busy=true;const visit=++version;status().textContent='Finding the saved player…'
  try{await own();const result=await client.from('players').select('id,name,location,flight').eq('name',name).limit(2).abortSignal(AbortSignal.timeout(12000));await own();if(visit!==version)return
   if(result.error||!Array.isArray(result.data)||result.data.length!==1||!idPattern.test(result.data[0].id)||result.data[0].name!==name)throw Error('A single matching player could not be confirmed. Open the saved scorecard or team to choose the player.')
   profile?.dispose();profile=openRosterPlayerProfile(client,result.data[0],valid,'Back to imported records');status().textContent=''
  }catch(cause){if(valid()&&visit===version)status().textContent=cause instanceof Error?cause.message:'Player unavailable.'}finally{busy=false}
 }
 const scorecard=async()=>{
  if(busy||!valid())return;busy=true;const visit=++version;status().textContent='Loading saved courts…'
  try{await own();const externalId=base.fields.externalMatchId;if(!/^\d{10}$/.test(externalId))throw Error('The match ID needs review.')
   const result=await client.from('matches').select('id,external_match_id,match_type,line_number,score,match_players(player_id,side,seat,players(name))').like('external_match_id',externalId+'::line:%').eq('status','completed').eq('public_history_eligible',true).in('match_type',['singles','doubles']).order('line_number',{ascending:true}).limit(11).limit(5,{referencedTable:'match_players'}).abortSignal(AbortSignal.timeout(12000));await own();if(visit!==version)return
   if(result.error)throw Error('Could not load the saved scorecard. Try again.')
   const rows=readImportedCourts(result.data,externalId),host=dialog.querySelector<HTMLElement>('[data-result-content]')!;team?.dispose();team=null
   host.innerHTML='<h2 tabindex="-1">Saved scorecard</h2><p>'+html(base.fields.homeTeam)+' vs '+html(base.fields.awayTeam)+'</p><p>Match '+html(externalId)+' · Scores follow the source court order.</p>'+rows.map(row=>'<article><h3>'+row.line_number+' '+html(row.match_type)+'</h3><p>'+html(row.score||'Score unavailable')+'</p>'+['A','B'].map(side=>'<p>'+row.match_players.filter(p=>p.side===side).sort((a,b)=>(a.seat??99)-(b.seat??99)).map(p=>{const player=Array.isArray(p.players)?p.players[0]:p.players;return '<button type="button" class="secondary" data-result-player="'+html(p.player_id)+'">'+html(player.name)+'</button>'}).join('')+'</p>').join('')+'</article>').join('')+(!rows.length?'<p>No eligible individual courts are available yet. Refresh the upload before checking again.</p>':'')
   host.querySelectorAll<HTMLButtonElement>('[data-result-player]').forEach(button=>button.onclick=()=>{if(!valid())return;const p=rows.flatMap(r=>r.match_players).find(p=>p.player_id===button.dataset.resultPlayer);if(!p)return;const player=Array.isArray(p.players)?p.players[0]:p.players;profile?.dispose();profile=openRosterPlayerProfile(client,{id:p.player_id,name:player.name,location:null,flight:null},valid,'Back to imported records')})
   status().textContent='';host.querySelector<HTMLElement>('h2')?.focus({preventScroll:true})
  }catch(cause){if(valid()&&visit===version)status().textContent=cause instanceof Error?cause.message:'Saved scorecard unavailable.'}finally{busy=false}
 }
 dialog.oncancel=event=>{event.preventDefault();dispose()};document.body.append(dialog);render();dialog.showModal();dialog.querySelector<HTMLElement>('h1')!.focus();return {dispose,isOpen:()=>!disposed,back:()=>{if(profile?.isOpen())return profile.back();dispose();return true}}
}
