import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const CLIENT_DIRS = ['src/components', 'src/routes', 'src/lib']
const ROOT_FILES = ['README.md']
const BLOCKED_PATTERNS = [
  /SUPABASE_SERVICE_ROLE_KEY/i,
  /VITE_SUPABASE_SERVICE_ROLE_KEY/i,
  /\bservice_role\b/i,
]

function walkFiles(dir) {
  const output = []
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry)
    const stats = statSync(fullPath)
    if (stats.isDirectory()) {
      output.push(...walkFiles(fullPath))
      continue
    }
    output.push(fullPath)
  }
  return output
}

const filesToScan = [
  ...CLIENT_DIRS.flatMap((dir) => walkFiles(dir)),
  ...ROOT_FILES,
]

const violations = []

for (const filePath of filesToScan) {
  const content = readFileSync(filePath, 'utf8')
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(content)) {
      violations.push({ filePath, pattern: String(pattern) })
    }
  }
}

if (violations.length > 0) {
  console.error('Service-role exposure check failed:')
  for (const violation of violations) {
    console.error(`- ${violation.filePath} matched ${violation.pattern}`)
  }
  process.exit(1)
}

console.log('Service-role exposure check passed.')
