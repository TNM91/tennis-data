import { readdir, stat } from 'node:fs/promises'
import path from 'node:path'

const root = process.cwd()
const maxLargeFileBytes = Number(process.env.ARTIFACT_AUDIT_MAX_MB ?? 10) * 1024 * 1024

const skippedDirs = new Set([
  '.git',
  '.vercel',
  '.agents',
  '.codex',
  'node_modules',
])

const blockedRootEntries = new Set([
  '.next',
  'out',
  'build',
  'backups',
  'tmp-screenshots',
  'tennis-data',
  'app.zip',
  'lint-errors.txt',
  'type-errors.txt',
  'Step',
])

const generatedNamePatterns = [
  /^screenshots-.*\.png$/i,
  /^(?:npm|yarn|pnpm)-debug\.log/i,
  /^yarn-error\.log/i,
  /^dev-server.*\.log$/i,
  /^server-.*\.log$/i,
  /^\.codex-dev-server.*\.log$/i,
  /\.tsbuildinfo$/i,
  /\.zip$/i,
]

const largeFileAllowExtensions = new Set([
  '.avif',
  '.gif',
  '.ico',
  '.jpg',
  '.jpeg',
  '.mp4',
  '.png',
  '.webm',
  '.webp',
])

const findings = []

await scan(root)

if (findings.length) {
  console.error(JSON.stringify({
    ok: false,
    message: 'Generated or oversized local artifacts need cleanup before closeout.',
    findings,
  }, null, 2))
  process.exit(1)
}

console.log(JSON.stringify({
  ok: true,
  checkedRoot: root,
  maxLargeFileMb: Math.round(maxLargeFileBytes / 1024 / 1024),
  skippedDirs: [...skippedDirs],
}, null, 2))

async function scan(dir) {
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const absolutePath = path.join(dir, entry.name)
    const relativePath = toRelativePath(absolutePath)
    const isRootEntry = dir === root

    if (entry.isDirectory()) {
      if (skippedDirs.has(entry.name)) continue

      if (isRootEntry && blockedRootEntries.has(entry.name)) {
        findings.push(await makeFinding('blocked-root-directory', absolutePath, `${relativePath}/`))
        continue
      }

      await scan(absolutePath)
      continue
    }

    if (!entry.isFile()) continue

    if (isRootEntry && blockedRootEntries.has(entry.name)) {
      findings.push(await makeFinding('blocked-root-file', absolutePath, relativePath))
      continue
    }

    if (generatedNamePatterns.some((pattern) => pattern.test(entry.name))) {
      findings.push(await makeFinding('generated-artifact', absolutePath, relativePath))
      continue
    }

    const fileStat = await stat(absolutePath)
    const extension = path.extname(entry.name).toLowerCase()
    if (fileStat.size > maxLargeFileBytes && !largeFileAllowExtensions.has(extension)) {
      findings.push({
        type: 'large-nonasset-file',
        path: relativePath,
        sizeMb: toMb(fileStat.size),
        note: `Review whether this belongs in source control or should live outside the repo.`,
      })
    }
  }
}

async function makeFinding(type, absolutePath, relativePath) {
  const fileStat = await stat(absolutePath)
  return {
    type,
    path: relativePath,
    sizeMb: toMb(fileStat.size),
    note: cleanupNote(type),
  }
}

function cleanupNote(type) {
  if (type === 'blocked-root-directory') {
    return 'Move backups or generated output outside the repo, or remove local build artifacts after verification.'
  }

  if (type === 'blocked-root-file') {
    return 'This local artifact is ignored by Git and should not stay in the project root.'
  }

  return 'Generated logs, screenshots, zips, and TypeScript build info should be removed before closeout.'
}

function toRelativePath(absolutePath) {
  return path.relative(root, absolutePath).replaceAll(path.sep, '/')
}

function toMb(bytes) {
  return Number((bytes / 1024 / 1024).toFixed(2))
}
