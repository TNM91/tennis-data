'use client'

import Image from 'next/image'
import Link from 'next/link'
import TiqFeatureIcon from '@/components/brand/TiqFeatureIcon'
import styles from './my-lab-command-center.module.css'

type MatchupPreview = {
  opponentId: string
  opponentName: string
  opponentMeta: string
  read: string
  href: string
}

type FirstServeStep = {
  title: string
  description: string
  href: string
  action: string
  complete: boolean
}

type PostRepReturn = {
  cardTitle: string
  proofLabel: string
  timeLabel: string
  note: string
  nextAction: string
  nextHref: string
  nextCta: string
}

type MyLabCommandCenterProps = {
  firstName: string
  playerId: string
  playerName: string
  repTitle: string
  repNote: string
  repDuration: number | null
  repHref: string
  repCta: string
  completedSessions: number
  sessionTarget: number
  progressHref: string
  matchup: MatchupPreview | null
  firstServeSteps: FirstServeStep[]
  postRepReturn: PostRepReturn | null
}

export default function MyLabCommandCenter({
  firstName,
  playerId,
  playerName,
  repTitle,
  repNote,
  repDuration,
  repHref,
  repCta,
  completedSessions,
  sessionTarget,
  progressHref,
  matchup,
  firstServeSteps,
  postRepReturn,
}: MyLabCommandCenterProps) {
  const greeting = firstName ? `Good afternoon, ${firstName}.` : 'Your next move starts here.'
  const safeCompletedSessions = Math.max(0, Math.min(sessionTarget, completedSessions))
  const completedFirstServeSteps = firstServeSteps.filter((step) => step.complete).length
  const nextFirstServeStep = firstServeSteps.findIndex((step) => !step.complete)

  return (
    <section className={styles.commandCenter} aria-labelledby="my-lab-command-title">
      <header className={styles.intro}>
        <div>
          <div className={styles.labSignature}>
            <TiqFeatureIcon name="myLab" size="md" variant="surface" />
            <span>
              <strong>My Lab</strong>
              <small>Player workspace</small>
            </span>
          </div>
          <h1 id="my-lab-command-title">{greeting}</h1>
          <p className={styles.introCopy}>One useful tennis move, then the proof that it worked.</p>
        </div>
        {playerId && playerName ? (
          <Link className={styles.playerLink} href={`/players/${encodeURIComponent(playerId)}`}>
            <span>Active player</span>
            <strong>{playerName}</strong>
          </Link>
        ) : (
          <Link className={styles.playerLink} href="/profile">
            <span>Active player</span>
            <strong>Find yourself</strong>
          </Link>
        )}
      </header>

      {firstServeSteps.length ? (
        <section className={styles.firstServe} aria-labelledby="first-serve-title">
          <div className={styles.firstServeHeading}>
            <div>
              <p className={styles.cardEyebrow}>First serve</p>
              <h2 id="first-serve-title">Build your player loop.</h2>
              <p>Connect your tennis, choose the work, then record one useful rep.</p>
            </div>
            <span className={styles.firstServeProgress}>{completedFirstServeSteps} of {firstServeSteps.length} ready</span>
          </div>
          <div className={styles.firstServeGrid}>
            {firstServeSteps.map((step, index) => {
              const isCurrent = index === nextFirstServeStep

              return (
                <Link
                  key={step.title}
                  className={`${styles.firstServeStep} ${step.complete ? styles.firstServeStepComplete : ''} ${isCurrent ? styles.firstServeStepCurrent : ''}`}
                  href={step.href}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  <span className={styles.firstServeNumber} aria-hidden="true">
                    {step.complete ? '✓' : index + 1}
                  </span>
                  <span className={styles.firstServeCopy}>
                    <strong>{step.title}</strong>
                    <small>{step.description}</small>
                  </span>
                  <span className={styles.firstServeAction}>{step.complete ? 'Review' : step.action} <span aria-hidden="true">→</span></span>
                </Link>
              )
            })}
          </div>
        </section>
      ) : null}

      {postRepReturn ? (
        <section className={styles.postRepReturn} aria-labelledby="post-rep-return-title">
          <div className={styles.postRepProof}>
            <span className={styles.postRepIcon} aria-hidden="true">✓</span>
            <div>
              <p className={styles.cardEyebrow}>Rep saved · {postRepReturn.timeLabel}</p>
              <h2 id="post-rep-return-title">{postRepReturn.cardTitle} is in the books.</h2>
              <div className={styles.postRepProofLine}>
                <strong>{postRepReturn.proofLabel}</strong>
                <span>{postRepReturn.note || 'Your proof is ready for the next cleaner rep.'}</span>
              </div>
            </div>
          </div>

          <div className={styles.postRepProgress}>
            <div>
              <p className={styles.supportEyebrow}>Weekly proof</p>
              <strong>{safeCompletedSessions} of {sessionTarget}</strong>
            </div>
            <span className={styles.postRepTrack} aria-label={`${safeCompletedSessions} of ${sessionTarget} weekly reps complete`}>
              <span style={{ width: `${sessionTarget ? Math.round((safeCompletedSessions / sessionTarget) * 100) : 0}%` }} />
            </span>
            <Link href={progressHref}>See progress</Link>
          </div>

          <div className={styles.postRepNext}>
            <p className={styles.supportEyebrow}>Recommended next move</p>
            <strong>{postRepReturn.nextAction}</strong>
            <Link href={postRepReturn.nextHref}>
              {postRepReturn.nextCta} <span aria-hidden="true">→</span>
            </Link>
          </div>
        </section>
      ) : null}

      <div className={styles.primaryGrid}>
        <article className={styles.repCard}>
          <Image
            className={styles.courtImage}
            src="/tiq/courts/tiq-court-master.png"
            alt=""
            fill
            sizes="(max-width: 760px) 100vw, 760px"
            priority
          />
          <Image
            className={styles.ballImage}
            src="/tiq/tokens/tennis-ball-reference.png"
            alt=""
            width={220}
            height={220}
            priority
          />
          <div className={styles.repContent}>
            <div className={styles.repTopline}>
              <p className={styles.cardEyebrow}>Today&apos;s rep</p>
              {repDuration ? (
                <span className={styles.duration}>
                  <TiqFeatureIcon name="schedule" size="sm" variant="ghost" />
                  {repDuration} min
                </span>
              ) : null}
            </div>
            <h2>{repTitle}</h2>
            <p className={styles.repNote}>{repNote}</p>
            <Link className={styles.primaryAction} href={repHref}>
              <span>{repCta}</span>
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        </article>

        <div className={styles.supportStack}>
          <article className={styles.momentumCard}>
            <div className={styles.cardHeadingRow}>
              <div>
                <p className={styles.supportEyebrow}>Weekly momentum</p>
                <h2>{safeCompletedSessions} of {sessionTarget} sessions</h2>
              </div>
              <Link href={progressHref}>See progress</Link>
            </div>
            <div className={styles.sessionRail} aria-label={`${safeCompletedSessions} of ${sessionTarget} weekly sessions complete`}>
              {Array.from({ length: sessionTarget }, (_, index) => (
                <span
                  key={index}
                  className={index < safeCompletedSessions ? styles.sessionComplete : styles.sessionOpen}
                  aria-hidden="true"
                >
                  {index < safeCompletedSessions ? '✓' : index + 1}
                </span>
              ))}
            </div>
          </article>

          <article className={styles.matchCard}>
            <div className={styles.matchIcon}>
              <TiqFeatureIcon name="matchupAnalysis" size="md" variant="ghost" />
            </div>
            <div className={styles.matchCopy}>
              <p className={styles.supportEyebrow}>Next matchup</p>
              {matchup ? (
                <>
                  <Link className={styles.entityLink} href={`/players/${encodeURIComponent(matchup.opponentId)}`}>
                    {matchup.opponentName}
                  </Link>
                  <p>{matchup.opponentMeta}</p>
                  <span className={styles.matchRead}>{matchup.read}</span>
                </>
              ) : (
                <>
                  <strong className={styles.emptyMatchTitle}>Build your first read</strong>
                  <p>Connect a player record to surface a useful next test.</p>
                </>
              )}
            </div>
            <Link className={styles.matchAction} href={matchup?.href || '/matchup'}>
              View matchup <span aria-hidden="true">→</span>
            </Link>
          </article>
        </div>
      </div>
    </section>
  )
}
