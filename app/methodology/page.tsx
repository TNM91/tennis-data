import type { Metadata } from 'next'
import type { CSSProperties, ReactNode } from 'react'
import JsonLd from '@/app/components/json-ld'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'
import InfoActionGrid, { type InfoActionCard } from '@/app/components/info-action-grid'
import { buildRouteMetadata } from '@/lib/route-metadata'
import { buildPublicSectionBreadcrumbJsonLd } from '@/lib/structured-data'

const dataAssistMethodologyHref = '/data-assist?intent=request-review&context=Methodology'

export const metadata: Metadata = buildRouteMetadata({
  title: 'Methodology',
  description:
    'Understand your TiQ playing strength, official USTA level, match evidence, and the limits of year-end movement forecasting.',
  path: '/methodology',
})

const methodologyCards: InfoActionCard[] = [
  {
    title: 'Start with the right baseline',
    text: 'A confirmed USTA level anchors the starting band. Self-rated and unlabelled profiles stay provisional while match evidence builds.',
    icon: 'playerRatings',
  },
  {
    title: 'Read the score in context',
    text: 'TiQ compares the score with what the matchup predicted. A close loss to stronger competition can still be a positive performance.',
    icon: 'matchupAnalysis',
  },
  {
    title: 'Doubles uses all four players',
    text: 'Both players on each side shape the expected game share. Each player keeps a separate doubles strength estimate.',
    icon: 'lineupBuilder',
  },
  {
    title: 'Keep TiQ and USTA separate',
    text: 'TIQ estimates playing strength. Your official USTA level stays separate; the USTA-proximity view is another TenAceIQ estimate.',
    icon: 'leagueTennis',
  },
  {
    title: 'Use factual source data',
    text: 'Source scorecards and factual USTA labels can support TiQ. TennisRecord’s estimated rating never sets or moves a TiQ rating.',
    icon: 'dataUpload',
  },
  {
    title: 'Fix the evidence, not the number',
    text: 'If a score, player, or team context is wrong, send it for review. Data Assist prevents changing tennis context unchecked, then TiQ recalculates from the corrected match record.',
    href: dataAssistMethodologyHref,
    cta: 'Request a review',
    icon: 'matchupAnalysis',
  },
]

export default function MethodologyPage() {
  return (
    <SiteShell active="/methodology">
      <JsonLd id="methodology-breadcrumb-jsonld" data={buildPublicSectionBreadcrumbJsonLd('Methodology', '/methodology')} />
      <InfoPage kicker="Methodology" title="Understand your TIQ rating." intro="TIQ estimates how strongly you are playing from your scores, opponents, and doubles partners. Your official USTA rating stays separate.">
        <InfoActionGrid cards={methodologyCards} />
        <section id="rating-basics" style={ratingBasicsStyle} aria-labelledby="rating-basics-title">
          <div><span style={basicsKickerStyle}>TiQ rating in plain English</span><h2 id="rating-basics-title" className="section-title" style={basicsTitleStyle}>What makes your number move?</h2></div>
          <div style={basicsGridStyle}>
            <MethodologyBasicStep number="1" title="Start with dated evidence">Your latest usable individual computer rating starts at the midpoint of its TIQ band. A 4.5 label starts at 4.75. We can carry a label from either of the two preceding years when it remains usable. This is a starting assumption, not your unpublished USTA dynamic rating.</MethodologyBasicStep>
            <MethodologyBasicStep number="2" title="Use the court context">When an individual starting label is missing, existing opponent and partner estimates help establish a starting point. A suitable individual Adult division also supplies context. A combined team level never becomes your individual rating.</MethodologyBasicStep>
            <MethodologyBasicStep number="3" title="Compare the score with expectations">Winning more games than expected moves strength upward; winning fewer moves it downward. A close loss to stronger opponents can help. Singles compares two players; doubles compares the average strength of each pair.</MethodologyBasicStep>
            <MethodologyBasicStep number="4" title="Build your history in order">All courts on a day use the estimates available before that day’s results. Updates are applied together afterward. Singles and doubles stay separate; overall blends them according to the number of usable courts.</MethodologyBasicStep>
          </div>
          <p style={basicsNoteStyle}>Missing, conflicting, or incomplete evidence cannot establish a reliable new estimate. A player without a connected starting point remains without a new network estimate. Where current evidence cannot support recalculation, an existing rating may remain visible.</p>
        </section>
        <section id="rating-scale" style={ratingBasicsStyle} aria-labelledby="rating-scale-title">
          <h2 id="rating-scale-title" className="section-title">How to read your playing band</h2>
          <p>TIQ 4.00 to below 4.50 sits in the 4.0 band. TIQ 4.50 to below 5.00 sits in the 4.5 band. TIQ 5.00 to below 5.50 sits in the 5.0 band.</p>
          <p>A 4.63 estimate sits within the 4.5 band. A 4.95 estimate sits near its upper end. These are TIQ display bands, not official USTA dynamic thresholds. Read the number as estimated playing strength.</p>
        </section>
        <section id="year-end-movement" style={ratingBasicsStyle} aria-labelledby="year-end-title">
          <h2 id="year-end-title" className="section-title">What movement can tell you</h2>
          <p>Sustained results near the top of your band suggest stronger play. Sustained results above it suggest the next band may describe your play better. The same principle applies downward. One match or one boundary crossing does not establish a USTA bump or drop.</p>
          <p>Your official USTA level and designation are shown separately. The USTA-proximity view is a TenAceIQ estimate from USTA results, not USTA’s unpublished dynamic rating. Match counts and evidence labels describe available history; they are not probabilities of a year-end change.</p>
          <p>TIQ does not publish validated bump or drop probabilities. TennisRecord estimates provide an outside comparison and never set or move your TIQ rating.</p>
          <p>If a recent result is missing or attached to the wrong player, <a href={dataAssistMethodologyHref}>request a data review</a>.</p>
        </section>
        <MethodologyDetails>
          <div><h2 className="section-title">Which matches count</h2><p>The improved current-season calculation uses complete, eligible courts with usable scores and resolved player identities. Defaults, walkovers, retirements, duplicates, and unresolved source conflicts are excluded. A playing-strength result may still require separate eligibility review for year-end USTA forecasting.</p></div>
          <div><h2 className="section-title">How much a result changes strength</h2><p>The update depends on the difference between expected and actual game share and the model’s internal uncertainty. More match evidence changes how strongly a new result influences the estimate. Internal uncertainty is not a measured probability that the rating is correct.</p><p>There is no inactivity penalty, additional recency weighting, or repeated-partner discount in the improved network calculation. It does not impose a protected minimum rating or an automatic upset bonus.</p></div>
          <div><h2 className="section-title">Starting evidence and history</h2><p>A USTA label copied from a source profile is kept separate from that source’s estimated strength. An older label does not prove a later stay at the same level. Current-season estimates use the latest usable individual C label from the two preceding years. A carried label must still agree with the owner’s current profile; newer conflicting labels require review. Earlier seasons retain their existing calculation.</p><p>Unknown-player initialization blends 75% of a suitable individual Adult division midpoint with 25% of the existing court estimate. It requires a connection to an anchored estimate. A division provides competition context, not an official individual rating.</p></div>
        </MethodologyDetails>
      </InfoPage>
    </SiteShell>
  )
}

function MethodologyBasicStep({ number, title, children }: { number: string; title: string; children: ReactNode }) {
  return (
    <article style={basicStepStyle}>
      <span style={basicNumberStyle}>{number}</span>
      <div>
        <h3 style={basicStepTitleStyle}>{title}</h3>
        <p style={basicStepTextStyle}>{children}</p>
      </div>
    </article>
  )
}

function MethodologyDetails({ children }: { children: ReactNode }) {
  return (
    <details className="publicInfoDetailsSection" style={detailsStyle}>
      <summary style={summaryStyle}>
        <span style={summaryTextStyle}>Show rating details</span>
      </summary>
      <div style={detailsBodyStyle}>
        {children}
      </div>
    </details>
  )
}

const detailsStyle: CSSProperties = {
  display: 'block',
  minWidth: 0,
  borderRadius: 18,
  border: '1px solid rgba(125,211,252,0.16)',
  background: 'rgba(15,23,42,0.48)',
  boxSizing: 'border-box',
  overflow: 'hidden',
}

const ratingBasicsStyle: CSSProperties = {
  display: 'grid',
  gap: 16,
  padding: 18,
  borderRadius: 18,
  border: '1px solid rgba(155,225,29,0.28)',
  background: 'linear-gradient(145deg, rgba(155,225,29,0.1), rgba(7,17,33,0.58) 46%, rgba(116,190,255,0.08))',
  minWidth: 0,
}

const basicsKickerStyle: CSSProperties = {
  color: 'var(--brand-green)',
  fontSize: 11,
  fontWeight: 900,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
}

const basicsTitleStyle: CSSProperties = {
  margin: '5px 0 0',
  fontSize: 'clamp(1.35rem, 4vw, 1.85rem)',
}

const basicsGridStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 210px), 1fr))',
  gap: 10,
  minWidth: 0,
}

const basicStepStyle: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '30px minmax(0, 1fr)',
  gap: 10,
  alignItems: 'start',
  padding: 12,
  borderRadius: 14,
  border: '1px solid rgba(255,255,255,0.1)',
  background: 'rgba(6,16,32,0.52)',
  minWidth: 0,
}

const basicNumberStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 30,
  height: 30,
  borderRadius: 999,
  background: 'var(--brand-green)',
  color: '#06172F',
  fontSize: 13,
  fontWeight: 950,
}

const basicStepTitleStyle: CSSProperties = {
  margin: 0,
  color: 'var(--foreground-strong)',
  fontSize: 15,
  lineHeight: 1.25,
}

const basicStepTextStyle: CSSProperties = {
  margin: '5px 0 0',
  color: 'var(--shell-copy-muted)',
  fontSize: 13,
  lineHeight: 1.5,
}

const basicsNoteStyle: CSSProperties = {
  margin: 0,
  padding: '11px 12px',
  borderRadius: 12,
  background: 'rgba(6,16,32,0.5)',
  border: '1px solid rgba(116,190,255,0.16)',
  color: 'var(--foreground)',
  fontWeight: 650,
  lineHeight: 1.55,
}

const summaryStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  minHeight: 46,
  padding: '0 14px',
  color: 'var(--foreground-strong)',
  listStyle: 'none',
  cursor: 'pointer',
  overflowWrap: 'anywhere',
}

const summaryTextStyle: CSSProperties = {
  fontSize: 14,
  fontWeight: 900,
  overflowWrap: 'anywhere',
}

const detailsBodyStyle: CSSProperties = {
  display: 'grid',
  gap: 18,
  minWidth: 0,
  padding: '0 14px 16px',
}

