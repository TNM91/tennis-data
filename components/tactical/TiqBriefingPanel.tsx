'use client'

import type { TacticalRole, TacticalScenario } from '@/lib/tactical/types'
import { scenarioBriefing, scenarioToJson } from '@/lib/tactical/scenarioExport'
import styles from './TiqTacticalStudio.module.css'

export default function TiqBriefingPanel({ briefingRole, scenario, onBriefingRoleChange }: { briefingRole: TacticalRole; scenario: TacticalScenario; onBriefingRoleChange: (role: TacticalRole) => void }) {
  return (
    <section className={styles.panel}>
      <div className={styles.panelTitle}>Briefing output</div>
      <div className={styles.briefTypes}>
        {(['captain', 'coach', 'player'] as const).map((role) => (
          <button className={`${styles.button} ${briefingRole === role ? styles.active : ''}`} key={role} onClick={() => onBriefingRoleChange(role)} type="button">
            {role}
          </button>
        ))}
      </div>
      <pre className={styles.briefing}>{scenarioBriefing(scenario, briefingRole)}</pre>
      <div className={styles.panelTitle}>Scenario JSON</div>
      <pre className={styles.jsonPreview}>{scenarioToJson(scenario)}</pre>
    </section>
  )
}
