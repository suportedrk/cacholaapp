# Convenções de Trabalho com Claude Code — Cachola

Esta referência é "meta": cobre **como Bruno trabalha com o Claude Code**, padrões de prompt, regras de leitura de arquivos grandes, e workflow de dev local. Não é sobre o código do Cachola em si — é sobre o **processo**.

## Bruno é dono de produto, não programador

Implicações práticas que Claude Code precisa internalizar:

- **Explicar como se ele tivesse 15 anos** — sem jargão desnecessário, com analogias quando útil.
- **Sempre em português brasileiro.**
- **Mostrar o "porquê" antes do "como"** — Bruno toma decisões de produto, então precisa entender o trade-off antes de aprovar a implementação.
- **Não despejar 200 linhas de código sem contexto** — primeiro um plano, depois aprovação, depois execução.

## Formato de prompts gerados para o Claude Code

Quando Bruno precisa rodar algo no Claude Code, ele copia um prompt **inteiramente formatado em texto puro dentro de um único bloco de código** (triple backticks). Sem markdown decorativo dentro.

### ✅ Formato certo

```
texto-do-prompt-aqui-em-uma-linha

Outra parte do prompt em outra linha.

Comandos:
git status
git diff

NAO faca commit ainda. Aguarde aprovacao.
```

### ❌ Formato errado

```
**Etapa 1:** Validar branch

- [ ] Verificar `git status`
- [ ] Confirmar working tree limpo

> ⚠️ ATENÇÃO: não commite ainda
```

Prompts com markdown (negrito, listas, headers, blockquotes) **quebram quando Bruno cola no Claude Code** — alguns clientes interpretam, outros não, e o resultado fica visualmente desconfortável e propenso a copy-paste mutilando algum trecho.

### Regras do prompt-em-bloco

1. **Texto plano.** Sem `*`, `-`, `>`, `#` no início de linha (a menos que faça parte de comando).
2. **Sem caracteres acentuados ambíguos.** Use `aprovacao` em vez de `aprovação` se for em comando — bash em Windows às vezes engasga.
3. **Comandos em linhas separadas**, sem prefixo `$`.
4. **Instrução de aguardar** sempre clara: `NAO commite. Aguarde aprovacao.`
5. **Análise/comentário do Claude (este, não Code) vai FORA do bloco**, antes ou depois.

### Exemplo de fluxo completo (para Bruno)

```
Estamos no branch develop. Preciso adicionar [X].

ANTES DE EDITAR:
1. Mostrar estado atual (git status)
2. Listar arquivos que serao modificados
3. Apresentar plano em P0, P1, P2

NAO modifique nada. Aguarde minha aprovacao.
```

Bruno cola, Claude Code responde com plano, Bruno aprova com:

```
Aprovado P0, P1. Pular P2 por enquanto.
Execute P0 e P1 e mostre git diff. NAO commite ainda.
```

E assim por diante até o commit final + push.

## Workflow Git padrão

### Branches
- `main` — produção (VPS Hostinger).
- `develop` — homologação / testes.
- **Trabalho diário sempre no `develop`**. Nunca commit direto em `main`.

### Fluxo de uma feature

1. Claude Code parte de `develop` (já checa antes de começar).
2. Implementa, testa local.
3. **Antes de commit:** `tsc --noEmit | grep -v .next` para garantir typecheck.
4. Commit no `develop` com mensagem clara (formato `feat(modulo): ...`).
5. Push para `origin/develop`.
6. Bruno valida em homologação.
7. Quando estável → PR `develop` → `main` (ou merge direto, dependendo do projeto).
8. **Após merge para main:** `git checkout develop && git merge origin/main && git push origin develop` (sincronizar para evitar develop ficar N commits atrás).

### Anti-patterns Git

- ❌ Commit direto em `main`.
- ❌ Merge com CI vermelho (red checks).
- ❌ Force push em main ou develop.
- ❌ Esquecer de sincronizar develop após merge para main.
- ❌ Commitar sem rodar `tsc --noEmit` antes.
- ❌ Trocar `npm install` por `npm ci` em commit (lockfile drift).

## Leitura de arquivos grandes — regras

Alguns arquivos do projeto são GRANDES e **não devem ser lidos integralmente** pelo Claude Code (consome contexto e devolve menos espaço para o trabalho real).

### Arquivos a NÃO ler integralmente

| Arquivo | Tamanho | Como ler |
|---|---|---|
| `CLAUDE.md` | ~XXX linhas | `grep -n "<termo>"` + `view` com `view_range=[X, Y]` |
| `DESIGN_SYSTEM_CLAUDE_CODE.md` | 1.097 linhas | Idem — buscar seção, ler intervalo |
| `ploomesapi.md` | 8.634 linhas | **NUNCA LER**. Usar skill `ploomes-cachola-api`. |

### Padrão de busca

```bash
# 1. Localizar a seção
grep -n "deploy.yml" CLAUDE.md

# 2. Ver linhas específicas (ex: 234 a 280)
view CLAUDE.md --view_range [234, 280]
```

### `CLAUDE.md` — edição

`CLAUDE.md` cresce. Edição **sempre** cirúrgica via `str_replace`, **nunca** rewrite completo. Se precisar reorganizar muita coisa, fazer em PR específico para reestruturação, separado de adições de conteúdo.

## Dev local — Cachola

### Stack local
- **Next.js**: roda **nativo no Windows** (`npm run dev` direto).
- **Supabase**: Docker, com Kong na porta 8000.
- **Não** rodar Next.js dentro de Docker em dev — perde HMR e tempo de build.

### Seeds para testar

- Admin local: `npx tsx scripts/seed-local-admin.ts` cria `bruno.casaletti@grupodrk.com.br` (admin local).
- 7 usuários de teste (1 por role): `npx tsx scripts/seed-test-users.ts`
  - Padrão: `teste.<role>@cachola.local`
  - Senha: `LocalTeste2026!`
  - Senha alternativa do seed prod: `Teste@2026cacholaos!`
- Limpeza: `npx tsx scripts/cleanup-test-users.ts`

### Variáveis ENV de dev local

Em `.env.local`:
```
NEXT_PUBLIC_SUPABASE_URL=http://localhost:8000
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key-local>
SUPABASE_SERVICE_ROLE_KEY=<service-role-local>
GLOBAL_S3_BUCKET=stub
```

`GLOBAL_S3_BUCKET=stub` é obrigatório em dev — sem ele, código que tenta inicializar S3 client trava.

### Migrations em dev

```bash
docker exec -i supabase-db psql -U postgres < supabase/migrations/NNN_descricao.sql
```

Sempre **antes** de `npm run build` ou `npm run dev` para evitar erro de tabela ausente.

## Versionamento

- **Bump de versão**: `npm run version:patch` (atualiza `package.json` e `package-lock.json` juntos).
- **Não fazer manualmente** o bump — sai dessincronizado.
- Padrão semver: `1.5.X` para fixes, `1.X.0` para features, `X.0.0` para break.

## Idioma e tom

- **Sempre português brasileiro.**
- **Sem jargão desnecessário.** "Cardinalidade" → "quantos itens". "Idempotência" → "se rodar 2x, não faz dobrado".
- **Analogia útil**: "isso é como X no mundo real" se ajudar Bruno a visualizar.
- **Confirmação explícita antes de ação destrutiva**. "Vou deletar 12 arquivos. Confirma?" — não execute sozinho.

## Padrão de planos numerados

Quando Claude Code apresenta um plano de trabalho, usa numeração `P0, P1, P2`:

```
P0 (bloqueante): validar working tree limpo
P1: criar pasta .claude/skills/cachola-stack/
P2: gerar arquivos
P3: rodar tsc --noEmit
P4: commit + push
```

Bruno aprova etapa por etapa ou em bloco ("aprovado P0 a P3, segura P4 pra revisar diff").

## Quando pedir mais contexto vs. quando assumir

- **Pedir mais contexto** quando: a tarefa toca arquivo crítico (`CLAUDE.md`, migrations, `proxy.ts`, `package.json`), envolve múltiplos módulos, ou a instrução é ambígua.
- **Assumir e seguir** quando: tarefa pequena e localizada, padrão já estabelecido na skill/CLAUDE, e Bruno deu instrução clara.

Em dúvida, sempre pedir.
