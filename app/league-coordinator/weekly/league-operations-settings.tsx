'use client'

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  isLeagueDelegateInviteExpired,
  isValidLeagueDelegateEmail,
  normalizeLeagueDelegateEmail,
} from '@/lib/league-delegates'
import { uploadTiqLeaguePhoto } from '@/lib/tiq-league-photo-service'
import { supabase } from '@/lib/supabase'
import type { TiqLeagueRecord } from '@/lib/tiq-league-registry'

type DelegateRow = {
  user_id: string
  email: string
  display_name: string
  role: 'owner' | 'delegate'
  created_at: string
}

type InviteRow = {
  id: string
  email: string
  invite_token: string
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  expires_at: string
  created_at: string
}

export default function LeagueOperationsSettings({
  league,
  userId,
  onLeagueUpdated,
}: {
  league: TiqLeagueRecord
  userId: string
  onLeagueUpdated: (league: TiqLeagueRecord) => void
}) {
  const [leagueName, setLeagueName] = useState(league.leagueName)
  const [logoUrl, setLogoUrl] = useState(league.photoUrl)
  const [chatEnabled, setChatEnabled] = useState(league.weeklySettings.leagueChatEnabled)
  const [owner, setOwner] = useState(false)
  const [delegates, setDelegates] = useState<DelegateRow[]>([])
  const [invites, setInvites] = useState<InviteRow[]>([])
  const [inviteEmail, setInviteEmail] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(true)

  const activeInvites = useMemo(
    () => invites.filter((invite) => invite.status === 'pending' && !isLeagueDelegateInviteExpired(invite.expires_at)),
    [invites],
  )

  const loadAccess = useCallback(async () => {
    setLoading(true)
    const [leagueResult, delegateResult] = await Promise.all([
      supabase.from('tiq_leagues').select('created_by_user_id').eq('id', league.id).maybeSingle(),
      supabase.from('tiq_league_delegates').select('user_id,email,display_name,role,created_at').eq('league_id', league.id).order('created_at'),
    ])
    const isOwner = leagueResult.data?.created_by_user_id === userId
    setOwner(isOwner)
    setDelegates((delegateResult.data || []) as DelegateRow[])
    if (isOwner) {
      const inviteResult = await supabase
        .from('tiq_league_delegate_invites')
        .select('id,email,invite_token,status,expires_at,created_at')
        .eq('league_id', league.id)
        .order('created_at', { ascending: false })
      setInvites((inviteResult.data || []) as InviteRow[])
    } else {
      setInvites([])
    }
    setLoading(false)
  }, [league.id, userId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => void loadAccess(), 0)
    return () => window.clearTimeout(timeoutId)
  }, [loadAccess])

  async function saveIdentity() {
    const name = leagueName.trim()
    if (!name) {
      setMessage('Give the league a name before saving.')
      return
    }
    setBusy(true)
    const weeklySettings = { ...league.weeklySettings, leagueChatEnabled: chatEnabled }
    const { error } = await supabase.from('tiq_leagues').update({
      league_name: name,
      photo_url: logoUrl.trim(),
      weekly_settings: weeklySettings,
      updated_by_user_id: userId,
    }).eq('id', league.id)
    if (error) setMessage('Only the league owner can change league identity and chat settings.')
    else {
      onLeagueUpdated({ ...league, leagueName: name, photoUrl: logoUrl.trim(), weeklySettings })
      setMessage('League identity and chat settings saved.')
    }
    setBusy(false)
  }

  async function uploadLogo(file: File | null) {
    if (!file) return
    setBusy(true)
    const result = await uploadTiqLeaguePhoto({ file, leagueName: league.leagueName, existingLeagueId: league.id })
    if (result.warning) setMessage(result.warning)
    else {
      setLogoUrl(result.publicUrl)
      setMessage('Logo uploaded. Save league identity to publish it.')
    }
    setBusy(false)
  }

  async function inviteDelegate() {
    const email = normalizeLeagueDelegateEmail(inviteEmail)
    if (!isValidLeagueDelegateEmail(email)) {
      setMessage('Enter a valid delegate email.')
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
    }).select('id,email,invite_token,status,expires_at,created_at').single()
    if (error || !data) setMessage('The delegate invitation could not be created. Only the league owner can invite delegates.')
    else {
      const invite = data as InviteRow
      setInvites((current) => [invite, ...current])
      setInviteEmail('')
      setMessage('Delegate invitation ready. Copy the secure link and send it to them.')
      await copyInvite(invite.invite_token)
    }
    setBusy(false)
  }

  async function copyInvite(token: string) {
    const url = `${window.location.origin}/league-delegate/${token}`
    await navigator.clipboard.writeText(url)
    setMessage('Delegate invitation link copied.')
  }

  async function revokeInvite(inviteId: string) {
    setBusy(true)
    const { error } = await supabase.from('tiq_league_delegate_invites').update({ status: 'revoked' }).eq('id', inviteId).eq('league_id', league.id)
    if (error) setMessage('The invitation could not be revoked.')
    else {
      setInvites((current) => current.map((invite) => invite.id === inviteId ? { ...invite, status: 'revoked' } : invite))
      setMessage('Delegate invitation revoked.')
    }
    setBusy(false)
  }

  async function removeDelegate(delegateUserId: string) {
    setBusy(true)
    const { error } = await supabase.from('tiq_league_delegates').delete().eq('league_id', league.id).eq('user_id', delegateUserId)
    if (error) setMessage('Delegate access could not be removed.')
    else {
      setDelegates((current) => current.filter((delegate) => delegate.user_id !== delegateUserId))
      setMessage('Delegate access removed.')
    }
    setBusy(false)
  }

  return (
    <section style={panelStyle}>
      <div style={headingStyle}>
        <div>
          <p style={eyebrowStyle}>League identity and access</p>
          <h2 style={{ margin: 0 }}>Make the weekly experience yours</h2>
          <p style={copyStyle}>{owner ? 'Update what players see and choose who can help run each week.' : 'You have delegate access to run weekly play for this league.'}</p>
        </div>
        <span style={roleStyle}>{loading ? 'Checking access' : owner ? 'League owner' : 'Delegate'}</span>
      </div>

      {owner ? (
        <div style={settingsGridStyle}>
          <div style={identityCardStyle}>
            <div style={logoRowStyle}>
              {logoUrl ? (
                // League owners may use an existing hosted logo outside the configured image domains.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt={`${leagueName || league.leagueName} logo preview`} style={logoStyle} />
              ) : <span style={logoFallbackStyle}>{(leagueName || league.leagueName).slice(0, 2).toUpperCase()}</span>}
              <label style={uploadButtonStyle}>Choose logo<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={busy} onChange={(event) => { void uploadLogo(event.target.files?.[0] || null); event.target.value = '' }} style={{ display: 'none' }} /></label>
            </div>
            <label style={labelStyle}>League name<input value={leagueName} maxLength={120} onChange={(event) => setLeagueName(event.target.value)} style={inputStyle} /></label>
            <label style={labelStyle}>Logo URL<input value={logoUrl} onChange={(event) => setLogoUrl(event.target.value)} placeholder="Optional hosted logo URL" style={inputStyle} /></label>
            <label style={toggleStyle}><input type="checkbox" checked={chatEnabled} onChange={(event) => setChatEnabled(event.target.checked)} /><span><strong>League chat</strong><small>Show the league-room message action with weekly links.</small></span></label>
            <button type="button" onClick={() => void saveIdentity()} disabled={busy} style={buttonStyle}>Save league identity</button>
          </div>

          <div style={identityCardStyle}>
            <h3 style={{ margin: 0 }}>Delegates</h3>
            <p style={copyStyle}>Delegates can collect replies, confirm rosters, publish courts, and prepare recaps. Only you can add or remove access.</p>
            <div style={inviteRowStyle}><input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="delegate@example.com" style={inputStyle} /><button type="button" onClick={() => void inviteDelegate()} disabled={busy} style={buttonStyle}>Invite</button></div>
            <div style={peopleListStyle}>
              {delegates.map((delegate) => <div key={delegate.user_id} style={personRowStyle}><span><strong>{delegate.display_name || delegate.email || 'League delegate'}</strong><small>{delegate.email || 'Connected account'}</small></span><button type="button" onClick={() => void removeDelegate(delegate.user_id)} disabled={busy} style={quietButtonStyle}>Remove</button></div>)}
              {activeInvites.map((invite) => <div key={invite.id} style={personRowStyle}><span><strong>{invite.email}</strong><small>Invitation pending</small></span><span style={rowActionsStyle}><button type="button" onClick={() => void copyInvite(invite.invite_token)} style={quietButtonStyle}>Copy</button><button type="button" onClick={() => void revokeInvite(invite.id)} disabled={busy} style={quietButtonStyle}>Revoke</button></span></div>)}
              {!delegates.length && !activeInvites.length ? <p style={copyStyle}>No delegates yet.</p> : null}
            </div>
          </div>
        </div>
      ) : delegates.length ? (
        <p style={copyStyle}>{delegates.length} delegate{delegates.length === 1 ? '' : 's'} can help run this league.</p>
      ) : null}

      {message ? <p role="status" style={noticeStyle}>{message}</p> : null}
    </section>
  )
}

const panelStyle: CSSProperties = { border: '1px solid #dce4df', borderRadius: 20, background: '#fff', color: '#14231d', padding: 22, boxShadow: '0 10px 35px rgba(24,55,43,.06)' }
const headingStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }
const eyebrowStyle: CSSProperties = { margin: '0 0 6px', color: '#23765b', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.08em', fontSize: 12 }
const copyStyle: CSSProperties = { margin: '7px 0 0', color: '#52605a', lineHeight: 1.55 }
const roleStyle: CSSProperties = { padding: '6px 10px', borderRadius: 999, background: '#e7f4ee', color: '#126044', fontSize: 12, fontWeight: 850 }
const settingsGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(min(100%,320px),1fr))', gap: 14, marginTop: 16 }
const identityCardStyle: CSSProperties = { display: 'grid', alignContent: 'start', gap: 13, padding: 16, border: '1px solid #dce4df', borderRadius: 16, background: '#f8faf9' }
const logoRowStyle: CSSProperties = { display: 'flex', gap: 12, alignItems: 'center' }
const logoStyle: CSSProperties = { width: 72, height: 72, borderRadius: 15, objectFit: 'cover', background: '#fff', border: '1px solid #dce4df' }
const logoFallbackStyle: CSSProperties = { ...logoStyle, display: 'grid', placeItems: 'center', color: '#126044', fontSize: 24, fontWeight: 900 }
const uploadButtonStyle: CSSProperties = { borderRadius: 999, padding: '9px 13px', border: '1px solid #b9cec3', color: '#126044', fontWeight: 850, cursor: 'pointer' }
const labelStyle: CSSProperties = { display: 'grid', gap: 6, fontWeight: 800 }
const inputStyle: CSSProperties = { width: '100%', minHeight: 44, border: '1px solid #cbd8d1', borderRadius: 10, padding: '9px 12px', background: '#fff', color: '#14231d', boxSizing: 'border-box' }
const toggleStyle: CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start' }
const buttonStyle: CSSProperties = { width: 'fit-content', border: 0, borderRadius: 999, padding: '11px 16px', background: '#126044', color: '#fff', fontWeight: 850, cursor: 'pointer' }
const quietButtonStyle: CSSProperties = { border: '1px solid #cbd8d1', borderRadius: 999, padding: '7px 10px', background: '#fff', color: '#126044', fontWeight: 800, cursor: 'pointer' }
const inviteRowStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', gap: 8 }
const peopleListStyle: CSSProperties = { display: 'grid', gap: 8 }
const personRowStyle: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', paddingTop: 9, borderTop: '1px solid #e3eae6' }
const rowActionsStyle: CSSProperties = { display: 'flex', gap: 6 }
const noticeStyle: CSSProperties = { margin: '14px 0 0', padding: 12, borderRadius: 10, background: '#e7f4ee', color: '#126044', fontWeight: 750 }
