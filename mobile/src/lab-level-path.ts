import websiteUi from '../generated/website-ui.json'
import {playerLevelPath} from '../../lib/player-level-path'
import {publishedUstaRating,publishedUstaLabel} from '../../lib/published-usta-rating'
import {formatRatingValue} from '../../lib/player-rating-display'
import type {RecordedRatings} from './player-ratings-data'
export function labLevelPathHtml(player: RecordedRatings) {
  const self = player.rating_source === 'self'
  const rating = player.overall_dynamic_rating
  const path = playerLevelPath(rating, publishedUstaRating(player), self)
  const current = typeof rating === 'number' && Number.isFinite(rating) && rating >= 1.5 && rating <= 7
    ? formatRatingValue(rating)
    : '—'
  const published = `<div><dt>USTA current</dt><dd>${publishedUstaLabel(player)}</dd></div>`
  const context = 'TIQ estimates playing strength. USTA current is the verified published level on your record. TIQ bands do not predict a USTA promotion or drop.'

  if (path.tiqBase === null || path.nextTiqBand === null || path.ratingToGo === null) {
    const status = self ? 'Self-rated record. Play and connect results to build your TIQ estimate.'
      : path.tiqBase === 7 ? 'You are in the top TIQ band.' : 'Connect rated results to see your TIQ band.'
    return `<section class="lab-level-path" aria-labelledby="lab-level-title">
      <h3 id="lab-level-title">Your TIQ band</h3>
      <dl class="lab-level-values"><div><dt>Overall TIQ</dt><dd>${current}</dd></div>${published}</dl>
      <p>${status}</p><p class="rating-context">${context}</p>
    </section>`
  }

  const start = path.tiqBase.toFixed(1)
  const target = path.nextTiqBand.toFixed(1)
  const roundedGap = path.ratingToGo.toFixed(2)
  const gap = roundedGap === '0.00' ? 'Less than 0.01' : roundedGap
  const percent = Math.min(99, Math.round(path.levelProgress))
  return `<section class="lab-level-path" aria-labelledby="lab-level-title">
    <h3 id="lab-level-title">Your next TIQ band</h3>
    <dl class="lab-level-values lab-band-target">
      <div><dt>Current TIQ</dt><dd>${current}</dd></div>
      <div><dt>Next band</dt><dd>${target}</dd></div>
    </dl>
    <p class="lab-band-gap">${gap} TIQ points to the next band</p>
    <div class="lab-band-range">
      <p>Position in current band</p>
      <meter min="0" max="100" value="${percent}" aria-label="TIQ band progress" aria-valuetext="${current} TIQ in the ${start} to ${target} band">${percent}%</meter>
      <div class="lab-level-scale" aria-hidden="true"><span>${start}</span><span>${target}</span></div>
    </div>
    <button type="button" class="secondary app-tool lab-action-row lab-band-practice" data-training="catalog" aria-label="Practice &amp; drills" aria-describedby="lab-band-drill-detail">
      <span class="lab-action-icon" aria-hidden="true">${websiteUi.icons.catalog}</span>
      <span class="app-tool-copy"><strong>Practice &amp; drills</strong><span id="lab-band-drill-detail">Browse drills or follow your training plan</span></span>
      <span class="app-tool-arrow" aria-hidden="true">›</span>
    </button>
    <details class="lab-level-about">
      <summary><span>About your TIQ band</span><span class="app-tool-arrow" aria-hidden="true">›</span></summary>
      <p class="rating-context">The meter shows your position within a half-point band. It does not measure change over time.</p>
      <dl class="lab-level-values">${published}</dl>
      <p class="rating-context">${context}</p>
    </details>
  </section>`
}
