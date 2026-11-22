export function confirmTeamNavigation():Promise<boolean>{
 if(document.querySelector('[data-team-navigation-warning]'))return Promise.resolve(false)
 const draft=document.querySelector<HTMLElement>('#chat-draft')
 const previous=draft?.getClientRects().length?draft:document.activeElement instanceof HTMLElement?document.activeElement:null
 const dialog=document.createElement('dialog');dialog.className='captain-lineup-dialog';dialog.dataset.teamNavigationWarning='';dialog.setAttribute('aria-labelledby','leave-team-title');dialog.setAttribute('aria-describedby','leave-team-description');dialog.innerHTML='<h2 id="leave-team-title">Leave My teams?</h2><p id="leave-team-description">Leaving closes the team view and discards any unfinished chat message.</p><button type="button" class="secondary" data-stay>Keep editing</button><button type="button" data-leave>Leave My teams</button>'
 return new Promise(resolve=>{let settled=false;const finish=(leave:boolean)=>{if(settled)return;settled=true;dialog.remove();if(!leave&&previous?.isConnected)previous.focus({preventScroll:true});resolve(leave)};dialog.querySelector<HTMLButtonElement>('[data-stay]')!.onclick=()=>finish(false);dialog.querySelector<HTMLButtonElement>('[data-leave]')!.onclick=()=>finish(true);dialog.onclose=()=>finish(false);dialog.oncancel=e=>{e.preventDefault();finish(false)};document.body.append(dialog);try{dialog.showModal();dialog.querySelector<HTMLButtonElement>('[data-stay]')!.focus()}catch{finish(false)}})
}

export function createTeamNavigationGuard(hasDraft:()=>boolean,revision:()=>number,confirm:()=>Promise<boolean>=confirmTeamNavigation){
 return (action:()=>void)=>{const version=revision();if(!hasDraft()){action();return}void confirm().then(leave=>{if(leave&&version===revision())action()}).catch(()=>{/* Keep the current team if the warning cannot open. */})}
}

export function confirmScorecardNavigation(kind:'scorecard'|'ratings',unconfirmed:boolean,previous?:HTMLElement):Promise<boolean>{
 if(document.querySelector('[data-personal-navigation-warning]'))return Promise.resolve(false)
 const dialog=document.createElement('dialog')
 dialog.className='captain-lineup-dialog';dialog.dataset.personalNavigationWarning=''
 dialog.setAttribute('aria-labelledby','leave-scorecard-title');dialog.setAttribute('aria-describedby','leave-scorecard-description')
 const title=unconfirmed?'Leave an unconfirmed save?':'Leave unsaved changes?'
 const description=unconfirmed?'The save may have completed. Check your match log before saving again.':kind==='ratings'?
  'Your court rating changes have not been saved. Leaving discards these edits.':
  'Your scorecard changes have not been saved. Leaving discards these edits.'
 dialog.innerHTML=`<h2 id="leave-scorecard-title">${title}</h2><p id="leave-scorecard-description">${description}</p><button type="button" data-stay>Keep editing</button><button type="button" class="secondary" data-leave>Leave My Lab</button>`
 return new Promise(resolve=>{
  let settled=false
  const finish=(leave:boolean)=>{if(settled)return;settled=true;dialog.remove();if(!leave&&previous?.isConnected)previous.focus({preventScroll:true});resolve(leave)}
  dialog.querySelector<HTMLButtonElement>('[data-stay]')!.onclick=()=>finish(false)
  dialog.querySelector<HTMLButtonElement>('[data-leave]')!.onclick=()=>finish(true)
  dialog.onclose=()=>finish(false);dialog.oncancel=event=>{event.preventDefault();finish(false)}
  document.body.append(dialog)
  try{dialog.showModal();dialog.querySelector<HTMLButtonElement>('[data-stay]')!.focus()}catch{finish(false)}
 })
}
