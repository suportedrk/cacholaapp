/**
 * Bump de versão semântica no package.json.
 * Uso: npm run version:patch | version:minor | version:major
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const type = process.argv[2] as 'patch' | 'minor' | 'major'
if (!['patch', 'minor', 'major'].includes(type)) {
  console.error('Uso: npx tsx scripts/bump-version.ts [patch|minor|major]')
  process.exit(1)
}

const pkgPath = resolve(process.cwd(), 'package.json')
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
const [maj, min, pat] = (pkg.version as string).split('.').map(Number)

const next =
  type === 'major' ? `${maj + 1}.0.0`
  : type === 'minor' ? `${maj}.${min + 1}.0`
  : `${maj}.${min}.${pat + 1}`

pkg.version = next
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log(`✅ ${pkg.name}: ${maj}.${min}.${pat} → ${next}`)
console.log(`   Commit: git add package.json && git commit -m "chore(version): bump to ${next}"`)
