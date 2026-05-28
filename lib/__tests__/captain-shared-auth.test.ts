import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const weeklyBriefSource = readFileSync(join(process.cwd(), 'app/captain/weekly-brief/page.tsx'), 'utf8')
const teamBriefSource = readFileSync(join(process.cwd(), 'app/captain/team-brief/page.tsx'), 'utf8')
const captainHubSource = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')
const lineupProjectionSource = readFileSync(join(process.cwd(), 'app/captain/lineup-projection/page.tsx'), 'utf8')
const scenarioBuilderSource = readFileSync(join(process.cwd(), 'app/captain/scenario-builder/page.tsx'), 'utf8')
const analyticsSource = readFileSync(join(process.cwd(), 'app/captain/analytics/page.tsx'), 'utf8')
const availabilitySource = readFileSync(join(process.cwd(), 'app/captain/availability/page.tsx'), 'utf8')
const lineupAvailabilitySource = readFileSync(join(process.cwd(), 'app/captain/lineup-availability/page.tsx'), 'utf8')
const messagingSource = readFileSync(join(process.cwd(), 'app/captain/messaging/page.tsx'), 'utf8')
const lineupBuilderSource = readFileSync(join(process.cwd(), 'app/captain/lineup-builder/page.tsx'), 'utf8')

describe('Captain shared auth access', () => {
  it('keeps the captain hub on shared auth before resolving team scope', () => {
    expect(captainHubSource).toContain("import { useAuth } from '@/app/components/auth-provider'")
    expect(captainHubSource).toContain('<SiteShell active="/captain">')
    expect(captainHubSource).toContain('const { userId, role, entitlements, authResolved } = useAuth()')
    expect(captainHubSource).toContain("if (!authResolved || role === 'public') return")
    expect(captainHubSource).toContain('void loadCaptainTeamScopes(userId)')
    expect(captainHubSource).not.toContain("import { getClientAuthState } from '@/lib/auth'")
    expect(captainHubSource).not.toContain('const [authLoading, setAuthLoading]')
    expect(captainHubSource).not.toContain("const [role, setRole] = useState<UserRole>('public')")
    expect(captainHubSource).not.toContain('supabase.auth.onAuthStateChange')
  })

  it('keeps weekly and team brief access on the shared auth provider', () => {
    for (const source of [weeklyBriefSource, teamBriefSource]) {
      expect(source).toContain("import { useAuth } from '@/app/components/auth-provider'")
      expect(source).toContain('const { role, entitlements, authResolved } = useAuth()')
      expect(source).toContain('<SiteShell active="/captain">')
      expect(source).toContain('if (!authResolved || role === \'public\') return')
      expect(source).toContain('if (!authResolved)')
      expect(source).not.toContain("import { getClientAuthState } from '@/lib/auth'")
      expect(source).not.toContain('const [authLoading, setAuthLoading]')
      expect(source).not.toContain("const [role, setRole] = useState<UserRole>('public')")
      expect(source).not.toContain('supabase.auth.onAuthStateChange')
    }
  })

  it('keeps projection and scenario tools on shared auth without local role polling', () => {
    expect(lineupProjectionSource).toContain("import { useAuth } from '@/app/components/auth-provider'")
    expect(lineupProjectionSource).toContain('<SiteShell active="/captain">')
    expect(lineupProjectionSource).toContain('const { role, entitlements, authResolved } = useAuth()')
    expect(lineupProjectionSource).toContain('if (!authResolved || role === \'public\') return')

    expect(scenarioBuilderSource).toContain("import { useAuth } from '@/app/components/auth-provider'")
    expect(scenarioBuilderSource).toContain('<SiteShell active="/captain">')
    expect(scenarioBuilderSource).toContain('const { role, entitlements, authResolved } = useAuth()')
    expect(scenarioBuilderSource).toContain('if (!authResolved || role === \'public\') return')

    for (const source of [lineupProjectionSource, scenarioBuilderSource]) {
      expect(source).not.toContain("import { getClientAuthState } from '@/lib/auth'")
      expect(source).not.toContain('const [authLoading, setAuthLoading]')
      expect(source).not.toContain("const [role, setRole] = useState<UserRole>('public')")
      expect(source).not.toContain('supabase.auth.onAuthStateChange')
    }
  })

  it('keeps analytics and availability on shared auth before loading captain data', () => {
    for (const source of [analyticsSource, availabilitySource]) {
      expect(source).toContain("import { useAuth } from '@/app/components/auth-provider'")
      expect(source).toContain('<SiteShell active="/captain">')
      expect(source).toContain('const { role, entitlements, authResolved } = useAuth()')
      expect(source).toContain("if (!authResolved || role === 'public') return")
      expect(source).not.toContain("import { getClientAuthState } from '@/lib/auth'")
      expect(source).not.toContain('const [authLoading, setAuthLoading]')
      expect(source).not.toContain("const [role, setRole] = useState<UserRole>('public')")
      expect(source).not.toContain('supabase.auth.onAuthStateChange')
    }
  })

  it('keeps custom captain availability tooling on shared auth without local role polling', () => {
    expect(lineupAvailabilitySource).toContain("import { useAuth } from '@/app/components/auth-provider'")
    expect(lineupAvailabilitySource).toContain('<SiteShell active="/captain">')
    expect(lineupAvailabilitySource).toContain('const { role, entitlements, authResolved } = useAuth()')
    expect(lineupAvailabilitySource).toContain("if (!authResolved || role === 'public') return")
    expect(lineupAvailabilitySource).not.toContain("import { getClientAuthState } from '@/lib/auth'")
    expect(lineupAvailabilitySource).not.toContain('const [authLoading, setAuthLoading]')
    expect(lineupAvailabilitySource).not.toContain("const [role, setRole] = useState<UserRole>('public')")
    expect(lineupAvailabilitySource).not.toContain('supabase.auth.onAuthStateChange')
  })

  it('keeps captain messaging on shared auth before loading team communication data', () => {
    expect(messagingSource).toContain("import { useAuth } from '@/app/components/auth-provider'")
    expect(messagingSource).toContain('<SiteShell active="/captain">')
    expect(messagingSource).toContain('const { role, entitlements, authResolved } = useAuth()')
    expect(messagingSource).toContain("if (!authResolved || role === 'public') return")
    expect(messagingSource).not.toContain("import { getClientAuthState } from '@/lib/auth'")
    expect(messagingSource).not.toContain('const [authLoading, setAuthLoading]')
    expect(messagingSource).not.toContain("const [role, setRole] = useState<UserRole>('public')")
    expect(messagingSource).not.toContain('supabase.auth.onAuthStateChange')
  })

  it('keeps captain lineup builder on shared auth before loading builder data', () => {
    expect(lineupBuilderSource).toContain("import { useAuth } from '@/app/components/auth-provider'")
    expect(lineupBuilderSource).toContain('<SiteShell active="/captain">')
    expect(lineupBuilderSource).toContain('const { role, entitlements, authResolved } = useAuth()')
    expect(lineupBuilderSource).toContain("if (!authResolved || role === 'public') return")
    expect(lineupBuilderSource).not.toContain("import { getClientAuthState } from '@/lib/auth'")
    expect(lineupBuilderSource).not.toContain('const [authLoading, setAuthLoading]')
    expect(lineupBuilderSource).not.toContain("const [role, setRole] = useState<UserRole>('public')")
    expect(lineupBuilderSource).not.toContain('supabase.auth.onAuthStateChange')
  })
})
