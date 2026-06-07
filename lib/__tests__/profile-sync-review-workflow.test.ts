import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const productEventsPage = readFileSync('app/admin/product-events/page.tsx', 'utf8')
const reviewRoute = readFileSync('app/api/profile-sync-reviews/route.ts', 'utf8')
const migration = readFileSync('supabase/migrations/20260606000200_create_profile_sync_review_events.sql', 'utf8')

describe('profile sync review workflow', () => {
  it('stores profile sync review state beside immutable product events', () => {
    expect(migration).toContain('create table if not exists public.profile_sync_review_events')
    expect(migration).toContain('event_id uuid not null unique references public.product_usage_events(id) on delete cascade')
    expect(migration).toContain("status text not null default 'open' check (status in ('open', 'reviewed'))")
    expect(migration).toContain('reviewed_by_user_id uuid null references public.profiles(id) on delete set null')
  })

  it('keeps profile sync review updates admin-only', () => {
    expect(reviewRoute).toContain("Response.json({ ok: false, message: 'Admin access is required.' }, { status: 403 })")
    expect(reviewRoute).toContain(".from('product_usage_events')")
    expect(reviewRoute).toContain("cleanText((event as { event_name?: string | null }).event_name) !== 'profile_cloud_sync_repair'")
    expect(reviewRoute).toContain(".from('profile_sync_review_events')")
    expect(reviewRoute).toContain(".upsert({")
  })

  it('excludes reviewed sync repair failures from the open review queue', () => {
    expect(productEventsPage).toContain("type ProfileSyncReviewStatus = 'open' | 'reviewed'")
    expect(productEventsPage).toContain("if (reviewsByEventId[event.id]?.status === 'reviewed') return false")
    expect(productEventsPage).toContain("event.metadata?.result === 'failed' || event.metadata?.result === 'local_only' || event.metadata?.hasError === true")
    expect(productEventsPage).toContain("label=\"Sync Needs Review\"")
    expect(productEventsPage).toContain("onSaveReview={(status) => void saveProfileSyncReview(event, status)}")
    expect(productEventsPage).toContain('function buildAdminAccessUserHref(userId: string)')
    expect(productEventsPage).toContain("`/admin/access?search=${encodeURIComponent(userId)}`")
    expect(productEventsPage).toContain('Open access')
  })
})
