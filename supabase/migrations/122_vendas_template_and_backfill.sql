-- ============================================================
-- Migration 122 — Vendas: template + backfill de vendas.view (Fase 3, Parte 1)
-- Criado em: 2026-05-29
-- Referência: docs/rbac/fase-a-vendas.md (§4 backfill, Aprendizado 1)
--             + estrutura das migrations 113 e 116
--
-- NEUTRA EM COMPORTAMENTO. Esta migration só CRIA grants `vendas.view`
-- em user_permissions. Os guards de Vendas (layout /vendas e os RPCs)
-- continuam por CARGO até a Parte 2 — portanto NADA muda para o usuário
-- agora. O objetivo é garantir que os grants existam ANTES da troca de
-- trava (Parte 2), evitando lockout (Aprendizado 1).
--
-- ── ESCOPO ────────────────────────────────────────────────────
--   1. Template (role_permissions): garante vendas.view = true para
--      diretor, vendedora, pos_vendas. NOTA: na auditoria de 2026-05-29
--      esses grants JÁ existiam em role_permissions (local e prod), logo
--      o INSERT é um no-op idempotente — incluído apenas como rede de
--      segurança / documentação do estado-alvo do template.
--   2. Backfill (user_permissions): para todo usuário ATIVO em
--      (diretor, vendedora, pos_vendas), cria (user_id,'vendas','view',
--      granted=true), ON CONFLICT DO NOTHING.
--
-- ── EXCLUSÕES DELIBERADAS ─────────────────────────────────────
--   - super_admin: bypass em check_permission() — não precisa de grant.
--   - gerente: NÃO recebe vendas.view (D1 — gerente fora de
--     VENDAS_MODULE_ROLES desde v1.5.1; perde acesso aos RPCs na Parte 2).
--   - Apenas a ação 'view' nesta leva. Escritas (create/edit/delete)
--     permanecem governadas por cargo (G-ii) — não backfillar.
--
-- ── role_default_perms (legado) NÃO É TOCADO ──────────────────
--   A herança de novos usuários vem de `role_permissions` (confirmado em
--   src/lib/rbac/apply-template.ts). `role_default_perms` está VAZIO até
--   para o módulo já convertido `checklist_comercial` (auditoria
--   2026-05-29, local e prod) — é tabela legada e não é fonte de herança.
--   Tocá-la tornaria `vendas` o único módulo com linhas lá, criando
--   inconsistência com o padrão estabelecido (migrations 113/116 também
--   não a tocaram). Por isso esta migration NÃO escreve em
--   role_default_perms, divergindo da redação do prompt mas seguindo o
--   padrão comprovado e o caminho de código real.
--
-- Idempotente. Não-destrutivo.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Pré-condição: catálogo permission_controls tem a ação 'view'
-- ------------------------------------------------------------
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.permission_controls
  WHERE module_code = 'vendas'
    AND code = 'view'
    AND kind = 'action';

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'Abortando: esperava a ação view em permission_controls para vendas, encontrei %. Migration 107 precisa estar aplicada.',
      v_count;
  END IF;
END
$$;

-- ------------------------------------------------------------
-- PASSO 1 — Template: garante vendas.view = true (idempotente, no-op se já existe)
-- ------------------------------------------------------------
INSERT INTO public.role_permissions (role_code, module_code, action, granted)
VALUES
  ('diretor',    'vendas', 'view', true),
  ('vendedora',  'vendas', 'view', true),
  ('pos_vendas', 'vendas', 'view', true)
ON CONFLICT (role_code, module_code, action) DO NOTHING;

DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.role_permissions
  WHERE module_code = 'vendas'
    AND action = 'view'
    AND granted = true
    AND role_code IN ('diretor','vendedora','pos_vendas');

  IF v_count <> 3 THEN
    RAISE EXCEPTION
      'Falha no template: esperava 3 linhas (diretor/vendedora/pos_vendas)×vendas×view granted=true, encontrei %.',
      v_count;
  END IF;

  RAISE NOTICE 'OK: template vendas.view garantido para diretor/vendedora/pos_vendas.';
END
$$;

-- ------------------------------------------------------------
-- PASSO 2 — Backfill aditivo de user_permissions (somente 'view')
-- ------------------------------------------------------------
DO $$
DECLARE
  v_before INT;
BEGIN
  SELECT COUNT(*) INTO v_before
  FROM public.user_permissions WHERE module = 'vendas' AND action = 'view';
  RAISE NOTICE 'user_permissions vendas.view antes do backfill: %', v_before;
END
$$;

-- diretor / vendedora / pos_vendas: view (super_admin bypass; gerente fora)
INSERT INTO public.user_permissions (user_id, unit_id, module, action, granted)
SELECT
  u.id        AS user_id,
  NULL::UUID  AS unit_id,
  'vendas'    AS module,
  'view'      AS action,
  true        AS granted
FROM public.users u
WHERE u.is_active = true
  AND u.role IN ('diretor','vendedora','pos_vendas')
ON CONFLICT (user_id, unit_id, module, action) DO NOTHING;

-- ------------------------------------------------------------
-- Pós-condição: 0 gaps para (diretor, vendedora, pos_vendas)
-- ------------------------------------------------------------
DO $$
DECLARE
  v_after INT;
  v_gap   INT;
BEGIN
  SELECT COUNT(*) INTO v_after
  FROM public.user_permissions WHERE module = 'vendas' AND action = 'view';

  SELECT COUNT(*) INTO v_gap
  FROM public.users u
  WHERE u.is_active = true
    AND u.role IN ('diretor','vendedora','pos_vendas')
    AND NOT EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = u.id
        AND up.module = 'vendas'
        AND up.action = 'view'
        AND up.granted = true
    );

  RAISE NOTICE 'user_permissions vendas.view após backfill: %', v_after;
  RAISE NOTICE 'usuários ativos (diretor/vendedora/pos_vendas) sem vendas.view: %', v_gap;

  IF v_gap > 0 THEN
    RAISE EXCEPTION
      'Cobertura incompleta após backfill: % usuários sem vendas.view. Investigar antes da Parte 2.',
      v_gap;
  END IF;

  RAISE NOTICE 'OK: backfill vendas.view completo, 0 gaps.';
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
