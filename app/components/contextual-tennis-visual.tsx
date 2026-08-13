import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import styles from './contextual-tennis-visual.module.css'

export type ContextualTennisVisualName =
  | 'explore'
  | 'improve'
  | 'compete'
  | 'captain'
  | 'coach'
  | 'league'
  | 'tournament'
  | 'club'
  | 'manage'
  | 'resources'

type ContextualTennisVisualConfig = {
  primary: TiqFeatureIconName
  secondary: TiqFeatureIconName
}

const VISUAL_CONFIG: Record<ContextualTennisVisualName, ContextualTennisVisualConfig> = {
  explore: { primary: 'opponentScouting', secondary: 'playerRatings' },
  improve: { primary: 'improveTennis', secondary: 'myLab' },
  compete: { primary: 'matchupAnalysis', secondary: 'competeTennis' },
  captain: { primary: 'lineupBuilder', secondary: 'captainTennis' },
  coach: { primary: 'coachTennis', secondary: 'playerRatings' },
  league: { primary: 'leagueTennis', secondary: 'schedule' },
  tournament: { primary: 'competeTennis', secondary: 'schedule' },
  club: { primary: 'clubTennis', secondary: 'coachTennis' },
  manage: { primary: 'captainDashboard', secondary: 'schedule' },
  resources: { primary: 'exploreTennis', secondary: 'improveTennis' },
}

export default function ContextualTennisVisual({
  visual,
  mode = 'hero',
}: {
  visual: ContextualTennisVisualName
  mode?: 'hero' | 'atmosphere'
}) {
  const config = VISUAL_CONFIG[visual]

  return (
    <div
      aria-hidden="true"
      className={`${styles.visual} ${styles[mode]} ${styles[`visual-${visual}`]}`}
      data-contextual-tennis-visual={visual}
    >
      <TiqFeatureIcon
        className={styles.primary}
        name={config.primary}
        size="hero"
        variant="ghost"
      />
      <TiqFeatureIcon
        className={styles.secondary}
        name={config.secondary}
        size="xl"
        variant="ghost"
      />
    </div>
  )
}
