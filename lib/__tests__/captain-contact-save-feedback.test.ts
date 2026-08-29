import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/captain/messaging/page.tsx'), 'utf8')

describe('captain contact save feedback', () => {
  it('confirms a saved contact instead of silently clearing the form', () => {
    expect(source).toContain("const [contactSaveMessage, setContactSaveMessage] = useState<string | null>(null)")
    expect(source).toContain("${fullName}'s contact is saved and ready in your team roster.")
    expect(source).toContain('role="status" aria-live="polite"')
  })

  it('preserves a device-save explanation when cloud storage cannot be reached', () => {
    expect(source).toContain("return 'device' as const")
    expect(source).toContain('will sync when cloud access returns')
  })
})
