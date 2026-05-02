-- Migration 078: Adiciona campos de Origem do Deal Ploomes
-- Origem é um campo nativo do Deal (OriginId / Origin.Name)
-- ~92% dos deals têm OriginId preenchido (fonte: investigação Fase A)

ALTER TABLE public.ploomes_deals
  ADD COLUMN IF NOT EXISTS origin_id   BIGINT,
  ADD COLUMN IF NOT EXISTS origin_name TEXT;

-- Índice simples para filtros por origem
CREATE INDEX IF NOT EXISTS idx_ploomes_deals_origin_id
  ON public.ploomes_deals (origin_id)
  WHERE origin_id IS NOT NULL;

-- Índice composto para relatórios por unidade + origem + período
CREATE INDEX IF NOT EXISTS idx_ploomes_deals_unit_origin_create
  ON public.ploomes_deals (unit_id, origin_id, ploomes_create_date)
  WHERE origin_id IS NOT NULL;

COMMENT ON COLUMN public.ploomes_deals.origin_id   IS 'ID da origem do negócio no Ploomes (campo nativo OriginId)';
COMMENT ON COLUMN public.ploomes_deals.origin_name IS 'Nome da origem do negócio no Ploomes (ex: Indicação, Instagram, Google)';
