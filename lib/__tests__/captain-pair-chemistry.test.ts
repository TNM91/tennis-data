import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Captain pair chemistry', () => {
  const page = readFileSync(join(process.cwd(), 'app/captain/page.tsx'), 'utf8')

  it('adds recent canonical results to the existing doubles pairing evidence', () => {
    expect(page).toContain("recentResults: Array<{ result: 'W' | 'L'; date: string }>")
    expect(page).toContain("item.recentResults.push({ result: won ? 'W' : 'L', date: match.match_date })")
    expect(page).toContain('recentResults: pair.recentResults.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5)')
    expect(page).toContain('aria-label={`${pair.names.join(\' and \')} recent results`}')
    expect(page).toContain('Last played {formatDateShort(pair.lastMatchDate)}')
  })
})
