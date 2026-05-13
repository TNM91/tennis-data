'use client'

import Link from 'next/link'
import { useEffect, useState, type CSSProperties } from 'react'
import {
  createDirectConversation,
  createLeagueConversation,
  createSupportConversation,
  getInternalIdentity,
  resolveInternalRecipient,
  type InternalIdentity,
  type InternalRecipient,
  type InternalSupportCategory,
} from '@/lib/internal-messages'

type QuickMessageMode = 'direct' | 'support' | 'league'

export default function QuickMessageComposer({
  mode,
  triggerLabel,
  recipientName = '',
  recipientProfileId = '',
  recipientPlayerId = '',
  category = 'general',
  subject,
  body = '',
  entityType = '',
  entityId = '',
  leagueId = '',
  leagueName = '',
  participantPlayerIds = [],
  participantProfileIds = [],
  participantNames = [],
}: {
  mode: QuickMessageMode
  triggerLabel: string
  recipientName?: string
  recipientProfileId?: string
  recipientPlayerId?: string
  category?: InternalSupportCategory
  subject: string
  body?: string
  entityType?: string
  entityId?: string
  leagueId?: string
  leagueName?: string
  participantPlayerIds?: string[]
  participantProfileIds?: string[]
  participantNames?: string[]
}) {
  const [open, setOpen] = useState(false)
  const [identity, setIdentity] = useState<InternalIdentity | null>(null)
  const [recipient, setRecipient] = useState<InternalRecipient | null>(null)
  const [draftSubject, setDraftSubject] = useState(subject)
  const [draftBody, setDraftBody] = useState(body)
  const [sending, setSending] = useState(false)
  const [resolving, setResolving] = useState(false)
  const [conversationId, setConversationId] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return
    let active = true

    async function loadIdentityAndRecipient() {
      setResolving(true)
      setError('')
      try {
        const nextIdentity = await getInternalIdentity()
        if (!active) return
        setIdentity(nextIdentity)

        if (!nextIdentity) {
          setError('Sign in to send this message inside TenAceIQ.')
          return
        }

        if (mode === 'direct') {
          const nextRecipient = await resolveInternalRecipient({
            profileId: recipientProfileId,
            playerId: recipientPlayerId,
            nameOrId: recipientName,
          })
          if (!active) return
          setRecipient(nextRecipient)
          if (!nextRecipient) {
            setError('This opponent is not linked to a TenAceIQ account yet. You can still open Messages and search by name.')
          }
        }
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : 'Messaging is not ready yet.')
      } finally {
        if (active) setResolving(false)
      }
    }

    void loadIdentityAndRecipient()

    return () => {
      active = false
    }
  }, [entityId, mode, open, recipientName, recipientPlayerId, recipientProfileId])

  useEffect(() => {
    if (!open) {
      setDraftSubject(subject)
      setDraftBody(body)
      setConversationId('')
      setStatus('')
      setError('')
      setRecipient(null)
    }
  }, [body, open, subject])

  async function sendMessage() {
    if (!identity || sending) return

    setSending(true)
    setError('')
    setStatus('')
    try {
      let nextConversationId = ''
      if (mode === 'support') {
        nextConversationId = await createSupportConversation(identity, draftSubject, draftBody, {
          category,
          entityType,
          entityId,
        })
      } else if (mode === 'league') {
        nextConversationId = await createLeagueConversation(identity, {
          leagueId: entityId || leagueId,
          leagueName,
          subject: draftSubject,
          body: draftBody,
          participantPlayerIds,
          participantProfileIds,
          participantNames,
        })
      } else {
        const nextRecipient = recipient ?? await resolveInternalRecipient({
          profileId: recipientProfileId,
          playerId: recipientPlayerId,
          nameOrId: recipientName,
        })
        if (!nextRecipient) {
          setError('Choose this user from Messages once their account is linked.')
          return
        }
        nextConversationId = await createDirectConversation(identity, nextRecipient, draftSubject, draftBody)
      }

      setConversationId(nextConversationId)
      setStatus(mode === 'support' ? 'Support thread opened.' : mode === 'league' ? 'League room started.' : 'Message sent.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Message could not be sent.')
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} style={triggerStyle}>
        {triggerLabel}
      </button>
      {open ? (
        <div style={overlayStyle} role="dialog" aria-modal="true" aria-label={triggerLabel}>
          <div style={drawerStyle}>
            <div style={headerStyle}>
              <div>
                <div style={kickerStyle}>
                  {mode === 'support' ? 'Support' : mode === 'league' ? 'League room' : 'Message'}
                </div>
                <h2 style={titleStyle}>{subject || triggerLabel}</h2>
              </div>
              <button type="button" onClick={() => setOpen(false)} style={closeButtonStyle} aria-label="Close message composer">
                x
              </button>
            </div>

            {mode === 'direct' ? (
              <div style={targetStyle}>
                <span>To</span>
                <strong>{resolving ? 'Finding account...' : recipient?.displayName || recipientName || 'Opponent'}</strong>
              </div>
            ) : null}

            {mode === 'league' ? (
              <div style={targetStyle}>
                <span>Room</span>
                <strong>{leagueName || 'League conversation'}</strong>
              </div>
            ) : null}

            <label style={fieldStyle}>
              <span style={labelStyle}>Subject</span>
              <input value={draftSubject} onChange={(event) => setDraftSubject(event.target.value)} style={inputStyle} />
            </label>
            <label style={fieldStyle}>
              <span style={labelStyle}>Message</span>
              <textarea value={draftBody} onChange={(event) => setDraftBody(event.target.value)} style={textareaStyle} />
            </label>

            <div style={actionRowStyle}>
              <button
                type="button"
                onClick={() => void sendMessage()}
                disabled={sending || resolving || !draftBody.trim() || (mode === 'direct' && !recipient)}
                style={{
                  ...primaryStyle,
                  ...((sending || resolving || !draftBody.trim() || (mode === 'direct' && !recipient)) ? disabledStyle : {}),
                }}
              >
                {sending ? 'Sending...' : mode === 'support' ? 'Open support thread' : 'Send'}
              </button>
              <Link href="/messages" style={secondaryStyle}>Open Messages</Link>
            </div>

            {status ? (
              <div style={successStyle}>
                {status} <Link href={`/messages?thread=${encodeURIComponent(conversationId)}`} style={inlineLinkStyle}>View thread</Link>
              </div>
            ) : null}
            {error ? <div style={errorStyle}>{error}</div> : null}
          </div>
        </div>
      ) : null}
    </>
  )
}

const triggerStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(116,190,255,0.08)',
  color: '#dfeeff',
  fontSize: 12,
  fontWeight: 850,
  cursor: 'pointer',
  whiteSpace: 'normal',
}

const overlayStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 70,
  display: 'flex',
  justifyContent: 'flex-end',
  background: 'rgba(2,8,18,0.62)',
  backdropFilter: 'blur(10px)',
}

const drawerStyle: CSSProperties = {
  width: 'min(100%, 440px)',
  height: '100%',
  overflowY: 'auto',
  display: 'grid',
  alignContent: 'start',
  gap: 14,
  padding: 22,
  borderLeft: '1px solid rgba(116,190,255,0.18)',
  background: 'linear-gradient(180deg, rgba(11,24,46,0.98), rgba(5,13,27,0.98))',
  boxShadow: '-20px 0 60px rgba(0,0,0,0.35)',
}

const headerStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 12,
  alignItems: 'flex-start',
}

const kickerStyle: CSSProperties = {
  color: '#93c5fd',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
}

const titleStyle: CSSProperties = {
  margin: '5px 0 0',
  color: '#f8fbff',
  fontSize: 24,
  lineHeight: 1.08,
  fontWeight: 950,
}

const closeButtonStyle: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 999,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(255,255,255,0.05)',
  color: '#e7eefb',
  cursor: 'pointer',
  fontWeight: 900,
}

const targetStyle: CSSProperties = {
  display: 'grid',
  gap: 4,
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(155,225,29,0.16)',
  background: 'rgba(155,225,29,0.06)',
  color: '#e7ffd1',
  fontSize: 13,
}

const fieldStyle: CSSProperties = {
  display: 'grid',
  gap: 7,
}

const labelStyle: CSSProperties = {
  color: '#93c5fd',
  fontSize: 12,
  fontWeight: 900,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
}

const inputStyle: CSSProperties = {
  width: '100%',
  minHeight: 44,
  borderRadius: 14,
  border: '1px solid rgba(116,190,255,0.16)',
  background: 'rgba(7,17,33,0.78)',
  color: '#f8fbff',
  padding: '0 12px',
  fontWeight: 800,
}

const textareaStyle: CSSProperties = {
  ...inputStyle,
  minHeight: 160,
  padding: 12,
  resize: 'vertical',
  lineHeight: 1.45,
}

const actionRowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
}

const primaryStyle: CSSProperties = {
  minHeight: 42,
  padding: '0 14px',
  borderRadius: 999,
  border: '1px solid color-mix(in srgb, var(--brand-green) 38%, var(--shell-panel-border) 62%)',
  background: 'color-mix(in srgb, var(--brand-green) 22%, var(--shell-chip-bg) 78%)',
  color: 'var(--foreground-strong)',
  fontWeight: 950,
  cursor: 'pointer',
  boxShadow: 'inset 0 1px 0 color-mix(in srgb, var(--foreground-strong) 10%, transparent)',
}

const disabledStyle: CSSProperties = {
  opacity: 0.56,
  cursor: 'not-allowed',
}

const secondaryStyle: CSSProperties = {
  color: '#dbeafe',
  fontSize: 13,
  fontWeight: 850,
  textDecoration: 'none',
}

const inlineLinkStyle: CSSProperties = {
  color: '#dffad5',
  fontWeight: 950,
}

const successStyle: CSSProperties = {
  color: '#bbf7d0',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 900,
}

const errorStyle: CSSProperties = {
  color: '#fecaca',
  fontSize: 13,
  lineHeight: 1.5,
  fontWeight: 900,
}
