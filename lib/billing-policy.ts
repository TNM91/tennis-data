import { buildSupportMessageHref } from './message-links'

export const BILLING_SUPPORT_PATH = buildSupportMessageHref({
  category: 'billing',
  subject: 'Billing or refund question',
  body: [
    'I have a billing or refund question.',
    'Plan:',
    'Charge date:',
    'Issue:',
  ].join('\n'),
  entityType: 'billing',
})

export const MONTHLY_SUBSCRIPTION_POLICY = {
  title: 'Player and Captain monthly subscriptions',
  summary:
    'Player and Captain plans renew monthly until canceled. Cancel anytime from Profile billing management or by opening a support thread.',
  bullets: [
    'Cancellation stops future monthly renewals. Access normally continues through the period already paid for.',
    'Monthly subscription charges are generally non-refundable after the billing period begins.',
    'Refunds may be issued for duplicate charges, billing errors, accidental same-day purchases, or other support-approved exceptions.',
    'Past-due, unpaid, disputed, or canceled subscriptions may be downgraded until billing is resolved.',
  ],
} as const

export const LEAGUE_SEASON_POLICY = {
  title: 'TIQ League Coordinator season fees',
  summary:
    'A League Coordinator season fee covers one bounded league season, not an unlimited ongoing league.',
  bullets: [
    'A standard TIQ league season is capped at 12 weeks unless TenAceIQ approves an extension.',
    'A standard season supports up to 120 match events or result entries before a new season should be created.',
    'Season fees are generally refundable only before the league is published, scheduled, or used for result activity.',
    'If a league was created in error, open a support thread quickly so we can review whether a refund, credit, or correction is appropriate.',
  ],
} as const

export const BILLING_POLICY_NOTES = [
  'Stripe securely processes payments. TenAceIQ does not store full card numbers.',
  'Taxes, bank fees, card network rules, and Stripe timing can affect final settlement or refund timing.',
  'This billing policy may be updated as TenAceIQ adds more paid league formats or support workflows.',
] as const

