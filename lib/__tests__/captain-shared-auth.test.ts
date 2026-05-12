import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const weeklyBriefSource = readFileSync(join(process.cwd(), 'app/captain/weekly-brief/page.tsx'), 'utf8')
const teamBriefSource = readFileSync(join(process.cwd(), 'app/captain/team-brief/page.tsx'), 'utf8')
const lineupProjectionSource = readFileSync(join(process.cwd(), 'app/captain/lineup-projection/page.tsx'), 'utf8')
const scenarioBuilderSource = readFileSync(join(process.cwd(), 'app/captain/scenario-builder/page.tsx'), 'utf8')
const analyticsSource = readFileSync(join(process.cwd(), 'app/captain/analytics/page.tsx'), 'utf8')
const availabilitySource = readFileSync(join(process.cwd(), 'app/captain/availability/page.tsx'), 'utf8')

describe('Captain shared auth access', () => {
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
    expect(lineupProjectionSource).toContain("import { AuthProvider, useAuth } from '@/app/components/auth-provider'")
    expect(lineupProjectionSource).toContain('<AuthProvider>')
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
})
