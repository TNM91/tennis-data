import {courtDistanceMiles,stLouisCourts,stLouisCourtSource,stLouisZipPoint,type CourtPoint,type ExploreCourt} from './explore-court-catalog'
import {courtDirectionsHref,openCourtInvite} from './explore-court-invite'
import {nearbyCourtPoint} from './explore-court-location'
import type {createPrivateCourtStore} from './explore-private-courts'
import {html} from './match-details'
import {Browser} from './native-browser'

const pageSize=8
const searchRadius=35
const courtKey=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]/g,'')
const cityKeys=['stl','stlouis','saintlouis','stlouismo','saintlouismo']

export function openCourtFinder(trigger:HTMLElement,current:()=>boolean,store:ReturnType<typeof createPrivateCourtStore>,owner?:string){
 const dialog=document.createElement('dialog')
 dialog.className='captain-lineup-dialog scorecard-share-dialog court-finder-dialog'
 dialog.setAttribute('aria-labelledby','court-finder-title')
 dialog.innerHTML=`<div class="court-invite-heading"><h2 id="court-finder-title" tabindex="-1">Find courts</h2><button class="secondary" type="button" data-finder-close>Close</button></div>
  <form class="court-finder-search" data-finder-search role="search" aria-label="Search courts">
   <label for="court-finder-query">Court, city or ZIP</label><input id="court-finder-query" type="search" maxlength="80" placeholder="St. Louis or 63109" autocomplete="off"><button type="submit">Search</button>
  </form>
  <button class="secondary court-finder-locate" type="button" data-finder-locate>Use my location</button>
  <p role="status" class="court-invite-status" data-finder-location></p>
  ${owner?`<details class="court-finder-private-form"><summary>Add a private court</summary>
    <form data-finder-private>
     <label>Court name<input name="facilityName" required maxlength="100"></label>
     <label>Street address<input name="streetAddress" required maxlength="140"></label>
     <div class="court-finder-address">
      <label>City<input name="city" required maxlength="80" value="St. Louis"></label>
      <label>State<input name="state" required maxlength="2" value="MO" autocomplete="off"></label>
      <label>ZIP (optional)<input name="zip" inputmode="numeric" maxlength="5"></label>
     </div>
     <button type="submit">Save private court</button>
    </form>
   </details>
   <p role="status" class="court-invite-status" data-finder-private-status></p>
   <div data-finder-saved></div>`:''}
  <p class="court-finder-count" role="status" data-finder-count></p>
  <ul class="explore-court-list court-finder-results" data-finder-results></ul>
  <button class="secondary court-finder-more" type="button" data-finder-more hidden>Show more courts</button>
  <a class="court-finder-source" data-finder-url href="${html(stLouisCourtSource)}">City of St. Louis court directory</a>`
 const search=dialog.querySelector<HTMLFormElement>('[data-finder-search]')!
 const field=search.querySelector('input')!
 const locate=dialog.querySelector<HTMLButtonElement>('[data-finder-locate]')!
 const locationStatus=dialog.querySelector<HTMLElement>('[data-finder-location]')!
 const list=dialog.querySelector<HTMLElement>('[data-finder-results]')!
 const count=dialog.querySelector<HTMLElement>('[data-finder-count]')!
 const more=dialog.querySelector<HTMLButtonElement>('[data-finder-more]')!
 const privateForm=dialog.querySelector<HTMLFormElement>('[data-finder-private]')
 const privateStatus=dialog.querySelector<HTMLElement>('[data-finder-private-status]')
 const privateList=dialog.querySelector<HTMLElement>('[data-finder-saved]')
 let privateCourts:ExploreCourt[]=[]
 let invite:ReturnType<typeof openCourtInvite>|undefined
 let query='',origin:CourtPoint|undefined,originLabel='',visible=pageSize,locationRequest=0,writing=false
 const active=()=>dialog.open&&current()
 const dispose=()=>{
  if(!dialog.open)return
  dialog.close();invite?.dispose();dialog.remove()
  if(current()&&trigger.isConnected)trigger.focus({preventScroll:true})
 }
 const back=()=>{if(invite?.isOpen())invite.dispose();else dispose();return true}

 function row(court:ExploreCourt,distance?:number){
  const access=court.access==='club'?'Check guest access':court.access==='private'?'Private · only on this device':'Public access'
  return `<li><div><h3>${html(court.name)}</h3><p>${html(court.area)} · ${access}${distance===undefined?'':` · ${distance<.1?'Under 0.1':distance.toFixed(1)} mi away`}</p></div>
   <div class="explore-court-links court-finder-links">
    ${court.source?`<a data-finder-url href="${html(court.source)}" aria-label="Court info for ${html(court.name)}">Court info</a>`:''}
    <a data-finder-url href="${html(courtDirectionsHref(court))}" aria-label="Directions to ${html(court.name)}">Directions</a>
    <button class="secondary" type="button" data-finder-invite="${html(court.id)}" aria-label="Invite to hit at ${html(court.name)}">Invite here</button>
    ${court.access==='private'?`<button class="secondary" type="button" data-finder-remove="${html(court.id)}" aria-label="Remove private court ${html(court.name)}">Remove</button>`:''}
   </div></li>`
 }

 function render(){
  const key=courtKey(query)
  let results=stLouisCourts.map(court=>({court,distance:origin&&court.point?courtDistanceMiles(origin,court.point):undefined}))
  if(origin){
   const nearby=results.filter(item=>item.distance!==undefined&&item.distance<=searchRadius)
   results=nearby.length?[...nearby.sort((a,b)=>a.distance!-b.distance!),...results.filter(item=>item.distance===undefined)]:[]
  }else if(key&&!cityKeys.includes(key)){
   results=results.filter(({court})=>courtKey(`${court.name} ${court.area} ${court.destination}`).includes(key))
  }
  count.textContent=results.length?`${results.length} ${results.length===1?'court':'courts'}${originLabel?' · '+originLabel:''}`:
   'No courts found in the St. Louis pilot. Try a local ZIP or court name.'
  list.innerHTML=results.slice(0,visible).map(({court,distance})=>row(court,distance)).join('')
  more.hidden=results.length<=visible
  if(privateList)privateList.innerHTML=privateCourts.length?`<h3>My private courts</h3><ul class="explore-court-list">${privateCourts.map(court=>row(court)).join('')}</ul>`:''
 }

 search.onsubmit=event=>{
  event.preventDefault()
  locationRequest++
  query=field.value.trim();origin=/^\d{5}$/.test(query)?stLouisZipPoint(query):undefined
  originLabel=origin?`Approximate distance from ZIP ${query}`:''
  visible=pageSize;locationStatus.textContent='';render()
 }
 locate.onclick=async()=>{
  const request=++locationRequest
  locate.disabled=true;locationStatus.textContent='Finding courts near you…'
  try{
   const point=await nearbyCourtPoint()
   if(!active()||locationRequest!==request)return
   origin=point;originLabel='Approximate distance from you';query='';field.value='';visible=pageSize
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
  list.querySelectorAll<HTMLButtonElement>('[data-finder-invite]')[firstNew]?.focus()
 }
 if(privateForm&&privateStatus)privateForm.onsubmit=async event=>{
  event.preventDefault()
  if(!active()||writing||!privateForm.reportValidity())return
  writing=true
  try{
   const result=await store.add(Object.fromEntries(new FormData(privateForm)))
   if(!active())return
   privateCourts=result.courts;privateForm.reset();privateForm.closest('details')!.open=false
   privateStatus.textContent='Private court saved on this device.';render()
   privateList?.querySelector<HTMLButtonElement>(`[data-finder-invite="${result.id}"]`)?.focus()
  }catch(error){
   if(active())privateStatus.textContent=error instanceof Error&&error.message==='invalid_address'?'Enter a street address, city, two-letter state and a valid ZIP if included.':
    error instanceof Error&&error.message==='duplicate_court'?'This court is already saved.':
    error instanceof Error&&error.message==='private_limit'?'Remove a saved court before adding another.':'Couldn’t save the court on this device. Try again.'
  }finally{writing=false}
 }
 dialog.onclick=async event=>{
  if(!active()||!(event.target instanceof Element))return
  const target=event.target.closest<HTMLElement>('button,a')
  if(!target)return
  if(target.hasAttribute('data-finder-close'))back()
  else if(target.dataset.finderInvite&&!invite?.isOpen()){
   invite=openCourtInvite([...stLouisCourts,...privateCourts],target,active,owner,target.dataset.finderInvite)
  }else if(target.dataset.finderRemove&&privateStatus&&!writing){
   writing=true
   try{
    const remaining=await store.remove(target.dataset.finderRemove)
    if(!active())return
    privateCourts=remaining;privateStatus.textContent='Private court removed.';render();privateForm?.closest('details')?.querySelector('summary')?.focus()
   }catch{if(active())privateStatus.textContent='Couldn’t remove the court. Try again.'}
   finally{writing=false}
  }else if(target instanceof HTMLAnchorElement&&target.hasAttribute('data-finder-url')){
   event.preventDefault()
   try{await Browser.open({url:target.href})}catch{if(active())locationStatus.textContent='Couldn’t open the link. Try again.'}
  }
 }
 dialog.oncancel=event=>{event.preventDefault();back()}
 render();document.body.append(dialog);dialog.showModal();dialog.querySelector('h2')!.focus({preventScroll:true})
 if(owner)void store.list().then(courts=>{if(active()&&!writing){privateCourts=courts;render()}}).catch(()=>{
  if(active()&&privateStatus)privateStatus.textContent='Saved private courts couldn’t load.'
 })
 return {dispose,back,isOpen:()=>dialog.open}
}
