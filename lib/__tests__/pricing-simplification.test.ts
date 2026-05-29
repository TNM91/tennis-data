import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const pricingSource = readFileSync(join(process.cwd(), 'app/pricing/page.tsx'), 'utf8')
const pricingLayoutSource = readFileSync(join(process.cwd(), 'app/pricing/layout.tsx'), 'utf8')
const joinSource = readFileSync(join(process.cwd(), 'app/join/page.tsx'), 'utf8')

describe('pricing simplification', () => {
  it('keeps pricing organized around the five decision sections', () => {
    expect(pricingSource).toContain('Choose your role')
    expect(pricingSource).toContain('See the workspace')
    expect(pricingSource).toContain('Compare what unlocks')
    expect(pricingSource).toContain('Billing clarity')
    expect(pricingSource).toContain('Start free / upgrade')
  })

  it('uses public workspace naming and consistent League billing', () => {
    expect(pricingSource).toContain('Player - My Lab for your game')
    expect(pricingSource).toContain('Coach - Coach Hub for player development')
    expect(pricingSource).toContain('Captain - Team Hub for match week')
    expect(pricingSource).toContain('League - League Office for a season')
    expect(pricingSource).toContain('Full-Court - Everything connected, including Tournament Desk')
    expect(pricingSource).toContain('Connect My Lab, Coach Hub, Team Hub, League Office')
    expect(pricingSource).toContain('League is $14.99 per season workspace')
    expect(pricingLayoutSource).toContain('Free, My Lab, Coach Hub, Team Hub, League Office, and Full-Court')
    expect(joinSource).toContain('Full-Court starts with a free account, then unlocks My Lab, Coach Hub, Team Hub, League Office')
    expect(pricingSource).not.toContain('You, Coach, Team, or League')
    expect(pricingSource).not.toContain('League is $14.99/month')
    expect(`${pricingSource}\n${pricingLayoutSource}\n${joinSource}`).not.toContain('Player, Coach, Captain, League, and unlimited tournaments')
  })
})
