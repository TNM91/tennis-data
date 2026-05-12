import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const weeklyBriefSource = readFileSync(join(process.cwd(), 'app/captain/weekly-brief/page.tsx'), 'utf8')
const teamBriefSource = readFileSync(join(process.cwd(), 'app/captain/team-brief/page.tsx'), 'utf8')

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
})
