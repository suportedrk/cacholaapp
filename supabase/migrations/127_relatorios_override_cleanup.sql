-- ============================================================
-- Migration 127 — Relatórios: limpeza de overrides de cargo fora de
--                  (super_admin, diretor) em user_permissions
-- Criado em: 2026-05-30
-- Referência: docs/rbac/fase-a-dashboard-relatorios.md §6 (overrides)
--             Decisão do dono (iii-b): LIMPAR as 2 contas de gerente
--
-- Esta migration REMOVE grants de user_permissions onde
--   module='relatorios'  AND  role NOT IN ('super_admin','diretor')
--
-- Em PRODUÇÃO (auditoria 2026-05-29): atinge exatamente 6 grants:
--   brunocasaletti@gmail.com  (gerente): 5 ações (create/delete/edit/export/view)
--   brunocasaletti@hotmail.com (gerente): 1 ação (view)
--
-- Em LOCAL (seed de teste): atinge 3 grants:
--   teste.financeiro@cachola.local (financeiro): view + export
--   teste.gerente@cachola.local    (gerente):    view
--
-- NÃO TOCA:
--   - super_admin (bypass de check_permission — grants cosméticos)
--   - diretor carol@festanacachola.com.br / vinicius@festanacachola.com.br
--     (view+export — overrides honrados, decisão iii-b)
--   - role_permissions (template) — já estava correto (sa+dir)
--
-- Contexto: com a conversão do guard de /relatorios para
-- requirePermissionServer('relatorios','view') na Parte 2, os overrides
-- de gerente ACORDARIAM (grant individual > trava de cargo). A limpeza
-- evita que esses grants acidentalmente concedam acesso.
--
-- Idempotente (DELETE WHERE é no-op se já ausente).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Log: estado antes
-- ------------------------------------------------------------
DO $$
DECLARE
  v_before INT;
BEGIN
  SELECT COUNT(*) INTO v_before
  FROM public.user_permissions up
  JOIN public.users u ON u.id = up.user_id
  WHERE up.module = 'relatorios'
    AND u.role NOT IN ('super_admin','diretor');
  RAISE NOTICE 'relatorios — grants de cargo fora de (sa,diretor) ANTES: %', v_before;
END
$$;

-- ------------------------------------------------------------
-- Limpeza: remove grants de relatorios para qualquer role fora de sa/diretor
-- ------------------------------------------------------------
DELETE FROM public.user_permissions up
USING public.users u
WHERE up.user_id = u.id
  AND up.module  = 'relatorios'
  AND u.role NOT IN ('super_admin','diretor');

-- ------------------------------------------------------------
-- Pós-condição: 0 grants de relatorios para role fora de (sa, diretor)
-- ------------------------------------------------------------
DO $$
DECLARE
  v_after INT;
BEGIN
  SELECT COUNT(*) INTO v_after
  FROM public.user_permissions up
  JOIN public.users u ON u.id = up.user_id
  WHERE up.module = 'relatorios'
    AND u.role NOT IN ('super_admin','diretor');

  RAISE NOTICE 'relatorios — grants de cargo fora de (sa,diretor) APÓS: %', v_after;

  IF v_after > 0 THEN
    RAISE EXCEPTION
      'Limpeza incompleta: % grants de relatorios ainda presentes para cargos fora de (super_admin,diretor). Investigar.',
      v_after;
  END IF;

  RAISE NOTICE 'OK: relatorios sem grants de cargo fora de (super_admin,diretor).';
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
