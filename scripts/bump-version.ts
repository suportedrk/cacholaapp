import { execSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const type = process.argv[2] as 'patch' | 'minor' | 'major'
if (!['patch', 'minor', 'major'].includes(type)) {
  console.error('Uso: npx tsx scripts/bump-version.ts [patch|minor|major]')
  process.exit(1)
}

const pkgPath = resolve(process.cwd(), 'package.json')
const prev = JSON.parse(readFileSync(pkgPath, 'utf-8')).version as string

// npm version updates both package.json and package-lock.json atomically.
// --no-git-tag-version prevents npm from creating a git tag.
execSync(`npm version ${type} --no-git-tag-version`, { stdio: 'pipe' })

const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
console.log(`✅ ${pkg.name}: ${prev} → ${pkg.version}`)
console.log(`   Commit: git add package.json package-lock.json && git commit -m "chore(version): bump to ${pkg.version}"`)
