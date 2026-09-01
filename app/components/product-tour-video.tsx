'use client'

import Image from 'next/image'
import Link from 'next/link'
import { track } from '@vercel/analytics'
import { useRef, useState } from 'react'
import { trackProductUsageEvent } from '@/lib/product-usage-client'
import {
  PRODUCT_TOUR_VIDEOS,
  getProductTourPriceSummary,
  type ProductTourVideoId,
} from '@/lib/product-tour-videos'
import type { ProductUsageEventSurface } from '@/lib/product-usage-events'
import styles from './product-tour-video.module.css'

type ProductTourVideoButtonProps = {
  videoId: ProductTourVideoId
  label?: string
  variant?: 'primary' | 'secondary' | 'compact' | 'poster'
  surface?: ProductUsageEventSurface
  source?: string
  className?: string
}

export default function ProductTourVideoButton({
  videoId,
  label,
  variant = 'secondary',
  surface = 'public_site',
  source = 'product-tour',
  className,
}: ProductTourVideoButtonProps) {
  const video = PRODUCT_TOUR_VIDEOS[videoId]
  const dialogRef = useRef<HTMLDialogElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const startedRef = useRef(false)
  const completedRef = useRef(false)
  const progressRef = useRef(new Set<number>())
  const [mediaReady, setMediaReady] = useState(false)
  const priceSummary = getProductTourPriceSummary(videoId)

  function openVideo() {
    setMediaReady(true)
    startedRef.current = false
    completedRef.current = false
    progressRef.current.clear()
    dialogRef.current?.showModal()
  }

  function closeVideo() {
    const player = videoRef.current
    if (player) {
      player.pause()
      player.currentTime = 0
    }
  }

  function trackStarted() {
    if (startedRef.current) return
    startedRef.current = true
    track('Product Tour', {
      action: 'started',
      videoId,
      source,
      durationSeconds: video.durationSeconds,
    })
    void trackProductUsageEvent({
      eventName: 'product_tour_started',
      surface,
      metadata: { videoId, source, durationSeconds: video.durationSeconds },
    })
  }

  function trackProgress(player: HTMLVideoElement) {
    if (!Number.isFinite(player.duration) || player.duration <= 0) return
    const watchedPercent = (player.currentTime / player.duration) * 100

    for (const milestone of [25, 50, 75]) {
      if (watchedPercent < milestone || progressRef.current.has(milestone)) continue
      progressRef.current.add(milestone)
      track('Product Tour', {
        action: 'progressed',
        videoId,
        source,
        milestone,
      })
      void trackProductUsageEvent({
        eventName: 'product_tour_progressed',
        surface,
        metadata: { videoId, source, milestone, durationSeconds: video.durationSeconds },
      })
    }
  }

  function trackCompleted() {
    if (completedRef.current) return
    completedRef.current = true
    track('Product Tour', {
      action: 'completed',
      videoId,
      source,
      durationSeconds: video.durationSeconds,
    })
    void trackProductUsageEvent({
      eventName: 'product_tour_completed',
      surface,
      metadata: { videoId, source, durationSeconds: video.durationSeconds },
    })
  }

  const buttonClassName = [
    styles.trigger,
    styles[`${variant}Trigger`],
    className,
  ].filter(Boolean).join(' ')

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        onClick={openVideo}
        aria-label={label || `Watch ${video.title}, ${video.durationLabel}`}
      >
        {variant === 'poster' ? (
          <>
            <Image
              className={styles.posterImage}
              src={video.poster}
              alt=""
              fill
              sizes="(max-width: 760px) 92vw, 560px"
            />
            <span className={styles.posterShade} aria-hidden="true" />
            <span className={styles.posterPlay} aria-hidden="true">
              <span className={styles.playMark}>▶</span>
              <span>Watch · {video.durationLabel}</span>
            </span>
          </>
        ) : (
          <>
            <span className={styles.inlinePlay} aria-hidden="true">▶</span>
            <span>{label || `Watch ${video.durationLabel}`}</span>
          </>
        )}
      </button>

      <dialog
        ref={dialogRef}
        className={styles.dialog}
        aria-labelledby={`${videoId}-video-title`}
        aria-describedby={`${videoId}-video-description`}
        onClose={closeVideo}
        onClick={(event) => {
          if (event.target === event.currentTarget) event.currentTarget.close()
        }}
      >
        <div className={styles.dialogPanel}>
          <header className={styles.dialogHeader}>
            <div className={styles.dialogHeading}>
              <span>{video.eyebrow}</span>
              <h2 id={`${videoId}-video-title`}>{video.title}</h2>
              <p id={`${videoId}-video-description`}>{video.description}</p>
            </div>
            <form method="dialog">
              <button className={styles.closeButton} type="submit" aria-label="Close video">×</button>
            </form>
          </header>

          <div className={styles.videoStage}>
            <video
              ref={videoRef}
              className={styles.video}
              controls
              playsInline
              preload="none"
              poster={video.poster}
              aria-label={`${video.title} video`}
              onPlay={trackStarted}
              onTimeUpdate={(event) => trackProgress(event.currentTarget)}
              onEnded={trackCompleted}
            >
              {mediaReady ? <source src={video.src} type="video/mp4" /> : null}
              {mediaReady ? (
                <track default src={video.captions} kind="captions" srcLang="en" label="English" />
              ) : null}
              Your browser does not support video playback.{' '}
              <a href={video.src}>Download the video</a>.
            </video>
          </div>

          <div className={styles.dialogFooter}>
            <details className={styles.transcript}>
              <summary>Read transcript</summary>
              <div>
                {video.transcript.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              </div>
            </details>
            <div className={styles.dialogNextStep}>
              {priceSummary ? (
                <div className={styles.dialogPrice} aria-label={`Current plan price: ${priceSummary.label}`}>
                  <strong>{priceSummary.label}</strong>
                  <span>{priceSummary.detail}</span>
                </div>
              ) : null}
              <Link
                className={styles.dialogCta}
                href={video.cta.href}
                onClick={() => {
                  track('Product Tour', {
                    action: 'cta_clicked',
                    videoId,
                    source,
                    destination: video.cta.href,
                  })
                  void trackProductUsageEvent({
                    eventName: 'product_tour_cta_clicked',
                    surface,
                    metadata: { videoId, source, href: video.cta.href },
                  })
                  dialogRef.current?.close()
                }}
              >
                {video.cta.label}
              </Link>
            </div>
          </div>
        </div>
      </dialog>
    </>
  )
}

export function ProductTourHomeSpotlight() {
  const teaser = PRODUCT_TOUR_VIDEOS.teaser

  return (
    <section className={styles.homeSpotlight} aria-labelledby="home-product-tour-title">
      <div className={styles.homeCopy}>
        <span className={styles.homeEyebrow}>See TenAceIQ in action</span>
        <h2 id="home-product-tour-title">One connected path through your tennis life.</h2>
        <p>{teaser.description}</p>
        <div className={styles.homeActions}>
          <Link className={styles.homePrimaryAction} href="/resources/platform-tour">Open the complete tour</Link>
          <Link className={styles.homeSecondaryAction} href="/pricing">Compare plans</Link>
        </div>
      </div>
      <ProductTourVideoButton
        videoId="teaser"
        variant="poster"
        label="Watch the 16-second TenAceIQ preview"
        source="homepage-spotlight"
      />
    </section>
  )
}
