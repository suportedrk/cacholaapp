# PostgREST e o limite implícito de rows

## Configuração atual

`PGRST_DB_MAX_ROWS=5000` (definido em `/opt/supabase/supabase/docker/.env` na VPS).

Isso é um teto **hard** aplicado pelo PostgREST a **toda** query feita via API REST do Supabase. Queries que pediriam mais que esse limite são **silenciosamente truncadas** — sem erro, sem aviso, sem log.

## Riscos

1. **Sem `ORDER BY` explícito**, o PostgREST devolve os primeiros N rows na ordem física do heap. Pode ser qualquer dado de qualquer época, sem critério de relevância.

2. **Hooks que assumem ter recebido todos os dados** quando na verdade receberam apenas uma fração silenciosa.

## Regra obrigatória

Em qualquer hook ou query que toque tabela grande (`ploomes_deals`, `ploomes_orders`, `events` e similares), **sempre** incluir:

- `.order('coluna_de_data', { ascending: false })` — garante que os dados mais recentes ficam dentro do limite
- `.limit(N)` explícito quando souber o teto razoável — defesa em profundidade

## Tabelas sensíveis ao limite

| Tabela | Volume aproximado | Crescimento |
|---|---|---|
| `ploomes_deals` | ~7.500+ rows | +50/mês |
| `ploomes_orders` | ~1.500+ rows | +20/mês |
| `events` | varia por unidade | +30/mês/unidade |

## Como aumentar o limite no futuro

```bash
# editar /opt/supabase/supabase/docker/.env, var PGRST_DB_MAX_ROWS
ssh cacholaos-vps "sed -i 's/^PGRST_DB_MAX_ROWS=.*/PGRST_DB_MAX_ROWS=10000/' /opt/supabase/supabase/docker/.env"

# recriar container PostgREST (NÃO basta restart)
ssh cacholaos-vps "cd /opt/supabase/supabase/docker && docker compose up -d --force-recreate rest"

# validar
ssh cacholaos-vps "docker inspect supabase-rest --format '{{json .Config.Env}}' | tr ',' '\n' | grep MAX_ROWS"
```

> ⚠️ `docker exec supabase-rest env` pode retornar exit code 1 mesmo com o container rodando — usar `docker inspect` conforme acima.

## Histórico

Bug descoberto em mai/2026: KPIs da home mostravam 1 lead em vez de 46 porque o hook puxava 6 meses de deals (~2.500 rows) sem `ORDER BY`, e o PostgREST com `PGRST_DB_MAX_ROWS=1000` retornava apenas os primeiros 1.000 na ordem física do heap. Apenas 6 deals de mai/2026 caíam nesse corte — desses, só 2 eram de Pinheiros e 0 eram "Cliente ainda não sabe".

Corrigido em PR #13 (v1.6.7) com fix de infra (`1000 → 5000`) + `.order('ploomes_create_date', { ascending: false }).limit(5000)` defensivos no hook `useDashboardKpis` (Q2).
