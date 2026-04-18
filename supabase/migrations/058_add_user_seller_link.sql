-- =============================================================
-- Migration 058: Vínculo usuário ↔ vendedora
-- Adiciona seller_id à tabela users para associar um usuário
-- com role='vendedora' à sua linha em sellers.
-- =============================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS seller_id UUID
    REFERENCES public.sellers(id) ON DELETE SET NULL;

-- Index para lookups por seller (ex: verificar se seller já tem usuário)
CREATE INDEX IF NOT EXISTS idx_users_seller_id
  ON public.users(seller_id) WHERE seller_id IS NOT NULL;

-- Garante que cada sellers só pode ter no máximo 1 usuário vinculado
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_seller_id_not_null
  ON public.users(seller_id) WHERE seller_id IS NOT NULL;

COMMENT ON COLUMN public.users.seller_id IS
  'Vínculo com tabela sellers. Obrigatório quando role=vendedora. '
  'Permite filtrar dados por owner_id do Ploomes via sellers.owner_id. '
  'NULL para todos os demais roles.';
