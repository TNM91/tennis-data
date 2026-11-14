import type {ExploreCourt} from '../../lib/hitting-clubs'
import {html} from './html'
import {Browser} from './native-browser'

export function courtDirections(court:ExploreCourt){
 return {
  apple:`https://maps.apple.com/?${new URLSearchParams({daddr:court.destination})}`,
  google:`https://www.google.com/maps/dir/?${new URLSearchParams({api:'1',destination:court.destination})}`,
 }
}

export function openCourtDirections(court:ExploreCourt,trigger:HTMLElement,current:()=>boolean){
 const dialog=document.createElement('dialog')
 dialog.className='captain-lineup-dialog scorecard-share-dialog court-directions-dialog'
 dialog.setAttribute('aria-labelledby','court-directions-title')
 dialog.setAttribute('aria-describedby','court-directions-venue')
 const namePrefix=court.name+', '
 const destination=court.destination.startsWith(namePrefix)?court.destination.slice(namePrefix.length):court.destination
 dialog.innerHTML=`<div class="court-invite-heading">
   <h2 id="court-directions-title" tabindex="-1">Directions</h2>
   <button class="secondary" type="button" data-court-directions-close>Close</button>
  </div>
  <div id="court-directions-venue" class="court-directions-venue"><strong>${html(court.name)}</strong><span>${html(destination)}</span></div>
  <div class="scorecard-share-actions">
   <button class="secondary" type="button" data-court-map="apple">Apple Maps</button>
   <button class="secondary" type="button" data-court-map="google">Google Maps</button>
  </div>
  <p role="status" class="court-invite-status"></p>`
 const routes=courtDirections(court)
 const options=dialog.querySelectorAll<HTMLButtonElement>('[data-court-map]')
 const status=dialog.querySelector<HTMLElement>('[role="status"]')!
 let opening=false
 const active=()=>dialog.open&&current()
 const dispose=()=>{
  if(!dialog.open)return
  dialog.close();dialog.remove()
  if(current()&&trigger.isConnected)trigger.focus({preventScroll:true})
 }

 options.forEach(button=>{
  button.onclick=async()=>{
   const provider=button.dataset.courtMap
   if(opening||!active()||(provider!=='apple'&&provider!=='google'))return
   opening=true;status.textContent='';options.forEach(option=>{option.disabled=true})
   try{
    await Browser.open({url:routes[provider]})
    if(active())dispose()
   }catch{
    if(active())status.textContent=`Couldn’t open ${button.textContent}. Try again or choose another map.`
   }finally{
    opening=false
    if(active()){
     options.forEach(option=>{option.disabled=false})
     button.focus({preventScroll:true})
    }
   }
  }
 })
 dialog.querySelector<HTMLButtonElement>('[data-court-directions-close]')!.onclick=dispose
 dialog.oncancel=event=>{event.preventDefault();dispose()}
 document.body.append(dialog);dialog.showModal();dialog.querySelector('h2')!.focus({preventScroll:true})
 return {dispose,isOpen:()=>dialog.open}
}
