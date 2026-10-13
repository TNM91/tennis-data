import { test, expect } from '@playwright/test'

test('captain edits a saved practice on a narrow screen without replacing its signup link', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const now = Math.floor(Date.now() / 1000)
  const userId = '00000000-0000-4000-8000-000000000001'
  const token = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify({ sub: userId, role: 'authenticated', aud: 'authenticated', exp: now + 86400 })).toString('base64url'), 'mock'].join('.')
  const user = { id: userId, aud: 'authenticated', role: 'authenticated', email: 'captain@regression.test', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' }
  const entitlements = { captainSubscriptionActive: true, captainSubscriptionStatus: 'active', playerPlusSubscriptionActive: true, playerPlusSubscriptionStatus: 'active' }
  await page.addInitScript(({ token, user, now, entitlements }) => {
    localStorage.setItem('sb-pwxppfazbyourjrsutgx-auth-token', JSON.stringify({ access_token: token, refresh_token: 'mock-refresh', token_type: 'bearer', expires_in: 86400, expires_at: now + 86400, user }))
    localStorage.setItem(`tenaceiq-auth-access:v2:${user.id}`, JSON.stringify({ cachedAt: Date.now(), role: 'captain', entitlements }))
  }, { token, user, now, entitlements })
  await page.route('**/api/auth/access', route => route.fulfill({ json: { access: { role: 'captain', entitlements } } }))
  const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1)
  const date = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`
  let event = { id: 'practice-1', conversation_id: 'thread-1', event_type: 'captain_practice', title: 'Team practice', scheduled_date: date, scheduled_time: '20:00', facility: 'Vetta West', recurrence_rule: 'weekly', status: 'proposed', created_by_user_id: userId, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z', metadata: { publicToken: 'same-signup-token', practiceEndTime: '22:00', practiceNotes: 'Returns' } }
  let patch: Record<string, unknown> | null = null
  let recurrenceCalls = 0
  await page.route('https://pwxppfazbyourjrsutgx.supabase.co/**', async route => {
    const url = new URL(route.request().url())
    const table = url.pathname.split('/').pop()
    if (table === 'advance_captain_practices') { recurrenceCalls++; await route.fulfill({ json: null }); return }
    if (table === 'user') { await route.fulfill({ json: user }); return }
    if (table === 'profiles') { await route.fulfill({ json: { id: userId, role: 'captain', linked_player_name: 'Captain', message_display_name: 'Captain', tiq_public_id: 'TIQ-TEST' } }); return }
    if (table === 'internal_schedule_events') {
      if (route.request().method() === 'PATCH') { patch = route.request().postDataJSON(); event = { ...event, ...patch, updated_at: '2026-10-13T00:00:00Z' } as typeof event; await route.fulfill({ json: event }); return }
      await route.fulfill({ json: [event] }); return
    }
    if (table === 'captain_practice_invites') { await route.fulfill({ json: [{ id: 'invite-1', event_id: event.id, public_token: 'same-signup-token', capacity: 8 }] }); return }
    if (table === 'captain_practice_invitees') { await route.fulfill({ json: [{ id: 'player-1', event_id: event.id, invite_id: 'invite-1', player_name: 'Player One', response_status: 'in', captain_confirmed_at: null }] }); return }
    if (table === 'internal_conversations' && route.request().method() === 'GET') { await route.fulfill({ json: { id: 'thread-1', conversation_type: 'league', subject: 'Team practice', created_by_user_id: userId, metadata: {} } }); return }
    await route.fulfill({ json: [] })
  })
  await page.goto('/captain/practice')
  const upcoming = page.getByRole('region', { name: 'Upcoming practices' })
  await upcoming.getByRole('button', { name: 'Edit practice', exact: true }).click()
  await expect(upcoming.getByLabel('Date', { exact: true })).toHaveValue(date)
  await upcoming.getByLabel('Location', { exact: true }).fill('New courts')
  await upcoming.getByLabel('Start time', { exact: true }).fill('19:00')
  await upcoming.getByLabel('End time', { exact: true }).fill('21:00')
  await upcoming.getByRole('combobox', { name: /^Repeats/ }).selectOption('biweekly')
  await page.screenshot({ path: test.info().outputPath('practice-edit-mobile.png'), fullPage: true })
  await upcoming.getByRole('button', { name: 'Save practice', exact: true }).click()
  await expect(upcoming.getByRole('button', { name: 'Edit practice', exact: true })).toBeVisible()
  await expect(upcoming.getByText(/New courts/)).toBeVisible()
  expect(patch).toMatchObject({ facility: 'New courts', scheduled_time: '19:00', recurrence_rule: 'biweekly', metadata: { publicToken: 'same-signup-token', practiceEndTime: '21:00' } })
  expect(recurrenceCalls).toBeGreaterThanOrEqual(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})
