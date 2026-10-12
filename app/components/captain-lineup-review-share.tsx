'use client'

import { useState } from 'react'
import { buildCaptainLineupReviewText, shareCaptainLineupReview, type CaptainLineupReview } from '@/lib/captain-lineup-review'
import styles from './captain-lineup-review-share.module.css'

export default function CaptainLineupReviewShare({ lineup, disabled = false }: { lineup: CaptainLineupReview; disabled?: boolean }) {
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [copyText, setCopyText] = useState('')

  async function share() {
    if (busy || disabled) return
    setBusy(true)
    setNotice('')
    setCopyText('')
    const text = buildCaptainLineupReviewText(lineup)
    try {
      const outcome = await shareCaptainLineupReview(text, navigator)
      setNotice(outcome === 'copied' ? 'Lineup copied. Paste it into a message to your co-captain.' : 'Lineup shared for review.')
    } catch (error) {
      if (!(error instanceof Error && error.name === 'AbortError')) {
        setNotice('Select and copy the lineup below, then send it to your co-captain.')
        setCopyText(text)
      }
    } finally {
      setBusy(false)
    }
  }

  return <div className={styles.share}>
    <button type="button" className={styles.button} disabled={disabled || busy || !lineup.courts.length} onClick={() => void share()}>
      {busy ? 'Preparing lineup…' : 'Share with co-captain'}
    </button>
    <p className={styles.help}>Choose your co-captain in the share menu to review the draft courts and pairings.</p>
    {notice ? <p className={styles.help} role="status">{notice}</p> : null}
    {copyText ? <textarea className={styles.copy} aria-label="Draft lineup to copy" readOnly value={copyText} onFocus={(event) => event.currentTarget.select()} /> : null}
  </div>
}
