import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { getCaptainLineupNextAction, shouldShowCaptainLineupMobileAction } from '@/lib/captain-lineup-next-action'
import CaptainLineupMobileAction from '@/app/components/captain-lineup-mobile-action'

const ready = {
  hasMatch: true, lineupComplete: true, selectedCount: 6, requiredCount: 6,
  confirmedCount: 6, outCount: 0, maybeCount: 0,
}

describe('Captain lineup next action', () => {
  it('requires match setup before a completed lineup can be sent', () => {
    expect(getCaptainLineupNextAction({ ...ready, hasMatch: false }).step).toBe('setup')
  })
  it('finishes missing courts before asking players', () => {
    const action = getCaptainLineupNextAction({ ...ready, lineupComplete: false, selectedCount: 4, openCourtLabel: 'Doubles 3' })
    expect(action.step).toBe('finish')
    expect(action.detail).toContain('Doubles 3')
  })
  it.each([{ requiredCount: 0, selectedCount: 0 }, { requiredCount: 6, selectedCount: 5 }])('never sends an empty or duplicate-player lineup', (counts) => {
    expect(getCaptainLineupNextAction({ ...ready, ...counts }).step).toBe('finish')
  })
  it('replaces unavailable players before asking or sending', () => {
    expect(getCaptainLineupNextAction({ ...ready, outCount: 1, confirmedCount: 5 }).step).toBe('replace')
  })
  it('asks for missing or tentative confirmations', () => {
    expect(getCaptainLineupNextAction({ ...ready, confirmedCount: 5 }).step).toBe('ask')
    expect(getCaptainLineupNextAction({ ...ready, maybeCount: 1 }).step).toBe('ask')
  })
  it('sends only a complete lineup with every player confirmed', () => {
    expect(getCaptainLineupNextAction(ready).step).toBe('send')
  })
  it('removes the completed mobile Send action and restores it when the draft needs another action', () => {
    expect(shouldShowCaptainLineupMobileAction(getCaptainLineupNextAction(ready), true)).toBe(false)
    expect(shouldShowCaptainLineupMobileAction(getCaptainLineupNextAction(ready), false)).toBe(true)
    expect(shouldShowCaptainLineupMobileAction(getCaptainLineupNextAction({ ...ready, editingCourtLabel: 'Singles 1' }), true)).toBe(true)
    expect(shouldShowCaptainLineupMobileAction(getCaptainLineupNextAction({ ...ready, confirmedCount: 5 }), true)).toBe(true)
  })
  it('finishes the current court edit before offering a send or another lineup action', () => {
    for (const changes of [{}, { lineupComplete: false }, { outCount: 1 }, { confirmedCount: 3 }]) {
      const action = getCaptainLineupNextAction({ ...ready, ...changes, editingCourtLabel: 'Singles 1' })
      expect(action.label).toBe('Done editing')
      expect(action.detail).toContain('Singles 1')
      expect(action.step).not.toBe('send')
    }
    expect(getCaptainLineupNextAction({ ...ready, editingCourtLabel: undefined }).step).toBe('send')
  })
  it('renders one disabled action while saving or sending', () => {
    const html = renderToStaticMarkup(createElement(CaptainLineupMobileAction, {
      action: getCaptainLineupNextAction(ready), disabled: true, busyLabel: 'Sending lineup…', onAction: () => {},
    }))
    expect(html.match(/<button/g)).toHaveLength(1)
    expect(html).toContain('disabled=""')
    expect(html).toContain('aria-busy="true"')
    expect(html).toContain('Sending lineup…')
  })
  it('keeps a failed send visible beside the action', () => {
    const html = renderToStaticMarkup(createElement(CaptainLineupMobileAction, {
      action: getCaptainLineupNextAction(ready), disabled: false, error: 'Sign in again before sending.', onAction: () => {},
    }))
    expect(html).toContain('role="alert"')
    expect(html).toContain('Sign in again before sending.')
  })
})
