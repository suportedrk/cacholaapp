-- ============================================================
-- Migration 120 — Fundação da Fase 3: helper check_permission_or_raise
-- Criado em: 2026-05-27
-- Referência: docs/rbac/proposta-arquitetura-alvo.md — Etapa 0 da Fase 3
--
-- Encapsula o padrão repetido em RPCs SECURITY DEFINER do projeto:
--   IF NOT EXISTS (SELECT 1 FROM users WHERE id = auth.uid()
--                  AND role IN (...)) THEN RAISE EXCEPTION 'insufficient_privilege';
--
-- Substituto direto desse bloco para conversões futuras (Etapa 1 da Fase 3),
-- agora lendo o catálogo configurável em vez de cargo:
--
--   PERFORM public.check_permission_or_raise('vendas', 'view');
--   -- corpo da RPC continua daqui em diante
--
-- super_admin é bypassado dentro da própria check_permission (early return),
-- então este helper herda esse comportamento sem código adicional.
--
-- ESTA MIGRATION NÃO ALTERA NENHUMA FUNÇÃO EXISTENTE.
-- Apenas adiciona o helper para uso nas conversões subsequentes.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.check_permission_or_raise(
  p_module TEXT,
  p_action TEXT
)
RETURNS VOID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NOT public.check_permission(auth.uid(), p_module, p_action) THEN
    RAISE EXCEPTION 'insufficient_privilege'
      USING ERRCODE = '42501';
  END IF;
END;
$function$;

COMMENT ON FUNCTION public.check_permission_or_raise(TEXT, TEXT) IS
  'Guarda configurável para RPCs SECURITY DEFINER. Chama check_permission e RAISE EXCEPTION insufficient_privilege (ERRCODE 42501) em caso de negativa. super_admin bypassa via check_permission. Substitui o padrão IF NOT EXISTS + role IN inline em conversões da Fase 3.';

COMMIT;

NOTIFY pgrst, 'reload schema';
