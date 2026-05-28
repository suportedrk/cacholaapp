-- ============================================================
-- Migration 121 — Prestadores: backfill aditivo manutencao/view (Fase 3 — Etapa 1)
-- Criado em: 2026-05-27
-- Referência: docs/rbac/proposta-arquitetura-alvo.md — Fase 3 Etapa 1 (Prestadores)
--
-- CONTEXTO: a RLS de SELECT de service_providers/event_providers usa
-- check_permission('prestadores','view'). O cargo manutencao está em
-- PRESTADORES_ACCESS_ROLES (acessa a página), mas sem a linha em
-- user_permissions a RLS retorna 0 linhas — a tela e a sub-rota
-- /manutencao/fornecedores aparecem vazias para técnicos.
--
-- Esta migration corrige esse bug latente: insere
-- (user_id, NULL, 'prestadores', 'view', true) para cada usuário ativo
-- com cargo manutencao que ainda não tem esse grant.
--
-- Cargos pos_vendas, decoracao, financeiro foram deliberadamente
-- excluídos: o dono decidiu que esses cargos irão de "página vazia"
-- para 403 após a conversão do layout (contrações aprovadas).
--
-- super_admin excluído: bypassa check_permission, backfill seria cosmético.
-- ON CONFLICT DO NOTHING preserva overrides individuais pré-existentes.
-- Não-destrutivo. Idempotente.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Pré-condição: permission_controls tem 'prestadores.view'
-- ------------------------------------------------------------
DO $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.permission_controls
    WHERE module_code = 'prestadores' AND code = 'view' AND kind = 'action'
  ) INTO v_ok;

  IF NOT v_ok THEN
    RAISE EXCEPTION
      'Abortando: permission_controls(prestadores, view) ausente. Migration 107 precisa estar aplicada.';
  END IF;
END
$$;

-- ------------------------------------------------------------
-- Contagem pré-backfill (para log)
-- ------------------------------------------------------------
DO $$
DECLARE
  v_before INT;
BEGIN
  SELECT COUNT(*) INTO v_before
  FROM public.user_permissions WHERE module = 'prestadores';
  RAISE NOTICE 'user_permissions em prestadores antes do backfill: %', v_before;
END
$$;

-- ------------------------------------------------------------
-- Backfill aditivo: manutencao/view
-- ------------------------------------------------------------
INSERT INTO public.user_permissions (user_id, unit_id, module, action, granted)
SELECT
  u.id       AS user_id,
  NULL::UUID AS unit_id,
  'prestadores' AS module,
  'view'        AS action,
  true          AS granted
FROM public.users u
WHERE u.role = 'manutencao'
  AND u.is_active = true
ON CONFLICT (user_id, unit_id, module, action) DO NOTHING;

-- ------------------------------------------------------------
-- Pós-condição: cada manutencao ativo tem cobertura de prestadores.view
-- ------------------------------------------------------------
DO $$
DECLARE
  v_after INT;
  v_short INT;
BEGIN
  SELECT COUNT(*) INTO v_after
  FROM public.user_permissions WHERE module = 'prestadores';

  SELECT COUNT(*) INTO v_short
  FROM public.users u
  WHERE u.role = 'manutencao' AND u.is_active = true
    AND NOT EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = u.id
        AND up.module = 'prestadores'
        AND up.action = 'view'
        AND up.granted = true
    );

  RAISE NOTICE 'user_permissions em prestadores após backfill: %', v_after;
  RAISE NOTICE 'usuários manutencao ativos SEM prestadores.view granted=true: %', v_short;

  IF v_short > 0 THEN
    RAISE WARNING
      '% usuário(s) manutencao ativo(s) ficaram sem prestadores.view granted=true. Linha granted=false pré-existente pode ter sido preservada pelo ON CONFLICT DO NOTHING. Investigar antes de deployar o layout convertido.',
      v_short;
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
