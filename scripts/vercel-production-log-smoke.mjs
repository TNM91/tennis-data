import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const vercelCommand = getVercelCommand()

const args = new Map(
  process.argv.slice(2).flatMap((arg) => {
    if (!arg.startsWith('--')) return []
    const [key, ...rest] = arg.slice(2).split('=')
    return [[key, rest.join('=') || 'true']]
  }),
)

const environment = args.get('environment') || 'production'
const since = args.get('since') || '2h'
const limit = args.get('limit') || '50'
const scope = args.get('scope') || 'tennis-data'
const warningLimit = args.get('warning-limit') || '25'

const blockingQueries = [
  { label: 'error logs', args: ['--level', 'error'] },
  { label: 'fatal logs', args: ['--level', 'fatal'] },
  { label: 'HTTP 500 logs', args: ['--status-code', '500'] },
]

const blocking = blockingQueries.map((query) => ({
  label: query.label,
  count: countLogs(query.args, limit),
}))

const warnings = {
  label: 'warning logs',
  count: countLogs(['--level', 'warning'], warningLimit),
  blocking: false,
}

const passed = blocking.every((query) => query.count === 0)

console.log(JSON.stringify({
  ok: passed,
  environment,
  since,
  limit: Number(limit),
  scope,
  blocking,
  warnings,
}, null, 2))

if (!passed) {
  stop('Recent production Vercel logs include blocking errors, fatals, or HTTP 500s.')
}

function countLogs(extraArgs, queryLimit) {
  const result = spawnSync(vercelCommand.command, [
    ...vercelCommand.prefixArgs,
    'vercel',
    'logs',
    '--environment',
    environment,
    '--since',
    since,
    '--limit',
    String(queryLimit),
    '--json',
    '--scope',
    scope,
    ...extraArgs,
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
  })

  if (result.error) {
    stop(`Vercel log query failed: ${result.error.message}`)
  }

  if (result.status !== 0) {
    stop(`Vercel log query exited with status ${result.status}.`)
  }

  return `${result.stdout}\n${result.stderr}`
    .split(/\r?\n/)
    .filter((line) => line.trim().startsWith('{'))
    .length
}

function getVercelCommand() {
  if (process.platform !== 'win32') {
    return { command: 'npx', prefixArgs: [] }
  }

  const programFiles = process.env.ProgramFiles || 'C:\\Program Files'
  const npxShim = join(programFiles, 'nodejs', 'npx.ps1')

  if (!existsSync(npxShim)) {
    stop(`Could not find the Windows npx PowerShell shim at ${npxShim}.`)
  }

  return {
    command: 'powershell.exe',
    prefixArgs: ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', npxShim],
  }
}

function stop(message) {
  console.error(message)
  process.exit(1)
}
