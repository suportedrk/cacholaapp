-- ============================================================
-- Migration 124 — BI: backfill de bi/bi_atendimento/bi_vendas.view
--                  para diretor (Fase 3, Parte 1)
-- Criado em: 2026-05-29
-- Referência: docs/rbac/fase-a-bi.md (§5 backfill, Aprendizado 1)
--             + estrutura das migrations 113, 116 e 122
--
-- NEUTRA EM COMPORTAMENTO. Esta migration só CRIA grants `.view` em
-- user_permissions para o cargo diretor nos 3 módulos do catálogo do BI.
-- Os guards do BI (layout /bi e os 17 RPCs get_bi_*) continuam por CARGO
-- (role IN) até a Parte 2 — portanto NADA muda para o usuário agora. O
-- objetivo é garantir que o diretor tenha os grants ANTES da troca de
-- trava (Parte 2), evitando lockout (Aprendizado 1).
--
-- ── DECISÕES DO DONO APLICADAS (FASE A) ───────────────────────
--   G1: split em 3 módulos de catálogo (bi / bi_atendimento / bi_vendas).
--   G2=C: bi_vendas passa a ser super_admin+diretor (gerente/financeiro
--         SAEM). Logo, NESTA Parte 1, gerente/financeiro NÃO recebem
--         backfill em NENHUM módulo BI — nem em bi_vendas. A remoção deles
--         do TEMPLATE (role_permissions) e o fechamento do acesso vestigial
--         via JWT são da Parte 2, junto da conversão dos guards.
--   G3: converter bi/bi_atendimento/bi_vendas removerá o acesso-JWT de
--       gerente/financeiro — coerente com não os backfillar aqui.
--
-- ── ESCOPO ────────────────────────────────────────────────────
--   Backfill (user_permissions): para todo usuário ATIVO com role=diretor,
--   cria (user_id, <modulo>, 'view', granted=true, unit_id=NULL) para os
--   3 módulos bi / bi_atendimento / bi_vendas. ON CONFLICT DO NOTHING.
--
-- ── EXCLUSÕES DELIBERADAS ─────────────────────────────────────
--   - super_admin: bypass em check_permission() (early-return) — não
--     precisa de grant; não entra no backfill.
--   - gerente / financeiro: NÃO recebem grants BI nesta Parte 1 (G2=C/G3).
--   - Apenas a ação 'view'. Escritas (create/edit/delete/export) NÃO são
--     backfilladas — BI é leitura; ações de escrita seguem por cargo.
--   - role_permissions (template) NÃO é tocado: o template dos 3 módulos
--     já está no estado correto desta fase (auditoria 2026-05-29 prod:
--     bi.view=sa+dir, bi_atendimento.view=sa+dir, bi_vendas.view=
--     sa+dir+gerente+financeiro). A remoção de gerente/financeiro de
--     bi_vendas no template é da Parte 2.
--
-- ── role_default_perms (legado) NÃO É TOCADO ──────────────────
--   A herança de novos usuários vem de role_permissions (confirmado em
--   src/lib/rbac/apply-template.ts). role_default_perms está VAZIO até
--   para módulos já convertidos — não é fonte de herança. Padrão das
--   migrations 113/116/122. Esta não escreve lá.
--
-- ── ANOMALIA DE PRODUÇÃO (a tratar na Parte 2, NÃO aqui) ───────
--   Auditoria 2026-05-29 (prod): o gerente brunocasaletti@gmail.com possui
--   grants individuais de TODAS as 5 ações nos 3 módulos BI (override
--   adormecido). Na Parte 2 (conversão dos guards), esses grants acordarão
--   — gerente ganharia acesso à rota /bi via bi.view e manteria bi_vendas,
--   contrariando G2=C. Devem ser LIMPOS na Parte 2 (igual à limpeza de
--   gerente no Vendas Parte 2). Esta Parte 1 NÃO mexe em grants de gerente.
--
-- Idempotente. Não-destrutivo.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Pré-condição: catálogo tem a ação 'view' nos 3 módulos BI
-- ------------------------------------------------------------
DO $$
DECLARE
  v_count INT;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM public.permission_controls
  WHERE module_code IN ('bi','bi_atendimento','bi_vendas')
    AND code = 'view'
    AND kind = 'action';

  IF v_count <> 3 THEN
    RAISE EXCEPTION
      'Abortando: esperava 3 ações view (bi/bi_atendimento/bi_vendas) em permission_controls, encontrei %. Catálogo RBAC precisa estar aplicado.',
      v_count;
  END IF;

  RAISE NOTICE 'OK: catálogo bi/bi_atendimento/bi_vendas.view confirmado.';
END
$$;

-- ------------------------------------------------------------
-- Log: estado antes do backfill
-- ------------------------------------------------------------
DO $$
DECLARE
  v_before INT;
BEGIN
  SELECT COUNT(*) INTO v_before
  FROM public.user_permissions
  WHERE module IN ('bi','bi_atendimento','bi_vendas') AND action = 'view';
  RAISE NOTICE 'user_permissions {bi,bi_atendimento,bi_vendas}.view antes do backfill: %', v_before;
END
$$;

-- ------------------------------------------------------------
-- Backfill aditivo: diretor ativo × 3 módulos × 'view' (unit_id NULL)
-- super_admin bypass; gerente/financeiro fora (G2=C/G3); só 'view'.
-- ------------------------------------------------------------
INSERT INTO public.user_permissions (user_id, unit_id, module, action, granted)
SELECT
  u.id        AS user_id,
  NULL::UUID  AS unit_id,
  m.module    AS module,
  'view'      AS action,
  true        AS granted
FROM public.users u
CROSS JOIN (VALUES ('bi'), ('bi_atendimento'), ('bi_vendas')) AS m(module)
WHERE u.is_active = true
  AND u.role = 'diretor'
ON CONFLICT (user_id, unit_id, module, action) DO NOTHING;

-- ------------------------------------------------------------
-- Pós-condição: 0 gaps de diretor nos 3 módulos
-- ------------------------------------------------------------
DO $$
DECLARE
  v_after INT;
  v_gap   INT;
BEGIN
  SELECT COUNT(*) INTO v_after
  FROM public.user_permissions
  WHERE module IN ('bi','bi_atendimento','bi_vendas') AND action = 'view';

  SELECT COUNT(*) INTO v_gap
  FROM public.users u
  CROSS JOIN (VALUES ('bi'), ('bi_atendimento'), ('bi_vendas')) AS m(module)
  WHERE u.is_active = true
    AND u.role = 'diretor'
    AND NOT EXISTS (
      SELECT 1 FROM public.user_permissions up
      WHERE up.user_id = u.id
        AND up.module = m.module
        AND up.action = 'view'
        AND up.granted = true
    );

  RAISE NOTICE 'user_permissions {bi,bi_atendimento,bi_vendas}.view após backfill: %', v_after;
  RAISE NOTICE 'pares (diretor ativo × módulo BI) sem .view: %', v_gap;

  IF v_gap > 0 THEN
    RAISE EXCEPTION
      'Cobertura incompleta após backfill: % pares diretor×módulo sem .view. Investigar antes da Parte 2.',
      v_gap;
  END IF;

  RAISE NOTICE 'OK: backfill BI.view completo para diretor, 0 gaps.';
END
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
