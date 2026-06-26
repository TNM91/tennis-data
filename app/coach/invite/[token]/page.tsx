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
      'radial-gradient(circle at 8% 0%, rgba(155, 225, 29, 0.16), transparent 30%), linear-gradient(180deg, #071226 0%, #0b1728 52%, #050b16 100%)',
    color: '#f7fbff',
    padding: 'clamp(14px, 4vw, 42px)',
  },
  panel: {
    maxWidth: 1080,
    margin: '0 auto',
    border: '1px solid rgba(155, 225, 29, 0.18)',
    borderRadius: 24,
    overflow: 'hidden',
    background: 'rgba(7, 18, 38, 0.88)',
    boxShadow: '0 28px 90px rgba(0, 0, 0, 0.34)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
    padding: '18px clamp(18px, 4vw, 34px)',
    background: 'rgba(5, 11, 22, 0.82)',
    color: '#fff',
    borderBottom: '1px solid rgba(255,255,255,0.08)',
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
    gridTemplateColumns: 'minmax(0, 1.08fr) minmax(280px, .92fr)',
    gap: 0,
  },
  main: {
    padding: 'clamp(24px, 5vw, 50px)',
    minWidth: 0,
  },
  rail: {
    display: 'grid',
    alignContent: 'start',
    gap: 14,
    padding: 'clamp(20px, 4vw, 38px)',
    background: 'rgba(255,255,255,0.045)',
    borderLeft: '1px solid rgba(255,255,255,0.09)',
    minWidth: 0,
  },
  eyebrow: {
    color: '#9be11d',
    fontSize: 12,
    fontWeight: 900,
    letterSpacing: '.12em',
    textTransform: 'uppercase',
  },
  title: {
    margin: '12px 0 14px',
    color: '#ffffff',
    fontSize: 'clamp(32px, 6vw, 58px)',
    lineHeight: .96,
    fontWeight: 950,
    letterSpacing: 0,
    maxWidth: 720,
  },
  copy: {
    margin: 0,
    color: '#b8c8dc',
    fontSize: 16,
    lineHeight: 1.62,
    fontWeight: 720,
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
    background: 'linear-gradient(180deg, #eaff9e 0%, #9be11d 100%)',
    color: '#071226',
    padding: '13px 18px',
    fontWeight: 950,
    boxShadow: '0 14px 26px rgba(121, 184, 47, 0.28)',
    cursor: 'pointer',
    textDecoration: 'none',
  },
  secondaryButton: {
    border: '1px solid rgba(255,255,255,0.16)',
    borderRadius: 999,
    background: 'rgba(255,255,255,0.06)',
    color: '#ffffff',
    padding: '12px 18px',
    fontWeight: 900,
    cursor: 'pointer',
    textDecoration: 'none',
  },
  card: {
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 18,
    background: 'rgba(5,11,22,0.38)',
    padding: 16,
    boxShadow: 'none',
    minWidth: 0,
  },
  stat: {
    display: 'grid',
    gap: 6,
    padding: '14px 0',
    borderBottom: '1px solid rgba(15, 37, 67, 0.1)',
  },
  label: {
    color: '#9be11d',
    fontSize: 11,
    fontWeight: 900,
    letterSpacing: '.12em',
    textTransform: 'uppercase',
  },
  value: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 900,
    overflowWrap: 'anywhere',
  },
  note: {
    marginTop: 16,
    borderRadius: 18,
    border: '1px solid rgba(155,225,29,0.2)',
    background: 'rgba(155,225,29,0.08)',
    color: '#dce8f9',
    padding: 18,
    fontSize: 14,
    lineHeight: 1.55,
  },
  nextStepCard: {
    display: 'grid',
    gap: 7,
    marginTop: 22,
    padding: 16,
    borderRadius: 18,
    border: '1px solid rgba(155,225,29,0.28)',
    background: 'rgba(155,225,29,0.09)',
    color: '#dce8f9',
    minWidth: 0,
  },
  nextStepTitle: {
    margin: 0,
    color: '#ffffff',
    fontSize: 20,
    lineHeight: 1.15,
    fontWeight: 950,
  },
  nextStepCopy: {
    margin: 0,
    color: '#b8c8dc',
    fontSize: 14,
    lineHeight: 1.5,
    fontWeight: 760,
    overflowWrap: 'anywhere',
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
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 18,
    background: 'rgba(255,255,255,0.055)',
    padding: 14,
    color: '#b8c8dc',
    fontSize: 13,
    lineHeight: 1.45,
    fontWeight: 760,
    minWidth: 0,
  },
  pathLabel: {
    color: '#9be11d',
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

function getInviteStatusLabel(status: CoachStudentInvite['status'] | undefined) {
  if (status === 'accepted') return 'Accepted'
  if (status === 'revoked') return 'Revoked'
  if (status === 'expired') return 'Expired'
  if (status === 'pending') return 'Waiting on player'
  return 'Loading'
}

function getInviteStatusBlockMessage(status: CoachStudentInvite['status'] | undefined) {
  if (status === 'expired') return 'This setup link expired. Ask your coach to send a fresh setup link.'
  if (status === 'revoked') return 'This setup link is no longer active. Ask your coach to send a new setup link.'
  return ''
}

function getInviteNextStep({
  authResolved,
  loading,
  status,
  userId,
}: {
  authResolved: boolean
  loading: boolean
  status: CoachStudentInvite['status'] | undefined
  userId: string | null
}) {
  if (!authResolved || loading) {
    return {
      title: 'Checking your setup link',
      copy: 'TenAceIQ is loading the coach connection before you choose the account to use.',
    }
  }

  if (!userId) {
    return {
      title: 'Sign in or create your player account',
      copy: 'Use the email you want tied to your player profile. Your coach does not need your email before sending this setup link.',
    }
  }

  if (status === 'accepted') {
    return {
      title: 'Coach connection is active',
      copy: 'Open My Lab to see coach-assigned work, or continue into development paths for self-guided Level Up reps.',
    }
  }

  if (status === 'expired') {
    return {
      title: 'This setup link expired',
      copy: 'Ask your coach to text a fresh TenAceIQ setup link from Coach Hub.',
    }
  }

  if (status === 'revoked') {
    return {
      title: 'This setup link is no longer active',
      copy: 'Ask your coach to send a new setup link if they still want this player account connected.',
    }
  }

  return {
    title: 'Accept the coach connection',
    copy: 'Confirm the signed-in account below, then accept so Coach Hub can send assignments, recaps, and review notes to the right player profile.',
  }
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
  const loginParams = new URLSearchParams({ next: nextHref })
  if (invite?.inviteEmail) loginParams.set('email', invite.inviteEmail)
  if (invite?.inviteEmail) loginParams.set('switchAccount', '1')
  const loginHref = `/login?${loginParams.toString()}`
  const signedInEmail = session?.user?.email ?? ''
  const invitedEmailLabel = invite?.inviteEmail || 'Open invite'
  const signedInAccountLabel = getSignedInAccountLabel(signedInEmail, userId)
  const inviteAccountMatch = getInviteAccountMatch(invite?.inviteEmail ?? '', signedInEmail, Boolean(userId))
  const inviteNotPending = Boolean(invite?.status && invite.status !== 'pending' && invite.status !== 'accepted')
  const inviteEmailMismatch = Boolean(
    invite?.inviteEmail &&
    userId &&
    signedInEmail.trim().toLowerCase() !== invite.inviteEmail.trim().toLowerCase(),
  )
  const acceptBlockedMessage = inviteNotPending
    ? getInviteStatusBlockMessage(invite?.status)
    : inviteEmailMismatch
      ? `This setup link is for ${invite?.inviteEmail}. Sign in with that email to accept the coach connection.`
      : ''
  const acceptButtonDisabled = accepting || Boolean(acceptBlockedMessage)

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

    if (acceptBlockedMessage) {
      setMessage(acceptBlockedMessage)
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
  const statusLabel = getInviteStatusLabel(invite?.status)
  const nextStep = getInviteNextStep({
    authResolved,
    loading,
    status: invite?.status,
    userId,
  })

  return (
    <main style={pageStyles.shell} className="coach-invite-shell">
      <section style={pageStyles.panel}>
        <div style={pageStyles.header} className="coach-invite-header">
          <div style={pageStyles.brand}>
            <TiqFeatureIcon name="myLab" size="sm" variant="ghost" />
            <span>TenAceIQ Coach Connect</span>
          </div>
          <span style={{ color: '#9be11d', fontSize: 12, fontWeight: 900, letterSpacing: '.14em', textTransform: 'uppercase' }}>
            Coach-linked workflow
          </span>
        </div>

        <div style={pageStyles.body} className="coach-invite-grid">
          <div style={pageStyles.main}>
            <span style={pageStyles.eyebrow}>Coach invite</span>
            <h1 style={pageStyles.title}>Finish the player setup your coach started.</h1>
            <p style={pageStyles.copy}>
              Open this link, create or sign into your player account, add the email you want tied to your profile,
              then accept the coach connection so assignments and recaps land in the right place.
            </p>
            <div style={pageStyles.nextStepCard} aria-label="Coach invite next step">
              <span style={pageStyles.eyebrow}>Next step</span>
              <h2 style={pageStyles.nextStepTitle}>{nextStep.title}</h2>
              <p style={pageStyles.nextStepCopy}>{nextStep.copy}</p>
            </div>
            <div style={pageStyles.pathGrid} aria-label="Coach invite path">
              {invitePathSteps.map((step) => (
                <div key={step.label} style={pageStyles.pathCard}>
                  <span style={pageStyles.pathLabel}>{step.label}</span>
                  <strong style={{ color: '#ffffff' }}>{step.title}</strong>
                  <span>{step.copy}</span>
                </div>
              ))}
            </div>

            {message ? (
              <p style={{ ...pageStyles.note, background: message.includes('connected') || message.includes('Coach connected') ? '#102a21' : '#071226' }}>
                {message}
              </p>
            ) : null}
            {acceptBlockedMessage ? (
              <p style={{ ...pageStyles.note, background: '#2a1710', borderColor: 'rgba(255,185,125,0.32)' }}>
                {acceptBlockedMessage}
              </p>
            ) : null}

            <div style={pageStyles.actions} className="coach-invite-actions">
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
              ) : inviteNotPending ? (
                <>
                  <Link href="/player-development" style={pageStyles.primaryButton}>
                    Open development paths
                  </Link>
                  <Link href="/contact" style={pageStyles.secondaryButton}>
                    Contact TenAceIQ
                  </Link>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={acceptInvite}
                    disabled={acceptButtonDisabled}
                    title={acceptBlockedMessage || undefined}
                    style={{
                      ...pageStyles.primaryButton,
                      opacity: acceptButtonDisabled ? 0.62 : 1,
                      cursor: acceptButtonDisabled ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {accepting ? 'Connecting' : 'Accept coach invite'}
                  </button>
                  {acceptBlockedMessage ? (
                    <Link href={loginHref} style={pageStyles.secondaryButton}>
                      Sign in with invited email
                    </Link>
                  ) : null}
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
                <strong style={{ color: '#9be11d' }}>Coach note</strong>
                <br />
                {invite.message}
              </div>
            ) : null}

            <div style={{ ...pageStyles.card, marginTop: 18 }} aria-label="Coach link proof">
              <span style={pageStyles.eyebrow}>Linking proof</span>
              <h2 style={{ margin: '8px 0 10px', color: '#ffffff', fontSize: 22, lineHeight: 1.12 }}>
                Know what your coach can see.
              </h2>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#b8c8dc', fontSize: 14, lineHeight: 1.65, fontWeight: 760 }}>
                {inviteTrustChecks.map((check) => (
                  <li key={check}>{check}</li>
                ))}
              </ul>
            </div>

            <div style={{ ...pageStyles.card, marginTop: 18 }} aria-label="Coach invite acceptance proof">
              <span style={pageStyles.eyebrow}>Acceptance proof</span>
              <h2 style={{ margin: '8px 0 10px', color: '#ffffff', fontSize: 22, lineHeight: 1.12 }}>
                Confirm the link before testing assignments.
              </h2>
              <ul style={{ margin: 0, paddingLeft: 18, color: '#b8c8dc', fontSize: 14, lineHeight: 1.65, fontWeight: 760 }}>
                {inviteAcceptanceProofChecks.map((check) => (
                  <li key={check}>{check}</li>
                ))}
              </ul>
            </div>

            <div style={{ ...pageStyles.card, marginTop: 18 }} aria-label="Coach invite account proof cue">
              <span style={pageStyles.eyebrow}>Account proof cue</span>
              <h2 style={{ margin: '8px 0 10px', color: '#ffffff', fontSize: 22, lineHeight: 1.12 }}>
                Confirm the account before accepting.
              </h2>
              <div style={{ display: 'grid', gap: 10, color: '#b8c8dc', fontSize: 14, lineHeight: 1.45, fontWeight: 760 }}>
                <div>
                  <strong style={{ color: '#ffffff' }}>Invite:</strong> {statusLabel} for {studentName}
                </div>
                <div>
                  <strong style={{ color: '#ffffff' }}>Invited email:</strong> {invitedEmailLabel}
                </div>
                <div>
                  <strong style={{ color: '#ffffff' }}>Signed-in account:</strong> {signedInAccountLabel}
                </div>
                <div>
                  <strong style={{ color: '#ffffff' }}>Acceptance check:</strong> {inviteAccountMatch}
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
          .coach-invite-shell {
            padding: 10px !important;
          }
          .coach-invite-header {
            align-items: flex-start !important;
            flex-direction: column !important;
          }
          .coach-invite-grid {
            grid-template-columns: 1fr !important;
          }
          .coach-invite-grid > aside {
            border-left: 0 !important;
            border-top: 1px solid rgba(255, 255, 255, 0.09) !important;
          }
          .coach-invite-actions {
            display: grid !important;
            grid-template-columns: 1fr !important;
          }
          .coach-invite-actions a,
          .coach-invite-actions button,
          .coach-invite-actions span {
            width: 100% !important;
            text-align: center !important;
            box-sizing: border-box !important;
          }
        }
      `}</style>
    </main>
  )
}
