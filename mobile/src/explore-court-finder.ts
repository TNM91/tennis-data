import {courtDistanceMiles,stLouisCourts,stLouisCourtSource,stLouisZipPoint,type CourtPoint,type ExploreCourt} from './explore-court-catalog'
import {openCourtDirections} from './explore-court-directions'
import {openCourtInfo,type LoadCourtFeedback} from './explore-court-info'
import {openCourtInvite,type CourtInviteCalendar} from './explore-court-invite'
import {nearbyCourtPoint} from './explore-court-location'
import type {createPrivateCourtStore} from './explore-private-courts'
import {readSavedCourts,toggleSavedCourt} from './explore-saved-courts'
import {html} from './match-details'
import {Browser} from './native-browser'

const pageSize=8
const savedPreviewSize=3
const searchRadius=35
const courtKey=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'')
const cityKeys=['stl','stlouis','saintlouis','stlouismo','saintlouismo']
const courtTypes={
 all:{label:'All courts',result:'court'},
 club:{label:'Tennis clubs',result:'tennis club'},
 public:{label:'Public courts',result:'public court'},
} as const
type CourtType=keyof typeof courtTypes
type CourtFinderOptions={owner?:string;loadFeedback?:LoadCourtFeedback;initialType?:CourtType;calendar?:CourtInviteCalendar}

export function openCourtFinder(trigger:HTMLElement,current:()=>boolean,store:ReturnType<typeof createPrivateCourtStore>,
 {owner,loadFeedback,initialType='all',calendar}:CourtFinderOptions={}){
 const dialog=document.createElement('dialog')
 dialog.className='captain-lineup-dialog scorecard-share-dialog court-finder-dialog'
 dialog.setAttribute('aria-labelledby','court-finder-title')
 dialog.innerHTML=`<div class="court-invite-heading"><h2 id="court-finder-title" tabindex="-1">Find courts</h2><button class="secondary" type="button" data-finder-close>Close</button></div>
  <div class="court-finder-filters" role="group" aria-label="Filter listed courts">
   ${Object.entries(courtTypes).map(([type,{label}])=>`<button class="secondary" type="button" data-finder-court-type="${type}" aria-pressed="${type===initialType}">${label}</button>`).join('')}
  </div>
  ${owner?'<div class="court-finder-shortcuts" role="region" aria-label="Saved courts" data-finder-shortcuts hidden></div><p class="sr-only" role="status" data-finder-preference-status></p>':''}
  <form class="court-finder-search" data-finder-search role="search" aria-label="Search courts">
   <label for="court-finder-query">Court, city or ZIP</label><input id="court-finder-query" type="search" maxlength="80" placeholder="St. Louis or 63109" autocomplete="off"><button type="submit">Search</button>
  </form>
  <button class="secondary court-finder-locate" type="button" data-finder-locate>Use my location</button>
  <p role="status" class="court-invite-status" data-finder-location></p>
  <p class="court-invite-help">Hitting invites use listed tennis clubs.</p>
  ${owner?`<details class="court-finder-private-form"><summary>Add a private court</summary>
    <form data-finder-private>
     <fieldset>
      <legend class="sr-only">Private court details</legend>
      <label>Court name<input name="facilityName" required maxlength="100"></label>
      <label>Street address<input name="streetAddress" required maxlength="140"></label>
      <div class="court-finder-address">
       <label>City<input name="city" required maxlength="80" value="St. Louis"></label>
       <label>State<input name="state" required maxlength="2" value="MO" autocomplete="off"></label>
       <label>ZIP (optional)<input name="zip" inputmode="numeric" maxlength="5"></label>
      </div>
      <div class="court-private-actions">
       <button type="submit">Save private court</button>
       <button type="button" class="secondary" data-finder-cancel-edit hidden>Cancel</button>
      </div>
     </fieldset>
    </form>
   </details>
   <p role="status" class="court-invite-status" data-finder-private-status></p>
   <div data-finder-saved></div>`:''}
  <p class="court-finder-count" role="status" data-finder-count tabindex="-1"></p>
  <ul class="explore-court-list court-finder-results" data-finder-results></ul>
  <button class="secondary court-finder-more" type="button" data-finder-more hidden>Show more courts</button>
  <a class="court-finder-source" data-finder-url href="${html(stLouisCourtSource)}">City of St. Louis court directory</a>`
 const search=dialog.querySelector<HTMLFormElement>('[data-finder-search]')!
 const field=search.querySelector('input')!
 const locate=dialog.querySelector<HTMLButtonElement>('[data-finder-locate]')!
 const typeButtons=dialog.querySelectorAll<HTMLButtonElement>('[data-finder-court-type]')
 const locationStatus=dialog.querySelector<HTMLElement>('[data-finder-location]')!
 const list=dialog.querySelector<HTMLElement>('[data-finder-results]')!
 const count=dialog.querySelector<HTMLElement>('[data-finder-count]')!
 const more=dialog.querySelector<HTMLButtonElement>('[data-finder-more]')!
 const privateForm=dialog.querySelector<HTMLFormElement>('[data-finder-private]')
 const privateDetails=privateForm?.closest('details')
 const privateSummary=privateDetails?.querySelector('summary')
 const privateFields=privateForm?.querySelector('fieldset')
 const privateSave=privateForm?.querySelector<HTMLButtonElement>('button[type="submit"]')
 const privateCancel=privateForm?.querySelector<HTMLButtonElement>('[data-finder-cancel-edit]')
 const privateStatus=dialog.querySelector<HTMLElement>('[data-finder-private-status]')
 const privateList=dialog.querySelector<HTMLElement>('[data-finder-saved]')
 const shortcuts=dialog.querySelector<HTMLElement>('[data-finder-shortcuts]')
 const preferenceStatus=dialog.querySelector<HTMLElement>('[data-finder-preference-status]')
 let privateCourts:ExploreCourt[]=[]
 let privateEditId:string|undefined
 let saved=readSavedCourts(owner),editing='',allSaved=false
 let invite:ReturnType<typeof openCourtInvite>|undefined
 let directions:ReturnType<typeof openCourtDirections>|undefined
 let info:ReturnType<typeof openCourtInfo>
 let courtType:CourtType=initialType
 let query='',origin:CourtPoint|undefined,originLabel='',visible=pageSize,locationRequest=0,writing=false
 const active=()=>dialog.open&&current()
 const dispose=()=>{
  if(!dialog.open)return
  dialog.close();invite?.dispose();directions?.dispose();info?.dispose();dialog.remove()
  if(current()&&trigger.isConnected)trigger.focus({preventScroll:true})
 }
 const back=()=>{
  if(info?.isOpen())return info.back()
  if(directions?.isOpen())directions.dispose()
  else if(invite?.isOpen())invite.dispose()
  else dispose()
  return true
 }

 function row(court:ExploreCourt,section:'results'|'private'|'saved',distance?:number){
  const key=`${section}:${court.id}`
  const home=saved.home===court.id,favorite=saved.favorites.includes(court.id)
  const designation=home?'Home court':favorite?'Favorite':''
  const heading=section==='saved'?'h4':'h3'
  const access=court.access==='club'?'Check guest access':court.access==='private'?'Private · only on this device':'Public access'
  const courtInfo=[section==='saved'?designation:'',court.area,access,court.accessNote,
   distance===undefined?'':`${distance<.1?'Under 0.1':distance.toFixed(1)} mi away`].filter(Boolean).join(' · ')
  return `<li data-finder-row="${html(key)}"${section==='saved'&&home?' class="court-finder-home"':''}>
   <div class="court-finder-venue"><div><${heading}>${html(court.name)}</${heading}><p>${html(courtInfo)}</p></div>
   ${owner?`<button class="secondary court-finder-save" type="button" data-finder-save aria-label="Save options for ${html(court.name)}" aria-expanded="${editing===key}">${designation?'Saved':'Save'}</button>`:''}</div>
   ${owner&&editing===key?`<div class="court-invite-preferences court-finder-preferences" role="group" aria-label="Save ${html(court.name)}">
    <button type="button" class="secondary" data-finder-favorite="${html(court.id)}" aria-pressed="${favorite}">Favorite</button>
    <button type="button" class="secondary" data-finder-home="${html(court.id)}" aria-pressed="${home}">Home court</button>
   </div>`:''}
   <div class="explore-court-links court-finder-links">
    ${court.source?`<button class="secondary explore-court-info" type="button" data-finder-court-info="${html(court.id)}" aria-label="Court info for ${html(court.name)}" aria-haspopup="dialog">Court info</button>`:''}
    <button class="secondary explore-court-directions" type="button" data-finder-directions="${html(court.id)}" aria-label="Directions to ${html(court.name)}" aria-haspopup="dialog">Directions</button>
    ${court.access==='club'?`<button class="secondary" type="button" data-finder-invite="${html(court.id)}" aria-label="Invite to hit at ${html(court.name)}">Invite here</button>`:''}
    ${section==='private'?`<button class="secondary" type="button" data-finder-edit="${html(court.id)}" aria-label="Edit private court ${html(court.name)}">Edit</button>
     <button class="secondary" type="button" data-finder-remove="${html(court.id)}" aria-label="Remove private court ${html(court.name)}">Remove</button>`:''}
   </div></li>`
 }

 function renderSaved(){
  if(!shortcuts)return
  const courts=[...stLouisCourts,...privateCourts]
  const home=courts.find(court=>court.id===saved.home)
  const favorites=courts.filter(court=>court.id!==saved.home&&saved.favorites.includes(court.id))
  const pinned=home?[home,...favorites]:favorites
  shortcuts.hidden=!pinned.length||Boolean(query||origin)||courtType!=='all'
  shortcuts.innerHTML=shortcuts.hidden?'':`<h3>Saved courts</h3><ul class="explore-court-list">${pinned.slice(0,allSaved?pinned.length:savedPreviewSize).map(court=>row(court,'saved')).join('')}</ul>
   ${pinned.length>savedPreviewSize?`<button class="secondary court-finder-more" type="button" data-finder-toggle-saved aria-expanded="${allSaved}">${allSaved?'Show fewer saved courts':'Show all saved courts'}</button>`:''}`
 }

 function renderPrivate(){
  if(privateList)privateList.innerHTML=privateCourts.length?`<h3>My private courts</h3><ul class="explore-court-list">${privateCourts.map(court=>row(court,'private')).join('')}</ul>`:''
 }

 function render(){
  const key=courtKey(query)
  let results=stLouisCourts.filter(court=>courtType==='all'||court.access===courtType)
   .map(court=>({court,distance:origin&&court.point?courtDistanceMiles(origin,court.point):undefined}))
  if(origin){
   const nearby=results.filter(item=>item.distance!==undefined&&item.distance<=searchRadius)
   results=nearby.length?[...nearby.sort((a,b)=>a.distance!-b.distance!),...results.filter(item=>item.distance===undefined)]:[]
  }else if(key&&!cityKeys.includes(key)){
   results=results.filter(({court})=>courtKey(`${court.name} ${court.area} ${court.destination}`).includes(key))
  }
  const resultLabel=courtTypes[courtType].result
  count.textContent=results.length?`${results.length} ${resultLabel}${results.length===1?'':'s'}${originLabel?' · '+originLabel:''}`:
   courtType==='all'?'No courts found in the St. Louis pilot. Try a local ZIP or court name.':
    `No ${resultLabel}s match. Try All courts or a different search.`
  list.innerHTML=results.slice(0,visible).map(({court,distance})=>row(court,'results',distance)).join('')
  more.hidden=results.length<=visible
  renderPrivate();renderSaved()
 }

 function restoreAction(key:string,selector:string){
  const row=dialog.querySelector(`[data-finder-row="${CSS.escape(key)}"]`)
  const action=row?.querySelector<HTMLElement>(selector)??count
  action.focus()
 }

 function resetPrivateForm(){
  privateEditId=undefined
  privateForm?.reset()
  if(privateSummary)privateSummary.textContent='Add a private court'
  if(privateSave)privateSave.textContent='Save private court'
  if(privateCancel)privateCancel.hidden=true
  if(privateDetails)privateDetails.open=false
 }

 async function editPrivateCourt(id:string){
  if(!privateForm||!privateDetails||!privateSummary||!privateSave||!privateCancel||!privateStatus)return
  try{
   const court=await store.details(id)
   if(!active()||writing)return
   if(!court)throw Error('missing_court')
   privateEditId=court.id
   for(const input of privateForm.querySelectorAll<HTMLInputElement>('input')){
    const name=input.name as keyof typeof court
    input.value=court[name]??''
   }
   privateSummary.textContent='Edit private court';privateSave.textContent='Save changes';privateCancel.hidden=false
   privateStatus.textContent='';privateDetails.open=true
   privateForm.querySelector<HTMLInputElement>('[name="facilityName"]')?.focus()
  }catch{if(active())privateStatus.textContent='Couldn’t load the saved court. Try again.'}
 }

 search.onsubmit=event=>{
  event.preventDefault()
  locationRequest++
  query=field.value.trim();origin=/^\d{5}$/.test(query)?stLouisZipPoint(query):undefined;editing=''
  originLabel=origin?`Approximate distance from ZIP ${query}`:''
  visible=pageSize;locationStatus.textContent='';render()
 }
 typeButtons.forEach(button=>{button.onclick=()=>{
  if(!active())return
  const next=button.dataset.finderCourtType as CourtType
  if(next===courtType)return
  courtType=next;editing='';visible=pageSize
  typeButtons.forEach(option=>option.setAttribute('aria-pressed',String(option===button)))
  render()
 }})
 locate.onclick=async()=>{
  const request=++locationRequest
  locate.disabled=true;locationStatus.textContent='Finding courts near you…'
  try{
   const point=await nearbyCourtPoint()
   if(!active()||locationRequest!==request)return
   origin=point;originLabel='Approximate distance from you';query='';field.value='';visible=pageSize;editing=''
   locationStatus.textContent='';render()
  }catch(error){
   if(!active()||locationRequest!==request)return
   const denied=(error as {code?:string}|null)?.code==='location_denied'||(error instanceof Error&&error.message==='location_denied')
   locationStatus.textContent=denied?'Location access is off. Search by city or ZIP.':'Location is unavailable. Search by city or ZIP.'
  }finally{if(active())locate.disabled=false}
 }
 more.onclick=()=>{
  const firstNew=visible
  visible+=pageSize;render()
  list.querySelectorAll<HTMLButtonElement>('[data-finder-directions]')[firstNew]?.focus()
 }
 if(privateForm&&privateStatus&&privateFields&&privateDetails)privateForm.onsubmit=async event=>{
  event.preventDefault()
  if(!active()||writing||!privateForm.reportValidity())return
  const editedId=privateEditId,input=Object.fromEntries(new FormData(privateForm))
  writing=true
  privateFields.disabled=true
  try{
   const result=await store.save(input,editedId)
   if(!active())return
   privateCourts=result.courts;resetPrivateForm()
   privateStatus.textContent=editedId?'Private court updated.':'Private court saved on this device.';renderPrivate();renderSaved()
   restoreAction(`private:${result.id}`,editedId?'[data-finder-edit]':'[data-finder-directions]')
  }catch(error){
   if(active()){
    privateDetails.open=true
    const code=error instanceof Error?error.message:''
    privateStatus.textContent=code==='invalid_address'?'Enter a street address, city, two-letter state and a valid ZIP if included.':
     code==='duplicate_court'?'This court is already saved.':code==='missing_court'?'This private court was removed.':
     code==='private_limit'?'Remove a saved court before adding another.':'Couldn’t save the court on this device. Try again.'
   }
  }finally{writing=false;privateFields.disabled=false}
 }
 if(privateForm&&privateStatus)privateForm.oninput=()=>{privateStatus.textContent=''}
 if(privateDetails)privateDetails.ontoggle=()=>{if(!privateDetails.open&&privateEditId&&!writing)resetPrivateForm()}
 dialog.onclick=async event=>{
  if(!active()||!(event.target instanceof Element))return
  const target=event.target.closest<HTMLElement>('button,a')
  if(!target)return
  const rowKey=target.closest<HTMLElement>('[data-finder-row]')?.dataset.finderRow??''
  const saveCourtId=target.dataset.finderHome??target.dataset.finderFavorite
  if(target.hasAttribute('data-finder-close'))back()
  else if(target.hasAttribute('data-finder-cancel-edit')&&privateEditId&&!writing){
   const id=privateEditId
   resetPrivateForm();if(privateStatus)privateStatus.textContent=''
   restoreAction(`private:${id}`,'[data-finder-edit]')
  }else if(target.hasAttribute('data-finder-toggle-saved')){
   allSaved=!allSaved;renderSaved();shortcuts?.querySelector<HTMLButtonElement>('[data-finder-toggle-saved]')?.focus()
  }else if(target.hasAttribute('data-finder-save')){
   editing=editing===rowKey?'':rowKey;render();restoreAction(rowKey,'[data-finder-save]')
  }else if(owner&&preferenceStatus&&saveCourtId){
   const preference=target.dataset.finderHome?'home':'favorite'
   try{
    const result=toggleSavedCourt(owner,saveCourtId,preference)
    saved=result.saved;render();restoreAction(rowKey,preference==='home'?'[data-finder-home]':'[data-finder-favorite]')
    preferenceStatus.className='sr-only';preferenceStatus.textContent=result.message
   }catch{
    preferenceStatus.className='court-invite-status';preferenceStatus.textContent='Couldn’t save the court on this device. Try again.'
   }
  }else if(target.dataset.finderInvite&&!invite?.isOpen()){
   invite=openCourtInvite(target,active,owner,target.dataset.finderInvite,()=>{
    saved=readSavedCourts(owner);render();restoreAction(rowKey,'[data-finder-invite]')
   },calendar)
  }else if(target.dataset.finderCourtInfo&&!info?.isOpen()){
   const court=stLouisCourts.find(venue=>venue.id===target.dataset.finderCourtInfo)
   if(court)info=openCourtInfo(court,target,active,{owner,loadFeedback,calendar,onSaved:()=>{
    saved=readSavedCourts(owner);render();restoreAction(rowKey,'[data-finder-court-info]')
   }})
  }else if(target.dataset.finderDirections&&!directions?.isOpen()){
   const court=[...stLouisCourts,...privateCourts].find(venue=>venue.id===target.dataset.finderDirections)
   if(court)directions=openCourtDirections(court,target,active)
  }else if(target.dataset.finderEdit&&!writing){
   await editPrivateCourt(target.dataset.finderEdit)
  }else if(target.dataset.finderRemove&&privateStatus&&!writing){
   writing=true
   try{
    const remaining=await store.remove(target.dataset.finderRemove)
    if(!active())return
    if(privateEditId===target.dataset.finderRemove)resetPrivateForm()
    privateCourts=remaining;privateStatus.textContent='Private court removed.';renderPrivate();renderSaved();privateSummary?.focus()
   }catch{if(active())privateStatus.textContent='Couldn’t remove the court. Try again.'}
   finally{writing=false}
  }else if(target instanceof HTMLAnchorElement&&target.hasAttribute('data-finder-url')){
   event.preventDefault()
   try{await Browser.open({url:target.href})}catch{if(active())locationStatus.textContent='Couldn’t open the link. Try again.'}
  }
 }
 dialog.oncancel=event=>{event.preventDefault();back()}
 render();document.body.append(dialog);dialog.showModal();dialog.querySelector('h2')!.focus({preventScroll:true})
 if(owner)void store.list().then(courts=>{if(active()&&!writing){privateCourts=courts;renderPrivate();renderSaved()}}).catch(()=>{
  if(active()&&privateStatus)privateStatus.textContent='Saved private courts couldn’t load.'
 })
 return {dispose,back,isOpen:()=>dialog.open}
}
