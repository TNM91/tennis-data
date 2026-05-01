import type { Metadata } from 'next'
import SiteShell from '@/app/components/site-shell'
import InfoPage from '@/app/components/info-page'

export const metadata: Metadata = {
  title: 'Methodology',
  description:
    'How TenAceIQ calculates dynamic player ratings -- the Elo-based algorithm, K-factors, score multipliers, recency weighting, and inactivity decay.',
}

export default function MethodologyPage() {
  return (
    <SiteShell active="/methodology">
      <InfoPage
        kicker="Methodology"
        title="How TenAceIQ calculates dynamic ratings."
        intro="TenAceIQ uses an Elo-based rating system tuned for recreational tennis. Every match updates a player's rating based on who they played, what the expected outcome was, how dominant the win or loss was, and how recently it happened. This page explains each part of that calculation."
      >
        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>The rating scale</h2>
          <p>
            Ratings run from 1.5 to 7.0 and align with NTRP levels. Bands are spaced 0.5 apart
            (1.5, 2.0, 2.5 ... 6.5, 7.0). The default starting rating for a new player is 3.5. The
            level-up meter on a player profile shows progress from the current band floor to the
            next band ceiling.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Two independent tracks</h2>
          <p>
            Every player carries two parallel sets of dynamic ratings: a <strong>TIQ track</strong> that
            updates from all matches regardless of source, and a <strong>USTA track</strong> that updates
            only from USTA-imported matches. TIQ ratings reflect full competitive activity across all
            leagues; USTA ratings mirror what a purely USTA-based system would produce. Both tracks
            maintain separate singles, doubles, and overall ratings -- six dynamic values per player in
            total.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Expected score and the Elo formula</h2>
          <p>
            Before each match the system computes an expected win probability for each player:
          </p>
          <p style={{ fontFamily: 'monospace', background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '10px 14px', margin: '10px 0', fontSize: 14 }}>
            expected = 1 / (1 + 10 ^ ((opponent_rating - your_rating) / 0.45))
          </p>
          <p>
            A player rated 4.0 facing a 3.5 opponent has roughly a 78% expected win chance. That
            expectation anchors how much the result moves each player&rsquo;s rating -- beating a
            heavily favored opponent moves the needle more than beating someone you were expected to
            beat. The Win% column on a player&rsquo;s match history shows this pre-match probability.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>K-factors</h2>
          <p>
            The K-factor controls how much a single match can shift a rating. TenAceIQ uses three
            separate K values: <strong>0.12 for singles</strong>, <strong>0.107 for doubles</strong>,
            and <strong>0.052 for the overall rating</strong>. A win moves a rating by roughly
            K x (1 - expected), and a loss by K x (0 - expected).
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
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Score quality multiplier</h2>
          <p>
            A 6-0 6-0 win and a 7-6 7-6 win are not the same signal. The system applies a score
            multiplier (ranging from 0.82 to 2.02) based on what the scoreline says about how
            dominant the win was:
          </p>
          <ul style={{ paddingLeft: 20, marginTop: 8, display: 'grid', gap: 6 }}>
            <li><strong>Dominance ratio</strong> -- games won by the winner as a share of all games played. Higher ratio produces a larger multiplier.</li>
            <li><strong>Straight-sets win</strong> -- small bonus for winning without dropping a set.</li>
            <li><strong>Bagel (6-0) or breadstick (6-1) set</strong> -- additional bonus per shutout set won.</li>
            <li><strong>Tiebreak sets</strong> -- slight reduction; a tiebreak signals a close set.</li>
            <li><strong>Deciding (third) set</strong> -- slight reduction; both players won a set.</li>
            <li><strong>Close sets (margin {'<='} 2 games)</strong> -- minor reduction per non-tiebreak close set.</li>
          </ul>
          <p style={{ marginTop: 10 }}>
            Upset wins receive an additional boost: if the lower-rated player wins, their multiplier
            scales up based on the rating gap, rewarding results the algorithm did not expect.
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
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Inactivity decay</h2>
          <p>
            Ratings do not freeze permanently when a player stops competing. After 90 days of
            inactivity, dynamic ratings begin a slow regression toward 3.5 at 2% of the gap per
            month. A player rated 4.5 who stops playing for one year decays to roughly 4.33; after
            two years, roughly 4.15. Players who return to competition re-enter the provisional K
            phase, which helps them re-calibrate quickly. A staleness indicator appears on a player
            profile when the last recorded match was more than 90 days ago.
          </p>
        </div>

        <div>
          <h2 className="section-title" style={{ fontSize: '1.2rem' }}>Score parsing and edge cases</h2>
          <p>
            Scores are normalized before processing. Tiebreak notation like 7-6(3) has the
            point score stripped, leaving 7-6. Match tiebreaks stored without brackets (e.g. 10-8)
            are excluded from the set-level calculation to avoid inflating game counts. A 7-5 set
            is treated as a regular close set, not a tiebreak. Retirements and walkovers produce a
            neutral multiplier of 1.0 -- the result counts but the margin does not.
          </p>
        </div>
      </InfoPage>
    </SiteShell>
  )
}
