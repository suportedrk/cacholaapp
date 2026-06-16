-- ============================================================
-- Migration 158 — RBAC: remover delete do cargo manutencao
-- Criado em: 2026-06-16
--
-- Contexto: ao liberar o módulo de Manutenção (remoção do "Em breve"),
-- o cargo manutencao (técnico) passa a operar de fato. Decisão do dono:
-- o técnico NÃO deve poder deletar registros nos módulos 'equipamentos'
-- e 'manutencao' — exclusão é responsabilidade de gestão
-- (super_admin / diretor / gerente).
--
-- Estado pré-158 em role_permissions (template, fonte de verdade lida por
-- applyRoleTemplate):
--   (manutencao, equipamentos, delete) = true   [concedido na migration 108]
--   (manutencao, manutencao,   delete) = AUSENTE [ausência == sem permissão]
--
-- ESCOPO desta migration:
--   1) Template: garantir granted=false para as DUAS linhas de delete
--      (equipamentos e manutencao) do cargo manutencao em role_permissions.
--   2) Reconciliar user_permissions: applyRoleTemplate é UPSERT puro (não
--      deleta), então removemos EXPLICITAMENTE as linhas de delete já
--      propagadas a usuários do cargo manutencao. Escopo cirúrgico:
--      somente role='manutencao', somente action='delete', somente os
--      módulos 'equipamentos' e 'manutencao'. NÃO toca em super_admin,
--      diretor, gerente, operacional, operacional_eventos, grants
--      individuais de outros usuários, nem na conta protegida
--      bruno.casaletti@grupodrk.com.br.
--
-- NÃO toca em RLS, NÃO toca em código de aplicação.
-- Idempotente (ON CONFLICT DO UPDATE + DELETE escopado).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Pré-condição: permission_controls precisa ter a ação 'delete'
-- para os dois módulos (FK de role_permissions exige).
-- ------------------------------------------------------------
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.permission_controls
  WHERE module_code IN ('manutencao', 'equipamentos')
    AND code = 'delete';

  IF v_count <> 2 THEN
    RAISE EXCEPTION
      'Abortando: esperava 2 controles delete (manutencao + equipamentos) em permission_controls, encontrei %.',
      v_count;
  END IF;
END
$$;

-- ------------------------------------------------------------
-- 1) Template: revoga delete do cargo manutencao nos dois módulos.
--    equipamentos.delete já existe (=true) → UPDATE para false.
--    manutencao.delete não existe → INSERT explícito de false, para que
--    applyRoleTemplate propague granted=false ativamente (UPSERT puro
--    nunca toca linhas ausentes do template).
-- ------------------------------------------------------------
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('manutencao', 'equipamentos', 'delete', false),
  ('manutencao', 'manutencao',   'delete', false)
ON CONFLICT (role_code, module_code, action) DO UPDATE
  SET granted = EXCLUDED.granted,
      updated_at = now();

-- ------------------------------------------------------------
-- 2) Reconciliação cirúrgica de user_permissions.
--    Remove as linhas de delete (equipamentos/manutencao) já propagadas
--    a usuários cujo cargo é manutencao. Conta as linhas removidas.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_users   INT;
  v_deleted INT;
BEGIN
  SELECT COUNT(DISTINCT up.user_id) INTO v_users
  FROM public.user_permissions up
  JOIN public.users u ON u.id = up.user_id
  WHERE u.role = 'manutencao'
    AND u.email <> 'bruno.casaletti@grupodrk.com.br'
    AND up.module IN ('manutencao', 'equipamentos')
    AND up.action = 'delete';

  DELETE FROM public.user_permissions up
  USING public.users u
  WHERE up.user_id = u.id
    AND u.role = 'manutencao'
    AND u.email <> 'bruno.casaletti@grupodrk.com.br'
    AND up.module IN ('manutencao', 'equipamentos')
    AND up.action = 'delete';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  RAISE NOTICE 'Reconciliação 158: % usuário(s) cargo=manutencao afetado(s), % linha(s) de delete removida(s) (modulos equipamentos+manutencao).',
    v_users, v_deleted;
END
$$;

-- ------------------------------------------------------------
-- Validação pós-condição.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_granted_template INT;
  v_remaining_up     INT;
BEGIN
  -- Template: nenhuma das duas linhas pode estar granted=true.
  SELECT COUNT(*) INTO v_granted_template
  FROM public.role_permissions
  WHERE role_code = 'manutencao'
    AND module_code IN ('manutencao', 'equipamentos')
    AND action = 'delete'
    AND granted = true;

  IF v_granted_template <> 0 THEN
    RAISE EXCEPTION
      'Pós-condição falhou: cargo manutencao ainda tem % linha(s) delete granted=true no template.',
      v_granted_template;
  END IF;

  -- user_permissions: nenhuma linha delete remanescente para cargo manutencao
  -- (exceto conta protegida, que é excluída por design).
  SELECT COUNT(*) INTO v_remaining_up
  FROM public.user_permissions up
  JOIN public.users u ON u.id = up.user_id
  WHERE u.role = 'manutencao'
    AND u.email <> 'bruno.casaletti@grupodrk.com.br'
    AND up.module IN ('manutencao', 'equipamentos')
    AND up.action = 'delete';

  IF v_remaining_up <> 0 THEN
    RAISE EXCEPTION
      'Pós-condição falhou: ainda há % linha(s) delete em user_permissions para cargo manutencao.',
      v_remaining_up;
  END IF;

  RAISE NOTICE 'OK: cargo manutencao sem delete em equipamentos e manutencao (template + user_permissions).';
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
