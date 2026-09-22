import type { ProductAccessState } from './access-model'

export type HeaderWorkspaceShortcut = {
  href: string
  label: string
}

export function getHeaderWorkspaceShortcut(
  access: ProductAccessState,
  authenticated: boolean,
): HeaderWorkspaceShortcut | null {
  if (!authenticated) return null
  if (access.canUseLeagueTools) return { href: '/league-coordinator', label: 'League Office' }
  if (access.canUseCaptainWorkflow) return { href: '/captain', label: 'Team Hub' }
  if (access.canUseCoachWorkflow) return { href: '/coach', label: 'Coach Hub' }
  if (access.canUseAdvancedPlayerInsights) return { href: '/mylab', label: 'My Lab' }
  return { href: '/explore', label: 'Find tennis' }
}
