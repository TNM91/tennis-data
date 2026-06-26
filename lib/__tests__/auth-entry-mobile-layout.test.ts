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
    expect(source).toContain("destination: 'My Lab'")
    expect(source).toContain('return getDefaultProductHomeRoute(role, entitlements)')
    expect(source).not.toContain("destination: 'My Lab setup'")
    expect(source).not.toContain("import { loadUserProfileLink } from '@/lib/user-profile'")
    expect(source).not.toContain('loadUserProfileLink(userId)')
    expect(source).not.toContain('requiresPersonalIdentity')
    expect(source).not.toContain('getClientAuthState')
    expect(source).not.toContain('const [role, setRole]')
    expect(source).not.toContain('supabase.auth.onAuthStateChange')
  })

  it('keeps Login return-path copy tied to the selected tennis tool', () => {
    const source = sources.get('app/login/page.tsx')!
    expect(source).toContain('Open the tennis map.')
    expect(source).toContain('Sign in, search the tennis map, and choose the right tools when your tennis needs more support.')
    expect(source).toContain('Continue to My Lab.')
    expect(source).toContain('Sign in to pick up your player home, matchup prep, follows, and messages.')
    expect(source).toContain('Continue to Coach Hub.')
    expect(source).toContain('Sign in to return to lessons, drill assignments, player proof, and coach-player follow-through.')
    expect(source).toContain('Continue to Team Hub.')
    expect(source).toContain('Continue to League Office.')
    expect(source).toContain('Continue to Full-Court.')
    expect(source).toContain('Sign in to move between My Lab, Coach Hub, Team Hub, League Office, and Tournament Desk.')
    expect(source).toContain('Next tennis tool: {selectedIntent.destination}')
    expect(source).toContain('Opening your next tennis tool...')
    expect(source).toContain("selectedPlanId === 'free' ? 'Sign in' : `Continue to ${selectedIntent.destination}`")
    expect(source).not.toContain('Redirecting to your workspace...')
    expect(source).not.toContain('when it needs a workspace.')
    expect(source).not.toContain('when it needs a home base.')
    expect(source).not.toContain('next tennis job')
    expect(source).not.toContain('Open TenAceIQ.')
    expect(source).not.toContain('Welcome back.')
    expect(source).not.toContain("destination: 'Full-Court workspace'")
    expect(source).not.toContain('Next: {selectedIntent.destination}')
  })

  it('prefills invited login emails without overwriting typed input', () => {
    const source = sources.get('app/login/page.tsx')!

    expect(source).toContain("import { useRouter, useSearchParams } from 'next/navigation'")
    expect(source).toContain('const searchParams = useSearchParams()')
    expect(source).toContain("const emailPrefill = searchParams.get('email')?.trim() ?? ''")
    expect(source).toContain('setEmail((current) => current || emailPrefill)')
  })

  it('keeps password recovery copy tied to returning to tennis work', () => {
    const forgotPassword = sources.get('app/forget-password/page.tsx')!
    const resetPassword = sources.get('app/reset-password/page.tsx')!

    expect(forgotPassword).toContain('Get back to your tennis account.')
    expect(forgotPassword).toContain('Enter your email and TenAceIQ will send a secure link back to your saved tennis work.')
    expect(forgotPassword).toContain('Next step: check your inbox')
    expect(forgotPassword).toContain('Send secure link')
    expect(forgotPassword).toContain('Reset link sent. Check your inbox, then return to your tennis account.')
    expect(forgotPassword).not.toContain('Reset your password.')
    expect(forgotPassword).not.toContain('Next: check your inbox')
    expect(forgotPassword).not.toContain('Send reset email')

    expect(resetPassword).toContain('Password reset')
    expect(resetPassword).toContain('Set your new password.')
    expect(resetPassword).toContain('Secure the account, then return to your saved tennis work.')
    expect(resetPassword).toContain('Next step: sign back in')
    expect(resetPassword).toContain('Choose new password')
    expect(resetPassword).toContain('Password updated. Sending you back to login...')
    expect(resetPassword).not.toContain('Create a new password.')
    expect(resetPassword).not.toContain('Next: open your workspace')
    expect(resetPassword).not.toContain('Reset password</h2>')
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
    expect(styleBlock(sources.get('app/join/page.tsx')!, 'mobileSelectedPlanActionRowStyle')).toContain(
      "gridTemplateColumns: 'minmax(0, 1fr)'",
    )
    expect(styleBlock(sources.get('app/join/page.tsx')!, 'mobileSelectedPlanLinkStyle')).toContain(
      'minHeight: 42',
    )
    expect(styleBlock(sources.get('app/join/page.tsx')!, 'mobileSignInLink')).toContain(
      'minHeight: 42',
    )
    expect(styleBlock(sources.get('app/join/page.tsx')!, 'authLoadingIconStyle')).toContain(
      'width: 32',
    )

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
    expect(styleBlock(sources.get('app/login/page.tsx')!, 'mobileHelperRow')).toContain(
      "gridTemplateColumns: 'minmax(0, 1fr)'",
    )
    expect(styleBlock(sources.get('app/login/page.tsx')!, 'mobilePrimaryAuthLink')).toContain(
      "minHeight: 42",
    )
    expect(styleBlock(sources.get('app/login/page.tsx')!, 'mobileSecondaryAuthLink')).toContain(
      "minHeight: 42",
    )
    expect(styleBlock(sources.get('app/login/page.tsx')!, 'mobileFooterPrompt')).toContain(
      "justifyItems: 'center'",
    )
    expect(styleBlock(sources.get('app/login/page.tsx')!, 'authLoadingIconStyle')).not.toContain(
      'boxShadow',
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
