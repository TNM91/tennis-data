import {PLAYER_DEVELOPMENT_IDENTITIES,PLAYER_DEVELOPMENT_PLAYING_STYLES,PLAYER_DEVELOPMENT_FOCUS_PATHS,getPlayerDevelopmentIdentityActionRead} from '../../lib/player-development'
import {getRecommendedLevelUpCards} from '../../lib/level-up/level-up-cards'
import {getPlayerTrainingMenus} from '../../lib/player-training-menus'
import {html} from './match-details'
export type TrainingChoices={style:string;focus:string;active:string}
export const emptyTrainingChoices=():TrainingChoices=>({style:'',focus:'',active:''})
export function trainingIdentity(slug:string){return PLAYER_DEVELOPMENT_IDENTITIES.find(i=>i.slug===slug)||null}
export function parseTrainingChoices(raw:string|null):TrainingChoices{
 try{const p=JSON.parse(raw||'null');if(!p||p.version!==1||typeof p.style!=='string'||typeof p.focus!=='string'||typeof p.active!=='string')return emptyTrainingChoices();const style=PLAYER_DEVELOPMENT_PLAYING_STYLES.some(i=>i.slug===p.style)?p.style:'',focus=PLAYER_DEVELOPMENT_FOCUS_PATHS.some(i=>i.slug===p.focus)?p.focus:'';return {style,focus,active:p.active&&(p.active===style||p.active===focus)?p.active:''}}catch{return emptyTrainingChoices()}
}
export function chooseTrainingIdentity(choices:TrainingChoices,slug:string):TrainingChoices{if(PLAYER_DEVELOPMENT_PLAYING_STYLES.some(i=>i.slug===slug))return {...choices,style:slug,active:slug};if(PLAYER_DEVELOPMENT_FOCUS_PATHS.some(i=>i.slug===slug))return {...choices,focus:slug,active:slug};throw Error('Choose a playing style or training focus.')}
export function loadTrainingChoices(owner:string,storage:Pick<Storage,'getItem'>){try{return owner?parseTrainingChoices(storage.getItem('tenaceiq:native-training:v1:'+owner)):emptyTrainingChoices()}catch{return emptyTrainingChoices()}}
export function saveTrainingChoices(owner:string,choices:TrainingChoices,storage:Pick<Storage,'setItem'>){if(!owner)return false;try{storage.setItem('tenaceiq:native-training:v1:'+owner,JSON.stringify({version:1,...choices}));return true}catch{return false}}
const trainingMenuLabels:Record<string,string>={solo:'On your own',partner:'With a partner',offCourt:'Away from the court',performance:'Body and movement'}
export function trainingPlanHtml(choices:TrainingChoices,persisted=true,canCreate=false){
 const identity=trainingIdentity(choices.active)
 const read=identity?getPlayerDevelopmentIdentityActionRead(identity):null
 const [recommended,...moreDrills]=identity?getRecommendedLevelUpCards(identity.slug,6):[]
 return `
 ${!persisted?'<p role="alert">Your choice is available for this visit only. Device storage is unavailable.</p>':''}
 ${identity?`<div class="training-direction-hero" role="region" aria-labelledby="active-training-direction">
  <small class="stat-eyebrow">${choices.active===choices.focus?'Development focus':'Playing style'}</small>
  <h2 id="active-training-direction" data-direction-title tabindex="-1">${html(identity.title.replace(/^The /,''))}</h2>
  <p>${html(identity.archetype)}</p>
  <div class="training-direction-cue"><small class="stat-eyebrow">Match cue</small><p>${html(identity.mantra)}</p></div>
 </div>
 ${recommended?`<div class="training-direction-drill">
  <div class="training-direction-drill-meta"><small class="stat-eyebrow">Recommended drill</small><span class="training-catalog-time">${recommended.durationMinutes} min</span></div>
  <h2>${html(recommended.title)}</h2>
  <button type="button" class="secondary" data-card="${html(recommended.id)}">Preview drill<span class="sr-only"> ${html(recommended.title)}</span></button>
 </div>`:''}
 <button type="button" class="secondary training-direction-week" data-week-create ${canCreate?'':'hidden'}>Create this week’s plan</button>`
 :'<div class="training-direction-hero"><h2>Pick a direction</h2><p>Choose how you like to build points or a skill to sharpen next.</p></div>'}
 <details class="training-inbox-fold" ${identity?'':'open'}>
  <summary>${identity?'Change style or focus':'Choose your playing style or focus'}</summary>
  <form data-identity>
   <div class="training-direction-choice">
    <label>Playing style<select name="style"><option value="">Choose a style</option>${PLAYER_DEVELOPMENT_PLAYING_STYLES.map(option=>`<option value="${html(option.slug)}" ${choices.style===option.slug?'selected':''}>${html(option.title.replace(/^The /,''))}</option>`).join('')}</select></label>
    <button type="submit" class="secondary" name="kind" value="style">Train with this style</button>
   </div>
   <div class="training-direction-choice">
    <label>Development focus<select name="focus"><option value="">Choose a focus</option>${PLAYER_DEVELOPMENT_FOCUS_PATHS.map(option=>`<option value="${html(option.slug)}" ${choices.focus===option.slug?'selected':''}>${html(option.title.replace(/^The /,''))}</option>`).join('')}</select></label>
    <button type="submit" class="secondary" name="kind" value="focus">Train with this focus</button>
   </div>
   <p role="alert" tabindex="-1" data-identity-feedback></p>
  </form>
  ${persisted?'<p>Style and focus are saved on this device. Completed sessions save to your account with the active direction.</p>':''}
  ${choices.style||choices.focus?'<button type="button" class="secondary" data-clear-identity>Clear training choices</button>':''}
 </details>
 ${identity&&read?`
  <details class="training-inbox-fold" data-inbox-fold="direction-cues"><summary>Your match cues</summary>
   <dl><dt>Train first</dt><dd>${html(read.trainingPriority)}</dd><dt>Proof target</dt><dd>${html(read.proofTarget)}</dd><dt>Watch for</dt><dd>${html(read.leakWatch)}</dd><dt>Match test</dt><dd>${html(read.matchTrigger)}</dd></dl>
  </details>
  ${moreDrills.length?`<details class="training-inbox-fold" data-inbox-fold="direction-drills"><summary>More recommended drills</summary>
   <ul class="training-direction-more" role="list">${moreDrills.map(card=>`<li><h3>${html(card.title)}</h3><p>${card.durationMinutes} min · ${html(card.tennisGoal)}</p><button type="button" class="secondary" data-card="${html(card.id)}">Preview drill<span class="sr-only"> ${html(card.title)}</span></button></li>`).join('')}</ul>
  </details>`:''}
  <details class="training-inbox-fold" data-inbox-fold="direction-ideas"><summary>Practice ideas for your game</summary>
   ${Object.entries(getPlayerTrainingMenus(identity)).map(([key,rows])=>`<h3>${html(trainingMenuLabels[key])}</h3><ul>${rows.map(([title,body])=>`<li><strong>${html(title)}</strong><p>${html(body)}</p></li>`).join('')}</ul>`).join('')}
  </details>
  <details class="training-inbox-fold" data-inbox-fold="direction-guide"><summary>Your development path</summary>
   <p>Use these weekly guides at your pace. Saved Weeks tracks the reps in your weekly plan.</p>
   ${identity.weeks.map(week=>`<div class="training-direction-guide-week"><h3>Week ${week.week}: ${html(week.title)}</h3><p>${html(week.objective)}</p><p><strong>Main drill</strong> · ${html(week.mainDrill)}</p><p><strong>Pressure game</strong> · ${html(week.pressureGame)}</p><p><strong>Proof</strong> · ${html(week.accountability)}</p><p><strong>Cue</strong> · ${html(week.coachCue)}</p></div>`).join('')}
  </details>`:''}`
}
