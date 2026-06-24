-- ============================================================
-- Rollback da Migration 164 — Confirmação de leitura do Mural de Avisos
-- ============================================================

DROP TABLE IF EXISTS public.central_servicos_avisos_leitura;

ALTER TABLE public.central_servicos_avisos
  DROP COLUMN IF EXISTS exige_confirmacao;
