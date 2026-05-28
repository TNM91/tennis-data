import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const authEntryFiles = [
  'app/login/page.tsx',
  'app/join/page.tsx',
  'app/reset-password/page.tsx',
  'app/forget-password/page.tsx',
]

const sources = new Map(
  authEntryFiles.map((file) => [file, readFileSync(join(process.cwd(), file), 'utf8')]),
)

function styleBlock(source: string, styleName: string) {
  const pattern = new RegExp(`const ${styleName}: CSSProperties = ([\\s\\S]*?)(?=\\nconst |\\nfunction |\\nexport |$)`)
  const match = source.match(pattern)
  if (!match) throw new Error(`Missing style block: ${styleName}`)
  return match[0]
}

describe('auth entry mobile layout guards', () => {
  it('keeps Forgot Password on shared auth without local role polling', () => {
    const source = sources.get('app/forget-password/page.tsx')!
    expect(source).toContain("import { useAuth } from '@/app/components/auth-provider'")
    expect(source).toContain('const { authResolved } = useAuth()')
    expect(source).toContain('const authLoading = !authResolved')
    expect(source).not.toContain('getClientAuthState')
    expect(source).not.toContain('const [role, setRole]')
    expect(source).not.toContain('supabase.auth.onAuthStateChange')
  })

  it('keeps Join on shared auth before redirecting signed-in users', () => {
    const source = sources.get('app/join/page.tsx')!
    expect(source).toContain("import { useAuth } from '@/app/components/auth-provider'")
    expect(source).toContain('const { role, entitlements, authResolved } = useAuth()')
    expect(source).toContain('const authLoading = !authResolved')
    expect(source).toContain("if (!authResolved || role === 'public') return")
    expect(source).toContain('router.replace(getDefaultSignedInRoute(role, entitlements))')
    expect(source).toContain("if (access.currentPlanId === 'coach') return '/coach'")
    expect(source).not.toContain('getClientAuthState')
    expect(source).not.toContain('const [role, setRole]')
    expect(source).not.toContain('supabase.auth.onAuthStateChange')
  })

  it('keeps Login on shared auth before resolving post-login routing', () => {
    const source = sources.get('app/login/page.tsx')!
    expect(source).toContain("import { useAuth } from '@/app/components/auth-provider'")
    expect(source).toContain('const { role, userId, entitlements, authResolved, refreshAuth } = useAuth()')
    expect(source).toContain("if (!authResolved || role !== 'public' || redirecting)")
    expect(source).toContain('refreshAuth()')
    expect(source).not.toContain('getClientAuthState')
    expect(source).not.toContain('const [role, setRole]')
    expect(source).not.toContain('supabase.auth.onAuthStateChange')
  })

  it('uses shrink-safe one-column grids on auth entry shells', () => {
    for (const [file, source] of sources) {
      expect(source, file).not.toContain("? '1fr'")
    }

    for (const file of authEntryFiles) {
      const source = sources.get(file)!
      expect(source).toContain("gridTemplateColumns: 'minmax(0, 1fr)'")
      expect(source).not.toContain(
        "gridTemplateColumns: isTablet ? 'minmax(0, 1fr)' : 'minmax(0, 1.05fr) minmax(min(100%, 360px), 0.95fr)'",
      )
    }

    expect(sources.get('app/login/page.tsx')).toContain(
      "gridTemplateColumns: isSmallMobile ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) minmax(0, auto)'",
    )
    expect(sources.get('app/reset-password/page.tsx')).not.toContain("'repeat(2, minmax(0, 1fr))'")
    expect(sources.get('app/forget-password/page.tsx')).not.toContain("'repeat(2, minmax(0, 1fr))'")
  })

  it('keeps auth shell, panel, and form containers shrinkable', () => {
    for (const [file, source] of sources) {
      for (const styleName of ['heroShell', 'formCard']) {
        expect(styleBlock(source, styleName), `${file} ${styleName}`).toContain('minWidth: 0')
      }
    }

    for (const file of ['app/login/page.tsx', 'app/join/page.tsx']) {
      const source = sources.get(file)!
      expect(styleBlock(source, 'loginPanel')).toContain('minWidth: 0')
      expect(styleBlock(source, 'loginPanelInner')).toContain('minWidth: 0')
    }

    expect(styleBlock(sources.get('app/login/page.tsx')!, 'loginPanelGlow')).toContain('inset: 0')
    expect(styleBlock(sources.get('app/join/page.tsx')!, 'loginPanelGlow')).toContain(
      "width: 'min(100%, 250px)'",
    )
    expect(styleBlock(sources.get('app/join/page.tsx')!, 'selectedPlanCardStyle')).toContain('minWidth: 0')

    for (const file of ['app/reset-password/page.tsx', 'app/forget-password/page.tsx']) {
      const source = sources.get(file)!
      expect(styleBlock(source, 'formPanel')).toContain('minWidth: 0')
      expect(styleBlock(source, 'formPanelInner')).toContain('minWidth: 0')
    }

    expect(styleBlock(sources.get('app/reset-password/page.tsx')!, 'formPanelGlow')).toContain('inset: 0')
    expect(styleBlock(sources.get('app/forget-password/page.tsx')!, 'formPanelGlow')).toContain('inset: 0')
  })

  it('wraps long auth labels, notices, and action text instead of forcing overflow', () => {
    for (const [file, source] of sources) {
      for (const styleName of ['heroTitle', 'heroText', 'formTitle', 'inputLabel', 'submitButton', 'successBanner', 'errorBanner', 'inlineLink']) {
        expect(styleBlock(source, styleName), `${file} ${styleName}`).toContain("overflowWrap: 'anywhere'")
      }
    }

    for (const file of ['app/login/page.tsx', 'app/join/page.tsx', 'app/reset-password/page.tsx', 'app/forget-password/page.tsx']) {
      const eyebrowBlock = styleBlock(sources.get(file)!, 'eyebrow')
      expect(eyebrowBlock).toContain("maxWidth: '100%'")
      expect(eyebrowBlock).toContain("whiteSpace: 'normal'")
      expect(eyebrowBlock).toContain("overflowWrap: 'anywhere'")
    }

    expect(styleBlock(sources.get('app/login/page.tsx')!, 'togglePasswordButton')).toContain(
      "overflowWrap: 'anywhere'",
    )
    expect(styleBlock(sources.get('app/login/page.tsx')!, 'passwordWrap')).toContain(
      "'minmax(0, 1fr) minmax(0, auto)'",
    )
    expect(styleBlock(sources.get('app/login/page.tsx')!, 'passwordWrap')).toContain('minWidth: 0')
    expect(styleBlock(sources.get('app/login/page.tsx')!, 'inlineLinkMuted')).toContain(
      "overflowWrap: 'anywhere'",
    )
    expect(styleBlock(sources.get('app/join/page.tsx')!, 'identityCueStyle')).toContain(
      "overflowWrap: 'anywhere'",
    )
    expect(styleBlock(sources.get('app/join/page.tsx')!, 'identityCueStyle')).toContain(
      "gridTemplateColumns: 'minmax(0, 36px) minmax(0, 1fr)'",
    )
    expect(styleBlock(sources.get('app/reset-password/page.tsx')!, 'togglePasswordButton')).toContain(
      "overflowWrap: 'anywhere'",
    )
    expect(styleBlock(sources.get('app/reset-password/page.tsx')!, 'helperRow')).toContain(
      "maxWidth: '100%'",
    )
    expect(styleBlock(sources.get('app/reset-password/page.tsx')!, 'inlineLinkMuted')).toContain(
      "overflowWrap: 'anywhere'",
    )
    expect(styleBlock(sources.get('app/forget-password/page.tsx')!, 'destinationPillStyle')).toContain(
      "overflowWrap: 'anywhere'",
    )
    expect(styleBlock(sources.get('app/forget-password/page.tsx')!, 'helperRow')).toContain(
      "maxWidth: '100%'",
    )
    expect(styleBlock(sources.get('app/forget-password/page.tsx')!, 'inlineLinkMuted')).toContain(
      "overflowWrap: 'anywhere'",
    )

    for (const [file, source] of sources) {
      expect(source, file).not.toMatch(/width: '[0-9]{3}px'/)
    }
    expect(sources.get('app/join/page.tsx')).not.toContain("gridTemplateColumns: '24px minmax(0, 1fr)'")
    expect(sources.get('app/join/page.tsx')).not.toContain("gridTemplateColumns: '36px minmax(0, 1fr)'")
    expect(sources.get('app/join/page.tsx')).not.toContain("gridTemplateColumns: '42px minmax(0, 1fr)'")
  })
})
