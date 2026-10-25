import React from 'react'
import {renderToStaticMarkup} from 'react-dom/server'
import MyLabCommandCenter from '../../app/mylab/my-lab-command-center'
import FindCommandPanel from '../../components/explore/FindCommandPanel'
import TiqFeatureIcon,{type TiqFeatureIconName} from '../../components/brand/TiqFeatureIcon'
export function renderWebsiteUi(){
 const lab=(linked:boolean)=>renderToStaticMarkup(<MyLabCommandCenter firstName={linked?'TIQ_FIRST_NAME':''} playerId={linked?'TIQ_PLAYER_ID':''} playerName={linked?'TIQ_PLAYER_NAME':''} repTitle={linked?'Choose one tennis focus':'Find your player record'} repNote={linked?'Choose a focus, practise a useful rep, then record what improved.':'Connect your tennis so every read, matchup, and rep belongs to you.'} repDuration={null} repHref={linked?'/level-up':'/profile'} repCta={linked?'Choose my focus':'Find yourself'} completedSessions={0} sessionTarget={4} progressHref="/native-training-progress" progressAvailable={false} matchup={null} nextCourtEvent={null} firstServeSteps={[]} postRepReturn={null}/>);
 const icons:Record<string,string>={};for(const [name,icon]of Object.entries({lab:'myLab',explore:'exploreTennis',following:'playerRatings',matchup:'matchupAnalysis',teams:'lineupBuilder',catalog:'improveTennis',inbox:'matchPrep',progress:'reports'}))icons[name]=renderToStaticMarkup(<TiqFeatureIcon name={icon as TiqFeatureIconName} size="sm" variant="ghost"/>);
 return {labLinked:lab(true),labUnlinked:lab(false),explore:renderToStaticMarkup(<FindCommandPanel compact mobile native/>),icons};
}
