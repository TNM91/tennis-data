import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(join(process.cwd(), 'app/components/universal-search.tsx'), 'utf8')

describe('universal search accessibility', () => {
  it('exposes category controls and tracks category selection', () => {
    expect(source).toContain("const [activeGroup, setActiveGroup]")
    expect(source).toContain('aria-label="Search categories"')
    expect(source).toContain('aria-pressed={activeGroup === group}')
    expect(source).toContain("eventName: 'search_category_selected'")
    expect(source).toContain('category: group')
  })

  it('connects the search input to an announced result region', () => {
    expect(source).toContain('const resultRegionId')
    expect(source).toContain('aria-controls={resultRegionId}')
    expect(source).toContain('role="region"')
    expect(source).toContain('aria-label="Universal search results"')
    expect(source).toContain('aria-live="polite"')
  })

  it('keeps keyboard focus visible on the search input', () => {
    expect(source).toContain('const [inputFocused, setInputFocused]')
    expect(source).toContain('const [focusedControl, setFocusedControl]')
    expect(source).toContain('onFocus={() => setInputFocused(true)}')
    expect(source).toContain('onBlur={() => setInputFocused(false)}')
    expect(source).toContain('inputFocusStyle')
    expect(source).toContain("outline: '2px solid transparent'")
    expect(source).not.toContain("outline: 'none'")
  })

  it('keeps keyboard focus visible on search actions and category controls', () => {
    expect(source).toContain("onFocus={() => setFocusedControl('submit')}")
    expect(source).toContain('onFocus={() => setFocusedControl(`category-${group}`)}')
    expect(source).toContain("onFocus={() => setFocusedControl('zero-result-all')}")
    expect(source).toContain("onFocus={() => setFocusedControl('zero-result-resource')}")
    expect(source).toContain('buttonFocusStyle')
    expect(source).toContain("outlineOffset: 3")
    expect(source).toContain("boxShadow: '0 0 0 5px rgba(155,225,29,0.14)'")
  })

  it('announces category-specific zero results', () => {
    expect(source).toContain('No matching tennis action in this category.')
    expect(source).toContain('role="status"')
    expect(source).toContain('noResultStyle')
    expect(source).toContain('Search all categories')
    expect(source).toContain('Open Resource Hub')
    expect(source).toContain('onClick={broadenZeroResultSearch}')
    expect(source).toContain("`/resources?q=${encodeURIComponent(query.trim())}`")
  })
})
