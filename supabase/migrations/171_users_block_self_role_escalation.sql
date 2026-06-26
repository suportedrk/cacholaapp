-- ============================================================
-- Migration 171 — Bloqueia escalada de privilégio em public.users
-- ============================================================
-- Contexto (Segurança/LGPD, OWASP A01 — Broken Access Control / escalada):
--   A RLS `users: self update` (USING/WITH CHECK = id = auth_user_id())
--   restringe a LINHA (o usuário só edita a própria), mas NÃO as COLUNAS — e o
--   role `authenticated` tem GRANT de UPDATE inclusive na coluna `role`. Logo,
--   QUALQUER usuário logado conseguia se autopromover com um PATCH direto no
--   PostgREST:
--       PATCH /rest/v1/users?id=eq.<self>  { "role": "super_admin" }
--   contornando o RBAC inteiro e a allowlist dos endpoints de gestão (PR1).
--
-- Correção: trigger BEFORE UPDATE que barra mudança das colunas privilegiadas
-- (role, is_active, seller_id) por quem NÃO tem usuarios:edit. Espelha a mesma
-- regra da policy `users: admin update`. Os endpoints de gestão (super_admin/
-- diretor, que têm usuarios:edit) continuam funcionando; o auto-PATCH de um
-- cargo comum é bloqueado com 42501.
--
-- IMPORTANTE: SECURITY INVOKER (default). Se fosse SECURITY DEFINER, current_user
-- viraria o dono da função e o guard de backend (service_role) não funcionaria.
-- check_permission é SECURITY DEFINER e resolve corretamente mesmo aqui.
--
-- Idempotente. Sem BEGIN/COMMIT nem NOTIFY pgrst (a esteira cuida).
-- ============================================================

CREATE OR REPLACE FUNCTION public.protect_users_privileged_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Só interessa quando uma coluna privilegiada muda de valor.
  IF (NEW.role      IS DISTINCT FROM OLD.role)
     OR (NEW.is_active IS DISTINCT FROM OLD.is_active)
     OR (NEW.seller_id IS DISTINCT FROM OLD.seller_id)
  THEN
    -- Backend confiável (service_role/postgres/supabase_admin etc.) passa direto:
    -- current_user só é 'authenticated'/'anon' em requisição de usuário final
    -- (PostgREST faz SET LOCAL ROLE). Para esses, exige usuarios:edit — mesma
    -- regra da policy `users: admin update`. super_admin é bypassado dentro de
    -- check_permission.
    IF current_user IN ('authenticated', 'anon')
       AND NOT public.check_permission(auth.uid(), 'usuarios', 'edit')
    THEN
      RAISE EXCEPTION
        'Alteração de cargo, status ou vínculo de vendedora exige permissão de gestão de usuários (usuarios:edit).'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_users_protect_privileged_columns ON public.users;
CREATE TRIGGER trg_users_protect_privileged_columns
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_users_privileged_columns();

COMMENT ON FUNCTION public.protect_users_privileged_columns() IS
  'Bloqueia mudança de role/is_active/seller_id em public.users por quem não tem '
  'usuarios:edit (mig 171). Fecha escalada via PATCH direto no PostgREST sobre a '
  'própria linha (a RLS self-update não restringe colunas). SECURITY INVOKER de '
  'propósito (depende de current_user). Backend (service_role) passa direto.';
