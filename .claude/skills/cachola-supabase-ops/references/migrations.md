# Migrations — Padrões Cachola

Toda mudança de schema do Supabase (criar tabela, adicionar coluna, criar índice, RPC, ALTER de RLS) **passa por uma migration**. Não existe "vou só rodar um SQL direto no banco" — é receita para banco de dev divergir de prod.

## Estrutura básica

### Localização
```
supabase/migrations/NNN_descritivo.sql
```

### Numeração

- **3 dígitos sequenciais** começando em `001`.
- **Próximo número** = última migration + 1. Nunca pule, nunca duplique.
- Se duas pessoas fizeram migrations em paralelo (raro neste projeto), quem chegar segundo renumera a sua.

### Nome (parte depois do número)

- `snake_case` minúsculo.
- Curto mas descritivo: o que faz, não como faz.
- Exemplos bons: `065_add_birthday_column_to_deals.sql`, `067_create_backup_log_table.sql`, `076_translate_check_permission_to_pt.sql`.
- Exemplos ruins: `065_fix.sql`, `067_changes.sql`, `068_update_v2.sql`.

## Princípio cardinal: imutabilidade pós-prod

**Migration aplicada em produção = nunca mais é editada.**

Por quê? Porque o Postgres registra em `supabase_migrations.schema_migrations` o **hash** da migration. Se você editar e tentar rodar de novo, o sistema diz "já apliquei". Resultado: dev tem schema A, prod tem schema B, e ninguém percebe até quebrar.

**Para corrigir uma migration aplicada:** criar uma NOVA migration que faz o ajuste.

```sql
-- 070_fix_typo_in_check_permission.sql

CREATE OR REPLACE FUNCTION check_permission(...) ...  -- corrige 067
```

## Anatomia de uma migration típica

```sql
-- supabase/migrations/065_add_aniversariante_birthday_to_deals.sql
-- Objetivo: adicionar campo aniversariante (data) na tabela ploomes_deals
-- para suportar Vendas Fase D — Recompra.

BEGIN;

ALTER TABLE public.ploomes_deals
  ADD COLUMN IF NOT EXISTS aniversariante_birthday DATE;

CREATE INDEX IF NOT EXISTS idx_ploomes_deals_aniversariante_birthday
  ON public.ploomes_deals (aniversariante_birthday)
  WHERE aniversariante_birthday IS NOT NULL;

COMMENT ON COLUMN public.ploomes_deals.aniversariante_birthday IS
  'Data de aniversário da criança (FieldKey deal_13506031-... no Ploomes). Usado pelo módulo Recompra para gerar leads de aniversário próximo (0-90d) e festa passada (10-13m).';

COMMIT;
```

### Boas práticas dentro do arquivo

- **`BEGIN; ... COMMIT;`** envolvendo tudo — se qualquer comando falhar, rollback.
- **`IF NOT EXISTS` / `IF EXISTS`** sempre que possível — torna a migration re-executável seguramente em ambientes que ainda não receberam.
- **Cabeçalho com objetivo** (3-5 linhas) — facilita revisão e código histórico.
- **`COMMENT ON ...`** em colunas/funções não-óbvias — banco fica auto-documentado.
- **Sem dados hardcoded com UUID gerado em dev** — use `gen_random_uuid()` ou faça por código de aplicação depois.

## Aplicando migrations

### Em dev local (Docker)

```bash
docker exec -i supabase-db psql -U postgres -d postgres < supabase/migrations/NNN_descritivo.sql
```

⚠️ **Sempre antes de `npm run build` ou `npm run dev`.** Se o build precisa de uma coluna nova e ela não existe ainda, build até passa (TS), mas runtime quebra.

### Em produção (VPS)

Migrations rodam **automaticamente** no deploy via GitHub Actions (script no `deploy.yml` aplica todas as migrations não aplicadas, em ordem). Não rodar manualmente.

Se precisar rodar manualmente em emergência:
```bash
ssh cacholaos-vps  # alias configurado
cd /opt/supabase
docker exec -i supabase-db psql -U postgres -d postgres < /caminho/para/NNN_x.sql
```

E depois fazer um commit que registra que a migration foi aplicada (mesmo que vazio, para sincronizar histórico).

## Criando RPCs (funções customizadas)

RPCs são função PL/pgSQL chamáveis via `supabase.rpc('nome', { args })`. Padrão Cachola:

```sql
-- 063_create_rpc_recompra_aniversario_proximo.sql

CREATE OR REPLACE FUNCTION public.get_recompra_aniversario_proximo(
  p_unit_id UUID,
  p_user_id UUID
)
RETURNS TABLE (
  contact_id BIGINT,
  contact_name TEXT,
  birthday DATE,
  days_until INT,
  -- ...
)
LANGUAGE plpgsql
SECURITY DEFINER  -- veja rls-policies.md sobre quando usar
SET search_path = public
AS $$
BEGIN
  -- validar permissão antes de qualquer query
  IF NOT check_permission(p_user_id, 'vendas', 'view', p_unit_id) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  RETURN QUERY
    SELECT
      d.ploomes_contact_id,
      d.contact_name,
      d.aniversariante_birthday,
      EXTRACT(DAY FROM age(
        d.aniversariante_birthday + INTERVAL '1 year',
        CURRENT_DATE
      ))::INT,
      -- ...
    FROM public.ploomes_deals d
    WHERE d.unit_id = p_unit_id
      AND d.aniversariante_birthday IS NOT NULL
      AND ...;
END;
$$;

COMMENT ON FUNCTION public.get_recompra_aniversario_proximo IS
  'Retorna leads de recompra com aniversário nos próximos 0-90 dias. Usa SECURITY DEFINER + check_permission para autorizar.';

GRANT EXECUTE ON FUNCTION public.get_recompra_aniversario_proximo TO authenticated;
```

### Pontos sensíveis em RPCs

- **`SECURITY DEFINER`** roda com permissão do *criador* (geralmente postgres) — pode burlar RLS. **Sempre validar permissão dentro da função** com `check_permission()` ou similar.
- **`SET search_path = public`** evita ataques de search_path injection.
- **`GRANT EXECUTE ... TO authenticated`** — sem isso, usuário logado não consegue chamar. (Não conceder a `anon` exceto em casos muito específicos.)
- **Tipos de retorno (`RETURNS TABLE`) não suportam `record`** com campos nullable bem — use `RETURNS SETOF tipo_concreto` quando possível.

## Helpers do Cachola já existentes

Migrations vão referenciar funções helpers já criadas. Conhecer estas economiza tempo:

| Função | O que faz | Uso |
|---|---|---|
| `is_global_viewer()` | Retorna `true` se user atual tem role com `GLOBAL_VIEWER` | Em política RLS |
| `get_user_unit_ids()` | Retorna `UUID[]` das unidades às quais o user atual tem acesso | Filtros de unidade |
| `check_permission(user_id, module, action, unit_id)` | Retorna `bool` se user tem permissão específica | RPCs, políticas RLS |
| `can_view_meeting(meeting_id)` | SECURITY DEFINER específico para Atas (evita RLS circular) | Política RLS de `meeting_minutes` |

⚠️ `is_global_viewer()` e `get_user_unit_ids()` **não recebem argumento** — pegam `auth.uid()` do contexto. Se você passar argumento, vai dar erro de signature.

## Migration que altera RLS

Adicionar/alterar política RLS é uma migration normal:

```sql
-- 071_update_rls_for_ploomes_deals_vendas.sql
BEGIN;

DROP POLICY IF EXISTS "vendas_can_view_deals" ON public.ploomes_deals;

CREATE POLICY "vendas_can_view_deals"
  ON public.ploomes_deals
  FOR SELECT
  USING (
    is_global_viewer()
    OR unit_id = ANY(get_user_unit_ids())
  );

COMMIT;
```

(Detalhes de RLS — quando usar `USING` vs `WITH CHECK`, etc. — em `rls-policies.md`.)

## Migration de seed/dados

Para popular tabela com dados estáticos (lookup tables, configs iniciais):

```sql
-- 020_seed_ploomes_unit_mapping.sql
INSERT INTO public.ploomes_unit_mapping (unit_id, ploomes_pipeline_id, ...) VALUES
  ('uuid-pinheiros', 5040123, ...),
  ('uuid-moema', 5040456, ...)
ON CONFLICT (unit_id) DO NOTHING;
```

⚠️ **Use `ON CONFLICT DO NOTHING`** para idempotência — se a migration rodar 2x, não duplica.

⚠️ **UUIDs hardcoded são problemáticos** — em prod o UUID pode ser outro. Prefira gerar UUID na criação da unidade (ainda em migration anterior) e referenciar via SELECT.

## Checklist antes de commitar nova migration

- [ ] Próximo número sequencial (não duplicado)?
- [ ] Nome em `snake_case` descritivo?
- [ ] Cabeçalho com objetivo nas primeiras linhas?
- [ ] `BEGIN; ... COMMIT;` envolvendo tudo?
- [ ] `IF NOT EXISTS` / `IF EXISTS` onde aplicável?
- [ ] Testou aplicando em dev local? (`docker exec -i supabase-db psql ...`)
- [ ] `tsc --noEmit | grep -v .next` passa? (se tipos no Supabase mudaram)
- [ ] `npm run build` passa?
- [ ] Comentários (`COMMENT ON`) em colunas/funções não-óbvias?

## Migrations notáveis no Cachola (referência histórica)

- **Mig 028:** Bloqueia login OAuth de Gmail não pré-cadastrado em `users`.
- **Mig 049:** RPCs `get_event_conflicts` + `get_pre_reserva_conflicts` (4 UNIONs server-side, substituiu lógica client-side de conflitos).
- **Mig 063:** Vendas Fase D — Recompra. Coluna `aniversariante_birthday` + RPCs de aniversário/festa passada.
- **Mig 067:** Backups via UI (`backup_log` com RLS `super_admin+diretor`).
- **Mig 076 + 077:** CASE permanente em `check_permission()` para tradução de strings de erro EN→PT-BR.

Quando criar nova migration similar a uma dessas, vale espiar como foi feito.