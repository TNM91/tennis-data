// Synthetic cards only. No production records, credentials, or writes.
import React from 'react'
import { createRoot } from 'react-dom/client'
import TeamHomeCard from '../app/compete/teams/team-home-card'
import styles from '../app/compete/teams/teams-home.module.css'
function App() {
  const [primary, setPrimary] = React.useState(0)
  const names = ['SuperSmash Bros / Autumn Aces', 'Lakeside Weekend Tennis']
  return <main className={styles.home}>
    <h1 className={styles.heading}>Your teams</h1><p>2 teams connected · Synthetic preview</p>
    <div className={styles.teamGrid}>{[0, 1].sort((a, b) => a === primary ? -1 : b === primary ? 1 : 0).map(i =>
      <TeamHomeCard key={i} name={names[i]} league={i ? '2027 Adult 18 & Over Fall' : '2026 Tri-Level 18 & Over'} flight={i ? 'Men 4.5' : 'Men 3.5 / 4.0 / 4.5'}
        isDefault={i === primary} teamHref="/destination?team=Aces&league=Fall" chatHref="/destination?tool=chat&team=Aces"
        lineupHref="/destination?tool=lineup&team=Aces" availabilityHref="/destination?tool=availability&team=Aces#team-availability"
        nextMatch={{ date: i ? '2026-09-13' : '2026-09-14', opponent: i ? 'The Baseliners' : 'Volleys' }}
        onMakeDefault={i === primary ? undefined : () => setPrimary(i)} />
    )}</div>
  </main>
}
createRoot(document.getElementById('root')!).render(<App />)
