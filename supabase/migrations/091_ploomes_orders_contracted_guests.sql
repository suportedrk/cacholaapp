-- supabase/migrations/091_ploomes_orders_contracted_guests.sql
-- Objetivo: armazenar "Convidados contratados" do Order Ploomes em ploomes_orders
-- (FieldKey order_3620B917-6DCD-4977-824F-F159CC196E29, TypeId=4 IntegerValue).
-- Esta passa a ser a fonte de verdade para events.guest_count, substituindo o
-- campo de Deal (deal_05EE1763-7254-4C41-B419-365794B1CA06, "Nº Pessoas").
-- Decisão de produto: zeragem imediata de events.guest_count para todos os
-- eventos vindos do Ploomes (ploomes_deal_id IS NOT NULL). O sync-orders
-- populará guest_count com o valor real na próxima execução (cron ~30min).
-- Eventos manuais (ploomes_deal_id IS NULL) ficam intactos.

BEGIN;

-- ─── 1. Nova coluna em ploomes_orders ───────────────────────────────────────

ALTER TABLE public.ploomes_orders
  ADD COLUMN IF NOT EXISTS contracted_guests INTEGER;

COMMENT ON COLUMN public.ploomes_orders.contracted_guests IS
  'Convidados contratados (FieldKey order_3620B917-6DCD-4977-824F-F159CC196E29, TypeId=4 IntegerValue). '
  'Fonte de verdade para events.guest_count a partir da v1.10.0. '
  'NULL = campo não preenchido no Ploomes ou Order ainda não sincronizada.';

-- ─── 2. Zerar guest_count nos eventos vindos do Ploomes ────────────────────
-- O valor anterior vinha do Deal (campo "Nº Pessoas"), que a diretoria
-- considera não confiável após mudanças de escopo durante a negociação.
-- O sync-orders populará o valor correto na próxima execução.

UPDATE public.events
  SET guest_count = NULL
WHERE ploomes_deal_id IS NOT NULL;

-- ─── 3. Recarregar schema cache do PostgREST ───────────────────────────────

NOTIFY pgrst, 'reload schema';

COMMIT;
