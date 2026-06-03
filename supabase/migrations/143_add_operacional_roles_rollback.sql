-- 143_add_operacional_roles_rollback.sql
-- Reverte a migration 143: remove os cargos operacional/operacional_eventos,
-- restaura can_view_festa_values sem operacional_eventos e os dois CHECK constraints
-- para os 11 codes originais.
-- PRE-CONDICAO: nenhum usuario em public.users com role 'operacional'/'operacional_eventos'
-- (a remocao dos codes do CHECK falharia se houvesse). Reatribua esses usuarios antes.

BEGIN;

-- 1. Remover template + catalogo (role_permissions.role_code tem FK ON DELETE CASCADE)
DELETE FROM public.role_permissions WHERE role_code IN ('operacional','operacional_eventos');
DELETE FROM public.roles            WHERE code      IN ('operacional','operacional_eventos');

-- 2. Restaurar can_view_festa_values (sem operacional_eventos)
CREATE OR REPLACE FUNCTION public.can_view_festa_values(p_user_id uuid DEFAULT auth.uid())
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = p_user_id
      AND role IN (
        'super_admin', 'diretor', 'gerente',
        'vendedora', 'pos_vendas', 'decoracao', 'financeiro'
      )
  );
$function$;
GRANT EXECUTE ON FUNCTION public.can_view_festa_values(uuid) TO authenticated, anon;

-- 3. Restaurar CHECK constraints (11 codes)
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role = ANY (ARRAY[
  'super_admin','diretor','gerente','vendedora','decoracao','manutencao',
  'financeiro','rh','freelancer','entregador','pos_vendas'
]));

ALTER TABLE public.role_default_perms DROP CONSTRAINT IF EXISTS role_default_perms_role_check;
ALTER TABLE public.role_default_perms ADD CONSTRAINT role_default_perms_role_check CHECK (role = ANY (ARRAY[
  'super_admin','diretor','gerente','vendedora','decoracao','manutencao',
  'financeiro','rh','freelancer','entregador','pos_vendas'
]));

NOTIFY pgrst, 'reload schema';

COMMIT;
