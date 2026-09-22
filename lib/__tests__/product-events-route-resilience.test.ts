import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const route = readFileSync(join(process.cwd(), 'app/api/product-events/route.ts'), 'utf8')

describe('product event route resilience', () => {
  it('keeps best-effort analytics failures out of the customer workflow error budget', () => {
    expect(route).toContain("console.warn('Product activity was not recorded.'")
    expect(route).toContain("return Response.json({ ok: false, message: 'Product activity was skipped.' })")
    expect(route).not.toContain("Product event could not be recorded.' }, { status: 500 }")
  })
})
