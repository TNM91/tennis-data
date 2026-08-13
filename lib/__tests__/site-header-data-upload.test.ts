import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const root = process.cwd()
const headerSource = readFileSync(join(root, 'app/components/site-header.tsx'), 'utf8')
const iconSource = readFileSync(join(root, 'components/brand/TiqFeatureIcon.tsx'), 'utf8')
const dataAssistSource = readFileSync(join(root, 'app/data-assist/page.tsx'), 'utf8')

describe('site header data upload shortcut', () => {
  it('adds one signed-in upload action without crowding the phone header', () => {
    expect(headerSource).toContain('const showHeaderUploadAction = authResolved && authenticated')
    expect(headerSource).toContain('data-header-upload-action="true"')
    expect(headerSource).toContain("aria-label={uploadOpen ? 'Close tennis data upload menu' : 'Upload tennis data'}")
    expect(headerSource).toContain('authenticated && resumePrimary && !isMobile')
  })

  it('opens an accessible chooser for the supported tennis data sources', () => {
    expect(headerSource).toContain('data-header-upload-panel="true"')
    expect(headerSource).toContain('aria-labelledby="site-header-upload-title"')
    expect(headerSource).toContain('/data-assist?intent=upload-source&type=scorecard#upload')
    expect(headerSource).toContain('/data-assist?intent=upload-source&type=team_summary#upload')
    expect(headerSource).toContain('/data-assist?intent=upload-source&type=schedule#upload')
    expect(headerSource).toContain('Upload something else or report a data issue')
  })

  it('uses the shared tennis-themed icon system for upload', () => {
    expect(iconSource).toContain("import { UploadSimpleIcon } from '@phosphor-icons/react/dist/csr/UploadSimple'")
    expect(iconSource).toContain("dataUpload: 'Upload tennis data'")
    expect(iconSource).toContain('dataUpload: UploadSimpleIcon')
    expect(headerSource).toContain('<TiqFeatureIcon name="dataUpload" size="sm" variant="ghost" />')
  })

  it('keeps header-selected upload types active on repeat visits', () => {
    expect(dataAssistSource).toContain("const requestedImportType = getRequestedImportType(searchParams.get('type'))")
    expect(dataAssistSource).toContain('setTypeOverrideActive(true)')
    expect(dataAssistSource).toContain('setImportType(requestedImportType)')
    expect(dataAssistSource).toContain("importType: requestedImportType")
  })
})
