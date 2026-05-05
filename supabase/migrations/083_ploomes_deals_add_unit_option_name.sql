-- Migration 083: adiciona unit_option_name em ploomes_deals
-- para preservar o valor bruto do campo "Unidade da festa pretendida" do Ploomes,
-- evitando perda de informação pelo fallback silencioso de resolveUnitId.

ALTER TABLE ploomes_deals
  ADD COLUMN IF NOT EXISTS unit_option_name TEXT;

COMMENT ON COLUMN ploomes_deals.unit_option_name IS
  'Valor bruto do campo customizado "Unidade da festa pretendida" no Ploomes '
  '(FieldKey deal_A583075F-D19C-4034-A479-36625C621660). '
  'Pode ser ''Cachola PINHEIROS'', ''Cachola MOEMA'' ou ''Cliente não sabe''. '
  'Preservado do raw value para evitar perda de informação via resolveUnitId, '
  'que faz fallback silencioso para Pinheiros quando não reconhece o valor. '
  'Use esta coluna para filtros de unidade em métricas/KPIs em vez de unit_id.';

CREATE INDEX IF NOT EXISTS idx_ploomes_deals_unit_option_name
  ON ploomes_deals(unit_option_name);

-- Atualizar RLS: permitir que todos os usuários autenticados vejam deals
-- marcados como "Cliente não sabe" (não pertencem a nenhuma unidade real).
-- Antes do backfill, unit_option_name = NULL para todos os rows — condição não ativa.
-- Após o backfill, a condição passa a funcionar e o KPI absoluto fica correto
-- para usuários de qualquer unidade.
DROP POLICY IF EXISTS "Users can view deals of their units" ON ploomes_deals;
CREATE POLICY "Users can view deals of their units" ON ploomes_deals FOR SELECT
  USING (
    (unit_id = ANY(get_user_unit_ids()))
    OR is_global_viewer()
    OR (unit_option_name = 'Cliente não sabe')
  );

NOTIFY pgrst, 'reload schema';
