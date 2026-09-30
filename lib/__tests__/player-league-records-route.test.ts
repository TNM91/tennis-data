import { describe, expect, it } from 'vitest'
import { GET } from '../../app/api/player/league-records/route'

describe('player league records route', () => {
  it('requires an authenticated player account', async () => {
    const response = await GET(new Request('https://tenaceiq.test/api/player/league-records'))
    expect(response.status).toBe(401)
    await expect(response.json()).resolves.toMatchObject({ ok: false })
  })
})
