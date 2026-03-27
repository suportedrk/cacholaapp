-- ============================================================
-- Migration 008 — Funções auxiliares de notificações
-- ============================================================

-- Função para inserir notificações sem restrição de RLS
-- (SECURITY DEFINER — roda com privilégios do criador)
CREATE OR REPLACE FUNCTION create_notification(
  p_user_id UUID,
  p_type    TEXT,
  p_title   TEXT,
  p_body    TEXT,
  p_link    TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO notifications (user_id, type, title, body, link, is_read)
  VALUES (p_user_id, p_type, p_title, p_body, p_link, FALSE)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- Garante que usuários autenticados podem chamar a função
GRANT EXECUTE ON FUNCTION create_notification TO authenticated;

-- RLS na tabela notifications: usuário só lê as próprias
-- (INSERT é feito somente via função, não diretamente)
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_own"   ON notifications;
DROP POLICY IF EXISTS "notifications_update_own"   ON notifications;
DROP POLICY IF EXISTS "notifications_delete_own"   ON notifications;

CREATE POLICY "notifications_select_own"
  ON notifications FOR SELECT
  USING (auth_user_id() = user_id);

CREATE POLICY "notifications_update_own"
  ON notifications FOR UPDATE
  USING (auth_user_id() = user_id)
  WITH CHECK (auth_user_id() = user_id);

CREATE POLICY "notifications_delete_own"
  ON notifications FOR DELETE
  USING (auth_user_id() = user_id);
