-- ============================================================
-- Migration 173 — REVOKE do GRANT de UPDATE em public.users.role (authenticated)
-- ============================================================
-- Contexto (Segurança/LGPD, OWASP A01 — defense-in-depth, camada extra à mig 171):
--   A mig 171 instalou o trigger `protect_users_privileged_columns` que barra a
--   mudança de role/is_active/seller_id por quem não tem `usuarios:edit`. Hoje,
--   porém, a coluna `role` ainda é gravável no NÍVEL DE GRANT — `authenticated`
--   tem UPDATE table-level em public.users, então o trigger é a ÚNICA barreira.
--
--   Esta migration adiciona a barreira de GRANT: REVOKE do UPDATE table-level e
--   re-concessão explícita apenas das colunas NÃO-privilegiadas. Resultado: uma
--   tentativa de auto-promoção via PATCH direto no PostgREST
--       PATCH /rest/v1/users?id=eq.<self>  { "role": "super_admin" }
--   passa a falhar com 42501 ANTES mesmo de chegar ao trigger (duas camadas).
--
-- Escopo deliberado: removemos APENAS `role` do conjunto gravável por
-- `authenticated`. `is_active` continua gravável (deactivate/reactivate são
-- feitos pelo client autenticado de um admin, ainda protegidos pelo trigger 171);
-- `name/phone/avatar_url/preferences` são o self-update de perfil; `seller_id` e
-- `email` são re-concedidos por segurança (sem writer autenticado conhecido e,
-- no caso de seller_id, ainda cobertos pelo trigger 171).
--
-- NÃO re-concedemos `id`, `created_at`, `updated_at`: nunca entram no SET de um
-- UPDATE de usuário final (o `updated_at` é setado pelo trigger `users_updated_at`,
-- e o Postgres só cobra privilégio de coluna sobre as colunas do SET, não sobre
-- as que um trigger altera).
--
-- `role` permanece gravável por service_role (endpoints change-role e criação de
-- usuário usam createAdminClient) — este REVOKE não toca service_role.
--
-- Idempotente (REVOKE/GRANT podem reexecutar sem efeito colateral).
-- Sem BEGIN/COMMIT nem NOTIFY pgrst (a esteira migrate-prod cuida da transação
-- e do reload do schema).
-- ============================================================

-- Remove o UPDATE table-level (que incluía a coluna `role`).
REVOKE UPDATE ON public.users FROM authenticated;

-- Re-concede UPDATE apenas nas colunas não-privilegiadas (deny-by-default p/ role).
GRANT UPDATE (email, name, phone, avatar_url, is_active, preferences, seller_id)
  ON public.users TO authenticated;

-- Rede de segurança: garante que o backend confiável (service_role) mantém UPDATE
-- table-level em users — é por aqui que os endpoints change-role e criação de
-- usuário gravam `role` (via createAdminClient). No prod o service_role já tem o
-- grant padrão do Supabase (no-op idempotente); explicitar aqui blinda o caminho
-- de gestão de cargo contra qualquer ambiente com grants não-padrão.
GRANT UPDATE ON public.users TO service_role;
