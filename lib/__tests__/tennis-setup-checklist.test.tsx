import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import TennisSetupChecklist from '@/app/components/tennis-setup-checklist'

describe('tennis setup checklist', () => {
  it('keeps player setup focused on their record and missing matches', () => {
    const html = renderToStaticMarkup(<TennisSetupChecklist hasPlayer hasTeam={false} hasMatchData={false} />)

    expect(html).toContain('Step 2 of 2')
    expect(html).toContain('Add your match data.')
    expect(html).not.toContain('Upload Team Summary')
    expect(html).not.toContain('Connect your team.')
    expect(renderToStaticMarkup(<TennisSetupChecklist hasPlayer hasTeam={false} hasMatchData />)).toBe('')
  })

  it('keeps team setup in the Captain path', () => {
    const html = renderToStaticMarkup(<TennisSetupChecklist hasPlayer hasTeam={false} hasMatchData={false} context="captain" />)

    expect(html).toContain('Step 2 of 3')
    expect(html).toContain('Add your first team.')
    expect(html).toContain('Upload Team Summary')
  })
})
