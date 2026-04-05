-- ============================================================
-- Cachola OS — Migration 026: Corrigir handle_new_user e CHECK constraint
-- ============================================================
-- Dois problemas identificados durante operação em produção:
--
-- 1. handle_new_user (migration 003) usava ON CONFLICT (user_id, module, action)
--    A migration 010 adicionou unit_id ao UNIQUE constraint de user_permissions
--    (UNIQUE NULLS NOT DISTINCT (user_id, unit_id, module, action)), tornando
--    o ON CONFLICT antigo inválido. Corrigido para incluir unit_id.
--
-- 2. user_permissions_module_check não incluía 'providers'.
--    A migration 021 corrigiu role_default_perms mas não user_permissions.
--    Corrigido para incluir 'providers' em ambas as tabelas.
-- ============================================================
-- Execute com:
--   docker exec supabase-db bash -c "psql -U postgres -d postgres -f /docker-entrypoint-migrations/026_fix_handle_new_user_and_permissions.sql"
-- ============================================================

-- ── 1. Corrigir CHECK constraint de user_permissions ─────────────────────────
-- Adicionar 'providers' ao módulo permitido (idempotente via DROP+ADD)

ALTER TABLE public.user_permissions
  DROP CONSTRAINT IF EXISTS user_permissions_module_check;

ALTER TABLE public.user_permissions
  ADD CONSTRAINT user_permissions_module_check
  CHECK (module IN (
    'events', 'maintenance', 'checklists', 'users', 'reports',
    'audit_logs', 'notifications', 'settings', 'providers'
  ));

-- ── 2. Corrigir function handle_new_user ────────────────────────────────────
-- ON CONFLICT deve incluir unit_id para bater com o UNIQUE constraint
-- adicionado na migration 010 (UNIQUE NULLS NOT DISTINCT user_id, unit_id, module, action)

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_role TEXT;
  v_name TEXT;
BEGIN
  v_role := COALESCE(NEW.raw_user_meta_data->>'role', 'freelancer');
  v_name := COALESCE(
    NEW.raw_user_meta_data->>'name',
    split_part(NEW.email, '@', 1)
  );

  INSERT INTO public.users (id, email, name, role)
  VALUES (NEW.id, NEW.email, v_name, v_role)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_permissions (user_id, module, action, granted)
  SELECT NEW.id, module, action, granted
  FROM public.role_default_perms
  WHERE role = v_role
  ON CONFLICT (user_id, unit_id, module, action) DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
