-- ============================================================
-- Migration 109 — Equipamentos: backfill aditivo de user_permissions
-- Criado em: 2026-05-26
-- Referência: docs/rbac/proposta-arquitetura-alvo.md + Opção B aprovada
--
-- Segunda das três migrations do piloto Equipamentos.
-- Garante que TODO usuário com cargo diretor / gerente / manutencao tenha
-- linhas em user_permissions concedendo view/create/edit/delete em
-- equipamentos. Sem isso, quando a 110 trocar a RLS para chamar
-- check_permission(), esses usuários perderiam acesso (a função consulta
-- user_permissions; super_admin tem bypass).
--
-- ADITIVO E NÃO-DESTRUTIVO:
--   ON CONFLICT (user_id, unit_id, module, action) DO NOTHING
--   Linhas pré-existentes (incluindo eventuais granted=false explícitos)
--   são preservadas intactas. A migration só CRIA linhas que faltam.
--
-- super_admin é EXCLUÍDO de propósito — check_permission() devolve TRUE
-- para super_admin antes de consultar user_permissions (bypass de
-- migration 076). Linhas para super_admin seriam cosméticas.
--
-- unit_id = NULL → permissão global (padrão atual: 100% dos registros
-- em user_permissions usam unit_id=NULL; UI /admin/usuarios/[id]/
-- permissoes só grava global).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Pré-condição: template já alinhado (migration 108 aplicada)
-- ------------------------------------------------------------
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.role_permissions
  WHERE role_code = 'manutencao'
    AND module_code = 'equipamentos'
    AND action IN ('create','edit','delete')
    AND granted = true;

  IF v_count <> 3 THEN
    RAISE EXCEPTION
      'Abortando: template do cargo manutencao em equipamentos ainda não alinhado (esperava 3 ações granted=true, achei %). Aplicar migration 108 antes desta.',
      v_count;
  END IF;
END
$$;

-- ------------------------------------------------------------
-- Captura contagens pré-backfill para o relatório de pós-condição
-- ------------------------------------------------------------
DO $$
DECLARE
  v_before INT;
BEGIN
  SELECT COUNT(*) INTO v_before
  FROM public.user_permissions
  WHERE module = 'equipamentos';

  RAISE NOTICE 'user_permissions em equipamentos antes do backfill: %', v_before;
END
$$;

-- ------------------------------------------------------------
-- Backfill aditivo: insere linhas faltantes para diretor/gerente/
-- manutencao a partir do template em role_permissions.
--
-- Estratégia: para cada user com cargo elegível, gera as linhas
-- (user_id, NULL, 'equipamentos', action, granted=true) onde
-- role_permissions[(cargo, equipamentos, action)] = true.
-- ON CONFLICT DO NOTHING preserva qualquer customização individual
-- pré-existente.
-- ------------------------------------------------------------
INSERT INTO public.user_permissions (user_id, unit_id, module, action, granted)
SELECT
  u.id              AS user_id,
  NULL::UUID        AS unit_id,
  'equipamentos'    AS module,
  rp.action         AS action,
  rp.granted        AS granted
FROM public.users u
JOIN public.role_permissions rp
  ON rp.role_code = u.role
WHERE u.role IN ('diretor', 'gerente', 'manutencao')
  AND rp.module_code = 'equipamentos'
  AND rp.granted = true
  AND rp.action IN ('view','create','edit','delete')
ON CONFLICT (user_id, unit_id, module, action) DO NOTHING;

-- ------------------------------------------------------------
-- Pós-condição: cada usuário de cada cargo elegível deve ter
-- exatamente 4 linhas granted=true em equipamentos (ou já tinha
-- linhas que foram preservadas — em ambos os casos a soma deve
-- cobrir todos os 4 actions).
-- ------------------------------------------------------------
DO $$
DECLARE
  v_after INT;
  v_users_short_count INT;
BEGIN
  SELECT COUNT(*) INTO v_after
  FROM public.user_permissions
  WHERE module = 'equipamentos';

  -- Verifica se cada user elegível tem cobertura completa (4 actions)
  SELECT COUNT(*) INTO v_users_short_count
  FROM public.users u
  WHERE u.role IN ('diretor', 'gerente', 'manutencao')
    AND (
      SELECT COUNT(*) FROM public.user_permissions up
      WHERE up.user_id = u.id
        AND up.module = 'equipamentos'
        AND up.action IN ('view','create','edit','delete')
        AND up.granted = true
    ) <> 4;

  RAISE NOTICE 'user_permissions em equipamentos após backfill: %', v_after;
  RAISE NOTICE 'usuários elegíveis SEM cobertura completa (4/4 actions granted=true): %', v_users_short_count;

  IF v_users_short_count > 0 THEN
    RAISE WARNING
      '% usuário(s) elegível(is) ficaram sem cobertura completa em equipamentos. Pode haver linha granted=false pré-existente preservada pelo ON CONFLICT DO NOTHING. Investigar manualmente antes de aplicar a migration 110.',
      v_users_short_count;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
