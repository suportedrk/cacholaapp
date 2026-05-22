-- Migration 096: índice UNIQUE case-insensitive em maintenance_categories
-- Impede duas categorias com o mesmo nome (sem distinção maiúsculas/espaços) na mesma unidade.
-- Tabela está vazia (clean slate de 2026-05-22) — sem risco de conflito em dados existentes.
-- Rollback: 096_maintenance_category_unique_rollback.sql

CREATE UNIQUE INDEX IF NOT EXISTS uq_maintenance_categories_unit_name
  ON public.maintenance_categories (unit_id, lower(trim(name)));
