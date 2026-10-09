'use client'

import { useId, useState } from 'react'
import { buildShareCardImageUrl, type TiqShareCardKind } from '@/lib/share-card'
import styles from './tennis-insight-cards.module.css'

export default function TennisShareCardPreview({ kind, title, subtitle, detail, publicPath }: { kind: TiqShareCardKind; title: string; subtitle?: string; detail?: string; publicPath: string }) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [preview, setPreview] = useState<{ url: string; state: 'loading' | 'ready' | 'error' } | null>(null)
  const [retry, setRetry] = useState(0)
  const contentId = useId()
  const baseImageUrl = buildShareCardImageUrl({ kind, title, subtitle, detail })
  const imageUrl = retry ? `${baseImageUrl}&retry=${retry}` : baseImageUrl
  const previewState = preview?.url === imageUrl ? preview.state : 'loading'
  async function shareImage() {
    setBusy(true)
    setStatus('')
    try {
      const response = await fetch(imageUrl)
      if (!response.ok || !response.headers.get('content-type')?.startsWith('image/')) throw new Error('Card image could not load. Try again.')
      const blob = await response.blob()
      const file = new File([blob], 'tenaceiq-tennis-card.png', { type: 'image/png' })
      if (navigator.canShare?.({ files: [file] }) && navigator.share) {
        await navigator.share({ files: [file], title, url: new URL(publicPath, window.location.origin).href })
        setStatus('Card shared.')
      } else {
        const url = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = url
        link.download = file.name
        link.click()
        window.setTimeout(() => URL.revokeObjectURL(url), 1000)
        setStatus('Card downloaded.')
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setStatus(error instanceof Error ? error.message : 'Card could not be shared. Try again.')
    } finally { setBusy(false) }
  }
  return <section className={styles.card} aria-label="Tennis card sharing">
    <div className={styles.header}><h3>A tennis card worth sharing</h3><button className={styles.button} type="button" aria-expanded={open} aria-controls={contentId} onClick={() => { setOpen(value => !value); setStatus('') }}>{open ? 'Close preview' : 'Preview share card'}</button></div>
    <div id={contentId} hidden={!open}>{open ? <>
      <p className={styles.muted}>Review the card before sharing. It includes the public tennis details shown here.</p>
      <div className={styles.previewFrame} aria-busy={previewState === 'loading'}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img key={imageUrl} src={imageUrl} alt={`${title} tennis share card preview`} width={1200} height={630} style={{ width: '100%', height: 'auto', display: 'block', visibility: previewState === 'ready' ? 'visible' : 'hidden' }} onLoad={() => setPreview({ url: imageUrl, state: 'ready' })} onError={() => setPreview({ url: imageUrl, state: 'error' })} />
        {previewState === 'loading' ? <div className={styles.previewStatus} role="status">Preparing your card preview…</div> : previewState === 'error' ? <div className={styles.previewStatus} role="alert"><span>Preview could not load.</span><button type="button" className={styles.button} onClick={() => setRetry(value => value + 1)}>Retry preview</button></div> : null}
      </div>
      <button className={styles.button} type="button" disabled={busy || previewState !== 'ready'} aria-busy={busy} onClick={() => void shareImage()}>{busy ? 'Preparing card…' : 'Share or download image'}</button>
      <p role="status">{status}</p>
    </> : null}</div>
  </section>
}
