-- supabase/migrations/135_manutencao_bloco_a_remover_items.sql
-- Bloco A — Remove o conceito "Item" do módulo de Manutenção.
--
-- O banco está zerado (0 itens, 0 tickets com item_id preenchido) — remoção limpa.
-- ON DELETE SET NULL já existe na FK maintenance_tickets.item_id — nenhum dado é corrompido.
-- DROP TABLE derruba automaticamente: PK, 2 índices (idx_mitems_sector_id, idx_mitems_unit_id),
-- 4 policies RLS (criadas na migration 094) e o trigger updated_at.

BEGIN;

-- 1. Remover coluna item_id de maintenance_tickets
--    (a FK constraint é dropada automaticamente junto com a coluna)
ALTER TABLE public.maintenance_tickets
  DROP COLUMN IF EXISTS item_id;

-- 2. Dropar tabela maintenance_items
--    (policies RLS, índices e triggers são dropados automaticamente)
DROP TABLE IF EXISTS public.maintenance_items;

COMMIT;
