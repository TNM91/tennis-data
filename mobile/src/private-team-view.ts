import {CapacitorHttp} from '@capacitor/core'
import type {SupabaseClient} from '@supabase/supabase-js'
import {privateTeamLeagueKey,readPrivateTeamInput,type PrivateTeamInput} from '../../lib/private-team-contract'
import {firstPartyTeamRooms,matchesTeamReleaseScope} from './first-party-team-transport'
import {html} from './match-details'
import type {TeamScope} from './team-room-data'

type CreatedTeam={scope:TeamScope;roomId:string}

export function openPrivateTeam(client:SupabaseClient,owner:string,current:()=>boolean,created:(team:CreatedTeam,invite:boolean)=>void,closed:()=>void){
 const dialog=document.createElement('dialog')
 dialog.className='team-invite-dialog'
 dialog.setAttribute('aria-label','Create a team')
 document.body.append(dialog)
 let disposed=false,busy=false,notice='',pending:PrivateTeamInput|null=null,result:CreatedTeam|null=null
 let fields={teamName:'',leagueLabel:'',flight:''}
 const active=()=>!disposed&&current()
 const dispose=()=>{disposed=true;dialog.remove()}
 const enter=(invite:boolean)=>{if(!result||!active())return;dispose();created(result,invite)}
 const close=()=>{if(busy||disposed)return;if(result){enter(false);return}dispose();closed()}
 const focus=(selector:string)=>dialog.querySelector<HTMLElement>(selector)?.focus({preventScroll:true})
 const create=async(input:PrivateTeamInput)=>{
  if(busy||!active())return
  busy=true;pending=input;notice='Creating your team…';render()
  try{
   const {data,error}=await client.auth.getSession()
   if(!active())return
   if(error||data.session?.user.id!==owner){pending=null;notice='Sign in again to create a team.';return}
   const response=await CapacitorHttp.post({
    url:firstPartyTeamRooms,headers:{Authorization:'Bearer '+data.session.access_token,'Content-Type':'application/json'},
    data:{action:'create_private_team',...input},responseType:'json',disableRedirects:true,connectTimeout:12000,readTimeout:15000,
   })
   if(!active())return
   if([400,401,403,409,429].includes(response.status)){
    pending=null
    notice=response.status===403?'Creating a team requires Captain access. You can check your plan in Account settings.':
     response.status===409?'A team with these details may already exist. Check Your teams.':
     response.status===429?'Your account has reached the team limit.':
     response.status===401?'Sign in again to create a team.':'Check the team name, league, and flight.'
    return
   }
   const reply=response.data,scope={teamName:input.teamName,leagueName:privateTeamLeagueKey(input.id),leagueLabel:input.leagueLabel,flight:input.flight}
   if(response.status!==200||reply?.ok!==true||reply.roomId!==input.id||!matchesTeamReleaseScope(reply,owner)||
      Object.entries(scope).some(([key,value])=>reply.team?.[key]!==value))throw Error()
   pending=null;notice='';result={scope,roomId:input.id}
  }catch{notice='The team could not be confirmed. Retry to check the same team.'}
  finally{if(active()){busy=false;render();focus(result?'h2':'[role="status"]')}}
 }
 const render=()=>{
  dialog.innerHTML=`<header class="team-invite-heading"><h2 tabindex="-1">${result?'Your team is ready':'Create a team'}</h2></header>
   ${result?`<p><strong>${html(result.scope.teamName)}</strong></p><p>Share an invite link so your teammates can join the chat.</p>
    <button type="button" data-create-invite>Invite teammates</button>
    <button type="button" class="secondary" data-create-open>Open team chat</button>`:
    pending?'':`<p>Set up a private chat for any team you captain. Enter the details you want your teammates to see.</p>
    <form>
     <label>Team name<input name="teamName" value="${html(fields.teamName)}" required maxlength="100" autocomplete="off"></label>
     <label>League or group (optional)<input name="leagueLabel" value="${html(fields.leagueLabel)}" maxlength="100" autocomplete="off"></label>
     <label>Flight (optional)<input name="flight" value="${html(fields.flight)}" maxlength="60" autocomplete="off"></label>
     <button type="submit">Create team</button>
    </form>`}
   <p role="status" tabindex="-1" data-invite-feedback>${html(notice)}</p>
   ${pending&&!busy?'<button type="button" data-create-retry>Retry same team</button>':''}
   ${result?'':`<button type="button" class="secondary" data-create-close ${busy?'disabled':''}>Close</button>`}`
  dialog.querySelector('form')?.addEventListener('submit',event=>{
   event.preventDefault()
   const data=new FormData(event.currentTarget as HTMLFormElement)
   fields={teamName:String(data.get('teamName')??''),leagueLabel:String(data.get('leagueLabel')??''),flight:String(data.get('flight')??'')}
   const input=readPrivateTeamInput({id:crypto.randomUUID(),...fields})
   if(input){void create(input);return}
   dialog.querySelector('[role="status"]')!.textContent='Enter a team name with a letter or number.'
   focus('[role="status"]')
  })
  dialog.querySelector('[data-create-retry]')?.addEventListener('click',()=>{if(pending)void create(pending)})
  dialog.querySelector('[data-create-close]')?.addEventListener('click',close)
  dialog.querySelector('[data-create-invite]')?.addEventListener('click',()=>enter(true))
  dialog.querySelector('[data-create-open]')?.addEventListener('click',()=>enter(false))
 }
 dialog.addEventListener('cancel',event=>{event.preventDefault();close()})
 render();dialog.showModal();focus('h2')
 return {isOpen:()=>!disposed,close,dispose}
}
