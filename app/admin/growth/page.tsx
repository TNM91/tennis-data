'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AdminActionRow,
  AdminEmptyState,
  AdminReviewFrame,
  AdminReviewHero,
  AdminReviewPanel,
  AdminStatusPanel,
  adminFactGridStyle,
  adminSubPanelStyle,
} from '@/app/admin/_components/admin-review-ui'
import AdminGate from '@/app/components/admin-gate'
import SiteShell from '@/app/components/site-shell'
import { supabase } from '@/lib/supabase'
import type {
  CaptainPilotActivation,
  CaptainPilotFollowUp,
  CaptainPilotFunnel,
  CaptainPilotSourceBreakdown,
} from '@/lib/admin-growth-funnel'
import styles from './growth.module.css'

type Period = 7 | 30 | 90
type Funnel = {
  publicActions: number
  signupRequests: number
  checkoutClicks: number
  checkoutStarts: number
  checkoutFailures: number
  paidActivations: number
  captainPilot: CaptainPilotFunnel
  captainPilotSources: CaptainPilotSourceBreakdown[]
  captainPilotFollowUps: CaptainPilotFollowUp[]
  captainPilotFollowUpCount: number
  captainPilotActivation: CaptainPilotActivation
}

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
]

export default function AdminGrowthPage() {
  const [period, setPeriod] = useState<Period>(30)
  const [funnel, setFunnel] = useState<Funnel | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [followUpNotice, setFollowUpNotice] = useState('')
  const [sourceNotice, setSourceNotice] = useState('')

  const loadFunnel = useCallback(async (days: Period) => {
    setLoading(true)
    setError('')
    try {
      const { data } = await supabase.auth.getSession()
      const token = data.session?.access_token
      if (!token) throw new Error('Sign in as an admin to review growth.')
      const response = await fetch(`/api/admin/growth-funnel?days=${days}`, {
        headers: { authorization: `Bearer ${token}` },
      })
      const body = await response.json().catch(() => null) as { ok?: boolean; message?: string; funnel?: Funnel } | null
      if (!response.ok || !body?.ok || !body.funnel) throw new Error(body?.message || 'Growth reporting could not be loaded.')
      setFunnel(body.funnel)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Growth reporting could not be loaded.')
      setFunnel(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadFunnel(period)
  }, [loadFunnel, period])

  const stages = useMemo(() => funnel ? [
    {
      label: 'Signup requests',
      value: funnel.signupRequests,
      detail: 'Confirmation emails accepted for new accounts.',
      rate: null,
      href: '/admin/product-events?search=signup_confirmation_sent',
    },
    {
      label: 'Checkout clicks',
      value: funnel.checkoutClicks,
      detail: 'Members who chose to continue to payment.',
      rate: ratio(funnel.checkoutClicks, funnel.signupRequests),
      href: '/admin/product-events?search=upgrade_checkout_clicked',
    },
    {
      label: 'Stripe opens',
      value: funnel.checkoutStarts,
      detail: 'Stripe Checkout sessions created successfully.',
      rate: ratio(funnel.checkoutStarts, funnel.checkoutClicks),
      href: '/admin/product-events?search=upgrade_checkout_started',
    },
    {
      label: 'Paid activations',
      value: funnel.paidActivations,
      detail: 'Stripe reported an active or trial entitlement.',
      rate: ratio(funnel.paidActivations, funnel.checkoutStarts),
      href: '/admin/access?billing=stripe',
    },
  ] : [], [funnel])

  const captainStages = useMemo(() => funnel ? [
    {
      label: 'Offer opened',
      value: funnel.captainPilot.offerViews,
      detail: 'Signed-in captains who opened the pilot.',
      rate: null,
      href: '/admin/product-events?search=captain_pilot_viewed',
    },
    {
      label: 'Offer action',
      value: funnel.captainPilot.offerActions,
      detail: 'Chose signup, preview, or activation.',
      rate: ratio(funnel.captainPilot.offerActions, funnel.captainPilot.offerViews),
      href: '/admin/product-events?search=captain_pilot_cta_clicked',
    },
    {
      label: 'Pilot claimed',
      value: funnel.captainPilot.claims,
      detail: 'Submitted the short Captain team form.',
      rate: ratio(funnel.captainPilot.claims, funnel.captainPilot.offerActions),
      href: '/admin/upgrade-requests?plan=captain',
    },
    {
      label: 'Activated',
      value: funnel.captainPilot.activations,
      detail: 'Captain access started with no card.',
      rate: ratio(funnel.captainPilot.activations, funnel.captainPilot.claims),
      href: '/admin/product-events?search=captain_pilot_card_free_activated',
    },
    {
      label: 'Billing added',
      value: funnel.captainPilot.billingConnected,
      detail: 'Connected Stripe to continue after free access.',
      rate: ratio(funnel.captainPilot.billingConnected, funnel.captainPilot.activations),
      href: '/admin/access?billing=stripe',
    },
  ] : [], [funnel])

  return (
    <SiteShell active="/admin">
      <AdminGate>
        <AdminReviewFrame>
          <AdminReviewHero
            kicker="Growth funnel"
            title="See the next conversion decision"
            actions={
              <>
                <Link href="/admin/promotions" className="button-secondary">Stripe promotions</Link>
                <Link href="/admin/product-events" className="button-secondary">Product events</Link>
              </>
            }
          >
            Follow the path from a person taking action in TiQ to card-free Captain access, first value, and optional billing.
          </AdminReviewHero>

          <AdminStatusPanel
            tone="success"
            text="Visitor and page-view traffic belongs in Vercel Web Analytics. This funnel intentionally measures identifiable product actions and billing progress after a person begins using TiQ."
          >
            <a href="https://vercel.com/tennis-data/tennis-data/analytics" target="_blank" rel="noreferrer" className="button-ghost">Open site traffic</a>
          </AdminStatusPanel>

          <AdminReviewPanel style={{ marginTop: 18 }} ariaLabel="Captain Pilot conversion funnel">
            <div className={styles.pilotHeader}>
              <div>
                <div className="section-kicker">Captain Pilot</div>
                <h2 className="section-title" style={{ marginTop: 6 }}>Offer to active Captain</h2>
              </div>
              <p className="subtle-text">Identified member actions for the last {period} days. Open site traffic for anonymous page views.</p>
            </div>

            {error ? <AdminStatusPanel tone="error" text={error} /> : null}
            {loading ? <p className="subtle-text" style={{ marginTop: 18 }}>Loading Captain conversion...</p> : null}
            {!loading && funnel ? (
              <>
                <div className={styles.pilotStages}>
                  {captainStages.map((stage, index) => (
                    <Link key={stage.label} href={stage.href} className={styles.pilotStage}>
                      <span className={styles.pilotStageNumber}>{index + 1}</span>
                      <span className={styles.pilotStageLabel}>{stage.label}</span>
                      <strong>{stage.value.toLocaleString()}</strong>
                      <span className={styles.pilotStageDetail}>{stage.detail}</span>
                      <span className={styles.pilotRate}>{index === 0 ? `Last ${period} days` : `${formatPercent(stage.rate)} from prior step`}</span>
                    </Link>
                  ))}
                </div>
                <div className={styles.pilotSignals} aria-label="Captain Pilot supporting signals">
                  <div className={styles.pilotSignal}><span>Tour starts</span><strong>{funnel.captainPilot.tourStarts.toLocaleString()}</strong></div>
                  <div className={styles.pilotSignal}><span>New account requests</span><strong>{funnel.captainPilot.signupRequests.toLocaleString()}</strong></div>
                  <div className={styles.pilotSignal}><span>Billing starts</span><strong>{funnel.captainPilot.checkoutStarts.toLocaleString()}</strong></div>
                  <div className={styles.pilotSignal}><span>Billing errors</span><strong>{funnel.captainPilot.checkoutFailures.toLocaleString()}</strong></div>
                </div>
                <div className={styles.sourceSection}>
                  <div className={styles.sourceHeader}>
                    <div>
                      <div className="section-kicker">Outreach channels</div>
                      <h3>What brings captains in</h3>
                    </div>
                    <span className="badge badge-blue">First known source</span>
                  </div>
                  <div className={styles.sourceTable} role="table" aria-label="Captain Pilot results by outreach channel">
                    <div className={styles.sourceTableHead} role="row">
                      <span role="columnheader">Source</span>
                      <span role="columnheader">Viewed</span>
                      <span role="columnheader">Joined</span>
                      <span role="columnheader">Claimed</span>
                      <span role="columnheader">Active</span>
                      <span role="columnheader">Billing</span>
                    </div>
                    {funnel.captainPilotSources.map((source) => (
                      <div className={styles.sourceRow} role="row" key={source.source}>
                        <strong role="cell">{source.label}</strong>
                        <span role="cell" data-label="Viewed">{source.offerViews}</span>
                        <span role="cell" data-label="Joined">{source.signupRequests}</span>
                        <span role="cell" data-label="Claimed">{source.claims}</span>
                        <span role="cell" data-label="Active">{source.activations}</span>
                        <span role="cell" data-label="Billing">{source.billingConnected}</span>
                      </div>
                    ))}
                  </div>
                  <p className={styles.sourceNote}>Use <code>?src=text</code>, <code>?src=email</code>, or <code>?src=referral</code> when sharing the Captain Pilot link. The flyer QR is tracked automatically.</p>
                  <div className={styles.sourceActions} aria-label="Copy tracked Captain Pilot links">
                    {funnel.captainPilotSources.filter((source) => source.source !== 'direct' && source.source !== 'flyer').map((source) => (
                      <button
                        type="button"
                        className="button-ghost"
                        key={source.source}
                        onClick={() => void copyCaptainPilotSourceLink(source, setSourceNotice)}
                      >
                        Copy {source.label.toLowerCase()} link
                      </button>
                    ))}
                  </div>
                  {sourceNotice ? <p className={styles.sourceSuccess} role="status">{sourceNotice}</p> : null}
                </div>
                <div className={styles.pilotInsight} style={adminSubPanelStyle}>
                  <strong>Largest opportunity</strong>
                  <p className="subtle-text" style={{ margin: 0 }}>{captainPilotInsight(funnel.captainPilot)}</p>
                  <AdminActionRow>
                    <Link href="/captain-pilot" className="button-secondary">Open Captain offer</Link>
                    <Link href="/admin/product-events?search=captain_pilot" className="button-ghost">Review Captain events</Link>
                  </AdminActionRow>
                </div>
                <div className={styles.activationHeader}>
                  <div>
                    <div className="section-kicker">First value</div>
                    <h3>What happens after activation</h3>
                  </div>
                  <span className="badge badge-green">Real saved work</span>
                </div>
                <div className={styles.activationStages} aria-label="Captain Pilot activation milestones">
                  <ActivationStage
                    number="1"
                    label="Activated"
                    value={funnel.captainPilotActivation.activations}
                    detail="Captain Pilot access is active."
                    rate={null}
                  />
                  <ActivationStage
                    number="2"
                    label="Team connected"
                    value={funnel.captainPilotActivation.teamConnected}
                    detail="An active team link is saved."
                    rate={ratio(funnel.captainPilotActivation.teamConnected, funnel.captainPilotActivation.activations)}
                  />
                  <ActivationStage
                    number="3"
                    label="First week started"
                    value={funnel.captainPilotActivation.firstValue}
                    detail="A lineup or availability request exists."
                    rate={ratio(funnel.captainPilotActivation.firstValue, funnel.captainPilotActivation.activations)}
                  />
                  <ActivationStage
                    number="4"
                    label="First plan shared"
                    value={funnel.captainPilotActivation.lineupShared}
                    detail="A saved lineup reached Team Chat."
                    rate={ratio(funnel.captainPilotActivation.lineupShared, funnel.captainPilotActivation.activations)}
                  />
                </div>
                <div className={styles.activationSignals}>
                  <span><strong>{funnel.captainPilotActivation.lineupStarted}</strong> built a lineup</span>
                  <span><strong>{funnel.captainPilotActivation.availabilitySent}</strong> sent availability</span>
                  <span><strong>{funnel.captainPilotActivation.lineupShared}</strong> shared the plan</span>
                </div>
                <div className={styles.activationInsight}>
                  <strong>Onboarding read</strong>
                  <span>{captainActivationInsight(funnel.captainPilotActivation)}</span>
                </div>
                <div className={styles.followUpHeader}>
                  <div>
                    <div className="section-kicker">Captain follow-up</div>
                    <h3>Who may need help</h3>
                  </div>
                  <span className="badge badge-blue">{funnel.captainPilotFollowUpCount} waiting</span>
                </div>
                {followUpNotice ? <AdminStatusPanel tone="success" text={followUpNotice} /> : null}
                {funnel.captainPilotFollowUps.length ? (
                  <div className={styles.followUpList}>
                    {funnel.captainPilotFollowUps.map((lead) => (
                      <article key={lead.profileId} className={styles.followUpCard}>
                        <div className={styles.followUpLead}>
                          <div>
                            <strong>{lead.captainName}</strong>
                            <span>{lead.teamName}</span>
                          </div>
                          <span className={lead.urgent ? 'badge badge-slate' : 'badge badge-blue'}>
                            {lead.stage === 'billing'
                              ? lead.daysRemaining != null && lead.daysRemaining > 0
                                ? `${lead.daysRemaining}d left`
                                : 'Billing due'
                              : lead.urgent
                                ? 'Checkout issue'
                                : lead.stage === 'team_connection'
                                ? 'Needs team'
                                : lead.stage === 'first_week'
                                  ? 'Needs first week'
                                  : lead.stage === 'first_share'
                                    ? 'Needs to share'
                                  : `${lead.waitingDays}d waiting`}
                          </span>
                        </div>
                        <div className={styles.followUpReason}>
                          <strong>{lead.reason}</strong>
                          <span>{lead.nextStep}</span>
                        </div>
                        <div className={styles.followUpActions}>
                          <button type="button" className="button-secondary" onClick={() => void copyCaptainFollowUp(lead, setFollowUpNotice)}>
                            Copy reminder
                          </button>
                          <Link href={`/admin/access?search=${encodeURIComponent(lead.captainEmail || lead.profileId)}`} className="button-ghost">
                            Open account
                          </Link>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <div className={styles.followUpClear}>
                    <strong>No Captain follow-ups due.</strong>
                    <span>New activations get a day to begin. Billing reminders appear near the end of free access.</span>
                  </div>
                )}
                {funnel.captainPilotFollowUpCount > funnel.captainPilotFollowUps.length ? (
                  <div className={styles.followUpMore}>
                    <span>Showing the {funnel.captainPilotFollowUps.length} most urgent captains.</span>
                    <Link href="/admin/upgrade-requests?plan=captain" className="button-ghost">Open all Captain requests</Link>
                  </div>
                ) : null}
              </>
            ) : null}
          </AdminReviewPanel>

          <AdminReviewPanel style={{ marginTop: 18 }} ariaLabel="Growth conversion funnel">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
              <div>
                <div className="section-kicker">Conversion health</div>
                <h2 className="section-title" style={{ marginTop: 6 }}>Where people continue—or stop</h2>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {PERIODS.map((option) => (
                  <button
                    type="button"
                    key={option.value}
                    className={period === option.value ? 'button-secondary' : 'button-ghost'}
                    onClick={() => setPeriod(option.value)}
                    aria-pressed={period === option.value}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {error ? <AdminStatusPanel tone="error" text={error} /> : null}
            {loading ? <p className="subtle-text" style={{ marginTop: 18 }}>Loading growth signals...</p> : null}
            {!loading && !funnel ? <div style={{ marginTop: 18 }}><AdminEmptyState text="No growth signals are available yet." /></div> : null}
            {!loading && funnel ? (
              <>
                <div style={{ ...adminFactGridStyle, marginTop: 18 }}>
                  <Link href="/admin/product-events?filter=public_site" style={{ ...adminSubPanelStyle, textDecoration: 'none' }}>
                    <span className="metric-label">Attributable product actions</span>
                    <strong style={{ fontSize: '2rem', lineHeight: 1 }}>{funnel.publicActions.toLocaleString()}</strong>
                    <span className="subtle-text">Signed-in people who took an action in TiQ during this period.</span>
                    <span className="badge badge-blue">Engagement signal</span>
                  </Link>
                  {stages.map((stage, index) => (
                    <Link key={stage.label} href={stage.href} style={{ ...adminSubPanelStyle, textDecoration: 'none' }}>
                      <span className="metric-label">{index + 1}. {stage.label}</span>
                      <strong style={{ fontSize: '2rem', lineHeight: 1 }}>{stage.value.toLocaleString()}</strong>
                      <span className="subtle-text">{stage.detail}</span>
                      <span className={index === 0 ? 'badge badge-blue' : stage.rate && stage.rate >= 50 ? 'badge badge-green' : 'badge badge-slate'}>
                        {index === 0 ? `Last ${period} days` : `${formatPercent(stage.rate)} from prior step`}
                      </span>
                    </Link>
                  ))}
                </div>

                <div style={{ ...adminSubPanelStyle, marginTop: 16 }}>
                  <strong>What to do next</strong>
                  <p className="subtle-text" style={{ margin: 0 }}>{funnelInsight(funnel)}</p>
                  {funnel.checkoutFailures > 0 ? (
                    <p className="subtle-text" style={{ margin: 0 }}>
                      {funnel.checkoutFailures.toLocaleString()} {funnel.checkoutFailures === 1 ? 'member hit' : 'members hit'} a checkout error in this period.
                    </p>
                  ) : null}
                  <AdminActionRow>
                    <Link href={funnel.checkoutStarts > funnel.paidActivations ? '/admin/promotions' : '/admin/product-events?filter=upgrade'} className="button-secondary">
                      {funnel.checkoutStarts > funnel.paidActivations ? 'Review the offer' : 'Review checkout activity'}
                    </Link>
                  </AdminActionRow>
                </div>
              </>
            ) : null}
          </AdminReviewPanel>
        </AdminReviewFrame>
      </AdminGate>
    </SiteShell>
  )
}

function ratio(numerator: number, denominator: number) {
  if (!denominator) return null
  return Math.max(0, Math.min(100, Math.round((numerator / denominator) * 100)))
}

function formatPercent(value: number | null) {
  return value == null ? 'No prior-step volume' : `${value}%`
}

function funnelInsight(funnel: Funnel) {
  if (funnel.checkoutFailures > 0 || funnel.checkoutClicks > funnel.checkoutStarts) {
    return 'People are choosing Checkout, but Stripe is not opening for everyone. Review checkout errors before changing the offer.'
  }
  if (funnel.checkoutStarts > funnel.paidActivations) {
    return 'People are reaching Checkout but not activating. Review the price, promotion, and checkout experience first.'
  }
  if (funnel.signupRequests > funnel.checkoutClicks) {
    return 'New accounts are arriving, but fewer are choosing Checkout. Make the role-based value and trial terms clearer before asking for payment details.'
  }
  if (funnel.publicActions > funnel.signupRequests) {
    return 'People are exploring TiQ without requesting an account. Tighten the signup invitation around the action they just took.'
  }
  return 'The funnel is still gathering signals. Check back after more signups and checkout activity arrive.'
}

async function copyCaptainPilotSourceLink(
  source: CaptainPilotSourceBreakdown,
  setNotice: (message: string) => void,
) {
  const url = `https://www.tenaceiq.com/captain-pilot?src=${source.source}`
  try {
    await navigator.clipboard.writeText(url)
    setNotice(`${source.label} link copied.`)
  } catch {
    setNotice(`Copy this link: ${url}`)
  }
}

function captainPilotInsight(funnel: CaptainPilotFunnel) {
  if (funnel.checkoutFailures > 0) {
    return `${funnel.checkoutFailures} ${funnel.checkoutFailures === 1 ? 'captain hit' : 'captains hit'} a checkout error. Fix that path before changing the offer.`
  }

  const transitions = [
    { from: funnel.offerViews, to: funnel.offerActions, message: 'Captains are opening the offer without taking the next action. Tighten the value preview and primary invitation.' },
    { from: funnel.offerActions, to: funnel.claims, message: 'Captains are showing intent but not claiming the pilot. Simplify the team form or make the $0 terms more prominent.' },
    { from: funnel.claims, to: funnel.activations, message: 'Pilot forms are being completed without access activating. Review the card-free entitlement handoff.' },
  ].filter((transition) => transition.from > 0)

  if (!transitions.length) return 'The Captain Pilot funnel is ready. It will identify the largest drop-off as captains begin using the offer.'

  const largest = transitions.reduce((current, transition) => {
    const currentDrop = 1 - current.to / current.from
    const transitionDrop = 1 - transition.to / transition.from
    return transitionDrop > currentDrop ? transition : current
  })

  if (largest.to >= largest.from) {
    if (funnel.activations > 0 && funnel.billingConnected < funnel.activations) {
      return 'Card-free activation is working. Watch billing additions as pilots approach the end of their three free months.'
    }
    return 'No drop-off is visible yet. Keep collecting Captain Pilot traffic before changing the offer.'
  }
  return largest.message
}

function ActivationStage({
  number,
  label,
  value,
  detail,
  rate,
}: {
  number: string
  label: string
  value: number
  detail: string
  rate: number | null
}) {
  return (
    <div className={styles.activationStage}>
      <span className={styles.pilotStageNumber}>{number}</span>
      <div>
        <strong>{label}</strong>
        <span>{detail}</span>
      </div>
      <b>{value.toLocaleString()}</b>
      <small>{rate == null ? 'Starting cohort' : `${formatPercent(rate)} of activated`}</small>
    </div>
  )
}

function captainActivationInsight(activation: CaptainPilotActivation) {
  if (!activation.activations) return 'Activation milestones will appear after the first Captain Pilot becomes active.'
  if (activation.teamConnected < activation.activations) {
    const missing = activation.activations - activation.teamConnected
    return `${missing} active ${missing === 1 ? 'captain has' : 'captains have'} not connected a team yet. Improve that handoff first.`
  }
  if (activation.firstValue < activation.activations) {
    const missing = activation.activations - activation.firstValue
    return `${missing} active ${missing === 1 ? 'captain has' : 'captains have'} a team but no saved weekly action. Guide them directly to availability or lineup building.`
  }
  if (activation.lineupStarted > activation.lineupShared) {
    const missing = activation.lineupStarted - activation.lineupShared
    return `${missing} ${missing === 1 ? 'captain has' : 'captains have'} built a lineup but not shared it with the team. Tighten the final-send handoff.`
  }
  if (activation.lineupShared > 0) {
    return `Every active Captain Pilot has started a real match week, and ${activation.lineupShared} ${activation.lineupShared === 1 ? 'has' : 'have'} shared a lineup.`
  }
  return 'Every active Captain Pilot has reached a real match-week action.'
}

async function copyCaptainFollowUp(
  lead: CaptainPilotFollowUp,
  setNotice: (message: string) => void,
) {
  const firstName = lead.captainName === 'Captain' ? 'there' : lead.captainName.split(' ')[0]
  const message = lead.stage === 'billing'
    ? `Hi ${firstName} — your free TenAceIQ Captain Pilot for ${lead.teamName} ${lead.daysRemaining != null && lead.daysRemaining > 0 ? `ends in ${lead.daysRemaining} ${lead.daysRemaining === 1 ? 'day' : 'days'}` : 'has ended'}. Add billing only if you want Captain access to continue: https://tenaceiq.com/captain-pilot. Reply if you want help.`
    : lead.stage === 'team_connection'
      ? `Hi ${firstName} — your TenAceIQ Captain Pilot is active. Connect your captain team so TiQ can load your roster, schedule, and weekly tools: https://tenaceiq.com/compete/teams#captain-setup. Reply if you want help.`
      : lead.stage === 'first_week'
        ? `Hi ${firstName} — your team is connected in TenAceIQ. Start your first match week with availability or a lineup here: https://tenaceiq.com/captain. Reply if you want help.`
        : lead.stage === 'first_share'
          ? `Hi ${firstName} — your first TenAceIQ lineup for ${lead.teamName} is saved. Finish by sharing the plan with your team: https://tenaceiq.com/compete/teams?source=captain-pilot#captain-setup. Reply if you want help.`
        : `Hi ${firstName} — I saw you started the TenAceIQ Captain Pilot for ${lead.teamName}. ${lead.urgent ? 'It looks like checkout may have hit an issue.' : 'Your access is not active yet.'} Return to https://tenaceiq.com/captain-pilot to finish, or reply and I’ll help.`

  try {
    await navigator.clipboard.writeText(message)
    setNotice(`Follow-up copied for ${lead.captainName}.`)
  } catch {
    setNotice('Could not copy the reminder. Open the account and follow up from there.')
  }
}
