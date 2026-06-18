'use client'

export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { useParams } from 'next/navigation'
import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import SiteShell from '@/app/components/site-shell'
import { useAuth } from '@/app/components/auth-provider'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import { buildProductAccessState } from '@/lib/access-model'
import type { CoachStudentInvite } from '@/lib/coach-invites'

type InviteStudentPreview = {
  playerName: string
  identitySlug: string
  levelLabel: string
}

type InviteResponse = {
  ok?: boolean
  invite?: CoachStudentInvite
  student?: InviteStudentPreview
  message?: string
}

const pageStyles = {
  shell: {
    minHeight: '100vh',
    background:
      'radial-gradient(circle at 12% 0%, rgba(164, 255, 46, 0.14), transparent 32%), linear-gradient(135deg, #f7fbff 0%, #eef5ec 100%)',
    color: '#0b1730',
    padding: 'clamp(24px, 5vw, 56px)',
  },
  panel: {
    maxWidth: 1040,
    margin: '0 auto',
    border: '1px solid rgba(121, 184, 47, 0.24)',
    borderRadius: 28,
    overflow: 'hidden',
    background: '#ffffff',
    boxShadow: '0 28px 80px rgba(5, 18, 40, 0.16)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    padding: '20px clamp(22px, 4vw, 40px)',
    background: 'linear-gradient(110deg, #071226 0%, #102a21 100%)',
    color: '#fff',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    fontWeight: 900,
    letterSpacing: '.08em',
    textTransform: 'uppercase',
  },
  body: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1.15fr) minmax(280px, .85fr)',
    gap: 0,
  },
  main: {
    padding: 'clamp(28px, 5vw, 54px)',
  },
  rail: {
    padding: 'clamp(24px, 4vw, 42px)',
    background: 'linear-gradient(180deg, #f5faed 0%, #ffffff 100%)',
    borderLeft: '1px solid rgba(121, 184, 47, 0.22)',
  },
  eyebrow: {
    color: '#5d8f12',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: '.12em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '12px 0 14px',
    fontSize: 'clamp(34px, 6vw, 64px)',
    lineHeight: .94,
    fontWeight: 950,
    letterSpacing: 0,
  },
  copy: {
    margin: 0,
    color: '#435775',
    fontSize: 17,
    lineHeight: 1.7,
  },
  actions: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 28,
  },
  primaryButton: {
    border: 0,
    borderRadius: 999,
    background: '#a6ff2e',
    color: '#071226',
    padding: '13px 20px',
    fontWeight: 900,
    boxShadow: '0 14px 26px rgba(121, 184, 47, 0.28)',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  secondaryButton: {
    border: '1px solid rgba(15, 37, 67, 0.18)',
    borderRadius: 999,
    background: '#fff',
    color: '#0b1730',
    padding: '12px 18px',
    fontWeight: 900,
    cursor: 'pointer',
    textDecoration: 'none',
  },
  card: {
    border: '1px solid rgba(15, 37, 67, 0.12)',
    borderRadius: 20,
    background: '#fff',
    padding: 18,
    boxShadow: '0 18px 40px rgba(5, 18, 40, 0.08)',
  },
  stat: {
    display: 'grid',
    gap: 6,
    padding: '14px 0',
    borderBottom: '1px solid rgba(15, 37, 67, 0.1)',
  },
  label: {
    color: '#71809b',
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: '.12em',
    textTransform: 'uppercase',
  },
  value: {
    color: '#0b1730',
    fontSize: 16,
    fontWeight: 900,
  },
  note: {
    marginTop: 18,
    borderRadius: 18,
    background: '#071226',
    color: '#dce8f9',
    padding: 18,
    fontSize: 14,
    lineHeight: 1.55,
  },
  pathGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 170px), 1fr))',
    gap: 10,
    marginTop: 22,
  },
  pathCard: {
    display: 'grid',
    gap: 8,
    border: '1px solid rgba(15, 37, 67, 0.12)',
    borderRadius: 18,
    background: 'linear-gradient(180deg, #ffffff 0%, #f7fbff 100%)',
    padding: 14,
    color: '#435775',
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 760,
  },
  pathLabel: {
    color: '#5d8f12',
    fontSize: 11,
    fontWeight: 950,
    letterSpacing: '.1em',
    textTransform: 'uppercase',
  },
} satisfies Record<string, CSSProperties>

const invitePathSteps = [
  {
    label: 'Free',
    title: 'Accept the coach link',
    copy: 'Your coach can keep you on their student board and hand you useful printed or digital guide work.',
  },
  {
    label: 'Player',
    title: 'Activate connected follow-through',
    copy: 'Assignments, recaps, coach feedback, and progress history appear in My Lab.',
  },
  {
    label: 'Coach',
    title: 'Keep the loop moving',
    copy: 'Your coach can assign work, review evidence, and message you from Coach Hub.',
  },
] as const

const inviteTrustChecks = [
  'Accepting links this player account to this coach relationship.',
  'The coach can see coach-assigned work, synced proof, recaps, and review status for that relationship.',
  'Private local-only Level Up logs stay off the coach review queue until the player syncs or shares them.',
] as const

const inviteAcceptanceProofChecks = [
  'Invite page shows the expected coach relationship and invited player email.',
  'Accepted status appears after the player signs in and accepts.',
  'Coach Hub shows the linked player before any assigned proof is reviewed.',
] as const

function getSignedInAccountLabel(email: string, userId: string | null) {
  if (email) return email
  if (userId) return `Signed in account ${userId.slice(0, 8)}`
  return 'Not signed in'
}

function getInviteAccountMatch(inviteEmail: string, signedInEmail: string, signedIn: boolean) {
  if (!inviteEmail) return 'No email lock'
  if (signedInEmail && signedInEmail.trim().toLowerCase() === inviteEmail.trim().toLowerCase()) return 'Email matches invite'
  if (signedIn) return 'Signed-in email must match invite before accepting'
  return 'Sign in with invited email'
}

export default function CoachInvitePage() {
  return (
    <SiteShell active="/coach">
      <CoachInviteContent />
    </SiteShell>
  )
}

function CoachInviteContent() {
  const params = useParams<{ token?: string | string[] }>()
  const token = useMemo(() => {
    const rawToken = params.token
    return Array.isArray(rawToken) ? rawToken[0] ?? '' : rawToken ?? ''
  }, [params.token])
  const { authResolved, entitlements, role, session, userId } = useAuth()
  const access = useMemo(() => buildProductAccessState(userId ? role : 'public', entitlements), [entitlements, role, userId])
  const [invite, setInvite] = useState<CoachStudentInvite | null>(null)
  const [student, setStudent] = useState<InviteStudentPreview | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)

  const nextHref = `/coach/invite/${encodeURIComponent(token)}`
  const signupParams = new URLSearchParams({
    plan: 'player_plus',
    next: nextHref,
  })
  if (invite?.inviteEmail) signupParams.set('email', invite.inviteEmail)
  const playerHref = `/join?${signupParams.toString()}`
  const loginHref = `/login?next=${encodeURIComponent(nextHref)}`
  const signedInEmail = session?.user?.email ?? ''
  const invitedEmailLabel = invite?.inviteEmail || 'Open invite'
  const signedInAccountLabel = getSignedInAccountLabel(signedInEmail, userId)
  const inviteAccountMatch = getInviteAccountMatch(invite?.inviteEmail ?? '', signedInEmail, Boolean(userId))

  const loadInvite = useCallback(async () => {
    if (!token) return
    setLoading(true)
    setMessage('')
    try {
      const response = await fetch(`/api/coach/invites/${encodeURIComponent(token)}`)
      const json = (await response.json()) as InviteResponse
      if (!response.ok || !json.ok || !json.invite) {
        throw new Error(json.message || 'This coach invite could not be loaded.')
      }
      setInvite(json.invite)
      setStudent(json.student ?? null)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'This coach invite could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void loadInvite()
  }, [loadInvite])

  const acceptInvite = async () => {
    if (!session?.access_token || !token) {
      setMessage('Sign in to accept this coach invite.')
      return
    }

    setAccepting(true)
    setMessage('')
    try {
      const response = await fetch(`/api/coach/invites/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const json = (await response.json()) as InviteResponse
      if (!response.ok || !json.ok) {
        throw new Error(json.message || 'This coach invite could not be accepted.')
      }
      setInvite((current) => (current ? { ...current, status: 'accepted' } : current))
      setMessage('Coach connected. Your coach-assigned Level Up work is linked; Player unlocks full self-guided history and trends.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'This coach invite could not be accepted.')
    } finally {
      setAccepting(false)
    }
  }

  const studentName = student?.playerName || 'Player'
  const statusLabel = invite?.status ? invite.status.replace('-', ' ') : 'loading'

  return (
    <main style={pageStyles.shell}>
      <section style={pageStyles.panel}>
        <div style={pageStyles.header}>
          <div style={pageStyles.brand}>
            <TiqFeatureIcon name="myLab" size="sm" variant="ghost" />
            <span>TenAceIQ Coach Connect</span>
          </div>
          <span style={{ color: '#a6ff2e', fontSize: 12, fontWeight: 900, letterSpacing: '.14em', textTransform: 'uppercase' }}>
            Coach-linked workflow
          </span>
        </div>

        <div style={pageStyles.body} className="coach-invite-grid">
          <div style={pageStyles.main}>
            <span style={pageStyles.eyebrow}>Coach invite</span>
            <h1 style={pageStyles.title}>Finish the player setup your coach started.</h1>
            <p style={pageStyles.copy}>
              Create or sign into your account, accept the coach link, and your development work can move from the
              printed guide into TenAceIQ assignments, recaps, match reflections, and accountability tracking.
            </p>
            <div style={pageStyles.pathGrid} aria-label="Coach invite path">
              {invitePathSteps.map((step) => (
                <div key={step.label} style={pageStyles.pathCard}>
                  <span style={pageStyles.pathLabel}>{step.label}</span>
                  <strong style={{ color: '#0b1730' }}>{step.title}</strong>
                  <span>{step.copy}</span>
                </div>
              ))}
            </div>

            {message ? (
              <p style={{ ...pageStyles.note, background: message.includes('connected') || message.includes('Coach connected') ? '#102a21' : '#071226' }}>
                {message}
              </p>
            ) : null}

            <div style={pageStyles.actions}>
              {!authResolved || loading ? (
                <span style={pageStyles.secondaryButton}>Loading invite</span>
              ) : !userId ? (
                <>
                  <Link href={loginHref} style={pageStyles.primaryButton}>
                    Sign in to accept
                  </Link>
                  <Link href={playerHref} style={pageStyles.secondaryButton}>
                    Create account
                  </Link>
                </>
              ) : invite?.status === 'accepted' ? (
                access.canUseAdvancedPlayerInsights ? (
                  <>
                    <Link href="/mylab#coach-assignments" style={pageStyles.primaryButton}>
                      Open My Lab
                    </Link>
                    <Link href="/player-development" style={pageStyles.secondaryButton}>
                      Open development paths
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/mylab#coach-assignments" style={pageStyles.primaryButton}>
                      Open My Lab
                    </Link>
                    <Link href={playerHref} style={pageStyles.secondaryButton}>
                      Unlock Player
                    </Link>
                  </>
                )
              ) : (
                <>
                  <button type="button" onClick={acceptInvite} disabled={accepting} style={pageStyles.primaryButton}>
                    {accepting ? 'Connecting' : 'Accept coach invite'}
                  </button>
                  {!access.canUseAdvancedPlayerInsights ? (
                    <Link href={playerHref} style={pageStyles.secondaryButton}>
                      Upgrade to Player
                    </Link>
                  ) : null}
                </>
              )}
            </div>
          </div>

          <aside style={pageStyles.rail}>
            <div style={pageStyles.card}>
              <div style={pageStyles.stat}>
                <span style={pageStyles.label}>Player</span>
                <span style={pageStyles.value}>{loading ? 'Loading' : studentName}</span>
              </div>
              <div style={pageStyles.stat}>
                <span style={pageStyles.label}>Invite status</span>
                <span style={pageStyles.value}>{statusLabel}</span>
              </div>
              <div style={pageStyles.stat}>
                <span style={pageStyles.label}>Invited email</span>
                <span style={pageStyles.value}>{invite?.inviteEmail || 'Open invite'}</span>
              </div>
              <div style={{ ...pageStyles.stat, borderBottom: 0 }}>
                <span style={pageStyles.label}>Development lane</span>
                <span style={pageStyles.value}>{student?.levelLabel || 'Player development'}</span>
              </div>
            </div>

            {invite?.message ? (
              <div style={pageStyles.note}>
                <strong style={{ color: '#a6ff2e' }}>Coach note</strong>
                <br />
                {invite.message}
              </div>
            ) : null}

            <div style={{ ...pageStyles.card, marginTop: 18 }} aria-label="Coach link proof">
              <span style={pageStyles.eyebrow}>Linking proof</span>
              <h2 style={{ margin: '8px 0 10px', color: '#0b1730', fontSize: 22, lineHeight: 1.12 }}>
                Know what your coach can see.
              </h2>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#435775', fontSize: 14, lineHeight: 1.65, fontWeight: 760 }}>
                {inviteTrustChecks.map((check) => (
                  <li key={check}>{check}</li>
                ))}
              </ul>
            </div>

            <div style={{ ...pageStyles.card, marginTop: 18 }} aria-label="Coach invite acceptance proof">
              <span style={pageStyles.eyebrow}>Acceptance proof</span>
              <h2 style={{ margin: '8px 0 10px', color: '#0b1730', fontSize: 22, lineHeight: 1.12 }}>
                Confirm the link before testing assignments.
              </h2>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#435775', fontSize: 14, lineHeight: 1.65, fontWeight: 760 }}>
                {inviteAcceptanceProofChecks.map((check) => (
                  <li key={check}>{check}</li>
                ))}
              </ul>
            </div>

            <div style={{ ...pageStyles.card, marginTop: 18 }} aria-label="Coach invite account proof cue">
              <span style={pageStyles.eyebrow}>Account proof cue</span>
              <h2 style={{ margin: '8px 0 10px', color: '#0b1730', fontSize: 22, lineHeight: 1.12 }}>
                Confirm the account before accepting.
              </h2>
              <div style={{ display: 'grid', gap: 10, color: '#435775', fontSize: 14, lineHeight: 1.45, fontWeight: 760 }}>
                <div>
                  <strong style={{ color: '#0b1730' }}>Invite:</strong> {statusLabel} for {studentName}
                </div>
                <div>
                  <strong style={{ color: '#0b1730' }}>Invited email:</strong> {invitedEmailLabel}
                </div>
                <div>
                  <strong style={{ color: '#0b1730' }}>Signed-in account:</strong> {signedInAccountLabel}
                </div>
                <div>
                  <strong style={{ color: '#0b1730' }}>Acceptance check:</strong> {inviteAccountMatch}
                </div>
              </div>
            </div>

            <p style={{ ...pageStyles.copy, marginTop: 18, fontSize: 14 }}>
              The printed workbook remains a standalone development tool. Your coach invite unlocks assigned work and
              check-ins from that coach; Player unlocks the full self-guided layer across your own training.
            </p>
          </aside>
        </div>
      </section>

      <style jsx>{`
        @media (max-width: 820px) {
          .coach-invite-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </main>
  )
}
