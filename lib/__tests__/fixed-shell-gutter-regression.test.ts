import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { describe, expect, it } from 'vitest'

const ROOTS = ['app', 'lib']
const SOURCE_EXTENSIONS = new Set(['.ts', '.tsx'])
const WIDTH_GUTTER_PATTERN =
  /\b(?:width|maxWidth|minWidth):\s*['"`][^'"`]*calc\(100% - (?:20|24|28|32|36|40|48)px\)/g

function sourceFiles(dir: string): string[] {
  const entries = readdirSync(dir)
  const files: string[] = []

  for (const entry of entries) {
    const path = join(dir, entry)
    const stat = statSync(path)

    if (stat.isDirectory()) {
      if (entry === '__tests__') continue
      files.push(...sourceFiles(path))
      continue
    }

    if (SOURCE_EXTENSIONS.has(path.slice(path.lastIndexOf('.')))) {
      files.push(path)
    }
  }

  return files
}

describe('fixed shell gutter regression guard', () => {
  it('keeps production shell widths on responsive clamp gutters', () => {
    const offenders = ROOTS.flatMap((root) => sourceFiles(join(process.cwd(), root)))
      .flatMap((file) => {
        const source = readFileSync(file, 'utf8')
        return Array.from(source.matchAll(WIDTH_GUTTER_PATTERN), (match) => {
          const line = source.slice(0, match.index).split('\n').length
          return `${relative(process.cwd(), file)}:${line}: ${match[0]}`
        })
      })

    expect(offenders).toEqual([])
  })
})
