/**
 * scripts/check-rbac-drift.ts
 *
 * Detecta role literals inline que deveriam usar constantes de src/config/roles.ts.
 *
 * Padrões detectados:
 *   A — array inline com role literal(s):  ['super_admin', 'diretor']
 *   B — comparação direta === / !==:        profile.role === 'gerente'
 *   C — .includes() com role literal:       arr.includes('vendedora')
 *
 * Uso:
 *   npx tsx scripts/check-rbac-drift.ts              # sai 1 se houver violações
 *   npx tsx scripts/check-rbac-drift.ts --report-only # sai 0, apenas lista
 *   npx tsx scripts/check-rbac-drift.ts --json        # output JSON
 */

import { readFileSync, existsSync } from 'node:fs'
import { join, relative } from 'node:path'
import fg from 'fast-glob'

// ── Tipos ─────────────────────────────────────────────────────────────────

interface Violation {
  file: string
  line: number
  pattern: 'A' | 'B' | 'C'
  match: string
  description: string
}

interface AllowlistEntry {
  file: string
  line: number
  reason: string
}

interface Patterns {
  A: RegExp
  B: RegExp
  C: RegExp
  descA: string
  descB: string
  descC: string
}

// ── Configuração ──────────────────────────────────────────────────────────

const ROOT = process.cwd()
const ROLES_FILE = join(ROOT, 'src/config/roles.ts')
const ALLOWLIST_FILE = join(ROOT, 'scripts/rbac-drift-allowlist.json')

/** Arquivos que definem roles — excluídos do scan */
const EXCLUDED_FILES = new Set([
  'src/config/roles.ts',
  'src/types/permissions.ts',
  'src/types/database.types.ts',
])

// ── Extração de roles ─────────────────────────────────────────────────────

function extractKnownRoles(): string[] {
  const content = readFileSync(ROLES_FILE, 'utf-8')
  const roles = new Set<string>()

  // Captura strings dentro de cada bloco `export const FOO = [...] as const`
  for (const block of content.matchAll(/export const \w+ = \[([\s\S]*?)\] as const/g)) {
    for (const str of block[1].matchAll(/'([a-z_]+)'/g)) {
      roles.add(str[1])
    }
  }

  if (roles.size === 0) {
    throw new Error(
      `Nenhum role extraído de ${ROLES_FILE} — verifique se o arquivo segue o padrão esperado.`,
    )
  }
  return [...roles].sort()
}

// ── Remoção de comentários ────────────────────────────────────────────────

function stripComments(source: string): string {
  // Remove blocos /* ... */ preservando quebras de linha (para manter numeração)
  let out = source.replace(/\/\*[\s\S]*?\*\//g, (m) => '\n'.repeat((m.match(/\n/g) ?? []).length))
  // Remove comentários de linha // ... (preserva a quebra)
  out = out.replace(/\/\/[^\n]*/g, '')
  return out
}

// ── Allowlist ─────────────────────────────────────────────────────────────

function loadAllowlist(): AllowlistEntry[] {
  if (!existsSync(ALLOWLIST_FILE)) return []
  try {
    const raw = JSON.parse(readFileSync(ALLOWLIST_FILE, 'utf-8'))
    return (raw.exceptions as AllowlistEntry[]) ?? []
  } catch {
    process.stderr.write(`Aviso: erro ao ler allowlist em ${ALLOWLIST_FILE}\n`)
    return []
  }
}

function isAllowlisted(allowlist: AllowlistEntry[], file: string, line: number): boolean {
  return allowlist.some((e) => e.file === file && e.line === line)
}

// ── Construção dos padrões ────────────────────────────────────────────────

function buildPatterns(knownRoles: string[]): Patterns {
  const alt = knownRoles.join('|')
  const Q = `(?:'|")` // aspas simples ou duplas

  return {
    // Padrão A: array com 1+ role literals, ex.: ['super_admin', 'diretor']
    A: new RegExp(
      `\\[\\s*${Q}(?:${alt})${Q}(?:\\s*,\\s*${Q}(?:${alt})${Q})*\\s*\\]`,
      'g',
    ),
    descA: "Array inline com role(s) — usar constante exportada de '@/config/roles'",

    // Padrão B: comparação === / !== com role literal
    B: new RegExp(
      `(?:===|!==)\\s*${Q}(?:${alt})${Q}|${Q}(?:${alt})${Q}\\s*(?:===|!==)`,
      'g',
    ),
    descB: "Comparação direta com role — usar hasRole() com constante de '@/config/roles'",

    // Padrão C: .includes('role') com literal de role
    C: new RegExp(`\\.includes\\(\\s*${Q}(?:${alt})${Q}\\s*\\)`, 'g'),
    descC: ".includes() com role literal — usar hasRole() com constante de '@/config/roles'",
  }
}

// ── Scan de arquivo ───────────────────────────────────────────────────────

function scanFile(
  filePath: string,
  patterns: Patterns,
  allowlist: AllowlistEntry[],
): Violation[] {
  const relPath = relative(ROOT, filePath).replace(/\\/g, '/')
  if (EXCLUDED_FILES.has(relPath)) return []

  const source = readFileSync(filePath, 'utf-8')
  const stripped = stripComments(source)
  const lines = stripped.split('\n')

  const violations: Violation[] = []

  const checks: Array<{ key: 'A' | 'B' | 'C'; regex: RegExp; desc: string }> = [
    { key: 'A', regex: patterns.A, desc: patterns.descA },
    { key: 'B', regex: patterns.B, desc: patterns.descB },
    { key: 'C', regex: patterns.C, desc: patterns.descC },
  ]

  for (let i = 0; i < lines.length; i++) {
    const lineNum = i + 1
    const line = lines[i]

    for (const { key, regex, desc } of checks) {
      regex.lastIndex = 0
      let m: RegExpExecArray | null
      const seen = new Set<string>() // dedup matches na mesma linha

      while ((m = regex.exec(line)) !== null) {
        const matchText = m[0].trim()
        if (!seen.has(matchText)) {
          seen.add(matchText)
          if (!isAllowlisted(allowlist, relPath, lineNum)) {
            violations.push({ file: relPath, line: lineNum, pattern: key, match: matchText, description: desc })
          }
        }
        // Evitar loop infinito em match zero-length
        if (m[0].length === 0) { regex.lastIndex++; break }
      }
    }
  }

  return violations
}

// ── Main ──────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const reportOnly = args.includes('--report-only')
  const jsonOutput = args.includes('--json')

  const knownRoles = extractKnownRoles()
  const patterns = buildPatterns(knownRoles)
  const allowlist = loadAllowlist()

  const files = await fg('src/**/*.{ts,tsx}', { cwd: ROOT, absolute: true })
  const allViolations: Violation[] = []

  for (const file of files) {
    allViolations.push(...scanFile(file, patterns, allowlist))
  }

  // ── Saída ───────────────────────────────────────────────────────────────

  if (jsonOutput) {
    process.stdout.write(
      JSON.stringify({ total: allViolations.length, roles_detected: knownRoles, violations: allViolations }, null, 2) + '\n',
    )
  } else if (allViolations.length === 0) {
    process.stdout.write(`✅  RBAC drift: nenhum hardcode de role detectado. (${knownRoles.length} roles monitorados, ${files.length} arquivos escaneados)\n`)
  } else {
    process.stderr.write(`❌  RBAC drift: ${allViolations.length} violação(ões) detectada(s):\n\n`)
    for (const v of allViolations) {
      process.stderr.write(`  [Padrão ${v.pattern}] ${v.file}:${v.line}\n`)
      process.stderr.write(`             ${v.description}\n`)
      process.stderr.write(`             ↳ ${v.match}\n\n`)
    }
    if (!reportOnly) {
      process.stderr.write(`Para suprimir uma ocorrência legítima, adicione uma entrada em:\n`)
      process.stderr.write(`  ${relative(ROOT, ALLOWLIST_FILE)}\n`)
      process.stderr.write(`Política: mais de 3 entradas no allowlist é sinal de alerta.\n`)
    }
  }

  if (!reportOnly && allViolations.length > 0) process.exit(1)
}

main().catch((err: unknown) => {
  process.stderr.write(`Erro inesperado: ${err}\n`)
  process.exit(2)
})
