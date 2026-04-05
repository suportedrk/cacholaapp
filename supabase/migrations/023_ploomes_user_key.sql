-- ============================================================
-- Cachola OS — Migration 023: Ploomes User Key no Banco
-- ============================================================
-- Adiciona o campo `user_key` à tabela `ploomes_config` para
-- que a chave de API do Ploomes seja gerenciada por unidade
-- no banco de dados, sem depender de variável de ambiente.
--
-- A variável PLOOMES_USER_KEY no .env passa a ser apenas fallback.
-- ============================================================
-- Execute com:
--   docker exec cacholaos-db bash -c "psql -U postgres -d postgres -f /docker-entrypoint-migrations/023_ploomes_user_key.sql"
-- ============================================================

ALTER TABLE public.ploomes_config
  ADD COLUMN IF NOT EXISTS user_key TEXT NOT NULL DEFAULT '';
