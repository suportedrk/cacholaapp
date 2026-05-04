# RBAC Drift Detection — Referência

Infraestrutura de detecção estática de role literals inline no codebase.
Parte do projeto "Fase 2B — Dívida RBAC" (PR feat/rbac-drift-detection).

---

## O que é drift de RBAC

"Drift" é qualquer role literal escrito diretamente no código de produção fora de
`src/config/roles.ts`. Exemplos:

```typescript
// ❌ Padrão A — array inline
if (!['super_admin', 'diretor'].includes(profile.role)) { ... }

// ❌ Padrão B — comparação direta
if (profile.role === 'gerente') { ... }

// ❌ Padrão C — .includes() com literal
if (SOME_ARRAY.includes('vendedora')) { ... }
```

O risco: quando uma role muda de escopo (adicionada, removida ou renomeada), o literal
inline não é encontrado pelo grep sistemático e o acesso diverge silenciosamente.

---

## Como rodar

```bash
# Verificação padrão (exit 1 se houver violações)
npm run rbac:check

# Modo relatório — lista violações mas sai 0 (útil para auditoria)
npm run rbac:check:report

# Output JSON — para integração com outras ferramentas
npx tsx scripts/check-rbac-drift.ts --json
```

Em CI, `npm run rbac:check` roda antes do TypeScript check no job `quality` de `.github/workflows/ci.yml`.
PR com drift detectado **falha o CI** e não pode ser mergeado.

---

## Padrões detectados

| Padrão | Descrição | Exemplo |
|--------|-----------|---------|
| **A** | Array inline com 1+ roles | `['super_admin', 'diretor']` |
| **B** | Comparação direta `===` / `!==` | `role === 'gerente'` |
| **C** | `.includes()` com literal de role | `arr.includes('vendedora')` |

**Arquivos excluídos do scan** (definem roles, não as consomem):
- `src/config/roles.ts`
- `src/types/permissions.ts`
- `src/types/database.types.ts`

O detector extrai os roles conhecidos dinamicamente de `src/config/roles.ts` — ao adicionar
uma nova role ao arquivo, ela passa a ser monitorada automaticamente no próximo scan.

---

## Allowlist

Arquivo: `scripts/rbac-drift-allowlist.json`

Formato de uma entrada:
```json
{
  "file": "src/app/api/exemplo/route.ts",
  "line": 42,
  "reason": "Query SQL via .eq() — não é role check TypeScript"
}
```

**Política: allowlist com mais de 3 entradas é sinal de alerta.**  
Mais que isso indica que um novo padrão surgiu que deveria virar constante em `roles.ts`,
não uma exceção suprimida.

**Critérios para aceitar uma entrada no allowlist:**
1. O match é falso positivo (string coincidente que não é role check)
2. É código SQL/OData onde constante TypeScript não se aplica (ex: `.eq('role', 'x')`)
3. É código de migração/seed/script de diagnóstico em `scripts/` — mas esse diretório já
   está fora do scan (`src/**`) então não deve precisar de allowlist

**Critérios para REJEITAR e exigir constante:**
1. Qualquer role check em `src/app/`, `src/lib/`, `src/hooks/`, `src/components/`
2. Qualquer comparação `=== 'role'` em TypeScript de produção

---

## Comportamento em CI

O step de CI falha quando:
- `npm run rbac:check` retorna exit code 1 (violações encontradas não suprimidas)

O step de CI passa quando:
- Zero violações detectadas, OU
- Todas as violações estão no allowlist com `reason` preenchido

**Não usar `--report-only` em CI** — isso mascara regressões e derrota o propósito.

---

## Estado pós-Fase 2B (v1.6.1)

Após o PR `feat/rbac-drift-detection`:
- **26 hardcodes** corrigidos (21 no Commit 1 + 5 detectados pelo smoke test do script)
- **3 constantes** criadas: `IMPERSONATION_ROLES`, `OPERATIONAL_MOBILE_ROLES`, `SYSTEM_ONLY_ROLES`
- Allowlist: **0 entradas** (começa vazia intencionalmente)
- Não incluído: `cron/ploomes-sync/route.ts` usa `.eq('role', 'super_admin')` em query SQL
  (não é role check TypeScript — tratar em PR futuro se necessário)

---

## Como adicionar nova role ao sistema

1. Adicionar ao union `Role` em `src/types/permissions.ts`
2. Adicionar à migration SQL correspondente (CHECK constraint, `role_default_perms`, etc.)
3. Criar ou atualizar constante em `src/config/roles.ts` usando:
   ```typescript
   export const MINHA_NOVA_ROLES = [
     'nova_role',
   ] as const satisfies readonly Role[]
   ```
4. O detector passa a monitorar a nova role automaticamente — zero configuração adicional

---

## Script internals

`scripts/check-rbac-drift.ts` usa:
- **`fast-glob`** (dep transitiva via Next.js) — scan de `src/**/*.{ts,tsx}`
- **Regex sobre texto limpo** — remove comentários antes de escanear (preserva numeração)
- **Extração dinâmica de roles** — lê string literals dos blocos `export const ... = [...]`
  em `roles.ts`; não hardcoda a lista de roles

O script roda via `tsx` (não compilado), mantendo dependência zero de setup extra.
