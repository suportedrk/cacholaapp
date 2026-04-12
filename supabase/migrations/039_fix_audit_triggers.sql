-- Migration 039: Fix audit log triggers
-- Problema: auth.uid() retorna NULL em funções SECURITY DEFINER (contexto do owner, não do caller)
-- Solução: usar current_setting('request.jwt.claims') que é setado pelo PostgREST por request
--
-- Também remove triggers em tabelas erradas (events, maintenance_orders)
-- e recria apenas o trigger de users com a função corrigida.

-- ─── 1. Remover triggers quebrados ───────────────────────────────────────────

DROP TRIGGER IF EXISTS audit_events ON events;
DROP TRIGGER IF EXISTS audit_maintenance_orders ON maintenance_orders;
DROP TRIGGER IF EXISTS audit_users ON users;

-- ─── 2. Recriar a função com auth.uid() → jwt.claims ────────────────────────

CREATE OR REPLACE FUNCTION audit_trigger_fn()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID;
  v_action  TEXT;
  v_old     JSONB;
  v_new     JSONB;
BEGIN
  -- Em SECURITY DEFINER, auth.uid() é sempre NULL.
  -- PostgREST popula request.jwt.claims por request autenticado.
  BEGIN
    v_user_id := (current_setting('request.jwt.claims', true)::jsonb->>'sub')::UUID;
  EXCEPTION WHEN OTHERS THEN
    v_user_id := NULL;
  END;

  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_old    := NULL;
    v_new    := to_jsonb(NEW);
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_old    := to_jsonb(OLD);
    v_new    := to_jsonb(NEW);
  ELSE
    v_action := 'delete';
    v_old    := to_jsonb(OLD);
    v_new    := NULL;
  END IF;

  BEGIN
    INSERT INTO audit_logs (user_id, action, module, entity_id, entity_type, old_data, new_data)
    VALUES (
      v_user_id,
      v_action,
      TG_TABLE_NAME,
      CASE
        WHEN TG_OP = 'DELETE' THEN (OLD).id::TEXT
        ELSE (NEW).id::TEXT
      END,
      TG_TABLE_NAME,
      v_old,
      v_new
    );
  EXCEPTION WHEN OTHERS THEN
    -- Audit nunca deve bloquear a operação principal
    NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$;

-- ─── 3. Recriar trigger de users (safety net para operações admin) ───────────

CREATE TRIGGER audit_users
  AFTER INSERT OR UPDATE OR DELETE ON users
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_fn();
