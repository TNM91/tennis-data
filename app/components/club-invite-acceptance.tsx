'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useAuth } from '@/app/components/auth-provider'
import { getClubInviteLanding, getClubRoleLabel, type ClubInviteLanding, type ClubInviteTarget, type ClubRole } from '@/lib/club-workspace'
import styles from './club-workspace.module.css'

type InvitePreview = {
  clubId: string
  clubName: string
  clubSlug: string
  clubLogoUrl: string
  email: string
  roles: ClubRole[]
  target: ClubInviteTarget
  status: string
  expiresAt: string
}

type AcceptInviteResponse = {
  ok: boolean
  landing?: ClubInviteLanding
  message?: string
}

export default function ClubInviteAcceptance({ token }: { token: string }) {
  const router = useRouter()
  const { authResolved, session, userId } = useAuth()
  const [invite, setInvite] = useState<InvitePreview | null>(null)
  const [acceptedLanding, setAcceptedLanding] = useState<ClubInviteLanding | null>(null)
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void fetch(`/api/clubs/invites/${encodeURIComponent(token)}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json() as { ok: boolean; invite?: InvitePreview; message?: string }
        if (!response.ok || !data.invite) throw new Error(data.message || 'Invitation not found.')
        setInvite(data.invite)
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === 'AbortError') return
        setMessage(error instanceof Error ? error.message : 'Invitation not found.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [token])

  useEffect(() => {
    if (!acceptedLanding) return
    const timeout = window.setTimeout(() => router.replace(acceptedLanding.href), 900)
    return () => window.clearTimeout(timeout)
  }, [acceptedLanding, router])

  async function acceptInvite() {
    if (!session?.access_token) return
    setAccepting(true)
    setMessage('')
    try {
      const response = await fetch(`/api/clubs/invites/${encodeURIComponent(token)}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await response.json() as AcceptInviteResponse
      if (!response.ok || !data.landing) throw new Error(data.message || 'This invitation could not be accepted.')
      setAcceptedLanding(data.landing)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'This invitation could not be accepted.')
    } finally {
      setAccepting(false)
    }
  }

  const inviteHref = `/clubs/invite/${token}`
  const invitedEmail = invite?.email.trim().toLowerCase() ?? ''
  const signedInEmail = session?.user.email?.trim().toLowerCase() ?? ''
  const inviteEmailMismatch = Boolean(userId && invitedEmail && signedInEmail !== invitedEmail)
  const landing = invite ? getClubInviteLanding({ id: invite.clubId, name: invite.clubName, slug: invite.clubSlug }, invite.roles, invite.target) : null
  const signInHref = buildInviteAuthHref('/login', inviteHref, invite?.email, Boolean(userId))
  const joinHref = buildInviteAuthHref('/join', inviteHref, invite?.email)
  const title = acceptedLanding
    ? `You’re connected to ${invite?.clubName || 'the club'}.`
    : loading
      ? 'Opening invitation...'
      : invite
        ? `Join ${invite.clubName}`
        : 'Invitation unavailable'

  return (
    <main className={styles.page}>
      <section className={`${styles.empty} ${styles.inviteShell}`}>
        {invite?.clubLogoUrl ? <Image className={styles.inviteLogo} src={invite.clubLogoUrl} alt={`${invite.clubName} logo`} width={72} height={72} unoptimized /> : null}
        <div>
          <p className={styles.eyebrow}>{acceptedLanding ? 'Club connected' : 'Club invitation'}</p>
          <h1 className={styles.title}>{title}</h1>
        </div>

        {invite ? (
          <>
            <p className={styles.copy}>{invite.target.type === 'club' ? 'You were invited to the club' : <>You were invited to <strong>{invite.target.name}</strong></>} as {invite.roles.map(getClubRoleLabel).join(' + ')}.</p>
            <div className={styles.roleList}>{invite.roles.map((role) => <span className={styles.pill} key={role}>{getClubRoleLabel(role)}</span>)}</div>

            <div className={styles.inviteAccountCheck} aria-label="Club invite account check">
              <div><span>Invite sent to</span><strong>{invite.email}</strong></div>
              <div><span>Signed in as</span><strong>{userId ? session?.user.email || 'Signed-in account' : 'Not signed in'}</strong></div>
            </div>

            {landing ? (
              <div className={styles.inviteDestination} aria-label="Club invite destination">
                <p className={styles.eyebrow}>Opens next</p>
                <strong>{landing.title}</strong>
                <span>{landing.detail}</span>
              </div>
            ) : null}
          </>
        ) : null}

        {acceptedLanding ? (
          <div className={styles.inviteSuccess} role="status">
            <strong>Opening {acceptedLanding.title}...</strong>
            <span>Your club access and destination are coming with you.</span>
          </div>
        ) : message ? <div className={`${styles.notice} ${styles.danger}`} role="alert">{message}</div> : null}

        {!acceptedLanding && authResolved && invite ? (
          !userId ? (
            <div className={styles.row}>
              <Link className={styles.primary} href={signInHref}>Sign in as {invite?.email || 'invited user'}</Link>
              <Link className={styles.secondary} href={joinHref}>Create account</Link>
            </div>
          ) : inviteEmailMismatch ? (
            <div className={styles.inviteMismatch}>
              <strong>This invitation belongs to another account.</strong>
              <span>Switch to {invite?.email} to connect the correct profile.</span>
              <Link className={styles.primary} href={signInHref}>Switch account</Link>
            </div>
          ) : invite?.status === 'pending' ? (
            <button className={styles.primary} disabled={accepting} type="button" onClick={() => void acceptInvite()}>{accepting ? 'Connecting...' : `Accept and ${landing?.actionLabel.toLowerCase() || 'open club'}`}</button>
          ) : invite?.status === 'accepted' && landing ? (
            <Link className={styles.primary} href={landing.href}>{landing.actionLabel}</Link>
          ) : invite ? (
            <p className={styles.copy}>This invitation is {invite.status || 'not active'}. Ask the club to send a new link.</p>
          ) : null
        ) : acceptedLanding ? <button className={styles.primary} type="button" onClick={() => router.replace(acceptedLanding.href)}>{acceptedLanding.actionLabel}</button> : null}
      </section>
    </main>
  )
}

function buildInviteAuthHref(path: '/login' | '/join', nextHref: string, email = '', switchingAccount = false) {
  const params = new URLSearchParams({ next: nextHref })
  if (email) params.set('email', email)
  if (switchingAccount) params.set('switchAccount', '1')
  return `${path}?${params.toString()}`
}
