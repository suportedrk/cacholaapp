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

// Reinicia o dev server (PM2) para que NEXT_PUBLIC_APP_VERSION reflita a nova versão.
// Falha silenciosa: se o PM2 não estiver disponível (CI, máquina local), apenas avisa.
try {
  execSync('pm2 restart cachola-dev --update-env', { stdio: 'pipe' })
  console.log('   PM2 cachola-dev reiniciado — versão propagada.')
} catch {
  console.log('   (PM2 não disponível neste ambiente — restart manual se necessário.)')
}
