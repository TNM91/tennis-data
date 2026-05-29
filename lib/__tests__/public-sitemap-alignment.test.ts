import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { PLAYER_DEVELOPMENT_IDENTITIES } from '../player-development'

const sitemapSource = readFileSync(join(process.cwd(), 'app/sitemap.ts'), 'utf8')
const robotsSource = readFileSync(join(process.cwd(), 'app/robots.ts'), 'utf8')

describe('public sitemap alignment', () => {
  it('includes first-class public command-center routes', () => {
    for (const path of [
      '/coaches',
      '/tournaments',
      '/resources',
      '/matchup',
      '/player-development',
      '/teams',
      '/leagues',
      '/rankings',
      '/data-assist',
    ]) {
      expect(sitemapSource).toContain(`path: '${path}'`)
    }
  })

  it('includes public player development workbook and coach planner routes', () => {
    for (const path of [
      '/player-development/workbook',
      '/player-development/coach-planner',
    ]) {
      expect(sitemapSource).toContain(`path: '${path}'`)
    }

    expect(sitemapSource).toContain('PLAYER_DEVELOPMENT_IDENTITIES.flatMap')
    for (const identity of PLAYER_DEVELOPMENT_IDENTITIES) {
      expect(sitemapSource).toContain('`/player-development/${identity.slug}`')
      expect(identity.slug).toMatch(/^[a-z0-9-]+$/)
    }
  })

  it('keeps private, legacy, and auth routes out of the sitemap when robots disallows them', () => {
    for (const path of [
      '/admin',
      '/captain',
      '/coach',
      '/compete',
      '/league-coordinator',
      '/messages',
      '/mylab',
      '/profile',
      '/preview-home',
      '/tactics',
      '/api',
      '/login',
      '/join',
      '/forget-password',
      '/reset-password',
      '/upgrade',
    ]) {
      expect(robotsSource).toContain(`'${path}`)
      expect(sitemapSource).not.toContain(`path: '${path}'`)
    }
  })
})
