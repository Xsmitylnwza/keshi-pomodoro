import { spawn } from 'node:child_process'
import { access } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const isWindows = process.platform === 'win32'
const npmCmd = isWindows ? 'npm.cmd' : 'npm'
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')
const dataMarker = path.join(rootDir, 'data', 'tasks.json')

const children = []
let shuttingDown = false

async function pathExists(filePath) {
  try {
    await access(filePath)
    return true
  } catch {
    return false
  }
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: isWindows,
      env: process.env,
      ...options,
    })
    child.on('error', reject)
    child.on('exit', (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`))
    })
  })
}

function start(name, args) {
  const child = spawn(npmCmd, args, {
    cwd: rootDir,
    stdio: 'inherit',
    shell: isWindows,
    env: process.env,
  })

  child.on('exit', (code, signal) => {
    if (shuttingDown) return
    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`
    console.error(`[dev:all] ${name} exited (${reason}). Stopping the other process...`)
    shutdown(typeof code === 'number' ? code : 1)
  })

  child.on('error', (error) => {
    if (shuttingDown) return
    console.error(`[dev:all] failed to start ${name}:`, error)
    shutdown(1)
  })

  children.push(child)
  return child
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return
  shuttingDown = true

  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM')
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) child.kill('SIGKILL')
    }
    process.exit(exitCode)
  }, 1500).unref()
}

process.on('SIGINT', () => shutdown(0))
process.on('SIGTERM', () => shutdown(0))

if (!(await pathExists(dataMarker))) {
  console.log('[dev:all] no local data found — seeding mock data...')
  await run(process.execPath, ['scripts/seed-local.mjs'])
} else {
  console.log('[dev:all] local data found')
}

console.log('[dev:all] starting API + Vite frontend...')
console.log('[dev:all] open http://127.0.0.1:5174/ (local mock auth is enabled in Vite DEV)')
start('api', ['run', 'api'])
start('dev', ['run', 'dev'])
