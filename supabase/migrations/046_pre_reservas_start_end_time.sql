-- ============================================================
-- Migration 046 — Pré-reservas: start_time + end_time
-- Renomeia a coluna `time` para `start_time` e adiciona `end_time`.
-- ============================================================

-- Renomear coluna existente
ALTER TABLE public.pre_reservas_diretoria
  RENAME COLUMN time TO start_time;

-- Adicionar coluna de fim
ALTER TABLE public.pre_reservas_diretoria
  ADD COLUMN IF NOT EXISTS end_time TIME;
