import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..', 'src')
const extensions = new Set(['.css', '.html', '.js', '.jsx', '.json', '.ts', '.tsx'])
const ignoredDirs = new Set(['node_modules', 'dist', 'test-results'])
const mojibakePatterns = [
  /\uFFFD/u,
  /鈥|鈩|銆|锛|锟|脳/u,
  /[鐩鏀寮鏈浣鍓涓鎴楂甯鏃绯闅骞绉婕鏍]/u,
]

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = []

  for (const entry of entries) {
    if (ignoredDirs.has(entry.name)) continue
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...await collectFiles(fullPath))
    } else if (extensions.has(path.extname(entry.name))) {
      files.push(fullPath)
    }
  }

  return files
}

const files = await collectFiles(root)
const hits = []

for (const file of files) {
  const text = await readFile(file, 'utf8')
  const lines = text.split(/\r?\n/)
  lines.forEach((line, index) => {
    if (mojibakePatterns.some((pattern) => pattern.test(line))) {
      hits.push(`${path.relative(path.resolve(import.meta.dirname, '..'), file)}:${index + 1}: ${line.trim()}`)
    }
  })
}

if (hits.length > 0) {
  console.error('Possible mojibake/encoding corruption found:')
  console.error(hits.slice(0, 40).join('\n'))
  if (hits.length > 40) console.error(`...and ${hits.length - 40} more`)
  process.exit(1)
}

