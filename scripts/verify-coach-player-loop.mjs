import { spawn } from 'node:child_process'

const args = [
  'vitest',
  'run',
  'lib/__tests__/coach-storage.test.ts',
  'lib/__tests__/level-up-session-sync.test.ts',
  '--pool=threads',
  '--no-file-parallelism',
]

const command = process.platform === 'win32' ? 'cmd.exe' : 'npx'
const commandArgs = process.platform === 'win32' ? ['/c', 'npx', ...args] : args

const child = spawn(command, commandArgs, {
  cwd: process.cwd(),
  stdio: 'inherit',
})

child.on('exit', (code) => {
  process.exit(code ?? 1)
})
