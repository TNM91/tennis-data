import { createClient } from '@supabase/supabase-js'
import { isSafeLocalNextHref } from '@/lib/plan-intent'
import { type MembershipTierId } from '@/lib/product-story'
import {
  buildSignupConfirmationEmail,
  isSignupEmailIntent,
  type SignupEmailIntent,
} from '@/lib/signup-confirmation-email'
import { supabaseUrl } from '@/lib/supabase'

export const runtime = 'nodejs'

const MAX_REQUESTS_PER_IP = 5
const IP_WINDOW_MS = 15 * 60 * 1000
const EMAIL_WINDOW_MS = 60 * 1000
const requestsByIp = new Map<string, number[]>()
const lastRequestByEmail = new Map<string, number>()

type SignupBody = {
  firstName?: unknown
  email?: unknown
  password?: unknown
  planId?: unknown
  nextHref?: unknown
  captainPilot?: unknown
}

export async function POST(request: Request) {
  if (!isTrustedOrigin(request)) return Response.json({ ok: false, message: 'This signup request is not allowed.' }, { status: 403 })

  let body: SignupBody
  try {
    body = (await request.json()) as SignupBody
  } catch {
    return Response.json({ ok: false, message: 'Enter your signup details and try again.' }, { status: 400 })
  }

  const email = cleanEmail(body.email)
  const firstName = cleanFirstName(body.firstName)
  const password = typeof body.password === 'string' ? body.password : ''
  const planId = isMembershipTierId(body.planId) ? body.planId : 'free'
  const intent: SignupEmailIntent = body.captainPilot === true && planId === 'captain' ? 'captain-pilot' : planId
  const fallbackNextHref = getDefaultNextHref(planId, intent)
  const nextHref = isSafeLocalNextHref(typeof body.nextHref === 'string' ? body.nextHref : null, fallbackNextHref)

  if (!email) return Response.json({ ok: false, message: 'Enter a valid email address.' }, { status: 400 })
  if (password.length < 8) return Response.json({ ok: false, message: 'Use at least 8 characters for your password.' }, { status: 400 })

  const rateError = checkRateLimit(request, email)
  if (rateError) return Response.json({ ok: false, message: rateError }, { status: 429 })

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  const resendApiKey = process.env.RESEND_API_KEY?.trim()
  if (!serviceKey || !resendApiKey) {
    console.error('Signup confirmation email is not configured.', {
      hasServiceKey: Boolean(serviceKey),
      hasResendKey: Boolean(resendApiKey),
    })
    return Response.json({ ok: false, message: 'Signup is being prepared. Please try again in a moment.' }, { status: 503 })
  }

  const confirmationRedirect = buildConfirmationRedirect(planId, nextHref, email)
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })
  const { data, error } = await supabase.auth.admin.generateLink({
    type: 'signup',
    email,
    password,
    options: {
      redirectTo: confirmationRedirect,
      data: { signup_intent: intent, selected_plan: planId, ...(firstName ? { first_name: firstName } : {}) },
    },
  })

  if (error || !data?.properties.action_link) {
    console.error('Signup link generation failed.', { code: error?.code, status: error?.status })
    return Response.json(
      { ok: false, message: 'That email may already have an account. Try signing in or use password recovery.' },
      { status: 400 },
    )
  }

  const emailHtml = buildSignupConfirmationEmail({ intent, firstName, confirmationUrl: data.properties.action_link })
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `signup-confirmation-${data.user.id}-${Math.floor(Date.now() / EMAIL_WINDOW_MS)}`,
    },
    body: JSON.stringify({
      from: `TenAceiQ <welcome@${process.env.RESEND_EMAIL_DOMAIN?.trim() || 'tenaceiq.com'}>`,
      to: [email],
      subject: subjectForIntent(intent),
      html: emailHtml,
    }),
  })

  if (!response.ok) {
    console.error('Signup confirmation email failed.', { status: response.status })
    return Response.json({ ok: false, message: 'We could not send your confirmation email. Please try again in a minute.' }, { status: 502 })
  }

  const { error: eventError } = await supabase
    .from('product_usage_events')
    .insert({
      user_id: data.user.id,
      event_name: 'signup_confirmation_sent',
      surface: 'public_site',
      plan_id: planId === 'free' ? null : planId,
      metadata: { signup_intent: intent },
    })
  if (eventError) {
    console.warn('Signup funnel event was not recorded.', { code: eventError.code, message: eventError.message })
  }

  return Response.json({ ok: true })
}

function isMembershipTierId(value: unknown): value is MembershipTierId {
  return isSignupEmailIntent(value) && value !== 'captain-pilot'
}

function getDefaultNextHref(planId: MembershipTierId, intent: SignupEmailIntent) {
  if (intent === 'captain-pilot') return '/captain-pilot'
  if (planId === 'free') return '/explore'
  if (planId === 'player_plus') return '/upgrade?plan=player_plus&next=%2Fprofile'
  if (planId === 'coach') return '/upgrade?plan=coach&next=%2Fcoach'
  if (planId === 'captain') return '/upgrade?plan=captain&next=%2Fcaptain'
  if (planId === 'league') return '/upgrade?plan=league&next=%2Fleague-coordinator'
  return '/upgrade?plan=full_court&next=%2Fleague-coordinator'
}

function buildConfirmationRedirect(planId: MembershipTierId, nextHref: string, email: string) {
  const redirect = new URL('https://tenaceiq.com/welcome')
  redirect.searchParams.set('plan', planId)
  redirect.searchParams.set('next', nextHref)
  redirect.searchParams.set('email', email)
  return redirect.toString()
}

function subjectForIntent(intent: SignupEmailIntent) {
  if (intent === 'captain-pilot') return 'Welcome to TenAceiQ — start your Captain Pilot'
  if (intent === 'free') return 'Welcome to TenAceiQ — confirm your free account'
  return `Welcome to TenAceiQ — continue to ${intent === 'player_plus' ? 'Player' : intent === 'full_court' ? 'Full-Court' : intent[0].toUpperCase() + intent.slice(1)}`
}

function cleanEmail(value: unknown) {
  if (typeof value !== 'string') return ''
  const email = value.trim().toLowerCase()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 320 ? email : ''
}

function cleanFirstName(value: unknown) {
  if (typeof value !== 'string') return ''
  return value.replace(/\s+/g, ' ').trim().slice(0, 60)
}

function isTrustedOrigin(request: Request) {
  const origin = request.headers.get('origin')
  if (!origin) return process.env.NODE_ENV !== 'production'
  return origin === 'https://tenaceiq.com' || origin === 'https://www.tenaceiq.com' || origin === 'http://localhost:3000'
}

function checkRateLimit(request: Request, email: string) {
  const now = Date.now()
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
  const recentRequests = (requestsByIp.get(ip) ?? []).filter((timestamp) => now - timestamp < IP_WINDOW_MS)
  if (recentRequests.length >= MAX_REQUESTS_PER_IP) return 'Too many signup attempts. Please wait a few minutes and try again.'

  const lastRequest = lastRequestByEmail.get(email)
  if (lastRequest && now - lastRequest < EMAIL_WINDOW_MS) return 'Please wait a minute before requesting another confirmation email.'

  recentRequests.push(now)
  requestsByIp.set(ip, recentRequests)
  lastRequestByEmail.set(email, now)
  return ''
}
