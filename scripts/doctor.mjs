#!/usr/bin/env node
// Preflight check for running Coworker locally. Cross-platform (macOS/Linux/Windows).
// Usage: node scripts/doctor.mjs

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
let failures = 0

const ok = (msg) => console.log(`  ✓ ${msg}`)
const warn = (msg) => console.log(`  ! ${msg}`)
const fail = (msg) => {
  failures += 1
  console.log(`  ✗ ${msg}`)
}

function version(cmd) {
  try {
    return execSync(cmd, { stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim()
  } catch {
    return null
  }
}

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.once('listening', () => srv.close(() => resolve(true)))
    srv.listen(port, '127.0.0.1')
  })
}

console.log('\nCoworker preflight check\n')

// Node
console.log('Runtime')
const nodeMajor = Number(process.versions.node.split('.')[0])
if (nodeMajor >= 20) ok(`Node ${process.versions.node}`)
else fail(`Node ${process.versions.node} found, but >= 20 is required. Install from https://nodejs.org`)

const pnpmV = version('pnpm --version')
if (pnpmV) ok(`pnpm ${pnpmV}`)
else warn('pnpm not found (needed for pnpm dev; not needed for the Docker path). Install: npm i -g pnpm')

// Docker
console.log('\nDocker')
const dockerV = version('docker --version')
if (dockerV) {
  ok(dockerV)
  const composeV = version('docker compose version')
  if (composeV) ok(composeV)
  else fail('docker compose v2 not found. Update Docker Desktop / install the compose plugin.')
  try {
    execSync('docker info', { stdio: 'ignore' })
    ok('Docker daemon is running')
  } catch {
    fail('Docker is installed but the daemon is not running. Start Docker Desktop.')
  }
} else {
  fail('Docker not found. Install Docker Desktop (https://docker.com) or run Postgres+Redis yourself.')
}

// Ports
console.log('\nPorts')
for (const [port, what] of [[3000, 'web'], [3001, 'api'], [5432, 'postgres'], [6379, 'redis']]) {
  // eslint-disable-next-line no-await-in-loop
  const free = await portFree(port)
  if (free) ok(`${port} free (${what})`)
  else warn(`${port} in use (${what}). Stop the other process, or if it is a previous Coworker run you are fine.`)
}

// Env file
console.log('\nEnvironment')
const envPath = path.join(root, '.env')
if (!existsSync(envPath)) {
  fail('.env not found. Run: cp .env.example .env')
} else {
  ok('.env exists')
  const env = readFileSync(envPath, 'utf8')
  const has = (key) => new RegExp(`^${key}=.+`, 'm').test(env)
  const llmKeys = [
    'ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'GOOGLE_API_KEY', 'GROQ_API_KEY',
    'MISTRAL_API_KEY', 'XAI_API_KEY', 'COHERE_API_KEY', 'DEEPSEEK_API_KEY',
    'TOGETHER_API_KEY', 'OPENROUTER_API_KEY', 'OLLAMA_BASE_URL',
  ]
  if (llmKeys.some(has)) ok('At least one LLM provider is configured')
  else fail(`No LLM provider configured. Set one of: ${llmKeys.join(', ')} in .env (Ollama works offline).`)
  if (has('AUTH_SECRET')) ok('AUTH_SECRET is set')
  else warn('AUTH_SECRET not set. The Docker stack falls back to a dev-only default; generate one with: openssl rand -hex 32')
}

console.log(
  failures === 0
    ? '\nAll good. Start with: docker compose --env-file .env -f infra/docker/docker-compose.oss.yml up -d --build\n'
    : `\n${failures} problem(s) found. Fix the ✗ items above and re-run.\n`
)
process.exit(failures === 0 ? 0 : 1)
