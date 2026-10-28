import {describe, expect, it, vi} from 'vitest'
import {renderToString} from 'react-dom/server'
vi.mock('next/navigation', () => ({usePathname: () => '/contact'}))
import WebServiceScripts from '../../app/components/web-service-scripts'

describe('third-party script bootstrapping', () => {
  it('does not preload or serialize an advertising or analytics script before the browser privacy check', () => {
    const markup = renderToString(<WebServiceScripts observabilityEnabled />)
    expect(markup).toBe('')
  })
})
