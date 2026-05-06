-- Migration 084: corrige string 'Cliente não sabe' → 'Cliente ainda não sabe'
-- em ploomes_deals (policy RLS e comentário da coluna unit_option_name).
--
-- Contexto: o valor real no Ploomes é 'Cliente ainda não sabe' (com "ainda").
-- A migration 083 gravou a string curta, causando 0 matches no KPI "Cliente ainda não sabe".
-- Esta migration alinha o banco com o valor real da API.

-- 1. Atualizar dados existentes no banco (backfill inline)
UPDATE ploomes_deals
SET unit_option_name = 'Cliente ainda não sabe'
WHERE unit_option_name = 'Cliente não sabe';

-- 2. Recriar policy RLS com string correta
DROP POLICY IF EXISTS "Users can view deals of their units" ON ploomes_deals;
CREATE POLICY "Users can view deals of their units" ON ploomes_deals FOR SELECT
  USING (
    (unit_id = ANY(get_user_unit_ids()))
    OR is_global_viewer()
    OR (unit_option_name = 'Cliente ainda não sabe')
  );

-- 3. Atualizar comentário da coluna
COMMENT ON COLUMN ploomes_deals.unit_option_name IS
  'Valor bruto do campo customizado "Unidade da festa pretendida" no Ploomes '
  '(FieldKey deal_BD9C4B07-20E5-458A-8273-6BA271A6DEBD). '
  'Pode ser ''Cachola PINHEIROS'', ''Cachola MOEMA'' ou ''Cliente ainda não sabe''. '
  'Preservado do raw value para evitar perda de informação via resolveUnitId, '
  'que faz fallback silencioso para Pinheiros quando não reconhece o valor. '
  'Use esta coluna para filtros de unidade em métricas/KPIs em vez de unit_id.';

NOTIFY pgrst, 'reload schema';
