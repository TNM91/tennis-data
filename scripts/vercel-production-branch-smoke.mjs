import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const args = new Map(
  process.argv.slice(2).flatMap((arg) => {
    if (!arg.startsWith('--')) return []
    const [key, ...rest] = arg.slice(2).split('=')
    return [[key, rest.join('=') || 'true']]
  }),
)

const project = args.get('project') || readLinkedProjectId()
const scope = args.get('scope') || 'tennis-data'
const expectedProductionBranch = args.get('expect') || 'master'
const dashboardGitSettingsUrl = `https://vercel.com/${scope}/tennis-data/settings/git#connected-git-repository`

const projectDetails = readVercelProject(project, scope)
const actualProductionBranch = projectDetails.link?.productionBranch || ''
const deployments = Array.isArray(projectDetails.latestDeployments) ? projectDetails.latestDeployments : []
const latestProductionDeployment = deployments.find((deployment) => deployment.target === 'production') ?? null
const latestMasterDeployment = deployments.find((deployment) => deployment.meta?.githubCommitRef === 'master') ?? null
const latestMainDeployment = deployments.find((deployment) => deployment.meta?.githubCommitRef === 'main') ?? null
const productionDeploymentBranch = latestProductionDeployment?.meta?.githubCommitRef || ''

const ok = actualProductionBranch === expectedProductionBranch

console.log(JSON.stringify({
  ok,
  scope,
  project,
  expectedProductionBranch,
  actualProductionBranch,
  productionDeploymentBranch,
  productionDeploymentReadyState: latestProductionDeployment?.readyState || null,
  latestMasterDeployment: summarizeDeployment(latestMasterDeployment),
  latestMainDeployment: summarizeDeployment(latestMainDeployment),
  dashboardGitSettingsUrl,
  dashboardSteps: [
    'Open the Vercel project Git settings.',
    `In Connected Git Repository, change the Production Branch from ${actualProductionBranch || 'unknown'} to ${expectedProductionBranch}.`,
    'Save the setting, then rerun npm run qa:vercel-branch.',
  ],
  next: ok
    ? 'Vercel Git production branch is aligned with the release branch.'
    : `Change the Vercel project Git production branch from ${actualProductionBranch || 'unknown'} to ${expectedProductionBranch} at ${dashboardGitSettingsUrl}, then rerun this command.`,
}, null, 2))

if (!ok) {
  stop('Vercel Git production branch is not aligned with the release branch.')
}

function readLinkedProjectId() {
  try {
    const linkedProject = JSON.parse(readFileSync(join(process.cwd(), '.vercel', 'project.json'), 'utf8'))
    return linkedProject.projectId || 'tennis-data'
  } catch {
    return 'tennis-data'
  }
}

function readVercelProject(projectIdOrName, teamScope) {
  const vercelCommand = getVercelCommand()
  const result = spawnSync(vercelCommand.command, [
    ...vercelCommand.prefixArgs,
    'vercel',
    'api',
    `/v9/projects/${projectIdOrName}`,
    '--scope',
    teamScope,
    '--raw',
  ], {
    cwd: process.cwd(),
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 20,
  })

  if (result.error) {
    stop(`Vercel project metadata query failed: ${result.error.message}`)
  }

  if (result.status !== 0) {
    stop(`Vercel project metadata query exited with status ${result.status}.`)
  }

  const jsonText = extractFirstJsonObject(`${result.stdout}\n${result.stderr}`)
  if (!jsonText) {
    stop('Vercel project metadata query did not return a JSON object.')
  }

  try {
    return JSON.parse(jsonText)
  } catch {
    stop('Vercel project metadata response could not be parsed as JSON.')
  }
}

function summarizeDeployment(deployment) {
  if (!deployment) return null

  return {
    branch: deployment.meta?.githubCommitRef || null,
    commit: deployment.meta?.githubCommitSha?.slice(0, 8) || null,
    readyState: deployment.readyState || null,
    target: deployment.target || null,
    url: deployment.url || null,
  }
}

function extractFirstJsonObject(output) {
  const start = output.indexOf('{')
  if (start === -1) return ''

  let depth = 0
  let inString = false
  let escaped = false

  for (let index = start; index < output.length; index += 1) {
    const char = output[index]

    if (escaped) {
      escaped = false
      continue
    }

    if (char === '\\') {
      escaped = inString
      continue
    }

    if (char === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (char === '{') depth += 1
    if (char === '}') depth -= 1

    if (depth === 0) {
      return output.slice(start, index + 1)
    }
  }

  return ''
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
