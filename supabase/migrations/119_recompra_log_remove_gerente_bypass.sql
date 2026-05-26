-- ============================================================
-- Migration 119 — recompra_contact_log: remover gerente do bypass de SELECT
-- Criado em: 2026-05-26
-- Referência: diagnóstico de Fase 2 (BI/Vendas)
--             + decisão do dono em 2026-05-26
--
-- Decisão do dono: fiscalização de TODOS os logs de recompra fica
-- restrita a super_admin + diretor. Gerente sai do bypass (passa a ver
-- apenas os próprios registros, via contacted_by = auth.uid()).
-- Pós-vendas NÃO entra (decisão explícita) — por isso NÃO usamos
-- is_global_viewer() que inclui pos_vendas.
--
-- ── ANTES ──────────────────────────────────────────────────────
-- recompra_log_select USING (
--   contacted_by = auth.uid()
--   OR EXISTS (
--     SELECT 1 FROM users u
--     WHERE u.id = auth.uid()
--       AND u.role IN ('super_admin', 'diretor', 'gerente')
--   )
-- )
--
-- ── DEPOIS ─────────────────────────────────────────────────────
-- recompra_log_select USING (
--   contacted_by = auth.uid()
--   OR EXISTS (
--     SELECT 1 FROM users u
--     WHERE u.id = auth.uid()
--       AND u.role IN ('super_admin', 'diretor')
--   )
-- )
--
-- ── INTACTO ────────────────────────────────────────────────────
-- - cláusula contacted_by = auth.uid() (proprietário continua vendo)
-- - recompra_log_insert (qualquer um pode logar contato)
-- - recompra_log_update (somente o dono do registro)
-- ============================================================

BEGIN;

DROP POLICY IF EXISTS recompra_log_select ON public.recompra_contact_log;

CREATE POLICY recompra_log_select
  ON public.recompra_contact_log
  FOR SELECT
  USING (
    contacted_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
        AND u.role IN ('super_admin', 'diretor')
    )
  );

COMMIT;

NOTIFY pgrst, 'reload schema';
