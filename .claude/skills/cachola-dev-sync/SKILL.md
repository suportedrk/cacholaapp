---
name: cachola-dev-sync
description: Verificar sincronia entre ambiente local (git, package.json, banco Docker, dev server) e a base de código compartilhada (origin/main, origin/develop) ANTES de qualquer trabalho de implementação no repo cacholaapp. Use SEMPRE no início de prompts de feature, fix, refactor ou qualquer alteração de código — mesmo que Bruno não mencione "sync", "drift" ou "atualizar". Detecta os 4 padrões de drift conhecidos no projeto Cachola OS — (1) branch local atrás de origin/main, (2) versão do package.json desatualizada vs main, (3) migrations no repo não aplicadas no Docker local, (4) dev server iniciado antes do último git pull (causa variáveis NEXT_PUBLIC_* "carimbadas" desatualizadas no bundle). Bloqueia o trabalho com instruções de ressincronização explícitas se qualquer check falhar. Esta skill é mandatória — pular ela quando o usuário pede "comece a trabalhar em X" é a causa-raiz documentada de bugs de validação no projeto.
---

# Cachola Dev Sync — Pre-flight check obrigatório

> **Esta skill bloqueia o trabalho se o ambiente local não estiver alinhado com produção.**
> Rode os 4 checks ANTES de criar branch, fazer commit, gerar plano de implementação ou qualquer outra ação que dependa de o ambiente local refletir a realidade de `origin/main`.

> **Nota de ambiente (jun/2026):** o "ambiente local" / "Docker local" desta skill agora é a **VPS de dev** (não mais o Windows do Bruno). Os comandos rodam na VPS; o dev server é gerido pelo PM2 (processo `cachola-dev`).

> **Backlog de dívidas técnicas:** consultar `docs/DIVIDAS_TECNICAS.md` no início das tarefas; surfar itens relacionados à área mexida e oferecer resolver junto (nunca resolver sem aprovação). Mover resolvidos para a seção Resolvidas com data e versão.

---

## Quando usar

**SEMPRE** — antes de:
- Criar nova branch (`git checkout -b ...`)
- Iniciar plano de implementação de feature/fix/refactor
- Fazer commit em branch existente que ficou parada >24h
- Validar visualmente uma correção no ambiente local
- Qualquer prompt em que Bruno peça "comece a trabalhar em X"

**NÃO usar** quando:
- O trabalho é apenas leitura (diagnóstico sem alteração)
- Bruno explicitamente pede para pular checks ("vou correr o risco, segue direto")

---

## Filosofia

Drift acontece de forma silenciosa e barata-de-prevenir, cara-de-recuperar. O custo de rodar os 4 checks é ~10 segundos. O custo de descobrir drift no meio de uma validação é: refazer prompts, recriar branches, re-explicar contexto, retrabalho.

A heurística é simples:
- **Se algum check falhar → BLOQUEIE o trabalho**, mostre ao Bruno o que está dessincronizado, e proponha o comando exato de correção.
- **Se todos passarem → reporte "✅ Sync ok"** em uma linha e prossiga.

Nunca prossiga "torcendo pra dar certo" se um check falhar.

---

## Os 4 checks

### Check 1 — Git: branch local em dia com origin/main

**O que verificamos:** Se a branch atual está atrás de `origin/main` (versão deployada em produção), e se `origin/develop` está alinhada com `origin/main`.

**Comandos:**

```bash
git fetch origin --quiet

CURRENT_BRANCH=$(git branch --show-current)
BEHIND_MAIN=$(git rev-list --count HEAD..origin/main)
DEV_BEHIND_MAIN=$(git rev-list --count origin/develop..origin/main)
DEV_AHEAD_MAIN=$(git rev-list --count origin/main..origin/develop)

echo "Branch atual: $CURRENT_BRANCH"
echo "Commits que origin/main tem e HEAD não tem: $BEHIND_MAIN"
echo "Commits que origin/main tem e origin/develop não tem: $DEV_BEHIND_MAIN"
echo "Commits que origin/develop tem e origin/main não tem: $DEV_AHEAD_MAIN"
```

**Critério de aprovação:**

| Condição | Resultado |
|---|---|
| `BEHIND_MAIN == 0` E `DEV_BEHIND_MAIN == 0` | ✅ Sync ok |
| `BEHIND_MAIN > 0` (branch atrás de main) | ❌ Drift — branch precisa de rebase/merge |
| `DEV_BEHIND_MAIN > 0` (develop atrás de main) | ❌ Drift — develop precisa de ressincronização |

**Correção sugerida quando falhar:**

```bash
# Se a branch atual está atrás de main:
git pull --rebase origin main
# OU (se preferir merge ao invés de rebase):
git merge origin/main --no-edit

# Se origin/develop está atrás de origin/main (caso clássico após hotfix em main):
git checkout develop
git pull origin develop
git merge origin/main --no-edit
git push origin develop
```

---

### Check 2 — Versão do package.json alinhada com main

**O que verificamos:** Se o `version` do `package.json` local é igual ao de `origin/main`. Detecta o caso em que alguém fez bump de versão em outra branch que já foi mergeada em main, mas a branch atual está com versão antiga.

**Comandos:**

```bash
LOCAL_VER=$(grep '"version"' package.json | head -1 | sed -E 's/.*"version": *"([^"]+)".*/\1/')
MAIN_VER=$(git show origin/main:package.json | grep '"version"' | head -1 | sed -E 's/.*"version": *"([^"]+)".*/\1/')
DEV_VER=$(git show origin/develop:package.json | grep '"version"' | head -1 | sed -E 's/.*"version": *"([^"]+)".*/\1/')

echo "Versão local: $LOCAL_VER"
echo "Versão origin/main: $MAIN_VER"
echo "Versão origin/develop: $DEV_VER"
```

**Critério de aprovação:**

| Condição | Resultado |
|---|---|
| `LOCAL_VER == MAIN_VER` (e branch atual = develop ou main) | ✅ Sync ok |
| `LOCAL_VER` é uma versão "futura" de `MAIN_VER` (ex: branch fix com bump já feito) | ✅ Sync ok — branch está à frente intencionalmente |
| `LOCAL_VER < MAIN_VER` | ❌ Drift — ambiente local em versão antiga |
| `MAIN_VER != DEV_VER` | ⚠️ Aviso — develop e main divergem, mencione mas não bloqueie |

---

### Check 3 — Migrations no Docker local em dia com o repo

**O que verificamos:** Se todas as migrations presentes em `supabase/migrations/` estão aplicadas no banco Docker local. Caso o banco self-hosted não tenha tabela de tracking (`supabase_migrations.schema_migrations`), use probing por colunas-chave da última migration.

**Comandos:**

```bash
# Contar migrations no repo
REPO_MIGS=$(ls supabase/migrations/*.sql 2>/dev/null | wc -l)
LATEST_MIG_FILE=$(ls supabase/migrations/*.sql 2>/dev/null | tail -1 | xargs basename)
echo "Migrations no repo: $REPO_MIGS"
echo "Última migration: $LATEST_MIG_FILE"

# Probing: verificar se a última migration está aplicada
# (adapte a coluna abaixo conforme a última migration do projeto)
# Exemplo para migration 090 (chosen_unit_id em ploomes_orders):
docker exec -i cacholaos-db psql -U postgres -d postgres -c \
  "SELECT column_name FROM information_schema.columns
   WHERE table_name='ploomes_orders' AND column_name='chosen_unit_id';"
```

> ⚠️ **Container Docker local:** o container PostgreSQL do projeto é `cacholaos-db` (não `supabase-db`).
> Confirme com `docker ps` se houver dúvida.

**Critério de aprovação:**

| Condição | Resultado |
|---|---|
| Última migration aplicada (probing retorna a coluna esperada) | ✅ Sync ok |
| Probing retorna vazio | ❌ Drift — migrations atrasadas |

**Correção sugerida quando falhar:**

```bash
# Aplicar migrations pendentes (manualmente, uma por uma, em ordem):
for f in supabase/migrations/*.sql; do
  echo "Aplicando $f..."
  docker exec -i cacholaos-db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < "$f"
done

# Reiniciar PostgREST para recarregar schema cache:
docker exec -i cacholaos-db psql -U postgres -d postgres -c "NOTIFY pgrst, 'reload schema';"
```

> ⚠️ Aplicar migrations em ordem manual é arriscado em produção. Em **desenvolvimento local**, é aceitável. Em produção, sempre via deploy.yml + step de migration controlado.

---

### Check 4 — Dev server (PM2) reiniciado após último git pull

**O que verificamos:** Se o processo PM2 `cachola-dev` foi reiniciado **depois** da última modificação do `package.json`. `NEXT_PUBLIC_APP_VERSION` é "carimbada" no startup do dev server; sintoma de drift: rodapé da app mostra versão antiga mesmo após `git pull`.

**Comando (na VPS de dev):**

```bash
# Início do processo PM2 cachola-dev (epoch em segundos)
PM2_START_S=$(pm2 jlist | python3 -c "import sys,json;d=json.load(sys.stdin);p=[x for x in d if x['name']=='cachola-dev'];print(int(p[0]['pm2_env']['pm_uptime']/1000) if p else 0)")
PKG_MTIME_EPOCH=$(stat -c %Y package.json)

if [ "$PM2_START_S" -eq 0 ]; then
  echo "ℹ️  cachola-dev não está rodando no PM2 — check 4 não aplicável"
elif [ "$PKG_MTIME_EPOCH" -gt "$PM2_START_S" ]; then
  echo "❌ Drift — cachola-dev iniciou ANTES da última modificação do package.json"
else
  echo "✅ Sync ok — cachola-dev reiniciado após o último pull"
fi
```

**Critério de aprovação:**

| Condição | Resultado |
|---|---|
| `cachola-dev` não está rodando no PM2 | ℹ️ N/A — pular check |
| `mtime(package.json) <= início do cachola-dev` | ✅ Sync ok |
| `mtime(package.json) > início do cachola-dev` | ❌ Drift — env vars stale |

**Correção sugerida quando falhar:**

```bash
pm2 restart cachola-dev --update-env
```

---

## Relatório padrão

Ao fim dos 4 checks, devolva ao Bruno este formato:

```
🛫 Pre-flight cachola-dev-sync

Check 1 — Git drift               : ✅ Sync ok
Check 2 — Versão package.json     : ✅ v1.9.2 alinhada com origin/main
Check 3 — Migrations Docker local : ✅ 90 migrations, última (090) aplicada
Check 4 — Dev server reiniciado   : ✅ iniciado após último pull

Veredicto: prosseguir com o trabalho.
```

Ou, em caso de falha:

```
🛫 Pre-flight cachola-dev-sync

Check 1 — Git drift               : ❌ HEAD está 3 commits atrás de origin/main
Check 2 — Versão package.json     : ❌ Local v1.9.0 < origin/main v1.9.2
Check 3 — Migrations Docker local : ✅ todas aplicadas
Check 4 — Dev server reiniciado   : N/A (não rodando)

Veredicto: BLOQUEAR. Ressincronização necessária antes de prosseguir.

Comandos para correção:
  git pull --rebase origin main
  grep '"version"' package.json  # confirmar bump após pull
```

---

## Casos especiais

### Bruno trabalhando em branch fix/ ou feature/

Se a branch atual é uma feature/fix derivada de `develop` ou `main`, o Check 1 deve aceitar que a branch esteja **à frente** de `origin/main` (commits próprios da feature). O que NÃO pode é estar **atrás** — isso indica que a branch foi criada de um ponto desatualizado.

### Branch nova ainda não pushed

Se a branch local não tem upstream (`git rev-parse --abbrev-ref --symbolic-full-name @{u}` falha), o Check 1 só valida contra `origin/main`. Aceitável.

### Dev local não está rodando

Check 4 vira N/A. Não bloqueia. Apenas anote no relatório.

### Bruno está em modo "investigação" (só leitura)

Pular esta skill. Drift não afeta diagnóstico passivo. Mas anote no início da resposta: "Skill cachola-dev-sync pulada — modo investigação."

---

## Histórico — por que esta skill existe

Em 12 de maio de 2026, durante a correção do bug "Carregar mais + contador em /eventos com filtros exclusivos" (PR #25, v1.9.2), o ambiente local do Bruno mostrou versão antiga no rodapé (v1.8.0) mesmo após o código estar em v1.9.1 e todas as migrations aplicadas. A causa-raiz foi a variável `NEXT_PUBLIC_APP_VERSION` carimbada no processo Node iniciado quando o repo ainda estava em v1.8.0 — o Turbopack fez hot-reload dos componentes mas não relançou o processo. Diagnóstico inicial culpou drift de git incorretamente. Esta skill formaliza os 4 checks que teriam pego o problema em ~10 segundos.

Lições codificadas aqui:
- Comparar versão local vs origin/main antes de qualquer trabalho
- Não confiar no rodapé/UI até confirmar que o dev server foi reiniciado pós-pull
- Develop precisa ser ressincronizado com main após cada deploy
- Hipóteses sobre "drift" devem ser ordenadas por custo (env var stale > cache > git drift)

---

## Política de Sincronização de Três Pontas

> Esta política garante que diagnósticos e implementações nunca sejam feitos sobre código defasado, independentemente de qual "ponta" está sendo lida.

### As três pontas

| Ponta | Localização | Papel |
|---|---|---|
| **Origem** | GitHub (`origin/main`, `origin/develop`) | Fonte única de verdade — sempre autoritativa |
| **Dev** | VPS de dev (`~/cacholaos`, branch `develop`) | Onde o código é editado e commitado; deve sempre refletir `origin/develop` |
| **Local** | Máquina Windows do Bruno (`C:\Users\bruno\Documents\Projetos\cacholaos`) | Espelho read-only para leitura e VS Code Remote-SSH; **NUNCA é fonte de verdade** |

### Regra fundamental: GitHub é a fonte única de verdade

O working tree local do Windows do Bruno **pode estar atrás** do GitHub em qualquer momento — ele é atualizado manualmente. Por isso:

- **Nunca ler arquivo cru do disco local para diagnóstico.** Sempre usar `git show origin/<branch>:<caminho>` para inspecionar o estado autoritativo de qualquer arquivo.
- **Antes de qualquer leitura de código para diagnóstico**, rodar `git fetch origin` para garantir que os refs remotos estão atualizados.

```bash
# Ler o estado autoritativo de um arquivo — CORRETO
git fetch origin --quiet
git show origin/develop:src/hooks/use-dashboard.ts

# Ler o arquivo do disco — PODE ESTAR DEFASADO, só confiável se o pull foi feito agora
cat src/hooks/use-dashboard.ts
```

### Sincronizar a cópia local no início de cada sessão

A cópia local (Windows) é um espelho read-only — sem commits locais, apenas para navegar no código. Por isso `--ff-only` é seguro e garante que não há divergência local acidental.

```powershell
# PowerShell — rodar no início de cada sessão de trabalho
cd C:\Users\bruno\Documents\Projetos\cacholaos
git fetch --all --prune
git checkout develop
git pull --ff-only
```

Se `git pull --ff-only` falhar (erro "Not possible to fast-forward"), significa que há commits locais não esperados — investigar antes de forçar qualquer coisa. O script `scripts/sync-local.ps1` automatiza esses passos com saída legível.

### Relação develop x main — divergência saudável vs. drift problemático

É **normal e saudável** `develop` estar alguns commits à frente de `main` entre releases — isso representa trabalho em andamento ainda não deployado. **Não forçar identidade permanente** entre as duas branches.

| Situação | Classificação | Ação |
|---|---|---|
| `develop` N commits à frente de `main` (trabalho em andamento) | ✅ Normal | Nenhuma — aguardar próximo release |
| `develop` atrás de `main` (hotfix foi para main sem resync) | ❌ Drift problemático | `git merge origin/main --no-edit` em develop + push |
| Local atrás de `develop` | ⚠️ Espelho desatualizado | `git pull --ff-only` na máquina local |

Após cada deploy/release, resincronizar `develop ← main` para absorver o commit de merge `--no-ff`:
```bash
git checkout develop && git merge origin/main --no-edit && git push origin develop
```

---

## Atualização da última migration de referência

A skill faz probing da última migration conhecida (atualmente migration 090, coluna `chosen_unit_id` em `ploomes_orders`). Quando uma nova migration for adicionada ao projeto, atualize o snippet do Check 3 com a nova coluna/tabela de referência.

**Estado atual (12/mai/2026):**
- Última migration: `090_pre_reserva_chosen_unit.sql`
- Container Docker: `cacholaos-db`
- Probing: `SELECT column_name FROM information_schema.columns WHERE table_name='ploomes_orders' AND column_name='chosen_unit_id';`
