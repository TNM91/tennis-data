import {ratingSignal} from '../../lib/rating-signal'
import type {CSSProperties} from 'react'
import Link from 'next/link'
import {formatRating} from '../../lib/captain-formatters'
import type {RatingView} from '../../lib/player-rating-display'

export default function CompareCard({
  title,
  subtitle,
  ratings,
  ustaRatings,
  projectionRating,
  ratingView,
  projectionView,
  profileHref,
  favored,
  selfRated,
  dynamicRatingGrid,
  display,
}: {
  title: string
  subtitle: string
  ratings: { overall: number | null; singles: number | null; doubles: number | null }
  ustaRatings: { overall: number | null; singles: number | null; doubles: number | null }
  projectionRating: number | null
  ratingView: RatingView
  projectionView: RatingView
  profileHref: string | null
  favored: boolean
  selfRated: boolean
  display?: {tiq:Record<RatingView,string>;usta:Record<RatingView,string>;projection:string;signal:string;signalColor:string}
  dynamicRatingGrid: CSSProperties
}) {
  return (
    <div
      style={{
        ...compareCard,
        ...(favored ? favoredCompareCard : {}),
      }}
    >
      <div style={compareHead}>
        <div style={compareHeadCopyStyle}>
          <div style={compareTitle}>{title}</div>
          <div style={compareSubtitle}>{subtitle}</div>
        </div>

        {profileHref ? (
          <Link href={profileHref} style={miniGhostButton}>
            View profile
          </Link>
        ) : null}
      </div>

      <div style={ratingSectionLabelStyle}>TIQ DYNAMIC</div>
      <div data-comparison-rating-grid style={dynamicRatingGrid}>
        <RatingPill displayValue={display?.tiq.overall} label="Overall" value={ratings.overall} active={ratingView === 'overall'} selfRated={selfRated} />
        <RatingPill displayValue={display?.tiq.singles} label="Singles" value={ratings.singles} active={ratingView === 'singles'} selfRated={selfRated} />
        <RatingPill displayValue={display?.tiq.doubles} label="Doubles" value={ratings.doubles} active={ratingView === 'doubles'} selfRated={selfRated} />
      </div>

      <div style={{ ...ratingSectionLabelStyle, marginTop: 10 }}>USTA DYNAMIC</div>
      <div data-comparison-rating-grid style={dynamicRatingGrid}>
        <RatingPill displayValue={display?.usta.overall} label="Overall" value={selfRated ? null : ustaRatings.overall} active={ratingView === 'overall'} pendingLabel={selfRated ? 'Pending' : undefined} />
        <RatingPill displayValue={display?.usta.singles} label="Singles" value={selfRated ? null : ustaRatings.singles} active={ratingView === 'singles'} pendingLabel={selfRated ? 'Pending' : undefined} />
        <RatingPill displayValue={display?.usta.doubles} label="Doubles" value={selfRated ? null : ustaRatings.doubles} active={ratingView === 'doubles'} pendingLabel={selfRated ? 'Pending' : undefined} />
      </div>

      <div style={highlightBox}>
        <div style={highlightLabel}>
          {projectionView === 'singles' ? 'Singles projection rating' : 'Doubles projection rating'}
        </div>
        <div style={highlightValue}>{display?.projection ?? `${formatRating(projectionRating)}${selfRated ? ' S' : ''}`}</div>
      </div>

      {display ? (display.signal ? <div style={{...ratingSignalStyle,color:display.signalColor}}>{display.signal}</div> : null) : (() => {
        if (selfRated) return (
          <div style={{ ...ratingSignalStyle, color: 'var(--brand-lime)' }}>
            Self-rated - verified results will replace the S signal.
          </div>
        )
        const tiqVal = ratingView === 'singles' ? ratings.singles : ratingView === 'doubles' ? ratings.doubles : ratings.overall
        const ustaVal = ratingView === 'singles' ? ustaRatings.singles : ratingView === 'doubles' ? ustaRatings.doubles : ustaRatings.overall
        if (tiqVal == null || ustaVal == null) return null
        const diff = tiqVal - ustaVal
        const {label,color} = ratingSignal(diff)
        return (
          <div style={{ ...ratingSignalStyle, color }}>
            {label} - TIQ signal {diff >= 0 ? '+' : ''}{diff.toFixed(2)}
          </div>
        )
      })()}
    </div>
  )
}

function RatingPill({
  label,
  value,
  active,
  selfRated = false,
  pendingLabel,
  displayValue,
}: {
  label: string
  value: number | null
  active?: boolean
  selfRated?: boolean
  pendingLabel?: string
  displayValue?: string
}) {
  return (
    <div
      style={{
        ...ratingPill,
        ...(active ? ratingPillActive : {}),
      }}
    >
      <div style={ratingPillLabel}>{label}</div>
      <div style={ratingPillValue}>{displayValue ?? pendingLabel ?? `${formatRating(value)}${selfRated && value != null ? ' S' : ''}`}</div>
    </div>
  )
}

export const compareCard: CSSProperties = {
  borderRadius: '24px',
  padding: '18px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-panel-bg)',
  boxShadow: 'var(--shadow-soft)',
  minWidth: 0,
  overflowWrap: 'anywhere',
}

export const favoredCompareCard: CSSProperties = {
  borderColor: 'color-mix(in srgb, var(--brand-green) 36%, var(--shell-panel-border) 64%)',
  background: 'color-mix(in srgb, var(--brand-green) 7%, var(--shell-panel-bg) 93%)',
}

export const compareHead: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'flex-start',
  gap: '12px',
  marginBottom: '16px',
  flexWrap: 'wrap',
  minWidth: 0,
}

export const compareHeadCopyStyle: CSSProperties = {
  minWidth: 0,
  overflowWrap: 'anywhere',
}

export const compareTitle: CSSProperties = {
  color: 'var(--foreground-strong)',
  fontSize: '24px',
  lineHeight: 1.15,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

export const compareSubtitle: CSSProperties = {
  marginTop: '6px',
  color: 'var(--shell-copy-muted)',
  fontSize: '14px',
  lineHeight: 1.5,
  fontWeight: 500,
  overflowWrap: 'anywhere',
}

export const miniGhostButton: CSSProperties = {
  whiteSpace: 'normal',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  minHeight: '40px',
  padding: '0 14px',
  borderRadius: '999px',
  border: '1px solid var(--shell-panel-border)',
  background: 'var(--shell-chip-bg)',
  color: 'var(--foreground-strong)',
  textDecoration: 'none',
  fontWeight: 800,
  fontSize: '13px',
  maxWidth: '100%',
  minWidth: 0,
  textAlign: 'center',
  overflowWrap: 'anywhere',
}

export const ratingSectionLabelStyle: CSSProperties = {
  marginBottom: 6,
  color: 'var(--shell-copy-muted)',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: '0.04em',
  overflowWrap: 'anywhere',
}

export const ratingSignalStyle: CSSProperties = {
  marginTop: 10,
  minWidth: 0,
  maxWidth: '100%',
  fontSize: 12,
  fontWeight: 800,
  overflowWrap: 'anywhere',
}

export const ratingPill: CSSProperties = {
  borderRadius: '16px',
  padding: '14px 14px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  minWidth: 0,
}

export const ratingPillActive: CSSProperties = {
  background: 'color-mix(in srgb, var(--brand-blue-2) 12%, var(--shell-chip-bg) 88%)',
  borderColor: 'color-mix(in srgb, var(--brand-blue-2) 30%, var(--shell-panel-border) 70%)',
}

export const ratingPillLabel: CSSProperties = {
  color: 'rgba(197,213,234,0.72)',
  fontSize: '12px',
  lineHeight: 1.5,
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

export const ratingPillValue: CSSProperties = {
  marginTop: '4px',
  color: 'var(--foreground-strong)',
  fontSize: '20px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}

export const highlightBox: CSSProperties = {
  borderRadius: '16px',
  padding: '16px',
  background: 'var(--shell-chip-bg)',
  border: '1px solid var(--shell-panel-border)',
  minWidth: 0,
}

export const highlightLabel: CSSProperties = {
  color: 'rgba(197,213,234,0.72)',
  fontSize: '12px',
  lineHeight: 1.5,
  fontWeight: 700,
  overflowWrap: 'anywhere',
}

export const highlightValue: CSSProperties = {
  marginTop: '6px',
  color: '#9bd2ff',
  fontSize: '32px',
  lineHeight: 1,
  fontWeight: 900,
  letterSpacing: 0,
  overflowWrap: 'anywhere',
}
