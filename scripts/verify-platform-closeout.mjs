import { spawn } from 'node:child_process'

const checks = [
  {
    label: 'Tier copy consistency',
    command: process.execPath,
    args: ['scripts/verify-tier-copy.mjs'],
  },
  {
    label: 'Coach-player Level Up contract',
    command: process.execPath,
    args: ['scripts/verify-coach-player-loop.mjs'],
  },
]

if (process.env.PLATFORM_QA_BASE_URL) {
  checks.push({
    label: 'Platform route smoke',
    command: process.execPath,
    args: ['scripts/verify-platform-routes.mjs'],
  })
}

if (process.env.LEVEL_UP_BASE_URL) {
  checks.push({
    label: 'Level Up player loop smoke',
    command: process.execPath,
    args: ['scripts/verify-level-up-player-loop.mjs'],
  })
}

if (process.env.PORTAL_CHECK_BASE_URL) {
  checks.push({
    label: 'Portal overflow smoke',
    command: process.execPath,
    args: ['scripts/portal-overflow-check.mjs'],
  })
}

for (const check of checks) {
  console.log(`\n== ${check.label} ==`)
  await run(check.command, check.args)
}

console.log('\nPlatform closeout checks passed.')

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: process.cwd(),
      env: process.env,
      stdio: 'inherit',
    })

    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`${command} ${args.join(' ')} failed with exit code ${code ?? 'unknown'}`))
    })
  })
}
