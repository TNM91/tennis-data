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
import { PAID_CHECKOUT_ENABLED } from '@/lib/paid-checkout'
import { supabase } from '@/lib/supabase'

type Period = 7 | 30 | 90
type Funnel = {
  publicActions: number
  signupRequests: number
  firstActions: number
  checkoutStarts: number
  paidActivations: number
}
type FollowJourney = {
  intentClicks: number
  playerRequests: number
  playerCheckoutStarts: number
  completedFollows: number
}

const PERIODS: Array<{ value: Period; label: string }> = [
  { value: 7, label: '7 days' },
  { value: 30, label: '30 days' },
  { value: 90, label: '90 days' },
]

export default function AdminGrowthPage() {
  const [period, setPeriod] = useState<Period>(30)
  const [funnel, setFunnel] = useState<Funnel | null>(null)
  const [followJourney, setFollowJourney] = useState<FollowJourney | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

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
      const body = await response.json().catch(() => null) as { ok?: boolean; message?: string; funnel?: Funnel; followJourney?: FollowJourney } | null
      if (!response.ok || !body?.ok || !body.funnel) throw new Error(body?.message || 'Growth reporting could not be loaded.')
      setFunnel(body.funnel)
      setFollowJourney(body.followJourney ?? null)
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Growth reporting could not be loaded.')
      setFunnel(null)
      setFollowJourney(null)
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
      label: 'Checkout starts',
      value: funnel.checkoutStarts,
      detail: 'Members in this signup cohort who later opened Stripe Checkout.',
      rate: ratio(funnel.checkoutStarts, funnel.signupRequests),
      href: '/admin/product-events?filter=upgrade',
    },
    {
      label: 'Paid activations',
      value: funnel.paidActivations,
      detail: 'Members in this signup cohort whose Checkout later activated access.',
      rate: ratio(funnel.paidActivations, funnel.checkoutStarts),
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
            Follow the same members from signup to Checkout and paid activation.
          </AdminReviewHero>

          <AdminStatusPanel
            tone="success"
            text="Visitor traffic belongs in Vercel Web Analytics. Funnel rates here follow members who requested signup in the selected period; recent members have had less time to progress."
          >
            <a href="https://vercel.com/tennis-data/tennis-data/analytics" target="_blank" rel="noreferrer" className="button-ghost">Open site traffic</a>
          </AdminStatusPanel>

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
                  <Link href="/admin/product-events?filter=search" style={{ ...adminSubPanelStyle, textDecoration: 'none' }}>
                    <span className="metric-label">First useful action</span>
                    <strong style={{ fontSize: '2rem', lineHeight: 1 }}>{funnel.firstActions.toLocaleString()}</strong>
                    <span className="subtle-text">Members in this signup cohort who opened a result or took a role-specific action.</span>
                    <span className="badge badge-blue">{formatPercent(ratio(funnel.firstActions, funnel.signupRequests))} of signup requests</span>
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

                {followJourney ? (
                  <section style={{ marginTop: 18 }} aria-label="Follow with Player journey">
                    <h3 style={{ margin: '0 0 8px' }}>Follow with Player</h3>
                    <p className="subtle-text" style={{ margin: '0 0 12px' }}>
                      Members with a Follow upgrade intent recorded in this period. Visitor clicks enter after sign-in in the same tab. Player requests, checkout starts, and completed follows count linked members who took the step within an hour. Each number counts people once.
                    </p>
                    <div style={adminFactGridStyle}>
                      {([
                        { label: 'Follow upgrade intents', value: followJourney.intentClicks, search: 'follow_upgrade_clicked' },
                        { label: 'Player requests after click', value: followJourney.playerRequests, href: '/admin/upgrade-requests?plan=player_plus' },
                        { label: 'Player checkout after click', value: followJourney.playerCheckoutStarts, search: 'upgrade_checkout_started' },
                        { label: 'Follows completed', value: followJourney.completedFollows, search: 'follow_intent_completed' },
                      ] as const).map((item) => (
                        <Link key={item.label} href={'href' in item ? item.href : `/admin/product-events?search=${item.search}`} style={{ ...adminSubPanelStyle, textDecoration: 'none' }}>
                          <span className="metric-label">{item.label}</span>
                          <strong style={{ fontSize: '2rem', lineHeight: 1 }}>{item.value.toLocaleString()}</strong>
                          <span className="subtle-text">{formatPercent(ratio(item.value, followJourney.intentClicks))} of people with follow intent</span>
                        </Link>
                      ))}
                    </div>
                    {followJourney.intentClicks > 0 ? (
                      <p className="subtle-text" style={{ margin: '12px 0 0' }}>
                        {!PAID_CHECKOUT_ENABLED
                          ? followJourney.playerRequests === 0
                            ? 'Follow interest is reaching the upgrade page without a linked Player request. Review the early-access handoff.'
                            : 'Follow interest is becoming Player requests. Review those requests and keep members informed as access opens.'
                          : followJourney.playerCheckoutStarts === 0
                          ? 'Follow interest is reaching the upgrade page without a Player checkout start. Review that handoff and offer.'
                          : followJourney.completedFollows === 0
                            ? 'Player checkout is starting, but the requested follow is not completing yet. Check activation and the return page.'
                            : 'Members are completing the follow they came to make.'}
                      </p>
                    ) : null}
                  </section>
                ) : null}

                <div style={{ ...adminSubPanelStyle, marginTop: 16 }}>
                  <strong>What to do next</strong>
                  <p className="subtle-text" style={{ margin: 0 }}>{funnelInsight(funnel)}</p>
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
  if (funnel.signupRequests > funnel.firstActions && funnel.signupRequests > funnel.checkoutStarts) {
    return 'New members are arriving without opening a useful result or taking a role action. Review search and first-use setup.'
  }
  if (funnel.checkoutStarts > funnel.paidActivations) {
    return 'People are reaching Checkout but not activating. Review the price, promotion, and checkout experience first.'
  }
  if (funnel.signupRequests > funnel.checkoutStarts) {
    return 'New accounts are arriving, but fewer are opening Checkout. Make the role-based upgrade value and next action more obvious.'
  }
  return 'The funnel is still gathering signals. Check back after more signups and checkout activity arrive.'
}
