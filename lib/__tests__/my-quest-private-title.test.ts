import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/level-up/my-quest/my-quest-client.tsx'), 'utf8')

describe('My Quest private presentation', () => {
  it('uses a private Player-plan title instead of the retired body-goal label', () => {
    expect(source).toContain('<p className={styles.eyebrow}>Player plan</p>')
    expect(source).toContain('<h1>My Quest</h1>')
    expect(source).toContain('<span>My Quest | Today focus</span>')
    expect(source).not.toMatch(/operation-visible-abs/i)
  })
})
