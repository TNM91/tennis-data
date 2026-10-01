'use client'

import { useState, type CSSProperties } from 'react'
import {
  isStreetLocation,
  venueLocation,
  venueText,
  type VenuePreference,
  type VerifiedVenue,
} from '@/lib/venue-directory'

function facilityName(value: string) {
  return venueText(value.split(/\s+[—–]\s+/)[0])
}

export default function VenueLocationPicker({
  value,
  onChange,
  context,
  token,
  disabled = false,
  knownOptions = [],
  inputId = 'venue-location',
}: {
  value: string
  onChange: (value: string) => void
  context: string
  token: string
  disabled?: boolean
  knownOptions?: string[]
  inputId?: string
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [venues, setVenues] = useState<VerifiedVenue[]>([])
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [street, setStreet] = useState('')
  const [message, setMessage] = useState('')
  const name = facilityName(value)
  const addressReady = Boolean(name && value.includes('—') && isStreetLocation(value))

  async function search() {
    if (!name || !token || disabled || loading) return
    setLoading(true)
    setMessage('')
    try {
      const params = new URLSearchParams({ name, context })
      const response = await fetch(`/api/player/venue-locations?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
        signal: AbortSignal.timeout(30000),
      })
      const result = await response.json() as {
        message?: string
        venues?: VerifiedVenue[]
        preference?: VenuePreference | null
      }
      if (!response.ok) throw new Error(result.message || 'Sites could not be loaded.')
      const matches = result.venues || []
      setVenues(matches)
      if (result.preference) {
        setCity(result.preference.city)
        setState(result.preference.state_code)
        setStreet(result.preference.street_address)
      }
      setOpen(true)
      setMessage(matches.length ? 'Choose the correct site and address.' : 'No verified match yet. Confirm the address below.')
    } catch (cause) {
      setOpen(true)
      setMessage(cause instanceof Error ? cause.message : 'Sites could not be loaded.')
    } finally {
      setLoading(false)
    }
  }

  async function choose(venue?: VerifiedVenue) {
    if (!name || !token || disabled || saving) return
    setSaving(true)
    setMessage('')
    try {
      const response = await fetch('/api/player/venue-locations', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(30000),
        body: JSON.stringify({
          facilityName: name,
          context,
          directoryId: venue?.id,
          city,
          state,
          streetAddress: street,
        }),
      })
      const result = await response.json() as {
        message?: string
        directory?: VerifiedVenue | null
        preference?: VenuePreference
      }
      if (!response.ok || !result.preference) throw new Error(result.message || 'The site address could not be saved.')
      onChange(venueLocation(result.directory || result.preference))
      setOpen(false)
      setMessage('Correct site saved. GPS directions are ready.')
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : 'The site address could not be saved.')
    } finally {
      setSaving(false)
    }
  }

  const mapsQuery = [name, city, state].filter(Boolean).join(', ')
  const canConfirmManual = Boolean(isStreetLocation(street) && venueText(city) && state.length === 2)

  return (
    <div style={pickerStyle}>
      <div style={inputRowStyle}>
        <input
          id={inputId}
          list={`${inputId}-options`}
          value={value}
          disabled={disabled}
          onChange={(event) => {
            onChange(event.target.value)
            setMessage('')
          }}
          placeholder="Search a club or enter an address"
          autoComplete="off"
          style={facilityInputStyle}
        />
        <datalist id={`${inputId}-options`}>
          {knownOptions.map((option) => <option key={option} value={option} />)}
        </datalist>
        <button type="button" disabled={disabled || loading || !name || !token} onClick={() => void search()} style={secondaryButtonStyle}>
          {loading ? 'Searching…' : 'Find correct site'}
        </button>
      </div>

      <div style={statusStyle} data-ready={addressReady}>
        <span aria-hidden="true">{addressReady ? '✓' : '⌖'}</span>
        <span>{addressReady ? 'Address ready for GPS directions' : 'Select the exact site so players reach the right courts.'}</span>
      </div>

      {open ? (
        <div style={resultsStyle}>
          {venues.map((venue) => (
            <button key={venue.id} type="button" disabled={saving || disabled} onClick={() => void choose(venue)} style={venueButtonStyle}>
              <strong>{venue.facility_name}</strong>
              <span>{venue.street_address}, {venue.city}, {venue.state_code}</span>
            </button>
          ))}
          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapsQuery)}`} target="_blank" rel="noreferrer" style={mapsLinkStyle}>Check Google Maps ↗</a>
          <div style={addressGridStyle}>
            <label style={fieldStyle}><span>City</span><input value={city} maxLength={100} onChange={(event) => setCity(event.target.value)} style={inputStyle} /></label>
            <label style={fieldStyle}><span>State</span><input value={state} maxLength={2} placeholder="MO" onChange={(event) => setState(event.target.value.toUpperCase())} style={inputStyle} /></label>
          </div>
          <label style={fieldStyle}><span>Street address</span><input value={street} maxLength={160} placeholder="123 Main St" onChange={(event) => setStreet(event.target.value)} style={inputStyle} /></label>
          <button type="button" disabled={saving || disabled || !canConfirmManual} onClick={() => void choose()} style={primaryButtonStyle}>
            {saving ? 'Saving…' : 'Use this address'}
          </button>
        </div>
      ) : null}

      {message ? <p role="status" style={messageStyle}>{message}</p> : null}
    </div>
  )
}

const pickerStyle: CSSProperties = { display: 'grid', gap: 9 }
const inputRowStyle: CSSProperties = { display: 'flex', flexWrap: 'wrap', gap: 8, minWidth: 0 }
const inputStyle: CSSProperties = { width: '100%', minWidth: 0, minHeight: 44, boxSizing: 'border-box', border: '1px solid var(--shell-panel-border)', borderRadius: 12, background: 'var(--shell-input-bg, rgba(4,13,26,.82))', color: 'var(--foreground-strong)', padding: '10px 12px', font: 'inherit' }
const facilityInputStyle: CSSProperties = { ...inputStyle, flex: '1 1 220px' }
const secondaryButtonStyle: CSSProperties = { flex: '0 1 auto', minHeight: 44, border: '1px solid var(--shell-panel-border)', borderRadius: 12, background: 'var(--shell-chip-bg)', color: 'var(--foreground-strong)', padding: '0 14px', font: 'inherit', fontWeight: 850, cursor: 'pointer' }
const statusStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 750 }
const resultsStyle: CSSProperties = { display: 'grid', gap: 9, padding: 12, border: '1px solid color-mix(in srgb, var(--brand-green) 28%, var(--shell-panel-border) 72%)', borderRadius: 14, background: 'var(--shell-chip-bg)' }
const venueButtonStyle: CSSProperties = { display: 'grid', gap: 3, width: '100%', minHeight: 48, padding: '10px 12px', textAlign: 'left', border: '1px solid var(--shell-panel-border)', borderRadius: 12, background: 'var(--shell-panel-bg)', color: 'var(--foreground-strong)', font: 'inherit', cursor: 'pointer' }
const mapsLinkStyle: CSSProperties = { color: 'var(--brand-green)', fontSize: 13, fontWeight: 850, textDecoration: 'none' }
const addressGridStyle: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 88px', gap: 8 }
const fieldStyle: CSSProperties = { display: 'grid', gap: 5, color: 'var(--shell-copy-muted)', fontSize: 12, fontWeight: 800 }
const primaryButtonStyle: CSSProperties = { minHeight: 44, border: 0, borderRadius: 999, background: 'var(--brand-green)', color: '#071323', padding: '0 16px', font: 'inherit', fontWeight: 900, cursor: 'pointer' }
const messageStyle: CSSProperties = { margin: 0, color: 'var(--shell-copy-muted)', fontSize: 12, lineHeight: 1.45 }
