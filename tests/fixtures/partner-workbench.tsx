import {createRoot} from 'react-dom/client'
import PlayerLiveWorkbench from '../../app/player-development/_components/player-live-workbench'

createRoot(document.getElementById('fixture')!).render(<PlayerLiveWorkbench
 identitySlug="return-disruptor-4-0" identityTitle="Return practice" mantra="Read the serve, recover ready."
 identityCourtsideRead={{trainFirst:'Return recovery',proof:'Balanced starts',leak:'Watching the return',nextCue:'Recover ready',starterRep:'Return and recover',starterProofCue:'Keep balance',starterLeakWatch:'Do not rush',starterSmartNext:'Use a controlled serve'}}
 focuses={[{id:'return',title:'Return',cue:'Read the serve',drills:['Return recovery'],tracker:['Balanced recovery']}]}
 solo={[]} partner={[]} offCourt={[]} performance={[["Footwork reset","Move in balance and reset."]]}
/> )
