import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

// Deliberately narrow: everything outside this list still builds the website.
export function nativeOnlyFiles(files) {
  return files.length > 0 && files.every(file => {
    if (!file || /[\\\x00-\x1f]/.test(file) || file.split('/').includes('..')) return false
    return file.startsWith('mobile/') || file.startsWith('tests/') || file.startsWith('lib/__tests__/')
      || (file.startsWith('docs/') && file.endsWith('.md')) || ['README.md','AGENTS.md'].includes(file)
      || /^\.github\/workflows\/(?:ci|mobile-ios-[a-z-]+)\.yml$/.test(file)
  })
}

export function inspectWebsiteBuild(cwd = process.cwd(), env = process.env) {
  const build = reason => ({ skip: false, reason })
  const previous = env.VERCEL_GIT_PREVIOUS_SHA || ''
  const current = env.VERCEL_GIT_COMMIT_SHA || ''
  if (!['production','preview'].includes(env.VERCEL_ENV) || !['master','staging'].includes(env.VERCEL_GIT_COMMIT_REF)) return build('unrecognized deployment context')
  if (!/^[a-f0-9]{40}$/.test(previous) || !/^[a-f0-9]{40}$/.test(current) || previous === current) return build('missing, invalid or unchanged baseline')
  const git = args => execFileSync('git', args, { cwd, encoding: 'utf8', timeout: 5000, maxBuffer: 1024 * 1024, stdio: ['ignore','pipe','pipe'] })
  try {
    if (git(['rev-parse','HEAD']).trim() !== current) return build('checkout does not match deployment')
    git(['merge-base','--is-ancestor',previous,current])
    // Compare to the last successful deployment, including all intervening merges.
    // Never fetch missing history or guess that HEAD^ is the deployed baseline.
    const files = git(['diff','--no-renames','--name-only','-z',previous,current]).split('\0').filter(Boolean)
    return nativeOnlyFiles(files)
      ? { skip: true, reason: 'only native app, documentation or test changes', files: files.length }
      : build('website, shared code, configuration, data or assets may have changed')
  } catch { return build('deployment history could not be verified') }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const decision = inspectWebsiteBuild()
  console.log(JSON.stringify(decision))
  // Vercel: zero skips; nonzero builds. Unknowns always build.
  process.exitCode = decision.skip ? 0 : 1
}
