export function confirmTeamNavigation():Promise<boolean>{
 if(document.querySelector('[data-team-navigation-warning]'))return Promise.resolve(false)
 const draft=document.querySelector<HTMLElement>('#chat-draft')
 const previous=draft?.getClientRects().length?draft:document.activeElement instanceof HTMLElement?document.activeElement:null
 const dialog=document.createElement('dialog');dialog.className='captain-lineup-dialog';dialog.dataset.teamNavigationWarning='';dialog.setAttribute('aria-labelledby','leave-team-title');dialog.setAttribute('aria-describedby','leave-team-description');dialog.innerHTML='<h2 id="leave-team-title">Leave My teams?</h2><p id="leave-team-description">Your unfinished message or open team review will be discarded.</p><button type="button" class="secondary" data-stay>Keep editing</button><button type="button" data-leave>Leave My teams</button>'
 return new Promise(resolve=>{let settled=false;const finish=(leave:boolean)=>{if(settled)return;settled=true;dialog.remove();if(!leave&&previous?.isConnected)previous.focus({preventScroll:true});resolve(leave)};dialog.querySelector<HTMLButtonElement>('[data-stay]')!.onclick=()=>finish(false);dialog.querySelector<HTMLButtonElement>('[data-leave]')!.onclick=()=>finish(true);dialog.onclose=()=>finish(false);dialog.oncancel=e=>{e.preventDefault();finish(false)};document.body.append(dialog);try{dialog.showModal();dialog.querySelector<HTMLButtonElement>('[data-stay]')!.focus()}catch{finish(false)}})
}

export function createTeamNavigationGuard(hasDraft:()=>boolean,revision:()=>number,confirm:()=>Promise<boolean>=confirmTeamNavigation){
 return (action:()=>void)=>{const version=revision();if(!hasDraft()){action();return}void confirm().then(leave=>{if(leave&&version===revision())action()}).catch(()=>{/* Keep the current team if the warning cannot open. */})}
}
