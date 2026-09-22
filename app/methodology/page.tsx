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
    'How TenAceIQ calculates dynamic player ratings -- expected performance, game-score context, K-factors, and recency weighting.',
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
    text: 'Both teams shape the expectation. A stronger player is protected from a close-loss penalty when carrying a materially weaker partner.',
    icon: 'lineupBuilder',
  },
  {
    title: 'Keep TiQ and USTA separate',
    text: 'TiQ reads all reviewed competition. The USTA-proximity track reads eligible USTA results only.',
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
      <InfoPage
        kicker="Methodology"
        title="Understand your TiQ rating at a glance."
        intro="TiQ is a score-aware competitive signal, not a replacement for your official USTA rating. It begins with factual USTA context when available, then learns from reviewed match results."
      >
        <InfoActionGrid cards={methodologyCards} />

        <section id="rating-basics" style={ratingBasicsStyle} aria-labelledby="rating-basics-title">
          <div>
            <span style={basicsKickerStyle}>TiQ rating in plain English</span>
            <h2 id="rating-basics-title" className="section-title" style={basicsTitleStyle}>What makes your number move?</h2>
          </div>
          <div style={basicsGridStyle}>
            <MethodologyBasicStep number="1" title="Set a credible starting point">
              A computer-rated USTA level is a protected starting band. A self-rated or unknown player can settle faster as results arrive.
            </MethodologyBasicStep>
            <MethodologyBasicStep number="2" title="Compare performance with expectation">
              TiQ looks at the score, not only win or loss. Playing a stronger side close can help; underperforming against an expected matchup can trim the signal.
            </MethodologyBasicStep>
            <MethodologyBasicStep number="3" title="Build separate singles and doubles reads">
              Singles and doubles have their own history. Overall blends the competitive evidence without pretending the two formats are identical.
            </MethodologyBasicStep>
            <MethodologyBasicStep number="4" title="Let evidence—not time—do the work">
              A rating changes only when an eligible reviewed result is processed. Time away lowers confidence, not your demonstrated playing strength.
            </MethodologyBasicStep>
          </div>
          <p style={basicsNoteStyle}>
            TiQ does not import or mirror TennisRecord&rsquo;s estimated rating. It keeps TiQ, USTA-proximity, singles, doubles, and overall views distinct so you can see what the match evidence actually supports.
          </p>
        </section>

        <MethodologyDetails>
          <div>
            <h2 className="section-title" style={{ fontSize: '1.2rem' }}>The rating scale</h2>
            <p>
              Ratings run from 1.5 to 7.0 and align with NTRP levels. Bands are spaced 0.5 apart
              (1.5, 2.0, 2.5 ... 6.5, 7.0). A profile with a factual USTA designation begins from
              that band. A profile without one starts provisionally at 3.5 until reviewed match
              evidence establishes a better read. The level-up meter shows the current TiQ signal
              against the next half-point marker; it does not replace an official USTA rating.
            </p>
          </div>

          <div>
            <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Two independent tracks</h2>
            <p>
              Every player carries two parallel sets of dynamic ratings: a <strong>TIQ track</strong> that
              updates from all matches regardless of source, and a <strong>USTA track</strong> that updates
              only from eligible USTA results, including reviewed local uploads and factual USTA-match evidence.
              TIQ ratings reflect full competitive activity across all leagues; USTA ratings mirror what
              a USTA-only result set would produce. Both tracks maintain separate singles, doubles, and
              overall ratings -- six dynamic values per player in total.
            </p>
          </div>

          <div>
            <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Expected performance</h2>
            <p>
              Before each scored match the system estimates each side&rsquo;s expected share of games from
              their current ratings:
            </p>
            <p style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 14px', margin: '10px 0', fontSize: 14, overflowWrap: 'anywhere' }}>
              expected game share = 1 / (1 + 10 ^ ((opponent rating - your rating) / 1.6))
            </p>
            <p>
              The rating change starts with actual game share minus expected game share. A result close
              to expectation makes only a small move. A lower-rated player who keeps a strong opponent
              close can therefore gain rating despite losing; a favorite who wins less decisively than
              expected can give some rating back. The Win% column remains a pre-match win estimate,
              separate from this score-aware performance calculation.
            </p>
          </div>

          <div>
            <h2 className="section-title" style={{ fontSize: '1.2rem' }}>K-factors</h2>
            <p>
              The K-factor controls how much a single match can shift a rating. TenAceIQ uses three
              separate K values: <strong>0.12 for singles</strong>, <strong>0.107 for doubles</strong>,
              and <strong>0.052 for the overall rating</strong>. For a usable score, the movement is
              roughly K x (actual game share - expected game share). When a score is unavailable, the
              system uses a conservative expected win/loss fallback.
            </p>
            <p style={{ marginTop: 10 }}>
              New players are in a <strong>provisional phase</strong> where the K-factor is temporarily
              multiplied to help them converge to their true level faster:
            </p>
            <ul style={{ paddingLeft: 20, marginTop: 8, display: 'grid', gap: 6 }}>
              <li>Matches 1-9: <strong>2x K</strong> (fast calibration)</li>
              <li>Matches 10-19: <strong>1.5x K</strong></li>
              <li>Matches 20-29: <strong>1.2x K</strong></li>
              <li>Match 30+: <strong>1x K</strong> (stable)</li>
            </ul>
            <p style={{ marginTop: 10 }}>
              The confidence level shown on a player profile -- Low, Medium, or High -- reflects these
              phases directly. A Low confidence rating is still moving quickly toward equilibrium.
            </p>
          </div>

          <div>
            <h2 className="section-title" style={{ fontSize: '1.2rem' }}>How the score changes the signal</h2>
            <p>
              A 7-6, 7-6 result between similarly rated players is nearly what the ratings predict, so
              it moves them only slightly. A 6-0, 6-0 result or a close loss by a substantially lower-
              rated player is more informative because the game share differs more from expectation.
            </p>
            <p style={{ marginTop: 10 }}>
              Recent results carry somewhat more weight, and an upset win receives a modest additional
              boost. These adjustments refine the performance signal; they do not use an external source&rsquo;s
              proprietary rating.
            </p>
          </div>

          <div>
            <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Doubles context</h2>
            <p>
              Doubles begins with the combined strength of both players on each side. TiQ then reads
              the result against that team expectation and maintains a separate doubles signal. When
              a stronger player has a materially lower-rated partner and loses a close scored match to
              a comparable pair, TiQ protects that player from a speculative negative adjustment.
            </p>
          </div>

          <div>
            <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Recency weighting</h2>
            <p>
              When ratings are recalculated, matches are weighted by how recently they were played.
              A match played today carries full weight (1.12x); a match played two or more years ago
              carries reduced weight (0.88x), with a linear scale in between. A player&rsquo;s recent
              form therefore has more influence on their current rating than results from seasons ago.
            </p>
          </div>

          <div>
            <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Inactivity and confidence</h2>
            <p>
              Time away does not regress a player toward a default rating. TenAceIQ changes rating
              strength only when an eligible match result is processed. Match volume and the age of a
              player&rsquo;s last result provide context for how much evidence sits behind that rating.
            </p>
          </div>

          <div>
            <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Score parsing and edge cases</h2>
            <p>
              Scores are normalized before processing. Tiebreak notation like 7-6(3) has the
              point score stripped, leaving 7-6. Match tiebreaks stored without brackets (e.g. 10-8)
              are excluded from the set-level calculation to avoid inflating game counts. A 7-5 set
              is treated as a regular set, not a tiebreak. Retirements and walkovers use the
              conservative win/loss fallback because they do not provide a complete game-share signal.
            </p>
          </div>
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
