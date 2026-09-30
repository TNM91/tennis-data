'use client'

import { useCallback, useMemo, useState, type CSSProperties } from 'react'
import {
  canDeleteLeagueWithConfirmation,
} from '@/lib/league-lifecycle'
import {
  isLeagueDelegateInviteExpired,
  isValidLeagueDelegateEmail,
  normalizeLeagueDelegateEmail,
} from '@/lib/league-delegates'
import { removeTiqLeague, transferTiqLeagueOwnership } from '@/lib/tiq-league-service'
import type { TiqLeagueRecord } from '@/lib/tiq-league-registry'
import { supabase } from '@/lib/supabase'

type DelegateRow = {
  user_id: string
  email: string
  display_name: string
  role: 'owner' | 'delegate'
}

type InviteRow = {
  id: string
  email: string
  invite_token: string
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  expires_at: string
}

export default function LeagueLifecyclePanel({
  league,
  userId,
  onRemoved,
  onOwnershipChanged,
}: {
  league: TiqLeagueRecord
  userId: string | null
  onRemoved: (leagueId: string) => void
  onOwnershipChanged: () => Promise<void>
}) {
  const isOwner = Boolean(userId && (!league.createdByUserId || league.createdByUserId === userId))
  const [loaded, setLoaded] = useState(false)
  const [busy, setBusy] = useState(false)
  const [delegates, setDelegates] = useState<DelegateRow[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [transferUserId, setTransferUserId] = useState('')
  const [transferConfirmation, setTransferConfirmation] = useState('')
  const [deleteConfirmation, setDeleteConfirmation] = useState('')
  const [message, setMessage] = useState('')

  const activeInvites = useMemo(
    () => invites.filter((invite) => invite.status === 'pending' && !isLeagueDelegateInviteExpired(invite.expires_at)),
    [invites],
  )
  const selectedDelegate = delegates.find((delegate) => delegate.user_id === transferUserId) || null
  const transferConfirmed = canDeleteLeagueWithConfirmation(league.leagueName, transferConfirmation)
  const deleteConfirmed = canDeleteLeagueWithConfirmation(league.leagueName, deleteConfirmation)

  const loadAccess = useCallback(async () => {
    if (!isOwner || !league.createdByUserId) {
      setLoaded(true)
      return
    }
    const [delegateResult, inviteResult] = await Promise.all([
      supabase.from('tiq_league_delegates').select('user_id,email,display_name,role').eq('league_id', league.id).order('created_at'),
      supabase.from('tiq_league_delegate_invites').select('id,email,invite_token,status,expires_at').eq('league_id', league.id).order('created_at', { ascending: false }),
    ])
    setDelegates((delegateResult.data || []) as DelegateRow[])
    setInvites((inviteResult.data || []) as InviteRow[])
    if (delegateResult.error || inviteResult.error) setMessage('League access details could not be loaded. Try again in a moment.')
    setLoaded(true)
  }, [isOwner, league.createdByUserId, league.id])

  async function inviteDelegate() {
    const email = normalizeLeagueDelegateEmail(inviteEmail)
    if (!isValidLeagueDelegateEmail(email)) {
      setMessage('Enter a valid email for the future owner or delegate.')
      return
    }
    if (delegates.some((delegate) => normalizeLeagueDelegateEmail(delegate.email) === email)) {
      setMessage('That person already has league access.')
      return
    }
    if (activeInvites.some((invite) => normalizeLeagueDelegateEmail(invite.email) === email)) {
      setMessage('That email already has a pending invitation.')
      return
    }
    setBusy(true)
    const { data, error } = await supabase.from('tiq_league_delegate_invites').insert({
      league_id: league.id,
      email,
      invited_by_user_id: userId,
    }).select('id,email,invite_token,status,expires_at').single()
    if (error || !data) {
      setMessage('The invitation could not be created. Only the current owner can invite people.')
    } else {
      const invite = data as InviteRow
      setInvites((current) => [invite, ...current])
      setInviteEmail('')
      const inviteUrl = `${window.location.origin}/league-delegate/${invite.invite_token}`
      await navigator.clipboard.writeText(inviteUrl).catch(() => undefined)
      setMessage('Invitation created and its secure link copied. They must accept before ownership can move.')
    }
    setBusy(false)
  }

  async function transferOwnership() {
    if (!selectedDelegate || !transferConfirmed) return
    setBusy(true)
    const result = await transferTiqLeagueOwnership({ leagueId: league.id, newOwnerUserId: selectedDelegate.user_id })
    if (!result.transferred) {
      setMessage(result.warning || 'League ownership could not be transferred.')
    } else {
      setMessage(`${selectedDelegate.display_name || selectedDelegate.email || 'The delegate'} is now the league owner. You remain connected as a delegate.`)
      setTransferUserId('')
      setTransferConfirmation('')
      await onOwnershipChanged()
    }
    setBusy(false)
  }

  async function deleteLeague() {
    if (!deleteConfirmed) return
    setBusy(true)
    const result = await removeTiqLeague(league.id, { localOnly: !league.createdByUserId })
    if (!result.removed) {
      setMessage(result.warning || 'The league was not removed.')
    } else {
      onRemoved(league.id)
    }
    setBusy(false)
  }

  if (!isOwner) return null

  return (
    <details
      style={panelStyle}
      onToggle={(event) => {
        if (event.currentTarget.open && !loaded) void loadAccess()
      }}
    >
      <summary style={summaryStyle}>
        <span style={summaryCopyStyle}>
          <strong style={summaryTitleStyle}>Manage owner or delete league</strong>
          <small style={summaryDetailStyle}>Transfer ownership or permanently remove this league.</small>
        </span>
        <span style={summaryActionStyle}>Owner tools</span>
      </summary>
      <div style={bodyStyle}>
        <div style={sectionStyle}>
          <strong>Change league owner</strong>
          <p style={copyStyle}>Invite the next owner first. After they accept, select them below and transfer the league without rebuilding it.</p>
          {league.createdByUserId ? (
            <>
              <div style={inputRowStyle}>
                <input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="newowner@example.com" style={inputStyle} />
                <button type="button" onClick={() => void inviteDelegate()} disabled={busy} style={quietButtonStyle}>Invite</button>
              </div>
              {activeInvites.length ? <small style={mutedStyle}>{activeInvites.map((invite) => invite.email).join(', ')} invited</small> : null}
              {delegates.length ? (
                <div style={transferStyle}>
                  <select value={transferUserId} onChange={(event) => { setTransferUserId(event.target.value); setTransferConfirmation('') }} style={inputStyle}>
                    <option value="">Choose an accepted delegate</option>
                    {delegates.map((delegate) => <option key={delegate.user_id} value={delegate.user_id}>{delegate.display_name || delegate.email || 'League delegate'}</option>)}
                  </select>
                  {selectedDelegate ? (
                    <>
                      <label style={labelStyle}>Type <strong>{league.leagueName}</strong> to confirm<input value={transferConfirmation} onChange={(event) => setTransferConfirmation(event.target.value)} autoComplete="off" style={inputStyle} /></label>
                      <button type="button" onClick={() => void transferOwnership()} disabled={busy || !transferConfirmed} style={warningButtonStyle}>Transfer ownership</button>
                    </>
                  ) : null}
                </div>
              ) : loaded ? <small style={mutedStyle}>No accepted delegates yet.</small> : <small style={mutedStyle}>Loading league access…</small>}
            </>
          ) : <small style={mutedStyle}>Sync this device-only league before transferring ownership.</small>}
        </div>

        <div style={dangerSectionStyle}>
          <strong>Delete league</strong>
          <p style={copyStyle}>This permanently deletes the league, its schedule, entries, results, weekly responses, and recaps. This cannot be undone.</p>
          <label style={labelStyle}>Type <strong>{league.leagueName}</strong> to confirm<input value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" style={inputStyle} /></label>
          <button type="button" onClick={() => void deleteLeague()} disabled={busy || !deleteConfirmed} style={dangerButtonStyle}>Permanently delete league</button>
        </div>
        {message ? <p role="status" style={noticeStyle}>{message}</p> : null}
      </div>
    </details>
  )
}

const panelStyle: CSSProperties = { marginTop: 12, borderRadius: 14, border: '1px solid var(--shell-panel-border)', background: 'color-mix(in srgb, var(--shell-panel-bg) 80%, transparent)', overflow: 'hidden' }
const summaryStyle: CSSProperties = { minHeight: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '8px 12px', color: 'var(--foreground-strong)', cursor: 'pointer' }
const summaryCopyStyle: CSSProperties = { display: 'grid', gap: 2, minWidth: 0 }
const summaryTitleStyle: CSSProperties = { fontSize: 13, fontWeight: 900, lineHeight: 1.3 }
const summaryDetailStyle: CSSProperties = { color: 'var(--shell-copy-muted)', fontSize: 11, fontWeight: 650, lineHeight: 1.35 }
const summaryActionStyle: CSSProperties = { flex: '0 0 auto', borderRadius: 999, background: 'var(--shell-chip-bg)', color: 'var(--brand-green)', padding: '6px 9px', fontSize: 11, fontWeight: 900 }
const bodyStyle: CSSProperties = { display: 'grid', gap: 12, padding: '0 12px 12px' }
const sectionStyle: CSSProperties = { display: 'grid', gap: 9, padding: 12, borderRadius: 12, background: 'var(--shell-chip-bg)', color: 'var(--foreground-strong)' }
const dangerSectionStyle: CSSProperties = { ...sectionStyle, border: '1px solid color-mix(in srgb, #ef4444 36%, var(--shell-panel-border) 64%)' }
const copyStyle: CSSProperties = { margin: 0, color: 'var(--shell-copy-muted)', fontSize: 12, lineHeight: 1.5 }
const inputRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 8 }
const transferStyle: CSSProperties = { display: 'grid', gap: 8 }
const labelStyle: CSSProperties = { display: 'grid', gap: 6, color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 800 }
const inputStyle: CSSProperties = { width: '100%', minHeight: 42, boxSizing: 'border-box', borderRadius: 10, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)', color: 'var(--foreground-strong)', padding: '8px 10px', font: 'inherit' }
const quietButtonStyle: CSSProperties = { minHeight: 42, padding: '0 13px', borderRadius: 999, border: '1px solid var(--shell-panel-border)', background: 'var(--shell-panel-bg)', color: 'var(--foreground-strong)', fontWeight: 900, cursor: 'pointer' }
const warningButtonStyle: CSSProperties = { ...quietButtonStyle, width: 'fit-content', borderColor: 'color-mix(in srgb, #f59e0b 42%, var(--shell-panel-border) 58%)', color: '#f59e0b' }
const dangerButtonStyle: CSSProperties = { ...quietButtonStyle, width: 'fit-content', borderColor: 'color-mix(in srgb, #ef4444 52%, var(--shell-panel-border) 48%)', color: '#ef4444' }
const mutedStyle: CSSProperties = { color: 'var(--shell-copy-muted)', fontSize: 11, lineHeight: 1.4 }
const noticeStyle: CSSProperties = { margin: 0, padding: 10, borderRadius: 10, background: 'color-mix(in srgb, var(--brand-green) 9%, var(--shell-chip-bg) 91%)', color: 'var(--foreground-strong)', fontSize: 12, fontWeight: 750 }
