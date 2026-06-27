-- ============================================================
-- ROLLBACK da Migration 175 — remove o read-only de impersonation
-- ============================================================
-- ATENCAO: se a migration 176 (gate das politicas de escrita de dono) estiver aplicada,
-- ela referencia public.is_impersonating() -> rode o rollback da 176 ANTES deste.
--
-- Restaura check_permission ao BASELINE VIVO (migration 076 VERBATIM: CASE EN->PT-BR +
-- SET search_path = public), sem o gate de impersonation, e remove o helper.
-- Idempotente. Sem BEGIN/COMMIT nem NOTIFY pgrst (a esteira cuida).
-- ============================================================

-- 1) check_permission de volta ao baseline 076 (sem o gate de read-only).
CREATE OR REPLACE FUNCTION public.check_permission(
  p_user_id uuid,
  p_module text,
  p_action text
)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_granted BOOLEAN;
  v_role TEXT;
  v_module TEXT;
BEGIN
  -- Super admin sempre pode
  SELECT role INTO v_role FROM public.users WHERE id = p_user_id;
  IF v_role = 'super_admin' THEN
    RETURN TRUE;
  END IF;

  -- Mapeia codigos legados EN -> PT-BR (compativel com migration 073)
  v_module := CASE p_module
    WHEN 'events'        THEN 'eventos'
    WHEN 'maintenance'   THEN 'manutencao'
    WHEN 'users'         THEN 'usuarios'
    WHEN 'reports'       THEN 'relatorios'
    WHEN 'audit_logs'    THEN 'logs'
    WHEN 'notifications' THEN 'notificacoes'
    WHEN 'settings'      THEN 'configuracoes'
    WHEN 'providers'     THEN 'prestadores'
    WHEN 'minutes'       THEN 'atas'
    ELSE p_module
  END;

  SELECT granted INTO v_granted
  FROM public.user_permissions
  WHERE user_id = p_user_id
    AND module = v_module
    AND action = p_action;

  RETURN COALESCE(v_granted, FALSE);
END;
$$;

COMMENT ON FUNCTION public.check_permission(uuid, text, text) IS
'Verifica permissao do usuario em (modulo, acao). Mapeia codigos EN legados (events, providers, etc) para PT-BR (eventos, prestadores) por causa da migration 073. Quando todas as 51 policies forem atualizadas para PT-BR, o CASE pode ser removido.';

-- 2) Remove o helper (sem CASCADE de proposito: se algo ainda depende, rode o
--    rollback da 176 primeiro).
DROP FUNCTION IF EXISTS public.is_impersonating();
