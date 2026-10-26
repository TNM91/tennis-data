import type {PlayerCareerHighs} from '../../lib/player-performance'
import styles from './player-career-records.module.css'
export default function PlayerCareerRecords({careerHighs,coverage='Best marks across the full tracked history for this profile.'}:{careerHighs:PlayerCareerHighs;coverage?:string}) {
  return <article className={styles.panel} aria-label="Personal records"><div className={styles.kicker}>Career highs</div><h2 className={styles.title}>Personal records</h2><p className={styles.copy}>{coverage}</p><dl className={styles.grid}>
    {careerHighs.peakRating!==null?<div className={styles.metric}><dt>Peak TIQ</dt><dd>{careerHighs.peakRating.toFixed(2)}<small>Highest rating reached</small></dd></div>:null}
    {careerHighs.longestStreak>1?<div className={styles.metric} data-tone="blue"><dt>Best win streak</dt><dd>{careerHighs.longestStreak}W<small>Consecutive wins</small></dd></div>:null}
    {careerHighs.bestSeason?<div className={styles.metric} data-tone="green"><dt>Best season</dt><dd>{careerHighs.bestSeason.year}<small>{careerHighs.bestSeason.wins}W-{careerHighs.bestSeason.losses}L - {careerHighs.bestSeason.winRate}% win rate</small></dd></div>:null}
    {careerHighs.mostMatchesSeason&&careerHighs.mostMatchesSeason.year!==careerHighs.bestSeason?.year?<div className={styles.metric} data-tone="orange"><dt>Most active season</dt><dd>{careerHighs.mostMatchesSeason.year}<small>{careerHighs.mostMatchesSeason.total} matches played</small></dd></div>:null}
  </dl></article>
}
