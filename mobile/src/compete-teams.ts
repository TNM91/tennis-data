import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {html} from './match-details'
import type {TeamScope} from './team-room-data'
import {firstPartyBuild} from './build-scope'
import {firstPartyTeamRooms,matchesTeamReleaseScope} from './first-party-team-transport'

const actions={
 chat:'Open chat',
 match:'Match day',
 plans:'Team plans',
 captain:'Captain tools',
} as const
export type CompeteTeamAction=keyof typeof actions
export type CompeteTeamDestination={team:TeamScope;action:CompeteTeamAction}
type CompeteTeam=TeamScope&{canManage:boolean}

const teamKey=({teamName,leagueName,flight}:TeamScope)=>JSON.stringify([teamName,leagueName,flight])

async function loadCompeteTeams(client:SupabaseClient,owner:string,current:()=>boolean):Promise<CompeteTeam[]> {
 const {data,error}=await client.auth.getSession()
 if(error||data.session?.user.id!==owner||!current())throw Error('Team access unavailable')
 const response=await CapacitorHttp.get({
  url:firstPartyBuild?firstPartyTeamRooms+'?op=teams':'https://www.tenaceiq.com/api/team-rooms/teams',
  headers:{Authorization:'Bearer '+data.session.access_token,'Cache-Control':'no-store'},
  responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:12000,
 })
 const fresh=await client.auth.getSession()
 if(fresh.error||fresh.data.session?.user.id!==owner||!current())throw Error('Team access changed')
 const payload=response.data as {ok?:boolean;owner?:string;teams?:unknown[]}|null
 if(response.status!==200||payload?.ok!==true||payload.owner!==owner||!matchesTeamReleaseScope(payload,owner)||!Array.isArray(payload.teams))throw Error('Teams unavailable')
 const teams=new Map<string,CompeteTeam>()
 for(const item of payload.teams){
  const team=item as Partial<CompeteTeam>|null
  if(!team||typeof team.teamName!=='string'||!team.teamName.trim()||typeof team.leagueName!=='string'||!team.leagueName.trim()||typeof team.flight!=='string'||typeof team.canManage!=='boolean')throw Error('Team unavailable')
  const {teamName,leagueName,flight,canManage}=team
  const key=teamKey({teamName,leagueName,flight})
  if(!teams.has(key))teams.set(key,{teamName,leagueName,flight,canManage})
 }
 return Array.from(teams.values())
}

export function mountCompeteTeams(section:HTMLElement,client:SupabaseClient,owner:string,current:()=>boolean,
 open:(destination:CompeteTeamDestination)=>void,join:(trigger:HTMLButtonElement)=>void,resume?:CompeteTeamDestination){
 const list=section.querySelector<HTMLElement>('[data-compete-team-list]')!
 const active=()=>section.isConnected&&current()
 const load=async(restore?:'return'|'retry')=>{
  list.innerHTML='<p role="status" tabindex="-1">Loading your teams…</p>'
  if(restore==='retry')list.querySelector<HTMLElement>('p')?.focus({preventScroll:true})
  const opener=document.activeElement
  try{
   const teams=await loadCompeteTeams(client,owner,active)
   if(!active())return
   const restoreFocus=Boolean(restore)&&document.activeElement===opener
   if(!teams.length){
    list.innerHTML='<div class="compete-team-card"><p>Use an invite from your captain to join your team.</p><button type="button" class="secondary" data-compete-team-join>Join team</button></div>'
    const button=list.querySelector<HTMLButtonElement>('[data-compete-team-join]')!
    button.onclick=()=>{if(active())join(button)}
    if(restoreFocus)button.focus()
    return
   }
   list.innerHTML=teams.map((team,index)=>{
    const caption=[team.leagueName,team.flight].filter(Boolean).join(' · ')
    const teamActions:CompeteTeamAction[]=firstPartyBuild?['chat']:team.canManage?['match','plans','captain']:['match','plans']
    return `<article class="compete-team-card" aria-labelledby="compete-team-${index}">
     <h3 id="compete-team-${index}">${html(team.teamName)}</h3><p>${html(caption)}</p>
     <div class="compete-team-actions">${teamActions.map(action=>`<button type="button" class="secondary" data-compete-team="${index}" data-team-action="${action}" aria-label="${actions[action]} · ${html(team.teamName)} · ${html(caption)}">${actions[action]}</button>`).join('')}</div>
    </article>`
   }).join('')
   const buttons=Array.from(list.querySelectorAll<HTMLButtonElement>('[data-compete-team]'))
   for(const button of buttons){
    const team=teams[Number(button.dataset.competeTeam)]
    const action=button.dataset.teamAction as CompeteTeamAction
    button.onclick=()=>{if(active())open({team,action})}
   }
   if(restoreFocus){
    const index=resume?teams.findIndex(team=>teamKey(team)===teamKey(resume.team)):-1
    const teamButtons=buttons.filter(button=>Number(button.dataset.competeTeam)===index)
    const previous=teamButtons.find(button=>button.dataset.teamAction===resume?.action)
    ;(previous??teamButtons[0]??buttons[0])?.focus()
   }
  }catch{
   if(!active())return
   const restoreFocus=Boolean(restore)&&document.activeElement===opener
   list.innerHTML='<div class="compete-team-card"><p role="status">Couldn’t load your teams.</p><button type="button" class="secondary" data-compete-team-retry>Retry teams</button></div>'
   const retry=list.querySelector<HTMLButtonElement>('[data-compete-team-retry]')!
   retry.onclick=()=>{void load('retry')}
   if(restoreFocus)retry.focus()
  }
 }
 void load(resume?'return':undefined)
}
