import Link from 'next/link'
import TiqFeatureIcon, { type TiqFeatureIconName } from '@/components/brand/TiqFeatureIcon'
import styles from './team-profile.module.css'

export default function TeamQuickActions({ chatHref, lineupHref, availabilityHref }: { chatHref: string; lineupHref?: string; availabilityHref?: string }) {
  const actions: { label: string; href: string; icon: TiqFeatureIconName; primary?: boolean }[] = [
    ...(lineupHref ? [{ label: 'Build lineup', href: lineupHref, icon: 'lineupBuilder' as const, primary: true }] : []),
    ...(availabilityHref ? [{ label: 'Availability', href: availabilityHref, icon: 'reliabilityIndex' as const }] : []),
    { label: 'Schedule & calendar', href: '#team-schedule', icon: 'schedule' },
    { label: 'Team Chat', href: chatHref, icon: 'messagingCenter' },
  ]
  return <nav className={styles.quickActions} aria-label="Your team actions">
    {actions.map(action => {
      // Calendar disclosures listen for native hashchange events, not router history updates.
      const ActionLink = action.href.startsWith('#') ? 'a' : Link
      return <ActionLink key={action.label} href={action.href} className={action.primary ? styles.primary : undefined}>
        <span aria-hidden="true"><TiqFeatureIcon name={action.icon} size="sm" variant="ghost" /></span>
        <span>{action.label}</span>
      </ActionLink>
    })}
  </nav>
}
