'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
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
import { PRICING_PLANS, type BillablePricingPlanId } from '@/lib/pricing-plans'
import { supabase } from '@/lib/supabase'

type PromotionDuration = 'once' | 'repeating' | 'forever'

type Promotion = {
  id: string
  code: string
  active: boolean
  createdAt: string
  expiresAt: string | null
  maxRedemptions: number | null
  timesRedeemed: number
  percentOff: number | null
  duration: PromotionDuration | null
  durationMonths: number | null
  planId: string
  couponId: string
  firstTimeOnly: boolean
}

type PromotionForm = {
  code: string
  planId: BillablePricingPlanId
  percentOff: string
  duration: PromotionDuration
  durationMonths: string
  maxRedemptions: string
  redeemBy: string
  firstTimeOnly: boolean
}

const PAYWALL_PLANS = PRICING_PLANS.filter((plan) => plan.billing.checkoutMode !== 'none')

const INITIAL_FORM: PromotionForm = {
  code: '',
  planId: 'captain',
  percentOff: '50',
  duration: 'once',
  durationMonths: '3',
  maxRedemptions: '',
  redeemBy: '',
  firstTimeOnly: false,
}

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [form, setForm] = useState<PromotionForm>(INITIAL_FORM)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const loadPromotions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const data = await callPromotionsApi('GET')
      setPromotions(data.promotions ?? [])
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Stripe promotions could not be loaded.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPromotions()
  }, [loadPromotions])

  const activeCount = useMemo(() => promotions.filter((promotion) => promotion.active).length, [promotions])
  const redemptionCount = useMemo(() => promotions.reduce((total, promotion) => total + promotion.timesRedeemed, 0), [promotions])

  async function createPromotion() {
    setSaving(true)
    setMessage('')
    setError('')
    try {
      const data = await callPromotionsApi('POST', { action: 'create', ...form })
      if (data.promotion) {
        setPromotions((current) => [data.promotion as Promotion, ...current])
      }
      setMessage(`${form.code.trim().toUpperCase()} is live in Stripe and ready at checkout.`)
      setForm((current) => ({ ...INITIAL_FORM, planId: current.planId }))
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Stripe could not create that promotion.')
    } finally {
      setSaving(false)
    }
  }

  async function deactivatePromotion(promotion: Promotion) {
    setDeactivatingId(promotion.id)
    setMessage('')
    setError('')
    try {
      const data = await callPromotionsApi('POST', { action: 'deactivate', promotionCodeId: promotion.id })
      setPromotions((current) => current.map((item) => item.id === promotion.id
        ? { ...item, ...(data.promotion as Partial<Promotion>), active: false }
        : item,
      ))
      setMessage(`${promotion.code} is inactive. Existing discounted subscriptions keep their Stripe terms.`)
    } catch (deactivateError) {
      setError(deactivateError instanceof Error ? deactivateError.message : 'Stripe could not deactivate that promotion.')
    } finally {
      setDeactivatingId(null)
    }
  }

  return (
    <SiteShell active="/admin">
      <AdminGate>
        <AdminReviewFrame>
          <AdminReviewHero
            kicker="Billing promotions"
            title="Run a real offer, with Stripe in control"
            actions={
              <>
                <Link href="/admin/access" className="button-secondary">Manual access</Link>
                <Link href="/admin/product-events?filter=upgrade" className="button-secondary">Checkout activity</Link>
              </>
            }
          >
            Create a unique checkout code for one plan. Stripe applies the discount, limits redemptions, and manages the billing cycle.
          </AdminReviewHero>

          <AdminStatusPanel
            tone="success"
            text="A promotion code only affects new Checkout purchases. It does not alter manual TiQ access, existing subscriptions, invoices, or Stripe billing settings."
          />

          {message ? <AdminStatusPanel tone="success" text={message} /> : null}
          {error ? <AdminStatusPanel tone="error" text={error} /> : null}

          <AdminReviewPanel style={{ marginTop: 18 }} ariaLabel="Create Stripe promotion">
            <div className="section-kicker">New checkout offer</div>
            <h2 className="section-title" style={{ marginTop: 6 }}>Create a private promotion code</h2>
            <p className="subtle-text" style={{ marginTop: 8, maxWidth: 820 }}>
              The code appears in Stripe Checkout. It is tied to the selected TiQ plan, so it cannot discount a different tier.
            </p>

            <div style={{ ...adminFactGridStyle, marginTop: 18 }}>
              <Field label="Code" htmlFor="promotion-code">
                <input
                  id="promotion-code"
                  className="input"
                  value={form.code}
                  onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))}
                  placeholder="FAMILY50"
                  maxLength={40}
                />
              </Field>
              <Field label="Plan" htmlFor="promotion-plan">
                <select
                  id="promotion-plan"
                  className="select"
                  value={form.planId}
                  onChange={(event) => setForm((current) => ({ ...current, planId: event.target.value as BillablePricingPlanId }))}
                >
                  {PAYWALL_PLANS.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} · {plan.priceLabel}</option>)}
                </select>
              </Field>
              <Field label="Discount" htmlFor="promotion-percent">
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    id="promotion-percent"
                    className="input"
                    type="number"
                    min="1"
                    max="100"
                    value={form.percentOff}
                    onChange={(event) => setForm((current) => ({ ...current, percentOff: event.target.value }))}
                  />
                  <strong>% off</strong>
                </div>
              </Field>
              <Field label="Discount duration" htmlFor="promotion-duration">
                <select
                  id="promotion-duration"
                  className="select"
                  value={form.duration}
                  onChange={(event) => setForm((current) => ({ ...current, duration: event.target.value as PromotionDuration }))}
                >
                  <option value="once">First payment only</option>
                  <option value="repeating">A fixed number of months</option>
                  <option value="forever">Every billing cycle</option>
                </select>
              </Field>
              {form.duration === 'repeating' ? (
                <Field label="Months discounted" htmlFor="promotion-duration-months">
                  <input
                    id="promotion-duration-months"
                    className="input"
                    type="number"
                    min="1"
                    max="24"
                    value={form.durationMonths}
                    onChange={(event) => setForm((current) => ({ ...current, durationMonths: event.target.value }))}
                  />
                </Field>
              ) : null}
              <Field label="Redemption limit (optional)" htmlFor="promotion-limit">
                <input
                  id="promotion-limit"
                  className="input"
                  type="number"
                  min="1"
                  max="10000"
                  value={form.maxRedemptions}
                  onChange={(event) => setForm((current) => ({ ...current, maxRedemptions: event.target.value }))}
                  placeholder="Unlimited"
                />
              </Field>
              <Field label="Checkout code ends (optional)" htmlFor="promotion-redeem-by">
                <input
                  id="promotion-redeem-by"
                  className="input"
                  type="date"
                  value={form.redeemBy}
                  onChange={(event) => setForm((current) => ({ ...current, redeemBy: event.target.value }))}
                />
              </Field>
              <label style={{ ...adminSubPanelStyle, alignContent: 'center', minHeight: 74 }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800 }}>
                  <input
                    type="checkbox"
                    checked={form.firstTimeOnly}
                    onChange={(event) => setForm((current) => ({ ...current, firstTimeOnly: event.target.checked }))}
                  />
                  First Stripe purchase only
                </span>
                <span className="subtle-text">Keep the offer for people who have not paid through Stripe before.</span>
              </label>
            </div>

            <AdminActionRow>
              <button type="button" className="button-primary" onClick={() => void createPromotion()} disabled={saving}>
                {saving ? 'Creating in Stripe...' : 'Create promotion code'}
              </button>
            </AdminActionRow>
          </AdminReviewPanel>

          <AdminReviewPanel style={{ marginTop: 18 }} ariaLabel="Stripe promotion tracking">
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', alignItems: 'end' }}>
              <div>
                <div className="section-kicker">Redemption tracking</div>
                <h2 className="section-title" style={{ marginTop: 6 }}>Live Stripe promotion codes</h2>
              </div>
              <button type="button" className="button-ghost" onClick={() => void loadPromotions()} disabled={loading}>
                {loading ? 'Refreshing...' : 'Refresh codes'}
              </button>
            </div>
            <div style={{ ...adminFactGridStyle, marginTop: 16 }}>
              <Fact label="Active codes" value={String(activeCount)} />
              <Fact label="Redemptions" value={String(redemptionCount)} />
              <Fact label="Stripe source" value="Live" />
            </div>

            {loading ? <p className="subtle-text" style={{ marginTop: 16 }}>Loading Stripe promotion codes...</p> : null}
            {!loading && promotions.length === 0 ? (
              <div style={{ marginTop: 16 }}>
                <AdminEmptyState text="No TiQ promotion codes yet.">
                  Create one above. It will be available as a code field in Stripe Checkout for its selected plan.
                </AdminEmptyState>
              </div>
            ) : null}
            {!loading && promotions.length > 0 ? (
              <div style={{ display: 'grid', gap: 10, marginTop: 16 }}>
                {promotions.map((promotion) => (
                  <div key={promotion.id} className="admin-promotion-code-row" style={{ ...adminSubPanelStyle, gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'center' }}>
                    <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '1.1rem', letterSpacing: '0.04em' }}>{promotion.code}</strong>
                        <span className={promotion.active ? 'badge badge-green' : 'badge badge-slate'}>{promotion.active ? 'Active' : 'Inactive'}</span>
                        <span className="badge badge-blue">{formatPlan(promotion.planId)}</span>
                      </div>
                      <div className="subtle-text">
                        {formatPromotionOffer(promotion)} · {promotion.timesRedeemed}{promotion.maxRedemptions ? ` / ${promotion.maxRedemptions}` : ''} redeemed
                        {promotion.expiresAt ? ` · Code ends ${formatDate(promotion.expiresAt)}` : ''}
                        {promotion.firstTimeOnly ? ' · First purchase only' : ''}
                      </div>
                    </div>
                    {promotion.active ? (
                      <button
                        type="button"
                        className="button-ghost"
                        onClick={() => void deactivatePromotion(promotion)}
                        disabled={deactivatingId === promotion.id}
                      >
                        {deactivatingId === promotion.id ? 'Ending...' : 'End code'}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : null}
          </AdminReviewPanel>
        </AdminReviewFrame>
      </AdminGate>
    </SiteShell>
  )
}

async function callPromotionsApi(method: 'GET' | 'POST', payload?: Record<string, unknown>) {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  if (!token) throw new Error('Sign in as an admin to manage promotions.')

  const response = await fetch('/api/admin/stripe-promotions', {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
    body: method === 'POST' ? JSON.stringify(payload ?? {}) : undefined,
  })
  const body = await response.json().catch(() => ({})) as { ok?: boolean; message?: string; promotions?: Promotion[]; promotion?: Promotion }
  if (!response.ok || !body.ok) throw new Error(body.message || 'Stripe promotion request failed.')
  return body
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gap: 6, minWidth: 0 }}>
      <label htmlFor={htmlFor} className="label">{label}</label>
      {children}
    </div>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div style={adminSubPanelStyle}>
      <span className="metric-label">{label}</span>
      <strong style={{ fontSize: '1.35rem' }}>{value}</strong>
    </div>
  )
}

function formatPlan(planId: string) {
  return PAYWALL_PLANS.find((plan) => plan.id === planId)?.name ?? planId
}

function formatPromotionOffer(promotion: Promotion) {
  const discount = promotion.percentOff ? `${promotion.percentOff}% off` : 'Discount'
  if (promotion.duration === 'once') return `${discount} first payment`
  if (promotion.duration === 'repeating') return `${discount} for ${promotion.durationMonths ?? 0} months`
  if (promotion.duration === 'forever') return `${discount} every billing cycle`
  return discount
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString()
}
