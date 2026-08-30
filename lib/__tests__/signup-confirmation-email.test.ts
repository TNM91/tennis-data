import { describe, expect, it } from 'vitest'
import { buildSignupConfirmationEmail, isSignupEmailIntent } from '@/lib/signup-confirmation-email'

describe('signup confirmation emails', () => {
  it('creates a distinct captain-pilot invitation without exposing raw template syntax', () => {
    const email = buildSignupConfirmationEmail({
      intent: 'captain-pilot',
      confirmationUrl: 'https://example.com/confirm?token=abc',
    })

    expect(email).toContain('Fall Captain Pilot')
    expect(email).toContain('three months at $0')
    expect(email).toContain('renews at $5.99/month until canceled')
    expect(email).toContain('https://example.com/confirm?token=abc')
    expect(email).not.toContain('{{')
  })

  it('gives Free and Player signups their own honest next steps', () => {
    const free = buildSignupConfirmationEmail({ intent: 'free', confirmationUrl: 'https://example.com/free' })
    const player = buildSignupConfirmationEmail({ intent: 'player_plus', confirmationUrl: 'https://example.com/player' })

    expect(free).toContain('There is no card and no surprise upgrade')
    expect(player).toContain('My Lab')
    expect(player).toContain('Player tools unlock only after you activate the plan')
  })

  it('uses an optional first name without changing the selected tier message', () => {
    const email = buildSignupConfirmationEmail({
      intent: 'player_plus',
      firstName: 'Mindy',
      confirmationUrl: 'https://example.com/player',
    })

    expect(email).toContain('Mindy, your game deserves a clearer plan.')
    expect(email).toContain('My Lab')
  })

  it('only accepts supported tier intents', () => {
    expect(isSignupEmailIntent('free')).toBe(true)
    expect(isSignupEmailIntent('captain-pilot')).toBe(true)
    expect(isSignupEmailIntent('club_starter')).toBe(false)
  })
})
