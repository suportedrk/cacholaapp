# Row Level Security (RLS) — Padrões Cachola

RLS é como o Supabase **garante que cliente A não vê dados do cliente B**, mesmo que ambos rodem o mesmo SQL. É a primeira linha de defesa do banco. **Toda tabela do Cachola tem RLS ativado.**

## Conceito — em 2 minutos

Sem RLS:
```sql
-- usuário X executa via API:
SELECT * FROM events;
-- retorna TODOS os eventos do banco — usuário X vê os de outras unidades também 🚨
```

Com RLS:
```sql
-- política diz: "user só pode ver eventos cuja unit_id está na lista de unidades dele"
SELECT * FROM events;
-- retorna SÓ os eventos das unidades onde o user X tem acesso ✅
```

A política é avaliada **dentro do banco**, automaticamente, em **todo SELECT/INSERT/UPDATE/DELETE**.

## Ativando RLS

Toda tabela nova:

```sql
ALTER TABLE public.minha_tabela ENABLE ROW LEVEL SECURITY;
```

Sem isso, RLS **não está ativo** — qualquer usuário lê tudo. Já é o default em tabelas criadas pelo Supabase via UI, mas **não** em tabelas criadas via migration manual. Sempre incluir.

## Actions do Cachola

Diferente de outros projetos que usam `read/write/admin`, Cachola padroniza em **4 actions**:

| Action | Operações SQL | Uso |
|---|---|---|
| `view` | `SELECT` | Ler/listar |
| `create` | `INSERT` | Criar |
| `edit` | `UPDATE` | Editar |
| `delete` | `DELETE` | Apagar |

**Sempre use estes 4 nomes.** Em RPC, em política RLS, em código de aplicação.

## Anatomia de uma política

```sql
CREATE POLICY "<nome_descritivo>"
  ON public.<tabela>
  FOR <SELECT|INSERT|UPDATE|DELETE|ALL>
  TO <role_postgres>
  USING (<expressao_que_retorna_bool>)
  WITH CHECK (<expressao_que_retorna_bool>);
```

- **`USING`**: filtro aplicado em SELECT/UPDATE/DELETE. Linhas onde retorna `false` ficam invisíveis.
- **`WITH CHECK`**: filtro em INSERT/UPDATE — valida o que está sendo escrito. Diferente do USING (que filtra leitura).
- **`TO authenticated`**: aplica só a usuários logados. `TO anon` para anônimos. Default = `public` (tudo).

### Exemplo completo

```sql
-- Política: vendedoras só veem deals da própria unidade
CREATE POLICY "vendas_view_unit_deals"
  ON public.ploomes_deals
  FOR SELECT
  TO authenticated
  USING (
    is_global_viewer()                          -- super_admin/diretor veem tudo
    OR unit_id = ANY(get_user_unit_ids())       -- demais: só própria unidade
  );

-- Política: gerentes podem editar deals da própria unidade
CREATE POLICY "vendas_edit_unit_deals"
  ON public.ploomes_deals
  FOR UPDATE
  TO authenticated
  USING (
    check_permission(auth.uid(), 'vendas', 'edit', unit_id)
  )
  WITH CHECK (
    check_permission(auth.uid(), 'vendas', 'edit', unit_id)
  );
```

`USING` na linha velha (ela pode ser editada?), `WITH CHECK` na nova (o resultado pode ficar assim?). Repetir geralmente é o esperado.

## Helpers padronizados

Para evitar copiar-e-colar lógica de permissão em cada política, Cachola tem helpers SQL:

### `is_global_viewer()` — bool

Retorna `true` se o usuário atual (`auth.uid()`) tem role com acesso global (`super_admin`, `diretor`).

```sql
CREATE OR REPLACE FUNCTION public.is_global_viewer()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid()
      AND role IN ('super_admin', 'diretor')
  );
$$;
```

⚠️ **Não recebe argumento.** Sempre `is_global_viewer()`, nunca `is_global_viewer(some_id)`.

### `get_user_unit_ids()` — UUID[]

Retorna array de UUIDs das unidades às quais o usuário atual tem acesso.

```sql
CREATE OR REPLACE FUNCTION public.get_user_unit_ids()
RETURNS UUID[]
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT ARRAY_AGG(unit_id)
  FROM public.user_units
  WHERE user_id = auth.uid();
$$;
```

Uso em política:
```sql
USING (unit_id = ANY(get_user_unit_ids()))
```

### `check_permission(user_id, module, action, unit_id)` — bool

Helper completo de autorização. Consulta `user_permissions` para a tupla específica.

```sql
SELECT check_permission(auth.uid(), 'vendas', 'edit', '<uuid-unidade>');
-- retorna true/false
```

`user_permissions` é uma tabela com chave única `(user_id, module, action, unit_id)`.

⚠️ Se `unit_id` for `NULL`, considera permissão **global** (não atrelada a unidade — ex: `admin/users`).

### `can_view_meeting(meeting_id)` — bool

Caso especial. RLS de `meeting_minutes` referencia `meeting_participants` que referencia `meeting_minutes` de volta — **dependência circular**. Solução: SECURITY DEFINER específico.

```sql
CREATE OR REPLACE FUNCTION public.can_view_meeting(p_meeting_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER  -- importante: roda como postgres, não user
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.meeting_participants mp
    WHERE mp.meeting_id = p_meeting_id
      AND mp.user_id = auth.uid()
  )
  OR is_global_viewer();
END;
$$;
```

Política da Atas usa esse helper para evitar loop infinito de avaliação RLS:
```sql
CREATE POLICY "atas_view" ON public.meeting_minutes
  FOR SELECT USING (can_view_meeting(id));
```

## SECURITY DEFINER — quando usar

`SECURITY DEFINER` faz a função rodar com permissão de **quem criou** (geralmente `postgres` ou `service_role`), **bypassando RLS** das tabelas internamente.

**Quando usar:**
- ✅ Helpers de RLS que precisam ler tabela protegida (ex: `get_user_unit_ids` lê `user_units`).
- ✅ RPCs que executam lógica complexa para vários usuários (ex: cálculos de KPI agregando muitas unidades).
- ✅ Resolver dependência circular de RLS (caso `can_view_meeting`).

**Cuidados:**
- ⚠️ `SECURITY DEFINER` **bypassa RLS dentro da função**. Toda autorização vira **manual** dentro do código.
- ⚠️ **Sempre `SET search_path = public`** — evita injection via search_path.
- ⚠️ **Validar permissão explicitamente** dentro da função com `check_permission()` antes de retornar dados.

```sql
-- ✅ Padrão seguro
CREATE FUNCTION public.minha_rpc(p_unit_id UUID)
RETURNS TABLE (...)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT check_permission(auth.uid(), 'modulo', 'view', p_unit_id) THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  RETURN QUERY SELECT ...;
END;
$$;
```

## Política para múltiplas operações

Em vez de criar 4 políticas (uma por action), pode usar `FOR ALL`:

```sql
CREATE POLICY "admin_all"
  ON public.users
  FOR ALL
  TO authenticated
  USING (is_global_viewer())
  WITH CHECK (is_global_viewer());
```

Mas **não recomendado para tabelas com lógicas distintas por action**. No Cachola, prefere-se 1 política por action — fica explícito.

## Anti-padrões comuns

### ❌ Esquecer `ENABLE ROW LEVEL SECURITY`

```sql
CREATE TABLE foo (...);
CREATE POLICY ... ON foo ...;
-- esqueceu ALTER TABLE foo ENABLE ROW LEVEL SECURITY;
-- A POLÍTICA NÃO ESTÁ APLICADA. Tabela aberta.
```

### ❌ Política sem `TO authenticated`

```sql
CREATE POLICY "X" ON foo FOR SELECT USING (true);
-- Default TO public = aplica também a 'anon' (não logado)
```

Pode ser intencional (tabela pública), mas geralmente é descuido. Sempre especifique.

### ❌ `USING` sem considerar UPDATE

```sql
CREATE POLICY "edit" FOR UPDATE USING (auth.uid() = owner_id);
-- Sem WITH CHECK — usuário pode UPDATE owner_id para outro user e a linha "muda de dono"
```

Sempre incluir `WITH CHECK` em UPDATE.

### ❌ Recursão circular não-tratada

Política A consulta tabela B; tabela B consulta tabela A. Ambas com RLS → loop. Solução: `SECURITY DEFINER` em uma das funções helper (caso `can_view_meeting`).

### ❌ `service_role` em código que usuário pode acionar diretamente

`service_role` bypassa RLS. Usar em código que recebe input não-sanitizado = volta a estaca zero.

**Regra:** `service_role` (via `createAdminClient`) só em API Routes que tem `requireRoleApi` antes.

## Testando RLS

### Local em dev

```sql
-- Simular usuário X
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"<uuid-do-user>"}';

SELECT * FROM ploomes_deals;
-- Vai retornar só o que esse user vê
```

### Em produção

Não testar com dados reais — criar usuário de teste por role, em ambiente de staging.

## Checklist nova tabela

- [ ] `ALTER TABLE x ENABLE ROW LEVEL SECURITY;`?
- [ ] Política para SELECT (`view`)?
- [ ] Política para INSERT (`create`)?
- [ ] Política para UPDATE (`edit`) com `USING` E `WITH CHECK`?
- [ ] Política para DELETE (`delete`)?
- [ ] Cada política tem `TO authenticated` (ou justificativa para outro role)?
- [ ] Usa helpers (`is_global_viewer`, `get_user_unit_ids`, `check_permission`) em vez de SQL inline?
- [ ] Testou com 2 usuários diferentes (1 super_admin, 1 user comum)?