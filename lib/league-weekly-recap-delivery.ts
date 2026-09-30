export type LeagueWeeklyRecapDraft = {
  headline: string
  summary: string
  stories: string[]
  sentAt?: string
  sentCount?: number
  emailCount?: number
}

export function normalizeLeagueWeeklyRecapDraft(value: unknown): LeagueWeeklyRecapDraft {
  const source = value && typeof value === 'object' ? value as Record<string, unknown> : {}
  const stories = Array.isArray(source.stories)
    ? source.stories.map((story) => String(story).trim()).filter(Boolean).slice(0, 12)
    : []
  return {
    headline: String(source.headline || '').trim().slice(0, 120),
    summary: String(source.summary || '').trim().slice(0, 2_000),
    stories: stories.map((story) => story.slice(0, 500)),
  }
}

export function validateLeagueWeeklyRecapDraft(draft: LeagueWeeklyRecapDraft) {
  if (!draft.headline) return 'Add a recap headline before saving.'
  if (!draft.summary) return 'Add a recap summary before saving.'
  return ''
}

export function buildLeagueWeeklyRecapEmail(input: {
  leagueName: string
  playOn: string
  draft: LeagueWeeklyRecapDraft
  href: string
}) {
  const storyText = input.draft.stories.length
    ? `\n\nPlayer moments\n${input.draft.stories.map((story) => `• ${story}`).join('\n')}`
    : ''
  return {
    subject: `${input.leagueName}: ${input.draft.headline}`,
    text: `${input.draft.headline}\n\n${input.draft.summary}${storyText}\n\nSee the week: ${input.href}`,
    html: `<div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a;max-width:620px"><p style="color:#126044;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em">${escapeHtml(input.leagueName)} · ${escapeHtml(input.playOn)}</p><h1 style="font-size:24px">${escapeHtml(input.draft.headline)}</h1><p>${escapeHtml(input.draft.summary)}</p>${input.draft.stories.length ? `<h2 style="font-size:18px">Player moments</h2><ul>${input.draft.stories.map((story) => `<li>${escapeHtml(story)}</li>`).join('')}</ul>` : ''}<p><a href="${escapeHtml(input.href)}" style="color:#126044;font-weight:700">See the week in TenAceIQ</a></p><p style="font-size:12px;color:#64748b">Manage email alerts in your TenAceIQ notification settings.</p></div>`,
  }
}

export function escapeHtml(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;')
}
