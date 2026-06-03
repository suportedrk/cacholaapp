-- 143_add_operacional_roles.sql
-- Objetivo: criar dois cargos operacionais dedicados.
--   operacional          -> dashboard, checklists, manutencao, atas (sem eventos; sem valores de festa)
--   operacional_eventos  -> idem + eventos (VE valores de festa)
-- Manutencao/Checklists: view+create+edit. NUNCA approve, NUNCA delete.
-- Atas: view APENAS (escritas de atas seguem role-gated por ATAS_MANAGE_ROLES; conversao
--       de escrita de Atas para check_permission fica para outra tarefa - decisao Opcao A).
-- NAO altera is_global_viewer (ambos os cargos ficam restritos por unidade).
-- can_view_festa_values: CREATE OR REPLACE com a MESMA assinatura existente em producao/local
--   -- can_view_festa_values(p_user_id uuid DEFAULT auth.uid()) -- (overload unico, sem duplicacao).
-- Aplicacao em producao: manual via docker exec apos deploy verde (deploy.yml NAO aplica migrations).

BEGIN;

-- ============================================================
-- 1. CHECK constraints: aceitar os dois codes novos
--    (apenas os dois CHECKs que enumeram cargos de usuario)
-- ============================================================
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (role = ANY (ARRAY[
  'super_admin','diretor','gerente','vendedora','decoracao','manutencao',
  'financeiro','rh','freelancer','entregador','pos_vendas',
  'operacional','operacional_eventos'
]));

ALTER TABLE public.role_default_perms DROP CONSTRAINT IF EXISTS role_default_perms_role_check;
ALTER TABLE public.role_default_perms ADD CONSTRAINT role_default_perms_role_check CHECK (role = ANY (ARRAY[
  'super_admin','diretor','gerente','vendedora','decoracao','manutencao',
  'financeiro','rh','freelancer','entregador','pos_vendas',
  'operacional','operacional_eventos'
]));
-- role_default_perms e legado e NAO e semeado aqui (apply-template le role_permissions).
-- So alinhamos o CHECK para aceitar os codes, evitando rejeicao futura.

-- ============================================================
-- 2. Catalogo roles
-- ============================================================
INSERT INTO public.roles (code, label, description, sort_order, is_active, is_system) VALUES
  ('operacional',         'Operacional',
   'Equipe operacional: Inicio, Checklist Operacional, Manutencao e Atas (visualizacao). Sem Eventos e sem valores de festa.',
   120, true, false),
  ('operacional_eventos', 'Operacional + Eventos',
   'Equipe operacional com Eventos (ve valores de festa): Inicio, Eventos, Checklist Operacional, Manutencao e Atas (visualizacao).',
   130, true, false)
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 3. Template role_permissions (apenas granted=true; padrao do projeto)
--    Atas: somente view (Opcao A). Manutencao/Checklists: view+create+edit.
--    Nenhum manutencao.approve, nenhum *.delete.
-- ============================================================
INSERT INTO public.role_permissions (role_code, module_code, action, granted) VALUES
  -- operacional (8 linhas)
  ('operacional','dashboard','view',   true),
  ('operacional','checklists','view',  true),
  ('operacional','checklists','create',true),
  ('operacional','checklists','edit',  true),
  ('operacional','manutencao','view',  true),
  ('operacional','manutencao','create',true),
  ('operacional','manutencao','edit',  true),
  ('operacional','atas','view',        true),
  -- operacional_eventos (9 linhas = as 8 acima + eventos.view)
  ('operacional_eventos','dashboard','view',   true),
  ('operacional_eventos','eventos','view',     true),
  ('operacional_eventos','checklists','view',  true),
  ('operacional_eventos','checklists','create',true),
  ('operacional_eventos','checklists','edit',  true),
  ('operacional_eventos','manutencao','view',  true),
  ('operacional_eventos','manutencao','create',true),
  ('operacional_eventos','manutencao','edit',  true),
  ('operacional_eventos','atas','view',        true)
ON CONFLICT (role_code, module_code, action) DO UPDATE SET granted = EXCLUDED.granted;

-- ============================================================
-- 4. can_view_festa_values(): incluir SO operacional_eventos
--    Assinatura IDENTICA a existente -> CREATE OR REPLACE verdadeiro (sem overload duplicado).
-- ============================================================
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
        'vendedora', 'pos_vendas', 'decoracao', 'financeiro',
        'operacional_eventos'
      )
  );
$function$;

GRANT EXECUTE ON FUNCTION public.can_view_festa_values(uuid) TO authenticated, anon;

COMMENT ON FUNCTION public.can_view_festa_values IS
  'Retorna true se o usuario pode ver valores monetarios de festa (deal_amount, etc.). '
  'Roles autorizadas: super_admin, diretor, gerente, vendedora, pos_vendas, decoracao, financeiro, operacional_eventos. '
  'Roles bloqueadas: manutencao, rh, freelancer, entregador, operacional. '
  'Frente Permissoes de Valor v1.11.0; operacional_eventos adicionado na migration 143.';

NOTIFY pgrst, 'reload schema';

COMMIT;
