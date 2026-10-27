import {useRef} from 'react'
import type {TeamRosterPlayer} from './team-roster-data'
import {rosterComparisonPlayers} from './roster-comparison-selection'
import styles from '../../app/components/tennis-insight-cards.module.css'
import rosterStyles from './player-roster.module.css'
export function RosterComparisonPicker({rows,selected,onCompare,onClear}:{rows:TeamRosterPlayer[];selected:string[];onCompare:()=>void;onClear:()=>void}){
 const heading=useRef<HTMLHeadingElement>(null),players=rosterComparisonPlayers(rows,selected)
 return <section className={rosterStyles.depth} aria-label="Roster comparison"><h4 tabIndex={-1} ref={heading}>Compare roster players</h4><p>Select two linked players below to open Matchup. Your selections stay while you search or sort.</p><p role="status">{selected.length} of 2 players selected{selected.length?': '+selected.map(id=>rows.find(row=>row.id===id)?.name||'Player unavailable').join(' / '):'.'}</p><button type="button" className={styles.button} disabled={!players} onClick={onCompare}>Compare selected players</button>{selected.length?<button type="button" className={styles.button} onClick={()=>{onClear();heading.current?.focus({preventScroll:true})}}>Clear player selection</button>:null}<p>Choosing a third player replaces the first selection. This compares players as opponents; it does not predict their doubles partnership.</p></section>
}
