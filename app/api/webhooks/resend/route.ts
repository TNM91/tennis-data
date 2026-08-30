import { Webhook } from 'svix'

export const runtime = 'nodejs'

type ResendEmailEvent = {
  type?: unknown
  created_at?: unknown
  data?: {
    email_id?: unknown
    to?: unknown
    subject?: unknown
  }
}

const ALERT_EVENT_TYPES = new Set(['email.bounced', 'email.complained', 'email.suppressed'])

export async function POST(request: Request) {
  const signingSecret = process.env.RESEND_WEBHOOK_SECRET?.trim()
  if (!signingSecret) return Response.json({ ok: false, message: 'Webhook is not configured.' }, { status: 503 })

  const payload = await request.text()
  const id = request.headers.get('svix-id')
  const timestamp = request.headers.get('svix-timestamp')
  const signature = request.headers.get('svix-signature')
  if (!id || !timestamp || !signature) return Response.json({ ok: false, message: 'Webhook signature headers are missing.' }, { status: 400 })

  let event: ResendEmailEvent
  try {
    event = new Webhook(signingSecret).verify(payload, {
      'svix-id': id,
      'svix-timestamp': timestamp,
      'svix-signature': signature,
    }) as ResendEmailEvent
  } catch {
    return Response.json({ ok: false, message: 'Invalid webhook signature.' }, { status: 400 })
  }

  const eventType = cleanText(event.type) || 'unknown'
  const eventData = event.data || {}
  const recipient = getRecipient(eventData.to)
  console.info('Resend email event', {
    providerEventId: id,
    providerEmailId: cleanText(eventData.email_id),
    eventType,
    recipient,
    subject: cleanText(eventData.subject),
    occurredAt: cleanTimestamp(event.created_at),
  })

  if (ALERT_EVENT_TYPES.has(eventType)) await sendOwnerAlert({ eventType, recipient, subject: cleanText(eventData.subject) })

  return Response.json({ ok: true })
}

async function sendOwnerAlert(input: { eventType: string; recipient: string; subject: string }) {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `TenAceiQ <welcome@${process.env.RESEND_EMAIL_DOMAIN?.trim() || 'tenaceiq.com'}>`,
      to: ['Nathan@TenAceiQ.com'],
      subject: `TenAceiQ email alert: ${eventLabel(input.eventType)}`,
      html: `<p style="font-family:Arial,sans-serif;color:#06172f">TenAceiQ recorded an email ${escapeHtml(eventLabel(input.eventType)).toLowerCase()}.</p><p><strong>Recipient:</strong> ${escapeHtml(input.recipient || 'not provided')}<br /><strong>Subject:</strong> ${escapeHtml(input.subject || 'not provided')}</p><p>Review the event in Resend before sending another message to this address.</p>`,
    }),
  })
  if (!response.ok) console.error('Unable to send Resend delivery alert.', { eventType: input.eventType, status: response.status })
}

function getRecipient(value: unknown) {
  if (Array.isArray(value)) return value.map(cleanText).filter(Boolean).join(', ').slice(0, 500)
  return cleanText(value).slice(0, 500)
}

function cleanTimestamp(value: unknown) {
  const timestamp = typeof value === 'string' ? new Date(value) : null
  return timestamp && !Number.isNaN(timestamp.getTime()) ? timestamp.toISOString() : new Date().toISOString()
}

function cleanText(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 1000) : ''
}

function eventLabel(eventType: string) {
  if (eventType === 'email.bounced') return 'bounce'
  if (eventType === 'email.complained') return 'spam complaint'
  if (eventType === 'email.suppressed') return 'suppression'
  return eventType.replace(/^email\./, '').replaceAll('_', ' ')
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)
}
