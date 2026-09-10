'use client'

import Image from 'next/image'
import { useState } from 'react'
import { CAPTAIN_PILOT_SHARE, CAPTAIN_PILOT_SHARE_MESSAGE } from '@/lib/captain-pilot-share'
import styles from './captain-pilot.module.css'

export default function PilotShare() {
  const [status, setStatus] = useState('')
  const [showText, setShowText] = useState(false)

  async function copyText() {
    try {
      await navigator.clipboard.writeText(CAPTAIN_PILOT_SHARE_MESSAGE)
      setStatus('Copied. Paste into a text message to invite a captain.')
    } catch {
      setShowText(true)
      setStatus('Select and copy the invitation below.')
    }
  }

  async function share() {
    if (!navigator.share) return copyText()
    try {
      await navigator.share({
        title: CAPTAIN_PILOT_SHARE.title,
        text: CAPTAIN_PILOT_SHARE.text,
        url: CAPTAIN_PILOT_SHARE.url,
      })
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') return
      await copyText()
    }
  }

  return (
    <section className={styles.promoShare} aria-labelledby="pilot-share-title">
      <a href={CAPTAIN_PILOT_SHARE.url} aria-label="Open the Captain Pilot invitation">
        <Image src={CAPTAIN_PILOT_SHARE.image} alt={CAPTAIN_PILOT_SHARE.imageAlt} width={1200} height={630} sizes="(max-width: 720px) 100vw, 520px" className={styles.promoImage} />
      </a>
      <div className={styles.promoDetails}>
        <h2 id="pilot-share-title">Know another captain?</h2>
        <p>Send them the pilot. Tap Share pilot or copy the invitation into a text message.</p>
        <div className={styles.promoActions}>
          <button type="button" onClick={share} className={styles.primaryAction}>Share pilot</button>
          <button type="button" onClick={copyText} className={styles.secondaryAction}>Copy text</button>
          <a href={CAPTAIN_PILOT_SHARE.image} download="TenAceIQ-Captain-Pilot.png" className={styles.secondaryAction}>Save image</a>
        </div>
        <p className={styles.promoHint}>Send the link so captains can tap through to sign up. Image previews depend on their messaging app.</p>
        {status ? <p role="status">{status}</p> : null}
        {showText ? <textarea aria-label="Captain Pilot invitation to copy" readOnly value={CAPTAIN_PILOT_SHARE_MESSAGE} onFocus={(event) => event.currentTarget.select()} rows={6} /> : null}
      </div>
    </section>
  )
}
