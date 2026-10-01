import { describe, expect, it } from 'vitest'
import { buildLocationDirectionsHref } from '../location-directions'

describe('location directions', () => {
  it('uses the saved site as a directions destination', () => {
    expect(buildLocationDirectionsHref('  Dwight Davis Tennis Center  ')).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=Dwight%20Davis%20Tennis%20Center',
    )
  })

  it('normalizes whitespace and skips missing sites', () => {
    expect(buildLocationDirectionsHref('Vetta West\n123 Main St')).toContain('destination=Vetta%20West%20123%20Main%20St')
    expect(buildLocationDirectionsHref('   ')).toBe('')
    expect(buildLocationDirectionsHref(null)).toBe('')
  })
})
